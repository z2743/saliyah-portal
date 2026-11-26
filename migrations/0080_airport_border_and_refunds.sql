-- Airport is an additional simulated border checkpoint. Land posts remain unchanged.
INSERT OR IGNORE INTO border_posts(id,name,profile,active)
VALUES('airport-sjd','مطار الملك زياد الدولي — الجوازات','منفذ جوي للمسافرين الدوليين',1);
CREATE TRIGGER IF NOT EXISTS aviation_payment_refund_guard BEFORE UPDATE OF status ON aviation_payment_ledger
 WHEN NEW.status='refunded' AND OLD.status IN ('debited','confirmed')
  AND NOT EXISTS(SELECT 1 FROM aviation_treasury WHERE airline_id=NEW.airline_id AND balance>=NEW.amount)
 BEGIN SELECT RAISE(ABORT,'airline treasury insufficient to refund ticket'); END;
