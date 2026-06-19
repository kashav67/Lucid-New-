import os
import sqlite3
import hmac
import json
import math
import uuid
import html
import time
import smtplib
import threading
import urllib.parse
import urllib.request
from email.message import EmailMessage
from datetime import datetime, date, timedelta

from flask import (Flask, render_template, request, redirect,
                   url_for, session, flash, g)
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "dev-secret-change-me")

ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")
LOCK_PASSWORD = os.environ.get("LOCK_PASSWORD", "")
BUSINESS_ADDRESS = os.environ.get("BUSINESS_ADDRESS", "")
TRAVEL_RATE = float(os.environ.get("TRAVEL_RATE", "1") or 1)
DB_PATH = os.path.join(os.path.dirname(__file__), "bookings.db")

app.config["MAX_CONTENT_LENGTH"] = 12 * 1024 * 1024
UPLOAD_DIR = os.path.join(app.static_folder, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}

SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "465") or 465)
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASS = os.environ.get("SMTP_PASS", "")
MAIL_FROM = os.environ.get("MAIL_FROM") or SMTP_USER
BUSINESS_PHONE = os.environ.get("BUSINESS_PHONE", "")
INSTAGRAM = os.environ.get("INSTAGRAM", "")
REMINDER_HOURS = float(os.environ.get("REMINDER_HOURS", "3") or 3)
LEAD_HOURS = float(os.environ.get("LEAD_HOURS", "3") or 3)

SERVICES = {
    "full":     {"label": "Full Detail — Interior & Exterior", "price": 249, "minutes": 90,
                 "desc": "Complete interior deep clean plus full exterior wash & finish."},
    "interior": {"label": "Interior Detail", "price": 149, "minutes": 60,
                 "desc": "Seats, carpets, surfaces, and glass cleaned inside out."},
    "exterior": {"label": "Exterior Detail", "price": 99, "minutes": 30,
                 "desc": "Hand wash, decontamination, and a flawless exterior finish."},
}
GRID_MINUTES = 30
SIZES = {
    "small":  {"label": "Small — coupe / sedan",         "surcharge": 0},
    "medium": {"label": "Medium — SUV / crossover",      "surcharge": 25},
    "large":  {"label": "Large — truck / van / 3-row",   "surcharge": 50},
    "bike":   {"label": "Bike / Motorcycle",             "surcharge": 0},
}
BIKE_PRICE = 79

SERVICE_CARDS = [
    {"icon": "interior", "title": "Interior",
     "items": ["Stain removal", "Pet hair removal", "Sticky buttons & surfaces",
               "Full interior clean"]},
    {"icon": "exterior", "title": "Exterior",
     "items": ["Pre-wash", "Hand wash", "Bug spot removal", "Finishing"]},
    {"icon": "ceramic", "title": "Bikes & Motorcycles",
     "items": ["Pre-wash", "Hand wash", "Bug spot removal", "Sticky buttons",
               "Finishing"]},
]

def price_for(service, size):
    """Authoritative server-side price. Returns int or None if invalid."""
    if size == "bike":
        return BIKE_PRICE if service == "full" else None
    if service not in SERVICES or size not in SIZES:
        return None
    return SERVICES[service]["price"] + SIZES[size]["surcharge"]

def service_label(service, size=None):
    """Display label — bikes just say 'Full Detail' (no interior/exterior)."""
    if size == "bike":
        return "Full Detail"
    return SERVICES.get(service, {}).get("label", service)

SCHEMA = """CREATE TABLE IF NOT EXISTS bookings (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    created   TEXT NOT NULL,
    name      TEXT NOT NULL,
    phone     TEXT NOT NULL,
    email     TEXT NOT NULL,
    address   TEXT,
    car       TEXT,
    size      TEXT NOT NULL,
    service   TEXT NOT NULL,
    info      TEXT,
    price     INTEGER NOT NULL
)"""

