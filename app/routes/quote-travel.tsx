import { env } from "cloudflare:workers";
import { travelFeeFor } from "../lib/geocode";

export async function action({ request }: { request: Request }) {
  const form = await request.formData();
  const res = await travelFeeFor(String(form.get("address") || ""));
  if (!res) {
    return Response.json({ ok: false, error: "Couldn't estimate travel for that address." }, { status: 400 });
  }
  const rate = Number(env.TRAVEL_RATE || "1") || 1;
  return Response.json({ ok: true, fee: res.fee, miles: res.miles, rate });
}
