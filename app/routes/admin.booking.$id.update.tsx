import { priceFor } from "../lib/catalog";
import { db } from "../lib/db";
import { travelFeeFor } from "../lib/geocode";
import { isAdmin } from "../lib/session";

export async function action({ request, params }: { request: Request; params: { id: string } }) {
  if (!(await isAdmin(request)))
    return Response.json({ ok: false, error: "Not authorized." }, { status: 401 });
  const form = await request.formData();
  const g = (k: string) => String(form.get(k) || "").trim();
  const service = g("service");
  const size = g("size");
  const price = priceFor(service, size);
  if (price === null) return Response.json({ ok: false, error: "Invalid service or size." }, { status: 400 });

  const id = Number(params.id);
  const exists = await db().prepare("SELECT 1 AS x FROM bookings WHERE id=?").bind(id).first();
  if (!exists) return Response.json({ ok: false, error: "Booking not found." }, { status: 404 });

  const address = g("address");
  const travel = address ? await travelFeeFor(address) : null;
  const travelFee = travel ? travel.fee : 0;

  await db()
    .prepare(
      `UPDATE bookings SET name=?, phone=?, email=?, address=?, car=?, size=?, service=?, info=?, price=?, travel_fee=?, date=?, time=? WHERE id=?`,
    )
    .bind(g("name"), g("phone"), g("email"), address, g("car"), size, service, g("info"), price, travelFee, g("date"), g("time"), id)
    .run();
  return Response.json({ ok: true, id });
}