def ensure_schema(db):
    """Create tables if missing and add any newer columns (migration)."""
    db.execute(SCHEMA)
    cols = [r[1] for r in db.execute("PRAGMA table_info(bookings)").fetchall()]
    if "travel_fee" not in cols:
        db.execute("ALTER TABLE bookings ADD COLUMN travel_fee REAL NOT NULL DEFAULT 0")
    if "date" not in cols:
        db.execute("ALTER TABLE bookings ADD COLUMN date TEXT")
    if "time" not in cols:
        db.execute("ALTER TABLE bookings ADD COLUMN time TEXT")
    if "reminded" not in cols:
        db.execute("ALTER TABLE bookings ADD COLUMN reminded INTEGER NOT NULL DEFAULT 0")
    db.execute("""CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT, created TEXT, name TEXT,
        email TEXT UNIQUE, phone TEXT, address TEXT, car TEXT, notes TEXT)""")
    db.execute("CREATE TABLE IF NOT EXISTS availability (date TEXT PRIMARY KEY)")
    db.execute("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)")
    db.execute("""CREATE TABLE IF NOT EXISTS gallery (
        id INTEGER PRIMARY KEY AUTOINCREMENT, created TEXT, title TEXT,
        before_img TEXT NOT NULL, after_img TEXT NOT NULL)""")
    db.execute("""CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT, created TEXT, name TEXT,
        body TEXT, stars INTEGER NOT NULL DEFAULT 5)""")
    for k, v in (("slot_start", "14"), ("slot_end", "22"), ("buffer", "30")):
        db.execute("INSERT OR IGNORE INTO settings(key, value) VALUES(?,?)", (k, v))
    db.commit()

def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        ensure_schema(g.db)
    return g.db

@app.teardown_appcontext
def close_db(exc):
    db = g.pop("db", None)
    if db is not None:
        db.close()

def init_db():
    db = sqlite3.connect(DB_PATH)
    ensure_schema(db)
    db.close()

init_db()

def _geocode(address):
    """Address -> (lat, lon) via Photon (OSM), with a Nominatim fallback."""
    address = (address or "").strip()
    if not address:
        return None
    try:
        url = "https://photon.komoot.io/api/?" + urllib.parse.urlencode(
            {"q": address, "limit": 1})
        req = urllib.request.Request(url, headers={"User-Agent": "LucidDetailing/1.0"})
        with urllib.request.urlopen(req, timeout=10) as r:
            feats = json.load(r).get("features")
        if feats:
            lon, lat = feats[0]["geometry"]["coordinates"]
            return float(lat), float(lon)
    except Exception:
        pass
    try:
        url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(
            {"format": "json", "limit": 1, "q": address})
        req = urllib.request.Request(url, headers={
            "User-Agent": "LucidDetailing/1.0 (travel-fee tool)"})
        with urllib.request.urlopen(req, timeout=10) as r:
            data = json.load(r)
        if data:
            return float(data[0]["lat"]), float(data[0]["lon"])
    except Exception:
        pass
    return None

def _haversine_miles(a, b):
    R = 3958.8
    lat1, lon1, lat2, lon2 = map(math.radians, [a[0], a[1], b[0], b[1]])
    h = (math.sin((lat2 - lat1) / 2) ** 2
         + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2)
    return 2 * R * math.asin(math.sqrt(h))

def _driving_miles(a, b):
    """Driving distance in miles via OSRM, falling back to straight-line."""
    try:
        url = (f"https://router.project-osrm.org/route/v1/driving/"
               f"{a[1]},{a[0]};{b[1]},{b[0]}?overview=false")
        with urllib.request.urlopen(url, timeout=10) as r:
            data = json.load(r)
        return data["routes"][0]["distance"] / 1609.344
    except Exception:
        return _haversine_miles(a, b)

_ORIGIN = None

def _origin_coords():
    """Cached coords of the shop (geocoded once), reused for fees + suggestions."""
    global _ORIGIN
    if _ORIGIN is None:
        _ORIGIN = _geocode(BUSINESS_ADDRESS) or False
    return _ORIGIN or None

def travel_fee_for(address):
    """Return (fee, miles) from the shop to `address`, or None if unavailable."""
    address = (address or "").strip()
    if not address or not BUSINESS_ADDRESS:
        return None
    origin = _origin_coords()
    dest = _geocode(address)
    if not origin or not dest:
        return None
    miles = _driving_miles(origin, dest)
    return round(miles * TRAVEL_RATE), round(miles, 1)

