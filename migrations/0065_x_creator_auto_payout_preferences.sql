-- A creator explicitly chooses a bank account before automatic payouts are enabled.
CREATE TABLE IF NOT EXISTS x_creator_payout_preferences(
 profile_id TEXT PRIMARY KEY REFERENCES x_profiles(id),
 user_id TEXT NOT NULL REFERENCES users(id),
 bank_account_id TEXT NOT NULL REFERENCES bank_accounts(id),
 enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TRIGGER IF NOT EXISTS x_creator_payout_preference_ownership
BEFORE INSERT ON x_creator_payout_preferences
WHEN NOT EXISTS(SELECT 1 FROM x_profiles p JOIN bank_accounts a ON a.user_id=p.user_id WHERE p.id=NEW.profile_id AND p.user_id=NEW.user_id AND p.kind='person' AND a.id=NEW.bank_account_id)
BEGIN SELECT RAISE(ABORT,'invalid creator payout account ownership'); END;
CREATE TRIGGER IF NOT EXISTS x_creator_payout_preference_update_ownership
BEFORE UPDATE ON x_creator_payout_preferences
WHEN NOT EXISTS(SELECT 1 FROM x_profiles p JOIN bank_accounts a ON a.user_id=p.user_id WHERE p.id=NEW.profile_id AND p.user_id=NEW.user_id AND p.kind='person' AND a.id=NEW.bank_account_id)
BEGIN SELECT RAISE(ABORT,'invalid creator payout account ownership'); END;
