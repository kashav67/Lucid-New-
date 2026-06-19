import type { Route } from "./+types/book";
import { SiteLayout } from "../components/SiteLayout";
import { SERVICES, SIZES, priceFor, serviceLabel } from "../lib/catalog";
import { db } from "../lib/db";
import { geocodeAddress, travelForDest } from "../lib/geocode";
import { availableStarts } from "../lib/slots";
import { sendConfirmation, type Booking } from "../lib/email";
import { etNowStamp } from "../lib/time";

export function meta() {
  return [{ title: "Book a Detail — Lucid Detailing" }];
}

type FormVals = Record<string, string>;
type Booked = {
  name: string;
  service: string;
  size: string;
  price: number;
  travel_fee: number;
  miles: number | null;
  total: number;
  date: string;
  time: string;
};

export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const preset: FormVals = {};
  const qs = url.searchParams.get("service") || "";
  const qz = url.searchParams.get("size") || "";
  if (qz in SIZES) preset.size = qz;
  if (qs in SERVICES) preset.service = qs;
  if (preset.size === "bike") preset.service = "full";
  return { form: preset, booked: null as Booked | null, errors: [] as string[] };
}

export async function action({ request }: { request: Request }) {
  const f = await request.formData();
  const get = (k: string) => String(f.get(k) || "").trim();
  const service = String(f.get("service") || "");
  const size = String(f.get("size") || "");
  const slotDate = get("date");
  const slotTime = get("time");
  const price = priceFor(service, size);

  const errors: string[] = [];
  if (!get("name")) errors.push("Please enter your name.");
  if (!get("phone")) errors.push("Please enter a phone number.");
  if (!get("email")) errors.push("Please enter an email.");
  if (price === null) errors.push("Please choose a valid service and car size.");
  if (!slotDate || !slotTime) errors.push("Please choose an available date and time.");
  else if (price !== null && !(await availableStarts(slotDate, service)).includes(slotTime))
    errors.push("Sorry, that time slot is no longer available.");
  if (!f.get("agree")) errors.push("Please agree to the terms & conditions to continue.");

  const address = get("address");
  const dest = address ? await geocodeAddress(address) : null;
  if (!address) errors.push("Please enter your address.");
  else if (dest === null) errors.push("Please pick a valid address from the suggestions.");

  const form: FormVals = {};
  for (const [k, v] of f.entries()) if (typeof v === "string") form[k] = v;

  if (errors.length) {
    return { form, booked: null as Booked | null, errors };
  }

  const travel = await travelForDest(dest);
  const travelFee = travel ? travel.fee : 0;
  const name = get("name");
  const phone = get("phone");
  const email = get("email").toLowerCase();
  const car = get("car");
  const created = etNowStamp();

  const res = await db()
    .prepare(
      `INSERT INTO bookings (created, name, phone, email, address, car, size, service, info, price, travel_fee, date, time)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .bind(created, name, phone, email, address, car, size, service, get("info"), price!, travelFee, slotDate, slotTime)
    .run();
  const id = Number(res.meta.last_row_id);

  await db()
    .prepare(
      `INSERT INTO customers (created, name, email, phone, address, car) VALUES (?,?,?,?,?,?)
       ON CONFLICT(email) DO UPDATE SET
         name=excluded.name, phone=excluded.phone,
         address=CASE WHEN excluded.address!='' THEN excluded.address ELSE customers.address END,
         car=CASE WHEN excluded.car!='' THEN excluded.car ELSE customers.car END`,
    )
    .bind(created, name, email, phone, address, car)
    .run();

  const row = await db().prepare("SELECT * FROM bookings WHERE id=?").bind(id).first<Booking>();
  if (row) await sendConfirmation(row); // non-fatal (sendConfirmation never throws)

  const booked: Booked = {
    name,
    service: serviceLabel(service, size),
    size: SIZES[size].label,
    price: price!,
    travel_fee: travelFee,
    miles: travel ? travel.miles : null,
    total: Math.round((price! + travelFee) * 100) / 100,
    date: slotDate,
    time: slotTime,
  };
  return { form: {} as FormVals, booked, errors: [] as string[] };
}

const g = (n: number) => String(Math.round(n * 100) / 100);

export default function Book({ loaderData, actionData }: Route.ComponentProps) {
  const data = actionData ?? loaderData;
  const f: FormVals = data.form || {};
  const errors: string[] = data.errors || [];
  const booked = data.booked as Booked | null;
  const pricingJson = JSON.stringify({ services: SERVICES, sizes: SIZES });
  const showService = !!(f.size || f.service);

  return (
    <SiteLayout>
      <section className="page-hero short">
        <div className="hero-glow"></div>
        <p className="eyebrow reveal">Book online</p>
        <h1 className="reveal">Reserve your detail.</h1>
        <p className="page-sub reveal">Tell us about your vehicle and pick a service.</p>
      </section>

      <section className="book-wrap">
        {booked ? (
          <div className="confirm-card reveal">
            <div className="confirm-check"></div>
            <h2>Thanks, {booked.name}!</h2>
            <p>Your booking request has been received.</p>
            <ul className="confirm-summary">
              {booked.date && (
                <li>
                  <span>Appointment</span>
                  <strong>
                    {booked.date} at {booked.time}
                  </strong>
                </li>
              )}
              <li>
                <span>Service</span>
                <strong>{booked.service}</strong>
              </li>
              <li>
                <span>Car size</span>
                <strong>{booked.size}</strong>
              </li>
              <li>
                <span>Service price</span>
                <strong>${booked.price}</strong>
              </li>
              {booked.travel_fee ? (
                <li>
                  <span>Travel fee{booked.miles ? ` (${booked.miles} mi)` : ""}</span>
                  <strong>+${g(booked.travel_fee)}</strong>
                </li>
              ) : null}
              <li className="confirm-grand">
                <span>Total</span>
                <strong className="grad">${g(booked.total)}</strong>
              </li>
            </ul>
            <a href="/" className="btn btn-ghost">
              Back home
            </a>
          </div>
        ) : (
          <>
            {errors.length > 0 && (
              <div className="form-errors reveal">
                {errors.map((m, i) => (
                  <p key={i}>{m}</p>
                ))}
              </div>
            )}

            <form
              className="book-form reveal"
              method="POST"
              action="/book"
              id="bookForm"
              data-pricing={pricingJson}
            >
              <div className="field-row">
                <label className="field">
                  <span>Name *</span>
                  <input type="text" name="name" required defaultValue={f.name || ""} placeholder="Your full name" />
                </label>
                <label className="field">
                  <span>Phone *</span>
                  <input type="tel" name="phone" required defaultValue={f.phone || ""} placeholder="(000) 000-0000" />
                </label>
              </div>

              <div className="field-row">
                <label className="field">
                  <span>Email *</span>
                  <input type="email" name="email" required defaultValue={f.email || ""} placeholder="you@email.com" />
                </label>
                <label className="field">
                  <span>Address *</span>
                  <input
                    type="text"
                    name="address"
                    required
                    defaultValue={f.address || ""}
                    placeholder="Start typing, then pick a suggestion"
                    autoComplete="off"
                  />
                  <small className="field-err" id="addrErr" hidden>
                    Please choose your address from the dropdown suggestions.
                  </small>
                </label>
              </div>

              <div className="field-row">
                <label className="field">
                  <span>Car (make &amp; model)</span>
                  <input type="text" name="car" defaultValue={f.car || ""} placeholder="e.g. 2021 Toyota RAV4" />
                </label>
                <label className="field">
                  <span>Car size *</span>
                  <select name="size" id="sizeSelect" required defaultValue={f.size || ""}>
                    <option value="" disabled>
                      Choose size…
                    </option>
                    {Object.entries(SIZES).map(([key, s]) => (
                      <option value={key} key={key}>
                        {s.label}
                        {s.surcharge ? ` (+$${s.surcharge})` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className={`field${showService ? "" : " hidden"}`} id="serviceField">
                <span>Service *</span>
                <select name="service" id="serviceSelect" required disabled={!showService} defaultValue={f.service || ""}>
                  <option value="" disabled>
                    Choose a service…
                  </option>
                  {Object.entries(SERVICES).map(([key, s]) => (
                    <option value={key} key={key}>
                      {s.label} — from ${s.price}
                    </option>
                  ))}
                </select>
              </label>

              <label className={`field${f.service ? "" : " hidden"}`} id="apptField">
                <span>Appointment *</span>
                <button type="button" className="appt-btn" id="apptBtn">
                  {f.date && f.time ? `${f.date} · ${f.time}` : "Choose date & time"}
                </button>
                <input type="hidden" name="date" id="bookDate" defaultValue={f.date || ""} />
                <input type="hidden" name="time" id="bookTime" defaultValue={f.time || ""} />
              </label>

              <label className="field">
                <span>Anything else?</span>
                <textarea name="info" rows={4} placeholder="Pet hair, heavy stains, scheduling notes…" defaultValue={f.info || ""} />
              </label>

              <div className="summary-card">
                <p className="receipt-hint" id="receiptHint">
                  Select a car size and service to see your breakdown.
                </p>
                <div className="receipt" id="receipt" hidden>
                  <p className="receipt-title">Your detail</p>
                  <p className="receipt-desc" id="receiptDesc"></p>
                  <ul className="receipt-lines" id="receiptLines"></ul>
                  <div className="receipt-grand">
                    <span>Total</span>
                    <strong className="grad" id="receiptTotal">
                      —
                    </strong>
                  </div>
                  <p className="receipt-est" id="receiptEst" hidden></p>
                </div>
                <label className="agree">
                  <input type="checkbox" name="agree" value="yes" required defaultChecked={!!f.agree} />
                  <span>
                    I agree to the{" "}
                    <a href="/terms" target="_blank" rel="noopener">
                      terms &amp; conditions
                    </a>
                    .
                  </span>
                </label>
                <button type="submit" className="btn btn-silver btn-lg summary-submit">
                  Request Booking
                </button>
                <div className="pay-methods">
                  <span className="pay-label">We accept</span>
                  <span className="pay-chip cash">Cash</span>
                  <span className="pay-chip cardpay">Card</span>
                  <span className="pay-chip applepay">Apple&nbsp;Pay</span>
                  <span className="pay-chip venmo">Venmo</span>
                  <span className="pay-chip zelle">Zelle</span>
                  <span className="pay-chip cashapp">Cash&nbsp;App</span>
                </div>
                <p className="pay-note">Payment is collected after your detail is complete.</p>
              </div>
            </form>

            <div className="modal" id="apptModal" hidden>
              <div className="modal-backdrop" data-close></div>
              <div className="modal-card appt-modal">
                <button className="modal-close" data-close aria-label="Close">
                  &times;
                </button>
                <h3>Pick a date &amp; time</h3>
                <p className="modal-sub" id="apptDur"></p>
                <div className="appt-cal">
                  <div className="cal-head">
                    <button type="button" id="apptPrev" aria-label="Previous month">
                      &lsaquo;
                    </button>
                    <span id="apptLabel"></span>
                    <button type="button" id="apptNext" aria-label="Next month">
                      &rsaquo;
                    </button>
                  </div>
                  <div className="cal-dow">
                    <span>Su</span>
                    <span>Mo</span>
                    <span>Tu</span>
                    <span>We</span>
                    <span>Th</span>
                    <span>Fr</span>
                    <span>Sa</span>
                  </div>
                  <div className="cal-grid" id="apptGrid"></div>
                </div>
                <div className="appt-times" id="apptTimes">
                  <p className="appt-times-hint">Select a date to see open times.</p>
                </div>
              </div>
            </div>
          </>
        )}
      </section>
    </SiteLayout>
  );
}
