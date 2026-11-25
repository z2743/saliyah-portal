"""End-to-end isolated SQLite tests for human/bot simulated exchanges (no remote D1 writes)."""
import pathlib
import sqlite3

root = pathlib.Path(__file__).resolve().parent.parent
conn = sqlite3.connect(":memory:")
conn.execute("PRAGMA foreign_keys=ON")
conn.executescript("""
CREATE TABLE users(id TEXT PRIMARY KEY);
CREATE TABLE bank_accounts(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),bank TEXT NOT NULL,balance INTEGER NOT NULL DEFAULT 0);
CREATE TABLE saliyah_sim_citizens(id TEXT PRIMARY KEY,name TEXT NOT NULL,occupation TEXT NOT NULL);
CREATE TABLE saliyah_sim_companies(id TEXT PRIMARY KEY,name TEXT NOT NULL,capital INTEGER NOT NULL,status TEXT NOT NULL);
CREATE TABLE saliyah_sim_bank_accounts(id TEXT PRIMARY KEY,owner_type TEXT NOT NULL,owner_id TEXT NOT NULL,account_number TEXT NOT NULL UNIQUE,balance INTEGER NOT NULL CHECK(balance>=0),status TEXT NOT NULL DEFAULT 'active');
CREATE TABLE saliyah_sim_bank_transactions(id TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES saliyah_sim_bank_accounts(id),kind TEXT NOT NULL,amount INTEGER NOT NULL,description TEXT,related_account_id TEXT);
CREATE TABLE saliyah_sim_shares(id TEXT PRIMARY KEY,company_id TEXT NOT NULL,owner_id TEXT NOT NULL,units INTEGER NOT NULL CHECK(units>=0));
CREATE TABLE saliyah_sim_properties(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,kind TEXT NOT NULL,location TEXT NOT NULL,price INTEGER NOT NULL,status TEXT NOT NULL,sold_at TEXT);
CREATE TABLE saliyah_sim_property_trades(id TEXT PRIMARY KEY,property_id TEXT NOT NULL,seller_id TEXT NOT NULL,buyer_id TEXT NOT NULL,price INTEGER NOT NULL);
""")
conn.executescript((root/"migrations/9999_zz_sim_public_market.sql").read_text(encoding="utf8"))
conn.executescript("""
INSERT INTO users VALUES('u1'),('u2');
INSERT INTO bank_accounts VALUES('bank1','u1','saliyah',1000),('bank2','u2','saliyah',1000);
INSERT INTO saliyah_sim_citizens VALUES('bot1','مواطن آلي','تاجر');
INSERT INTO saliyah_sim_companies VALUES('company1','شركة البوت','10000','approved');
INSERT INTO saliyah_sim_bank_accounts VALUES('sim-bank-bot','citizen','bot1','SC000001',300,'active');
INSERT INTO saliyah_sim_shares VALUES('shares-founder','company1','bot1',1000);
INSERT INTO saliyah_sim_properties VALUES('property1','bot1','محل','السجادة',100,'listed',NULL);
""")
def read(sql):
    return conn.execute(sql).fetchone()[0]
def assert_bad(sql,values,why):
    before=conn.total_changes
    try:
        conn.execute(sql,values)
        raise AssertionError(f"unexpected success: {why}")
    except sqlite3.IntegrityError:
        pass
    assert conn.total_changes==before,why

stock_sql="INSERT INTO saliyah_market_trades(id,company_id,user_id,user_account_id,bot_owner_id,direction,units,unit_price) VALUES(?,?,?,?,?,?,?,?)"
conn.execute(stock_sql,("trade1","company1","u1","bank1","bot1","buy",10,10))
assert read("SELECT balance FROM bank_accounts WHERE id='bank1'")==900
assert read("SELECT balance FROM saliyah_sim_bank_accounts WHERE id='sim-bank-bot'")==400
assert read("SELECT units FROM saliyah_sim_shares WHERE id='shares-founder'")==990
assert read("SELECT units FROM saliyah_sim_shares WHERE owner_id='human:u1'")==10
assert_bad(stock_sql,("badprice","company1","u1","bank1","bot1","buy",1,20),"server price guard")
assert_bad(stock_sql,("otheruser","company1","u1","bank2","bot1","buy",1,10),"user account ownership")
assert_bad(stock_sql,("oversell","company1","u1","bank1","bot1","sell",99,10),"human share oversell")
assert_bad(stock_sql,("overbuy","company1","u1","bank1","bot1","buy",999,10),"human insufficient funds")

conn.execute(stock_sql,("trade2","company1","u1","bank1","bot1","sell",4,10))
assert read("SELECT balance FROM bank_accounts WHERE id='bank1'")==940
assert read("SELECT balance FROM saliyah_sim_bank_accounts WHERE id='sim-bank-bot'")==360
assert read("SELECT units FROM saliyah_sim_shares WHERE id='shares-founder'")==994
assert read("SELECT units FROM saliyah_sim_shares WHERE owner_id='human:u1'")==6

pay_sql="INSERT INTO saliyah_sim_public_payments(id,user_id,from_account_id,recipient_account_id,amount,memo) VALUES(?,?,?,?,?,?)"
conn.execute(pay_sql,("payment1","u1","bank1","sim-bank-bot",50,"رسوم خدمة افتراضية"))
assert read("SELECT balance FROM bank_accounts WHERE id='bank1'")==890
assert read("SELECT balance FROM saliyah_sim_bank_accounts WHERE id='sim-bank-bot'")==410
assert read("SELECT COUNT(*) FROM saliyah_sim_bank_transactions WHERE kind='human_payment'")==1
assert_bad(pay_sql,("payment2","u1","bank2","sim-bank-bot",20,"wrong owner"),"payment account ownership")
assert_bad(pay_sql,("payment3","u1","bank1","sim-bank-bot",10000,"insufficient funds"),"payment insufficient funds")
assert_bad(pay_sql,("payment1","u1","bank1","sim-bank-bot",50,"duplicate"),"no duplicated payment")

property_sql="INSERT INTO saliyah_sim_public_property_trades(id,property_id,user_id,user_account_id,seller_id,price) VALUES(?,?,?,?,?,?)"
conn.execute(property_sql,("propertybuy1","property1","u1","bank1","bot1",100))
assert read("SELECT balance FROM bank_accounts WHERE id='bank1'")==790
assert read("SELECT balance FROM saliyah_sim_bank_accounts WHERE id='sim-bank-bot'")==510
assert read("SELECT owner_id FROM saliyah_sim_properties WHERE id='property1'")=="human:u1"
assert read("SELECT COUNT(*) FROM saliyah_sim_property_trades WHERE buyer_id='human:u1'")==1
assert_bad(property_sql,("propertybuy2","property1","u2","bank2","bot1",100),"sold property cannot be resold")
print("PASS atomic simulated bot stock, transfer, and property transactions")
