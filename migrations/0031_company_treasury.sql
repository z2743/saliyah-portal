-- Internal fictional corporate treasury, not a real banking service.
CREATE TABLE IF NOT EXISTS company_treasuries (
 company_id TEXT PRIMARY KEY REFERENCES commerce_companies(id),
 balance INTEGER NOT NULL DEFAULT 0 CHECK(balance>=0),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS company_treasury_movements (
 id TEXT PRIMARY KEY,
 company_id TEXT NOT NULL REFERENCES company_treasuries(company_id),
 personal_account_id TEXT NOT NULL REFERENCES bank_accounts(id),
 actor_id TEXT NOT NULL REFERENCES users(id),
 kind TEXT NOT NULL CHECK(kind IN ('fund','withdraw')),
 amount INTEGER NOT NULL CHECK(amount BETWEEN 1 AND 1000000),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS treasury_movements_company ON company_treasury_movements(company_id,created_at);
CREATE TRIGGER IF NOT EXISTS treasury_create_guard BEFORE INSERT ON company_treasuries BEGIN
 SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM commerce_companies WHERE id=NEW.company_id AND status='approved') THEN RAISE(ABORT,'Company not approved') END;
END;
CREATE TRIGGER IF NOT EXISTS treasury_move_guard BEFORE INSERT ON company_treasury_movements BEGIN
 SELECT CASE WHEN NOT EXISTS (
 SELECT 1 FROM commerce_companies c JOIN company_treasuries t ON t.company_id=c.id
 JOIN bank_accounts a ON a.id=NEW.personal_account_id
 WHERE c.id=NEW.company_id AND c.status='approved' AND c.owner_id=NEW.actor_id AND a.user_id=NEW.actor_id
 ) THEN RAISE(ABORT,'Unauthorized treasury movement') END;
 SELECT CASE WHEN NEW.kind='fund' AND (SELECT balance FROM bank_accounts WHERE id=NEW.personal_account_id)<NEW.amount THEN RAISE(ABORT,'Insufficient personal funds') END;
 SELECT CASE WHEN NEW.kind='withdraw' AND (SELECT balance FROM company_treasuries WHERE company_id=NEW.company_id)<NEW.amount THEN RAISE(ABORT,'Insufficient treasury funds') END;
END;
CREATE TRIGGER IF NOT EXISTS treasury_move_apply AFTER INSERT ON company_treasury_movements BEGIN
 UPDATE bank_accounts SET balance=balance+CASE WHEN NEW.kind='fund' THEN -NEW.amount ELSE NEW.amount END WHERE id=NEW.personal_account_id;
 UPDATE company_treasuries SET balance=balance+CASE WHEN NEW.kind='fund' THEN NEW.amount ELSE -NEW.amount END WHERE company_id=NEW.company_id;
END;
