import { addressSuggestions } from "../lib/geocode";

export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") || "";
  return Response.json({ ok: true, suggestions: await addressSuggestions(q) });
}
