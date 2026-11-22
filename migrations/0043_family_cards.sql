CREATE TABLE IF NOT EXISTS family_cards (
 id TEXT PRIMARY KEY,
 number TEXT NOT NULL UNIQUE,
 father_name TEXT NOT NULL,
 mother_name TEXT NOT NULL,
 children_json TEXT NOT NULL DEFAULT '[]',
 issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 revision INTEGER NOT NULL DEFAULT 1,
 created_by TEXT NOT NULL REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS family_card_history (
 id TEXT PRIMARY KEY,
 family_id TEXT NOT NULL REFERENCES family_cards(id),
 action TEXT NOT NULL CHECK(action IN ('issue','renew')),
 previous_children_json TEXT,
 new_children_json TEXT NOT NULL,
 reason TEXT,
 actor_id TEXT NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
