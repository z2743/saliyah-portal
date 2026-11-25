#!/usr/bin/env python3
import sqlite3
from pathlib import Path
db=sqlite3.connect(':memory:')
db.execute('PRAGMA foreign_keys=ON')
db.executescript("""
CREATE TABLE saliyah_projects(id TEXT PRIMARY KEY,project_type TEXT NOT NULL,title TEXT NOT NULL,location TEXT NOT NULL,status TEXT NOT NULL);
CREATE TABLE saliyah_sim_citizens(id TEXT PRIMARY KEY,name TEXT NOT NULL,occupation TEXT NOT NULL);
CREATE TABLE saliyah_sim_bank_accounts(id TEXT PRIMARY KEY,owner_type TEXT NOT NULL,owner_id TEXT NOT NULL,account_number TEXT UNIQUE NOT NULL,bank_name TEXT NOT NULL,balance INTEGER NOT NULL,UNIQUE(owner_type,owner_id));
CREATE TABLE saliyah_sim_properties(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,kind TEXT NOT NULL,location TEXT NOT NULL,price INTEGER NOT NULL,status TEXT NOT NULL);
INSERT INTO saliyah_projects VALUES('gov-plan-83124','housing','حي النخيل السكني','السجادة','approved');
INSERT INTO saliyah_projects VALUES('future-house','housing','حي المستقبل','عقار','pending_human');
""")
sql=(Path(__file__).parents[1]/'migrations'/'9999_zzzzz_housing_project_units.sql').read_text()
db.executescript(sql)
def read(sql,*args):return db.execute(sql,args).fetchone()
assert read("SELECT status FROM saliyah_housing_projects WHERE project_id='gov-plan-83124'")[0]=='completed'
assert read("SELECT COUNT(*) FROM saliyah_housing_units WHERE project_id='gov-plan-83124'")[0]==30
assert read("SELECT COUNT(*) FROM saliyah_sim_properties WHERE status='listed' AND id LIKE 'housing-%'")[0]==30
assert read("SELECT COUNT(DISTINCT unit_type),COUNT(DISTINCT price) FROM saliyah_housing_units u JOIN saliyah_sim_properties p ON p.id=u.property_id")[0]>=4
assert read("SELECT COUNT(*) FROM saliyah_sim_bank_accounts WHERE owner_id='project-sales-gov-plan-83124'")[0]==1
db.execute("UPDATE saliyah_projects SET status='approved' WHERE id='future-house'")
assert read("SELECT status FROM saliyah_housing_projects WHERE project_id='future-house'")[0]=='building'
assert read("SELECT COUNT(*) FROM saliyah_housing_units WHERE project_id='future-house'")[0]==0
db.execute("UPDATE saliyah_housing_projects SET status='completed',completed_at=CURRENT_TIMESTAMP WHERE project_id='future-house'")
assert read("SELECT COUNT(*) FROM saliyah_housing_units WHERE project_id='future-house'")[0]==30
db.execute("UPDATE saliyah_housing_projects SET status='completed' WHERE project_id='future-house'")
assert read("SELECT COUNT(*) FROM saliyah_housing_units WHERE project_id='future-house'")[0]==30
db.execute("UPDATE saliyah_sim_properties SET owner_id='human:bob',status='owned' WHERE id='housing-future-house-01'")
assert read("SELECT COUNT(*) FROM saliyah_sim_properties WHERE owner_id='human:bob'")[0]==1
assert read("SELECT COUNT(*) FROM saliyah_housing_units WHERE project_id='future-house'")[0]==30
assert not db.execute('PRAGMA foreign_key_check').fetchall()
print('PASS Al-Nakheel 30 published units, future building/completion, seller account, unique listings, transferred ownership')
