-- Phase 21: private immutable court attachment metadata. File bytes live in private R2.
CREATE TABLE IF NOT EXISTS court_attachments (
 id TEXT PRIMARY KEY,
 case_id TEXT NOT NULL REFERENCES court_cases(id),
 uploaded_by TEXT NOT NULL REFERENCES users(id),
 title TEXT NOT NULL CHECK(length(title) BETWEEN 3 AND 160),
 filename TEXT NOT NULL CHECK(length(filename) BETWEEN 1 AND 180),
 mime_type TEXT NOT NULL CHECK(mime_type IN ('application/pdf','image/jpeg','image/png','image/webp')),
 byte_size INTEGER NOT NULL CHECK(byte_size BETWEEN 1 AND 5242880),
 object_key TEXT NOT NULL UNIQUE,
 sha256 TEXT NOT NULL CHECK(length(sha256)=64),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_court_attachments_case ON court_attachments(case_id,created_at);