def address_suggestions(q):
    """Typeahead address suggestions via Photon (free OSM geocoder)."""
    q = (q or "").strip()
    if len(q) < 3:
        return []
    params = {"q": q, "limit": 6, "lang": "en"}
    o = _origin_coords()
    if o:
        params["lat"], params["lon"] = o[0], o[1]
    url = "https://photon.komoot.io/api/?" + urllib.parse.urlencode(params)
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "LucidDetailing/1.0"})
        with urllib.request.urlopen(req, timeout=8) as r:
            data = json.load(r)
    except Exception:
        return []
    out = []
    for feat in data.get("features", []):
        p = feat.get("properties", {})
        line1 = " ".join(x for x in [p.get("housenumber"),
                                     p.get("street") or p.get("name")] if x)
        loc = ", ".join(x for x in [p.get("city") or p.get("county"),
                                    p.get("state"), p.get("postcode")] if x)
        label = ", ".join(x for x in [line1, loc] if x)
        if label and label not in out:
            out.append(label)
    return out

def _smtp_send(msg):
    """Send a prepared EmailMessage; raises on failure."""
    if not (SMTP_HOST and SMTP_USER and SMTP_PASS):
        print("[email] SMTP not configured — skipping send.")
        return False
    if SMTP_PORT == 465:
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=20) as s:
            s.login(SMTP_USER, SMTP_PASS)
            s.send_message(msg)
    else:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20) as s:
            s.ehlo()
            s.starttls()
            s.login(SMTP_USER, SMTP_PASS)
            s.send_message(msg)
    return True

def send_email(to, subject, text_body, html_body):
    """Build a multipart (plain + HTML) email that renders on any client."""
    if not to:
        return False
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = MAIL_FROM
    msg["To"] = to
    if SMTP_USER:
        msg["Reply-To"] = SMTP_USER
    msg.set_content(text_body)
    msg.add_alternative(html_body, subtype="html")
    try:
        return _smtp_send(msg)
    except Exception as e:
        print(f"[email] send failed to {to}: {e}")
        return False

def send_email_async(to, subject, text_body, html_body):
    threading.Thread(target=send_email, args=(to, subject, text_body, html_body),
                     daemon=True).start()

def _money(n):
    n = round(float(n), 2)
    return f"${int(n)}" if n == int(n) else f"${n:.2f}"

def _email_html(heading, intro, rows, footer_note):
    """Simple, table-based, inline-styled HTML — safe across email clients."""
    line_items = "".join(
        f'<tr><td style="padding:6px 0;color:#6b7178;font-size:14px;">{html.escape(k)}</td>'
        f'<td style="padding:6px 0;color:#111;font-size:14px;font-weight:600;text-align:right;">{html.escape(str(v))}</td></tr>'
        for k, v in rows)
    return f"""\
<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f5f7;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:24px 0;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e6e8eb;font-family:Arial,Helvetica,sans-serif;">
    <tr><td style="background:#0b0c0e;padding:22px 28px;">
      <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:1px;">LUCID</span>
      <span style="color:#9aa0a8;font-size:20px;font-weight:300;letter-spacing:2px;"> DETAILING</span>
    </td></tr>
    <tr><td style="padding:28px;">
      <h1 style="margin:0 0 10px;font-size:21px;color:#111;">{html.escape(heading)}</h1>
      <p style="margin:0 0 18px;color:#555;font-size:15px;line-height:1.55;">{intro}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="border-top:1px solid #e6e8eb;border-bottom:1px solid #e6e8eb;margin:6px 0 18px;">
        {line_items}
      </table>
      <p style="margin:0;color:#888;font-size:13px;line-height:1.55;">{footer_note}</p>
    </td></tr>
    <tr><td style="background:#0b0c0e;padding:16px 28px;color:#6b7178;font-size:12px;">
      Lucid Detailing &middot; {html.escape(BUSINESS_PHONE)} &middot; {html.escape(SMTP_USER)}{(" &middot; @" + html.escape(INSTAGRAM)) if INSTAGRAM else ""}
    </td></tr>
  </table>
</td></tr></table></body></html>"""

def _appt_str(b):
    """Human appointment string, built without platform-specific strftime codes."""
    d, t = b["date"], b["time"]
    if not d:
        return "To be scheduled"
    try:
        dt = datetime.strptime(f"{d} {t}", "%Y-%m-%d %H:%M")
        hour = dt.hour % 12 or 12
        ampm = "AM" if dt.hour < 12 else "PM"
        return dt.strftime("%A, %B ") + str(dt.day) + f" at {hour}:{dt.minute:02d} {ampm}"
    except (ValueError, TypeError):
        try:
            dt = datetime.strptime(d, "%Y-%m-%d")
            return dt.strftime("%A, %B ") + str(dt.day) + (f" at {t}" if t else "")
        except (ValueError, TypeError):
            return f"{d} {t}".strip()

