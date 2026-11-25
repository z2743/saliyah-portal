CREATE TABLE IF NOT EXISTS national_alert_history (id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL, severity TEXT NOT NULL, target TEXT NOT NULL, expires_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, cancelled INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS national_alert_history_updated ON national_alert_history(updated_at DESC);
INSERT OR IGNORE INTO national_alert_history(id,title,body,severity,target,expires_at,updated_at) SELECT 'legacy-'||updated_at,title,body,severity,'all',expires_at,updated_at FROM national_alert;
