import { useState, useRef, useEffect } from 'react'
import { useYear } from '@/contexts/YearContext'
import { useCategoriesByGroup } from '@/hooks/useCategories'
import { useEntries, useUpsertEntry, buildEntryMap } from '@/hooks/useEntries'
import { useInvestmentRecords } from '@/hooks/useInvestment'
import { formatCurrency, formatPercent } from '@/lib/utils'
import { CATEGORY_GROUP_LABELS, PROVENTO_TYPES } from '@/lib/constants'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { LoadingPage } from '@/components/shared/LoadingSpinner'
import { KPICard } from '@/components/shared/KPICard'
import { toast } from '@/hooks/useToast'
import { useAuth } from '@/hooks/useAuth'
import type { Category, CategoryGroup, MonthlyEntryMap } from '@/types/finance.types'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown, DollarSign, Target, Download, Upload, CheckCircle, XCircle, FileSpreadsheet, X } from 'lucide-react'
import {
  ComposedChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from 'recharts'

// Nomes completos dos meses em português (evita tradução automática do browser)
const MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const MESES_COMPLETOS = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
]
const MONTHS = [1,2,3,4,5,6,7,8,9,10,11,12]

// ─── Célula editável inline ───────────────────────────────────────────────────
// Lógica de cor da célula:
// Receitas: acima do orçado → verde | abaixo → vermelho | sem orçado → preto
// Despesas: acima do orçado → vermelho | abaixo/sem orçado → preto
function getCellColor(realizado: number, orcado: number, hasData: boolean, type: 'receitas' | 'despesas'): string {
  if (!hasData) return 'text-gray-300'
  if (orcado === 0) return 'text-gray-900'
  if (type === 'receitas') return realizado >= orcado ? 'text-green-600' : 'text-red-600'
  return realizado > orcado ? 'text-red-600' : 'text-gray-900'
}

