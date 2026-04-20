-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_monthly_entries_updated_at
  BEFORE UPDATE ON monthly_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_assets_updated_at
  BEFORE UPDATE ON assets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_income_records_updated_at
  BEFORE UPDATE ON income_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_patrimony_items_updated_at
  BEFORE UPDATE ON patrimony_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_patrimony_values_updated_at
  BEFORE UPDATE ON patrimony_values FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_bills_updated_at
  BEFORE UPDATE ON bills FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-compute bill status
CREATE OR REPLACE FUNCTION sync_bill_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.paid_at IS NOT NULL THEN
    NEW.status = 'PAGO';
  ELSIF NEW.due_date < CURRENT_DATE THEN
    NEW.status = 'ATRASADO';
  ELSE
    NEW.status = 'PENDENTE';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bills_sync_status
  BEFORE INSERT OR UPDATE ON bills FOR EACH ROW EXECUTE FUNCTION sync_bill_status();

-- Generate next recurrence
CREATE OR REPLACE FUNCTION generate_next_bill(p_bill_id UUID)
RETURNS UUID AS $$
DECLARE
  v_bill bills%ROWTYPE;
  v_next_due DATE;
  v_new_id UUID;
BEGIN
  SELECT * INTO v_bill FROM bills WHERE id = p_bill_id;
  IF NOT FOUND OR NOT v_bill.is_recurrent OR v_bill.recurrence = 'NENHUMA' THEN
    RETURN NULL;
  END IF;
  v_next_due := CASE v_bill.recurrence
    WHEN 'MENSAL'     THEN v_bill.due_date + INTERVAL '1 month'
    WHEN 'TRIMESTRAL' THEN v_bill.due_date + INTERVAL '3 months'
    WHEN 'SEMESTRAL'  THEN v_bill.due_date + INTERVAL '6 months'
    WHEN 'ANUAL'      THEN v_bill.due_date + INTERVAL '1 year'
  END;
  INSERT INTO bills (user_id, description, amount, due_date, category, is_recurrent, recurrence, parent_bill_id, notes)
  VALUES (v_bill.user_id, v_bill.description, v_bill.amount, v_next_due, v_bill.category, v_bill.is_recurrent, v_bill.recurrence, v_bill.id, v_bill.notes)
  RETURNING id INTO v_new_id;
  RETURN v_new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
