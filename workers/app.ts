import { createRequestHandler } from "react-router";
import { siteLocked } from "../app/lib/db";
import { runReminders } from "../app/lib/reminders";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

// Shown site-wide while locked (port of Flask BLACK_PAGE + before_request gate).
const BLACK_PAGE =
  '<!doctype html><html><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1">' +
  "<title> </title></head>" +
  '<body style="margin:0;height:100vh;background:#000"></body></html>';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    // Maintenance gate: everything except /812 is hidden while the site is locked.
    if (url.pathname !== "/812") {
      try {
        if (await siteLocked()) {
          return new Response(BLACK_PAGE, {
            headers: { "content-type": "text/html; charset=utf-8" },
          });
        }
      } catch {
        // If the DB isn't reachable, fail open rather than black-holing the site.
      }
    }
    return requestHandler(request);
  },

  // Hourly cron -> send due reminders (replaces the Flask background thread).
  async scheduled(_controller, _env, ctx) {
    ctx.waitUntil(runReminders());
  },
} satisfies ExportedHandler<Env>;
