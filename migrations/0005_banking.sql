-- Internal simulated currency only. No real payment rails.
CREATE TABLE IF NOT EXISTS bank_accounts(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), bank TEXT NOT NULL CHECK(bank IN ('saliyah','national','development')), balance INTEGER NOT NULL DEFAULT 0 CHECK(balance>=0), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id,bank));
CREATE TABLE IF NOT EXISTS bank_transfers(id TEXT PRIMARY KEY, sender_account TEXT NOT NULL REFERENCES bank_accounts(id), recipient_account TEXT NOT NULL REFERENCES bank_accounts(id), amount INTEGER NOT NULL CHECK(amount>0), memo TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, CHECK(sender_account<>recipient_account));
CREATE INDEX IF NOT EXISTS idx_bank_transfers_sender ON bank_transfers(sender_account,created_at);
CREATE INDEX IF NOT EXISTS idx_bank_transfers_recipient ON bank_transfers(recipient_account,created_at);
CREATE TRIGGER IF NOT EXISTS bank_prevent_overdraft BEFORE UPDATE OF balance ON bank_accounts WHEN NEW.balance<0 BEGIN SELECT RAISE(ABORT,'insufficient_funds'); END;
