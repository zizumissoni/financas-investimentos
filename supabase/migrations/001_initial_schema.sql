-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enums
CREATE TYPE category_group AS ENUM (
  'RENDA_PASSIVA',
  'RENDA_ATIVA_PJ',
  'RENDA_ATIVA_INV',
  'DESPESAS_ESSENCIAIS',
  'DESPESAS_DISCRICIONARIAS'
);

CREATE TYPE entry_type AS ENUM ('RECEITA', 'DESPESA');

CREATE TYPE asset_class AS ENUM (
  'ACAO_BR', 'FII', 'CRI_CRA_DEB', 'EUA_RENDA', 'RFIXA_BR', 'ETF', 'CRIPTO', 'OUTRO'
);

CREATE TYPE income_record_type AS ENUM (
  'DIVIDENDO', 'AMORTIZACAO', 'JUROS', 'JCP', 'RENDIMENTO'
);

CREATE TYPE bill_status AS ENUM ('PENDENTE', 'PAGO', 'ATRASADO');

CREATE TYPE recurrence_type AS ENUM (
  'NENHUMA', 'MENSAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL'
);

-- Categories (seeded, read-only for users)
CREATE TABLE categories (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  group_name    category_group NOT NULL,
  entry_type    entry_type NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Monthly Entries
CREATE TABLE monthly_entries (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id   UUID NOT NULL REFERENCES categories(id),
  year          SMALLINT NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  month         SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  realizado     NUMERIC(15,2) NOT NULL DEFAULT 0,
  orcado        NUMERIC(15,2) NOT NULL DEFAULT 0,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, category_id, year, month)
);

CREATE INDEX idx_monthly_entries_user_year ON monthly_entries(user_id, year);

-- Assets
CREATE TABLE assets (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticker      TEXT NOT NULL,
  asset_class asset_class NOT NULL,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, ticker)
);

CREATE INDEX idx_assets_user ON assets(user_id);

-- Income Records
CREATE TABLE income_records (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_id    UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  year        SMALLINT NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  month       SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  amount      NUMERIC(15,2) NOT NULL CHECK (amount >= 0),
  record_type income_record_type NOT NULL DEFAULT 'DIVIDENDO',
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_income_records_user_year ON income_records(user_id, year);
CREATE INDEX idx_income_records_asset ON income_records(asset_id);

-- Patrimony Items
CREATE TABLE patrimony_items (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  category      TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_patrimony_items_user ON patrimony_items(user_id);

-- Patrimony Values
CREATE TABLE patrimony_values (
  id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id  UUID NOT NULL REFERENCES patrimony_items(id) ON DELETE CASCADE,
  year     SMALLINT NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  value    NUMERIC(18,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, item_id, year)
);

CREATE INDEX idx_patrimony_values_user_year ON patrimony_values(user_id, year);

-- Bills
CREATE TABLE bills (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description    TEXT NOT NULL,
  amount         NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  due_date       DATE NOT NULL,
  category       TEXT NOT NULL DEFAULT 'Outros',
  status         bill_status NOT NULL DEFAULT 'PENDENTE',
  is_recurrent   BOOLEAN NOT NULL DEFAULT FALSE,
  recurrence     recurrence_type NOT NULL DEFAULT 'NENHUMA',
  paid_at        TIMESTAMPTZ,
  parent_bill_id UUID REFERENCES bills(id),
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bills_user_due ON bills(user_id, due_date);
CREATE INDEX idx_bills_user_status ON bills(user_id, status);
