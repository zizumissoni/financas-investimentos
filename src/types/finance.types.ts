// ── Investimentos ────────────────────────────────────────────────────────────
export type AssetClass =
  | 'ACAO_BR' | 'FII' | 'CRI_CRA_DEB' | 'EUA_RENDA'
  | 'RFIXA_BR' | 'ETF' | 'CRIPTO' | 'OUTRO'

export type InvestmentRecordType =
  | 'DIVIDENDO' | 'JCP' | 'RENDIMENTO' | 'JUROS' | 'AMORTIZACAO' | 'VENDA'

export interface InvestmentRecord {
  id: string
  user_id: string
  ticker: string
  asset_class: AssetClass
  record_type: InvestmentRecordType
  year: number
  month: number
  amount: number          // positivo = ganho; negativo = perda (vendas)
  bank_account: string
  is_taxable: boolean
  notes?: string
  created_at: string
}

// ── Orçamento / Receitas-Despesas ─────────────────────────────────────────────
export type CategoryGroup =
  | 'RENDA_PASSIVA'
  | 'RENDA_ATIVA_PJ'
  | 'RENDA_ATIVA_INV'
  | 'DESPESAS_ESSENCIAIS'
  | 'DESPESAS_DISCRICIONARIAS'

export type EntryType = 'RECEITA' | 'DESPESA'

export type BillStatus = 'PENDENTE' | 'PAGO' | 'ATRASADO'

export type RecurrenceType = 'NENHUMA' | 'MENSAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL'

export interface Category {
  id: string
  name: string
  group_name: CategoryGroup
  entry_type: EntryType
  display_order: number
  is_active: boolean
}

export interface MonthlyEntry {
  id: string
  user_id: string
  category_id: string
  year: number
  month: number
  realizado: number
  orcado: number
  notes?: string
}

export type MonthlyEntryMap = Record<
  string, // category_id
  Record<number, { realizado: number; orcado: number; id: string }>
>

export interface PatrimonyItem {
  id: string
  user_id: string
  name: string
  category: string
  display_order: number
  is_active: boolean
  owner: string // 'Giovani' | 'Adriele'
}

export interface PatrimonyValue {
  id: string
  user_id: string
  item_id: string
  year: number
  value: number
}

export interface PatrimonyContribution {
  id: string
  user_id: string
  date: string        // 'YYYY-MM-DD'
  description: string
  category: string    // matches "Nome do Bem" in patrimony items
  type: 'APORTE' | 'RESGATE'
  amount: number
  account: string     // 'Giovani' | 'Adriele'
  created_at: string
}

export interface Bill {
  id: string
  user_id: string
  description: string
  amount: number
  due_date: string
  category: string
  status: BillStatus
  is_recurrent: boolean
  recurrence: RecurrenceType
  paid_at?: string | null
  parent_bill_id?: string | null
  notes?: string | null
  created_at: string
}

export interface DashboardSummary {
  year: number
  total_renda_passiva: number
  total_receitas: number
  total_despesas: number
  saldo: number
  pct_gasta: number
}

