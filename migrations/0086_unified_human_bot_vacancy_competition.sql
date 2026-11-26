-- Open competition: a posted vacancy can be filled by a real citizen or an autonomous simulated citizen.
-- No applicant type is selected when publishing; applications share one seat and one close state.
CREATE TABLE IF NOT EXISTS company_bot_vacancy_applications(
 id TEXT PRIMARY KEY,
 vacancy_id TEXT NOT NULL REFERENCES company_vacancies(id),
 bot_id TEXT NOT NULL REFERENCES saliyah_sim_citizens(id),
 statement TEXT NOT NULL CHECK(length(trim(statement)) BETWEEN 10 AND 2000),
 status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','reviewing','accepted','rejected','withdrawn')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 reviewed_at TEXT,
 UNIQUE(vacancy_id,bot_id)
);
CREATE INDEX IF NOT EXISTS company_bot_vacancy_by_status ON company_bot_vacancy_applications(vacancy_id,status,created_at);
CREATE INDEX IF NOT EXISTS company_bot_vacancy_by_bot ON company_bot_vacancy_applications(bot_id,status);
CREATE TABLE IF NOT EXISTS government_bot_vacancy_applications(
 id TEXT PRIMARY KEY,
 vacancy_id TEXT NOT NULL REFERENCES vacancies(id),
 bot_id TEXT NOT NULL REFERENCES saliyah_sim_citizens(id),
 statement TEXT NOT NULL CHECK(length(trim(statement)) BETWEEN 10 AND 2000),
 status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','reviewing','accepted','rejected')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 reviewed_at TEXT,
 UNIQUE(vacancy_id,bot_id)
);
CREATE INDEX IF NOT EXISTS government_bot_vacancy_by_status ON government_bot_vacancy_applications(vacancy_id,status,created_at);
CREATE INDEX IF NOT EXISTS government_bot_vacancy_by_bot ON government_bot_vacancy_applications(bot_id,status);
CREATE TABLE IF NOT EXISTS government_bot_hires(
 id TEXT PRIMARY KEY,
 vacancy_id TEXT NOT NULL REFERENCES vacancies(id),
 bot_id TEXT NOT NULL REFERENCES saliyah_sim_citizens(id),
 weekly_salary INTEGER NOT NULL CHECK(weekly_salary BETWEEN 1 AND 1000000),
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','ended')),
 hired_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 ended_at TEXT,
 UNIQUE(vacancy_id,bot_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS government_bot_one_active_job ON government_bot_hires(bot_id) WHERE status='active';
CREATE INDEX IF NOT EXISTS government_bot_hires_vacancy ON government_bot_hires(vacancy_id,status);
-- DB-level safety: a single vacancy can never have two accepted candidates or two hires,
-- even during concurrent human/bot requests. Legacy manual hires do not claim a vacancy.
CREATE TRIGGER IF NOT EXISTS company_vacancy_bot_accept_guard BEFORE UPDATE OF status ON company_bot_vacancy_applications
WHEN NEW.status='accepted' AND OLD.status<>'accepted'
BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM company_vacancies v JOIN commerce_companies c ON c.id=v.company_id WHERE v.id=NEW.vacancy_id AND v.status='open' AND c.status='approved')
  OR EXISTS(SELECT 1 FROM company_vacancy_applications a WHERE a.vacancy_id=NEW.vacancy_id AND a.status='accepted')
  OR EXISTS(SELECT 1 FROM company_bot_vacancy_applications a WHERE a.vacancy_id=NEW.vacancy_id AND a.status='accepted' AND a.id<>NEW.id)
  THEN RAISE(ABORT,'vacancy already filled or closed') END;
END;
CREATE TRIGGER IF NOT EXISTS company_vacancy_human_accept_guard BEFORE UPDATE OF status ON company_vacancy_applications
WHEN NEW.status='accepted' AND OLD.status<>'accepted'
BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM company_vacancies v JOIN commerce_companies c ON c.id=v.company_id WHERE v.id=NEW.vacancy_id AND v.status='open' AND c.status='approved')
  OR EXISTS(SELECT 1 FROM company_bot_vacancy_applications a WHERE a.vacancy_id=NEW.vacancy_id AND a.status='accepted')
  OR EXISTS(SELECT 1 FROM company_vacancy_applications a WHERE a.vacancy_id=NEW.vacancy_id AND a.status='accepted' AND a.id<>NEW.id)
  THEN RAISE(ABORT,'vacancy already filled or closed') END;
END;
CREATE TRIGGER IF NOT EXISTS government_bot_accept_guard BEFORE UPDATE OF status ON government_bot_vacancy_applications
WHEN NEW.status='accepted' AND OLD.status<>'accepted'
BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM vacancies WHERE id=NEW.vacancy_id AND status='open')
  OR EXISTS(SELECT 1 FROM job_applications WHERE vacancy_id=NEW.vacancy_id AND status='accepted')
  OR EXISTS(SELECT 1 FROM government_bot_vacancy_applications WHERE vacancy_id=NEW.vacancy_id AND status='accepted' AND id<>NEW.id)
  THEN RAISE(ABORT,'vacancy already filled or closed') END;
END;
CREATE TRIGGER IF NOT EXISTS government_human_accept_guard BEFORE UPDATE OF status ON job_applications
WHEN NEW.status='accepted' AND OLD.status<>'accepted'
BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM vacancies WHERE id=NEW.vacancy_id AND status='open')
  OR EXISTS(SELECT 1 FROM government_bot_vacancy_applications WHERE vacancy_id=NEW.vacancy_id AND status='accepted')
  OR EXISTS(SELECT 1 FROM job_applications WHERE vacancy_id=NEW.vacancy_id AND status='accepted' AND id<>NEW.id)
  THEN RAISE(ABORT,'vacancy already filled or closed') END;
END;
CREATE TRIGGER IF NOT EXISTS company_hire_from_open_vacancy_guard BEFORE INSERT ON company_bot_hires
WHEN NEW.id LIKE 'open-job-hire-%'
BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM company_bot_vacancy_applications a JOIN company_vacancies v ON v.id=a.vacancy_id WHERE a.id=substr(NEW.id,15) AND a.bot_id=NEW.bot_id AND a.status='accepted' AND v.status='open' AND v.company_id=NEW.company_id)
  THEN RAISE(ABORT,'vacancy application not accepted') END;
END;
