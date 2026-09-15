import { useState, useRef, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useYear } from '@/contexts/YearContext'
import {
  useInvestmentRecords,
  useAllInvestmentRecords,
  useCreateInvestmentRecord,
  useUpdateInvestmentRecord,
  useDeleteInvestmentRecord,
} from '@/hooks/useInvestment'
import { bulkCreateInvestmentRecords } from '@/services/investment.service'
import { useSyncInvestmentToEntries } from '@/hooks/useSyncInvestmentToEntries'
import { useAuth } from '@/hooks/useAuth'
import { formatCurrency, formatMonth, getCurrentYear, getCurrentMonth } from '@/lib/utils'
import {
  ASSET_CLASS_LABELS,
  CHART_COLORS,
  INVESTMENT_TYPE_LABELS,
  BANK_ACCOUNTS_LIST,
  PROVENTO_TYPES,
} from '@/lib/constants'
import { KPICard } from '@/components/shared/KPICard'
import { LoadingPage } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/hooks/useToast'
import { cn } from '@/lib/utils'
import type { AssetClass, InvestmentRecord, InvestmentRecordType } from '@/types/finance.types'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, ComposedChart, Line,
} from 'recharts'
import {
  Plus, Trash2, Pencil, TrendingUp, Download, Upload, FileSpreadsheet,
  CheckCircle, XCircle, X, BarChart3, Search, ArrowUpDown, ArrowUp, ArrowDown,
} from 'lucide-react'

// ─── Constantes locais ────────────────────────────────────────────────────────
const ASSET_CLASSES = Object.keys(ASSET_CLASS_LABELS) as AssetClass[]
const INVESTMENT_TYPES = Object.keys(INVESTMENT_TYPE_LABELS) as InvestmentRecordType[]
const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const MONTHS_FULL  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const BLANK_FORM = (yr: number) => ({
  ticker: '', asset_class: 'FII' as AssetClass,
  record_type: 'DIVIDENDO' as InvestmentRecordType,
  month: new Date().getMonth() + 1, year: yr,
  amount: '', bank_account: 'Giovani', is_taxable: false, notes: '',
})

// ─── Normalização CSV ─────────────────────────────────────────────────────────
const CLASS_MAP: Record<string, AssetClass> = {
  'ACAO_BR': 'ACAO_BR', 'AÇÃO BR': 'ACAO_BR', 'AÇÃO_BR': 'ACAO_BR',
  'ACAOBR': 'ACAO_BR', 'AÇÕES BR': 'ACAO_BR', 'AÇAO BR': 'ACAO_BR',
  'FII': 'FII',
  'CRI_CRA_DEB': 'CRI_CRA_DEB', 'CRI/CRA/DEB': 'CRI_CRA_DEB',
  'CRI/CRA/DÊB': 'CRI_CRA_DEB', 'CRI/CRA': 'CRI_CRA_DEB',
  'RFIXA_BR': 'RFIXA_BR', 'R.FIXA BR': 'RFIXA_BR', 'RFIXA BR': 'RFIXA_BR',
  'R FIXA BR': 'RFIXA_BR', 'RENDAFIXA': 'RFIXA_BR',
  'EUA_RENDA': 'EUA_RENDA', 'EUA-RENDA': 'EUA_RENDA', 'EUA RENDA': 'EUA_RENDA',
  'EUARENDA': 'EUA_RENDA',
  'ETF': 'ETF', 'CRIPTO': 'CRIPTO', 'OUTRO': 'OUTRO',
}
const TYPE_MAP: Record<string, InvestmentRecordType> = {
  'DIVIDENDO': 'DIVIDENDO', 'DIVIDENDOS': 'DIVIDENDO', 'JCP': 'JCP',
  'RENDIMENTO': 'RENDIMENTO', 'RENDIMENTOS': 'RENDIMENTO', 'JUROS': 'JUROS',
  'AMORTIZACAO': 'AMORTIZACAO', 'AMORTIZAÇÃO': 'AMORTIZACAO', 'AMORTIZACÃO': 'AMORTIZACAO',
  'VENDA': 'VENDA', 'VENDA DE ATIVO': 'VENDA',
}
function normalizeClass(raw: string): AssetClass | null {
  const up = raw.trim().toUpperCase()
  const stripped = up.replace('Ç','C').replace('Ã','A').replace('Á','A').replace('É','E').replace('Ê','E').replace('Ó','O')
  return CLASS_MAP[up] ?? CLASS_MAP[stripped] ?? null
}
function normalizeType(raw: string): InvestmentRecordType | null {
  return TYPE_MAP[raw.trim().toUpperCase()] ?? null
}
function normalizeTaxable(raw: string): boolean {
  return ['S','SIM','YES','TRUE','1'].includes(raw.trim().toUpperCase())
}

