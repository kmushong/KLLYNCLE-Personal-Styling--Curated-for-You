import { createClient } from "@libsql/client/web";
import { DEFAULT_CAPACITY, SERVICES, TIMES, TIME_ZONE } from "./config.js";

let schemaReady = null;

export function getDb(env) {
  if (!env.TURSO_DATABASE_URL) throw new Error("TURSO_DATABASE_URL is not set");
  const db = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });
  schemaReady = schemaReady || initSchema(db).catch((e) => { schemaReady = null; throw e; });
  return schemaReady.then(() => db);
}

function initSchema(db) {
  return db.batch([
    `CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      status TEXT NOT NULL DEFAULT 'pending',
      name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '',
      service TEXT NOT NULL, date TEXT NOT NULL, time TEXT NOT NULL, notes TEXT NOT NULL DEFAULT ''
    )`,
    "CREATE INDEX IF NOT EXISTS idx_bookings_date_time ON bookings(date, time)",
    "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
    `CREATE TABLE IF NOT EXISTS blocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL, time TEXT NOT NULL DEFAULT '', reason TEXT NOT NULL DEFAULT '',
      UNIQUE(date, time)
    )`,
  ], "write");
}

export const run = async (db, sql, args = []) => (await db.execute({ sql, args })).rows;
export const one = async (db, sql, args = []) => (await run(db, sql, args))[0];

export async function getCapacity(db) {
  const r = await one(db, "SELECT value FROM settings WHERE key = 'capacity'");
  const n = r ? Number(r.value) : DEFAULT_CAPACITY;
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_CAPACITY;
}

export function todayLocal() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function nowTimeLocal() {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
}

export function validDate(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T12:00:00Z");
  return !isNaN(d) && d.toISOString().slice(0, 10) === s;
}
export const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers },
  });
}
export const fail = (status, error) => json({ error }, status);

export async function readJson(request) {
  if (!/^application\/json/i.test(request.headers.get("content-type") || "")) throw new Error("type");
  const text = await request.text();
  if (text.length > 100000) throw new Error("size");
  return JSON.parse(text || "{}");
}
export const isBadRequest = (e) => e && (e.message === "type" || e.message === "size" || e instanceof SyntaxError);

const ACTIVE = "('pending','confirmed')";

// Times that can't be booked on each date in [from, to]: full, blocked, or already past today.
export async function unavailable(db, from, to) {
  const out = {};
  const add = (date, time) => {
    const list = (out[date] = out[date] || []);
    if (!list.includes(time)) list.push(time);
  };
  const cap = await getCapacity(db);
  for (const r of await run(db, `SELECT date, time, COUNT(*) AS c FROM bookings WHERE status IN ${ACTIVE} AND date BETWEEN ? AND ? GROUP BY date, time`, [from, to])) {
    if (Number(r.c) >= cap) add(r.date, r.time);
  }
  for (const b of await run(db, "SELECT date, time FROM blocks WHERE date BETWEEN ? AND ?", [from, to])) {
    if (b.time) add(b.date, b.time);
    else TIMES.forEach((t) => add(b.date, t));
  }
  const today = todayLocal();
  if (from <= today && today <= to) {
    const now = nowTimeLocal();
    TIMES.filter((t) => t <= now).forEach((t) => add(today, t));
  }
  return out;
}

export function parseBooking(body) {
  const name = str(body.name, 120), email = str(body.email, 160), phone = str(body.phone, 40), notes = str(body.notes, 2000);
  const service = str(body.service, 40), date = str(body.date, 10), time = str(body.time, 5);
  if (!name || !email) return { error: "Please enter your name and email." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Please enter a valid email." };
  if (!SERVICES[service]) return { error: "Please choose a service." };
  if (!validDate(date) || !TIMES.includes(time)) return { error: "Please choose a date and time." };
  return { ok: { name, email, phone, notes, service, date, time } };
}

// One conditional INSERT keeps the capacity check and the write atomic.
export async function createBooking(db, b) {
  const today = todayLocal();
  if (b.date < today || (b.date === today && b.time <= nowTimeLocal()))
    return { status: 400, error: "That time has already passed." };
  const cap = await getCapacity(db);
  const r = await db.execute({
    sql: `INSERT INTO bookings (name, email, phone, service, date, time, notes)
          SELECT ?, ?, ?, ?, ?, ?, ?
          WHERE (SELECT COUNT(*) FROM bookings WHERE status IN ${ACTIVE} AND date = ? AND time = ?) < ?
            AND NOT EXISTS (SELECT 1 FROM blocks WHERE date = ? AND (time = '' OR time = ?))`,
    args: [b.name, b.email, b.phone, b.service, b.date, b.time, b.notes, b.date, b.time, cap, b.date, b.time],
  });
  if (!r.rowsAffected) return { status: 409, error: "Sorry, that time was just taken. Please pick another." };
  return { status: 201, id: Number(r.lastInsertRowid) };
}

export function notifyNew(env, b, id) {
  const text = b.name + " — " + SERVICES[b.service] + "\n" + b.date + " at " + b.time + "\n" + b.email + (b.phone ? " · " + b.phone : "");
  const jobs = [];
  if (env.NTFY_TOPIC) {
    const headers = { Title: "New booking request #" + id };
    if (env.NOTIFY_EMAIL) headers.Email = env.NOTIFY_EMAIL;
    jobs.push(fetch((env.NTFY_SERVER || "https://ntfy.sh").replace(/\/$/, "") + "/" + encodeURIComponent(env.NTFY_TOPIC), { method: "POST", headers, body: text }).catch(() => {}));
  }
  if (env.NOTIFY_WEBHOOK_URL) {
    jobs.push(fetch(env.NOTIFY_WEBHOOK_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...b, text }) }).catch(() => {}));
  }
  return Promise.all(jobs);
}
