-- Allocate each credit to all active claims in deterministic order.
-- Event IDs isolate this credit from earlier collections on the same account.
ALTER TABLE debt_collections ADD COLUMN event_id TEXT;
CREATE TABLE IF NOT EXISTS debt_collection_events(
 id TEXT PRIMARY KEY,
 bank_account_id TEXT NOT NULL REFERENCES bank_accounts(id),
 credit_amount INTEGER NOT NULL CHECK(credit_amount>0),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
DROP TRIGGER IF EXISTS debt_collect_to_king_on_credit;
CREATE TRIGGER debt_collect_to_king_on_credit AFTER UPDATE OF balance ON bank_accounts
WHEN NEW.balance>OLD.balance
 AND EXISTS(SELECT 1 FROM debt_claims WHERE subject_user_id=NEW.user_id AND status='active' AND remaining_amount>0)
 AND EXISTS(SELECT 1 FROM bank_accounts k JOIN users u ON u.id=k.user_id WHERE u.role='king' AND k.bank='national' AND k.id<>NEW.id)
BEGIN
 INSERT INTO debt_collection_events(id,bank_account_id,credit_amount)
 VALUES(lower(hex(randomblob(16))),NEW.id,NEW.balance-OLD.balance);
 INSERT INTO debt_collections(id,claim_id,bank_account_id,amount,event_id)
 SELECT lower(hex(randomblob(16))),id,NEW.id,allocation,
 (SELECT id FROM debt_collection_events WHERE bank_account_id=NEW.id ORDER BY rowid DESC LIMIT 1)
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
  WHERE claim_id=debt_claims.id AND event_id=(
   SELECT id FROM debt_collection_events WHERE bank_account_id=NEW.id ORDER BY rowid DESC LIMIT 1
  )
 ) WHERE subject_user_id=NEW.user_id AND status='active'
 AND id IN (SELECT claim_id FROM debt_collections WHERE event_id=(
  SELECT id FROM debt_collection_events WHERE bank_account_id=NEW.id ORDER BY rowid DESC LIMIT 1
 ));
 UPDATE debt_claims SET status='paid',settled_at=CURRENT_TIMESTAMP
 WHERE subject_user_id=NEW.user_id AND status='active' AND remaining_amount=0;
 UPDATE bank_accounts SET balance=balance-(
  SELECT COALESCE(SUM(amount),0) FROM debt_collections WHERE event_id=(
   SELECT id FROM debt_collection_events WHERE bank_account_id=NEW.id ORDER BY rowid DESC LIMIT 1
  )
 ) WHERE id=NEW.id;
 UPDATE bank_accounts SET balance=balance+(
  SELECT COALESCE(SUM(amount),0) FROM debt_collections WHERE event_id=(
   SELECT id FROM debt_collection_events WHERE bank_account_id=NEW.id ORDER BY rowid DESC LIMIT 1
  )
 ) WHERE id=(SELECT k.id FROM bank_accounts k JOIN users u ON u.id=k.user_id
  WHERE u.role='king' AND k.bank='national' AND k.id<>NEW.id ORDER BY k.id LIMIT 1);
END;
