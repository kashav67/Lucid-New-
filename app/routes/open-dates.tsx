import { SERVICES } from "../lib/catalog";
import { openDates } from "../lib/slots";

export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  let svc = url.searchParams.get("service") || "";
  if (!(svc in SERVICES)) svc = "exterior";
  const { open, full } = await openDates(svc);
  return Response.json({ ok: true, dates: open, full });
}