// ─── Modal resultado importação ───────────────────────────────────────────────
function ImportResultModal({ result, onClose }: {
  result: { success: number; skipped?: number; errors: string[]; title?: string }
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className={cn('px-6 py-4 flex items-center justify-between',
          result.errors.length === 0 ? 'bg-green-50 border-b border-green-100' : 'bg-amber-50 border-b border-amber-100'
        )}>
          <div className="flex items-center gap-2">
            {result.errors.length === 0 ? <CheckCircle size={20} className="text-green-600" /> : <XCircle size={20} className="text-amber-600" />}
            <h2 className="font-bold text-gray-800">{result.title ?? 'Resultado da Importação'}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-3">
          <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl border border-green-100">
            <CheckCircle size={20} className="text-green-600 shrink-0" />
            <div>
              <p className="text-sm font-bold text-green-800">{result.success} registro(s) importado(s)</p>
              <p className="text-xs text-green-600">Salvos com sucesso</p>
            </div>
          </div>
          {(result.skipped ?? 0) > 0 && (
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
              <CheckCircle size={20} className="text-blue-400 shrink-0" />
              <div>
                <p className="text-sm font-bold text-blue-700">{result.skipped} linha(s) ignorada(s)</p>
                <p className="text-xs text-blue-500">Linhas em branco ou inválidas puladas</p>
              </div>
            </div>
          )}
          {result.errors.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-red-700 flex items-center gap-1.5"><XCircle size={13} /> {result.errors.length} erro(s):</p>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {result.errors.map((e, i) => <p key={i} className="text-xs text-gray-600 bg-red-50 px-3 py-1.5 rounded-lg">{e}</p>)}
              </div>
            </div>
          )}
        </div>
        <div className="px-6 pb-5">
          <button onClick={onClose} className="w-full bg-blue-600 text-white text-sm py-2.5 rounded-xl hover:bg-blue-700 transition-colors font-semibold">Fechar</button>
        </div>
      </div>
    </div>
  )
}

// ─── Tooltip gráfico mensal (fix duplicação) ──────────────────────────────────
function MonthlyTooltip({ active, payload, label }: {
  active?: boolean; payload?: { dataKey: string; name: string; value: number; color: string }[]; label?: string
}) {
  if (!active || !payload?.length) return null
  // exclui a linha "total" do payload de barras para não duplicar
  const bars = payload.filter(p => p.dataKey !== 'total')
  const total = bars.reduce((s, p) => s + (p.value ?? 0), 0)
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs min-w-[170px]">
      <p className="font-bold text-gray-700 mb-2">{label}</p>
      {bars.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-semibold">{formatCurrency(p.value)}</span>
        </div>
      ))}
      {bars.length > 1 && (
        <div className="flex justify-between pt-2 mt-1 border-t border-gray-100 font-bold text-gray-800">
          <span>Total</span><span>{formatCurrency(total)}</span>
        </div>
      )}
    </div>
  )
}

// Tooltip genérico
function CurrencyTooltip({ active, payload, label }: {
  active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string
}) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s, p) => s + (p.value ?? 0), 0)
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs min-w-[160px]">
      <p className="font-bold text-gray-700 mb-2">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-semibold">{formatCurrency(p.value)}</span>
        </div>
      ))}
      {payload.length > 1 && (
        <div className="flex justify-between pt-2 mt-1 border-t border-gray-100 font-bold text-gray-800">
          <span>Total</span><span>{formatCurrency(total)}</span>
        </div>
      )}
    </div>
  )
}

// ─── Ícone de ordenação ───────────────────────────────────────────────────────
function SortIcon({ col, sortConfig }: { col: string; sortConfig: { col: string; dir: 'asc'|'desc' } | null }) {
  if (!sortConfig || sortConfig.col !== col) return <ArrowUpDown size={11} className="text-gray-300 ml-1 inline" />
  return sortConfig.dir === 'asc'
    ? <ArrowUp size={11} className="text-violet-500 ml-1 inline" />
    : <ArrowDown size={11} className="text-violet-500 ml-1 inline" />
}

