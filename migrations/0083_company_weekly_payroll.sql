-- Corporate wages are weekly or every two weeks, paid atomically from the company treasury.
ALTER TABLE commerce_companies ADD COLUMN payroll_weeks INTEGER NOT NULL DEFAULT 1 CHECK(payroll_weeks IN (1,2));
DROP TRIGGER IF EXISTS company_salary_guard;
DROP TRIGGER IF EXISTS company_salary_apply;
CREATE TRIGGER company_salary_guard BEFORE INSERT ON company_salary_payments BEGIN
 SELECT CASE WHEN NOT EXISTS (
  SELECT 1 FROM company_employees e JOIN commerce_companies c ON c.id=e.company_id
  JOIN company_treasuries t ON t.company_id=c.id
  JOIN bank_accounts a ON a.user_id=e.employee_id
  WHERE e.id=NEW.employment_id AND e.status='active' AND c.status='approved'
   AND c.owner_id=NEW.actor_id AND NEW.amount=e.salary*c.payroll_weeks
   AND t.balance>=NEW.amount AND length(NEW.period)=10
   AND NEW.period<=date('now') AND NEW.period=date(NEW.period)
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
CREATE TABLE IF NOT EXISTS company_bot_salary_payments(
 id TEXT PRIMARY KEY,
 hire_id TEXT NOT NULL REFERENCES company_bot_hires(id),
 period_start TEXT NOT NULL,
 amount INTEGER NOT NULL CHECK(amount BETWEEN 1 AND 1000000),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(hire_id,period_start)
);
CREATE INDEX IF NOT EXISTS company_bot_salary_hire ON company_bot_salary_payments(hire_id,period_start);
CREATE TRIGGER IF NOT EXISTS company_bot_salary_guard BEFORE INSERT ON company_bot_salary_payments BEGIN
 SELECT CASE WHEN NOT EXISTS(
  SELECT 1 FROM company_bot_hires h
  JOIN commerce_companies c ON c.id=h.company_id
  JOIN company_treasuries t ON t.company_id=c.id
  JOIN saliyah_sim_bank_accounts a ON a.owner_type='citizen' AND a.owner_id=h.bot_id AND a.status='active'
  WHERE h.id=NEW.hire_id AND h.status='active' AND c.status='approved'
   AND NEW.amount=h.weekly_salary*c.payroll_weeks AND t.balance>=NEW.amount
   AND length(NEW.period_start)=10 AND NEW.period_start=date(NEW.period_start) AND NEW.period_start<=date('now')
 ) THEN RAISE(ABORT,'Invalid bot payroll or company treasury funds') END;
END;
CREATE TRIGGER IF NOT EXISTS company_bot_salary_apply AFTER INSERT ON company_bot_salary_payments BEGIN
 UPDATE company_treasuries SET balance=balance-NEW.amount
 WHERE company_id=(SELECT company_id FROM company_bot_hires WHERE id=NEW.hire_id);
 INSERT INTO saliyah_sim_bank_transactions(id,account_id,kind,amount,description)
 SELECT 'corporate-bot-wage-'||NEW.id,a.id,'salary_credit',NEW.amount,
  'راتب وظيفة في شركة حقيقية: '||NEW.period_start
 FROM company_bot_hires h JOIN saliyah_sim_bank_accounts a ON a.owner_type='citizen' AND a.owner_id=h.bot_id AND a.status='active'
 WHERE h.id=NEW.hire_id;
 UPDATE saliyah_sim_bank_accounts SET balance=balance+NEW.amount WHERE id=(
  SELECT a.id FROM company_bot_hires h JOIN saliyah_sim_bank_accounts a ON a.owner_type='citizen' AND a.owner_id=h.bot_id AND a.status='active'
  WHERE h.id=NEW.hire_id
 );
END;
