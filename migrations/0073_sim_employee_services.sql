-- Named fictional staff may decide eligible real citizen requests without impersonating user accounts.
CREATE TABLE IF NOT EXISTS saliyah_sim_employee_decisions (
 id TEXT PRIMARY KEY,
 employee_id TEXT NOT NULL REFERENCES saliyah_sim_citizens(id),
 service TEXT NOT NULL CHECK(service IN ('civil','document','education','jobs')),
 application_id TEXT NOT NULL,
 decision TEXT NOT NULL CHECK(decision IN ('approved','rejected','accepted')),
 details TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(service,application_id)
);
CREATE INDEX IF NOT EXISTS idx_sim_employee_decisions_date ON saliyah_sim_employee_decisions(created_at DESC);
