import { env } from "cloudflare:workers";
import { redirect } from "react-router";
import { db } from "../lib/db";
import { isAdmin } from "../lib/session";
import { etNowStamp } from "../lib/time";

const ALLOWED = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const MAX_BYTES = 12 * 1024 * 1024;

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

async function saveImage(entry: FormDataEntryValue | null): Promise<string | null> {
  if (!(entry instanceof File) || !entry.name || entry.size === 0 || entry.size > MAX_BYTES) return null;
  const ext = extOf(entry.name);
  if (!ALLOWED.has(ext)) return null;
  const key = crypto.randomUUID().replace(/-/g, "") + ext;
  await (env.BUCKET as R2Bucket).put(key, await entry.arrayBuffer(), {
    httpMetadata: { contentType: entry.type || "application/octet-stream" },
  });
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
    for (const k of [before, after]) if (k) await (env.BUCKET as R2Bucket).delete(k);
  }
  return redirect("/admin");
}
