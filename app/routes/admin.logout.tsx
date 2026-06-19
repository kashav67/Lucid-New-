import { redirect } from "react-router";
import { destroyAdmin } from "../lib/session";

export async function loader({ request }: { request: Request }) {
  return redirect("/admin", { headers: { "Set-Cookie": await destroyAdmin(request) } });
}
