import { env } from "cloudflare:workers";
import { redirect } from "react-router";
import type { Route } from "./+types/admin";
import { SiteLayout } from "../components/SiteLayout";
import { SERVICES, SIZES } from "../lib/catalog";
import { db, reviewsList, slotConfig } from "../lib/db";
import { commitAdmin, isAdmin, safeEqual } from "../lib/session";
import { etTodayISO } from "../lib/time";

export function meta() {
  return [{ title: "Admin — Lucid Detailing" }];
}

export async function action({ request }: { request: Request }) {
  const f = await request.formData();
  const supplied = String(f.get("password") || "");
  const pw = env.ADMIN_PASSWORD || "";
  if (pw && safeEqual(supplied, pw)) {
    return redirect("/admin", { headers: { "Set-Cookie": await commitAdmin() } });
  }
  return { loginError: "Incorrect password." };
}

export async function loader({ request }: { request: Request }) {
  if (!(await isAdmin(request))) return { admin: false as const };
  const bookings = (await db().prepare("SELECT * FROM bookings ORDER BY id DESC").all<any>()).results;
  const availability = (await db().prepare("SELECT date FROM availability ORDER BY date").all<{ date: string }>()).results.map(
    (r) => r.date,
  );
  const gallery = (await db().prepare("SELECT * FROM gallery ORDER BY id DESC").all<any>()).results;
  const customers = (
    await db().prepare("SELECT * FROM customers ORDER BY name COLLATE NOCASE").all<any>()
  ).results;
  const reviews = await reviewsList();
  const { start, end, buffer } = await slotConfig();
  const counts: Record<string, number> = {};
  for (const b of bookings) {
    const k = String(b.email || "").toLowerCase();
    counts[k] = (counts[k] || 0) + 1;
  }
  return {
    admin: true as const,
    bookings,
    availability,
    gallery,
    customers,
    reviews,
    slotStart: start,
    slotEnd: end,
    buffer,
    today: etTodayISO(),
    counts,
  };
}

const g = (n: number) => String(Math.round(n * 100) / 100);

function DataScript({ id, value }: { id: string; value: unknown }) {
  const json = JSON.stringify(value).replace(/</g, "\\u003c");
  return <script id={id} type="application/json" dangerouslySetInnerHTML={{ __html: json }} />;
}

function AdminLogin({ error }: { error?: string }) {
  return (
    <section className="admin-login">
      <div className="login-card reveal">
        <img className="login-logo" src="/static/icon.png" alt="" />
        {error && (
          <div className="form-errors">
            <p>{error}</p>
          </div>
        )}
        <form method="POST" action="/admin">
          <label className="field">
            <span>Password</span>
            <input type="password" name="password" required autoFocus placeholder="••••••••" />
          </label>
          <button type="submit" className="btn btn-silver btn-lg">
            Log in
          </button>
        </form>
      </div>
    </section>
  );
}

