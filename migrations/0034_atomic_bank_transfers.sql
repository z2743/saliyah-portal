-- Phase 34: a transfer's ledger entry and both balance updates are one SQLite statement.
CREATE TRIGGER IF NOT EXISTS bank_transfer_validate BEFORE INSERT ON bank_transfers
BEGIN
 SELECT CASE WHEN NEW.amount > 100000000 THEN RAISE(ABORT,'transfer_limit') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM bank_accounts WHERE id=NEW.sender_account AND balance>=NEW.amount)
  THEN RAISE(ABORT,'insufficient_funds') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM bank_accounts WHERE id=NEW.recipient_account)
  THEN RAISE(ABORT,'recipient_missing') END;
END;
CREATE TRIGGER IF NOT EXISTS bank_transfer_apply AFTER INSERT ON bank_transfers
BEGIN
 UPDATE bank_accounts SET balance=balance-NEW.amount WHERE id=NEW.sender_account AND balance>=NEW.amount;
 SELECT CASE WHEN changes()!=1 THEN RAISE(ABORT,'insufficient_funds') END;
 UPDATE bank_accounts SET balance=balance+NEW.amount WHERE id=NEW.recipient_account;
 SELECT CASE WHEN changes()!=1 THEN RAISE(ABORT,'recipient_missing') END;
END;
