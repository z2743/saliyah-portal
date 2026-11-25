-- Automatically release a service suspension when its linked BOTH (debt + suspension) case has been paid.
-- Standalone service suspensions are never released by paying an unrelated debt.
CREATE TRIGGER IF NOT EXISTS debt_paid_lifts_linked_services
AFTER UPDATE OF status,remaining_amount ON debt_claims
WHEN NEW.status='paid' AND NEW.remaining_amount=0
BEGIN
 INSERT INTO audit_log(id,actor_id,action,entity_type,entity_id,details)
 SELECT lower(hex(randomblob(16))),NULL,'service_suspension_auto_lifted','service_suspension',s.id,
        json_object('reason','paid_debt','case_id',s.case_id)
 FROM service_suspensions_v2 s JOIN enforcement_cases_v2 e ON e.id=s.case_id
 WHERE s.case_id=NEW.case_id AND s.status='active' AND e.action='both';
 UPDATE service_suspensions_v2 SET status='lifted',ended_at=CURRENT_TIMESTAMP,
   lift_reason='سداد المديونية بالكامل - رفع آلي'
 WHERE case_id=NEW.case_id AND status='active'
 AND EXISTS(SELECT 1 FROM enforcement_cases_v2 e WHERE e.id=NEW.case_id AND e.action='both');
END;
-- Repair historic cases that settled before the auto-release trigger existed.
INSERT INTO audit_log(id,actor_id,action,entity_type,entity_id,details)
SELECT lower(hex(randomblob(16))),NULL,'service_suspension_auto_lifted','service_suspension',s.id,
       json_object('reason','paid_debt_backfill','case_id',s.case_id)
FROM service_suspensions_v2 s JOIN enforcement_cases_v2 e ON e.id=s.case_id
JOIN debt_claims d ON d.case_id=s.case_id
WHERE s.status='active' AND e.action='both' AND d.status='paid' AND d.remaining_amount=0;
UPDATE service_suspensions_v2 SET status='lifted',ended_at=CURRENT_TIMESTAMP,
 lift_reason='سداد المديونية بالكامل - رفع آلي'
WHERE status='active' AND EXISTS(SELECT 1 FROM enforcement_cases_v2 e
 JOIN debt_claims d ON d.case_id=e.id
 WHERE e.id=service_suspensions_v2.case_id AND e.action='both' AND d.status='paid' AND d.remaining_amount=0);
