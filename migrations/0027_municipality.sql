CREATE TABLE IF NOT EXISTS municipal_permits (
 id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id),business_name TEXT NOT NULL,activity TEXT NOT NULL,
 region TEXT NOT NULL CHECK(region IN ('السجادة','المتجار','عقار')),location TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','needs_changes','approved','rejected')),
 review_note TEXT,reviewer_id TEXT REFERENCES users(id),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_municipal_owner ON municipal_permits(owner_id,created_at);
CREATE TABLE IF NOT EXISTS municipal_inspections (
 id TEXT PRIMARY KEY,permit_id TEXT NOT NULL REFERENCES municipal_permits(id),inspector_id TEXT NOT NULL REFERENCES users(id),
 outcome TEXT NOT NULL CHECK(outcome IN ('passed','warning','failed')),notes TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_municipal_inspections ON municipal_inspections(permit_id,created_at);