def _booking_rows(b):
    svc = service_label(b["service"], b["size"])
    size = SIZES.get(b["size"], {}).get("label", b["size"])
    tf = b["travel_fee"] or 0
    rows = [("Appointment", _appt_str(b)), ("Service", svc), ("Vehicle size", size)]
    if b["car"]:
        rows.append(("Vehicle", b["car"]))
    if b["address"]:
        rows.append(("Location", b["address"]))
    rows.append(("Service price", _money(b["price"])))
    if tf:
        rows.append(("Travel fee", "+" + _money(tf)))
    rows.append(("Total", _money(b["price"] + tf)))
    return rows

def send_confirmation(b):
    rows = _booking_rows(b)
    text = "Thanks for booking with Lucid Detailing!\n\n" + \
        "\n".join(f"{k}: {v}" for k, v in rows) + \
        "\n\nWe'll see you then. Reply to this email with any questions."
    htmlb = _email_html(
        f"You're booked, {html.escape(b['name'].split(' ')[0] if b['name'] else 'there')}!",
        "Thanks for choosing Lucid Detailing. Here are your appointment details:",
        rows, "Need to change anything? Just reply to this email and we'll take care of it.")
    send_email_async(b["email"], "Your Lucid Detailing booking is confirmed", text, htmlb)

def send_reminder(b):
    rows = _booking_rows(b)
    text = "Reminder: your Lucid Detailing appointment is coming up.\n\n" + \
        "\n".join(f"{k}: {v}" for k, v in rows) + \
        "\n\nSee you soon!"
    htmlb = _email_html(
        "Your detail is coming up soon",
        "This is a friendly reminder about your upcoming appointment with Lucid Detailing:",
        rows, "Please make sure the vehicle is accessible. Reply with any questions.")
    return send_email(b["email"], "Reminder: your Lucid Detailing appointment", text, htmlb)

def send_due_reminders():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    try:
        now = datetime.now()
        rows = con.execute(
            "SELECT * FROM bookings WHERE COALESCE(reminded,0)=0 "
            "AND date IS NOT NULL AND date!='' AND time IS NOT NULL AND time!=''").fetchall()
        for b in rows:
            try:
                appt = datetime.strptime(f"{b['date']} {b['time']}", "%Y-%m-%d %H:%M")
            except (ValueError, TypeError):
                continue
            delta = (appt - now).total_seconds()
            if 0 < delta <= REMINDER_HOURS * 3600:
                if send_reminder(b):
                    con.execute("UPDATE bookings SET reminded=1 WHERE id=?", (b["id"],))
                    con.commit()
    finally:
        con.close()

def _reminder_loop():
    while True:
        try:
            send_due_reminders()
        except Exception as e:
            print(f"[reminder] loop error: {e}")
        time.sleep(300)

def start_scheduler():
    threading.Thread(target=_reminder_loop, daemon=True).start()

def get_setting(key, default=None):
    row = get_db().execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
    return row["value"] if row else default

def set_setting(key, value):
    db = get_db()
    db.execute("INSERT INTO settings(key, value) VALUES(?,?) "
               "ON CONFLICT(key) DO UPDATE SET value=excluded.value", (key, str(value)))
    db.commit()


def site_locked():
    return get_setting("locked", "0") == "1"


