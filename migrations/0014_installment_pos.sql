-- Phase 14: merchant-funded BNPL settlement, fictional currency only.
CREATE TABLE IF NOT EXISTS installment_pos_settlements (
 id TEXT PRIMARY KEY,
 pos_payment_id TEXT NOT NULL UNIQUE REFERENCES pos_payments(id),
 plan_id TEXT NOT NULL UNIQUE REFERENCES installment_plans(id),
 provider TEXT NOT NULL CHECK(provider IN ('tabby','tamara')),
 amount INTEGER NOT NULL CHECK(amount BETWEEN 4 AND 5000),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TRIGGER IF NOT EXISTS installment_settlement_validate BEFORE INSERT ON installment_pos_settlements BEGIN
 SELECT CASE WHEN NOT EXISTS (
  SELECT 1 FROM pos_payments p JOIN installment_plans ip ON ip.id=NEW.plan_id
  WHERE p.id=NEW.pos_payment_id AND p.status='pending' AND p.customer_id=ip.user_id
   AND p.amount=NEW.amount AND ip.amount=NEW.amount AND ip.provider=NEW.provider
   AND ip.status='active' AND p.created_at>=datetime('now','-24 hours')
 ) THEN RAISE(ABORT,'Invalid pending purchase or installment plan') END;
 SELECT CASE WHEN (
  SELECT COALESCE(SUM(amount),0) FROM installment_plans
  WHERE user_id=(SELECT user_id FROM installment_plans WHERE id=NEW.plan_id)
   AND provider=NEW.provider AND status='active'
 ) > 5000 THEN RAISE(ABORT,'Installment limit exceeded') END;
END;
CREATE TRIGGER IF NOT EXISTS installment_settlement_apply AFTER INSERT ON installment_pos_settlements BEGIN
 UPDATE bank_accounts SET balance=balance+NEW.amount
  WHERE id=(SELECT m.account_id FROM pos_merchants m JOIN pos_payments p ON p.merchant_id=m.id WHERE p.id=NEW.pos_payment_id);
 UPDATE pos_payments SET status='paid',paid_at=CURRENT_TIMESTAMP WHERE id=NEW.pos_payment_id AND status='pending';
END;
