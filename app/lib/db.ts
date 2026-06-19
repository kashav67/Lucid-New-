import { env } from "cloudflare:workers";

/** The D1 binding. */
export const db = () => env.DB as D1Database;

export async function getSetting(key: string, def: string | null = null): Promise<string | null> {
  const row = await db().prepare("SELECT value FROM settings WHERE key=?").bind(key).first<{ value: string }>();
  return row ? row.value : def;
}

export async function setSetting(key: string, value: string | number): Promise<void> {
  await db()
    .prepare(
      "INSERT INTO settings(key, value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    )
    .bind(key, String(value))
    .run();
}

export async function siteLocked(): Promise<boolean> {
  return (await getSetting("locked", "0")) === "1";
}

/** { start, end, buffer } — open hour, close hour, travel buffer minutes. */
export async function slotConfig(): Promise<{ start: number; end: number; buffer: number }> {
  return {
    start: parseInt((await getSetting("slot_start", "14")) || "14", 10),
    end: parseInt((await getSetting("slot_end", "22")) || "22", 10),
    buffer: parseInt((await getSetting("buffer", "30")) || "30", 10),
  };
}

export type Review = { id: number; name: string; body: string; stars: number; created: string };

export function reviewWhen(created: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(created || "");
  if (!m) return "";
  const d = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const today = new Date();
  const todayUTC = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const delta = Math.round((todayUTC - d) / 86400000);
  if (delta <= 0) return "Today";
  if (delta === 1) return "Yesterday";
  if (delta < 7) return "This week";
  if (delta < 31) return "This month";
  return "Some time ago";
}

export async function reviewsList(): Promise<Array<{ id: number; name: string; body: string; stars: number; when: string }>> {
  const rows = await db().prepare("SELECT * FROM reviews ORDER BY id DESC").all<Review>();
  return rows.results.map((r) => ({
    id: r.id,
    name: r.name,
    body: r.body,
    stars: r.stars,
    when: reviewWhen(r.created),
  }));
}