// ─── Formulário compartilhado criar/editar ────────────────────────────────────
function RecordForm({ form, setForm }: {
  form: ReturnType<typeof BLANK_FORM>
  setForm: React.Dispatch<React.SetStateAction<ReturnType<typeof BLANK_FORM>>>
}) {
  return (
    <div className="space-y-4 py-2">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Ticker / Ativo</Label>
          <Input placeholder="MXRF11, PETR4..." value={form.ticker}
            onChange={e => setForm(p => ({ ...p, ticker: e.target.value.toUpperCase() }))} />
        </div>
        <div className="space-y-1.5">
          <Label>Classe</Label>
          <Select value={form.asset_class} onValueChange={v => setForm(p => ({ ...p, asset_class: v as AssetClass }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{ASSET_CLASSES.map(c => <SelectItem key={c} value={c}>{ASSET_CLASS_LABELS[c]}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Tipo de Lançamento</Label>
        <Select value={form.record_type} onValueChange={v => setForm(p => ({ ...p, record_type: v as InvestmentRecordType }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {PROVENTO_TYPES.map(t => <SelectItem key={t} value={t}>{INVESTMENT_TYPE_LABELS[t]}</SelectItem>)}
            <SelectItem value="VENDA">{INVESTMENT_TYPE_LABELS['VENDA']}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Mês</Label>
          <Select value={String(form.month)} onValueChange={v => setForm(p => ({ ...p, month: Number(v) }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{MONTHS_SHORT.map((m, i) => <SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Ano</Label>
          <Input type="number" value={form.year} onChange={e => setForm(p => ({ ...p, year: Number(e.target.value) }))} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Valor (R$) {form.record_type === 'VENDA' && <span className="text-xs text-gray-400 ml-1">— negativo = perda</span>}</Label>
        <Input type="number" step="0.01" placeholder="0,00" value={form.amount}
          onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />
      </div>
      <div className="space-y-1.5">
        <Label>Conta Bancária</Label>
        <Select value={form.bank_account} onValueChange={v => setForm(p => ({ ...p, bank_account: v }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{BANK_ACCOUNTS_LIST.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-between py-1">
        <div>
          <Label className="text-sm">Tributável</Label>
          <p className="text-xs text-gray-400">Sujeito a Imposto de Renda</p>
        </div>
        <Switch checked={form.is_taxable} onCheckedChange={v => setForm(p => ({ ...p, is_taxable: v }))} />
      </div>
      <div className="space-y-1.5">
        <Label>Observações (opcional)</Label>
        <Input placeholder="Notas adicionais..." value={form.notes}
          onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
export function InvestmentIncomePage() {
  const { year } = useYear()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  // ── Filtros e busca ────────────────────────────────────────────────────────
  const [filterClass, setFilterClass]   = useState<AssetClass | 'ALL'>('ALL')
  const [filterType,  setFilterType]    = useState<'ALL' | 'PROVENTOS' | 'VENDAS'>('ALL')
  const [searchQuery, setSearchQuery]   = useState('')

  // Seletor temporal
  const [timeMode,    setTimeMode]      = useState<'anual' | 'mensal' | 'custom'>('anual')
  const [filterMonth, setFilterMonth]   = useState(new Date().getMonth() + 1)
  const [customFrom,  setCustomFrom]    = useState(1)
  const [customTo,    setCustomTo]      = useState(12)

  // Ordenação
  const [sortConfig, setSortConfig]     = useState<{ col: string; dir: 'asc' | 'desc' } | null>(null)

  // Diálogos
  const [dialogMode,  setDialogMode]    = useState<'create' | 'edit' | null>(null)
  const [editRecord,  setEditRecord]    = useState<InvestmentRecord | null>(null)
  const [deleteId,    setDeleteId]      = useState<string | null>(null)
  const [importing,   setImporting]     = useState(false)
  const [importResult, setImportResult] = useState<{
    success: number; skipped?: number; errors: string[]; title?: string
  } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Formulário
  const [form, setForm] = useState(BLANK_FORM(year))

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: records = [], isLoading } = useInvestmentRecords(year)
  const { data: allRecords = [] }         = useAllInvestmentRecords()
  const createRecord  = useCreateInvestmentRecord()
  const updateRecord  = useUpdateInvestmentRecord()
  const deleteRecord  = useDeleteInvestmentRecord()
  const syncToEntries = useSyncInvestmentToEntries()

  // ── Pipeline de filtragem ──────────────────────────────────────────────────
  // 1. Filtro temporal (client-side sobre records do ano)
  const temporalRecords = useMemo(() => {
    if (timeMode === 'mensal')  return records.filter(r => r.month === filterMonth)
    if (timeMode === 'custom')  return records.filter(r => r.month >= customFrom && r.month <= customTo)
    return records
  }, [records, timeMode, filterMonth, customFrom, customTo])

  // 2. Filtro classe + tipo
  const filteredRecords = useMemo(() => temporalRecords.filter(r => {
    const classOk = filterClass === 'ALL' || r.asset_class === filterClass
    const typeOk  =
      filterType === 'ALL' ||
      (filterType === 'PROVENTOS' && PROVENTO_TYPES.includes(r.record_type)) ||
      (filterType === 'VENDAS'    && r.record_type === 'VENDA')
    return classOk && typeOk
  }), [temporalRecords, filterClass, filterType])

  // 3. Busca (ticker, conta, classe)
  const searchedRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return filteredRecords
    return filteredRecords.filter(r =>
      r.ticker.toLowerCase().includes(q) ||
      (r.bank_account ?? '').toLowerCase().includes(q) ||
      ASSET_CLASS_LABELS[r.asset_class].toLowerCase().includes(q) ||
      INVESTMENT_TYPE_LABELS[r.record_type].toLowerCase().includes(q)
    )
  }, [filteredRecords, searchQuery])

  // 4. Ordenação
  const displayRecords = useMemo(() => {
    if (!sortConfig) return searchedRecords
    return [...searchedRecords].sort((a, b) => {
      let av: string | number = 0, bv: string | number = 0
      switch (sortConfig.col) {
        case 'ticker':      av = a.ticker;      bv = b.ticker;      break
        case 'asset_class': av = ASSET_CLASS_LABELS[a.asset_class]; bv = ASSET_CLASS_LABELS[b.asset_class]; break
        case 'record_type': av = INVESTMENT_TYPE_LABELS[a.record_type]; bv = INVESTMENT_TYPE_LABELS[b.record_type]; break
        case 'month':       av = a.year * 100 + a.month; bv = b.year * 100 + b.month; break
        case 'amount':      av = Number(a.amount); bv = Number(b.amount); break
        case 'bank_account':av = a.bank_account ?? ''; bv = b.bank_account ?? ''; break
      }
      if (av < bv) return sortConfig.dir === 'asc' ? -1 : 1
      if (av > bv) return sortConfig.dir === 'asc' ? 1 : -1
      return 0
    })
  }, [searchedRecords, sortConfig])

  function toggleSort(col: string) {
    setSortConfig(prev =>
      !prev || prev.col !== col ? { col, dir: 'asc' }
      : prev.dir === 'asc'     ? { col, dir: 'desc' }
      : null
    )
  }

  // ── KPIs (baseados nos filteredRecords sem busca) ──────────────────────────
  const totalProventos = filteredRecords.filter(r => PROVENTO_TYPES.includes(r.record_type)).reduce((s,r) => s + Number(r.amount), 0)
  const totalVendas    = filteredRecords.filter(r => r.record_type === 'VENDA').reduce((s,r) => s + Number(r.amount), 0)
  const totalGeral     = totalProventos + totalVendas

  // Meses fechados (já encerrados) do ano — usado nas médias mensais abaixo
  const lastClosedMonth = year < getCurrentYear() ? 12 : year === getCurrentYear() ? getCurrentMonth() - 1 : 0
  const closedRecords = filteredRecords.filter(r => r.month <= lastClosedMonth)

  const monthsWithData = new Set(closedRecords.map(r => r.month)).size
  const totalGeralClosed = closedRecords.reduce((s, r) => s + Number(r.amount), 0)
  const mediaMonsal    = monthsWithData > 0 ? totalGeralClosed / monthsWithData : 0

  // Média mensal de Proventos considerando apenas meses fechados (já encerrados) do ano
  const proventoRecordsClosed = closedRecords.filter(r => PROVENTO_TYPES.includes(r.record_type))
  const totalProventosClosed  = proventoRecordsClosed.reduce((s, r) => s + Number(r.amount), 0)
  const closedMonthsWithData  = new Set(proventoRecordsClosed.map(r => r.month)).size
  const mediaProventosMensal  = closedMonthsWithData > 0 ? totalProventosClosed / closedMonthsWithData : 0

  // ── Dados dos gráficos ────────────────────────────────────────────────────
  const activeClasses = useMemo(() => [...new Set(filteredRecords.map(r => r.asset_class))] as AssetClass[], [filteredRecords])

  const monthlyData = useMemo(() => {
    const byClass: Record<number, Record<string, number>> = {}
    for (let m = 1; m <= 12; m++) byClass[m] = {}
    filteredRecords.forEach(r => {
      byClass[r.month][r.asset_class] = (byClass[r.month][r.asset_class] ?? 0) + Number(r.amount)
    })
    return MONTHS_SHORT.map((name, i) => {
      const m = i + 1
      const row: Record<string, number | string> = { name }
      activeClasses.forEach(cls => { row[cls] = byClass[m]?.[cls] ?? 0 })
      row.total = activeClasses.reduce((s, cls) => s + (byClass[m]?.[cls] ?? 0), 0)
      return row
    })
  }, [filteredRecords, activeClasses])

  const donutData = useMemo(() => {
    const byClass: Record<string, number> = {}
    filteredRecords.forEach(r => { byClass[r.asset_class] = (byClass[r.asset_class] ?? 0) + Number(r.amount) })
    return Object.entries(byClass).filter(([,v]) => v > 0).map(([key, value]) => ({
      name: ASSET_CLASS_LABELS[key as AssetClass] ?? key,
      value, color: CHART_COLORS[key as AssetClass] ?? '#6B7280',
    }))
  }, [filteredRecords])

  const pvData = useMemo(() => {
    const pv: Record<number, { Proventos: number; Vendas: number }> = {}
    for (let m = 1; m <= 12; m++) pv[m] = { Proventos: 0, Vendas: 0 }
    temporalRecords.forEach(r => {
      if (PROVENTO_TYPES.includes(r.record_type)) pv[r.month].Proventos += Number(r.amount)
      else pv[r.month].Vendas += Number(r.amount)
    })
    return MONTHS_SHORT.map((name, i) => ({ name, Proventos: pv[i+1].Proventos, Vendas: pv[i+1].Vendas }))
  }, [temporalRecords])

  const typeData = useMemo(() => {
    const byType: Record<string, number> = {}
    filteredRecords.forEach(r => { byType[r.record_type] = (byType[r.record_type] ?? 0) + Number(r.amount) })
    return Object.entries(byType).filter(([,v]) => v !== 0)
      .map(([key, value]) => ({ name: INVESTMENT_TYPE_LABELS[key as InvestmentRecordType] ?? key, value }))
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
  }, [filteredRecords])

  const yearData = useMemo(() => {
    const totals: Record<number, number> = {}
    allRecords.forEach(r => { totals[r.year] = (totals[r.year] ?? 0) + Number(r.amount) })
    return Object.entries(totals).sort(([a],[b]) => Number(a) - Number(b)).map(([y, value]) => ({ name: y, Total: value }))
  }, [allRecords])

  // ── Handlers ──────────────────────────────────────────────────────────────
  function openCreate() {
    setForm(BLANK_FORM(year))
    setEditRecord(null)
    setDialogMode('create')
  }
  function openEdit(rec: InvestmentRecord) {
    setEditRecord(rec)
    setForm({
      ticker: rec.ticker, asset_class: rec.asset_class, record_type: rec.record_type,
      month: rec.month, year: rec.year, amount: String(rec.amount),
      bank_account: rec.bank_account ?? 'Giovani', is_taxable: rec.is_taxable, notes: rec.notes ?? '',
    })
    setDialogMode('edit')
  }

  async function handleSave() {
    if (!form.ticker || !form.amount) return
    const payload = {
      ticker: form.ticker.toUpperCase(), asset_class: form.asset_class,
      record_type: form.record_type, month: Number(form.month), year: Number(form.year),
      amount: parseFloat(form.amount), bank_account: form.bank_account,
      is_taxable: form.is_taxable, notes: form.notes,
    }
    try {
      if (dialogMode === 'edit' && editRecord) {
        await updateRecord.mutateAsync({ id: editRecord.id, updates: payload })
        toast({ title: 'Lançamento atualizado!', variant: 'success' })
      } else {
        await createRecord.mutateAsync({ user_id: user!.id, ...payload })
        toast({ title: 'Lançamento registrado!', variant: 'success' })
      }
      setDialogMode(null)
      setEditRecord(null)
      // Sync affected year to Receitas e Despesas
      await syncToEntries(Number(payload.year))
    } catch (e: unknown) {
      toast({ title: 'Erro', description: (e as Error).message, variant: 'destructive' })
    }
  }

  // ── Download modelo CSV ────────────────────────────────────────────────────
  function downloadTemplate() {
    const SEP = ';'
    const header = ['Ticker','Classe','Tipo','Mês (1-12)','Ano','Valor (R$)','Conta Bancária','Tributável (S/N)','Observações'].join(SEP)
    const examples = [
      ['MXRF11','FII','DIVIDENDO',new Date().getMonth()+1,year,'500,00','Giovani','N',''].join(SEP),
      ['PETR4','ACAO_BR','DIVIDENDO',new Date().getMonth()+1,year,'200,00','Giovani','N',''].join(SEP),
      ['CDB-BTG','RFIXA_BR','RENDIMENTO',new Date().getMonth()+1,year,'150,00','Giovani','N',''].join(SEP),
      ['PETR4','ACAO_BR','VENDA',new Date().getMonth()+1,year,'1500,00','Giovani','S','Lucro com venda'].join(SEP),
    ]
    const refs = [
      `# Classes válidas: ${ASSET_CLASSES.join(', ')}`,
      `# Tipos válidos: ${INVESTMENT_TYPES.join(', ')}`,
      `# Contas válidas: ${BANK_ACCOUNTS_LIST.join(', ')}`,
    ]
    const csv = '\ufeff' + [header, ...examples, '', ...refs].join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `modelo_investimentos_${year}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Importar CSV (batch) ───────────────────────────────────────────────────
  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    e.target.value = ''; setImporting(true)

    const text = await file.text()
    const SEP  = text.includes(';') ? ';' : ','
    const lines = text.replace(/^\ufeff/,'').trim().split(/\r?\n/).filter(l => l.trim() && !l.startsWith('#'))

    let skipped = 0
    const errors: string[] = []
    const validRecords: Parameters<typeof bulkCreateInvestmentRecords>[0] = []

    for (let i = 1; i < lines.length; i++) {
      const raw = lines[i].split(SEP).map(c => c.trim().replace(',','.'))
      if (raw.every(c => !c)) { skipped++; continue }

      const ticker     = (raw[0] ?? '').trim().toUpperCase()
      const assetClass = normalizeClass(raw[1] ?? '')
      const recType    = normalizeType(raw[2] ?? '')
      const month      = parseInt(raw[3]) || 0
      const recYear    = parseInt(raw[4]) || year
      const amount     = parseFloat(raw[5])
      const bankAcct   = BANK_ACCOUNTS_LIST.includes((raw[6] ?? '').trim()) ? (raw[6] ?? '').trim() : 'Giovani'
      const isTaxable  = normalizeTaxable(raw[7] ?? '')
      const notes      = raw[8] ?? ''

      if (!ticker)                  { errors.push(`Linha ${i+1}: ticker vazio`); continue }
      if (!assetClass)              { errors.push(`Linha ${i+1}: classe "${raw[1]}" inválida`); continue }
      if (!recType)                 { errors.push(`Linha ${i+1}: tipo "${raw[2]}" inválido`); continue }
      if (month < 1 || month > 12) { errors.push(`Linha ${i+1}: mês inválido (${raw[3]})`); continue }
      if (isNaN(amount))            { errors.push(`Linha ${i+1}: valor inválido (${raw[5]})`); continue }

      validRecords.push({ user_id: user!.id, ticker, asset_class: assetClass, record_type: recType,
        month, year: recYear, amount, bank_account: bankAcct, is_taxable: isTaxable, notes })
    }

    let success = 0
    if (validRecords.length > 0) {
      const { inserted, errorMsg } = await bulkCreateInvestmentRecords(validRecords)
      success = inserted
      if (errorMsg) errors.push(`Erro ao salvar no banco: ${errorMsg}`)
    }

    if (success > 0) {
      await queryClient.invalidateQueries({ queryKey: ['investment_records'] })
      await queryClient.invalidateQueries({ queryKey: ['investment_records_all'] })
      // Sync all affected years to Receitas e Despesas
      const yearsImported = [...new Set(validRecords.map((r) => r.year))]
      for (const y of yearsImported) await syncToEntries(y)
    }
    setImporting(false)
    setImportResult({ success, skipped, errors, title: 'Resultado — Importação de Lançamentos' })
    if (success > 0) toast({ title: `${success} lançamento(s) importado(s)!` })
  }

  if (isLoading) return <LoadingPage />
  const hasData = records.length > 0
  const isPending = createRecord.isPending || updateRecord.isPending

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center">
            <BarChart3 size={18} className="text-violet-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Renda Investimentos</h1>
            <p className="text-xs text-gray-500">Proventos e lucros com venda de ativos — {year}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={downloadTemplate}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-violet-700 bg-violet-50 border border-violet-200 rounded-lg hover:bg-violet-100 transition-colors">
            <Download size={13} /> Modelo CSV
          </button>
          <button onClick={() => fileInputRef.current?.click()} disabled={importing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors">
            {importing ? <><FileSpreadsheet size={13} className="animate-pulse" /> Importando...</> : <><Upload size={13} /> Importar</>}
          </button>
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
          <button
            onClick={async () => {
              const result = await syncToEntries(year)
              if (!result) {
                toast({ title: 'Sync indisponível', description: 'Categorias ainda carregando.', variant: 'destructive' })
                return
              }
              if (result.missing.length > 0) {
                toast({
                  title: `Sync parcial — ${result.synced.length}/${result.synced.length + result.missing.length} categorias`,
                  description: `Não encontradas no banco: ${result.missing.join(', ')}`,
                  variant: 'destructive',
                })
              } else {
                toast({ title: `✓ Sync concluído — ${result.rowsUpserted} linhas atualizadas`, variant: 'success' })
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
            title="Sincronizar lançamentos existentes com Finanças Pessoais"
          >
            <CheckCircle size={13} /> Sincronizar → Receitas
          </button>
          <Button onClick={openCreate}><Plus size={16} /> Registrar Lançamento</Button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Proventos"
          value={formatCurrency(totalProventos)}
          icon={<TrendingUp size={18} />}
          subtitle={`Dividendos, juros, rendimentos · Média mensal (meses fechados): ${formatCurrency(mediaProventosMensal)}`}
        />
        <KPICard title="Vendas" value={formatCurrency(totalVendas)} subtitle={totalVendas >= 0 ? 'Lucro com vendas' : 'Perda com vendas'} />
        <KPICard title="Total Geral" value={formatCurrency(totalGeral)} subtitle={`${filteredRecords.length} lançamentos`} />
        <KPICard title="Média Mensal (Considerando Vendas)" value={formatCurrency(mediaMonsal)} subtitle={`${monthsWithData} mês(es) fechados com dados`} />
      </div>

      {/* ── Seletor Temporal ── */}
      <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold text-gray-500">PERÍODO:</span>
        {(['anual','mensal','custom'] as const).map(m => (
          <button key={m} onClick={() => setTimeMode(m)}
            className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
              timeMode === m ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
            {m === 'anual' ? 'Anual' : m === 'mensal' ? 'Mensal' : 'Customizado'}
          </button>
        ))}
        {timeMode === 'mensal' && (
          <select value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-300">
            {MONTHS_FULL.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
        )}
        {timeMode === 'custom' && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">De:</span>
            <select value={customFrom} onChange={e => setCustomFrom(Number(e.target.value))}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-300">
              {MONTHS_SHORT.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
            </select>
            <span className="text-xs text-gray-500">até:</span>
            <select value={customTo} onChange={e => setCustomTo(Number(e.target.value))}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-300">
              {MONTHS_SHORT.map((m, i) => <option key={i+1} value={i+1} disabled={i+1 < customFrom}>{m}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* ── Filtros de classe e tipo ── */}
      <div className="flex flex-wrap gap-y-2 gap-x-4 items-center">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold text-gray-500">CLASSE:</span>
          <button onClick={() => setFilterClass('ALL')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filterClass === 'ALL' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            Todos
          </button>
          {ASSET_CLASSES.map(cls => (
            <button key={cls} onClick={() => setFilterClass(filterClass === cls ? 'ALL' : cls)}
              style={{ backgroundColor: filterClass === cls ? CHART_COLORS[cls] : undefined }}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filterClass === cls ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {ASSET_CLASS_LABELS[cls]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-gray-500">TIPO:</span>
          {(['ALL','PROVENTOS','VENDAS'] as const).map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              className={cn('px-3 py-1 rounded-full text-xs font-medium transition-colors',
                filterType === t
                  ? t === 'ALL' ? 'bg-gray-800 text-white' : t === 'PROVENTOS' ? 'bg-emerald-600 text-white' : 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
              {t === 'ALL' ? 'Todos' : t === 'PROVENTOS' ? 'Proventos' : 'Vendas'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Gráficos ── */}
      {hasData && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-1">Resultado Mensal por Classe — {year}</h2>
              <p className="text-xs text-gray-400 mb-4">Barras empilhadas por tipo de ativo + linha do total</p>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={monthlyData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                  <Tooltip content={<MonthlyTooltip />} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  {activeClasses.map(cls => (
                    <Bar key={cls} dataKey={cls} name={ASSET_CLASS_LABELS[cls]} stackId="a" fill={CHART_COLORS[cls]}
                      radius={activeClasses[activeClasses.length-1] === cls ? [3,3,0,0] : [0,0,0,0]} />
                  ))}
                  <Line type="monotone" dataKey="total" name="Total" stroke="#1e293b" strokeWidth={2} dot={false} legendType="none" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-1">Por Classe de Ativo</h2>
              <p className="text-xs text-gray-400 mb-4">Distribuição do total anual</p>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={donutData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2} dataKey="value">
                    {donutData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={v => formatCurrency(Number(v))} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-1">Proventos vs Vendas — {year}</h2>
              <p className="text-xs text-gray-400 mb-4">Comparativo mensal</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={pvData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                  <Tooltip content={<CurrencyTooltip />} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Proventos" fill="#10B981" radius={[3,3,0,0]} />
                  <Bar dataKey="Vendas" fill="#F97316" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-1">Por Tipo de Lançamento</h2>
              <p className="text-xs text-gray-400 mb-4">Total acumulado no ano</p>
              {typeData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={typeData} layout="vertical" margin={{ top: 4, right: 30, left: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                    <XAxis type="number" tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
                    <Tooltip formatter={v => formatCurrency(Number(v))} />
                    <Bar dataKey="value" name="Total" fill="#8B5CF6" radius={[0,3,3,0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[200px] text-gray-400 text-xs">Sem dados</div>
              )}
            </div>
          </div>
          {yearData.length > 1 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-1">Histórico Anual</h2>
              <p className="text-xs text-gray-400 mb-4">Total de lançamentos por ano</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={yearData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={v => formatCurrency(Number(v))} />
                  <Bar dataKey="Total" fill="#6366F1" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── Tabela ── */}
      {filteredRecords.length === 0 ? (
        <EmptyState icon={<TrendingUp size={40} />}
          title="Nenhum lançamento encontrado"
          description={hasData ? 'Tente ajustar os filtros' : `Registre proventos e vendas de ${year}`}
          action={!hasData ? <Button onClick={openCreate}><Plus size={16} /> Registrar Lançamento</Button> : undefined} />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Barra de busca + contagem */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3 flex-wrap">
            <h2 className="text-sm font-semibold text-gray-700 shrink-0">
              Lançamentos — {year}
              <span className="ml-2 text-xs font-normal text-gray-400">({displayRecords.length} de {filteredRecords.length})</span>
            </h2>
            <div className="flex-1 min-w-[200px] relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por ativo, conta, classe..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 bg-gray-50"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {[
                    { key: 'ticker',       label: 'Ativo',   align: 'left' },
                    { key: 'asset_class',  label: 'Classe',  align: 'left',   hide: 'sm' },
                    { key: 'record_type',  label: 'Tipo',    align: 'left',   hide: 'md' },
                    { key: 'month',        label: 'Mês',     align: 'center' },
                    { key: 'amount',       label: 'Valor',   align: 'right' },
                    { key: 'bank_account', label: 'Conta',   align: 'center', hide: 'lg' },
                  ].map(({ key, label, align, hide }) => (
                    <th key={key}
                      onClick={() => toggleSort(key)}
                      className={cn(
                        'px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:bg-gray-100 transition-colors',
                        `text-${align}`,
                        hide === 'sm' && 'hidden sm:table-cell',
                        hide === 'md' && 'hidden md:table-cell',
                        hide === 'lg' && 'hidden lg:table-cell',
                      )}>
                      {label}<SortIcon col={key} sortConfig={sortConfig} />
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Tribut.</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Ações</th>
                </tr>
              </thead>
              <tbody>
                {displayRecords.map(rec => (
                  <tr key={rec.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-semibold text-gray-800">{rec.ticker}</span>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <Badge style={{ backgroundColor: CHART_COLORS[rec.asset_class]+'20', color: CHART_COLORS[rec.asset_class], borderColor: 'transparent' }}>
                        {ASSET_CLASS_LABELS[rec.asset_class]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs text-gray-500">{INVESTMENT_TYPE_LABELS[rec.record_type]}</span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600 text-xs">{formatMonth(rec.month)}/{rec.year}</td>
                    <td className={cn('px-4 py-3 text-right font-semibold tabular-nums', Number(rec.amount) >= 0 ? 'text-gray-800' : 'text-red-600')}>
                      {formatCurrency(Number(rec.amount))}
                    </td>
                    <td className="px-4 py-3 text-center hidden lg:table-cell">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">{rec.bank_account ?? 'Giovani'}</span>
                    </td>
                    <td className="px-4 py-3 text-center hidden lg:table-cell">
                      {rec.is_taxable
                        ? <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-medium">Tributável</span>
                        : <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-medium">Isento</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openEdit(rec)} className="p-1.5 rounded text-violet-400 hover:bg-violet-50 transition-colors" title="Editar">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => setDeleteId(rec.id)} className="p-1.5 rounded text-red-400 hover:bg-red-50 transition-colors" title="Excluir">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td colSpan={4} className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Total filtrado</td>
                  <td className={cn('px-4 py-3 text-right font-bold text-sm', totalGeral >= 0 ? 'text-gray-800' : 'text-red-600')}>
                    {formatCurrency(totalGeral)}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── Dialog Criar / Editar ── */}
      <Dialog open={dialogMode !== null} onOpenChange={v => { if (!v) { setDialogMode(null); setEditRecord(null) } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{dialogMode === 'edit' ? 'Editar Lançamento' : 'Registrar Lançamento'}</DialogTitle>
          </DialogHeader>
          <RecordForm form={form} setForm={setForm} />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogMode(null); setEditRecord(null) }}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.ticker || !form.amount || isPending}>
              {isPending ? 'Salvando...' : dialogMode === 'edit' ? 'Salvar Alterações' : 'Registrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirm delete ── */}
      <ConfirmDialog open={!!deleteId} onOpenChange={v => { if (!v) setDeleteId(null) }}
        title="Remover lançamento?" description="Esta ação não pode ser desfeita."
        confirmLabel="Remover" variant="destructive"
        onConfirm={async () => {
          if (!deleteId) return
          try {
            await deleteRecord.mutateAsync(deleteId)
            toast({ title: 'Removido', variant: 'success' })
            await syncToEntries(year)
          }
          catch { toast({ title: 'Erro', variant: 'destructive' }) }
          finally { setDeleteId(null) }
        }}
        loading={deleteRecord.isPending} />

      {/* ── Import result modal ── */}
      {importResult && <ImportResultModal result={importResult} onClose={() => setImportResult(null)} />}
    </div>
  )
}
