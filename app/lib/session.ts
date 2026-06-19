import { createCookieSessionStorage } from "react-router";
import { env } from "cloudflare:workers";

type SessionData = { admin: boolean };

let _storage: ReturnType<typeof createCookieSessionStorage<SessionData>> | null = null;
function storage() {
  if (!_storage) {
    _storage = createCookieSessionStorage<SessionData>({
      cookie: {
        name: "__lucid_admin",
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        secrets: [env.SECRET_KEY || "dev-secret-change-me"],
        maxAge: 60 * 60 * 24 * 7,
      },
    });
  }
  return _storage;
}

export function getSession(request: Request) {
  return storage().getSession(request.headers.get("Cookie"));
}

export async function isAdmin(request: Request): Promise<boolean> {
  const s = await getSession(request);
  return s.get("admin") === true;
}

export async function commitAdmin(): Promise<string> {
  const s = await storage().getSession();
  s.set("admin", true);
  return storage().commitSession(s);
}

export async function destroyAdmin(request: Request): Promise<string> {
  const s = await getSession(request);
  return storage().destroySession(s);
}

/** Constant-time string comparison (port of hmac.compare_digest). */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
