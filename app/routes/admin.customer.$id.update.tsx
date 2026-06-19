import { db } from "../lib/db";
import { isAdmin } from "../lib/session";

export async function action({ request, params }: { request: Request; params: { id: string } }) {
  if (!(await isAdmin(request)))
    return Response.json({ ok: false, error: "Not authorized." }, { status: 401 });
  const form = await request.formData();
  const g = (k: string) => String(form.get(k) || "").trim();
  const email = g("email").toLowerCase();
  if (!email) return Response.json({ ok: false, error: "Email is required." }, { status: 400 });

  const id = Number(params.id);
  const exists = await db().prepare("SELECT 1 AS x FROM customers WHERE id=?").bind(id).first();
  if (!exists) return Response.json({ ok: false, error: "Customer not found." }, { status: 404 });

  try {
    await db()
      .prepare("UPDATE customers SET name=?, email=?, phone=?, address=?, car=?, notes=? WHERE id=?")
      .bind(g("name"), email, g("phone"), g("address"), g("car"), g("notes"), id)
      .run();
  } catch {
    return Response.json({ ok: false, error: "Another customer already uses that email." }, { status: 400 });
  }
  return Response.json({ ok: true, id });
}
