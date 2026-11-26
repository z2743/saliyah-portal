"""Regression checks for D1 indexes on the two most expensive live queries."""
import pathlib
import sqlite3
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]

class D1HotQueryIndexTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.executescript("""
        CREATE TABLE saliyah_sim_job_applications(id TEXT PRIMARY KEY,citizen_id TEXT,status TEXT);
        CREATE TABLE saliyah_sim_companies(id TEXT PRIMARY KEY,founder_id TEXT,status TEXT);
        CREATE TABLE x_likes(profile_id TEXT,post_id TEXT,PRIMARY KEY(profile_id,post_id));
        INSERT INTO saliyah_sim_job_applications VALUES('a','citizen1','hired');
        INSERT INTO saliyah_sim_companies VALUES('c','citizen2','approved');
        INSERT INTO x_likes VALUES('p','post1');
        """)
        self.db.executescript((ROOT / "migrations/9999_zzzzzzzzzzzz_d1_hot_query_indexes.sql").read_text())

    def plan(self, sql, *args):
        return " ".join(str(row[-1]) for row in
                        self.db.execute("EXPLAIN QUERY PLAN " + sql,args)).lower()

    def test_bot_hire_candidate_search_uses_citizen_index(self):
        p=self.plan("SELECT 1 FROM saliyah_sim_job_applications WHERE citizen_id=? AND status='hired'",'citizen1')
        self.assertIn('idx_sim_jobs_hired_by_citizen',p)

    def test_business_founder_lookup_uses_approved_index(self):
        p=self.plan("SELECT 1 FROM saliyah_sim_companies WHERE founder_id=? AND status='approved'",'citizen2')
        self.assertIn('idx_sim_companies_approved_founder',p)

    def test_x_post_like_counts_use_post_index(self):
        p=self.plan("SELECT COUNT(*) FROM x_likes WHERE post_id=?",'post1')
        self.assertIn('idx_x_likes_post_profile',p)
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM x_likes WHERE post_id=?",('post1',)).fetchone()[0],1)

if __name__ == "__main__":
    unittest.main()
