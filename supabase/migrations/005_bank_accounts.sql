-- Bank accounts: independent from BANK_ACCOUNTS_LIST (owner tags used in
-- investment_records / patrimony_contributions) — these are real bank/broker
-- accounts with a running balance, managed on the "Contas" tab.

CREATE TABLE bank_accounts (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  balance       NUMERIC(15,2) NOT NULL DEFAULT 0,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, name)
);

CREATE INDEX idx_bank_accounts_user ON bank_accounts(user_id);

ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own bank_accounts"
  ON bank_accounts FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_bank_accounts_updated_at
  BEFORE UPDATE ON bank_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed default accounts for every existing user (single-tenant/family app —
-- same pragmatic pattern as other seed migrations in this project)
INSERT INTO bank_accounts (user_id, name, display_order)
SELECT u.id, acct.name, acct.ord
FROM auth.users u
CROSS JOIN (VALUES
  ('BTG - C/C', 10),
  ('Nuconta', 20),
  ('BB - C/C', 30),
  ('Adriele PJ', 40),
  ('C6 - Investimentos', 50),
  ('BTG - Investimentos', 60),
  ('Banco Inter', 70),
  ('Adriele - Nubank PF', 80),
  ('BB - Poupança', 90),
  ('Grão - Previdência', 100),
  ('BTC - Bity', 110),
  ('Cold Walet', 120),
  ('Luizão', 130),
  ('Elenir', 140),
  ('Vandré', 150),
  ('Nomad - Giovani', 160),
  ('Nomad - Adriele', 170),
  ('Revolut', 180),
  ('Wise', 190),
  ('Nuinvest', 200),
  ('Rico', 210),
  ('Veros', 220)
) AS acct(name, ord)
ON CONFLICT (user_id, name) DO NOTHING;
