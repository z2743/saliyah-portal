-- Phase 24: append-only judicial execution orders, synchronized with execution state.
CREATE TABLE court_execution_orders (
 id TEXT PRIMARY KEY,
 execution_id TEXT NOT NULL REFERENCES judgment_executions(id),
 case_id TEXT NOT NULL REFERENCES court_cases(id),
 issued_by TEXT NOT NULL REFERENCES users(id),
 action TEXT NOT NULL CHECK(action IN ('start','suspend','resume','complete')),
 reason TEXT NOT NULL CHECK(length(reason) BETWEEN 10 AND 4000),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_execution_orders ON court_execution_orders(execution_id,created_at);
CREATE TRIGGER execution_order_validate BEFORE INSERT ON court_execution_orders BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM judgment_executions e JOIN court_cases c ON c.id=e.case_id WHERE e.id=NEW.execution_id AND e.case_id=NEW.case_id AND c.status='judged') THEN RAISE(ABORT,'Invalid execution') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM judgment_executions e WHERE e.id=NEW.execution_id AND
 ((NEW.action='start' AND e.status='opened') OR (NEW.action='suspend' AND e.status IN ('opened','in_progress')) OR (NEW.action='resume' AND e.status='suspended') OR (NEW.action='complete' AND e.status='in_progress'))) THEN RAISE(ABORT,'Invalid transition') END;
 SELECT CASE WHEN NEW.action IN ('start','resume','complete') AND EXISTS(SELECT 1 FROM court_review_dockets d WHERE d.case_id=NEW.case_id AND d.status='open') THEN RAISE(ABORT,'Open judicial review') END;
 SELECT CASE WHEN NEW.action IN ('start','resume','complete') AND EXISTS(SELECT 1 FROM court_review_dockets d JOIN court_review_rulings r ON r.docket_id=d.id WHERE d.case_id=NEW.case_id AND r.outcome IN ('reverse','remand')) THEN RAISE(ABORT,'Review overturned or remanded') END;
 SELECT CASE WHEN NEW.action IN ('start','resume','complete') AND EXISTS(SELECT 1 FROM court_appeals a WHERE a.case_id=NEW.case_id AND a.status='accepted' AND NOT EXISTS(SELECT 1 FROM court_review_dockets d JOIN court_review_rulings r ON r.docket_id=d.id WHERE d.appeal_id=a.id AND d.level='appeal')) THEN RAISE(ABORT,'Appeal awaiting ruling') END;
END;
CREATE TRIGGER execution_order_apply AFTER INSERT ON court_execution_orders BEGIN
 UPDATE judgment_executions SET status=CASE NEW.action WHEN 'start' THEN 'in_progress' WHEN 'resume' THEN 'in_progress' WHEN 'suspend' THEN 'suspended' ELSE 'completed' END,last_note=NEW.reason,updated_by=NEW.issued_by,updated_at=CURRENT_TIMESTAMP WHERE id=NEW.execution_id;
END;
CREATE TRIGGER execution_order_no_update BEFORE UPDATE ON court_execution_orders BEGIN SELECT RAISE(ABORT,'Execution orders are immutable'); END;
CREATE TRIGGER execution_order_no_delete BEFORE DELETE ON court_execution_orders BEGIN SELECT RAISE(ABORT,'Execution orders are immutable'); END;
