"""Check unique internal SIM numbers and auto-numbering for simulated residents."""
from pathlib import Path
import re
import sqlite3

root=Path(__file__).resolve().parent.parent
db=sqlite3.connect(":memory:")
db.execute("PRAGMA foreign_keys=ON")
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


db.executescript("""
CREATE TABLE users(id TEXT PRIMARY KEY);
CREATE TABLE telecom_lines(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),number TEXT NOT NULL);
CREATE TABLE saliyah_sim_public_contacts(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),target_type TEXT NOT NULL,target_id TEXT NOT NULL,message TEXT NOT NULL,bot_reply TEXT,status TEXT NOT NULL DEFAULT 'pending_bot');
INSERT INTO users(id) VALUES('human-1');
INSERT INTO telecom_lines(id,user_id,number) VALUES('line-1','human-1','0501234567');
""")
db.executescript((root/"migrations/9999_zzzz_sim_telecom_sms.sql").read_text(encoding="utf-8"))
to=db.execute("SELECT phone_number FROM saliyah_sim_public_phones WHERE target_type='citizens' AND target_id='resident-1'").fetchone()[0]
db.execute("INSERT INTO saliyah_sim_public_contacts(id,user_id,target_type,target_id,message) VALUES(?,?,?,?,?)",('contact-1','human-1','citizens','resident-1','السلام عليكم'))
db.execute("INSERT INTO saliyah_sim_phone_sms(contact_id,from_line_id,from_number,to_number) VALUES(?,?,?,?)",('contact-1','line-1','0501234567',to))
db.execute("UPDATE saliyah_sim_public_contacts SET bot_reply='🤖 وعليكم السلام',status='replied' WHERE id='contact-1'")
message=db.execute("SELECT s.to_number,c.message,c.bot_reply FROM saliyah_sim_phone_sms s JOIN saliyah_sim_public_contacts c ON c.id=s.contact_id WHERE s.from_line_id='line-1'").fetchone()
assert message==(to,'السلام عليكم','🤖 وعليكم السلام'),message
print("PASS human telecom SMS bridge to fictional bot and reply")
