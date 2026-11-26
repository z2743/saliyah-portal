-- Target real D1 hot queries: avoid full correlated scans on simulated hiring
-- and the X timeline. These were responsible for >2.8m rows read / 24h.
CREATE INDEX IF NOT EXISTS idx_sim_jobs_hired_by_citizen
 ON saliyah_sim_job_applications(citizen_id) WHERE status='hired';
CREATE INDEX IF NOT EXISTS idx_sim_companies_approved_founder
 ON saliyah_sim_companies(founder_id) WHERE status='approved';
CREATE INDEX IF NOT EXISTS idx_x_likes_post_profile
 ON x_likes(post_id,profile_id);
