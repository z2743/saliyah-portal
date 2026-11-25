#!/usr/bin/env python3
"""Atomic autonomous property-purchase test. Offline SQLite, no real balances changed."""
import sqlite3
from pathlib import Path

db=sqlite3.connect(":memory:")
db.execute("PRAGMA foreign_keys=ON")
db.executescript("""
CREATE TABLE saliyah_sim_citizens(id TEXT PRIMARY KEY,name TEXT NOT NULL);
CREATE TABLE saliyah_sim_properties(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,kind TEXT,location TEXT,price INTEGER NOT NULL,status TEXT NOT NULL,sold_at TEXT);
CREATE TABLE saliyah_sim_bank_accounts(id TEXT PRIMARY KEY,owner_type TEXT NOT NULL,owner_id TEXT NOT NULL,account_number TEXT UNIQUE NOT NULL,bank_name TEXT NOT NULL,balance INTEGER NOT NULL CHECK(balance>=0),status TEXT NOT NULL,UNIQUE(owner_type,owner_id));
CREATE TABLE saliyah_sim_bank_transactions(id TEXT PRIMARY KEY,account_id TEXT NOT NULL,kind TEXT NOT NULL,amount INTEGER NOT NULL,description TEXT NOT NULL,related_account_id TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE saliyah_sim_property_trades(id TEXT PRIMARY KEY,property_id TEXT NOT NULL,seller_id TEXT NOT NULL,buyer_id TEXT NOT NULL,price INTEGER NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
INSERT INTO saliyah_sim_citizens VALUES('seller','البائع'),('buyer','المشتري'),('poor','المشتري قليل الرصيد');
INSERT INTO saliyah_sim_bank_accounts VALUES('seller-bank','citizen','seller','SIM-SELLER','البنك الصالي',10000,'active');
INSERT INTO saliyah_sim_bank_accounts VALUES('buyer-bank','citizen','buyer','SIM-BUYER','البنك الصالي',350000,'active');
INSERT INTO saliyah_sim_bank_accounts VALUES('poor-bank','citizen','poor','SIM-POOR','البنك الصالي',500,'active');
INSERT INTO saliyah_sim_properties VALUES('housing-a','seller','شقة','السجادة',250000,'listed',NULL);
INSERT INTO saliyah_sim_properties VALUES('housing-b','seller','فيلا','السجادة',200000,'listed',NULL);
""")
sql=(Path(__file__).parents[1]/"migrations"/"9999_zzzzzz_bot_property_purchases.sql").read_text(encoding="utf8")
db.executescript(sql)
def purchase(id,property_id,buyer_id,account,seller,price):
    db.execute("INSERT INTO saliyah_sim_bot_property_purchases(id,property_id,buyer_id,buyer_account_id,seller_id,price) VALUES(?,?,?,?,?,?)",(id,property_id,buyer_id,account,seller,price))
def balance(id):
    return db.execute("SELECT balance FROM saliyah_sim_bank_accounts WHERE id=?",(id,)).fetchone()[0]
def fails(*args):
    try: purchase(*args)
    except sqlite3.IntegrityError: return
    raise AssertionError("Guard failed for: "+str(args))
fails('a0','housing-a','poor','poor-bank','seller',250000)
fails('a1','housing-a','buyer','buyer-bank','buyer',250000)
fails('a2','housing-a','buyer','poor-bank','seller',250000)
fails('a3','housing-a','buyer','buyer-bank','seller',150000)
assert balance('buyer-bank')==350000 and balance('seller-bank')==10000
purchase('correct','housing-a','buyer','buyer-bank','seller',250000)
assert balance('buyer-bank')==100000
assert balance('seller-bank')==260000
assert db.execute("SELECT owner_id,status FROM saliyah_sim_properties WHERE id='housing-a'").fetchone()==('buyer','owned')
assert db.execute("SELECT COUNT(*),SUM(amount) FROM saliyah_sim_bank_transactions").fetchone()==(2,0)
assert db.execute("SELECT property_id,buyer_id,price FROM saliyah_sim_property_trades").fetchone()==('housing-a','buyer',250000)
fails('repeat','housing-a','poor','poor-bank','buyer',250000)
fails('other','housing-b','buyer','buyer-bank','seller',200000)
assert balance('buyer-bank')==100000 and balance('seller-bank')==260000
assert db.execute("SELECT status FROM saliyah_sim_properties WHERE id='housing-b'").fetchone()[0]=='listed'
assert db.execute("SELECT COUNT(*) FROM saliyah_sim_bot_property_purchases").fetchone()[0]==1
assert not db.execute("PRAGMA foreign_key_check").fetchall()
print('PASS bot property: buyer/seller balances, atomic ownership, two ledger records, no self-sale, insufficient funds, stale/duplicate sales')
