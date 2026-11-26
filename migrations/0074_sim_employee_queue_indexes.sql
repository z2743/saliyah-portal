-- Speed up bounded employee queue scans without reading unrelated records.
CREATE INDEX IF NOT EXISTS idx_civil_intake_bot_queue ON civil_intake(status,created_at);
CREATE INDEX IF NOT EXISTS idx_document_applications_bot_queue ON document_applications(status,created_at);
CREATE INDEX IF NOT EXISTS idx_education_applications_bot_queue ON education_applications(status,created_at);
CREATE INDEX IF NOT EXISTS idx_shared_service_jobs_bot_queue ON shared_service_applications(service,status,created_at);
