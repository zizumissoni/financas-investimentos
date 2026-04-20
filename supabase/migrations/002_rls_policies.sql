-- Enable RLS
ALTER TABLE monthly_entries   ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets            ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_records    ENABLE ROW LEVEL SECURITY;
ALTER TABLE patrimony_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE patrimony_values  ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills             ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories        ENABLE ROW LEVEL SECURITY;

-- categories: readable by all authenticated users
CREATE POLICY "Categories readable by authenticated"
  ON categories FOR SELECT TO authenticated USING (TRUE);

-- monthly_entries
CREATE POLICY "Users manage own entries"
  ON monthly_entries FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- assets
CREATE POLICY "Users manage own assets"
  ON assets FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- income_records
CREATE POLICY "Users manage own income records"
  ON income_records FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- patrimony_items
CREATE POLICY "Users manage own patrimony items"
  ON patrimony_items FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- patrimony_values
CREATE POLICY "Users manage own patrimony values"
  ON patrimony_values FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- bills
CREATE POLICY "Users manage own bills"
  ON bills FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
