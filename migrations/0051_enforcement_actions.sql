ALTER TABLE enforcement_cases ADD COLUMN action TEXT NOT NULL DEFAULT 'debt' CHECK(action IN ('debt','service_suspension','both'));
