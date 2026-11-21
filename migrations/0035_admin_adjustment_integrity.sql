-- Phase 35: serialize administrative balance adjustments with an append-only ledger.
CREATE TRIGGER IF NOT EXISTS bank_adjustment_validate BEFORE INSERT ON bank_adjustments BEGIN
 SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM bank_accounts WHERE id=NEW.account_id AND balance=NEW.previous_balance)
 THEN RAISE(ABORT,'stale_account_balance') END;
 SELECT CASE WHEN NEW.mode='set' AND NEW.new_balance<>NEW.amount THEN RAISE(ABORT,'invalid_set') END;
 SELECT CASE WHEN NEW.mode='add' AND NEW.new_balance<>NEW.previous_balance+ABS(NEW.amount) THEN RAISE(ABORT,'invalid_add') END;
 SELECT CASE WHEN NEW.mode='subtract' AND NEW.new_balance<>NEW.previous_balance-ABS(NEW.amount) THEN RAISE(ABORT,'invalid_subtract') END;
 SELECT CASE WHEN ABS(NEW.amount)>100000000 OR ABS(NEW.new_balance)>1000000000 OR LENGTH(TRIM(NEW.reason))<5
 THEN RAISE(ABORT,'invalid_adjustment') END;
END;
CREATE TRIGGER IF NOT EXISTS bank_adjustment_apply AFTER INSERT ON bank_adjustments BEGIN
 UPDATE bank_accounts SET balance=NEW.new_balance WHERE id=NEW.account_id AND balance=NEW.previous_balance;
 SELECT CASE WHEN changes()!=1 THEN RAISE(ABORT,'stale_account_balance') END;
END;
CREATE TRIGGER IF NOT EXISTS bank_adjustment_no_update BEFORE UPDATE ON bank_adjustments BEGIN SELECT RAISE(ABORT,'immutable_ledger'); END;
CREATE TRIGGER IF NOT EXISTS bank_adjustment_no_delete BEFORE DELETE ON bank_adjustments BEGIN SELECT RAISE(ABORT,'immutable_ledger'); END;
