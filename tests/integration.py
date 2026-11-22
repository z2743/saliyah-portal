"""Offline SQLite regression checks. Does not replace Cloudflare D1/R2 end-to-end testing."""
import sqlite3
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

class PortalIntegration(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.db.execute('PRAGMA foreign_keys=ON')
        self.migrations = sorted((ROOT / 'migrations').glob('*.sql'))
        for migration in self.migrations:
            self.db.executescript(migration.read_text(encoding='utf-8'))
        self.db.execute("INSERT INTO users(id,username,password_hash,salt,role) VALUES('king','king','x','s','king'),('a','alice','x','s','citizen'),('b','bob','x','s','citizen')")
        self.db.execute("INSERT INTO bank_accounts(id,user_id,bank,balance) VALUES('a1','a','saliyah',100),('b1','b','saliyah',10)")
    def tearDown(self):
        self.db.close()
    def balance(self, account):
        return self.db.execute('SELECT balance FROM bank_accounts WHERE id=?',(account,)).fetchone()[0]
    def test_debt_collection_remits_to_king_once(self):
        self.db.execute("INSERT INTO bank_accounts(id,user_id,bank,balance) VALUES('king-national','king','national',0)")
        self.db.execute("INSERT INTO enforcement_cases_v2(id,subject_user_id,residency_number,amount,reason,ministry_id,created_by,status,action) VALUES('enf-debt','a','alice',40,'Debt test',1,'king','approved','debt')")
        self.db.execute("INSERT INTO debt_claims(id,case_id,subject_user_id,original_amount,remaining_amount,created_by) VALUES('claim1','enf-debt','a',40,40,'king')")
        self.db.execute("UPDATE bank_accounts SET balance=balance+25 WHERE id='a1'")
        self.assertEqual(self.balance('a1'),100)
        self.assertEqual(self.balance('king-national'),25)
        self.assertEqual(self.db.execute("SELECT remaining_amount FROM debt_claims WHERE id='claim1'").fetchone()[0],15)
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM debt_collections WHERE claim_id='claim1'").fetchone()[0],1)
        self.db.execute("UPDATE bank_accounts SET balance=balance+25 WHERE id='a1'")
        self.assertEqual(self.balance('a1'),110)
        self.assertEqual(self.balance('king-national'),40)
        self.assertEqual(self.db.execute("SELECT status FROM debt_claims WHERE id='claim1'").fetchone()[0],'paid')
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM debt_collections WHERE claim_id='claim1'").fetchone()[0],2)
    def test_uncapped_creator_reward_credits_once(self):
        self.db.execute("INSERT INTO x_profiles(id,user_id,handle,display_name) VALUES('profile-a','a','alice-test','Alice')")
        self.db.execute("INSERT INTO x_creator_payouts(id,profile_id,user_id,period,followers,likes,reposts,amount,bank_account_id) VALUES('reward1','profile-a','a','100',1000,10000,500,2500,'a1')")
        self.assertEqual(self.balance('a1'),2600)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO x_creator_payouts(id,profile_id,user_id,period,followers,likes,reposts,amount,bank_account_id) VALUES('reward2','profile-a','a','100',1000,10000,500,2500,'a1')")
        self.assertEqual(self.balance('a1'),2600)
    def test_migrations_are_complete(self):
        self.assertGreaterEqual(len(self.migrations), 35)
        self.assertEqual(self.db.execute('PRAGMA foreign_key_check').fetchall(), [])
    def test_transfer_atomic_success(self):
        self.db.execute("INSERT INTO bank_transfers(id,sender_account,recipient_account,amount) VALUES('t1','a1','b1',25)")
        self.assertEqual((self.balance('a1'),self.balance('b1')),(75,35))
    def test_transfer_rejects_overdraft_without_ledger(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO bank_transfers(id,sender_account,recipient_account,amount) VALUES('t1','a1','b1',101)")
        self.assertEqual((self.balance('a1'),self.balance('b1')),(100,10))
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM bank_transfers').fetchone()[0],0)
    def test_transfer_rejects_missing_recipient(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO bank_transfers(id,sender_account,recipient_account,amount) VALUES('t1','a1','missing',5)")
        self.assertEqual(self.balance('a1'),100)
    def test_transfer_rejects_same_account(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO bank_transfers(id,sender_account,recipient_account,amount) VALUES('t1','a1','a1',5)")
    def test_admin_adjustment_is_atomic_and_immutable(self):
        self.db.execute("INSERT INTO bank_adjustments(id,account_id,actor_id,mode,amount,previous_balance,new_balance,reason) VALUES('adj','a1','king','subtract',150,100,-50,'تصحيح إداري')")
        self.assertEqual(self.balance('a1'),-50)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE bank_adjustments SET reason='edited' WHERE id='adj'")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("DELETE FROM bank_adjustments WHERE id='adj'")
    def test_admin_adjustment_rejects_stale_balance(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO bank_adjustments(id,account_id,actor_id,mode,amount,previous_balance,new_balance,reason) VALUES('adj','a1','king','add',10,90,100,'تصحيح إداري')")
        self.assertEqual(self.balance('a1'),100)
    def test_admin_adjustment_rejects_bad_math(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO bank_adjustments(id,account_id,actor_id,mode,amount,previous_balance,new_balance,reason) VALUES('adj','a1','king','add',10,100,200,'تصحيح إداري')")
    def test_suspension_request_without_debt(self):
        self.db.execute("INSERT INTO enforcement_cases_v2(id,subject_user_id,document_id,residency_number,amount,reason,ministry_id,created_by,action) VALUES('case1','a',NULL,'alice',0,'طلب مراجعة إيقاف خدمات',1,'king','service_suspension')")
        row=self.db.execute("SELECT action,amount,status FROM enforcement_cases_v2 WHERE id='case1'").fetchone()
        self.assertEqual(row,('service_suspension',0,'pending'))
    def test_enforcement_rejects_zero_debt(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO enforcement_cases_v2(id,subject_user_id,document_id,residency_number,amount,reason,ministry_id,created_by,action) VALUES('case2','a',NULL,'alice',0,'مطالبة مالية غير صالحة',7,'king','debt')")
    def test_enforcement_supports_user_without_document(self):
        self.db.execute("INSERT INTO enforcement_cases_v2(id,subject_user_id,document_id,residency_number,amount,reason,ministry_id,created_by,action) VALUES('case3','b',NULL,'bob',25,'طلب مالي تجريبي',7,'king','debt')")
        self.assertEqual(self.db.execute("SELECT subject_user_id FROM enforcement_cases_v2 WHERE id='case3'").fetchone()[0],'b')
    def test_site_routes_exist(self):
        js=(ROOT/'public'/'app.js').read_text(encoding='utf-8')
        for route in ('readiness','security','courts','health','municipality','land','commerce','company-staff','service-desk'):
            with self.subTest(route=route): self.assertIn("part==='"+route+"'",js)

if __name__=='__main__':
    unittest.main(verbosity=2)
