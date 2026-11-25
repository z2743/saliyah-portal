-- Housing projects approved by the monarch enter construction, then publish units upon completion.
-- No automatic bot property purchase: project listings remain available for human buyers.
CREATE TABLE IF NOT EXISTS saliyah_housing_projects(
 project_id TEXT PRIMARY KEY REFERENCES saliyah_projects(id),
 status TEXT NOT NULL DEFAULT 'building' CHECK(status IN ('building','completed')),
 started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 completed_at TEXT,
 unit_count INTEGER NOT NULL DEFAULT 30 CHECK(unit_count=30)
);
CREATE TABLE IF NOT EXISTS saliyah_housing_units(
 project_id TEXT NOT NULL REFERENCES saliyah_housing_projects(project_id),
 unit_number INTEGER NOT NULL CHECK(unit_number BETWEEN 1 AND 30),
 property_id TEXT NOT NULL UNIQUE REFERENCES saliyah_sim_properties(id),
 unit_type TEXT NOT NULL,
 area_sqm INTEGER NOT NULL CHECK(area_sqm>0),
 bedrooms INTEGER NOT NULL,
 bathrooms INTEGER NOT NULL,
 parking INTEGER NOT NULL,
 floor INTEGER NOT NULL,
 features TEXT NOT NULL,
 PRIMARY KEY(project_id,unit_number)
);
CREATE INDEX IF NOT EXISTS idx_housing_units_property ON saliyah_housing_units(property_id);
CREATE TRIGGER IF NOT EXISTS housing_project_approval_starts_build
AFTER UPDATE OF status ON saliyah_projects
WHEN NEW.status='approved' AND OLD.status='pending_human' AND NEW.project_type='housing'
BEGIN
 INSERT OR IGNORE INTO saliyah_housing_projects(project_id,status) VALUES(NEW.id,'building');
END;
CREATE TRIGGER IF NOT EXISTS housing_project_completed_lists_units
AFTER UPDATE OF status ON saliyah_housing_projects
WHEN OLD.status='building' AND NEW.status='completed'
 AND EXISTS(SELECT 1 FROM saliyah_projects p WHERE p.id=NEW.project_id AND p.project_type='housing' AND p.status='approved')
BEGIN
 INSERT OR IGNORE INTO saliyah_sim_citizens(id,name,occupation)
 SELECT 'project-sales-'||NEW.project_id,'مكتب مبيعات '||p.title,'مبيعات عقارية افتراضية'
 FROM saliyah_projects p WHERE p.id=NEW.project_id;
 INSERT OR IGNORE INTO saliyah_sim_bank_accounts(id,owner_type,owner_id,account_number,bank_name,balance)
 VALUES('sim-bank-project-'||NEW.project_id,'citizen','project-sales-'||NEW.project_id,'SC-PROJECT-'||NEW.project_id,'البنك الصالي',0);
 INSERT OR IGNORE INTO saliyah_sim_properties(id,owner_id,kind,location,price,status)
 WITH RECURSIVE units(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM units WHERE n<30)
 SELECT 'housing-'||NEW.project_id||'-'||printf('%02d',n),'project-sales-'||NEW.project_id,
 CASE WHEN n<=12 THEN 'شقة غرفتين' WHEN n<=22 THEN 'شقة ثلاث غرف' WHEN n<=28 THEN 'دوبلكس أربع غرف' ELSE 'فيلا خمس غرف' END,
 p.title||'، '||p.location||'، الوحدة رقم '||printf('%02d',n),
 CASE WHEN n<=12 THEN 245000+(n%6)*5000 WHEN n<=22 THEN 335000+(n%5)*8000 WHEN n<=28 THEN 460000+(n%3)*15000 ELSE 690000+(n%2)*30000 END,
 'listed'
 FROM units CROSS JOIN saliyah_projects p WHERE p.id=NEW.project_id;
 INSERT OR IGNORE INTO saliyah_housing_units(project_id,unit_number,property_id,unit_type,area_sqm,bedrooms,bathrooms,parking,floor,features)
 WITH RECURSIVE units(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM units WHERE n<30)
 SELECT NEW.project_id,n,'housing-'||NEW.project_id||'-'||printf('%02d',n),
 CASE WHEN n<=12 THEN 'شقة غرفتين' WHEN n<=22 THEN 'شقة ثلاث غرف' WHEN n<=28 THEN 'دوبلكس أربع غرف' ELSE 'فيلا خمس غرف' END,
 CASE WHEN n<=12 THEN 105 WHEN n<=22 THEN 145 WHEN n<=28 THEN 185 ELSE 240 END,
 CASE WHEN n<=12 THEN 2 WHEN n<=22 THEN 3 WHEN n<=28 THEN 4 ELSE 5 END,
 CASE WHEN n<=12 THEN 2 WHEN n<=22 THEN 3 WHEN n<=28 THEN 4 ELSE 5 END,
 CASE WHEN n<=22 THEN 1 ELSE 2 END,
 CASE WHEN n<=12 THEN 1+(n%3) WHEN n<=22 THEN 1+(n%4) ELSE 0 END,
 CASE WHEN n<=12 THEN 'صالة معيشة ومطبخ وحمامان وموقف خاص'
      WHEN n<=22 THEN 'صالة عائلية ومطبخ وثلاثة حمامات وموقف خاص'
      WHEN n<=28 THEN 'دوران وصالة عائلية ومجلس وأربعة حمامات وموقفان'
      ELSE 'فيلا مستقلة مع مجلس وحديقة خاصة وخمسة حمامات وموقفين' END
 FROM units;
END;
-- Historic approvals start in construction; specifically complete the King's already-approved Al-Nakheel district.
INSERT OR IGNORE INTO saliyah_housing_projects(project_id,status)
SELECT id,'building' FROM saliyah_projects WHERE project_type='housing' AND status='approved';
UPDATE saliyah_housing_projects SET status='completed',completed_at=CURRENT_TIMESTAMP
WHERE status='building' AND project_id IN (
 SELECT id FROM saliyah_projects WHERE title='حي النخيل السكني' AND project_type='housing' AND status='approved'
);
