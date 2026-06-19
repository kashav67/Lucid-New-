-- Lucid Detailing schema (ported 1:1 from the Flask SQLite app -> D1)

CREATE TABLE IF NOT EXISTS bookings (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  created    TEXT NOT NULL,
  name       TEXT NOT NULL,
  phone      TEXT NOT NULL,
  email      TEXT NOT NULL,
  address    TEXT,
  car        TEXT,
  size       TEXT NOT NULL,
  service    TEXT NOT NULL,
  info       TEXT,
  price      INTEGER NOT NULL,
  travel_fee REAL NOT NULL DEFAULT 0,
  date       TEXT,
  time       TEXT,
  reminded   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS customers (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  created TEXT,
  name    TEXT,
  email   TEXT UNIQUE,
  phone   TEXT,
  address TEXT,
  car     TEXT,
  notes   TEXT
);

CREATE TABLE IF NOT EXISTS availability (date TEXT PRIMARY KEY);

CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);

CREATE TABLE IF NOT EXISTS gallery (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  created    TEXT,
  title      TEXT,
  before_img TEXT NOT NULL,
  after_img  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reviews (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  created TEXT,
  name    TEXT,
  body    TEXT,
  stars   INTEGER NOT NULL DEFAULT 5
);

-- Seed default scheduling settings (matches Flask defaults)
INSERT OR IGNORE INTO settings(key, value) VALUES ('slot_start', '14');
INSERT OR IGNORE INTO settings(key, value) VALUES ('slot_end', '22');
INSERT OR IGNORE INTO settings(key, value) VALUES ('buffer', '30');
