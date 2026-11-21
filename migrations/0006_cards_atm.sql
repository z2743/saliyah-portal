-- Fictional internal bank cards and cash balances; no real card networks.
CREATE TABLE IF NOT EXISTS bank_cards(id TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES bank_accounts(id),last4 TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','frozen')),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_cards_account ON bank_cards(account_id);
CREATE TABLE IF NOT EXISTS cash_wallets(user_id TEXT PRIMARY KEY REFERENCES users(id),balance INTEGER NOT NULL DEFAULT 0 CHECK(balance>=0));
CREATE TABLE IF NOT EXISTS atm_operations(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),account_id TEXT NOT NULL REFERENCES bank_accounts(id),kind TEXT NOT NULL CHECK(kind IN ('withdraw','deposit')),amount INTEGER NOT NULL CHECK(amount>0),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_atm_user ON atm_operations(user_id,created_at);
