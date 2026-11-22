-- Distribute each incoming credit across all active claims, oldest first.
DROP TRIGGER IF EXISTS debt_collect_to_king_on_credit;
CREATE TRIGGER debt_collect_to_king_on_credit AFTER UPDATE OF balance ON bank_accounts
WHEN NEW.balance>OLD.balance
 AND EXISTS(SELECT 1 FROM debt_claims WHERE subject_user_id=NEW.user_id AND status='active' AND remaining_amount>0)
 AND EXISTS(SELECT 1 FROM bank_accounts k JOIN users u ON u.id=k.user_id WHERE u.role='king' AND k.bank='national' AND k.id<>NEW.id)
BEGIN
 INSERT INTO debt_collections(id,claim_id,bank_account_id,amount)
 SELECT lower(hex(randomblob(16))),id,NEW.id,allocation
 FROM (
  SELECT id,max(0,min(remaining_amount,
   (NEW.balance-OLD.balance)-COALESCE(
    SUM(remaining_amount) OVER (ORDER BY created_at,id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING),0)
  )) allocation
  FROM debt_claims
  WHERE subject_user_id=NEW.user_id AND status='active' AND remaining_amount>0
 ) WHERE allocation>0;
 UPDATE debt_claims SET remaining_amount=remaining_amount-(
  SELECT COALESCE(SUM(amount),0) FROM debt_collections
  WHERE claim_id=debt_claims.id AND bank_account_id=NEW.id AND rowid>COALESCE(
   (SELECT MAX(rowid) FROM debt_collections WHERE bank_account_id=NEW.id AND created_at<CURRENT_TIMESTAMP),0)
 ) WHERE subject_user_id=NEW.user_id AND status='active'
 AND id IN (SELECT claim_id FROM debt_collections WHERE bank_account_id=NEW.id);
 UPDATE debt_claims SET status='paid',settled_at=CURRENT_TIMESTAMP
 WHERE subject_user_id=NEW.user_id AND status='active' AND remaining_amount=0;
 UPDATE bank_accounts SET balance=balance-(
  SELECT COALESCE(SUM(amount),0) FROM debt_collections
  WHERE bank_account_id=NEW.id AND created_at=CURRENT_TIMESTAMP
 ) WHERE id=NEW.id;
 UPDATE bank_accounts SET balance=balance+(
  SELECT COALESCE(SUM(amount),0) FROM debt_collections
  WHERE bank_account_id=NEW.id AND created_at=CURRENT_TIMESTAMP
 ) WHERE id=(SELECT k.id FROM bank_accounts k JOIN users u ON u.id=k.user_id
  WHERE u.role='king' AND k.bank='national' AND k.id<>NEW.id ORDER BY k.id LIMIT 1);
END;
