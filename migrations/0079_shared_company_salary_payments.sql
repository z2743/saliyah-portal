-- Salary transfer from bot-company simulated accounts to actual citizen bank accounts.
CREATE TABLE IF NOT EXISTS shared_company_salary_payments(
 id TEXT PRIMARY KEY,
 contract_id TEXT NOT NULL REFERENCES employment_contracts(id),
 company_id TEXT NOT NULL REFERENCES saliyah_sim_companies(id),
 company_account_id TEXT NOT NULL REFERENCES saliyah_sim_bank_accounts(id),
 employee_account_id TEXT NOT NULL REFERENCES bank_accounts(id),
 period_start TEXT NOT NULL,
 amount INTEGER NOT NULL CHECK(amount>0),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(contract_id,period_start)
);
CREATE INDEX IF NOT EXISTS idx_shared_salary_period ON shared_company_salary_payments(period_start);
CREATE TRIGGER IF NOT EXISTS shared_company_salary_guard BEFORE INSERT ON shared_company_salary_payments
 WHEN NOT EXISTS(
  SELECT 1 FROM employment_contracts c
  JOIN shared_service_applications a ON a.id=c.application_id AND a.status='accepted'
  JOIN saliyah_sim_jobs j ON j.id=a.target_id
  JOIN saliyah_sim_companies co ON co.id=j.company_id
  JOIN saliyah_sim_bank_accounts ca ON ca.id=NEW.company_account_id AND ca.owner_type='company' AND ca.owner_id=co.id AND ca.balance>=NEW.amount AND ca.status='active'
  JOIN bank_accounts ea ON ea.id=NEW.employee_account_id AND ea.user_id=c.employee_id
  WHERE c.id=NEW.contract_id AND c.active=1 AND co.id=NEW.company_id AND co.status='approved'
 )
 BEGIN SELECT RAISE(ABORT,'bot company salary invalid, unpaid, or insufficient funds'); END;
CREATE TRIGGER IF NOT EXISTS shared_company_salary_apply AFTER INSERT ON shared_company_salary_payments
 BEGIN
  INSERT INTO saliyah_sim_bank_transactions(id,account_id,kind,amount,description,related_account_id)
   VALUES('human-salary-'||NEW.id,NEW.company_account_id,'salary_debit',-NEW.amount,'راتب أسبوعي للموظف البشري '||NEW.period_start,NEW.employee_account_id);
  UPDATE saliyah_sim_bank_accounts SET balance=balance-NEW.amount WHERE id=NEW.company_account_id AND balance>=NEW.amount;
  UPDATE bank_accounts SET balance=balance+NEW.amount WHERE id=NEW.employee_account_id;
 END;
