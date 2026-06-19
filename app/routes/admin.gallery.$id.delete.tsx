import { db } from "../lib/db";
import { isAdmin } from "../lib/session";

export async function action({ request, params }: { request: Request; params: { id: string } }) {
  if (!(await isAdmin(request)))
    return Response.json({ ok: false, error: "Not authorized." }, { status: 401 });
  const id = Number(params.id);
  const row = await db()
    .prepare("SELECT before_img, after_img FROM gallery WHERE id=?")
    .bind(id)
    .first<{ before_img: string; after_img: string }>();
  if (row) {
    for (const k of [row.before_img, row.after_img]) {
      if (k) await db().prepare("DELETE FROM images WHERE key=?").bind(k).run();
    }
    await db().prepare("DELETE FROM gallery WHERE id=?").bind(id).run();
  }
  return Response.json({ ok: true, id });
}
