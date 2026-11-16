import { useMemo, useState } from 'react'
import { useCategoriesByGroup } from '@/hooks/useCategories'
import { useAllEntries } from '@/hooks/useEntries'
import { formatCurrency, formatPercent, formatMonth, getCurrentYear, getCurrentMonth, cn } from '@/lib/utils'
import { Flame } from 'lucide-react'
import type { CategoryGroup } from '@/types/finance.types'

const EXPENSE_GROUPS: CategoryGroup[] = ['DESPESAS_ESSENCIAIS', 'DESPESAS_DISCRICIONARIAS']

type Mode = 'anual' | '12m' | 'mensal'
const MODES: { key: Mode; label: string }[] = [
  { key: 'anual', label: 'Anual' },
  { key: '12m', label: '12 meses' },
  { key: 'mensal', label: 'Mensal' },
]

// Índice contínuo de mês: ano*12 + (mês-1), facilita somar/comparar intervalos
const toIdx = (y: number, m: number) => y * 12 + (m - 1)
const idxLabel = (idx: number) => `${formatMonth((idx % 12) + 1)}/${Math.floor(idx / 12)}`
const rangeLabel = (from: number, to: number) => (from === to ? idxLabel(from) : `${idxLabel(from)} – ${idxLabel(to)}`)

export function PersonalInflationCard({ year }: { year: number }) {
  const { byGroup, isLoading: loadingCats } = useCategoriesByGroup()
  const { data: allEntries = [], isLoading: loadingEntries } = useAllEntries()
  const [mode, setMode] = useState<Mode>('anual')

  const expenseCats = useMemo(() => EXPENSE_GROUPS.flatMap((g) => byGroup[g] ?? []), [byGroup])

  // realizado por categoria e mês (índice contínuo)
  const sumMap = useMemo(() => {
    const ids = new Set(expenseCats.map((c) => c.id))
    const map: Record<string, Record<number, number>> = {}
    allEntries.forEach((e) => {
      if (!ids.has(e.category_id)) return
      const idx = toIdx(e.year, e.month)
      if (!map[e.category_id]) map[e.category_id] = {}
      map[e.category_id][idx] = (map[e.category_id][idx] ?? 0) + Number(e.realizado)
    })
    return map
  }, [allEntries, expenseCats])

  const result = useMemo(() => {
    // Último mês fechado relativo ao ano selecionado
    const curY = getCurrentYear()
    const curM = getCurrentMonth()
    let endY: number, endM: number
    if (year > curY) return null
    if (year < curY) { endY = year; endM = 12 }
    else if (curM === 1) { endY = year - 1; endM = 12 }
    else { endY = year; endM = curM - 1 }
    const endIdx = toIdx(endY, endM)

    let cur: [number, number], prev: [number, number]
    if (mode === 'anual') {
      cur = [toIdx(endY, 1), endIdx]
      prev = [toIdx(endY - 1, 1), toIdx(endY - 1, endM)]
    } else if (mode === '12m') {
      cur = [endIdx - 11, endIdx]
      prev = [endIdx - 23, endIdx - 12]
    } else {
      cur = [endIdx, endIdx]
      prev = [endIdx - 1, endIdx - 1]
    }

    const sumRange = (catId: string, [from, to]: [number, number]) => {
      let s = 0
      const m = sumMap[catId]
      if (!m) return 0
      for (let i = from; i <= to; i++) s += m[i] ?? 0
      return s
    }

    const perCat = expenseCats.map((c) => {
      const curV = sumRange(c.id, cur)
      const prevV = sumRange(c.id, prev)
      return { name: c.name, cur: curV, prev: prevV, delta: curV - prevV, pct: prevV > 0 ? ((curV - prevV) / prevV) * 100 : null }
    })

    const totalCur = perCat.reduce((s, c) => s + c.cur, 0)
    const totalPrev = perCat.reduce((s, c) => s + c.prev, 0)
    const top5 = perCat
      .filter((c) => c.pct !== null && c.delta > 0)
      .sort((a, b) => (b.pct as number) - (a.pct as number))
      .slice(0, 5)

    return {
      curLabel: rangeLabel(cur[0], cur[1]),
      prevLabel: rangeLabel(prev[0], prev[1]),
      totalCur, totalPrev,
      delta: totalCur - totalPrev,
      pct: totalPrev > 0 ? ((totalCur - totalPrev) / totalPrev) * 100 : null,
      top5,
    }
  }, [year, mode, sumMap, expenseCats])

  const up = (result?.delta ?? 0) > 0

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Flame size={16} className="text-orange-500" />
          <h2 className="text-sm font-semibold text-gray-700">Inflação Pessoal</h2>
        </div>
        <div className="flex gap-1">
          {MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={cn(
                'px-2 py-1 rounded-md text-[11px] font-semibold transition-colors',
                mode === m.key ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {loadingCats || loadingEntries ? (
        <p className="text-xs text-gray-400 py-8 text-center">Carregando...</p>
      ) : !result || result.totalPrev === 0 ? (
        <p className="text-xs text-gray-400 py-8 text-center">
          Sem dados de despesas no período anterior para comparar.
        </p>
      ) : (
        <>
          <div>
            <p className={cn('text-2xl font-bold leading-none', up ? 'text-red-600' : 'text-green-600')}>
              {up ? '▲' : '▼'} {result.pct !== null ? formatPercent(Math.abs(result.pct), 1) : '—'}
            </p>
            <p className={cn('text-sm font-bold mt-1', up ? 'text-red-600' : 'text-green-600')}>
              {up ? '+' : '−'}{formatCurrency(Math.abs(result.delta))}
            </p>
            <p className="text-[11px] text-gray-400 mt-1">
              {result.curLabel}: {formatCurrency(result.totalCur)}
            </p>
            <p className="text-[11px] text-gray-400">
              vs {result.prevLabel}: {formatCurrency(result.totalPrev)}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 mb-2">Top 5 categorias com maior aumento</p>
            {result.top5.length === 0 ? (
              <p className="text-xs text-gray-400">Nenhuma categoria com aumento no período.</p>
            ) : (
              <div className="space-y-2">
                {result.top5.map((c, i) => (
                  <div key={c.name} className="flex items-center gap-2">
                    <span className="text-[11px] text-gray-400 w-4 shrink-0">{i + 1}º</span>
                    <span className="text-xs text-gray-700 flex-1 truncate">{c.name}</span>
                    <span className="text-[11px] text-gray-500 whitespace-nowrap">+{formatCurrency(c.delta)}</span>
                    <span className="text-xs font-bold text-red-600 w-14 text-right shrink-0">
                      ▲ {formatPercent(c.pct as number, 1)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
