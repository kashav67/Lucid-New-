import { SERVICES } from "../lib/catalog";
import { availableStarts } from "../lib/slots";

export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  let svc = url.searchParams.get("service") || "";
  if (!(svc in SERVICES)) svc = "exterior";
  const date = url.searchParams.get("date") || "";
  return Response.json({ ok: true, slots: await availableStarts(date, svc) });
}
