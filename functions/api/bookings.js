import { PRICES, VENMO_USER } from "../_lib/config.js";
import { createBooking, fail, getDb, isBadRequest, json, notifyNew, parseBooking, readJson } from "../_lib/db.js";

export async function onRequestPost(context) {
  try {
    const p = parseBooking(await readJson(context.request));
    if (!p.ok) return fail(400, p.error);
    const db = await getDb(context.env);
    const r = await createBooking(db, p.ok);
    if (r.error) return fail(r.status, r.error);
    context.waitUntil(notifyNew(context.env, p.ok, r.id));
    const amount = PRICES[p.ok.service] || 0;
    return json({ id: r.id, status: "pending", amount, venmo: amount ? VENMO_USER : "" }, 201);
  } catch (e) {
    if (isBadRequest(e)) return fail(400, "Bad request.");
    console.error(e);
    return fail(500, "Server error.");
  }
}
