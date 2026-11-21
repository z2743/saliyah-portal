-- Phase 13: approval workflow, not an automatic transfer of funds.
CREATE TABLE state_budget_requests (
 id TEXT PRIMARY KEY, entity_name TEXT NOT NULL, entity_type TEXT NOT NULL CHECK(entity_type IN ('ministry','governorate')),
 fiscal_year INTEGER NOT NULL CHECK(fiscal_year BETWEEN 2026 AND 2100), amount INTEGER NOT NULL CHECK(amount>0 AND amount<=1000000000),
 justification TEXT NOT NULL, requested_by TEXT NOT NULL REFERENCES users(id),
 status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','finance_approved','finance_rejected','king_approved','king_rejected')),
 finance_by TEXT REFERENCES users(id), finance_note TEXT, finance_at TEXT,
 king_by TEXT REFERENCES users(id), king_note TEXT, king_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_state_budget_status ON state_budget_requests(status,created_at);
CREATE TABLE state_budget_events (
 id TEXT PRIMARY KEY, request_id TEXT NOT NULL REFERENCES state_budget_requests(id), actor_id TEXT NOT NULL REFERENCES users(id),
 previous_status TEXT, new_status TEXT NOT NULL, note TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
