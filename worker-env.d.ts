// Secrets are set via `wrangler secret put` (not in wrangler.jsonc), so augment
// the generated Env interfaces with their types here. This file is ambient
// (no imports/exports) so it merges into the global declarations.

interface Env {
  ADMIN_PASSWORD: string;
  LOCK_PASSWORD: string;
  SECRET_KEY: string;
  RESEND_API_KEY: string;
}

declare namespace Cloudflare {
  interface Env {
    ADMIN_PASSWORD: string;
    LOCK_PASSWORD: string;
    SECRET_KEY: string;
    RESEND_API_KEY: string;
  }
}
