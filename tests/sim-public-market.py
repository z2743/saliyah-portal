"""Regression checks for human-to-bot market migrations. No production D1 writes."""
from pathlib import Path
import sqlite3

root = Path(__file__).resolve().parent.parent
db = sqlite3.connect(":memory:")
db.execute("PRAGMA foreign_keys=ON")
db.executescript("""
CREATE TABLE users(id TEXT PRIMARY KEY);
CREATE TABLE bank_accounts(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),balance INTEGER NOT NULL DEFAULT 0);
CREATE TABLE saliyah_sim_citizens(id TEXT PRIMARY KEY,name TEXT NOT NULL);
CREATE TABLE saliyah_sim_companies(id TEXT PRIMARY KEY,capital INTEGER NOT NULL,status TEXT NOT NULL);
CREATE TABLE saliyah_sim_bank_accounts(id TEXT PRIMARY KEY,owner_type TEXT NOT NULL,owner_id TEXT NOT NULL,account_number TEXT NOT NULL UNIQUE,balance INTEGER NOT NULL DEFAULT 0 CHECK(balance>=0),status TEXT NOT NULL DEFAULT 'active');
CREATE TABLE saliyah_sim_bank_transactions(id TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES saliyah_sim_bank_accounts(id),kind TEXT,amount INTEGER,description TEXT,related_account_id TEXT);
CREATE TABLE saliyah_sim_shares(id TEXT PRIMARY KEY,company_id TEXT NOT NULL,owner_id TEXT NOT NULL,units INTEGER NOT NULL CHECK(units>=0));
CREATE TABLE saliyah_sim_properties(id TEXT PRIMARY KEY,owner_id TEXT,kind TEXT,location TEXT,price INTEGER NOT NULL,status TEXT,sold_at TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE saliyah_sim_property_trades(id TEXT PRIMARY KEY,property_id TEXT,seller_id TEXT,buyer_id TEXT,price INTEGER,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
""")
db.executescript((root/"migrations/9999_zz_sim_public_market.sql").read_text(encoding="utf-8"))
db.executescript("""
INSERT INTO users(id) VALUES('human'),('someoneelse');
INSERT INTO bank_accounts(id,user_id,balance) VALUES('human-bank','human',5000),('foreign-bank','someoneelse',4000);
INSERT INTO saliyah_sim_citizens(id,name) VALUES('bot','أحمد الصالي');
INSERT INTO saliyah_sim_companies(id,capital,status) VALUES('company',10000,'approved');
INSERT INTO saliyah_sim_bank_accounts(id,owner_type,owner_id,account_number,balance) VALUES('bot-bank','citizen','bot','SIM-ACC-0001',2000);
INSERT INTO saliyah_sim_shares(id,company_id,owner_id,units) VALUES('bot-shares','company','bot',1000);
INSERT INTO saliyah_sim_properties(id,owner_id,kind,location,price,status) VALUES('prop','bot','شقة','السجادة',800,'listed');
""")

def scalar(sql, args=()):
    return db.execute(sql,args).fetchone()[0]

def must_fail(sql, args=()):
    before = (scalar("SELECT balance FROM bank_accounts WHERE id='human-bank'"),
              scalar("SELECT balance FROM saliyah_sim_bank_accounts WHERE id='bot-bank'"),
              scalar("SELECT units FROM saliyah_sim_shares WHERE id='bot-shares'"))
    try:
        db.execute(sql,args)
    except sqlite3.IntegrityError:
        assert before == (scalar("SELECT balance FROM bank_accounts WHERE id='human-bank'"),
                          scalar("SELECT balance FROM saliyah_sim_bank_accounts WHERE id='bot-bank'"),
                          scalar("SELECT units FROM saliyah_sim_shares WHERE id='bot-shares'"))
        return
    raise AssertionError("Invalid operation was accepted")

trade = "INSERT INTO saliyah_market_trades(id,company_id,user_id,user_account_id,bot_owner_id,direction,units,unit_price) VALUES(?,?,?,?,?,?,?,?)"
db.execute(trade,('buy1','company','human','human-bank','bot','buy',10,10))
assert scalar("SELECT balance FROM bank_accounts WHERE id='human-bank'")==4900
assert scalar("SELECT balance FROM saliyah_sim_bank_accounts WHERE id='bot-bank'")==2100
assert scalar("SELECT units FROM saliyah_sim_shares WHERE id='bot-shares'")==990
assert scalar("SELECT units FROM saliyah_sim_shares WHERE owner_id='human:human'")==10
db.execute(trade,('sell1','company','human','human-bank','bot','sell',4,10))
assert scalar("SELECT balance FROM bank_accounts WHERE id='human-bank'")==4940
assert scalar("SELECT balance FROM saliyah_sim_bank_accounts WHERE id='bot-bank'")==2060
assert scalar("SELECT units FROM saliyah_sim_shares WHERE owner_id='human:human'")==6
must_fail(trade,('bad-price','company','human','human-bank','bot','buy',1,1))
must_fail(trade,('bad-account','company','human','foreign-bank','bot','buy',1,10))
must_fail(trade,('bad-inventory','company','human','human-bank','bot','buy',1000,10))
must_fail(trade,('bad-cash','company','human','human-bank','bot','buy',600,10))
must_fail(trade,('bad-sell','company','human','human-bank','bot','sell',7,10))

payment = "INSERT INTO saliyah_sim_public_payments(id,user_id,from_account_id,recipient_account_id,amount,memo) VALUES(?,?,?,?,?,?)"
db.execute(payment,('pay1','human','human-bank','bot-bank',30,'خدمة'))
assert scalar("SELECT balance FROM bank_accounts WHERE id='human-bank'")==4910
assert scalar("SELECT balance FROM saliyah_sim_bank_accounts WHERE id='bot-bank'")==2090
assert scalar("SELECT amount FROM saliyah_sim_bank_transactions WHERE id='human-pay-pay1'")==30
must_fail(payment,('bad-pay','human','foreign-bank','bot-bank',10,'خطأ'))

property_trade = "INSERT INTO saliyah_sim_public_property_trades(id,property_id,user_id,user_account_id,seller_id,price) VALUES(?,?,?,?,?,?)"
db.execute(property_trade,('pt1','prop','human','human-bank','bot',800))
assert scalar("SELECT owner_id FROM saliyah_sim_properties WHERE id='prop'")=='human:human'
assert scalar("SELECT balance FROM bank_accounts WHERE id='human-bank'")==4110
assert scalar("SELECT balance FROM saliyah_sim_bank_accounts WHERE id='bot-bank'")==2890
must_fail(property_trade,('pt2','prop','human','human-bank','bot',800))

print("PASS public market atomicity, ownership, payment and insufficient funds")
