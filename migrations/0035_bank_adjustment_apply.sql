-- Apply new administrative balance adjustments atomically. Historical entries are not replayed automatically.
CREATE TRIGGER IF NOT EXISTS bank_adjustment_apply AFTER INSERT ON bank_adjustments
BEGIN
 SELECT CASE WHEN (SELECT balance FROM bank_accounts WHERE id=NEW.account_id) != NEW.previous_balance THEN RAISE(ABORT,'stale bank balance') END;
 UPDATE bank_accounts SET balance=NEW.new_balance WHERE id=NEW.account_id;
END;
