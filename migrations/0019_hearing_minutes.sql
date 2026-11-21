-- Phase 19: court hearing minutes (internal simulation only).
CREATE TABLE court_hearing_minutes (
 id TEXT PRIMARY KEY,
 hearing_id TEXT NOT NULL UNIQUE REFERENCES court_hearings(id),
 created_by TEXT NOT NULL REFERENCES users(id),
 summary TEXT NOT NULL,
 attendees TEXT NOT NULL,
 next_steps TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_court_minutes_created ON court_hearing_minutes(created_at);
