CREATE TABLE IF NOT EXISTS employment_resignations(
 id TEXT PRIMARY KEY,
 contract_id TEXT NOT NULL REFERENCES employment_contracts(id),
 employee_id TEXT NOT NULL REFERENCES users(id),
 reason TEXT NOT NULL CHECK(length(trim(reason))>=5),
 status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','deferred','accepted','withdrawn')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 defer_until TEXT,
 review_note TEXT,
 resolved_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_employment_resignation_employee ON employment_resignations(employee_id,created_at);
CREATE INDEX IF NOT EXISTS idx_employment_resignation_status ON employment_resignations(status,created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_employment_resignation_one_pending ON employment_resignations(contract_id) WHERE status IN ('submitted','deferred');
CREATE TRIGGER IF NOT EXISTS guard_employment_resignation_owner BEFORE INSERT ON employment_resignations
 WHEN NOT EXISTS(SELECT 1 FROM employment_contracts c WHERE c.id=NEW.contract_id AND c.employee_id=NEW.employee_id AND c.active=1)
 BEGIN SELECT RAISE(ABORT,'contract not active or employee mismatch'); END;
