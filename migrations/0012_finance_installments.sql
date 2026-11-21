-- Bank adjustments: internal simulation only. Negative balances explicitly permitted.
DROP TRIGGER IF EXISTS bank_prevent_overdraft;
-- Recreate accounts table to remove the legacy CHECK(balance>=0) constraint.
PRAGMA foreign_keys=OFF;
CREATE TABLE bank_accounts_new(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),bank TEXT NOT NULL CHECK(bank IN ('saliyah','national','development')),balance INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(user_id,bank));
INSERT INTO bank_accounts_new SELECT id,user_id,bank,balance,created_at FROM bank_accounts;
DROP TABLE bank_accounts;
ALTER TABLE bank_accounts_new RENAME TO bank_accounts;
PRAGMA foreign_keys=ON;
CREATE TABLE bank_adjustments(id TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES bank_accounts(id),actor_id TEXT NOT NULL REFERENCES users(id),mode TEXT NOT NULL CHECK(mode IN ('set','add','subtract')),amount INTEGER NOT NULL,previous_balance INTEGER NOT NULL,new_balance INTEGER NOT NULL,reason TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX idx_bank_adjustments_account ON bank_adjustments(account_id,created_at);
CREATE TABLE installment_plans(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),provider TEXT NOT NULL CHECK(provider IN ('tabby','tamara')),merchant TEXT NOT NULL,amount INTEGER NOT NULL CHECK(amount>0),status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','paid','cancelled')),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE installment_dues(id TEXT PRIMARY KEY,plan_id TEXT NOT NULL REFERENCES installment_plans(id),installment_number INTEGER NOT NULL,amount INTEGER NOT NULL CHECK(amount>0),due_date TEXT NOT NULL,paid_at TEXT,paid_from TEXT REFERENCES bank_accounts(id),UNIQUE(plan_id,installment_number));
CREATE TABLE installment_payments(id TEXT PRIMARY KEY,due_id TEXT NOT NULL UNIQUE REFERENCES installment_dues(id),bank_account_id TEXT NOT NULL REFERENCES bank_accounts(id),amount INTEGER NOT NULL CHECK(amount>0),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
