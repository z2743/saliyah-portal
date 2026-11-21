CREATE TABLE IF NOT EXISTS staff_permissions (user_id TEXT NOT NULL REFERENCES users(id), permission TEXT NOT NULL, PRIMARY KEY(user_id,permission));
CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, sender_id TEXT REFERENCES users(id), recipient_id TEXT NOT NULL REFERENCES users(id), subject TEXT NOT NULL, body TEXT NOT NULL, read_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id,created_at);
CREATE TABLE IF NOT EXISTS request_history (id TEXT PRIMARY KEY, request_id TEXT NOT NULL REFERENCES requests(id), actor_id TEXT NOT NULL REFERENCES users(id), old_status TEXT NOT NULL, new_status TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
