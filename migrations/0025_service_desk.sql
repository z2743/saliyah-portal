-- Phase 25: service desk for all registered citizens.
CREATE TABLE service_tickets(id TEXT PRIMARY KEY,reference TEXT NOT NULL UNIQUE,user_id TEXT NOT NULL REFERENCES users(id),category TEXT NOT NULL CHECK(category IN ('technical','government','banking','other')),subject TEXT NOT NULL,description TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','reviewing','closed')),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX idx_service_tickets_owner ON service_tickets(user_id,created_at);
CREATE TABLE service_ticket_replies(id TEXT PRIMARY KEY,ticket_id TEXT NOT NULL REFERENCES service_tickets(id),author_id TEXT NOT NULL REFERENCES users(id),body TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX idx_service_replies_ticket ON service_ticket_replies(ticket_id,created_at);
