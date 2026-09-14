-- Planejamento Anual independente: metas por categoria/ano, sem relação com
-- o orçado mensal (monthly_entries.orcado, usado pelo Planejamento Mensal).
-- "Despesas pagas" no modo anual continuam vindo do realizado real (soma dos
-- 12 meses) — só a meta é um valor à parte, definido uma vez por ano.

CREATE TABLE annual_budgets (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id),
  year        SMALLINT NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  amount      NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, category_id, year)
);

CREATE INDEX idx_annual_budgets_user_year ON annual_budgets(user_id, year);

ALTER TABLE annual_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own annual_budgets"
  ON annual_budgets FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_annual_budgets_updated_at
  BEFORE UPDATE ON annual_budgets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
