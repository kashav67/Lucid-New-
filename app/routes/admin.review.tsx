import { redirect } from "react-router";
import { db } from "../lib/db";
import { isAdmin } from "../lib/session";
import { etNowStamp } from "../lib/time";

export async function action({ request }: { request: Request }) {
  if (!(await isAdmin(request))) return redirect("/admin");
  const form = await request.formData();
  const name = String(form.get("name") || "").trim();
  const body = String(form.get("body") || "").trim();
  let stars = parseInt(String(form.get("stars") || "5"), 10);
  if (Number.isNaN(stars)) stars = 5;
  stars = Math.max(1, Math.min(5, stars));
  const d = String(form.get("date") || "").trim();
  const created = /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d} 00:00` : etNowStamp();
  if (name && body) {
    await db()
      .prepare("INSERT INTO reviews(created, name, body, stars) VALUES(?,?,?,?)")
      .bind(created, name, body, stars)
      .run();
  }
  return redirect("/admin");
}
