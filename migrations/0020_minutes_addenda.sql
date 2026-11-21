-- Phase 20: append-only court hearing minutes corrections.
CREATE TABLE court_minutes_addenda (
 id TEXT PRIMARY KEY,
 minute_id TEXT NOT NULL REFERENCES court_hearing_minutes(id),
 created_by TEXT NOT NULL REFERENCES users(id),
 reason TEXT NOT NULL,
 correction TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_minutes_addenda_minute ON court_minutes_addenda(minute_id,created_at);
