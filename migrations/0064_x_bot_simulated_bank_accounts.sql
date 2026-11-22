-- Fictional X bot accounts; never linked to real user bank balances.
CREATE TABLE IF NOT EXISTS x_bot_bank_accounts(
 profile_id TEXT PRIMARY KEY REFERENCES x_profiles(id) ON DELETE CASCADE,
 account_number TEXT NOT NULL UNIQUE,
 bank_name TEXT NOT NULL DEFAULT 'البنك الوطني الصالي (محاكاة)',
 balance INTEGER NOT NULL DEFAULT 0 CHECK(balance>=0),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO x_bot_bank_accounts(profile_id,account_number,balance)
SELECT id,'XBOT-'||substr(id,11),0 FROM x_profiles WHERE kind='bot';
CREATE TRIGGER IF NOT EXISTS x_bot_bank_account_seed
AFTER INSERT ON x_profiles WHEN NEW.kind='bot'
BEGIN
 INSERT OR IGNORE INTO x_bot_bank_accounts(profile_id,account_number,balance)
 VALUES(NEW.id,'XBOT-'||substr(NEW.id,11),0);
END;
