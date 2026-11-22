-- One active claim per user prevents duplicate automatic collection.
CREATE TABLE IF NOT EXISTS debt_claims(
 id TEXT PRIMARY KEY,
 case_id TEXT NOT NULL UNIQUE REFERENCES enforcement_cases_v2(id),
 subject_user_id TEXT NOT NULL REFERENCES users(id),
 original_amount INTEGER NOT NULL CHECK(original_amount>0),
 remaining_amount INTEGER NOT NULL CHECK(remaining_amount>=0),
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','paid','cancelled')),
 created_by TEXT NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 settled_at TEXT,
 CHECK(remaining_amount<=original_amount)
);
CREATE UNIQUE INDEX IF NOT EXISTS debt_one_active_per_user ON debt_claims(subject_user_id) WHERE status='active';
CREATE TABLE IF NOT EXISTS debt_collections(
 id TEXT PRIMARY KEY,
 claim_id TEXT NOT NULL REFERENCES debt_claims(id),
 bank_account_id TEXT NOT NULL REFERENCES bank_accounts(id),
 amount INTEGER NOT NULL CHECK(amount>0),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS debt_collections_claim ON debt_collections(claim_id,created_at);
-- Collect only newly credited funds. Never overdraw the account.
CREATE TRIGGER IF NOT EXISTS debt_collect_on_credit AFTER UPDATE OF balance ON bank_accounts
WHEN NEW.balance>OLD.balance AND EXISTS(SELECT 1 FROM debt_claims WHERE subject_user_id=NEW.user_id AND status='active' AND remaining_amount>0)
BEGIN
 INSERT INTO debt_collections(id,claim_id,bank_account_id,amount)
 SELECT lower(hex(randomblob(16))),d.id,NEW.id,min(NEW.balance-OLD.balance,d.remaining_amount)
 FROM debt_claims d WHERE d.subject_user_id=NEW.user_id AND d.status='active' AND d.remaining_amount>0;
 UPDATE debt_claims SET remaining_amount=remaining_amount-(SELECT amount FROM debt_collections WHERE bank_account_id=NEW.id AND claim_id=debt_claims.id ORDER BY created_at DESC,rowid DESC LIMIT 1)
 WHERE subject_user_id=NEW.user_id AND status='active';
 UPDATE debt_claims SET status='paid',settled_at=CURRENT_TIMESTAMP WHERE subject_user_id=NEW.user_id AND status='active' AND remaining_amount=0;
 UPDATE bank_accounts SET balance=balance-(SELECT amount FROM debt_collections WHERE bank_account_id=NEW.id ORDER BY rowid DESC LIMIT 1) WHERE id=NEW.id;
END;
