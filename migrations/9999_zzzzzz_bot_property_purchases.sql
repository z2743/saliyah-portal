-- Autonomous bot property purchases, same atomic balance and title checks as human purchases.
-- All amounts are simulated Riyals. Each sale is idempotent by property_id.
CREATE TABLE IF NOT EXISTS saliyah_sim_bot_property_purchases(
 id TEXT PRIMARY KEY,
 property_id TEXT NOT NULL UNIQUE REFERENCES saliyah_sim_properties(id),
 buyer_id TEXT NOT NULL REFERENCES saliyah_sim_citizens(id),
 buyer_account_id TEXT NOT NULL REFERENCES saliyah_sim_bank_accounts(id),
 seller_id TEXT NOT NULL REFERENCES saliyah_sim_citizens(id),
 price INTEGER NOT NULL CHECK(price>0),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sim_bot_property_buyer ON saliyah_sim_bot_property_purchases(buyer_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sim_bot_property_account_funds ON saliyah_sim_bank_accounts(owner_type,status,balance DESC);
CREATE TRIGGER IF NOT EXISTS saliyah_sim_bot_property_purchase_guard
BEFORE INSERT ON saliyah_sim_bot_property_purchases
BEGIN
 SELECT CASE WHEN NEW.buyer_id=NEW.seller_id THEN RAISE(ABORT,'bot_property_self_purchase') END;
 SELECT CASE WHEN NOT EXISTS (
  SELECT 1 FROM saliyah_sim_properties p
  WHERE p.id=NEW.property_id AND p.owner_id=NEW.seller_id
    AND p.status='listed' AND p.price=NEW.price
 ) THEN RAISE(ABORT,'bot_property_not_listed') END;
 SELECT CASE WHEN NOT EXISTS (
  SELECT 1 FROM saliyah_sim_bank_accounts a
  WHERE a.id=NEW.buyer_account_id AND a.owner_type='citizen'
    AND a.owner_id=NEW.buyer_id AND a.status='active' AND a.balance>=NEW.price
 ) THEN RAISE(ABORT,'bot_property_insufficient_funds') END;
 SELECT CASE WHEN NOT EXISTS (
  SELECT 1 FROM saliyah_sim_bank_accounts a
  WHERE a.owner_type='citizen' AND a.owner_id=NEW.seller_id AND a.status='active'
 ) THEN RAISE(ABORT,'bot_property_seller_account_missing') END;
END;
CREATE TRIGGER IF NOT EXISTS saliyah_sim_bot_property_purchase_apply
AFTER INSERT ON saliyah_sim_bot_property_purchases
BEGIN
 UPDATE saliyah_sim_bank_accounts SET balance=balance-NEW.price
 WHERE id=NEW.buyer_account_id AND owner_type='citizen' AND owner_id=NEW.buyer_id;
 UPDATE saliyah_sim_bank_accounts SET balance=balance+NEW.price
 WHERE owner_type='citizen' AND owner_id=NEW.seller_id;
 INSERT INTO saliyah_sim_bank_transactions(id,account_id,kind,amount,description,related_account_id)
 VALUES('bot-property-debit-'||NEW.id,NEW.buyer_account_id,'property_purchase',-NEW.price,
 'شراء عقار افتراضي '||NEW.property_id,
 (SELECT a.id FROM saliyah_sim_bank_accounts a WHERE a.owner_type='citizen' AND a.owner_id=NEW.seller_id));
 INSERT INTO saliyah_sim_bank_transactions(id,account_id,kind,amount,description,related_account_id)
 VALUES('bot-property-credit-'||NEW.id,
 (SELECT a.id FROM saliyah_sim_bank_accounts a WHERE a.owner_type='citizen' AND a.owner_id=NEW.seller_id),
 'property_sale',NEW.price,'بيع عقار افتراضي '||NEW.property_id,NEW.buyer_account_id);
 UPDATE saliyah_sim_properties SET owner_id=NEW.buyer_id,status='owned',sold_at=CURRENT_TIMESTAMP
 WHERE id=NEW.property_id AND owner_id=NEW.seller_id AND status='listed';
 INSERT INTO saliyah_sim_property_trades(id,property_id,seller_id,buyer_id,price)
 VALUES('bot-property-trade-'||NEW.id,NEW.property_id,NEW.seller_id,NEW.buyer_id,NEW.price);
END;
