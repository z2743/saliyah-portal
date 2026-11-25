"""Check unique internal SIM numbers and auto-numbering for simulated residents."""
from pathlib import Path
import re
import sqlite3

root=Path(__file__).resolve().parent.parent
db=sqlite3.connect(":memory:")
db.executescript("""
CREATE TABLE saliyah_sim_citizens(id TEXT PRIMARY KEY,name TEXT NOT NULL);
CREATE TABLE saliyah_sim_companies(id TEXT PRIMARY KEY,name TEXT NOT NULL);
CREATE TABLE x_profiles(id TEXT PRIMARY KEY,kind TEXT NOT NULL);
INSERT INTO saliyah_sim_citizens VALUES('resident-1','أحمد'),('resident-2','منال');
INSERT INTO saliyah_sim_companies VALUES('company-1','شركة النور');
INSERT INTO x_profiles VALUES('x-1','bot'),('x-2','person');
""")
db.executescript((root/"migrations/9999_zzz_sim_public_phones.sql").read_text(encoding="utf-8"))
def phones():
    return db.execute("SELECT target_type,target_id,phone_number,provider FROM saliyah_sim_public_phones ORDER BY id").fetchall()
rows=phones()
assert len(rows)==4,rows
assert len({x[2] for x in rows})==len(rows)
assert all(re.fullmatch(r'SIM-\d{9}',x[2]) for x in rows)
assert {x[3] for x in rows}.issubset({'STC الصالية','زين الصالية'})
db.executescript("""
INSERT INTO saliyah_sim_citizens VALUES('resident-3','فهد');
INSERT INTO saliyah_sim_companies VALUES('company-2','مؤسسة الواحة');
INSERT INTO saliyah_sim_institutions(id,project_id,name,kind) VALUES('school-1','project-1','مدرسة السجادة','school');
INSERT INTO saliyah_sim_legal_bots(id,name,role) VALUES('lawyer-1','المحامي الصالي','lawyer');
INSERT INTO x_profiles VALUES('x-3','bot');
""")
rows=phones()
assert len(rows)==9, rows
assert len({x[2] for x in rows})==9
assert all(x[2] and x[2].startswith("SIM-") for x in rows)
db.executescript((root/"migrations/9999_zzz_sim_public_phones.sql").read_text(encoding="utf-8"))
assert phones()==rows,"Re-applying migration must not renumber entities"
print("PASS SIM extensions are unique, stable and auto-created for new bot entities")
