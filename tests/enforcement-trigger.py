#!/usr/bin/env python3
"""Regression: a paid combined debt/service case releases its own hold, never other holds."""
from pathlib import Path
import sqlite3

con = sqlite3.connect(":memory:")
con.executescript("""
CREATE TABLE audit_log(id TEXT PRIMARY KEY,actor_id TEXT,action TEXT NOT NULL,entity_type TEXT NOT NULL,entity_id TEXT,details TEXT);
CREATE TABLE enforcement_cases_v2(id TEXT PRIMARY KEY,action TEXT NOT NULL);
CREATE TABLE service_suspensions_v2(id TEXT PRIMARY KEY,case_id TEXT NOT NULL,status TEXT NOT NULL,ended_at TEXT,ended_by TEXT,lift_reason TEXT);
CREATE TABLE debt_claims(id TEXT PRIMARY KEY,case_id TEXT NOT NULL,status TEXT NOT NULL,remaining_amount INTEGER NOT NULL);
INSERT INTO enforcement_cases_v2 VALUES ('combined-old','both'),('standalone','service_suspension'),('combined-new','both');
INSERT INTO service_suspensions_v2(id,case_id,status) VALUES ('hold-old','combined-old','active'),('hold-standalone','standalone','active'),('hold-new','combined-new','active');
INSERT INTO debt_claims VALUES ('debt-old','combined-old','paid',0),('debt-standalone','standalone','paid',0),('debt-new','combined-new','active',200);
""")
migration=Path(__file__).parents[1]/"migrations"/"0072_debt_paid_suspension_release.sql"
con.executescript(migration.read_text(encoding="utf-8"))
get=lambda key:con.execute("SELECT status FROM service_suspensions_v2 WHERE id=?", (key,)).fetchone()[0]
assert get("hold-old")=="lifted","backfill must release old paid linked hold"
assert get("hold-standalone")=="active","standalone hold must remain active"
assert get("hold-new")=="active","unpaid hold must remain active"
con.execute("UPDATE debt_claims SET status='paid',remaining_amount=0 WHERE id='debt-new'")
assert get("hold-new")=="lifted","trigger must release newly paid combined hold"
assert get("hold-standalone")=="active","payment must not release independent hold"
assert con.execute("SELECT COUNT(*) FROM audit_log WHERE action='service_suspension_auto_lifted'").fetchone()[0]==2
con.execute("UPDATE debt_claims SET status='paid',remaining_amount=0 WHERE id='debt-new'")
assert con.execute("SELECT COUNT(*) FROM audit_log WHERE action='service_suspension_auto_lifted'").fetchone()[0]==2,"no duplicate audit"
print("PASS settled-debt trigger/backfill release only the connected service hold and audit exactly once")
