ALTER TABLE civil_intake ADD COLUMN status TEXT NOT NULL DEFAULT 'recorded';
ALTER TABLE civil_intake ADD COLUMN review_note TEXT;
ALTER TABLE civil_intake ADD COLUMN decided_by TEXT;
ALTER TABLE civil_intake ADD COLUMN decided_at TEXT;
