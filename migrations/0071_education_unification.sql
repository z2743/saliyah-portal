-- Canonical education catalogs and the shared application table used by multiple services.
-- Safe for existing D1 data; does not delete academic records.
CREATE TABLE IF NOT EXISTS shared_service_applications(
 id TEXT PRIMARY KEY,
 service TEXT NOT NULL CHECK(service IN ('jobs','education')),
 target_id TEXT NOT NULL,
 applicant_id TEXT NOT NULL REFERENCES users(id),
 statement TEXT,
 previous_grade REAL,
 status TEXT NOT NULL DEFAULT 'submitted',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(service,target_id,applicant_id)
);
CREATE INDEX IF NOT EXISTS shared_service_applications_lookup ON shared_service_applications(service,target_id,status);
-- Realistic private school fees are configurable; raise only the previous default fees.
UPDATE education_institutions SET fee=CASE level WHEN 'primary' THEN 18000 WHEN 'middle' THEN 22000 WHEN 'secondary' THEN 26000 ELSE fee END WHERE sector='private' AND ((level='primary' AND fee=15000) OR (level='middle' AND fee=17000) OR (level='secondary' AND fee=21000));
UPDATE saliyah_sim_education_details SET tuition=CASE level WHEN 'primary' THEN 18000 WHEN 'middle' THEN 22000 WHEN 'secondary' THEN 26000 ELSE 22000 END WHERE sector='private' AND level IN ('primary','middle','secondary','all') AND tuition IN (15000,17000,21000);
