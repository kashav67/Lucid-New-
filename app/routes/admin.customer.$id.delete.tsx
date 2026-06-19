import { db } from "../lib/db";
import { isAdmin } from "../lib/session";

export async function action({ request, params }: { request: Request; params: { id: string } }) {
  if (!(await isAdmin(request)))
    return Response.json({ ok: false, error: "Not authorized." }, { status: 401 });
  const id = Number(params.id);
  await db().prepare("DELETE FROM customers WHERE id=?").bind(id).run();
  return Response.json({ ok: true, id });
}
