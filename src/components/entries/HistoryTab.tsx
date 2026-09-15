import { useMemo, useState } from 'react'
import { useCategoriesByGroup } from '@/hooks/useCategories'
import { useAllEntries } from '@/hooks/useEntries'
import { formatCurrency, formatPercent, getCurrentYear, cn } from '@/lib/utils'
import { CATEGORY_GROUP_LABELS } from '@/lib/constants'
import { LoadingPage } from '@/components/shared/LoadingSpinner'
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown, Scale } from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import type { Category, CategoryGroup } from '@/types/finance.types'

const INCOME_GROUPS: CategoryGroup[] = ['RENDA_PASSIVA', 'RENDA_ATIVA_PJ', 'RENDA_ATIVA_INV']
const EXPENSE_GROUPS: CategoryGroup[] = ['DESPESAS_ESSENCIAIS', 'DESPESAS_DISCRICIONARIAS']

// ── YoY: para receitas, crescer é bom (verde); para despesas, crescer é ruim (vermelho) ──
function yoyPct(curr: number, prev: number): number | null {
  if (!prev) return null
  return ((curr - prev) / Math.abs(prev)) * 100
}
function yoyColor(pct: number, type: 'receitas' | 'despesas') {
  const good = type === 'receitas' ? pct >= 0 : pct <= 0
  return good ? 'text-green-600' : 'text-red-600'
}

function YoyCell({ value, prevValue, type }: { value: number; prevValue: number | undefined; type: 'receitas' | 'despesas' }) {
  const pct = prevValue !== undefined ? yoyPct(value, prevValue) : null
  return (
    <td className="px-3 py-2 text-center min-w-[110px]">
      <div className="text-xs font-semibold text-gray-800">{value !== 0 ? formatCurrency(value) : '—'}</div>
      {pct !== null && (
        <div className={cn('text-[10px] font-bold', yoyColor(pct, type))}>
          {pct >= 0 ? '▲' : '▼'} {formatPercent(Math.abs(pct))}
        </div>
      )}
    </td>
  )
}

