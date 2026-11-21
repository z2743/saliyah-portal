-- Branches of approved fictional companies, with independent registry review.
CREATE TABLE IF NOT EXISTS commerce_branches (
 id TEXT PRIMARY KEY,
 company_id TEXT NOT NULL REFERENCES commerce_companies(id),
 name TEXT NOT NULL,
 region TEXT NOT NULL CHECK(region IN ('السجادة','المتجار','عقار')),
 address TEXT NOT NULL,
 permit_id TEXT REFERENCES municipal_permits(id),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 review_note TEXT,
 reviewer_id TEXT REFERENCES users(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 reviewed_at TEXT
);
CREATE INDEX IF NOT EXISTS commerce_branch_company_idx ON commerce_branches(company_id,created_at);
CREATE UNIQUE INDEX IF NOT EXISTS commerce_branch_unique_name ON commerce_branches(company_id,name) WHERE status IN ('pending','approved');
CREATE TRIGGER IF NOT EXISTS commerce_branch_insert_guard BEFORE INSERT ON commerce_branches BEGIN
 SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM commerce_companies c WHERE c.id=NEW.company_id AND c.status='approved') THEN RAISE(ABORT,'Company must be approved') END;
 SELECT CASE WHEN NEW.permit_id IS NOT NULL AND NOT EXISTS (
 SELECT 1 FROM municipal_permits p JOIN commerce_companies c ON c.owner_id=p.owner_id
 WHERE c.id=NEW.company_id AND p.id=NEW.permit_id AND p.region=NEW.region AND p.status='approved'
 ) THEN RAISE(ABORT,'Invalid branch permit') END;
END;
CREATE TRIGGER IF NOT EXISTS commerce_branch_approval_guard BEFORE UPDATE OF status ON commerce_branches WHEN NEW.status='approved' BEGIN
 SELECT CASE WHEN OLD.status!='pending' OR NEW.reviewer_id IS NULL OR NOT EXISTS (
 SELECT 1 FROM commerce_companies c WHERE c.id=NEW.company_id AND c.status='approved' AND c.owner_id!=NEW.reviewer_id
 ) THEN RAISE(ABORT,'Invalid branch approval') END;
 SELECT CASE WHEN NEW.permit_id IS NOT NULL AND NOT EXISTS (
 SELECT 1 FROM municipal_permits p JOIN commerce_companies c ON c.owner_id=p.owner_id
 WHERE c.id=NEW.company_id AND p.id=NEW.permit_id AND p.region=NEW.region AND p.status='approved'
 ) THEN RAISE(ABORT,'Invalid branch permit') END;
END;
