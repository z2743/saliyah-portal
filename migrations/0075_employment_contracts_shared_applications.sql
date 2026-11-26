-- Remove invalid FK from employment_contracts.application_id; both human job_applications
-- and shared_service_applications are valid application sources.
-- Preserve existing contract IDs and payroll foreign key dependencies.
PRAGMA defer_foreign_keys=ON;
CREATE TABLE employment_contracts_new(
 id TEXT PRIMARY KEY,
 application_id TEXT NOT NULL UNIQUE,
 employee_id TEXT NOT NULL REFERENCES users(id),
 employer TEXT NOT NULL REFERENCES employer_budgets(employer),
 title TEXT NOT NULL,
 salary INTEGER NOT NULL CHECK(salary>=0),
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO employment_contracts_new(id,application_id,employee_id,employer,title,salary,active,created_at)
SELECT id,application_id,employee_id,employer,title,salary,active,created_at
FROM employment_contracts;
DROP TABLE employment_contracts;
ALTER TABLE employment_contracts_new RENAME TO employment_contracts;
CREATE INDEX IF NOT EXISTS idx_payroll_employee ON employment_contracts(employee_id,active);
CREATE TRIGGER IF NOT EXISTS employment_contract_application_guard
BEFORE INSERT ON employment_contracts
WHEN NOT EXISTS(SELECT 1 FROM job_applications WHERE id=NEW.application_id AND applicant_id=NEW.employee_id AND status='accepted')
 AND NOT EXISTS(SELECT 1 FROM shared_service_applications WHERE id=NEW.application_id AND service='jobs' AND applicant_id=NEW.employee_id AND status='accepted')
BEGIN SELECT RAISE(ABORT,'employment contract must refer to an accepted applicant'); END;
