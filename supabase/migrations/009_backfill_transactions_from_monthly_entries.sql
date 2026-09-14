-- One-time backfill: create a transaction per (category, year, month) that
-- already has a non-negative realizado in monthly_entries, linked to
-- "Carteira - $", so the Transações tab and its category/conta filters
-- return historical data entered before the transactions table existed.
--
-- Negative-realizado rows (losses on asset sales — 12 rows at the time this
-- ran) are skipped: transactions.amount requires amount > 0 (direction comes
-- from `type`, which can't represent a negative RECEITA). Those stay as
-- manual-only entries in monthly_entries.
--
-- Idempotent: re-running only inserts rows that don't already have a
-- matching "Migrado de <categoria>" transaction for that category/month/amount.
INSERT INTO transactions (user_id, type, category_id, bank_account_id, amount, date, description, is_settled, is_ignored)
SELECT
  me.user_id,
  c.entry_type,
  me.category_id,
  ba.id,
  me.realizado,
  make_date(me.year, me.month, 1),
  'Migrado de ' || c.name,
  true,
  false
FROM monthly_entries me
JOIN categories c ON c.id = me.category_id
JOIN bank_accounts ba ON ba.user_id = me.user_id AND ba.name = 'Carteira - $'
WHERE me.realizado > 0
  AND NOT EXISTS (
    SELECT 1 FROM transactions t
    WHERE t.category_id = me.category_id AND t.user_id = me.user_id
      AND t.date = make_date(me.year, me.month, 1)
      AND t.amount = me.realizado
      AND t.description = 'Migrado de ' || c.name
  );
