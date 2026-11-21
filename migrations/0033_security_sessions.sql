-- Login attempt throttling, keyed by a SHA-256 digest of normalized username.
CREATE TABLE IF NOT EXISTS login_throttles (
 login_key TEXT PRIMARY KEY,
 failures INTEGER NOT NULL DEFAULT 0 CHECK(failures>=0),
 window_start TEXT NOT NULL,
 locked_until TEXT
);
CREATE INDEX IF NOT EXISTS idx_login_throttles_locked ON login_throttles(locked_until);
