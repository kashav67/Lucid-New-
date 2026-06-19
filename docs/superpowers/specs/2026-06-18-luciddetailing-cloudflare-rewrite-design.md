# Lucid Detailing — Cloudflare Rewrite Design

**Date:** 2026-06-18
**Status:** Approved (design); pending implementation plan
**Source app:** `/Users/sahiljagtap/Desktop/Lucid-New-` (Python/Flask, ~927 lines `app.py` + 10 Jinja templates)
**Target:** New project at `/Users/sahiljagtap/Desktop/luciddetailing-cf`

## 1. Goal

Rewrite the existing Flask car-detailing booking site as a JavaScript/TypeScript
app that runs entirely on Cloudflare, with **full feature parity** and **all
existing data migrated**. Serve it on the existing Cloudflare-managed domain
`luciddetailingva.com` with automatic HTTPS.

Non-goal: changing features, visual design, or business logic. This is a faithful
port to a new stack, not a redesign.

## 2. Platform & stack decisions

| Concern | Decision | Rationale |
|---|---|---|
| Compute | **Cloudflare Workers** (with Static Assets) | Cloudflare's current recommendation for full-stack apps; required for **Cron Triggers** (reminders), which Cloudflare Pages does not support. |
| Framework | **React Router v7 (Remix)** + Cloudflare Vite plugin | GA Workers adapter; `loader`/`action` maps ~1:1 onto Flask GET/POST handlers; native D1/R2/secret bindings with no extra build step; SSR for SEO. |
| Database | **D1** | D1 is SQLite — the existing schema ports unchanged. |
| File storage | **R2** | Gallery before/after photos. |
| Email | **Resend HTTP API**, `From: bookings@luciddetailingva.com` | Workers cannot do raw SMTP. Domain verified in Resend (SPF/DKIM in Cloudflare DNS). Namecheap mailbox keeps receiving. |
| Reminders | **Cron Trigger** (hourly) → `scheduled()` handler | Replaces the Python `while True` background thread. |
| Auth | **React Router signed-cookie sessions** (admin) + **global `locked` flag in D1** (site lock) | Replaces Flask `session` (admin) and the `before_request` site lock. |
| Geocoding | **Photon → Nominatim** via `fetch()` | Same providers/logic as today, ported to TypeScript. |

## 3. Route map (Flask → React Router v7)

Public:
- `/` — `loader`: gallery + reviews + open dates (SSR). (Flask `index`)
- `/services`, `/about`, `/contact`, `/terms` — `loader` SSR pages.
- `/book` — `loader`: services, sizes, open dates; `action`: validate, create booking,
  upsert customer, send confirmation email.
- `/open-dates` — resource route, JSON list of open dates.
- `/slots?date=YYYY-MM-DD` — resource route, JSON of available time slots for a date
  (respects `slot_start`, `slot_end`, `buffer`, service duration, existing bookings).
- `/quote-travel` — `action`: geocode address, haversine distance from `BUSINESS_ADDRESS`,
  `× TRAVEL_RATE` → travel fee JSON.
- `/address-suggest?q=` — resource route, autocomplete suggestions.

Site lock + admin:
- `/812` — secret URL rendering the lock page; POSTing the correct `LOCK_PASSWORD`
  **toggles the site-wide `locked` flag** in the `settings` table (on ↔ off). Not
  per-session.
- **Global lock middleware** — a root-level check (port of Flask `before_request`): while
  `settings.locked == "1"`, every route except `/812` and static assets renders the lock
  page.
- `/admin` — `loader`: dashboard (bookings, customers, reviews, gallery, availability,
  settings); `action`: admin login (`ADMIN_PASSWORD`) → sets `admin` in the session cookie.
