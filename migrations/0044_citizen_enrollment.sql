-- Citizen self-enrollment, optional contact numbers and one-time activation codes.
ALTER TABLE documents ADD COLUMN phone TEXT;
ALTER TABLE document_applications ADD COLUMN phone TEXT;
ALTER TABLE family_cards ADD COLUMN phone TEXT;
CREATE TABLE IF NOT EXISTS citizen_claims (
 id TEXT PRIMARY KEY,
 document_id TEXT NOT NULL UNIQUE REFERENCES documents(id),
 token_hash TEXT NOT NULL UNIQUE,
 expires_at TEXT NOT NULL,
 claimed_by TEXT REFERENCES users(id),
 claimed_at TEXT,
 created_by TEXT NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_citizen_claim_expiry ON citizen_claims(expires_at);
CREATE TABLE IF NOT EXISTS citizen_profiles (
 user_id TEXT PRIMARY KEY REFERENCES users(id),
 document_id TEXT NOT NULL UNIQUE REFERENCES documents(id),
 phone TEXT,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
