-- Non-destructive catalog removal: hide products/services from the marketplace and
-- owner dashboard while retaining paid orders, invoice references and transaction audit.
ALTER TABLE company_catalog ADD COLUMN deleted_at TEXT;
CREATE INDEX IF NOT EXISTS company_catalog_visible_owner
 ON company_catalog(company_id,created_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS company_catalog_market_visible
 ON company_catalog(active,created_at) WHERE deleted_at IS NULL;
-- D1 guard: deleted items can never be purchased (even by a stale market page).
DROP TRIGGER IF EXISTS company_catalog_order_guard;
CREATE TRIGGER company_catalog_order_guard BEFORE INSERT ON company_catalog_orders BEGIN
 SELECT CASE WHEN NOT EXISTS (
  SELECT 1 FROM company_catalog p JOIN commerce_companies c ON c.id=p.company_id
  JOIN company_treasuries t ON t.company_id=c.id
  JOIN bank_accounts b ON b.id=NEW.bank_account_id
  WHERE p.id=NEW.catalog_id AND p.active=1 AND p.deleted_at IS NULL
    AND c.status='approved'
    AND (p.branch_id IS NULL OR EXISTS(SELECT 1 FROM commerce_branches br
      WHERE br.id=p.branch_id AND br.company_id=p.company_id AND br.status='approved'))
    AND p.price=NEW.unit_price AND (p.kind='service' OR p.stock>=NEW.quantity)
    AND b.user_id=NEW.buyer_id AND b.balance>=NEW.total
 ) THEN RAISE(ABORT,'Invalid order, deleted product or insufficient balance') END;
END;
CREATE TRIGGER IF NOT EXISTS company_catalog_prevent_deleted_reactivation
 BEFORE UPDATE OF active,deleted_at ON company_catalog
 WHEN OLD.deleted_at IS NOT NULL AND (NEW.active=1 OR NEW.deleted_at IS NULL)
 BEGIN SELECT RAISE(ABORT,'Deleted catalog item cannot be reactivated'); END;
