-- Fictional corporate employment, consent, and atomic treasury-funded salary payments.
CREATE TABLE IF NOT EXISTS company_employees (
 id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES commerce_companies(id),
 employee_id TEXT NOT NULL REFERENCES users(id), position TEXT NOT NULL,
 salary INTEGER NOT NULL CHECK(salary BETWEEN 1 AND 1000000),
 status TEXT NOT NULL DEFAULT 'offered' CHECK(status IN ('offered','active','declined','ended')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 accepted_at TEXT, ended_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS company_employee_live ON company_employees(company_id,employee_id) WHERE status IN ('offered','active');
CREATE TABLE IF NOT EXISTS company_salary_payments (
 id TEXT PRIMARY KEY, employment_id TEXT NOT NULL REFERENCES company_employees(id),
 period TEXT NOT NULL CHECK(length(period)=7), amount INTEGER NOT NULL CHECK(amount BETWEEN 1 AND 1000000),
 actor_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(employment_id,period)
);
CREATE TRIGGER IF NOT EXISTS company_salary_guard BEFORE INSERT ON company_salary_payments BEGIN
 SELECT CASE WHEN NOT EXISTS (
 SELECT 1 FROM company_employees e JOIN commerce_companies c ON c.id=e.company_id
 JOIN company_treasuries t ON t.company_id=c.id JOIN bank_accounts a ON a.user_id=e.employee_id
 WHERE e.id=NEW.employment_id AND e.status='active' AND c.status='approved'
 AND c.owner_id=NEW.actor_id AND e.salary=NEW.amount AND t.balance>=NEW.amount
 ) THEN RAISE(ABORT,'Invalid salary payment or insufficient treasury balance') END;
 SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM bank_accounts WHERE user_id=(SELECT employee_id FROM company_employees WHERE id=NEW.employment_id)) THEN RAISE(ABORT,'Employee needs a bank account') END;
END;
CREATE TRIGGER IF NOT EXISTS company_salary_apply AFTER INSERT ON company_salary_payments BEGIN
 UPDATE company_treasuries SET balance=balance-NEW.amount WHERE company_id=(SELECT company_id FROM company_employees WHERE id=NEW.employment_id);
 UPDATE bank_accounts SET balance=balance+NEW.amount WHERE id=(SELECT id FROM bank_accounts WHERE user_id=(SELECT employee_id FROM company_employees WHERE id=NEW.employment_id) ORDER BY id LIMIT 1);
END;
