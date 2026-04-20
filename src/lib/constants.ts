import type { AssetClass, InvestmentRecordType } from '@/types/finance.types'

// ── Investimentos ─────────────────────────────────────────────────────────────
export const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  ACAO_BR:     'Ação BR',
  FII:         'FII',
  CRI_CRA_DEB: 'CRI/CRA/DÊB',
  EUA_RENDA:   'EUA-Renda',
  RFIXA_BR:    'R.Fixa BR',
  ETF:         'ETF',
  CRIPTO:      'Cripto',
  OUTRO:       'Outro',
}

export const CHART_COLORS: Record<AssetClass, string> = {
  ACAO_BR:     '#3B82F6',
  FII:         '#10B981',
  CRI_CRA_DEB: '#F59E0B',
  EUA_RENDA:   '#8B5CF6',
  RFIXA_BR:    '#06B6D4',
  ETF:         '#EC4899',
  CRIPTO:      '#F97316',
  OUTRO:       '#6B7280',
}

export const INVESTMENT_TYPE_LABELS: Record<InvestmentRecordType, string> = {
  DIVIDENDO:   'Dividendo',
  JCP:         'JCP',
  RENDIMENTO:  'Rendimento',
  JUROS:       'Juros',
  AMORTIZACAO: 'Amortização',
  VENDA:       'Venda de Ativo',
}

export const BANK_ACCOUNTS_LIST = ['Giovani', 'Adriele', 'Luizão', 'Elenir']

export const PROVENTO_TYPES: InvestmentRecordType[] = ['DIVIDENDO', 'JCP', 'RENDIMENTO', 'JUROS', 'AMORTIZACAO']

// ── Orçamento ─────────────────────────────────────────────────────────────────
export const CATEGORY_GROUP_LABELS = {
  RENDA_PASSIVA: 'Renda Passiva',
  RENDA_ATIVA_PJ: 'Renda Ativa - P. Jurídica',
  RENDA_ATIVA_INV: 'Renda Ativa - Investimentos',
  DESPESAS_ESSENCIAIS: 'Despesas Essenciais',
  DESPESAS_DISCRICIONARIAS: 'Despesas Discricionárias',
} as const

export const RECURRENCE_LABELS = {
  NENHUMA: 'Não recorrente',
  MENSAL: 'Mensal',
  TRIMESTRAL: 'Trimestral',
  SEMESTRAL: 'Semestral',
  ANUAL: 'Anual',
} as const

export const BILL_CATEGORIES = [
  'Moradia', 'Transporte', 'Saúde', 'Educação', 'Alimentação',
  'Lazer', 'Financiamentos', 'Impostos', 'Seguros', 'Serviços', 'Outros',
]

export const PATRIMONY_CATEGORIES = [
  'Imóveis', 'Veículos', 'Renda Fixa', 'Renda Variável', 'FIIs',
  'Previdência', 'Criptoativos', 'Exterior', 'Outros',
]

// Categorias de Aportes/Resgates — devem coincidir com o "Nome do Bem" no patrimônio
export const CONTRIBUTION_CATEGORIES = [
  'Nubank - RDBs',
  'BTG - Renda Fixa',
  'BTG - Tesouro Direto',
  'C6 - Renda Fixa',
  'ETFs - Renda Fixa',
  'Nubank - Renda Fixa',
  'Nubank - Tesouro Direto',
  'Rico - Renda Fixa',
  'Rico - Tesouro Direto',
  'Inter - Renda Fixa',
  'Inter - Tesouro Direto',
]
