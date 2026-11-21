CREATE TABLE IF NOT EXISTS health_clinics (id TEXT PRIMARY KEY,name TEXT NOT NULL,region TEXT NOT NULL,specialty TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS health_appointments (id TEXT PRIMARY KEY,clinic_id TEXT NOT NULL REFERENCES health_clinics(id),patient_id TEXT NOT NULL REFERENCES users(id),scheduled_at TEXT NOT NULL,reason TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'booked' CHECK(status IN ('booked','cancelled','completed','no_show')),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_health_patient ON health_appointments(patient_id,created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_health_slot ON health_appointments(clinic_id,scheduled_at) WHERE status='booked';
CREATE UNIQUE INDEX IF NOT EXISTS idx_health_patient_slot ON health_appointments(patient_id,scheduled_at) WHERE status='booked';
