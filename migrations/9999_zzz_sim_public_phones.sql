-- Fictional internal telecom extensions for simulated citizens and organizations.
-- "SIM-..." is an in-portal extension, not a routable telephone number.
CREATE TABLE IF NOT EXISTS saliyah_sim_public_phones(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 target_type TEXT NOT NULL CHECK(target_type IN ('citizens','companies','institutions','x','lawyers')),
 target_id TEXT NOT NULL,
 phone_number TEXT UNIQUE,
 provider TEXT NOT NULL DEFAULT 'STC الصالية',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(target_type,target_id)
);
CREATE INDEX IF NOT EXISTS idx_sim_public_phones_type ON saliyah_sim_public_phones(target_type,target_id);
-- Legal bot roster may be created at runtime on older instances.
CREATE TABLE IF NOT EXISTS saliyah_sim_legal_bots(
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('lawyer','court_clerk')),
 active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS saliyah_sim_institutions(
 id TEXT PRIMARY KEY,
 project_id TEXT NOT NULL UNIQUE,
 name TEXT NOT NULL,
 kind TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'open',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO saliyah_sim_public_phones(target_type,target_id) SELECT 'citizens',id FROM saliyah_sim_citizens;
INSERT OR IGNORE INTO saliyah_sim_public_phones(target_type,target_id) SELECT 'companies',id FROM saliyah_sim_companies;
INSERT OR IGNORE INTO saliyah_sim_public_phones(target_type,target_id) SELECT 'institutions',id FROM saliyah_sim_institutions;
INSERT OR IGNORE INTO saliyah_sim_public_phones(target_type,target_id) SELECT 'x',id FROM x_profiles WHERE kind='bot';
INSERT OR IGNORE INTO saliyah_sim_public_phones(target_type,target_id) SELECT 'lawyers',id FROM saliyah_sim_legal_bots;
UPDATE saliyah_sim_public_phones SET phone_number='SIM-'||printf('%09d',id),provider=CASE WHEN id%3=0 THEN 'زين الصالية' ELSE 'STC الصالية' END WHERE phone_number IS NULL;

CREATE TRIGGER IF NOT EXISTS sim_phone_new_citizen AFTER INSERT ON saliyah_sim_citizens BEGIN
 INSERT OR IGNORE INTO saliyah_sim_public_phones(target_type,target_id) VALUES('citizens',NEW.id);
 UPDATE saliyah_sim_public_phones SET phone_number='SIM-'||printf('%09d',id),provider=CASE WHEN id%3=0 THEN 'زين الصالية' ELSE 'STC الصالية' END WHERE target_type='citizens' AND target_id=NEW.id AND phone_number IS NULL;
END;
CREATE TRIGGER IF NOT EXISTS sim_phone_new_company AFTER INSERT ON saliyah_sim_companies BEGIN
 INSERT OR IGNORE INTO saliyah_sim_public_phones(target_type,target_id) VALUES('companies',NEW.id);
 UPDATE saliyah_sim_public_phones SET phone_number='SIM-'||printf('%09d',id),provider=CASE WHEN id%3=0 THEN 'زين الصالية' ELSE 'STC الصالية' END WHERE target_type='companies' AND target_id=NEW.id AND phone_number IS NULL;
END;
CREATE TRIGGER IF NOT EXISTS sim_phone_new_institution AFTER INSERT ON saliyah_sim_institutions BEGIN
 INSERT OR IGNORE INTO saliyah_sim_public_phones(target_type,target_id) VALUES('institutions',NEW.id);
 UPDATE saliyah_sim_public_phones SET phone_number='SIM-'||printf('%09d',id),provider=CASE WHEN id%3=0 THEN 'زين الصالية' ELSE 'STC الصالية' END WHERE target_type='institutions' AND target_id=NEW.id AND phone_number IS NULL;
END;
CREATE TRIGGER IF NOT EXISTS sim_phone_new_x_bot AFTER INSERT ON x_profiles WHEN NEW.kind='bot' BEGIN
 INSERT OR IGNORE INTO saliyah_sim_public_phones(target_type,target_id) VALUES('x',NEW.id);
 UPDATE saliyah_sim_public_phones SET phone_number='SIM-'||printf('%09d',id),provider=CASE WHEN id%3=0 THEN 'زين الصالية' ELSE 'STC الصالية' END WHERE target_type='x' AND target_id=NEW.id AND phone_number IS NULL;
END;
CREATE TRIGGER IF NOT EXISTS sim_phone_new_lawyer AFTER INSERT ON saliyah_sim_legal_bots BEGIN
 INSERT OR IGNORE INTO saliyah_sim_public_phones(target_type,target_id) VALUES('lawyers',NEW.id);
 UPDATE saliyah_sim_public_phones SET phone_number='SIM-'||printf('%09d',id),provider=CASE WHEN id%3=0 THEN 'زين الصالية' ELSE 'STC الصالية' END WHERE target_type='lawyers' AND target_id=NEW.id AND phone_number IS NULL;
END;
