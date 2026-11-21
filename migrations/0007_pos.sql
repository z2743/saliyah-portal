-- POS operates only with fictional Saliyah Riyals; no real-world payment processing.
CREATE TABLE IF NOT EXISTS pos_merchants(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id),account_id TEXT NOT NULL REFERENCES bank_accounts(id),name TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS pos_payments(id TEXT PRIMARY KEY,merchant_id TEXT NOT NULL REFERENCES pos_merchants(id),customer_id TEXT NOT NULL REFERENCES users(id),amount INTEGER NOT NULL CHECK(amount>0),description TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','cancelled')),card_id TEXT REFERENCES bank_cards(id),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,paid_at TEXT);
CREATE INDEX IF NOT EXISTS idx_pos_customer ON pos_payments(customer_id,created_at);
CREATE INDEX IF NOT EXISTS idx_pos_merchant ON pos_payments(merchant_id,created_at);
CREATE TABLE IF NOT EXISTS pos_otps(id TEXT PRIMARY KEY,payment_id TEXT NOT NULL UNIQUE REFERENCES pos_payments(id),card_id TEXT NOT NULL REFERENCES bank_cards(id),code_hash TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,expires_at TEXT NOT NULL);
