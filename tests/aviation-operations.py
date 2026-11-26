"""Smoke-test aviation D1 schemas and salary/resignation guardrails in SQLite."""
from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
def run_migration(connection, path):
    connection.executescript((ROOT / path).read_text(encoding="utf-8"))

a = sqlite3.connect(":memory:")
a.execute("PRAGMA foreign_keys=ON")
for filename in ["0001_preopening_operations.sql", "0002_fleet_operations.sql", "0003_booking_checkin.sql", "0004_staff_training.sql"]:
    run_migration(a, "migrations/aviation/" + filename)
assert a.execute("SELECT value FROM aviation_settings WHERE key='opening_authorized'").fetchone()[0] == "0"
assert a.execute("SELECT COUNT(*) FROM aviation_fleet").fetchone()[0] == 7
assert a.execute("SELECT SUM(fleet_size) FROM aviation_fleet").fetchone()[0] == 90
a.execute("INSERT INTO aviation_staff(id,name,category,qualified,status,training_score,training_completed_at,license_number) VALUES('s1','موظف افتراضي','atc',1,'active',81,CURRENT_TIMESTAMP,'S-001')")
try:
    a.execute("UPDATE aviation_staff SET training_score=20 WHERE id='s1'")
except sqlite3.IntegrityError:
    pass
assert a.execute("SELECT COUNT(*) FROM aviation_staff WHERE category='atc' AND qualified=1").fetchone()[0] == 1

b = sqlite3.connect(":memory:")
b.execute("PRAGMA foreign_keys=ON")
b.executescript("""
CREATE TABLE users(id TEXT PRIMARY KEY,role TEXT);
CREATE TABLE bank_accounts(id TEXT PRIMARY KEY,user_id TEXT,bank TEXT,balance INTEGER NOT NULL);
CREATE TABLE employer_budgets(employer TEXT PRIMARY KEY,sector TEXT,balance INTEGER);
CREATE TABLE employment_contracts(id TEXT PRIMARY KEY,application_id TEXT,employee_id TEXT,employer TEXT,title TEXT,salary INTEGER,active INTEGER DEFAULT 1,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE job_applications(id TEXT PRIMARY KEY,applicant_id TEXT,status TEXT);
CREATE TABLE shared_service_applications(id TEXT PRIMARY KEY,applicant_id TEXT,target_id TEXT,service TEXT,status TEXT);
CREATE TABLE saliyah_sim_jobs(id TEXT PRIMARY KEY,company_id TEXT,salary INTEGER);
CREATE TABLE saliyah_sim_companies(id TEXT PRIMARY KEY,status TEXT,payroll_weeks INTEGER);
CREATE TABLE saliyah_sim_bank_accounts(id TEXT PRIMARY KEY,owner_type TEXT,owner_id TEXT,balance INTEGER,status TEXT);
CREATE TABLE saliyah_sim_bank_transactions(id TEXT PRIMARY KEY,account_id TEXT,kind TEXT,amount INTEGER,description TEXT,related_account_id TEXT);
INSERT INTO users VALUES('employee','citizen'),('king','king');
INSERT INTO bank_accounts VALUES('acct','employee','saliyah',5000);
INSERT INTO employer_budgets VALUES('شركة صالية','private',0);
INSERT INTO shared_service_applications VALUES('a1','employee','j1','jobs','accepted');
INSERT INTO employment_contracts(id,application_id,employee_id,employer,title,salary,active) VALUES('c1','a1','employee','شركة صالية','محاسب',3200,1);
INSERT INTO saliyah_sim_companies VALUES('company1','approved',1);
INSERT INTO saliyah_sim_jobs VALUES('j1','company1',3200);
INSERT INTO saliyah_sim_bank_accounts VALUES('company_bank','company','company1',10000,'active');
""")
for filename in ["0076_employment_resignations.sql","0077_employment_leaves.sql","0078_aviation_payment_ledger.sql","0079_shared_company_salary_payments.sql"]:
    run_migration(b, "migrations/" + filename)
b.execute("INSERT INTO aviation_payment_ledger(booking_id,airline_id,user_id,bank_account_id,amount) VALUES('b1','saliyah-airlines','employee','acct',700)")
assert b.execute("SELECT balance FROM bank_accounts WHERE id='acct'").fetchone()[0] == 4300
assert b.execute("SELECT balance FROM aviation_treasury WHERE airline_id='saliyah-airlines'").fetchone()[0] == 700
try:
    b.execute("INSERT INTO aviation_payment_ledger(booking_id,airline_id,user_id,bank_account_id,amount) VALUES('b1','saliyah-airlines','employee','acct',700)")
    raise AssertionError("duplicate payment accepted")
except sqlite3.IntegrityError:
    pass
assert b.execute("SELECT balance FROM bank_accounts WHERE id='acct'").fetchone()[0] == 4300
b.execute("UPDATE aviation_payment_ledger SET status='refunded' WHERE booking_id='b1'")
assert b.execute("SELECT balance FROM bank_accounts WHERE id='acct'").fetchone()[0] == 5000
assert b.execute("SELECT balance FROM aviation_treasury WHERE airline_id='saliyah-airlines'").fetchone()[0] == 0
b.execute("INSERT INTO shared_company_salary_payments(id,contract_id,company_id,company_account_id,employee_account_id,period_start,amount) VALUES('salary1','c1','company1','company_bank','acct','2026-12-07',3200)")
assert b.execute("SELECT balance FROM bank_accounts WHERE id='acct'").fetchone()[0] == 8200
assert b.execute("SELECT balance FROM saliyah_sim_bank_accounts WHERE id='company_bank'").fetchone()[0] == 6800
b.execute("INSERT INTO employment_resignations(id,contract_id,employee_id,reason) VALUES('r1','c1','employee','أرغب في إنهاء العقد')")
try:
    b.execute("INSERT INTO employment_resignations(id,contract_id,employee_id,reason) VALUES('r2','c1','employee','محاولة ثانية')")
    raise AssertionError("duplicate pending resignation accepted")
except sqlite3.IntegrityError:
    pass
b.execute("INSERT INTO employment_leave_requests(id,contract_id,employee_id,kind,start_date,end_date,reason) VALUES('l1','c1','employee','annual','2026-12-10','2026-12-15','إجازة عائلية')")
assert b.execute("PRAGMA foreign_key_check").fetchall() == []
print("aviation, salary, resignation, and leave migration smoke checks passed")
