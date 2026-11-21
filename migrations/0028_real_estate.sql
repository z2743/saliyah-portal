-- Fictional land registry and transfer workflow.
CREATE TABLE IF NOT EXISTS land_parcels (id TEXT PRIMARY KEY, title TEXT NOT NULL, region TEXT NOT NULL CHECK(region IN ('السجادة','المتجار','عقار')), location TEXT NOT NULL, owner_id TEXT NOT NULL REFERENCES users(id), created_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS land_transfers (id TEXT PRIMARY KEY, parcel_id TEXT NOT NULL REFERENCES land_parcels(id), seller_id TEXT NOT NULL REFERENCES users(id), buyer_id TEXT NOT NULL REFERENCES users(id), status TEXT NOT NULL DEFAULT 'pending_buyer' CHECK(status IN ('pending_buyer','pending_registry','approved','rejected','cancelled')), note TEXT, reviewed_by TEXT REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, reviewed_at TEXT);
CREATE UNIQUE INDEX IF NOT EXISTS one_open_land_transfer ON land_transfers(parcel_id) WHERE status IN ('pending_buyer','pending_registry');
CREATE TRIGGER IF NOT EXISTS land_transfer_approve_guard BEFORE UPDATE OF status ON land_transfers WHEN NEW.status='approved' BEGIN
 SELECT CASE WHEN OLD.status!='pending_registry' OR NEW.reviewed_by IS NULL OR NOT EXISTS(SELECT 1 FROM land_parcels WHERE id=NEW.parcel_id AND owner_id=NEW.seller_id) THEN RAISE(ABORT,'Invalid transfer approval') END;
END;
CREATE TRIGGER IF NOT EXISTS land_transfer_apply AFTER UPDATE OF status ON land_transfers WHEN NEW.status='approved' BEGIN
 UPDATE land_parcels SET owner_id=NEW.buyer_id WHERE id=NEW.parcel_id AND owner_id=NEW.seller_id;
END;
