"""Standalone regression tests for corporate catalog and atomic weekly wages."""
import datetime
import pathlib
import sqlite3
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]


class CompanyOperationsTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.execute("PRAGMA foreign_keys=ON")
        self.db.executescript("""
          CREATE TABLE users(id TEXT PRIMARY KEY);
          CREATE TABLE commerce_companies(
            id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id),
            name TEXT, status TEXT
          );
          CREATE TABLE commerce_branches(
            id TEXT PRIMARY KEY, company_id TEXT REFERENCES commerce_companies(id),
            status TEXT
          );
          CREATE TABLE company_treasuries(
            company_id TEXT PRIMARY KEY REFERENCES commerce_companies(id),
            balance INTEGER NOT NULL DEFAULT 0 CHECK(balance>=0)
          );
          CREATE TABLE bank_accounts(
            id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), bank TEXT,
            balance INTEGER NOT NULL DEFAULT 0 CHECK(balance>=0)
          );
          CREATE TABLE saliyah_sim_citizens(id TEXT PRIMARY KEY,name TEXT NOT NULL);
          CREATE TABLE saliyah_sim_bank_accounts(
            id TEXT PRIMARY KEY, owner_type TEXT, owner_id TEXT,
            balance INTEGER NOT NULL DEFAULT 0 CHECK(balance>=0),status TEXT DEFAULT 'active'
          );
          CREATE TABLE saliyah_sim_bank_transactions(
            id TEXT PRIMARY KEY, account_id TEXT, kind TEXT, amount INTEGER,
            description TEXT, related_account_id TEXT
          );
          CREATE TABLE company_employees(
            id TEXT PRIMARY KEY, company_id TEXT REFERENCES commerce_companies(id),
            employee_id TEXT REFERENCES users(id), salary INTEGER NOT NULL,
            status TEXT, accepted_at TEXT
          );
          CREATE TABLE company_salary_payments(
            id TEXT PRIMARY KEY, employment_id TEXT REFERENCES company_employees(id),
            period TEXT NOT NULL, amount INTEGER NOT NULL,
            actor_id TEXT REFERENCES users(id), UNIQUE(employment_id,period)
          );
        """)
        self.db.executescript((ROOT / "migrations/0082_company_operations.sql").read_text())
        self.db.executescript((ROOT / "migrations/0083_company_weekly_payroll.sql").read_text())
        self.db.executescript((ROOT / "migrations/0084_company_salary_weekly_ledger.sql").read_text())
        self.db.executemany("INSERT INTO users(id) VALUES(?)", [("owner",), ("buyer",), ("stranger",)])
        self.db.execute(
            "INSERT INTO commerce_companies(id,owner_id,name,status) VALUES('c1','owner','Test store','approved')"
        )
        self.db.execute("INSERT INTO company_treasuries(company_id,balance) VALUES('c1',500)")
        self.db.executemany(
            "INSERT INTO bank_accounts(id,user_id,bank,balance) VALUES(?,?,?,?)",
            [("a1","buyer","saliyah",1000),("a2","stranger","saliyah",1000)]
        )
        self.db.execute("INSERT INTO company_catalog(id,company_id,title,description,kind,price,stock) VALUES('p1','c1','Item','Description','product',100,3)")

    def scalar(self, sql):
        return self.db.execute(sql).fetchone()[0]

    def purchase(self, order, count, price, account="a1", buyer="buyer", product="p1"):
        self.db.execute(
            "INSERT INTO company_catalog_orders(id,catalog_id,buyer_id,bank_account_id,quantity,unit_price,total) VALUES(?,?,?,?,?,?,?)",
            (order,product,buyer,account,count,price,count*price)
        )

    def test_purchase_is_atomic_and_blocks_overdraft_inventory_tampering(self):
        self.purchase("order1",2,100)
        self.assertEqual(self.scalar("SELECT stock FROM company_catalog WHERE id='p1'"),1)
        self.assertEqual(self.scalar("SELECT balance FROM bank_accounts WHERE id='a1'"),800)
        self.assertEqual(self.scalar("SELECT balance FROM company_treasuries WHERE company_id='c1'"),700)
        for args in [("o2",2,100),("o3",1,1),("o4",1,100,"a2")]:
            with self.assertRaises(sqlite3.IntegrityError):
                self.purchase(*args)
        self.assertEqual(self.scalar("SELECT COUNT(*) FROM company_catalog_orders"),1)
        self.assertEqual(self.scalar("SELECT balance FROM bank_accounts WHERE id='a1'"),800)

    def test_branch_approval_required(self):
        self.db.execute("INSERT INTO commerce_branches(id,company_id,status) VALUES('b1','c1','pending')")
        self.db.execute("UPDATE company_catalog SET branch_id='b1' WHERE id='p1'")
        with self.assertRaises(sqlite3.IntegrityError):
            self.purchase("o2",1,100)
        self.db.execute("UPDATE commerce_branches SET status='approved' WHERE id='b1'")
        self.purchase("o2",1,100)
        self.assertEqual(self.scalar("SELECT stock FROM company_catalog WHERE id='p1'"),2)

    def test_bot_payroll_is_real_transfer_and_idempotent(self):
        self.db.execute("INSERT INTO saliyah_sim_citizens(id,name) VALUES('bot1','Test Bot')")
        self.db.execute("INSERT INTO saliyah_sim_bank_accounts(id,owner_type,owner_id,balance,status) VALUES('ba1','citizen','bot1',15,'active')")
        self.db.execute("INSERT INTO company_bot_hires(id,company_id,bot_id,position,weekly_salary) VALUES('hire1','c1','bot1','Sales',80)")
        date = (datetime.datetime.now(datetime.timezone.utc).date()-datetime.timedelta(days=7)).isoformat()
        self.db.execute("INSERT INTO company_bot_salary_payments(id,hire_id,period_start,amount) VALUES('w1','hire1',?,80)",(date,))
        self.assertEqual(self.scalar("SELECT balance FROM company_treasuries WHERE company_id='c1'"),420)
        self.assertEqual(self.scalar("SELECT balance FROM saliyah_sim_bank_accounts WHERE id='ba1'"),95)
        self.assertEqual(self.scalar("SELECT COUNT(*) FROM saliyah_sim_bank_transactions WHERE kind='salary_credit'"),1)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO company_bot_salary_payments(id,hire_id,period_start,amount) VALUES('w2','hire1',?,80)",(date,))
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO company_bot_salary_payments(id,hire_id,period_start,amount) VALUES('w3','hire1',?,800)",((datetime.datetime.now(datetime.timezone.utc).date()-datetime.timedelta(days=14)).isoformat(),))

    def test_human_payroll_is_treasury_funded(self):
        self.db.execute("INSERT INTO company_employees(id,company_id,employee_id,salary,status,accepted_at) VALUES('e1','c1','buyer',90,'active','2025-01-01')")
        period=(datetime.datetime.now(datetime.timezone.utc).date()-datetime.timedelta(days=7)).isoformat()
        self.db.execute("INSERT INTO company_salary_payments(id,employment_id,period,amount,actor_id) VALUES('sal1','e1',?,90,'owner')",(period,))
        self.assertEqual(self.scalar("SELECT balance FROM company_treasuries WHERE company_id='c1'"),410)
        self.assertEqual(self.scalar("SELECT balance FROM bank_accounts WHERE id='a1'"),1090)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO company_salary_payments(id,employment_id,period,amount,actor_id) VALUES('sal2','e1',?,90,'stranger')",(period,))
        self.assertEqual(self.scalar("SELECT COUNT(*) FROM company_salary_payments"),1)


if __name__ == "__main__":
    unittest.main()
