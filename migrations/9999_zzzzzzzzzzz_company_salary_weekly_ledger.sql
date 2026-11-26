-- Prior legacy installations constrain salary periods to YYYY-MM.
-- Rebuild the corporate salary ledger for ISO weekly period-start dates.
CREATE TABLE IF NOT EXISTS company_salary_payments_weekly(
 id TEXT PRIMARY KEY,
 employment_id TEXT NOT NULL REFERENCES company_employees(id),
 period TEXT NOT NULL CHECK(length(period)=10 AND period=date(period)),
 amount INTEGER NOT NULL CHECK(amount BETWEEN 1 AND 1000000),
 actor_id TEXT NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(employment_id,period)
);
INSERT OR IGNORE INTO company_salary_payments_weekly(id,employment_id,period,amount,actor_id,created_at)
 SELECT id,employment_id,
 CASE WHEN length(period)=7 THEN period||'-01' ELSE period END,
 amount,actor_id,created_at
 FROM company_salary_payments;
DROP TRIGGER IF EXISTS company_salary_guard;
DROP TRIGGER IF EXISTS company_salary_apply;
DROP TABLE company_salary_payments;
ALTER TABLE company_salary_payments_weekly RENAME TO company_salary_payments;
CREATE TRIGGER company_salary_guard BEFORE INSERT ON company_salary_payments BEGIN
 SELECT CASE WHEN NOT EXISTS(
  SELECT 1 FROM company_employees e JOIN commerce_companies c ON c.id=e.company_id
  JOIN company_treasuries t ON t.company_id=c.id JOIN bank_accounts a ON a.user_id=e.employee_id
  WHERE e.id=NEW.employment_id AND e.status='active' AND c.status='approved'
  AND c.owner_id=NEW.actor_id AND NEW.amount=e.salary*c.payroll_weeks
  AND t.balance>=NEW.amount AND NEW.period<=date('now')
 ) THEN RAISE(ABORT,'Invalid weekly salary or insufficient company funds') END;
END;
CREATE TRIGGER company_salary_apply AFTER INSERT ON company_salary_payments BEGIN
 UPDATE company_treasuries SET balance=balance-NEW.amount
 WHERE company_id=(SELECT company_id FROM company_employees WHERE id=NEW.employment_id);
 UPDATE bank_accounts SET balance=balance+NEW.amount WHERE id=(
  SELECT a.id FROM bank_accounts a WHERE a.user_id=(
   SELECT employee_id FROM company_employees WHERE id=NEW.employment_id)
  ORDER BY CASE a.bank WHEN 'saliyah' THEN 0 ELSE 1 END,a.id LIMIT 1
 );
END;
