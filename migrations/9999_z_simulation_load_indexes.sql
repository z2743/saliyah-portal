-- Indexes for the existing simulated-citizen and event workloads.
-- These were previously created at runtime; create them before indexing a fresh database.
CREATE TABLE IF NOT EXISTS saliyah_sim_enrollments(id TEXT PRIMARY KEY,citizen_id TEXT NOT NULL,institution_id TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'studying',enrolled_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(citizen_id,institution_id));
CREATE TABLE IF NOT EXISTS saliyah_sim_bank_accounts(id TEXT PRIMARY KEY,owner_type TEXT NOT NULL CHECK(owner_type IN ('citizen','company')),owner_id TEXT NOT NULL,account_number TEXT NOT NULL UNIQUE,bank_name TEXT NOT NULL,balance INTEGER NOT NULL DEFAULT 0 CHECK(balance>=0),status TEXT NOT NULL DEFAULT 'active',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(owner_type,owner_id));
CREATE TABLE IF NOT EXISTS saliyah_sim_bank_transactions(id TEXT PRIMARY KEY,account_id TEXT NOT NULL,kind TEXT NOT NULL,amount INTEGER NOT NULL,description TEXT NOT NULL,related_account_id TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(account_id) REFERENCES saliyah_sim_bank_accounts(id));

-- Safe on existing data; does not start the bots or alter records.
CREATE INDEX IF NOT EXISTS idx_sim_citizens_active_created ON saliyah_sim_citizens(created_at,id) WHERE occupation<>'متوفى';
CREATE INDEX IF NOT EXISTS idx_sim_life_events_citizen_kind ON saliyah_sim_life_events(citizen_id,kind);
CREATE INDEX IF NOT EXISTS idx_sim_life_events_created ON saliyah_sim_life_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sim_identities_status ON saliyah_sim_identities(status);
CREATE INDEX IF NOT EXISTS idx_sim_enrollments_citizen ON saliyah_sim_enrollments(citizen_id);
CREATE INDEX IF NOT EXISTS idx_sim_job_applications_job_status ON saliyah_sim_job_applications(job_id,status);
CREATE INDEX IF NOT EXISTS idx_sim_bank_owner ON saliyah_sim_bank_accounts(owner_type,owner_id);
CREATE INDEX IF NOT EXISTS idx_sim_transactions_created ON saliyah_sim_bank_transactions(created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_sim_citizens_created ON saliyah_sim_citizens(created_at DESC,id DESC);
