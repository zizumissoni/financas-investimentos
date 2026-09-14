-- Adds the "Carteira - $" (cash wallet) bank account, available alongside the
-- other seeded accounts in the Nova Receita/Despesa/Transferência selectors.
INSERT INTO bank_accounts (user_id, name, display_order)
SELECT u.id, 'Carteira - $', 5
FROM auth.users u
ON CONFLICT (user_id, name) DO NOTHING;
