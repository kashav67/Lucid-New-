import { db } from "../lib/db";

// Serves a gallery image stored in D1 (base64), cached at the edge.
export async function loader({ params }: { params: { key: string } }) {
  const row = await db()
    .prepare("SELECT content_type, data FROM images WHERE key=?")
    .bind(params.key)
    .first<{ content_type: string; data: string }>();
  if (!row) return new Response("Not found", { status: 404 });
  const bin = atob(row.data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Response(bytes, {
    headers: {
      "content-type": row.content_type || "application/octet-stream",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
