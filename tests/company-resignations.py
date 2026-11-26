"""Regression tests for private company employee resignations and ownership."""
import sqlite3
from pathlib import Path

root=Path(__file__).resolve().parents[1]
db=sqlite3.connect(":memory:")
db.execute("PRAGMA foreign_keys=ON")
db.executescript("""
CREATE TABLE users(id TEXT PRIMARY KEY);
CREATE TABLE commerce_companies(id TEXT PRIMARY KEY,owner_id TEXT);
CREATE TABLE company_employees(id TEXT PRIMARY KEY,company_id TEXT REFERENCES commerce_companies(id),employee_id TEXT REFERENCES users(id),status TEXT NOT NULL);
INSERT INTO users(id) VALUES('employee'),('other'),('owner');
INSERT INTO commerce_companies(id,owner_id) VALUES('company','owner');
INSERT INTO company_employees(id,company_id,employee_id,status) VALUES('employment','company','employee','active');
""")
db.executescript((root/'migrations/0081_company_staff_resignations.sql').read_text())
db.execute("INSERT INTO company_staff_resignations(id,employment_id,employee_id,reason) VALUES('r1','employment','employee','طلب استقالة نظامي')")
try:
 db.execute("INSERT INTO company_staff_resignations(id,employment_id,employee_id,reason) VALUES('r2','employment','employee','محاولة تكرار')")
 raise AssertionError("Duplicate active resignation permitted")
except sqlite3.IntegrityError:
 pass
try:
 db.execute("INSERT INTO company_staff_resignations(id,employment_id,employee_id,reason) VALUES('r3','employment','other','طلب غير مصرح')")
 raise AssertionError("Other employee permitted to resign")
except sqlite3.IntegrityError:
 pass
db.execute("UPDATE company_staff_resignations SET status='withdrawn' WHERE id='r1'")
db.execute("INSERT INTO company_staff_resignations(id,employment_id,employee_id,reason) VALUES('r4','employment','employee','استقالة جديدة')")
assert db.execute("PRAGMA foreign_key_check").fetchall()==[]
print("Company HR resignation migration guards passed")
