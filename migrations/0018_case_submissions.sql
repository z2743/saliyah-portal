-- Phase 18: private written submissions and court review (no uploaded files).
CREATE TABLE court_submissions (
 id TEXT PRIMARY KEY,
 case_id TEXT NOT NULL REFERENCES court_cases(id),
 author_id TEXT NOT NULL REFERENCES users(id),
 kind TEXT NOT NULL CHECK(kind IN ('statement','response','evidence_note','motion')),
 title TEXT NOT NULL,
 body TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','reviewed','returned')),
 review_note TEXT,
 reviewed_by TEXT REFERENCES users(id),
 reviewed_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_court_submissions_case ON court_submissions(case_id,created_at);
