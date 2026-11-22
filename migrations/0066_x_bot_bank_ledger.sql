-- Ledger records changes to fictional bot balances; no real funds are moved.
CREATE TABLE IF NOT EXISTS x_bot_bank_ledger(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 profile_id TEXT NOT NULL REFERENCES x_profiles(id),
 account_number TEXT NOT NULL,
 amount INTEGER NOT NULL CHECK(amount<>0),
 balance_after INTEGER NOT NULL CHECK(balance_after>=0),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_x_bot_bank_ledger_profile ON x_bot_bank_ledger(profile_id,id DESC);
CREATE TRIGGER IF NOT EXISTS x_bot_bank_ledger_record AFTER UPDATE OF balance ON x_bot_bank_accounts
WHEN NEW.balance<>OLD.balance
BEGIN
 INSERT INTO x_bot_bank_ledger(profile_id,account_number,amount,balance_after)
 VALUES(NEW.profile_id,NEW.account_number,NEW.balance-OLD.balance,NEW.balance);
END;
CREATE TRIGGER IF NOT EXISTS x_bot_bank_ledger_immutable_update
BEFORE UPDATE ON x_bot_bank_ledger BEGIN SELECT RAISE(ABORT,'immutable ledger'); END;
CREATE TRIGGER IF NOT EXISTS x_bot_bank_ledger_immutable_delete
BEFORE DELETE ON x_bot_bank_ledger BEGIN SELECT RAISE(ABORT,'immutable ledger'); END;
