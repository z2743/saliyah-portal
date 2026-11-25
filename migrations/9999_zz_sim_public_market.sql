-- Human access to fictional bot businesses and citizens. All money is simulated.
-- These tables come after the 9999_z simulation indexes migration so all dependencies exist.
CREATE TABLE IF NOT EXISTS saliyah_sim_public_contacts(
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id),
 target_type TEXT NOT NULL CHECK(target_type IN ('citizens','companies','institutions','jobs','x','lawyers','properties')),
 target_id TEXT NOT NULL,
 message TEXT NOT NULL CHECK(length(message) BETWEEN 5 AND 1000),
 status TEXT NOT NULL DEFAULT 'pending_bot' CHECK(status IN ('pending_bot','replied')),
 bot_reply TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 replied_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_sim_public_contacts_user ON saliyah_sim_public_contacts(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sim_public_contacts_pending ON saliyah_sim_public_contacts(status,created_at) WHERE status='pending_bot';

CREATE TABLE IF NOT EXISTS saliyah_market_trades(
 id TEXT PRIMARY KEY,
 company_id TEXT NOT NULL REFERENCES saliyah_sim_companies(id),
 user_id TEXT NOT NULL REFERENCES users(id),
 user_account_id TEXT NOT NULL REFERENCES bank_accounts(id),
 bot_owner_id TEXT NOT NULL REFERENCES saliyah_sim_citizens(id),
 direction TEXT NOT NULL CHECK(direction IN ('buy','sell')),
 units INTEGER NOT NULL CHECK(units BETWEEN 1 AND 1000),
 unit_price INTEGER NOT NULL CHECK(unit_price BETWEEN 1 AND 100000000),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_saliyah_market_trades_user ON saliyah_market_trades(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saliyah_market_trades_company ON saliyah_market_trades(company_id,created_at DESC);

-- Every guard and balance/ownership mutation executes as ONE SQLite statement.
-- D1 never performs a cross-database "half transfer".
CREATE TRIGGER IF NOT EXISTS saliyah_market_trade_guard
BEFORE INSERT ON saliyah_market_trades
BEGIN
 SELECT CASE WHEN NOT EXISTS (
   SELECT 1 FROM saliyah_sim_companies WHERE id=NEW.company_id AND status='approved'
 ) THEN RAISE(ABORT,'market_company_unavailable') END;
 SELECT CASE WHEN NEW.unit_price<>(SELECT max(1,CAST(ROUND(capital/1000.0) AS INTEGER)) FROM saliyah_sim_companies WHERE id=NEW.company_id)
   THEN RAISE(ABORT,'market_price_changed') END;
 SELECT CASE WHEN NOT EXISTS (
   SELECT 1 FROM bank_accounts WHERE id=NEW.user_account_id AND user_id=NEW.user_id
 ) THEN RAISE(ABORT,'market_account_invalid') END;
 SELECT CASE WHEN NOT EXISTS (
   SELECT 1 FROM saliyah_sim_citizens WHERE id=NEW.bot_owner_id
 ) OR NOT EXISTS (
   SELECT 1 FROM saliyah_sim_bank_accounts
   WHERE owner_type='citizen' AND owner_id=NEW.bot_owner_id AND status='active'
 ) THEN RAISE(ABORT,'market_bot_unavailable') END;
 SELECT CASE WHEN NOT EXISTS (
   SELECT 1 FROM saliyah_sim_shares
   WHERE company_id=NEW.company_id AND owner_id=NEW.bot_owner_id
 ) THEN RAISE(ABORT,'market_bot_holding_missing') END;
 SELECT CASE WHEN NEW.direction='buy' AND NOT EXISTS (
   SELECT 1 FROM bank_accounts
   WHERE id=NEW.user_account_id AND user_id=NEW.user_id AND balance>=NEW.units*NEW.unit_price
 ) THEN RAISE(ABORT,'market_insufficient_funds') END;
 SELECT CASE WHEN NEW.direction='buy' AND NOT EXISTS (
   SELECT 1 FROM saliyah_sim_shares
   WHERE company_id=NEW.company_id AND owner_id=NEW.bot_owner_id AND units>=NEW.units
 ) THEN RAISE(ABORT,'market_insufficient_shares') END;
 SELECT CASE WHEN NEW.direction='sell' AND NOT EXISTS (
   SELECT 1 FROM saliyah_sim_shares
   WHERE company_id=NEW.company_id AND owner_id='human:'||NEW.user_id AND units>=NEW.units
 ) THEN RAISE(ABORT,'market_insufficient_shares') END;
 SELECT CASE WHEN NEW.direction='sell' AND NOT EXISTS (
   SELECT 1 FROM saliyah_sim_bank_accounts
   WHERE owner_type='citizen' AND owner_id=NEW.bot_owner_id AND status='active' AND balance>=NEW.units*NEW.unit_price
 ) THEN RAISE(ABORT,'market_bot_insufficient_funds') END;
END;

CREATE TRIGGER IF NOT EXISTS saliyah_market_trade_execute
AFTER INSERT ON saliyah_market_trades
BEGIN
 UPDATE bank_accounts
 SET balance=balance+CASE WHEN NEW.direction='buy' THEN -NEW.units*NEW.unit_price ELSE NEW.units*NEW.unit_price END
 WHERE id=NEW.user_account_id AND user_id=NEW.user_id;
 UPDATE saliyah_sim_bank_accounts
 SET balance=balance+CASE WHEN NEW.direction='buy' THEN NEW.units*NEW.unit_price ELSE -NEW.units*NEW.unit_price END
 WHERE owner_type='citizen' AND owner_id=NEW.bot_owner_id;
 UPDATE saliyah_sim_shares
 SET units=units+CASE WHEN NEW.direction='buy' THEN -NEW.units ELSE NEW.units END
 WHERE id=(SELECT id FROM saliyah_sim_shares WHERE company_id=NEW.company_id AND owner_id=NEW.bot_owner_id ORDER BY units DESC,id LIMIT 1);
 INSERT INTO saliyah_sim_shares(id,company_id,owner_id,units)
 SELECT 'human-market-'||NEW.company_id||'-'||NEW.user_id,NEW.company_id,'human:'||NEW.user_id,NEW.units
 WHERE NEW.direction='buy'
 ON CONFLICT(id) DO UPDATE SET units=units+excluded.units;
 UPDATE saliyah_sim_shares
 SET units=units-NEW.units
 WHERE NEW.direction='sell' AND company_id=NEW.company_id AND owner_id='human:'||NEW.user_id;
END;

-- Direct fictional payments from a real human account in the portal to a bot bank account.
CREATE TABLE IF NOT EXISTS saliyah_sim_public_payments(
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id),
 from_account_id TEXT NOT NULL REFERENCES bank_accounts(id),
 recipient_account_id TEXT NOT NULL REFERENCES saliyah_sim_bank_accounts(id),
 amount INTEGER NOT NULL CHECK(amount BETWEEN 1 AND 100000000),
 memo TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sim_public_payments_user ON saliyah_sim_public_payments(user_id,created_at DESC);
CREATE TRIGGER IF NOT EXISTS saliyah_sim_public_payment_guard
BEFORE INSERT ON saliyah_sim_public_payments
BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM bank_accounts WHERE id=NEW.from_account_id AND user_id=NEW.user_id AND balance>=NEW.amount)
   THEN RAISE(ABORT,'sim_payment_insufficient_funds') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM saliyah_sim_bank_accounts WHERE id=NEW.recipient_account_id AND status='active')
   THEN RAISE(ABORT,'sim_payment_recipient_missing') END;
END;
CREATE TRIGGER IF NOT EXISTS saliyah_sim_public_payment_apply
AFTER INSERT ON saliyah_sim_public_payments
BEGIN
 UPDATE bank_accounts SET balance=balance-NEW.amount WHERE id=NEW.from_account_id AND user_id=NEW.user_id;
 UPDATE saliyah_sim_bank_accounts SET balance=balance+NEW.amount WHERE id=NEW.recipient_account_id;
 INSERT INTO saliyah_sim_bank_transactions(id,account_id,kind,amount,description,related_account_id)
 VALUES('human-pay-'||NEW.id,NEW.recipient_account_id,'human_payment',NEW.amount,NEW.memo,NEW.from_account_id);
END;

-- Human residents can also buy listed properties that were offered by fictional citizens.
CREATE TABLE IF NOT EXISTS saliyah_sim_public_property_trades(
 id TEXT PRIMARY KEY,
 property_id TEXT NOT NULL UNIQUE REFERENCES saliyah_sim_properties(id),
 user_id TEXT NOT NULL REFERENCES users(id),
 user_account_id TEXT NOT NULL REFERENCES bank_accounts(id),
 seller_id TEXT NOT NULL REFERENCES saliyah_sim_citizens(id),
 price INTEGER NOT NULL CHECK(price>0),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sim_public_properties_user ON saliyah_sim_public_property_trades(user_id,created_at DESC);
CREATE TRIGGER IF NOT EXISTS saliyah_sim_public_property_guard
BEFORE INSERT ON saliyah_sim_public_property_trades
BEGIN
 SELECT CASE WHEN NOT EXISTS (
  SELECT 1 FROM saliyah_sim_properties WHERE id=NEW.property_id AND owner_id=NEW.seller_id AND status='listed' AND price=NEW.price
 ) THEN RAISE(ABORT,'sim_property_unavailable') END;
 SELECT CASE WHEN NOT EXISTS (
  SELECT 1 FROM bank_accounts WHERE id=NEW.user_account_id AND user_id=NEW.user_id AND balance>=NEW.price
 ) THEN RAISE(ABORT,'sim_property_insufficient_funds') END;
 SELECT CASE WHEN NOT EXISTS (
  SELECT 1 FROM saliyah_sim_bank_accounts WHERE owner_type='citizen' AND owner_id=NEW.seller_id AND status='active'
 ) THEN RAISE(ABORT,'sim_property_seller_account_missing') END;
END;
CREATE TRIGGER IF NOT EXISTS saliyah_sim_public_property_apply
AFTER INSERT ON saliyah_sim_public_property_trades
BEGIN
 UPDATE bank_accounts SET balance=balance-NEW.price WHERE id=NEW.user_account_id AND user_id=NEW.user_id;
 UPDATE saliyah_sim_bank_accounts SET balance=balance+NEW.price WHERE owner_type='citizen' AND owner_id=NEW.seller_id;
 UPDATE saliyah_sim_properties SET owner_id='human:'||NEW.user_id,status='owned',sold_at=CURRENT_TIMESTAMP WHERE id=NEW.property_id AND owner_id=NEW.seller_id AND status='listed';
 INSERT INTO saliyah_sim_property_trades(id,property_id,seller_id,buyer_id,price)
 VALUES('human-property-'||NEW.id,NEW.property_id,NEW.seller_id,'human:'||NEW.user_id,NEW.price);
END;
