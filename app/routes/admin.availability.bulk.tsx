import { db } from "../lib/db";
import { isAdmin } from "../lib/session";

export async function action({ request }: { request: Request }) {
  if (!(await isAdmin(request)))
    return Response.json({ ok: false, error: "Not authorized." }, { status: 401 });
  const form = await request.formData();
  const dates = String(form.get("dates") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const active = form.get("active") === "1";
  for (const d of dates) {
    if (active) await db().prepare("INSERT OR IGNORE INTO availability(date) VALUES(?)").bind(d).run();
    else await db().prepare("DELETE FROM availability WHERE date=?").bind(d).run();
  }
  return Response.json({ ok: true, count: dates.length, active });
}
