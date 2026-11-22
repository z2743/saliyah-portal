ALTER TABLE document_applications ADD COLUMN civil_intake_id TEXT;
CREATE INDEX IF NOT EXISTS idx_document_applications_civil ON document_applications(civil_intake_id,type,status);
