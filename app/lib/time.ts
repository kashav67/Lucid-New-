// Timezone helpers. The business operates in Eastern time, but Workers run in
// UTC — so we compute "now"/"today" and parse appointment wall-times in ET to
// match the original Flask app (which used local server time).

const TZ = "America/New_York";

/** Offset (ms) between ET and UTC at a given instant (handles EST/EDT). */
function tzOffset(date: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) p[part.type] = part.value;
  const asUTC = Date.UTC(
    +p.year,
    +p.month - 1,
    +p.day,
    +p.hour === 24 ? 0 : +p.hour,
    +p.minute,
    +p.second,
  );
  return asUTC - date.getTime();
}

/** Current ET date/time parts. */
function etParts(): { y: number; mo: number; d: number; h: number; mi: number } {
  const now = new Date();
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(now)) p[part.type] = part.value;
  return { y: +p.y || +p.year, mo: +p.month, d: +p.day, h: +p.hour % 24, mi: +p.minute };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" for today in ET. */
export function etTodayISO(): string {
  const { y, mo, d } = etParts();
  return `${y}-${pad(mo)}-${pad(d)}`;
}

/** "YYYY-MM-DD HH:MM" for now in ET (matches Flask created/stamp format). */
export function etNowStamp(): string {
  const { y, mo, d, h, mi } = etParts();
  return `${y}-${pad(mo)}-${pad(d)} ${pad(h)}:${pad(mi)}`;
}

/** Epoch ms for a "YYYY-MM-DD" + "HH:MM" wall-time interpreted in ET. */
export function etInstant(dateStr: string, timeStr: string): number | null {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr || "");
  const tm = /^(\d{1,2}):(\d{2})$/.exec(timeStr || "");
  if (!dm || !tm) return null;
  const guess = Date.UTC(+dm[1], +dm[2] - 1, +dm[3], +tm[1], +tm[2]);
  // One correction pass resolves the offset (DST transition edges aside).
  const off = tzOffset(new Date(guess));
  return guess - off;
}

export const nowMs = () => Date.now();
