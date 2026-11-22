-- Prevent duplicate collection on incoming credits: 0057 replaces the older 0056 handler.
-- Existing historical collections are preserved.
DROP TRIGGER IF EXISTS debt_collect_on_credit;
-- Keep the single remittance trigger installed by 0057.
