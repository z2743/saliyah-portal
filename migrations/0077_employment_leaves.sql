CREATE TABLE IF NOT EXISTS employment_leave_requests(
 id TEXT PRIMARY KEY,
 contract_id TEXT NOT NULL REFERENCES employment_contracts(id),
 employee_id TEXT NOT NULL REFERENCES users(id),
 kind TEXT NOT NULL CHECK(kind IN ('annual','sick','unpaid','emergency')),
 start_date TEXT NOT NULL,
 end_date TEXT NOT NULL,
 reason TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','approved','rejected','cancelled')),
 review_note TEXT,
 reviewed_by TEXT REFERENCES users(id),
 reviewed_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK(start_date<=end_date)
);
CREATE INDEX IF NOT EXISTS idx_employment_leave_owner ON employment_leave_requests(employee_id,created_at);
CREATE INDEX IF NOT EXISTS idx_employment_leave_pending ON employment_leave_requests(status,created_at);
CREATE TRIGGER IF NOT EXISTS employment_leave_owner_guard BEFORE INSERT ON employment_leave_requests WHEN NOT EXISTS(SELECT 1 FROM employment_contracts c WHERE c.id=NEW.contract_id AND c.employee_id=NEW.employee_id AND c.active=1) BEGIN SELECT RAISE(ABORT,'employee contract inactive or not owned'); END;