def review_when(created):
    try:
        d = datetime.strptime(created[:10], "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return ""
    delta = (date.today() - d).days
    if delta <= 0:
        return "Today"
    if delta == 1:
        return "Yesterday"
    if delta < 7:
        return "This week"
    if delta < 31:
        return "This month"
    return "Some time ago"


def reviews_list():
    rows = get_db().execute("SELECT * FROM reviews ORDER BY id DESC").fetchall()
    return [{"id": r["id"], "name": r["name"], "body": r["body"],
             "stars": r["stars"], "when": review_when(r["created"])} for r in rows]


BLACK_PAGE = ('<!doctype html><html><head><meta charset="utf-8">'
              '<meta name="viewport" content="width=device-width,initial-scale=1">'
              '<title> </title></head>'
              '<body style="margin:0;height:100vh;background:#000"></body></html>')


@app.before_request
def _maintenance_gate():
    if request.path == "/812":
        return None
    if site_locked():
        return BLACK_PAGE


@app.route("/812", methods=["GET", "POST"])
def secret_812():
    if request.method == "POST":
        if LOCK_PASSWORD and hmac.compare_digest(request.form.get("p", ""), LOCK_PASSWORD):
            set_setting("locked", "0" if site_locked() else "1")
        return redirect("/812")
    return render_template("lock.html")


def slot_config():
    """(open_hour, close_hour, travel_buffer_minutes)."""
    return (int(get_setting("slot_start", 14)),
            int(get_setting("slot_end", 22)),
            int(get_setting("buffer", 30)))

def service_minutes(service):
    return SERVICES.get(service, {}).get("minutes", 60)

def is_available(d):
    return get_db().execute(
        "SELECT 1 FROM availability WHERE date=?", (d,)).fetchone() is not None

def _booked_intervals(d):
    """Existing bookings on date d as (start_min, duration_min)."""
    out = []
    for r in get_db().execute(
            "SELECT time, service FROM bookings WHERE date=?", (d,)).fetchall():
        if not r["time"]:
            continue
        try:
            h, m = map(int, r["time"].split(":"))
        except ValueError:
            continue
        out.append((h * 60 + m, service_minutes(r["service"])))
    return out

def available_starts(d, service):
    """Open 30-min start times for `service` on date `d`.

    Each existing booking reserves [start, start + duration + travel_buffer]
    (the job plus travel/reset time after it). A new appointment of the chosen
    duration is allowed at any 30-min start whose [start, start+duration] does
    not overlap a reserved block and finishes by closing time.
    """
    if not is_available(d):
        return []
    open_h, close_h, buf = slot_config()
    dur = service_minutes(service)
    open_m, close_m = open_h * 60, close_h * 60
    reserved = [(s, s + ed + buf) for s, ed in _booked_intervals(d)]
    out, t = [], open_m
    while t <= close_m:
        if all(t + dur <= rs or t >= re for rs, re in reserved):
            out.append(f"{t // 60:02d}:{t % 60:02d}")
        t += GRID_MINUTES
    cutoff = datetime.now() + timedelta(hours=LEAD_HOURS)
    out = [x for x in out
           if datetime.strptime(f"{d} {x}", "%Y-%m-%d %H:%M") >= cutoff]
    return out

def open_dates(service):
    """Available dates from today onward with at least one open slot for service."""
    today = date.today().isoformat()
    rows = get_db().execute(
        "SELECT date FROM availability WHERE date>=? ORDER BY date", (today,)).fetchall()
    return [r["date"] for r in rows if available_starts(r["date"], service)]

@app.route("/")
def index():
    gallery = get_db().execute("SELECT * FROM gallery ORDER BY id DESC").fetchall()
    return render_template("index.html", gallery=gallery, reviews=reviews_list())

def _svc_param():
    svc = request.args.get("service", "")
    return svc if svc in SERVICES else "exterior"

@app.route("/open-dates")
def open_dates_route():
    svc = _svc_param()
    today = date.today().isoformat()
    avail = [r["date"] for r in get_db().execute(
        "SELECT date FROM availability WHERE date>=? ORDER BY date", (today,)).fetchall()]
    open_ = [d for d in avail if available_starts(d, svc)]
    full = [d for d in avail if d not in open_]
    return {"ok": True, "dates": open_, "full": full}

@app.route("/slots")
def slots_route():
    return {"ok": True, "slots": available_starts(request.args.get("date", ""), _svc_param())}

@app.route("/services")
def services():
    return render_template("services.html", services=SERVICE_CARDS,
                           pricing=SERVICES, sizes=SIZES, bike_price=BIKE_PRICE)

@app.route("/about")
def about():
    return render_template("about.html")

@app.route("/contact")
def contact():
    return render_template("contact.html")

@app.route("/terms")
def terms():
    return render_template("terms.html")

@app.route("/book", methods=["GET", "POST"])
def book():
    if request.method == "POST":
        f = request.form
        service = f.get("service", "")
        size = f.get("size", "")
        slot_date = f.get("date", "").strip()
        slot_time = f.get("time", "").strip()
        price = price_for(service, size)

        errors = []
        if not f.get("name", "").strip():
            errors.append("Please enter your name.")
        if not f.get("phone", "").strip():
            errors.append("Please enter a phone number.")
        if not f.get("email", "").strip():
            errors.append("Please enter an email.")
        if price is None:
            errors.append("Please choose a valid service and car size.")
        if not slot_date or not slot_time:
            errors.append("Please choose an available date and time.")
        elif price is not None and slot_time not in available_starts(slot_date, service):
            errors.append("Sorry, that time slot is no longer available.")
        if not f.get("agree"):
            errors.append("Please agree to the terms & conditions to continue.")

        address = f.get("address", "").strip()
        dest = _geocode(address) if address else None
        if not address:
            errors.append("Please enter your address.")
        elif dest is None:
            errors.append("Please pick a valid address from the suggestions.")

        if errors:
            for e in errors:
                flash(e, "error")
            return render_template("book.html", services=SERVICES, sizes=SIZES,
                                   form=f), 400

        origin = _origin_coords()
        if origin and dest:
            miles = _driving_miles(origin, dest)
            travel = (round(miles * TRAVEL_RATE), round(miles, 1))
        else:
            travel = None
        travel_fee = travel[0] if travel else 0

        name = f["name"].strip()
        phone = f["phone"].strip()
        email = f["email"].strip().lower()
        car = f.get("car", "").strip()

        db = get_db()
        cur = db.execute(
            """INSERT INTO bookings
               (created, name, phone, email, address, car, size, service, info,
                price, travel_fee, date, time)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (datetime.now().strftime("%Y-%m-%d %H:%M"),
             name, phone, email, address, car,
             size, service, f.get("info", "").strip(), price, travel_fee,
             slot_date, slot_time),
        )
        db.execute(
            """INSERT INTO customers (created, name, email, phone, address, car)
               VALUES (?,?,?,?,?,?)
               ON CONFLICT(email) DO UPDATE SET
                 name=excluded.name, phone=excluded.phone,
                 address=CASE WHEN excluded.address!='' THEN excluded.address ELSE customers.address END,
                 car=CASE WHEN excluded.car!='' THEN excluded.car ELSE customers.car END""",
            (datetime.now().strftime("%Y-%m-%d %H:%M"), name, email, phone, address, car))
        db.commit()

        booking_row = db.execute("SELECT * FROM bookings WHERE id=?", (cur.lastrowid,)).fetchone()
        send_confirmation(booking_row)

        return render_template(
            "book.html", services=SERVICES, sizes=SIZES, booked={
                "name": name,
                "service": service_label(service, size),
                "size": SIZES[size]["label"],
                "price": price,
                "travel_fee": travel_fee,
                "miles": travel[1] if travel else None,
                "total": round(price + travel_fee, 2),
                "date": slot_date,
                "time": slot_time,
            })

    preset = {}
    qs = request.args.get("service", "")
    qz = request.args.get("size", "")
    if qz in SIZES:
        preset["size"] = qz
    if qs in SERVICES:
        preset["service"] = qs
    if preset.get("size") == "bike":
        preset["service"] = "full"
    return render_template("book.html", services=SERVICES, sizes=SIZES, form=preset)

@app.route("/quote-travel", methods=["POST"])
def quote_travel():
    """Public: estimate a travel fee for an address (no save)."""
    res = travel_fee_for(request.form.get("address", ""))
    if not res:
        return {"ok": False, "error": "Couldn't estimate travel for that address."}, 400
    return {"ok": True, "fee": res[0], "miles": res[1], "rate": TRAVEL_RATE}

@app.route("/address-suggest")
def address_suggest():
    """Public: live address suggestions for autocomplete."""
    return {"ok": True, "suggestions": address_suggestions(request.args.get("q", ""))}

@app.route("/admin", methods=["GET", "POST"])
def admin():
    if request.method == "POST":
        supplied = request.form.get("password", "")
        if ADMIN_PASSWORD and hmac.compare_digest(supplied, ADMIN_PASSWORD):
            session["admin"] = True
            return redirect(url_for("admin"))
        flash("Incorrect password.", "error")
        return render_template("admin_login.html"), 401

    if not session.get("admin"):
        return render_template("admin_login.html")

    db = get_db()
    rows = db.execute("SELECT * FROM bookings ORDER BY id DESC").fetchall()
    avail = [r["date"] for r in db.execute(
        "SELECT date FROM availability ORDER BY date").fetchall()]
    gallery = db.execute("SELECT * FROM gallery ORDER BY id DESC").fetchall()
    customers = db.execute("SELECT * FROM customers ORDER BY name COLLATE NOCASE").fetchall()
    cust_bookings = {
        cu["id"]: db.execute(
            "SELECT id, date, time, service, size, price, travel_fee FROM bookings "
            "WHERE email=? COLLATE NOCASE ORDER BY date DESC, time DESC", (cu["email"],)).fetchall()
        for cu in customers
    }
    start, end, buf = slot_config()
    return render_template(
        "admin.html", bookings=rows, services=SERVICES, sizes=SIZES,
        availability=avail, slot_start=start, slot_end=end, buffer=buf,
        gallery=gallery, customers=customers, cust_bookings=cust_bookings,
        reviews=reviews_list(), today=date.today().isoformat())

@app.route("/admin/logout")
def admin_logout():
    session.pop("admin", None)
    return redirect(url_for("admin"))

def _require_admin():
    return session.get("admin") is True

@app.route("/admin/availability/toggle", methods=["POST"])
def availability_toggle():
    if not _require_admin():
        return {"ok": False, "error": "Not authorized."}, 401
    d = (request.form.get("date") or "").strip()
    if not d:
        return {"ok": False, "error": "No date."}, 400
    db = get_db()
    if is_available(d):
        db.execute("DELETE FROM availability WHERE date=?", (d,))
        active = False
    else:
        db.execute("INSERT OR IGNORE INTO availability(date) VALUES(?)", (d,))
        active = True
    db.commit()
    return {"ok": True, "date": d, "active": active}

@app.route("/admin/availability/bulk", methods=["POST"])
def availability_bulk():
    if not _require_admin():
        return {"ok": False, "error": "Not authorized."}, 401
    dates = [d for d in (request.form.get("dates") or "").split(",") if d.strip()]
    active = request.form.get("active") == "1"
    db = get_db()
    for d in dates:
        if active:
            db.execute("INSERT OR IGNORE INTO availability(date) VALUES(?)", (d.strip(),))
        else:
            db.execute("DELETE FROM availability WHERE date=?", (d.strip(),))
    db.commit()
    return {"ok": True, "count": len(dates), "active": active}

@app.route("/admin/availability/hours", methods=["POST"])
def availability_hours():
    if not _require_admin():
        return {"ok": False, "error": "Not authorized."}, 401
    try:
        start = max(0, min(23, int(request.form.get("start", 14))))
        end = max(1, min(24, int(request.form.get("end", 22))))
        buf = int(request.form.get("buffer", 30))
    except ValueError:
        return {"ok": False, "error": "Invalid values."}, 400
    if end <= start:
        return {"ok": False, "error": "Closing time must be after opening time."}, 400
    if buf not in (0, 15, 30, 45, 60):
        buf = 30
    set_setting("slot_start", start)
    set_setting("slot_end", end)
    set_setting("buffer", buf)
    return {"ok": True, "start": start, "end": end, "buffer": buf}

@app.route("/admin/booking/<int:bid>/delete", methods=["POST"])
def booking_delete(bid):
    if not _require_admin():
        return {"ok": False, "error": "Not authorized."}, 401
    db = get_db()
    db.execute("DELETE FROM bookings WHERE id=?", (bid,))
    db.commit()
    return {"ok": True, "id": bid}

@app.route("/admin/booking/<int:bid>/update", methods=["POST"])
def booking_update(bid):
    if not _require_admin():
        return {"ok": False, "error": "Not authorized."}, 401
    f = request.form
    service = f.get("service", "")
    size = f.get("size", "")
    price = price_for(service, size)
    if price is None:
        return {"ok": False, "error": "Invalid service or size."}, 400

    db = get_db()
    if not db.execute("SELECT 1 FROM bookings WHERE id=?", (bid,)).fetchone():
        return {"ok": False, "error": "Booking not found."}, 404

    address = f.get("address", "").strip()
    travel = travel_fee_for(address) if address else None
    travel_fee = travel[0] if travel else 0

    db.execute(
        """UPDATE bookings SET name=?, phone=?, email=?, address=?, car=?,
           size=?, service=?, info=?, price=?, travel_fee=?, date=?, time=?
           WHERE id=?""",
        (f.get("name", "").strip(), f.get("phone", "").strip(),
         f.get("email", "").strip(), address, f.get("car", "").strip(),
         size, service, f.get("info", "").strip(), price, travel_fee,
         f.get("date", "").strip(), f.get("time", "").strip(), bid))
    db.commit()
    return {"ok": True, "id": bid}

@app.route("/admin/review", methods=["POST"])
def review_add():
    if not _require_admin():
        return redirect(url_for("admin"))
    name = request.form.get("name", "").strip()
    body = request.form.get("body", "").strip()
    try:
        stars = max(1, min(5, int(request.form.get("stars", 5))))
    except ValueError:
        stars = 5
    d = request.form.get("date", "").strip()
    try:
        created = datetime.strptime(d, "%Y-%m-%d").strftime("%Y-%m-%d %H:%M") if d \
            else datetime.now().strftime("%Y-%m-%d %H:%M")
    except ValueError:
        created = datetime.now().strftime("%Y-%m-%d %H:%M")
    if name and body:
        db = get_db()
        db.execute("INSERT INTO reviews(created, name, body, stars) VALUES(?,?,?,?)",
                   (created, name, body, stars))
        db.commit()
    else:
        flash("Please enter a name and review.", "error")
    return redirect(url_for("admin"))


@app.route("/admin/review/<int:rid>/delete", methods=["POST"])
def review_delete(rid):
    if not _require_admin():
        return {"ok": False, "error": "Not authorized."}, 401
    db = get_db()
    db.execute("DELETE FROM reviews WHERE id=?", (rid,))
    db.commit()
    return {"ok": True, "id": rid}


@app.route("/admin/customer/<int:cid>/update", methods=["POST"])
def customer_update(cid):
    if not _require_admin():
        return {"ok": False, "error": "Not authorized."}, 401
    f = request.form
    email = f.get("email", "").strip().lower()
    if not email:
        return {"ok": False, "error": "Email is required."}, 400
    db = get_db()
    if not db.execute("SELECT 1 FROM customers WHERE id=?", (cid,)).fetchone():
        return {"ok": False, "error": "Customer not found."}, 404
    try:
        db.execute(
            """UPDATE customers SET name=?, email=?, phone=?, address=?, car=?, notes=?
               WHERE id=?""",
            (f.get("name", "").strip(), email, f.get("phone", "").strip(),
             f.get("address", "").strip(), f.get("car", "").strip(),
             f.get("notes", "").strip(), cid))
        db.commit()
    except sqlite3.IntegrityError:
        return {"ok": False, "error": "Another customer already uses that email."}, 400
    return {"ok": True, "id": cid}

@app.route("/admin/customer/<int:cid>/delete", methods=["POST"])
def customer_delete(cid):
    if not _require_admin():
        return {"ok": False, "error": "Not authorized."}, 401
    db = get_db()
    db.execute("DELETE FROM customers WHERE id=?", (cid,))
    db.commit()
    return {"ok": True, "id": cid}

def _save_image(file):
    """Save an uploaded image with a random name; return the filename or None."""
    if not file or not file.filename:
        return None
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXT:
        return None
    name = uuid.uuid4().hex + ext
    file.save(os.path.join(UPLOAD_DIR, name))
    return name

@app.route("/admin/gallery", methods=["POST"])
def gallery_add():
    if not _require_admin():
        return redirect(url_for("admin"))
    before = _save_image(request.files.get("before"))
    after = _save_image(request.files.get("after"))
    if before and after:
        db = get_db()
        db.execute(
            "INSERT INTO gallery(created, title, before_img, after_img) VALUES(?,?,?,?)",
            (datetime.now().strftime("%Y-%m-%d %H:%M"),
             request.form.get("title", "").strip(), before, after))
        db.commit()
    else:
        for fn in (before, after):
            if fn:
                try:
                    os.remove(os.path.join(UPLOAD_DIR, fn))
                except OSError:
                    pass
        flash("Please upload both photos as JPG, PNG, or WEBP.", "error")
    return redirect(url_for("admin"))

@app.route("/admin/gallery/<int:gid>/delete", methods=["POST"])
def gallery_delete(gid):
    if not _require_admin():
        return {"ok": False, "error": "Not authorized."}, 401
    db = get_db()
    row = db.execute("SELECT before_img, after_img FROM gallery WHERE id=?", (gid,)).fetchone()
    if row:
        for fn in (row["before_img"], row["after_img"]):
            try:
                os.remove(os.path.join(UPLOAD_DIR, fn))
            except OSError:
                pass
        db.execute("DELETE FROM gallery WHERE id=?", (gid,))
        db.commit()
    return {"ok": True, "id": gid}

if __name__ == "__main__":
    if os.environ.get("WERKZEUG_RUN_MAIN") == "true":
        start_scheduler()
    app.run(host="0.0.0.0", debug=True, port=5000)
