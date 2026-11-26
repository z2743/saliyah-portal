
-- Simulated airline treasury: charges and refunds are atomic in the primary D1.
CREATE TABLE IF NOT EXISTS aviation_treasury(
 airline_id TEXT PRIMARY KEY,
 balance INTEGER NOT NULL DEFAULT 0 CHECK(balance>=0)
);
INSERT OR IGNORE INTO aviation_treasury(airline_id,balance) VALUES('saliyah-airlines',0),('flyadeal-saliyah',0);
CREATE TABLE IF NOT EXISTS aviation_payment_ledger(
 booking_id TEXT PRIMARY KEY,
 airline_id TEXT NOT NULL REFERENCES aviation_treasury(airline_id),
 user_id TEXT NOT NULL REFERENCES users(id),
 bank_account_id TEXT NOT NULL REFERENCES bank_accounts(id),
 amount INTEGER NOT NULL CHECK(amount>0),
 status TEXT NOT NULL DEFAULT 'debited' CHECK(status IN ('debited','confirmed','refunded')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 confirmed_at TEXT,
 refunded_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_aviation_ledger_status ON aviation_payment_ledger(status,created_at);
CREATE TRIGGER IF NOT EXISTS aviation_payment_debit_guard BEFORE INSERT ON aviation_payment_ledger
 WHEN NOT EXISTS(SELECT 1 FROM bank_accounts a WHERE a.id=NEW.bank_account_id AND a.user_id=NEW.user_id AND a.balance>=NEW.amount)
 BEGIN SELECT RAISE(ABORT,'insufficient airline booking funds or account not owned'); END;
CREATE TRIGGER IF NOT EXISTS aviation_payment_debit_apply AFTER INSERT ON aviation_payment_ledger
 BEGIN
  UPDATE bank_accounts SET balance=balance-NEW.amount WHERE id=NEW.bank_account_id AND user_id=NEW.user_id AND balance>=NEW.amount;
  UPDATE aviation_treasury SET balance=balance+NEW.amount WHERE airline_id=NEW.airline_id;
 END;
CREATE TRIGGER IF NOT EXISTS aviation_payment_refund_apply AFTER UPDATE OF status ON aviation_payment_ledger
 WHEN OLD.status IN ('debited','confirmed') AND NEW.status='refunded'
 BEGIN
  UPDATE aviation_treasury SET balance=balance-NEW.amount WHERE airline_id=NEW.airline_id AND balance>=NEW.amount;
  UPDATE bank_accounts SET balance=balance+NEW.amount WHERE id=NEW.bank_account_id AND user_id=NEW.user_id;
 END;