- `/admin/logout` — `action`: clear session.
- `/admin/availability/toggle` — `action`: toggle a single date open/closed.
- `/admin/availability/bulk` — `action`: open/close a date range.
- `/admin/availability/hours` — `action`: update `slot_start`/`slot_end`/`buffer`.
- `/admin/booking/:id/update` — `action`: edit booking (incl. date/time/price/travel_fee).
- `/admin/booking/:id/delete` — `action`.
- `/admin/review` — `action`: create review; `/admin/review/:id/delete` — `action`.
- `/admin/customer/:id/update` — `action`; `/admin/customer/:id/delete` — `action`.
- `/admin/gallery` — `action`: upload before+after images to R2, create gallery row.
- `/admin/gallery/:id/delete` — `action`: delete row + R2 objects.
- `/img/:key` — resource route: stream a gallery image from R2 (private bucket, edge-cached).

## 4. Data model — D1

Ported unchanged from the current SQLite schema (D1 is SQLite):

- `bookings(id, created, name, phone, email, address, car, size, service, info, price,
  travel_fee REAL DEFAULT 0, date, time, reminded INTEGER DEFAULT 0)`
- `customers(id, created, name, email UNIQUE, phone, address, car, notes)`
- `availability(date TEXT PRIMARY KEY)`
- `settings(key TEXT PRIMARY KEY, value TEXT)` — seeded `slot_start=14`, `slot_end=22`,
  `buffer=30`. Also holds the site-lock state under key `locked` (absent/`"0"` = unlocked),
  toggled via `/812`.
- `gallery(id, created, title, before_img, after_img)` — `before_img`/`after_img` now hold
  **R2 object keys**.
- `reviews(id, created, name, body, stars INTEGER DEFAULT 5)`

Schema and seed live in `migrations/`, applied with `wrangler d1 migrations apply`.
Service catalog (`SERVICES`) and size surcharges (`SIZES`) — currently Python dicts —
become a typed constants module (`app/lib/catalog.ts`); they are not user-editable today,
so they stay in code.

## 5. Photo storage — R2

- Private R2 bucket; images streamed via `/img/:key` (allows edge caching + keeps bucket
  private). Object keys are random UUID-based filenames as today.
- Upload validation preserved: extensions `.jpg/.jpeg/.png/.webp/.gif`, max 12 MB.
- On gallery delete, both R2 objects are removed alongside the D1 row.

## 6. Auth & sessions

- **Admin auth:** React Router `createCookieSessionStorage`, cookie signed with
  `SECRET_KEY`, `HttpOnly`, `Secure`, `SameSite=Lax`. `/admin` login sets `admin` in the
  session; admin routes check it via a shared `requireAdmin()` helper in `app/lib/auth.ts`.
- **Site lock:** global on/off state persisted in `settings.locked` (default `"0"`),
  toggled only via the secret `/812` URL with `LOCK_PASSWORD`. A root-level middleware
  renders the lock page for all non-`/812`, non-static requests while locked. This is
  site-wide (shared across all visitors), not per-session — matching current behavior.

## 7. Email — Resend

- `app/lib/email.ts` wraps the Resend API. `From: bookings@luciddetailingva.com`
  (`MAIL_FROM`), API key from the `RESEND_API_KEY` secret.
- Triggered on booking creation (confirmation) and from the Cron handler (reminders).
- **Non-fatal:** if Resend errors, the booking still saves; the error is logged.
- Setup tasks (user): create Resend account + API key; add SPF + DKIM records in
  Cloudflare DNS to authorize `luciddetailingva.com`. Receiving stays on Namecheap.

## 8. Reminders — Cron Trigger

- `wrangler.jsonc` declares a Cron Trigger (`0 * * * *`, hourly).
- `scheduled()` handler selects bookings whose appointment is within `REMINDER_HOURS`
  and `reminded = 0`, sends a reminder via `email.ts`, sets `reminded = 1`.
- Hourly fits the free plan and the 3-hour reminder window.

## 9. Geocoding / travel fee

- `app/lib/geocode.ts`: `fetch()` Photon (`photon.komoot.io`), fall back to Nominatim
  (OSM). Haversine distance from `BUSINESS_ADDRESS` (geocoded/cached) to the customer
  address, `× TRAVEL_RATE`, rounded as today. Same behavior, `fetch` instead of `urllib`.

