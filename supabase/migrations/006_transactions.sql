-- Individual dated transactions (Nova Receita / Nova Despesa modals), with
-- optional installment grouping. On insert/update/delete, a trigger keeps
-- two things in sync:
--   1) bank_accounts.balance — only rows with is_settled = true AND
--      is_ignored = false affect the balance (RECEITA adds, DESPESA subtracts).
--   2) monthly_entries.realizado for the row's (category_id, year, month) —
--      recomputed as the sum of settled, non-ignored transactions in that
--      category/month (orcado is preserved, same convention as the existing
--      investment→entries sync in src/lib/investmentSync.ts).

CREATE TABLE transactions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type                  entry_type NOT NULL,
  category_id           UUID NOT NULL REFERENCES categories(id),
  bank_account_id       UUID NOT NULL REFERENCES bank_accounts(id),
  amount                NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  date                  DATE NOT NULL,
  description           TEXT,
  is_settled            BOOLEAN NOT NULL DEFAULT TRUE,
  is_ignored            BOOLEAN NOT NULL DEFAULT FALSE,
  installment_group_id  UUID,
  installment_number    SMALLINT,
  installment_total     SMALLINT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_user_date ON transactions(user_id, date);
CREATE INDEX idx_transactions_category ON transactions(category_id);
CREATE INDEX idx_transactions_bank_account ON transactions(bank_account_id);
CREATE INDEX idx_transactions_installment_group ON transactions(installment_group_id);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own transactions"
  ON transactions FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION fn_recompute_category_month(
  p_user_id UUID, p_category_id UUID, p_year NUMERIC, p_month NUMERIC
) RETURNS VOID AS $$
DECLARE
  v_realizado NUMERIC;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_realizado
    FROM transactions
    WHERE user_id = p_user_id AND category_id = p_category_id
      AND EXTRACT(YEAR FROM date) = p_year AND EXTRACT(MONTH FROM date) = p_month
      AND is_settled AND NOT is_ignored;

  INSERT INTO monthly_entries (user_id, category_id, year, month, realizado, orcado)
    VALUES (p_user_id, p_category_id, p_year, p_month, v_realizado, 0)
    ON CONFLICT (user_id, category_id, year, month)
    DO UPDATE SET realizado = EXCLUDED.realizado, updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;

REVOKE EXECUTE ON FUNCTION fn_recompute_category_month(UUID, UUID, NUMERIC, NUMERIC) FROM anon, authenticated;

CREATE OR REPLACE FUNCTION fn_transactions_apply_effects()
RETURNS TRIGGER AS $$
DECLARE
  v_old_effect NUMERIC := 0;
  v_new_effect NUMERIC := 0;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    IF OLD.is_settled AND NOT OLD.is_ignored THEN
      v_old_effect := CASE WHEN OLD.type = 'RECEITA' THEN OLD.amount ELSE -OLD.amount END;
    END IF;
    IF v_old_effect <> 0 THEN
      UPDATE bank_accounts SET balance = balance - v_old_effect, updated_at = NOW()
        WHERE id = OLD.bank_account_id;
    END IF;
    PERFORM fn_recompute_category_month(OLD.user_id, OLD.category_id, EXTRACT(YEAR FROM OLD.date), EXTRACT(MONTH FROM OLD.date));
  END IF;

  IF TG_OP IN ('UPDATE', 'INSERT') THEN
    IF NEW.is_settled AND NOT NEW.is_ignored THEN
      v_new_effect := CASE WHEN NEW.type = 'RECEITA' THEN NEW.amount ELSE -NEW.amount END;
    END IF;
    IF v_new_effect <> 0 THEN
      UPDATE bank_accounts SET balance = balance + v_new_effect, updated_at = NOW()
        WHERE id = NEW.bank_account_id;
    END IF;
    PERFORM fn_recompute_category_month(NEW.user_id, NEW.category_id, EXTRACT(YEAR FROM NEW.date), EXTRACT(MONTH FROM NEW.date));
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_transactions_apply_effects
  AFTER INSERT OR UPDATE OR DELETE ON transactions
  FOR EACH ROW EXECUTE FUNCTION fn_transactions_apply_effects();
