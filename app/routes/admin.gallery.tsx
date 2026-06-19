import { redirect } from "react-router";
import { db } from "../lib/db";
import { isAdmin } from "../lib/session";
import { etNowStamp } from "../lib/time";

const ALLOWED: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};
// D1 stores the image inline (base64), so keep photos modest. ~1.4 MB original
// -> ~1.9 MB base64, within D1's per-row limits.
const MAX_BYTES = 1_400_000;

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

async function saveImage(entry: FormDataEntryValue | null): Promise<string | null> {
  if (!(entry instanceof File) || !entry.name || entry.size === 0 || entry.size > MAX_BYTES) return null;
  const ct = ALLOWED[extOf(entry.name)];
  if (!ct) return null;
  const key = crypto.randomUUID().replace(/-/g, "") + extOf(entry.name);
  const buf = new Uint8Array(await entry.arrayBuffer());
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < buf.length; i += CHUNK) {
    bin += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  }
  const b64 = btoa(bin);
  await db()
    .prepare("INSERT INTO images(key, content_type, data) VALUES(?,?,?)")
    .bind(key, ct, b64)
    .run();
  return key;
}

export async function action({ request }: { request: Request }) {
  if (!(await isAdmin(request))) return redirect("/admin");
  const form = await request.formData();
  const before = await saveImage(form.get("before"));
  const after = await saveImage(form.get("after"));
  if (before && after) {
    await db()
      .prepare("INSERT INTO gallery(created, title, before_img, after_img) VALUES(?,?,?,?)")
      .bind(etNowStamp(), String(form.get("title") || "").trim(), before, after)
      .run();
  } else {
    // Clean up a half-saved pair.
    for (const k of [before, after]) {
      if (k) await db().prepare("DELETE FROM images WHERE key=?").bind(k).run();
    }
  }
  return redirect("/admin");
}