function EntryCell({
  realizado, orcado, categoryId, month, year, type
}: {
  realizado: number; orcado: number; categoryId: string; month: number; year: number
  type: 'receitas' | 'despesas'
}) {
  const { user } = useAuth()
  const upsert = useUpsertEntry()
  const [open, setOpen] = useState(false)
  const [localReal, setLocalReal] = useState(realizado !== 0 ? String(realizado) : '')
  const [localOrc, setLocalOrc] = useState(orcado !== 0 ? String(orcado) : '')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLocalReal(realizado !== 0 ? String(realizado) : '')
    setLocalOrc(orcado !== 0 ? String(orcado) : '')
  }, [realizado, orcado])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        handleSave()
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  })

  async function handleSave() {
    const r = parseFloat(localReal) || 0
    const o = parseFloat(localOrc) || 0
    if (r === realizado && o === orcado) return
    try {
      await upsert.mutateAsync({ user_id: user!.id, category_id: categoryId, year, month, realizado: r, orcado: o })
    } catch { toast({ title: 'Erro ao salvar', variant: 'destructive' }) }
  }

  const hasData = realizado !== 0 || orcado !== 0

  return (
    <div ref={ref} className="relative">
      <div
        onClick={() => setOpen(true)}
        className={cn(
          'cursor-pointer px-1 py-1 rounded text-center min-w-[72px] hover:bg-blue-50 transition-colors',
          open && 'ring-2 ring-blue-400 bg-blue-50'
        )}
      >
        <div className={cn('text-xs font-medium leading-tight', getCellColor(realizado, orcado, hasData, type))}>
          {hasData ? formatCurrency(realizado) : '—'}
        </div>
        {orcado !== 0 && (
          <div className="text-[10px] text-blue-400 leading-tight font-medium">
            orç: {formatCurrency(orcado)}
          </div>
        )}
      </div>

      {open && (
        <div className="absolute z-30 bg-white border border-gray-200 rounded-xl shadow-2xl p-4 w-56 top-full left-1/2 -translate-x-1/2 mt-1 space-y-3">
          <p className="text-xs font-bold text-gray-700">{MESES_COMPLETOS[month - 1]}</p>
          <div>
            <label className="text-xs text-gray-500 font-medium">Realizado (R$)</label>
            <input autoFocus type="number" step="0.01"
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={localReal} onChange={(e) => setLocalReal(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { handleSave(); setOpen(false) } if (e.key === 'Escape') setOpen(false) }}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">Orçado (R$)</label>
            <input type="number" step="0.01"
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={localOrc} onChange={(e) => setLocalOrc(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { handleSave(); setOpen(false) } if (e.key === 'Escape') setOpen(false) }}
            />
          </div>
          <button onClick={() => { handleSave(); setOpen(false) }}
            className="w-full bg-blue-600 text-white text-xs py-2 rounded-lg hover:bg-blue-700 transition-colors font-semibold">
            Salvar
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Linha de grupo de categorias ────────────────────────────────────────────
function CategoryGroupSection({
  group, categories, entryMap, year, type
}: {
  group: CategoryGroup; categories: Category[]; entryMap: MonthlyEntryMap; year: number
  type: 'receitas' | 'despesas'
}) {
  const [expanded, setExpanded] = useState(true)

  const groupMonthTotalsReal = MONTHS.map(m =>
    categories.reduce((s, cat) => s + (entryMap[cat.id]?.[m]?.realizado ?? 0), 0)
  )
  const groupMonthTotalsOrc = MONTHS.map(m =>
    categories.reduce((s, cat) => s + (entryMap[cat.id]?.[m]?.orcado ?? 0), 0)
  )
  const grandTotalReal = groupMonthTotalsReal.reduce((a, b) => a + b, 0)
  const grandTotalOrc = groupMonthTotalsOrc.reduce((a, b) => a + b, 0)
  // Média do grupo: divide apenas pelos meses em que o grupo teve algum lançamento
  const grandMonthsWithEntry = groupMonthTotalsReal.filter(t => t !== 0).length
  const grandAvg = grandMonthsWithEntry > 0 ? grandTotalReal / grandMonthsWithEntry : 0

  // Cor do % no cabeçalho do grupo
  const grandPctColor = type === 'receitas'
    ? (grandTotalReal >= grandTotalOrc ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')
    : (grandTotalReal > grandTotalOrc ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700')

  return (
    <>
      <tr className="bg-blue-50 cursor-pointer hover:bg-blue-100 transition-colors" onClick={() => setExpanded(v => !v)}>
        <td className="sticky left-0 z-10 bg-blue-50 px-3 py-2.5 font-bold text-blue-800 text-xs uppercase tracking-wide whitespace-nowrap" style={{ minWidth: 200 }}>
          <div className="flex items-center gap-1.5">
            {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            {CATEGORY_GROUP_LABELS[group]}
          </div>
        </td>
        {MONTHS.map((m) => (
          <td key={m} className="px-1 py-2.5 text-center text-xs font-bold text-blue-700 min-w-[90px]">
            {groupMonthTotalsReal[m-1] !== 0 ? formatCurrency(groupMonthTotalsReal[m-1]) : '—'}
          </td>
        ))}
        <td className="px-2 py-2.5 text-center text-xs font-bold text-blue-900 bg-blue-100 min-w-[100px]">
          {formatCurrency(grandTotalReal)}
        </td>
        <td className="px-2 py-2.5 text-center text-xs font-semibold text-blue-600 min-w-[100px]">
          {grandTotalOrc !== 0 ? formatCurrency(grandTotalOrc) : '—'}
        </td>
        <td className="px-2 py-2.5 text-center text-xs font-semibold text-blue-600 min-w-[90px]">
          {formatCurrency(grandAvg)}
        </td>
        <td className="px-2 py-2.5 text-center text-xs min-w-[70px]">
          {grandTotalOrc !== 0 ? (
            <span className={cn('font-bold px-1.5 py-0.5 rounded-full text-[10px]', grandPctColor)}>
              {formatPercent((grandTotalReal / grandTotalOrc) * 100)}
            </span>
          ) : '—'}
        </td>
      </tr>

      {expanded && categories.map(cat => {
        const monthVals = MONTHS.map(m => entryMap[cat.id]?.[m] ?? { realizado: 0, orcado: 0, id: '' })
        const totalReal = monthVals.reduce((s, v) => s + v.realizado, 0)
        const totalOrc = monthVals.reduce((s, v) => s + v.orcado, 0)
        // Média: divide apenas pelos meses com lançamento realizado
        const monthsWithEntry = monthVals.filter(v => v.realizado !== 0).length
        const avg = monthsWithEntry > 0 ? totalReal / monthsWithEntry : 0
        const pct = totalOrc !== 0 ? (totalReal / totalOrc) * 100 : null
        // Cor do % por linha de categoria
        const pctColor = type === 'receitas'
          ? (pct !== null && pct >= 100 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')
          : (pct !== null && pct > 100 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700')
        return (
          <tr key={cat.id} className="border-b border-gray-50 hover:bg-gray-50/50">
            <td className="sticky left-0 z-10 bg-white hover:bg-gray-50/50 px-3 py-2 text-sm text-gray-700 whitespace-nowrap pl-8" style={{ minWidth: 200 }}>
              {cat.name}
            </td>
            {MONTHS.map(m => (
              <td key={m} className="px-0 py-1 text-center">
                <EntryCell
                  realizado={monthVals[m-1].realizado} orcado={monthVals[m-1].orcado}
                  categoryId={cat.id} month={m} year={year} type={type}
                />
              </td>
            ))}
            <td className="px-2 py-2 text-center text-xs font-bold text-gray-800 bg-gray-50">
              {totalReal !== 0 ? formatCurrency(totalReal) : '—'}
            </td>
            <td className="px-2 py-2 text-center text-xs text-blue-600 font-medium">
              {totalOrc !== 0 ? formatCurrency(totalOrc) : '—'}
            </td>
            <td className="px-2 py-2 text-center text-xs text-gray-500">
              {avg !== 0 ? formatCurrency(avg) : '—'}
            </td>
            <td className="px-2 py-2 text-center text-xs">
              {pct !== null ? (
                <span className={cn('font-semibold px-1.5 py-0.5 rounded-full text-[10px]', pctColor)}>
                  {formatPercent(pct)}
                </span>
              ) : '—'}
            </td>
          </tr>
        )
      })}
    </>
  )
}

// ─── Tabela mensal ────────────────────────────────────────────────────────────
function EntriesTable({ groups, categories, entryMap, year, type }: {
  groups: CategoryGroup[]; categories: Record<CategoryGroup, Category[]>;
  entryMap: MonthlyEntryMap; year: number; type: 'receitas' | 'despesas'
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b-2 border-gray-200 bg-gray-50">
            <th className="sticky left-0 z-20 bg-gray-50 px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wide" style={{ minWidth: 200 }}>
              Categoria
            </th>
            {MONTHS.map(m => (
              <th key={m} className="px-1 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wide min-w-[90px]">
                {MESES_ABREV[m-1]}
              </th>
            ))}
            <th className="px-2 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wide bg-gray-100 min-w-[100px]">
              Total Real.
            </th>
            <th className="px-2 py-3 text-center text-xs font-bold text-blue-600 uppercase tracking-wide min-w-[100px]">
              Total Orç.
            </th>
            <th className="px-2 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wide min-w-[90px]">
              Média
            </th>
            <th className="px-2 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wide min-w-[70px]">
              % Real/Orç
            </th>
          </tr>
        </thead>
        <tbody>
          {groups.map(group => (
            <CategoryGroupSection
              key={group} group={group}
              categories={categories[group] ?? []}
              entryMap={entryMap} year={year} type={type}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Cards de resumo ──────────────────────────────────────────────────────────
function SummaryCards({ groups, chartGroups, categories, entryMap, type }: {
  groups: CategoryGroup[]          // grupos usados nos KPI cards (totais gerais)
  chartGroups?: CategoryGroup[]    // grupos usados no gráfico (se diferente dos cards)
  categories: Record<CategoryGroup, Category[]>
  entryMap: MonthlyEntryMap; type: 'receitas' | 'despesas'
}) {
  // ── KPI cards: soma de todos os grupos da aba ──
  let totalReal = 0, totalOrc = 0
  const kpiMonthlyReal: number[] = Array(12).fill(0)
  groups.forEach(group => {
    (categories[group] ?? []).forEach(cat => {
      MONTHS.forEach(m => {
        const r = entryMap[cat.id]?.[m]?.realizado ?? 0
        totalReal += r
        totalOrc += entryMap[cat.id]?.[m]?.orcado ?? 0
        kpiMonthlyReal[m-1] += r
      })
    })
  })

  // ── Gráfico: soma apenas dos grupos definidos em chartGroups (ou todos se não informado) ──
  const effectiveChartGroups = chartGroups ?? groups
  const chartMonthlyReal: number[] = Array(12).fill(0)
  const chartMonthlyOrc: number[] = Array(12).fill(0)
  effectiveChartGroups.forEach(group => {
    (categories[group] ?? []).forEach(cat => {
      MONTHS.forEach(m => {
        chartMonthlyReal[m-1] += entryMap[cat.id]?.[m]?.realizado ?? 0
        chartMonthlyOrc[m-1] += entryMap[cat.id]?.[m]?.orcado ?? 0
      })
    })
  })

  // Média: divide somente pelos meses com algum lançamento
  const kpiMesesComLancamento = kpiMonthlyReal.filter(v => v !== 0).length
  const avgReal = kpiMesesComLancamento > 0 ? totalReal / kpiMesesComLancamento : 0
  const pctOrc = totalOrc > 0 ? (totalReal / totalOrc) * 100 : null
  const saldoOrc = totalOrc - totalReal
  const isPositive = type === 'receitas' ? totalReal >= totalOrc : totalReal <= totalOrc

  const chartData = MONTHS.map((_, i) => ({
    name: MESES_ABREV[i],
    Realizado: chartMonthlyReal[i],
    Orçado: chartMonthlyOrc[i],
  })).filter(d => d.Realizado !== 0 || d.Orçado !== 0)

  const color = type === 'receitas' ? '#3B82F6' : '#EF4444'
  const colorOrc = type === 'receitas' ? '#93C5FD' : '#FCA5A5'

  // Título do gráfico
  const chartTitle = chartGroups
    ? `${chartGroups.map(g => {
        const labels: Record<string, string> = {
          RENDA_PASSIVA: 'Renda Passiva',
          RENDA_ATIVA_PJ: 'Renda Ativa PJ',
          RENDA_ATIVA_INV: 'Renda Ativa Investimentos',
          DESPESAS_ESSENCIAIS: 'Despesas Essenciais',
          DESPESAS_DISCRICIONARIAS: 'Despesas Discricionárias',
        }
        return labels[g] ?? g
      }).join(' + ')} — Realizado vs Orçado por Mês`
    : `${type === 'receitas' ? 'Receitas' : 'Despesas'} — Realizado vs Orçado por Mês`

  return (
    <div className="space-y-4">
      {/* Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title={type === 'receitas' ? 'Total Recebido' : 'Total Gasto'}
          value={formatCurrency(totalReal)}
          icon={type === 'receitas' ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
          subtitle={`Média mensal: ${formatCurrency(avgReal)}`}
          trend={type === 'receitas' ? 'up' : undefined}
        />
        <KPICard
          title="Total Orçado"
          value={formatCurrency(totalOrc)}
          icon={<Target size={18} />}
          subtitle="Planejamento anual"
        />
        <KPICard
          title={type === 'receitas' ? 'Saldo vs Orçado' : 'Economia vs Orçado'}
          value={formatCurrency(Math.abs(saldoOrc))}
          icon={<DollarSign size={18} />}
          trend={isPositive ? 'up' : 'down'}
          subtitle={isPositive
            ? (type === 'receitas' ? 'Acima do orçado ✓' : 'Abaixo do orçado ✓')
            : (type === 'receitas' ? 'Abaixo do orçado' : 'Acima do orçado')
          }
        />
        <KPICard
          title="% Realizado/Orçado"
          value={pctOrc !== null ? formatPercent(pctOrc) : '—'}
          icon={<Target size={18} />}
          subtitle={pctOrc !== null ? (isPositive ? 'Meta atingida ✓' : 'Meta não atingida') : 'Sem orçamento definido'}
          valueClassName={pctOrc === null ? undefined : isPositive ? 'text-green-600' : 'text-red-600'}
        />
      </div>

      {/* Gráfico Realizado vs Orçado */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="text-sm font-bold text-gray-700 mb-4">{chartTitle}</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Realizado" fill={color} radius={[4,4,0,0]} />
              <Bar dataKey="Orçado" fill={colorOrc} radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

// ─── Resumo Anual (visão consolidada) ────────────────────────────────────────
function AnnualSummary({ categories, entryMap, year }: {
  categories: Record<CategoryGroup, Category[]>; entryMap: MonthlyEntryMap; year: number
}) {
  const expenseGroups: CategoryGroup[] = ['DESPESAS_ESSENCIAIS', 'DESPESAS_DISCRICIONARIAS']

  // ── Renda Passiva Anual → espelha o total de "Proventos" da página Renda Investimentos ──
  const { data: investmentRecords = [] } = useInvestmentRecords(year)
  const proventoRecords = investmentRecords.filter(r => PROVENTO_TYPES.includes(r.record_type))
  const totalPassiva = proventoRecords.reduce((s, r) => s + Number(r.amount), 0)
  const mesesPassiva = new Set(proventoRecords.map(r => r.month)).size

  // ── Totais anuais ──
  const totalDespesas = expenseGroups.flatMap(g => categories[g] ?? [])
    .reduce((s, cat) => s + MONTHS.reduce((ms, m) => ms + (entryMap[cat.id]?.[m]?.realizado ?? 0), 0), 0)

  const saldo = totalPassiva - totalDespesas
  const pctGasta = totalPassiva !== 0 ? (totalDespesas / totalPassiva) * 100 : 0

  // Médias (só meses com lançamento)
  const mesesDesp = MONTHS.filter(m =>
    expenseGroups.some(g => (categories[g] ?? []).some(cat => (entryMap[cat.id]?.[m]?.realizado ?? 0) !== 0))
  ).length
  const avgPassiva  = mesesPassiva > 0  ? totalPassiva  / mesesPassiva  : 0
  const avgDespesas = mesesDesp    > 0  ? totalDespesas / mesesDesp     : 0

  // ── Dados mensais para o gráfico ──
  const chartData = MONTHS.map((_, i) => {
    const m = i + 1
    const rp = proventoRecords.filter(r => r.month === m).reduce((s, r) => s + Number(r.amount), 0)
    const dep = expenseGroups.flatMap(g => categories[g] ?? [])
      .reduce((s, cat) => s + (entryMap[cat.id]?.[m]?.realizado ?? 0), 0)
    const pct = rp !== 0 ? Math.round((dep / rp) * 100) : null
    return { name: MESES_ABREV[i], 'Renda Passiva': rp, 'Despesas': dep, pct }
  }).filter(d => d['Renda Passiva'] !== 0 || d['Despesas'] !== 0)

  // ── Tooltip customizado ──
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    const rp  = payload.find((p: any) => p.dataKey === 'Renda Passiva')?.value ?? 0
    const dep = payload.find((p: any) => p.dataKey === 'Despesas')?.value ?? 0
    const sal = rp - dep
    const pct = rp !== 0 ? (dep / rp) * 100 : 0
    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs space-y-1.5 min-w-[180px]">
        <p className="font-bold text-gray-700 border-b pb-1.5 mb-1.5">{label}</p>
        <div className="flex justify-between gap-4">
          <span className="text-blue-600 font-medium">Renda Passiva</span>
          <span className="font-semibold">{formatCurrency(rp)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-red-500 font-medium">Despesas</span>
          <span className="font-semibold">{formatCurrency(dep)}</span>
        </div>
        <div className="flex justify-between gap-4 border-t pt-1.5 mt-1">
          <span className="text-gray-600 font-medium">Saldo</span>
          <span className={cn('font-bold', sal >= 0 ? 'text-green-600' : 'text-red-600')}>
            {sal >= 0 ? '+' : ''}{formatCurrency(sal)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-600 font-medium">% Gasta</span>
          <span className={cn('font-bold', pct <= 100 ? 'text-green-600' : 'text-red-600')}>
            {formatPercent(pct)}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 mt-2">
      {/* ── 4 Cards principais ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Renda Passiva Anual"
          value={formatCurrency(totalPassiva)}
          icon={<TrendingUp size={18} />}
          subtitle={`Média: ${formatCurrency(avgPassiva)}/mês`}
          trend="up"
        />
        <KPICard
          title="Despesas Totais"
          value={formatCurrency(totalDespesas)}
          icon={<DollarSign size={18} />}
          subtitle={`Média: ${formatCurrency(avgDespesas)}/mês`}
        />
        <KPICard
          title="Saldo"
          value={formatCurrency(saldo)}
          icon={<TrendingUp size={18} />}
          trend={saldo >= 0 ? 'up' : 'down'}
          subtitle={`Receitas: ${formatCurrency(totalPassiva)}`}
          valueClassName={saldo >= 0 ? 'text-green-600' : 'text-red-600'}
        />
        <KPICard
          title="% Gasta"
          value={formatPercent(pctGasta)}
          icon={<Target size={18} />}
          subtitle="Despesas / Receitas"
          valueClassName={pctGasta <= 100 ? 'text-green-600' : 'text-red-600'}
        />
      </div>

      {/* ── Gráfico Renda Passiva vs Despesas ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-700">Renda Passiva vs Despesas Totais — Mensal</h3>
          <span className="text-xs text-gray-400">Passe o mouse para ver o saldo e % gasta</span>
        </div>

        {chartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
            <TrendingUp size={32} className="opacity-30" />
            <p className="text-sm">Nenhum lançamento encontrado para o período</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis
                yAxisId="left"
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 11 }}
                domain={[0, 'auto']}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="left" dataKey="Renda Passiva" fill="#3B82F6" radius={[4,4,0,0]} />
              <Bar yAxisId="left" dataKey="Despesas" fill="#EF4444" radius={[4,4,0,0]} />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="pct"
                name="% Gasta"
                stroke="#F59E0B"
                strokeWidth={2}
                dot={{ fill: '#F59E0B', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

// ─── Modal de resultado de importação ────────────────────────────────────────
function ImportResultModal({ result, onClose }: {
  result: { success: number; errors: string[] }
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className={cn('px-6 py-4 flex items-center justify-between',
          result.errors.length === 0 ? 'bg-green-50 border-b border-green-100' : 'bg-amber-50 border-b border-amber-100'
        )}>
          <div className="flex items-center gap-2">
            {result.errors.length === 0
              ? <CheckCircle size={20} className="text-green-600" />
              : <XCircle size={20} className="text-amber-600" />}
            <h2 className="font-bold text-gray-800">Resultado da Importação</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl border border-green-100">
            <CheckCircle size={22} className="text-green-600 shrink-0" />
            <div>
              <p className="text-sm font-bold text-green-800">{result.success} lançamento(s) importado(s)</p>
              <p className="text-xs text-green-600">Valores salvos com sucesso no banco de dados</p>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-amber-700 flex items-center gap-1.5">
                <XCircle size={13} /> {result.errors.length} linha(s) ignorada(s):
              </p>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {result.errors.map((e, i) => (
                  <p key={i} className="text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg">{e}</p>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="px-6 pb-5">
          <button onClick={onClose}
            className="w-full bg-blue-600 text-white text-sm py-2.5 rounded-xl hover:bg-blue-700 transition-colors font-semibold">
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export function EntriesPage() {
  const { year } = useYear()
  const { user } = useAuth()
  const { byGroup, categories, isLoading: loadingCats } = useCategoriesByGroup()
  const { data: entries = [], isLoading: loadingEntries } = useEntries(year)
  const upsert = useUpsertEntry()

  const [activeTab, setActiveTab] = useState<'receitas' | 'despesas' | 'resumo'>('resumo')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ success: number; errors: string[] } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (loadingCats || loadingEntries) return <LoadingPage />

  const entryMap = buildEntryMap(categories, entries)
  const incomeGroups: CategoryGroup[] = ['RENDA_PASSIVA', 'RENDA_ATIVA_PJ', 'RENDA_ATIVA_INV']
  const expenseGroups: CategoryGroup[] = ['DESPESAS_ESSENCIAIS', 'DESPESAS_DISCRICIONARIAS']

  const currentGroups = activeTab === 'receitas' ? incomeGroups : expenseGroups
  const currentType = activeTab === 'receitas' ? 'receitas' : 'despesas'

  // ── Gerar e baixar planilha modelo ──────────────────────────────────────────
  function downloadTemplate() {
    const SEP = ';'
    const monthHeaders = MONTHS.flatMap(m => [
      `${MESES_ABREV[m-1]} Realizado`, `${MESES_ABREV[m-1]} Orçado`
    ])
    const header = ['Categoria', 'Grupo', ...monthHeaders].join(SEP)

    const rows = currentGroups.flatMap(group =>
      (byGroup[group] ?? []).map(cat => {
        const vals = MONTHS.flatMap(m => {
          const v = entryMap[cat.id]?.[m]
          return [v?.realizado !== undefined && v.realizado !== 0 ? String(v.realizado) : '', v?.orcado !== undefined && v.orcado !== 0 ? String(v.orcado) : '']
        })
        return [cat.name, CATEGORY_GROUP_LABELS[group], ...vals].join(SEP)
      })
    )

    const csv = '\ufeff' + [header, ...rows].join('\r\n') // BOM para Excel abrir com acentos
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `modelo_${currentType}_${year}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Importar planilha preenchida ─────────────────────────────────────────────
  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = '' // reset para permitir reimportar o mesmo arquivo

    setImporting(true)
    const text = await file.text()

    // Detecta separador
    const SEP = text.includes(';') ? ';' : ','
    const lines = text.replace(/^\ufeff/, '').trim().split(/\r?\n/)
    const headers = lines[0].split(SEP).map(h => h.trim())

    // Monta mapa de categorias por nome para lookup rápido
    const catByName: Record<string, Category> = {}
    categories.forEach(cat => { catByName[cat.name.toLowerCase()] = cat })

    let success = 0
    const errors: string[] = []

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(SEP).map(c => c.trim().replace(',', '.'))
      if (cols.every(c => !c)) continue // linha vazia

      const catName = cols[0]
      const cat = catByName[catName.toLowerCase()]
      if (!cat) { errors.push(`Linha ${i + 1}: categoria "${catName}" não encontrada`); continue }

      for (let m = 0; m < 12; m++) {
        const realIdx = 2 + m * 2       // col: Jan Realizado, Fev Realizado...
        const orcIdx  = 2 + m * 2 + 1   // col: Jan Orçado, Fev Orçado...
        const realizado = parseFloat(cols[realIdx]) || 0
        const orcado    = parseFloat(cols[orcIdx])  || 0
        if (realizado === 0 && orcado === 0) continue // pula mês vazio

        try {
          await upsert.mutateAsync({
            user_id: user!.id, category_id: cat.id,
            year, month: m + 1, realizado, orcado
          })
          success++
        } catch {
          errors.push(`Linha ${i + 1}, mês ${MESES_ABREV[m]}: erro ao salvar`)
        }
      }
    }

    setImporting(false)
    setImportResult({ success, errors })
    if (success > 0) toast({ title: `${success} lançamento(s) importado(s) com sucesso!` })
  }

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Receitas & Despesas</h1>
        <div className="flex items-center gap-2">
          {/* Botões de importação (só nas abas receitas/despesas) */}
          {activeTab !== 'resumo' && (
            <>
              <button
                onClick={downloadTemplate}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                title="Baixar planilha modelo para preenchimento"
              >
                <Download size={13} /> Baixar Modelo
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                title="Importar planilha CSV preenchida"
              >
                {importing
                  ? <><FileSpreadsheet size={13} className="animate-pulse" /> Importando...</>
                  : <><Upload size={13} /> Importar Planilha</>}
              </button>
              <input
                ref={fileInputRef} type="file" accept=".csv"
                className="hidden" onChange={handleImportFile}
              />
            </>
          )}
          <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full font-semibold">{year}</span>
        </div>
      </div>

      <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
        💡 Clique em qualquer célula da tabela para lançar manualmente, ou use <strong>Baixar Modelo</strong> → preencha → <strong>Importar Planilha</strong>.
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="mb-2">
          <TabsTrigger value="receitas">📈 Receitas</TabsTrigger>
          <TabsTrigger value="despesas">📉 Despesas</TabsTrigger>
          <TabsTrigger value="resumo">📊 Resumo Anual</TabsTrigger>
        </TabsList>

        <TabsContent value="receitas" className="space-y-5">
          <SummaryCards groups={incomeGroups} chartGroups={['RENDA_PASSIVA']} categories={byGroup} entryMap={entryMap} type="receitas" />
          <EntriesTable groups={incomeGroups} categories={byGroup} entryMap={entryMap} year={year} type="receitas" />
        </TabsContent>

        <TabsContent value="despesas" className="space-y-5">
          <SummaryCards groups={expenseGroups} categories={byGroup} entryMap={entryMap} type="despesas" />
          <EntriesTable groups={expenseGroups} categories={byGroup} entryMap={entryMap} year={year} type="despesas" />
        </TabsContent>

        <TabsContent value="resumo" className="mt-2">
          <AnnualSummary categories={byGroup} entryMap={entryMap} year={year} />
        </TabsContent>
      </Tabs>

      {/* Modal de resultado */}
      {importResult && (
        <ImportResultModal result={importResult} onClose={() => setImportResult(null)} />
      )}
    </div>
  )
}
