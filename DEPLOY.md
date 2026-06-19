# Deploying Lucid Detailing (Cloudflare Workers)

This is the React Router v7 rewrite of the site, running on **Cloudflare Workers**
with **D1** (database), **R2** (gallery photos), **Cron** (reminders), and **Resend**
(email). The old Flask app is kept for reference in `legacy-flask/`.

Everything below is run by the **Cloudflare account owner** from this repo folder.

> ⚠️ The custom domain `luciddetailingva.com` can only attach to a Worker that lives
> in the **same Cloudflare account** as that domain's zone. Make sure the domain and
> the Worker are in the same account (or move the zone there first). Otherwise you can
> launch on the temporary `*.workers.dev` URL and attach the domain later.

## 0. Prerequisites

```bash
npm install
npx wrangler login        # log in to the account that will host the site
```

## 1. Create the database

```bash
npx wrangler d1 create lucid
# Copy the printed "database_id" into wrangler.jsonc -> d1_databases[0].database_id
```

Gallery photos are stored in D1 (base64), so **no R2 is needed**. Keep gallery
photos web-optimized (≲1.4 MB each); for full-size originals, switch to R2 later.

## 2. Create the schema

```bash
npx wrangler d1 migrations apply lucid --remote
```

## 3. Set secrets

```bash
npx wrangler secret put ADMIN_PASSWORD     # admin panel password
npx wrangler secret put LOCK_PASSWORD      # toggles the site lock at /812
npx wrangler secret put SECRET_KEY         # random string, signs the admin cookie
npx wrangler secret put RESEND_API_KEY     # from resend.com
```

Also set `BUSINESS_ADDRESS` (the shop address used for travel-fee distance) in
`wrangler.jsonc` -> `vars`. The other vars (phone, Instagram, reminder window, mail
from) already have sensible defaults there.

## 4. Email (Resend)

1. Create a Resend account, add the domain **luciddetailingva.com**.
2. Add the **SPF + DKIM DNS records** Resend gives you, in Cloudflare DNS for the domain.
   (Your Namecheap mailbox keeps receiving mail; this only authorizes sending.)
3. Use the API key from Resend for `RESEND_API_KEY` in step 3.

Emails are sent from `bookings@luciddetailingva.com` (change `MAIL_FROM` in
`wrangler.jsonc` if you want a different sender).

## 5. Migrate existing data (bookings, customers, reviews, photos)

```bash
node scripts/migrate-data.mjs
npx wrangler d1 execute lucid --remote --file=scripts/seed-data.sql
```

The seed includes the gallery photos (embedded as base64). The generated
`seed-data.sql` contains customer data and is git-ignored — don't commit it.

## 6. Deploy

```bash
npm run deploy
```

This builds and deploys the Worker, including the hourly reminder Cron Trigger.

## 7. Attach the domain

In the Cloudflare dashboard: **Workers & Pages → lucid-cf → Settings → Domains &
Routes → Add custom domain → `luciddetailingva.com`** (and `www` if desired). HTTPS is
automatic. This fixes the old "Not Secure" warning.

## Local development

```bash
cp .dev.vars.example .dev.vars   # then fill in the secret values for local testing
npm run dev
```

`npm run dev` runs against a local D1/R2. Apply migrations locally with
`npx wrangler d1 migrations apply lucid --local`.

## Site lock

Visit `/812`, enter the `LOCK_PASSWORD` to toggle the whole site between live and a
blank "maintenance" page (the admin panel is locked too while locked — unlock at `/812`
first). State is stored in the database, shared across all visitors.

## Auto-deploy from GitHub (optional)

In **Workers & Pages → Create → Connect to Git**, select this repo. Cloudflare will
build and deploy on every push to `main`. You still need steps 1–5 done once in the
account (D1, R2, secrets, data). Set the build command to `npm run build` and the
deploy command is handled by the Workers Builds integration.