export default function Admin({ loaderData, actionData }: Route.ComponentProps) {
  if (!loaderData.admin) {
    return (
      <SiteLayout>
        <AdminLogin error={actionData?.loginError} />
      </SiteLayout>
    );
  }

  const { bookings, availability, gallery, customers, reviews, slotStart, slotEnd, buffer, today, counts } =
    loaderData;

  const bookingsData = bookings.map((b: any) => ({
    id: b.id,
    name: b.name || "",
    phone: b.phone || "",
    email: b.email || "",
    address: b.address || "",
    car: b.car || "",
    size: b.size || "",
    service: b.service || "",
    info: b.info || "",
    date: b.date || "",
    time: b.time || "",
    price: b.price || 0,
    travel_fee: b.travel_fee || 0,
  }));
  const customersData = customers.map((c: any) => ({
    id: c.id,
    name: c.name || "",
    email: c.email || "",
    phone: c.phone || "",
    address: c.address || "",
    car: c.car || "",
    notes: c.notes || "",
    created: c.created || "",
  }));

  return (
    <SiteLayout>
      <section className="admin-head">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Dashboard</h1>
        </div>
        <a href="/admin/logout" className="btn btn-ghost btn-sm">
          Log out
        </a>
      </section>

      <nav className="admin-tabs" id="adminTabs">
        <button type="button" data-tab="bookings" className="active">
          Bookings
        </button>
        <button type="button" data-tab="schedule">
          Schedule
        </button>
        <button type="button" data-tab="customers">
          Customers
        </button>
        <button type="button" data-tab="photos">
          Photos
        </button>
        <button type="button" data-tab="reviews">
          Reviews
        </button>
      </nav>

      <section className="admin-section admin-panel" data-tab="schedule" hidden>
        <h2 className="admin-h2">Availability</h2>
        <div className="sched-grid">
          <div className="calendar">
            <div className="cal-head">
              <button type="button" id="calPrev" aria-label="Previous month">
                &lsaquo;
              </button>
              <span id="calLabel"></span>
              <button type="button" id="calNext" aria-label="Next month">
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
            <div className="cal-grid" id="calGrid"></div>
            <p className="cal-hint">
              <span className="dot avail"></span> available &nbsp; <span className="dot booked"></span> has bookings —
              click a day to toggle
            </p>
          </div>

          <div className="sched-side">
            <div className="panel">
              <h3>Hours</h3>
              <div className="ts-row">
                <label>
                  Open<select id="tsStart"></select>
                </label>
                <label>
                  Close<select id="tsEnd"></select>
                </label>
                <label>
                  Travel buffer
                  <select id="tsMins">
                    <option value="0">None</option>
                    <option value="15">15 min</option>
                    <option value="30">30 min</option>
                    <option value="45">45 min</option>
                    <option value="60">60 min</option>
                  </select>
                </label>
              </div>
              <button type="button" className="btn btn-silver btn-sm" id="tsSave">
                Save hours
              </button>
              <p className="ts-preview" id="tsPreview"></p>
            </div>
            <div className="panel">
              <h3>
                Quick set — <span id="quickMonth"></span>
              </h3>
              <div className="quick-opts">
                <button type="button" data-quick="weekdays">
                  Weekdays
                </button>
                <button type="button" data-quick="weekends">
                  Weekends
                </button>
                <button type="button" data-quick="all">
                  All days
                </button>
                <button type="button" data-quick="clear">
                  Clear
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="admin-section admin-panel" data-tab="bookings">
        <div className="bookings-head">
          <h2 className="admin-h2">
            Bookings <span className="count">{bookings.length}</span>
          </h2>
          <div className="filters" id="filters">
            <button type="button" data-filter="today">
              Today
            </button>
            <button type="button" data-filter="week">
              This week
            </button>
            <button type="button" data-filter="upcoming">
              Upcoming
            </button>
            <button type="button" data-filter="all" className="active">
              All
            </button>
          </div>
        </div>
        <p className="filter-note" id="filterNote" hidden></p>

        <div className="admin-grid" id="bookingsGrid">
          {bookings.length === 0 && <p className="empty-note">No bookings yet.</p>}
          {bookings.map((b: any) => {
            const tf = b.travel_fee || 0;
            return (
              <article className="booking-card" data-id={b.id} data-date={b.date || ""} key={b.id}>
                <div className="booking-top">
                  <h3>{b.name}</h3>
                  <span className="booking-price grad">${g(b.price + tf)}</span>
                </div>
                <p className="booking-meta">
                  {b.date && (
                    <>
                      <strong className="booking-when">
                        {b.date}
                        {b.time ? ` · ${b.time}` : ""}
                      </strong>{" "}
                      ·{" "}
                    </>
                  )}
                  booked {b.created}
                </p>
                <ul className="booking-details">
                  <li>
                    <span>Service</span>
                    <strong>{b.service}</strong>
                  </li>
                  <li>
                    <span>Size</span>
                    <strong>{b.size}</strong>
                  </li>
                  <li>
                    <span>Phone</span>
                    <strong>
                      <a href={`tel:${b.phone}`}>{b.phone}</a>
                    </strong>
                  </li>
                  <li>
                    <span>Email</span>
                    <strong>
                      <a href={`mailto:${b.email}`}>{b.email}</a>
                    </strong>
                  </li>
                  <li>
                    <span>Address</span>
                    <strong>{b.address || "—"}</strong>
                  </li>
                  {b.car && (
                    <li>
                      <span>Car</span>
                      <strong>{b.car}</strong>
                    </li>
                  )}
                  <li>
                    <span>Service price</span>
                    <strong>${b.price}</strong>
                  </li>
                  {tf ? (
                    <li className="fee-line">
                      <span>Travel fee</span>
                      <strong>+${g(tf)}</strong>
                    </li>
                  ) : null}
                </ul>
                {b.info && <p className="booking-note">“{b.info}”</p>}
                <div className="booking-actions">
                  <button type="button" className="btn btn-ghost btn-sm edit-btn" data-id={b.id}>
                    Edit
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm del-btn" data-id={b.id}>
                    Delete
                  </button>
                </div>
              </article>
            );
          })}
          <p className="empty-note" id="filterEmpty" hidden>
            No bookings match this filter.
          </p>
        </div>
      </section>

      <section className="admin-section admin-panel" data-tab="customers" hidden>
        <h2 className="admin-h2">
          Customers <span className="count">{customers.length}</span>
        </h2>
        {customers.length === 0 && (
          <p className="empty-note">No customers yet — they're saved automatically when someone books.</p>
        )}
        <div className="cust-list">
          {customers.map((c: any) => {
            const n = counts[String(c.email || "").toLowerCase()] || 0;
            return (
              <button type="button" className="cust-row" data-id={c.id} key={c.id}>
                <span className="cust-id">
                  <strong>{c.name || "Unnamed"}</strong>
                  <span className="cust-sub">
                    {c.email}
                    {c.phone ? ` · ${c.phone}` : ""}
                  </span>
                </span>
                <span className="cust-count">
                  {n} booking{n !== 1 ? "s" : ""} &rsaquo;
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="admin-section admin-panel" data-tab="photos" hidden>
        <h2 className="admin-h2">
          Before &amp; after gallery <span className="count">{gallery.length}</span>
        </h2>
        <form className="gallery-form panel" method="POST" action="/admin/gallery" encType="multipart/form-data">
          <label className="field">
            <span>Title (optional)</span>
            <input name="title" placeholder="e.g. 2019 Mustang GT" />
          </label>
          <div className="field-row">
            <label className="field">
              <span>Before photo *</span>
              <input type="file" name="before" accept="image/*" required />
            </label>
            <label className="field">
              <span>After photo *</span>
              <input type="file" name="after" accept="image/*" required />
            </label>
          </div>
          <button type="submit" className="btn btn-silver">
            Add car
          </button>
        </form>

        <div className="gallery-grid">
          {gallery.map((gItem: any) => (
            <div className="gallery-item" data-id={gItem.id} key={gItem.id}>
              <div className="gi-imgs">
                <img src={`/img/${gItem.before_img}`} alt="before" />
                <img src={`/img/${gItem.after_img}`} alt="after" />
              </div>
              <div className="gi-foot">
                <span>{gItem.title || "Untitled"}</span>
                <button type="button" className="btn btn-ghost btn-sm gi-del" data-id={gItem.id}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="admin-section admin-panel" data-tab="reviews" hidden>
        <h2 className="admin-h2">
          Reviews <span className="count">{reviews.length}</span>
        </h2>
        <form className="review-form panel" method="POST" action="/admin/review">
          <div className="field-row">
            <label className="field">
              <span>Customer name</span>
              <input name="name" required />
            </label>
            <label className="field">
              <span>Rating</span>
              <select name="stars" defaultValue="5">
                <option value="5">★★★★★ (5)</option>
                <option value="4">★★★★ (4)</option>
                <option value="3">★★★ (3)</option>
                <option value="2">★★ (2)</option>
                <option value="1">★ (1)</option>
              </select>
            </label>
          </div>
          <label className="field">
            <span>Review</span>
            <textarea name="body" rows={3} required />
          </label>
          <div className="field">
            <span>Date posted</span>
            <div className="mini-cal">
              <div className="cal-head">
                <button type="button" id="rvPrev" aria-label="Previous month">
                  &lsaquo;
                </button>
                <span id="rvLabel"></span>
                <button type="button" id="rvNext" aria-label="Next month">
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
              <div className="cal-grid" id="rvGrid"></div>
            </div>
            <input type="hidden" name="date" id="rvDate" />
          </div>
          <button type="submit" className="btn btn-silver">
            Add review
          </button>
        </form>

        <div className="admin-grid">
          {reviews.length === 0 && <p className="empty-note">No reviews yet.</p>}
          {reviews.map((r) => (
            <article className="review-card" key={r.id}>
              <div className="rv-stars">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i} className={i < r.stars ? undefined : "off"}>
                    ★
                  </span>
                ))}
              </div>
              <p className="booking-note" style={{ fontStyle: "italic" }}>
                “{r.body}”
              </p>
              <div className="rv-foot">
                <span className="rv-name">{r.name}</span>
                <span className="rv-when">{r.when}</span>
              </div>
              <button type="button" className="btn btn-ghost btn-sm rv-del" data-id={r.id}>
                Delete
              </button>
            </article>
          ))}
        </div>
      </section>

      {/* ---- Modals (driven by site.js) ---- */}
      <div className="modal" id="confirmModal" hidden>
        <div className="modal-backdrop" data-close></div>
        <div className="modal-card confirm-modal">
          <h3>Delete booking?</h3>
          <p className="modal-sub" id="confirmText">
            This can't be undone.
          </p>
          <div className="confirm-actions">
            <button type="button" className="btn btn-ghost" data-close>
              Cancel
            </button>
            <button type="button" className="btn btn-danger" id="confirmDelete">
              Delete
            </button>
          </div>
        </div>
      </div>

      <div className="modal" id="editModal" hidden>
        <div className="modal-backdrop" data-close></div>
        <div className="modal-card">
          <button className="modal-close" data-close aria-label="Close">
            &times;
          </button>
          <h3>Edit booking</h3>
          <form id="editForm">
            <input type="hidden" name="id" id="editId" />
            <div className="field-row">
              <label className="field">
                <span>Name</span>
                <input name="name" id="ed_name" />
              </label>
              <label className="field">
                <span>Phone</span>
                <input name="phone" id="ed_phone" />
              </label>
            </div>
            <div className="field-row">
              <label className="field">
                <span>Email</span>
                <input name="email" id="ed_email" />
              </label>
              <label className="field">
                <span>Car</span>
                <input name="car" id="ed_car" />
              </label>
            </div>
            <label className="field">
              <span>Address</span>
              <input name="address" id="ed_address" autoComplete="off" />
            </label>
            <div className="field-row">
              <label className="field">
                <span>Size</span>
                <select name="size" id="ed_size">
                  {Object.entries(SIZES).map(([key, s]) => (
                    <option value={key} key={key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Service</span>
                <select name="service" id="ed_service">
                  {Object.entries(SERVICES).map(([key, s]) => (
                    <option value={key} key={key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="field-row">
              <label className="field">
                <span>Date</span>
                <input name="date" id="ed_date" placeholder="YYYY-MM-DD" />
              </label>
              <label className="field">
                <span>Time</span>
                <input name="time" id="ed_time" placeholder="HH:MM" />
              </label>
            </div>
            <label className="field">
              <span>Notes</span>
              <textarea name="info" id="ed_info" rows={3} />
            </label>
            <button type="submit" className="btn btn-silver">
              Save changes
            </button>
            <div className="travel-result" id="editResult" hidden></div>
          </form>
        </div>
      </div>

      <div className="modal" id="customerModal" hidden>
        <div className="modal-backdrop" data-cclose></div>
        <div className="modal-card">
          <div className="modal-actions">
            <button type="button" className="icon-btn" id="custEditBtn" title="Edit">
              Edit
            </button>
            <button type="button" className="icon-btn danger" id="custDelBtn" title="Delete">
              Delete
            </button>
            <button type="button" className="modal-close" data-cclose aria-label="Close">
              &times;
            </button>
          </div>
          <div id="custView">
            <h3 id="custName"></h3>
            <ul className="cust-details" id="custDetails"></ul>
            <button type="button" className="btn btn-silver" id="custViewBookings">
              View bookings
            </button>
          </div>
          <form id="custForm" hidden>
            <h3>Edit customer</h3>
            <div className="field-row">
              <label className="field">
                <span>Name</span>
                <input name="name" id="cu_name" />
              </label>
              <label className="field">
                <span>Phone</span>
                <input name="phone" id="cu_phone" />
              </label>
            </div>
            <div className="field-row">
              <label className="field">
                <span>Email</span>
                <input name="email" id="cu_email" />
              </label>
              <label className="field">
                <span>Vehicle</span>
                <input name="car" id="cu_car" />
              </label>
            </div>
            <label className="field">
              <span>Address</span>
              <input name="address" id="cu_address" autoComplete="off" />
            </label>
            <label className="field">
              <span>Notes</span>
              <textarea name="notes" id="cu_notes" rows={2} />
            </label>
            <div className="cust-actions">
              <button type="submit" className="btn btn-silver btn-sm">
                Save
              </button>
              <button type="button" className="btn btn-ghost btn-sm" id="custCancel">
                Cancel
              </button>
            </div>
            <div className="travel-result" id="custResult" hidden></div>
          </form>
        </div>
      </div>

      <div className="modal" id="custBookingsModal" hidden>
        <div className="modal-backdrop" data-bclose></div>
        <div className="modal-card">
          <button type="button" className="modal-close" data-bclose aria-label="Close">
            &times;
          </button>
          <h3>
            Bookings — <span id="cbName"></span>
          </h3>
          <div id="cbList" className="cb-list"></div>
        </div>
      </div>

      <DataScript
        id="admin-data"
        value={{ availability, slotStart, slotEnd, buffer, today }}
      />
      <DataScript id="bookings-data" value={bookingsData} />
      <DataScript id="customers-data" value={customersData} />
      <DataScript id="services-data" value={SERVICES} />
    </SiteLayout>
  );
}
