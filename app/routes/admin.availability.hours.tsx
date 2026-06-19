import { setSetting } from "../lib/db";
import { isAdmin } from "../lib/session";

export async function action({ request }: { request: Request }) {
  if (!(await isAdmin(request)))
    return Response.json({ ok: false, error: "Not authorized." }, { status: 401 });
  const form = await request.formData();
  const startN = parseInt(String(form.get("start") ?? "14"), 10);
  const endN = parseInt(String(form.get("end") ?? "22"), 10);
  let buf = parseInt(String(form.get("buffer") ?? "30"), 10);
  if (Number.isNaN(startN) || Number.isNaN(endN) || Number.isNaN(buf))
    return Response.json({ ok: false, error: "Invalid values." }, { status: 400 });
  const start = Math.max(0, Math.min(23, startN));
  const end = Math.max(1, Math.min(24, endN));
  if (end <= start)
    return Response.json({ ok: false, error: "Closing time must be after opening time." }, { status: 400 });
  if (![0, 15, 30, 45, 60].includes(buf)) buf = 30;
  await setSetting("slot_start", start);
  await setSetting("slot_end", end);
  await setSetting("buffer", buf);
  return Response.json({ ok: true, start, end, buffer: buf });
}
