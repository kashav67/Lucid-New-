import { env } from "cloudflare:workers";
import { db, slotConfig } from "./db";
import { GRID_MINUTES, serviceMinutes } from "./catalog";
import { etInstant, etTodayISO, nowMs } from "./time";

const pad = (n: number) => String(n).padStart(2, "0");

async function isAvailable(d: string): Promise<boolean> {
  const row = await db().prepare("SELECT 1 AS x FROM availability WHERE date=?").bind(d).first();
  return !!row;
}

/** Existing bookings on date d as [startMin, durationMin]. */
async function bookedIntervals(d: string): Promise<Array<[number, number]>> {
  const rows = await db()
    .prepare("SELECT time, service FROM bookings WHERE date=?")
    .bind(d)
    .all<{ time: string | null; service: string }>();
  const out: Array<[number, number]> = [];
  for (const r of rows.results) {
    if (!r.time) continue;
    const m = /^(\d{1,2}):(\d{2})$/.exec(r.time);
    if (!m) continue;
    out.push([+m[1] * 60 + +m[2], serviceMinutes(r.service)]);
  }
  return out;
}

/**
 * Open 30-min start times for `service` on date `d`.
 * Each booking reserves [start, start + duration + buffer]. A new appointment
 * fits at any 30-min start that doesn't overlap a reserved block and finishes
 * by closing time, and is at least LEAD_HOURS away.
 */
export async function availableStarts(d: string, service: string): Promise<string[]> {
  if (!d || !(await isAvailable(d))) return [];
  const { start, end, buffer } = await slotConfig();
  const dur = serviceMinutes(service);
  const openM = start * 60;
  const closeM = end * 60;
  const reserved = (await bookedIntervals(d)).map(([s, ed]) => [s, s + ed + buffer] as [number, number]);
  const out: string[] = [];
  for (let t = openM; t <= closeM; t += GRID_MINUTES) {
    if (reserved.every(([rs, re]) => t + dur <= rs || t >= re)) {
      out.push(`${pad(Math.floor(t / 60))}:${pad(t % 60)}`);
    }
  }
  const lead = Number(env.LEAD_HOURS || "3") || 3;
  const cutoff = nowMs() + lead * 3600 * 1000;
  return out.filter((x) => {
    const inst = etInstant(d, x);
    return inst !== null && inst >= cutoff;
  });
}

/** Available dates from today onward, split into open vs full for a service. */
export async function openDates(service: string): Promise<{ open: string[]; full: string[] }> {
  const today = etTodayISO();
  const rows = await db()
    .prepare("SELECT date FROM availability WHERE date>=? ORDER BY date")
    .bind(today)
    .all<{ date: string }>();
  const open: string[] = [];
  const full: string[] = [];
  for (const { date } of rows.results) {
    if ((await availableStarts(date, service)).length) open.push(date);
    else full.push(date);
  }
  return { open, full };
}
