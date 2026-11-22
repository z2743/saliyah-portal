CREATE TABLE IF NOT EXISTS service_suspensions (
 id TEXT PRIMARY KEY,
 case_id TEXT NOT NULL UNIQUE REFERENCES enforcement_cases(id),
 subject_user_id TEXT NOT NULL REFERENCES users(id),
 reason TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','lifted')),
 created_by TEXT NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 ended_at TEXT,
 ended_by TEXT REFERENCES users(id),
 lift_reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_service_suspensions_subject ON service_suspensions(subject_user_id,status);
