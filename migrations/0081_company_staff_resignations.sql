CREATE TABLE IF NOT EXISTS company_staff_resignations(
 id TEXT PRIMARY KEY,
 employment_id TEXT NOT NULL REFERENCES company_employees(id),
 employee_id TEXT NOT NULL REFERENCES users(id),
 reason TEXT NOT NULL CHECK(length(trim(reason))>=5),
 status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','deferred','accepted','withdrawn')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 defer_until TEXT,
 reviewed_at TEXT,
 review_note TEXT
);
CREATE INDEX IF NOT EXISTS idx_company_resign_emp ON company_staff_resignations(employee_id,created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_company_resign_pending ON company_staff_resignations(employment_id) WHERE status IN ('submitted','deferred');
CREATE TRIGGER IF NOT EXISTS guard_company_resignation_owner BEFORE INSERT ON company_staff_resignations
 WHEN NOT EXISTS(SELECT 1 FROM company_employees WHERE id=NEW.employment_id AND employee_id=NEW.employee_id AND status='active')
 BEGIN SELECT RAISE(ABORT,'company employment must be active and owned'); END;
