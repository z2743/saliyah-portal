-- Fictional company registry with independent review and municipal permit linkage.
CREATE TABLE IF NOT EXISTS commerce_companies (
 id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), name TEXT NOT NULL,
 activity TEXT NOT NULL, region TEXT NOT NULL CHECK(region IN ('السجادة','المتجار','عقار')),
 permit_id TEXT REFERENCES municipal_permits(id), status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 review_note TEXT, reviewer_id TEXT REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 reviewed_at TEXT
);
CREATE INDEX IF NOT EXISTS commerce_owner_idx ON commerce_companies(owner_id,created_at);
CREATE UNIQUE INDEX IF NOT EXISTS commerce_active_name ON commerce_companies(name) WHERE status IN ('pending','approved');
CREATE TRIGGER IF NOT EXISTS commerce_approval_guard BEFORE UPDATE OF status ON commerce_companies
 WHEN NEW.status='approved' BEGIN
 SELECT CASE WHEN OLD.status!='pending' OR NEW.reviewer_id IS NULL OR NEW.reviewer_id=OLD.owner_id
 THEN RAISE(ABORT,'Invalid company approval') END;
 SELECT CASE WHEN NEW.permit_id IS NOT NULL AND NOT EXISTS (
 SELECT 1 FROM municipal_permits p WHERE p.id=NEW.permit_id AND p.owner_id=NEW.owner_id
 AND p.status='approved' AND p.region=NEW.region)
 THEN RAISE(ABORT,'Invalid linked municipal permit') END;
END;
