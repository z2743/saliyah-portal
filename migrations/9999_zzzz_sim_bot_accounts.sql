-- All fictional citizens, including newcomers created on later simulation cycles, can
-- receive transfers and participate as owners in the citizen-facing virtual market.
-- Only missing accounts are added; no existing balances or numbers are overwritten.
INSERT OR IGNORE INTO saliyah_sim_bank_accounts(id,owner_type,owner_id,account_number,bank_name,balance)
SELECT 'sim-bank-c-'||c.id,'citizen',c.id,'SC-SIM-'||c.id,'البنك الصالي',800
FROM saliyah_sim_citizens c
LEFT JOIN saliyah_sim_bank_accounts a ON a.owner_type='citizen' AND a.owner_id=c.id
WHERE a.id IS NULL;
