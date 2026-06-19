import { env } from "cloudflare:workers";
import { SIZES, money, serviceLabel } from "./catalog";
import { etInstant } from "./time";

export type Booking = {
  id: number;
  name: string;
  phone: string;
  email: string;
  address: string | null;
  car: string | null;
  size: string;
  service: string;
  info: string | null;
  price: number;
  travel_fee: number | null;
  date: string | null;
  time: string | null;
};

const esc = (s: string) =>
  String(s ?? "").replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]!));

/** Human appointment string in Eastern time. */
function apptStr(b: Booking): string {
  if (!b.date) return "To be scheduled";
  const inst = b.time ? etInstant(b.date, b.time) : etInstant(b.date, "00:00");
  if (inst === null) return `${b.date}${b.time ? " " + b.time : ""}`.trim();
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: "America/New_York",
    weekday: "long",
    month: "long",
    day: "numeric",
  };
  let s = new Intl.DateTimeFormat("en-US", opts).format(inst);
  if (b.time) {
    const t = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(inst);
    s += ` at ${t}`;
  }
  return s;
}

function bookingRows(b: Booking): Array<[string, string]> {
  const svc = serviceLabel(b.service, b.size);
  const size = SIZES[b.size]?.label ?? b.size;
  const tf = b.travel_fee || 0;
  const rows: Array<[string, string]> = [
    ["Appointment", apptStr(b)],
    ["Service", svc],
    ["Vehicle size", size],
  ];
  if (b.car) rows.push(["Vehicle", b.car]);
  if (b.address) rows.push(["Location", b.address]);
  rows.push(["Service price", money(b.price)]);
  if (tf) rows.push(["Travel fee", "+" + money(tf)]);
  rows.push(["Total", money(b.price + tf)]);
  return rows;
}

function emailHtml(heading: string, intro: string, rows: Array<[string, string]>, footer: string): string {
  const lines = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 0;color:#6b7178;font-size:14px;">${esc(k)}</td>` +
        `<td style="padding:6px 0;color:#111;font-size:14px;font-weight:600;text-align:right;">${esc(v)}</td></tr>`,
    )
    .join("");
  const phone = esc(env.BUSINESS_PHONE || "");
  const contact = esc(env.REPLY_TO || env.MAIL_FROM || "");
  const ig = env.INSTAGRAM ? ` &middot; @${esc(env.INSTAGRAM)}` : "";
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f5f7;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:24px 0;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e6e8eb;font-family:Arial,Helvetica,sans-serif;">
    <tr><td style="background:#0b0c0e;padding:22px 28px;">
      <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:1px;">LUCID</span>
      <span style="color:#9aa0a8;font-size:20px;font-weight:300;letter-spacing:2px;"> DETAILING</span>
    </td></tr>
    <tr><td style="padding:28px;">
      <h1 style="margin:0 0 10px;font-size:21px;color:#111;">${esc(heading)}</h1>
      <p style="margin:0 0 18px;color:#555;font-size:15px;line-height:1.55;">${intro}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e6e8eb;border-bottom:1px solid #e6e8eb;margin:6px 0 18px;">
        ${lines}
      </table>
      <p style="margin:0;color:#888;font-size:13px;line-height:1.55;">${footer}</p>
    </td></tr>
    <tr><td style="background:#0b0c0e;padding:16px 28px;color:#6b7178;font-size:12px;">
      Lucid Detailing &middot; ${phone} &middot; ${contact}${ig}
    </td></tr>
  </table>
</td></tr></table></body></html>`;
}

async function sendEmail(to: string, subject: string, text: string, html: string): Promise<boolean> {
  if (!to) return false;
  const key = env.RESEND_API_KEY;
  if (!key) {
    console.log("[email] RESEND_API_KEY not set — skipping send.");
    return false;
  }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `Lucid Detailing <${env.MAIL_FROM}>`,
        to: [to],
        subject,
        html,
        text,
        ...(env.REPLY_TO ? { reply_to: env.REPLY_TO } : {}),
      }),
    });
    if (!r.ok) {
      console.log(`[email] send failed to ${to}: ${r.status} ${await r.text()}`);
      return false;
    }
    return true;
  } catch (e) {
    console.log(`[email] send error to ${to}: ${e}`);
    return false;
  }
}

export async function sendConfirmation(b: Booking): Promise<boolean> {
  const rows = bookingRows(b);
  const text =
    "Thanks for booking with Lucid Detailing!\n\n" +
    rows.map(([k, v]) => `${k}: ${v}`).join("\n") +
    "\n\nWe'll see you then. Reply to this email with any questions.";
  const first = b.name ? b.name.split(" ")[0] : "there";
  const html = emailHtml(
    `You're booked, ${esc(first)}!`,
    "Thanks for choosing Lucid Detailing. Here are your appointment details:",
    rows,
    "Need to change anything? Just reply to this email and we'll take care of it.",
  );
  return sendEmail(b.email, "Your Lucid Detailing booking is confirmed", text, html);
}

export async function sendReminder(b: Booking): Promise<boolean> {
  const rows = bookingRows(b);
  const text =
    "Reminder: your Lucid Detailing appointment is coming up.\n\n" +
    rows.map(([k, v]) => `${k}: ${v}`).join("\n") +
    "\n\nSee you soon!";
  const html = emailHtml(
    "Your detail is coming up soon",
    "This is a friendly reminder about your upcoming appointment with Lucid Detailing:",
    rows,
    "Please make sure the vehicle is accessible. Reply with any questions.",
  );
  return sendEmail(b.email, "Reminder: your Lucid Detailing appointment", text, html);
}
