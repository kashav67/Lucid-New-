import { db } from "../lib/db";
import { isAdmin } from "../lib/session";

export async function action({ request }: { request: Request }) {
  if (!(await isAdmin(request)))
    return Response.json({ ok: false, error: "Not authorized." }, { status: 401 });
  const form = await request.formData();
  const d = String(form.get("date") || "").trim();
  if (!d) return Response.json({ ok: false, error: "No date." }, { status: 400 });
  const exists = await db().prepare("SELECT 1 AS x FROM availability WHERE date=?").bind(d).first();
  let active: boolean;
  if (exists) {
    await db().prepare("DELETE FROM availability WHERE date=?").bind(d).run();
    active = false;
  } else {
    await db().prepare("INSERT OR IGNORE INTO availability(date) VALUES(?)").bind(d).run();
    active = true;
  }
  return Response.json({ ok: true, date: d, active });
}
