-- Remove obsolete 500-riyal payout cap without replaying historical credits.
-- This table is not referenced by another foreign key in the current schema.
DROP TRIGGER IF EXISTS x_creator_payout_apply;
ALTER TABLE x_creator_payouts RENAME TO x_creator_payouts_legacy;
CREATE TABLE x_creator_payouts(
 id TEXT PRIMARY KEY,
 profile_id TEXT NOT NULL REFERENCES x_profiles(id),
 user_id TEXT NOT NULL REFERENCES users(id),
 period TEXT NOT NULL,
 followers INTEGER NOT NULL CHECK(followers>=0),
 likes INTEGER NOT NULL CHECK(likes>=0),
 reposts INTEGER NOT NULL CHECK(reposts>=0),
 amount INTEGER NOT NULL CHECK(amount>=0),
 bank_account_id TEXT NOT NULL REFERENCES bank_accounts(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(profile_id,period)
);
INSERT INTO x_creator_payouts(id,profile_id,user_id,period,followers,likes,reposts,amount,bank_account_id,created_at)
 SELECT id,profile_id,user_id,period,followers,likes,reposts,amount,bank_account_id,created_at
 FROM x_creator_payouts_legacy;
DROP TABLE x_creator_payouts_legacy;
CREATE INDEX IF NOT EXISTS idx_x_creator_payouts_user ON x_creator_payouts(user_id,created_at DESC);
CREATE TRIGGER x_creator_payout_apply AFTER INSERT ON x_creator_payouts
WHEN NEW.amount>0
BEGIN
 UPDATE bank_accounts SET balance=balance+NEW.amount
 WHERE id=NEW.bank_account_id AND user_id=NEW.user_id;
 SELECT CASE WHEN changes()!=1 THEN RAISE(ABORT,'creator payout account mismatch') END;
END;
