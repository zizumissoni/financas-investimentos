import { useMemo } from 'react'
import { useYear } from '@/contexts/YearContext'
import { useUpcomingBills } from '@/hooks/useDashboard'
import { useEntries, buildEntryMap } from '@/hooks/useEntries'
import { useCategoriesByGroup } from '@/hooks/useCategories'
import { useInvestmentRecords } from '@/hooks/useInvestment'
import { usePatrimonyValues } from '@/hooks/usePatrimony'
import { KPICard } from '@/components/shared/KPICard'
import { LoadingPage } from '@/components/shared/LoadingSpinner'
import { formatCurrency, formatPercent, formatMonth, derivebillStatus, daysUntilDue } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  TrendingUp, TrendingDown, Minus, DollarSign, PiggyBank,
  CreditCard, AlertCircle, Wallet, BarChart2, Landmark,
} from 'lucide-react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import type { AssetClass, InvestmentRecordType } from '@/types/finance.types'

// ─── Classes de ativos que compõem a Renda Passiva ───────────────────────────
const PASSIVE_CLASSES = new Set<AssetClass>(['FII', 'EUA_RENDA', 'CRI_CRA_DEB', 'RFIXA_BR', 'ETF'])
const isPassiveRecord = (cls: AssetClass, type: InvestmentRecordType) =>
  PASSIVE_CLASSES.has(cls) ||
  (cls === 'ACAO_BR' && (type === 'JCP' || type === 'DIVIDENDO'))

// ─── Bill status badge ────────────────────────────────────────────────────────
function BillStatusBadge({ dueDate, paidAt }: { dueDate: string; paidAt?: string | null }) {
  const status = derivebillStatus(dueDate, paidAt)
  const days = daysUntilDue(dueDate)
  if (status === 'PAGO')     return <Badge variant="success">Pago</Badge>
  if (status === 'ATRASADO') return <Badge variant="destructive">Atrasado</Badge>
  if (days <= 3)             return <Badge variant="warning">Vence em {days}d</Badge>
  return <Badge variant="secondary">Pendente</Badge>
}

