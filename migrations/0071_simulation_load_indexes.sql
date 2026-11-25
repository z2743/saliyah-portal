-- Indexes for the existing simulated-citizen and event workloads.
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
