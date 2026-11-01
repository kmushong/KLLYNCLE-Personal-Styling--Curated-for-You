import { PRICES, SERVICES, TIMES } from "../../_lib/config.js";
import {
  setPaid, changeStatus, csvCell, fail, getCapacity, getDb, isBadRequest, json, readJson, run, str, todayLocal, validDate,
} from "../../_lib/db.js";

// Handles /api/admin/*; the password check happens in functions/_middleware.js.
export async function onRequest({ request, env, params }) {
  const method = request.method;
  const parts = [].concat(params.path || []);
  try {
    const db = await getDb(env);
    const [a, b, c] = parts;

    if (a === "bookings" && !b && method === "GET") {
      const bookings = (await run(db, "SELECT * FROM bookings ORDER BY date DESC, time DESC, id DESC LIMIT 500"))
        .map((r) => ({ ...r, id: Number(r.id) }));
      return json({ capacity: await getCapacity(db), services: SERVICES, prices: PRICES, bookings });
    }
    if (a === "bookings" && b && c === "status" && method === "POST") {
      const r = await changeStatus(db, Number(b), (await readJson(request)).status);
      return r.error ? fail(r.status, r.error) : json({ id: r.id, status: r.newStatus });
    }
    if (a === "bookings" && b && c === "paid" && method === "POST") {
      const r = await setPaid(db, Number(b), (await readJson(request)).paid);
      return r.error ? fail(r.status, r.error) : json({ id: Number(b) });
    }
    if (a === "blocks" && !b && method === "GET") {
      const rows = await run(db, "SELECT id, date, time, reason FROM blocks WHERE date >= ? ORDER BY date, time", [todayLocal()]);
      return json({ times: TIMES, blocks: rows.map((r) => ({ ...r, id: Number(r.id) })) });
    }
    if (a === "blocks" && !b && method === "POST") {
      const body = await readJson(request);
      const time = body.time ? String(body.time) : "";
      if (!validDate(body.date) || (time && !TIMES.includes(time))) return fail(400, "Bad date or time.");
      await db.execute({ sql: "INSERT OR IGNORE INTO blocks (date, time, reason) VALUES (?,?,?)", args: [body.date, time, str(body.reason, 120)] });
      return json({ ok: true }, 201);
    }
    if (a === "blocks" && b && method === "DELETE") {
      await db.execute({ sql: "DELETE FROM blocks WHERE id = ?", args: [Number(b)] });
      return json({ ok: true });
    }
    if (a === "settings" && method === "POST") {
      const n = Number((await readJson(request)).capacity);
      if (!Number.isInteger(n) || n < 1 || n > 20) return fail(400, "Limit must be a whole number from 1 to 20.");
      await db.execute({ sql: "INSERT INTO settings (key, value) VALUES ('capacity', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", args: [String(n)] });
      return json({ capacity: n });
    }
    if (a === "export.csv" && method === "GET") {
      const head = ["Booking", "Submitted (UTC)", "Status", "Name", "Email", "Phone", "Service", "Date", "Time", "Notes", "Amount due", "Paid"];
      const lines = [head.map(csvCell).join(",")];
      for (const r of await run(db, "SELECT * FROM bookings ORDER BY date, time")) {
        lines.push([r.id, r.created_at, r.status, r.name, r.email, r.phone, SERVICES[r.service] || r.service, r.date, r.time, r.notes, PRICES[r.service] ? "$" + PRICES[r.service] : "", PRICES[r.service] ? (Number(r.paid) ? "yes" : "no") : ""].map(csvCell).join(","));
      }
      return new Response("\ufeff" + lines.join("\r\n") + "\r\n", {
        headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="bookings-' + todayLocal() + '.csv"', "Cache-Control": "no-store" },
      });
    }
    return fail(404, "Not found");
  } catch (e) {
    if (isBadRequest(e)) return fail(400, "Bad request.");
    console.error(e);
    return fail(500, "Server error.");
  }
}
