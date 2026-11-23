-- Retire both legacy collectors and install one deterministic collector.
-- The king receives every collected amount exactly once.
DROP TRIGGER IF EXISTS debt_collect_on_credit;
DROP TRIGGER IF EXISTS debt_collect_to_king_on_credit;
CREATE TRIGGER debt_collect_to_king_on_credit AFTER UPDATE OF balance ON bank_accounts
WHEN NEW.balance>OLD.balance
 AND EXISTS(SELECT 1 FROM debt_claims WHERE subject_user_id=NEW.user_id AND status='active' AND remaining_amount>0)
 AND EXISTS(SELECT 1 FROM bank_accounts k JOIN users u ON u.id=k.user_id WHERE u.role='king' AND k.bank='national' AND k.id<>NEW.id)
BEGIN
 INSERT INTO debt_collections(id,claim_id,bank_account_id,amount)
 SELECT lower(hex(randomblob(16))),d.id,NEW.id,min(NEW.balance-OLD.balance,d.remaining_amount)
 FROM debt_claims d
 WHERE d.subject_user_id=NEW.user_id AND d.status='active' AND d.remaining_amount>0
 ORDER BY d.created_at,d.id LIMIT 1;
 UPDATE debt_claims SET remaining_amount=remaining_amount-(
   SELECT amount FROM debt_collections WHERE claim_id=debt_claims.id AND bank_account_id=NEW.id ORDER BY rowid DESC LIMIT 1
 ) WHERE id=(SELECT claim_id FROM debt_collections WHERE bank_account_id=NEW.id ORDER BY rowid DESC LIMIT 1) AND status='active';
 UPDATE debt_claims SET status='paid',settled_at=CURRENT_TIMESTAMP
 WHERE status='active' AND remaining_amount=0 AND subject_user_id=NEW.user_id;
 UPDATE bank_accounts SET balance=balance-(
   SELECT amount FROM debt_collections WHERE bank_account_id=NEW.id ORDER BY rowid DESC LIMIT 1
 ) WHERE id=NEW.id;
 UPDATE bank_accounts SET balance=balance+(
   SELECT amount FROM debt_collections WHERE bank_account_id=NEW.id ORDER BY rowid DESC LIMIT 1
 ) WHERE id=(SELECT k.id FROM bank_accounts k JOIN users u ON u.id=k.user_id WHERE u.role='king' AND k.bank='national' AND k.id<>NEW.id LIMIT 1);
END;
