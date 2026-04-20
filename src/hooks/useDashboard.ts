import { useMemo } from 'react'
import { useEntries } from '@/hooks/useEntries'
import { useCategoriesByGroup } from '@/hooks/useCategories'
import { useUpcomingBills } from '@/hooks/useBills'
import { useYear } from '@/contexts/YearContext'
import type { DashboardSummary } from '@/types/finance.types'
import { buildEntryMap } from '@/hooks/useEntries'

export function useDashboardSummary(): { summary: DashboardSummary | null; isLoading: boolean } {
  const { year } = useYear()
  const { data: entries = [], isLoading: loadingEntries } = useEntries(year)
  const { categories, isLoading: loadingCats } = useCategoriesByGroup()

  const summary = useMemo(() => {
    if (!categories.length || !entries.length && !loadingEntries) {
      const map = buildEntryMap(categories, entries)
      let total_renda_passiva = 0
      let total_receitas = 0
      let total_despesas = 0

      categories.forEach((cat) => {
        const catEntries = map[cat.id] ?? {}
        const total = Object.values(catEntries).reduce((s, e) => s + (e.realizado ?? 0), 0)
        if (cat.group_name === 'RENDA_PASSIVA') total_renda_passiva += total
        if (cat.entry_type === 'RECEITA') total_receitas += total
        if (cat.entry_type === 'DESPESA') total_despesas += total
      })

      const saldo = total_receitas - total_despesas
      const pct_gasta = total_receitas > 0 ? (total_despesas / total_receitas) * 100 : 0

      return { year, total_renda_passiva, total_receitas, total_despesas, saldo, pct_gasta }
    }
    return null
  }, [categories, entries, year, loadingEntries])

  return { summary, isLoading: loadingEntries || loadingCats }
}

export { useUpcomingBills }
