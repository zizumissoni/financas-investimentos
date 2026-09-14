-- Transfers between the user's own bank accounts. No in-place edit in v1 —
-- editing means delete + recreate (the delete trigger reverses the balances).

CREATE TABLE account_transfers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_account_id  UUID NOT NULL REFERENCES bank_accounts(id),
  to_account_id    UUID NOT NULL REFERENCES bank_accounts(id),
  amount           NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  date             DATE NOT NULL,
  description      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (from_account_id <> to_account_id)
);

CREATE INDEX idx_account_transfers_user_date ON account_transfers(user_id, date);

ALTER TABLE account_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own account_transfers"
  ON account_transfers FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION fn_transfers_apply_effects()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE bank_accounts SET balance = balance + OLD.amount, updated_at = NOW() WHERE id = OLD.from_account_id;
    UPDATE bank_accounts SET balance = balance - OLD.amount, updated_at = NOW() WHERE id = OLD.to_account_id;
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    UPDATE bank_accounts SET balance = balance - NEW.amount, updated_at = NOW() WHERE id = NEW.from_account_id;
    UPDATE bank_accounts SET balance = balance + NEW.amount, updated_at = NOW() WHERE id = NEW.to_account_id;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_account_transfers_apply_effects
  AFTER INSERT OR DELETE ON account_transfers
  FOR EACH ROW EXECUTE FUNCTION fn_transfers_apply_effects();
