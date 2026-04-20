import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { fetchEntries, upsertEntry } from '@/services/entries.service'
import type { Category, MonthlyEntry, MonthlyEntryMap } from '@/types/finance.types'

export function buildEntryMap(categories: Category[], entries: MonthlyEntry[]): MonthlyEntryMap {
  const map: MonthlyEntryMap = {}
  categories.forEach((cat) => {
    map[cat.id] = {}
    for (let m = 1; m <= 12; m++) {
      map[cat.id][m] = { realizado: 0, orcado: 0, id: '' }
    }
  })
  entries.forEach((e) => {
    if (map[e.category_id]) {
      map[e.category_id][e.month] = {
        realizado: Number(e.realizado),
        orcado: Number(e.orcado),
        id: e.id,
      }
    }
  })
  return map
}

export function useEntries(year: number) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['entries', user?.id, year],
    queryFn: () => fetchEntries(user!.id, year),
    enabled: !!user,
  })
}

export function useUpsertEntry() {
  const qc = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: upsertEntry,
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['entries', user?.id, variables.year] })
    },
  })
}
