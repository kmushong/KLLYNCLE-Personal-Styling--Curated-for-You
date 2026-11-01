import { TIMES } from "../_lib/config.js";
import { fail, getCapacity, getDb, json, unavailable, validDate } from "../_lib/db.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const from = url.searchParams.get("from"), to = url.searchParams.get("to");
  if (!validDate(from) || !validDate(to) || to < from) return fail(400, "Bad range.");
  if ((new Date(to) - new Date(from)) / 864e5 > 120) return fail(400, "Range too long.");
  try {
    const db = await getDb(env);
    return json({ capacity: await getCapacity(db), times: TIMES, unavailable: await unavailable(db, from, to) });
  } catch (e) {
    console.error(e);
    return fail(500, "Server error.");
  }
}
