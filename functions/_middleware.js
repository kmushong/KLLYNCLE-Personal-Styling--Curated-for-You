// Password-protects the admin page and admin API (HTTP Basic, user "admin", password = ADMIN_PASSWORD).
async function sha256(s) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
}

export async function isAdmin(request, env) {
  const h = request.headers.get("Authorization") || "";
  if (!h.startsWith("Basic ")) return false;
  let decoded;
  try { decoded = atob(h.slice(6)); } catch (_) { return false; }
  const i = decoded.indexOf(":");
  if (i < 0) return false;
  const [a, b] = await Promise.all([sha256(decoded.slice(i + 1)), sha256(env.ADMIN_PASSWORD)]);
  let diff = decoded.slice(0, i) === "admin" ? 0 : 1;
  for (let k = 0; k < a.length; k++) diff |= a[k] ^ b[k];
  return diff === 0;
}

export async function onRequest(context) {
  const { pathname } = new URL(context.request.url);
  if (!(pathname === "/admin" || pathname === "/admin.html" || pathname.startsWith("/admin/") || pathname.startsWith("/api/admin"))) {
    return context.next();
  }
  if (!context.env.ADMIN_PASSWORD) return new Response("Admin is disabled: ADMIN_PASSWORD is not set.", { status: 503 });
  if (!(await isAdmin(context.request, context.env))) {
    return new Response("Authentication required", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Kelly admin"', "Cache-Control": "no-store" },
    });
  }
  const res = await context.next();
  const out = new Response(res.body, res);
  out.headers.set("Cache-Control", "no-store");
  out.headers.set("X-Robots-Tag", "noindex");
  return out;
}
