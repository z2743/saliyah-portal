-- Internal simulation only: no real phone numbers, mobile networks or SMS delivery.
CREATE TABLE IF NOT EXISTS telecom_lines (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), number TEXT NOT NULL UNIQUE,
 carrier TEXT NOT NULL CHECK(carrier IN ('stc','zain')),
 plan_name TEXT, data_mb INTEGER NOT NULL DEFAULT 0 CHECK(data_mb>=0),
 data_remaining_mb INTEGER NOT NULL DEFAULT 0 CHECK(data_remaining_mb>=0),
 expires_at TEXT, status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_telecom_lines_user ON telecom_lines(user_id);
CREATE TABLE IF NOT EXISTS telecom_sms (
 id TEXT PRIMARY KEY, from_line_id TEXT NOT NULL REFERENCES telecom_lines(id),
 to_line_id TEXT NOT NULL REFERENCES telecom_lines(id),
 from_number TEXT NOT NULL, to_number TEXT NOT NULL,
 body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 500),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sms_from ON telecom_sms(from_line_id,created_at);
CREATE INDEX IF NOT EXISTS idx_sms_to ON telecom_sms(to_line_id,created_at);