## 10. Configuration & secrets

`wrangler.jsonc` bindings: D1 database, R2 bucket, Static Assets, Cron Trigger,
`compatibility_date`, `nodejs_compat` flag as needed.

Secrets (via `wrangler secret put`, never committed):
`ADMIN_PASSWORD`, `LOCK_PASSWORD`, `SECRET_KEY`, `RESEND_API_KEY`, `BUSINESS_ADDRESS`,
`TRAVEL_RATE`, `BUSINESS_PHONE`, `INSTAGRAM`, `MAIL_FROM`, `REMINDER_HOURS`, `LEAD_HOURS`.

Runtime-editable settings (`slot_start`, `slot_end`, `buffer`) remain in the D1
`settings` table, edited via the admin panel — unchanged from today.

## 11. Project structure

```
luciddetailing-cf/
├── app/
│   ├── routes/             # one file per route (loaders + actions)
│   ├── lib/                # db.ts, email.ts, geocode.ts, auth.ts, slots.ts, catalog.ts
│   ├── components/         # shared layout (port of base.html)
│   └── root.tsx            # HTML shell; links style.css, intro.js, site.js
├── public/                 # style.css, intro.js, site.js, rain.glb, icon.png
├── migrations/             # D1 schema + seed
├── scripts/migrate-data.ts # one-time: bookings.db → D1, uploads → R2
├── wrangler.jsonc
├── vite.config.ts
└── package.json
```

Front-end assets (`style.css`, `intro.js`, `site.js`, `rain.glb`, `icon.png`) are copied
from the Flask `static/` directory and served as Static Assets, unchanged. The 10 Jinja
templates are ported into React Router routes/components, preserving markup and classes.

## 12. Data migration (one-time)

`scripts/migrate-data.ts` (Node):
1. Open the existing `bookings.db` (better-sqlite3).
2. Insert all rows into D1 (`bookings`, `customers`, `reviews`, `gallery`,
   `availability`, `settings`) via `wrangler d1 execute` batches.
3. Upload every file in the old `static/uploads/` to R2, preserving filenames so existing
   `gallery.before_img/after_img` keys resolve.
4. Verify row counts and a sample image fetch before go-live.

## 13. Error handling

- Form validation mirrors current rules; user-facing messages replace Flask `flash()`.
- React Router `ErrorBoundary` renders friendly error pages for unexpected failures.
- Geocoding and email failures degrade gracefully — a booking always saves.
- D1/R2 errors logged via Workers observability.

## 14. Testing

- `vitest` + `@cloudflare/vitest-pool-workers` (real D1/R2 in local Miniflare).
- Coverage: slot-availability logic, travel-fee math, booking creation + customer upsert,
  admin auth gating (both gates), reminder-selection query, image upload/serve/delete.
- Local dev: `vite dev` with local D1/R2 bindings.
- Test-driven: write the failing test before each unit of behavior.

## 15. Deployment

- Confirm which of the two Cloudflare accounts holds the `luciddetailingva.com` zone;
  deploy there.
- `wrangler d1 migrations apply` → run data migration → `wrangler deploy`.
- Bind the custom domain `luciddetailingva.com`; add Resend SPF/DKIM DNS records.
- HTTPS is automatic (resolves the current "Not Secure" warning).

## 16. Prerequisites / user actions

- Create a **Resend** account and API key.
- **Rotate the leaked secrets** from the old committed `.env` (`SECRET_KEY`,
  `ADMIN_PASSWORD`, `LOCK_PASSWORD`, SMTP password) — they are exposed in the existing
  GitHub repo history.
- Confirm the target Cloudflare account.

## 17. Risks & notes

- This is a multi-day, ground-up rewrite of a working app handling real customer bookings;
  it will be built test-driven, in stages, with the old app kept as a reference/fallback.
- Cloudflare free-plan limits (D1 rows/reads, R2 storage, Cron frequency) are well within
  this site's expected volume.
- Keep the old Flask app running until the rewrite is verified end-to-end and data is
  migrated, then cut the domain over.