// ─── Tabela de um bloco (Receitas ou Despesas) ────────────────────────────────
function HistoryTable({ title, groups, byGroup, sumMap, years, type }: {
  title: string
  groups: CategoryGroup[]
  byGroup: Record<CategoryGroup, Category[]>
  sumMap: Record<string, Record<number, number>>
  years: number[]
  type: 'receitas' | 'despesas'
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  function valueFor(catId: string, year: number) { return sumMap[catId]?.[year] ?? 0 }
  function groupTotal(cats: Category[], year: number) { return cats.reduce((s, c) => s + valueFor(c.id, year), 0) }
  function grandTotal(year: number) { return groups.flatMap((g) => byGroup[g] ?? []).reduce((s, c) => s + valueFor(c.id, year), 0) }

  const headerBg = type === 'receitas' ? 'bg-green-50' : 'bg-red-50'
  const headerText = type === 'receitas' ? 'text-green-800' : 'text-red-800'

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <h3 className="px-4 py-3 text-sm font-bold text-gray-800 border-b border-gray-200">{title}</h3>
      <div className="overflow-x-auto">
        <table className="text-sm border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-200 bg-gray-50">
              <th className="sticky left-0 z-20 bg-gray-50 px-3 py-2.5 text-left text-xs font-bold text-gray-600 uppercase tracking-wide" style={{ minWidth: 220 }}>
                Categoria
              </th>
              {years.map((y) => (
                <th key={y} className="px-3 py-2.5 text-center text-xs font-bold text-gray-600 min-w-[110px]">{y}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => {
              const cats = byGroup[g] ?? []
              if (cats.length === 0) return null
              const isCollapsed = collapsed[g]
              return (
                <>
                  <tr key={`hdr-${g}`} className={cn('cursor-pointer hover:opacity-90 transition-opacity', headerBg)}
                    onClick={() => setCollapsed((p) => ({ ...p, [g]: !p[g] }))}>
                    <td className={cn('sticky left-0 z-10 px-3 py-2 font-bold text-xs uppercase tracking-wide whitespace-nowrap', headerBg, headerText)} style={{ minWidth: 220 }}>
                      <div className="flex items-center gap-1.5">
                        {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                        {CATEGORY_GROUP_LABELS[g]}
                      </div>
                    </td>
                    {years.map((y, i) => (
                      <YoyCell key={y} value={groupTotal(cats, y)} prevValue={i > 0 ? groupTotal(cats, years[i - 1]) : undefined} type={type} />
                    ))}
                  </tr>
                  {!isCollapsed && cats.map((cat) => (
                    <tr key={cat.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="sticky left-0 z-10 bg-white hover:bg-gray-50/50 px-3 py-2 text-xs text-gray-700 whitespace-nowrap pl-8" style={{ minWidth: 220 }}>
                        {cat.name}
                      </td>
                      {years.map((y, i) => (
                        <YoyCell key={y} value={valueFor(cat.id, y)} prevValue={i > 0 ? valueFor(cat.id, years[i - 1]) : undefined} type={type} />
                      ))}
                    </tr>
                  ))}
                </>
              )
            })}
            <tr className={cn('font-bold border-t-2 border-gray-200', headerBg)}>
              <td className={cn('sticky left-0 z-10 px-3 py-2.5 text-xs uppercase tracking-wide', headerBg, headerText)} style={{ minWidth: 220 }}>
                Total {title}
              </td>
              {years.map((y, i) => (
                <YoyCell key={y} value={grandTotal(y)} prevValue={i > 0 ? grandTotal(years[i - 1]) : undefined} type={type} />
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function HistoryTab() {
  const { byGroup, isLoading: loadingCats } = useCategoriesByGroup()
  const { data: allEntries = [], isLoading: loadingEntries } = useAllEntries()

  // ── Faixa de anos: começa no menor ano com lançamentos (ou 2 antes do atual)
  // e vai até 7 anos à frente, para planejamento futuro ──
  const years = useMemo(() => {
    const dataYears = allEntries.filter((e) => Number(e.realizado) !== 0).map((e) => e.year)
    const currentYear = getCurrentYear()
    const startYear = dataYears.length ? Math.min(...dataYears, currentYear - 2) : currentYear - 2
    const endYear = currentYear + 7
    return Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i)
  }, [allEntries])

  const sumMap = useMemo(() => {
    const map: Record<string, Record<number, number>> = {}
    allEntries.forEach((e) => {
      if (!map[e.category_id]) map[e.category_id] = {}
      map[e.category_id][e.year] = (map[e.category_id][e.year] ?? 0) + Number(e.realizado)
    })
    return map
  }, [allEntries])

  function valueFor(catId: string, year: number) { return sumMap[catId]?.[year] ?? 0 }
  function groupsTotal(groups: CategoryGroup[], year: number) {
    return groups.flatMap((g) => byGroup[g] ?? []).reduce((s, c) => s + valueFor(c.id, year), 0)
  }
  function passivaTotal(year: number) {
    return (byGroup.RENDA_PASSIVA ?? []).reduce((s, c) => s + valueFor(c.id, year), 0)
  }

  const chartData = years.map((y) => ({
    name: String(y),
    Receitas: groupsTotal(INCOME_GROUPS, y),
    Despesas: groupsTotal(EXPENSE_GROUPS, y),
  })).filter((d) => d.Receitas !== 0 || d.Despesas !== 0)

  const passivaChartData = years.map((y) => ({
    name: String(y),
    'Renda Passiva': passivaTotal(y),
    'Despesas Totais': groupsTotal(EXPENSE_GROUPS, y),
  })).filter((d) => d['Renda Passiva'] !== 0 || d['Despesas Totais'] !== 0)

  // ── KPIs: último ano com lançamentos vs. o anterior ──
  const yearsWithData = years.filter((y) => groupsTotal(INCOME_GROUPS, y) !== 0 || groupsTotal(EXPENSE_GROUPS, y) !== 0)
  const latestYear = yearsWithData.length ? Math.max(...yearsWithData) : undefined
  const prevYear = latestYear !== undefined ? latestYear - 1 : undefined
  const receitasLatest = latestYear !== undefined ? groupsTotal(INCOME_GROUPS, latestYear) : 0
  const despesasLatest = latestYear !== undefined ? groupsTotal(EXPENSE_GROUPS, latestYear) : 0
  const receitasPrev = prevYear !== undefined ? groupsTotal(INCOME_GROUPS, prevYear) : 0
  const despesasPrev = prevYear !== undefined ? groupsTotal(EXPENSE_GROUPS, prevYear) : 0
  const receitasYoy = yoyPct(receitasLatest, receitasPrev)
  const despesasYoy = yoyPct(despesasLatest, despesasPrev)
  const saldoLatest = receitasLatest - despesasLatest

  if (loadingCats || loadingEntries) return <LoadingPage />

  return (
    <div className="space-y-5 mt-2">
      {/* ── KPIs do último ano com lançamentos ── */}
      {latestYear !== undefined && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-400 font-medium flex items-center gap-1.5"><TrendingUp size={13} className="text-green-500" /> Receitas {latestYear}</p>
            <p className="text-xl font-bold text-green-600 mt-1">{formatCurrency(receitasLatest)}</p>
            {receitasYoy !== null && (
              <p className={cn('text-xs font-semibold mt-0.5', yoyColor(receitasYoy, 'receitas'))}>
                {receitasYoy >= 0 ? '▲' : '▼'} {formatPercent(Math.abs(receitasYoy))} vs {prevYear}
              </p>
            )}
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-400 font-medium flex items-center gap-1.5"><TrendingDown size={13} className="text-red-500" /> Despesas {latestYear}</p>
            <p className="text-xl font-bold text-red-600 mt-1">{formatCurrency(despesasLatest)}</p>
            {despesasYoy !== null && (
              <p className={cn('text-xs font-semibold mt-0.5', yoyColor(despesasYoy, 'despesas'))}>
                {despesasYoy >= 0 ? '▲' : '▼'} {formatPercent(Math.abs(despesasYoy))} vs {prevYear}
              </p>
            )}
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-400 font-medium flex items-center gap-1.5"><Scale size={13} className="text-violet-500" /> Saldo {latestYear}</p>
            <p className={cn('text-xl font-bold mt-1', saldoLatest >= 0 ? 'text-green-600' : 'text-red-600')}>{formatCurrency(saldoLatest)}</p>
          </div>
        </div>
      )}

      {/* ── Gráficos comparativos ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="text-sm font-bold text-gray-700 mb-4">Receitas vs Despesas — Ano a Ano</h3>
          {chartData.length === 0 ? (
            <p className="text-sm text-gray-400">Sem dados suficientes para o gráfico</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Receitas" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Despesas" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="text-sm font-bold text-gray-700 mb-4">Renda Passiva vs Despesas Totais — Evolução</h3>
          {passivaChartData.length === 0 ? (
            <p className="text-sm text-gray-400">Sem dados suficientes para o gráfico</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={passivaChartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="Renda Passiva" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Despesas Totais" stroke="#EF4444" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Tabelas detalhadas por categoria ── */}
      <HistoryTable title="Receitas" groups={INCOME_GROUPS} byGroup={byGroup} sumMap={sumMap} years={years} type="receitas" />
      <HistoryTable title="Despesas" groups={EXPENSE_GROUPS} byGroup={byGroup} sumMap={sumMap} years={years} type="despesas" />

      <p className="text-xs text-gray-400">
        Clique no nome de um grupo para recolher/expandir suas categorias. As setas (▲/▼) mostram a variação percentual em relação ao ano anterior.
      </p>
    </div>
  )
}
