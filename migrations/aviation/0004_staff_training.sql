
-- Approved fictional bot workforce and verified training records.
ALTER TABLE aviation_staff ADD COLUMN sim_citizen_id TEXT;
ALTER TABLE aviation_staff ADD COLUMN qualified INTEGER NOT NULL DEFAULT 0 CHECK(qualified IN (0,1));
ALTER TABLE aviation_staff ADD COLUMN training_score INTEGER CHECK(training_score BETWEEN 0 AND 100);
ALTER TABLE aviation_staff ADD COLUMN training_completed_at TEXT;
ALTER TABLE aviation_staff ADD COLUMN license_number TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_aviation_staff_sim_identity ON aviation_staff(sim_citizen_id) WHERE sim_citizen_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_aviation_staff_license ON aviation_staff(license_number) WHERE license_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_aviation_staff_qualified_status ON aviation_staff(category,status,qualified);
CREATE TRIGGER IF NOT EXISTS aviation_staff_qualification_guard BEFORE UPDATE OF qualified,training_score,training_completed_at,license_number ON aviation_staff
 WHEN NEW.qualified=1 AND (NEW.training_score<70 OR NEW.training_score IS NULL OR NEW.training_completed_at IS NULL OR NEW.license_number IS NULL)
 BEGIN SELECT RAISE(ABORT,'validated simulation training required'); END;
CREATE TRIGGER IF NOT EXISTS aviation_staff_insert_qualification_guard BEFORE INSERT ON aviation_staff
 WHEN NEW.qualified=1 AND (NEW.training_score<70 OR NEW.training_score IS NULL OR NEW.training_completed_at IS NULL OR NEW.license_number IS NULL)
 BEGIN SELECT RAISE(ABORT,'validated simulated training required'); END;
