-- Allow one minister user to own several ministry offices.
CREATE TABLE ministry_accounts_new (ministry_id INTEGER PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
INSERT INTO ministry_accounts_new SELECT * FROM ministry_accounts;
DROP TABLE ministry_accounts;
ALTER TABLE ministry_accounts_new RENAME TO ministry_accounts;
CREATE INDEX idx_ministry_accounts_user ON ministry_accounts(user_id);
