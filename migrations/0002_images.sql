-- Gallery photos stored in D1 (base64) instead of R2.
-- key matches gallery.before_img / gallery.after_img.
CREATE TABLE IF NOT EXISTS images (
  key          TEXT PRIMARY KEY,
  content_type TEXT NOT NULL,
  data         TEXT NOT NULL  -- base64-encoded image bytes
);
