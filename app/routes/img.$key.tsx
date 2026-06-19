import { env } from "cloudflare:workers";

// Streams a gallery image from the private R2 bucket, cached at the edge.
export async function loader({ params }: { params: { key: string } }) {
  const obj = await (env.BUCKET as R2Bucket).get(params.key);
  if (!obj) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  return new Response(obj.body, { headers });
}