// ─── Tooltip customizado do gráfico ──────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const rp   = payload.find((p: any) => p.dataKey === 'Renda Passiva')?.value ?? 0
  const desp = payload.find((p: any) => p.dataKey === 'Despesas')?.value ?? 0
  const pct  = payload.find((p: any) => p.dataKey === '% Gasta')?.value ?? 0
  const saldo = rp - desp

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs space-y-1 min-w-[190px]">
      <p className="font-semibold text-gray-700 text-sm mb-2">{label}</p>
      <div className="flex justify-between gap-4">
        <span className="text-blue-600 font-medium">Renda Passiva</span>
        <span className="font-semibold">{formatCurrency(rp)}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-red-500 font-medium">Despesas</span>
        <span className="font-semibold">{formatCurrency(desp)}</span>
      </div>
      <div className="border-t border-gray-100 pt-1 mt-1 flex justify-between gap-4">
        <span className="text-gray-600 font-medium">Saldo</span>
        <span className={`font-bold ${saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {formatCurrency(saldo)}
        </span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-amber-500 font-medium">% Gasta</span>
        <span className="font-semibold text-amber-600">{pct.toFixed(1)}%</span>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export function DashboardPage() {
  const { year } = useYear()

  // ── Fontes de dados ──────────────────────────────────────────────────────────
  // 1. Receitas e Despesas → monthly_entries
  const { data: entries = [], isLoading: loadingEntries } = useEntries(year)
  const { categories, isLoading: loadingCats } = useCategoriesByGroup()

  // 2. Renda Investimentos → investment_records (direto, sem depender do sync)
  const { data: investRecords = [], isLoading: loadingInvest } = useInvestmentRecords(year)

  // 3. Patrimônio → patrimony_values
  const { data: patriValues = [], isLoading: loadingPatri } = usePatrimonyValues()

  // 4. Contas a Pagar → próximos vencimentos
  const { data: upcomingBills = [] } = useUpcomingBills()

  const isLoading = loadingEntries || loadingCats || loadingInvest || loadingPatri

  // ── KPIs: Receitas e Despesas (entries) ──────────────────────────────────────
  const { totalReceitas, totalDespesas, saldo, pctGasta } = useMemo(() => {
    if (!categories.length) return { totalReceitas: 0, totalDespesas: 0, saldo: 0, pctGasta: 0 }
    const map = buildEntryMap(categories, entries)
    let rec = 0, desp = 0
    categories.forEach((cat) => {
      const total = Object.values(map[cat.id] ?? {}).reduce((s, e) => s + (e.realizado ?? 0), 0)
      if (cat.entry_type === 'RECEITA') rec += total
      if (cat.entry_type === 'DESPESA') desp += total
    })
    return {
      totalReceitas: rec,
      totalDespesas: desp,
      saldo: rec - desp,
      pctGasta: rec > 0 ? (desp / rec) * 100 : 0,
    }
  }, [categories, entries])

  // ── KPI: Renda Passiva (investment_records direto) ───────────────────────────
  const rendaPassivaTotal = useMemo(
    () =>
      investRecords
        .filter((r) => isPassiveRecord(r.asset_class, r.record_type))
        .reduce((s, r) => s + Number(r.amount), 0),
    [investRecords]
  )

  // ── KPIs: Patrimônio ─────────────────────────────────────────────────────────
  const patriTotalCurr = useMemo(
    () => patriValues.filter((v) => v.year === year).reduce((s, v) => s + v.value, 0),
    [patriValues, year]
  )
  const patriTotalPrev = useMemo(
    () => patriValues.filter((v) => v.year === year - 1).reduce((s, v) => s + v.value, 0),
    [patriValues, year]
  )
  const patriVariation = patriTotalCurr - patriTotalPrev
  const patriVariationPct = patriTotalPrev > 0 ? (patriVariation / patriTotalPrev) * 100 : 0

  // ── Dados mensais para o gráfico ─────────────────────────────────────────────
  // Renda Passiva por mês: diretamente de investment_records
  const investByMonth = useMemo(() => {
    const map: Record<number, number> = {}
    investRecords
      .filter((r) => isPassiveRecord(r.asset_class, r.record_type))
      .forEach((r) => { map[r.month] = (map[r.month] ?? 0) + Number(r.amount) })
    return map
  }, [investRecords])

  // Despesas por mês: de monthly_entries
  const despByMonth = useMemo(() => {
    if (!categories.length) return {} as Record<number, number>
    const map = buildEntryMap(categories, entries)
    const result: Record<number, number> = {}
    categories.forEach((cat) => {
      if (cat.entry_type !== 'DESPESA') return
      const months = map[cat.id] ?? {}
      Object.entries(months).forEach(([m, e]) => {
        const mn = Number(m)
        result[mn] = (result[mn] ?? 0) + (e.realizado ?? 0)
      })
    })
    return result
  }, [categories, entries])

  // Receitas totais por mês (para calcular % Gasta no gráfico)
  const recByMonth = useMemo(() => {
    if (!categories.length) return {} as Record<number, number>
    const map = buildEntryMap(categories, entries)
    const result: Record<number, number> = {}
    categories.forEach((cat) => {
      if (cat.entry_type !== 'RECEITA') return
      const months = map[cat.id] ?? {}
      Object.entries(months).forEach(([m, e]) => {
        const mn = Number(m)
        result[mn] = (result[mn] ?? 0) + (e.realizado ?? 0)
      })
    })
    return result
  }, [categories, entries])

  // ── Meses com lançamento (para médias corretas) ──────────────────────────────
  const activeMonthsRP   = Math.max(Object.values(investByMonth).filter((v) => v > 0).length, 1)
  const activeMonthsRec  = Math.max(Object.values(recByMonth).filter((v) => v > 0).length, 1)
  const activeMonthsDesp = Math.max(Object.values(despByMonth).filter((v) => v > 0).length, 1)

  const monthlyChartData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const month = i + 1
      const rp   = investByMonth[month] ?? 0
      const desp = despByMonth[month]   ?? 0
      const rec  = recByMonth[month]    ?? 0
      const pct  = rec > 0 ? Math.round((desp / rec) * 1000) / 10 : 0
      return { name: formatMonth(month), 'Renda Passiva': rp, Despesas: desp, '% Gasta': pct }
    }).filter((d) => d['Renda Passiva'] > 0 || d.Despesas > 0)
  }, [investByMonth, despByMonth, recByMonth])

  // ─────────────────────────────────────────────────────────────────────────────

  if (isLoading) return <LoadingPage />

  const pctColor =
    pctGasta > 90 ? 'text-red-600' :
    pctGasta > 70 ? 'text-amber-600' : 'text-green-600'

  const coverageRatio = rendaPassivaTotal > 0
    ? (rendaPassivaTotal / (totalDespesas || 1)) * 100 : 0

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full font-medium">{year}</span>
      </div>

      {/* ── Bloco 1: Receitas & Despesas ── */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 pl-1">
          Receitas &amp; Despesas
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
          <KPICard
            title="Renda Passiva Anual"
            value={formatCurrency(rendaPassivaTotal)}
            icon={<PiggyBank size={18} />}
            trend="up"
            subtitle={`Média: ${formatCurrency(rendaPassivaTotal / activeMonthsRP)}/mês (${activeMonthsRP} meses)`}
          />
          <KPICard
            title="Total de Receitas"
            value={formatCurrency(totalReceitas)}
            icon={<TrendingUp size={18} />}
            trend="up"
            subtitle={`Média: ${formatCurrency(totalReceitas / activeMonthsRec)}/mês (${activeMonthsRec} meses)`}
          />
          <KPICard
            title="Despesas Totais"
            value={formatCurrency(totalDespesas)}
            icon={<CreditCard size={18} />}
            trend="down"
            subtitle={`Média: ${formatCurrency(totalDespesas / activeMonthsDesp)}/mês (${activeMonthsDesp} meses)`}
          />
          <KPICard
            title="Saldo"
            value={formatCurrency(saldo)}
            icon={saldo >= 0 ? <Wallet size={18} /> : <TrendingDown size={18} />}
            trend={saldo >= 0 ? 'up' : 'down'}
            subtitle={`Receitas: ${formatCurrency(totalReceitas)}`}
          />
          <KPICard
            title="% Gasta"
            value={formatPercent(pctGasta, 1)}
            icon={<DollarSign size={18} />}
            subtitle={`Cobertura passiva: ${formatPercent(coverageRatio, 1)}`}
            valueClassName={pctColor}
          />
        </div>
      </div>

      {/* ── Bloco 2: Patrimônio ── */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 pl-1">
          Patrimônio
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KPICard
            title={`Patrimônio Total ${year}`}
            value={formatCurrency(patriTotalCurr)}
            icon={<Landmark size={18} />}
            trend={patriTotalCurr >= patriTotalPrev ? 'up' : 'down'}
            subtitle={patriTotalPrev > 0 ? `Ano anterior: ${formatCurrency(patriTotalPrev)}` : 'Sem dados do ano anterior'}
          />
          <KPICard
            title={`Patrimônio Total ${year - 1}`}
            value={formatCurrency(patriTotalPrev)}
            icon={<BarChart2 size={18} />}
            subtitle={patriTotalPrev > 0 ? `Base de comparação` : 'Sem dados'}
          />
          <KPICard
            title="Variação Patrimonial"
            value={formatCurrency(patriVariation)}
            icon={patriVariation >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
            trend={patriVariation > 0 ? 'up' : patriVariation < 0 ? 'down' : 'neutral'}
            subtitle={patriTotalPrev > 0 ? `${formatPercent(patriVariationPct, 1)} vs ${year - 1}` : '—'}
          />
        </div>
      </div>

      {/* ── Gráfico + Próximos Vencimentos ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Gráfico combinado */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-start justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">
              Renda Passiva vs Despesas Totais — Mensal
            </h2>
            <span className="text-xs text-gray-400 hidden sm:block">
              Passe o mouse para ver o saldo e % gasta
            </span>
          </div>

          {monthlyChartData.length === 0 ? (
            <div className="flex items-center justify-center h-52 text-gray-400 text-sm">
              Nenhum lançamento encontrado para {year}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={monthlyChartData} margin={{ top: 4, right: 36, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />

                {/* Eixo Y esquerdo — valores monetários */}
                <YAxis
                  yAxisId="left"
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 11 }}
                  width={42}
                />

                {/* Eixo Y direito — percentual */}
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 11 }}
                  domain={[0, 100]}
                  width={40}
                />

                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />

                {/* Barras */}
                <Bar yAxisId="left" dataKey="Renda Passiva" fill="#3B82F6" radius={[3, 3, 0, 0]} />
                <Bar yAxisId="left" dataKey="Despesas"      fill="#EF4444" radius={[3, 3, 0, 0]} />

                {/* Linha % Gasta */}
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="% Gasta"
                  stroke="#F59E0B"
                  strokeWidth={2}
                  strokeDasharray="5 3"
                  dot={{ r: 4, fill: '#F59E0B', strokeWidth: 0 }}
                  activeDot={{ r: 6 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Próximos vencimentos */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle size={16} className="text-amber-500" />
            <h2 className="text-sm font-semibold text-gray-700">Próximos Vencimentos</h2>
          </div>
          {upcomingBills.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-400">
              <Minus size={20} className="mb-2" />
              <p className="text-xs">Nenhuma conta nos próximos 7 dias</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingBills.map((bill) => (
                <div key={bill.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{bill.description}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(bill.due_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                      {' · '}
                      {formatCurrency(bill.amount)}
                    </p>
                  </div>
                  <BillStatusBadge dueDate={bill.due_date} paidAt={bill.paid_at} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Barra de cobertura ── */}
      {rendaPassivaTotal > 0 && totalDespesas > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            Cobertura — Renda Passiva / Despesas Totais
          </h2>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Renda Passiva</span>
                <span className="font-medium text-blue-600">{formatCurrency(rendaPassivaTotal)}</span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: '100%' }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Despesas Totais</span>
                <span className="font-medium text-red-500">{formatCurrency(totalDespesas)}</span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min((totalDespesas / rendaPassivaTotal) * 100, 100)}%`,
                    backgroundColor: totalDespesas > rendaPassivaTotal ? '#EF4444' : '#10B981',
                  }}
                />
              </div>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-gray-100">
              <span className="text-xs text-gray-500">Saldo Passiva – Despesas</span>
              <span
                className={`text-sm font-bold ${
                  rendaPassivaTotal >= totalDespesas ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {formatCurrency(rendaPassivaTotal - totalDespesas)}
                {' '}
                <span className="text-xs font-normal text-gray-400">
                  ({formatPercent(coverageRatio, 1)} de cobertura)
                </span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
