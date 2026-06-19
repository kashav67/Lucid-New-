import { env } from "cloudflare:workers";
import { redirect } from "react-router";
import { getSetting, setSetting } from "../lib/db";
import { safeEqual } from "../lib/session";

// Secret URL: toggles the site-wide `locked` flag (port of Flask /812).
export async function action({ request }: { request: Request }) {
  const form = await request.formData();
  const p = String(form.get("p") || "");
  const lock = env.LOCK_PASSWORD || "";
  if (lock && safeEqual(p, lock)) {
    const locked = (await getSetting("locked", "0")) === "1";
    await setSetting("locked", locked ? "0" : "1");
  }
  return redirect("/812");
}

export default function Lock() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
    >
      <form method="post" action="/812" style={{ margin: 0 }}>
        <input
          type="password"
          name="p"
          autoFocus
          autoComplete="off"
          style={{
            background: "#0a0a0a",
            border: "1px solid #1d1d1d",
            borderRadius: 8,
            padding: ".8rem 1rem",
            color: "#fff",
            fontSize: "1rem",
            width: 220,
            textAlign: "center",
            outline: "none",
            fontFamily: "system-ui, sans-serif",
          }}
        />
      </form>
    </div>
  );
}
