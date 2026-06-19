import { env } from "cloudflare:workers";
import { db } from "./db";
import { sendReminder, type Booking } from "./email";
import { etInstant, nowMs } from "./time";

/**
 * Send reminders for bookings due within REMINDER_HOURS that haven't been
 * reminded yet. Called from the Worker's scheduled() handler (hourly cron).
 * Port of Flask send_due_reminders().
 */
export async function runReminders(): Promise<void> {
  const reminderHours = Number(env.REMINDER_HOURS || "3") || 3;
  const now = nowMs();
  const rows = (
    await db()
      .prepare(
        "SELECT * FROM bookings WHERE COALESCE(reminded,0)=0 AND date IS NOT NULL AND date!='' AND time IS NOT NULL AND time!=''",
      )
      .all<Booking & { reminded: number }>()
  ).results;
  for (const b of rows) {
    const inst = etInstant(b.date!, b.time!);
    if (inst === null) continue;
    const delta = (inst - now) / 1000;
    if (delta > 0 && delta <= reminderHours * 3600) {
      if (await sendReminder(b)) {
        await db().prepare("UPDATE bookings SET reminded=1 WHERE id=?").bind(b.id).run();
      }
    }
  }
}
