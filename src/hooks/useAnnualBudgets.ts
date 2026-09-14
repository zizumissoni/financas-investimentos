import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { fetchAnnualBudgets, upsertAnnualBudget, deleteAnnualBudget } from '@/services/annualBudgets.service'

export function useAnnualBudgets(year: number) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['annual-budgets', user?.id, year],
    queryFn: () => fetchAnnualBudgets(user!.id, year),
    enabled: !!user,
  })
}

export function useUpsertAnnualBudget() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: upsertAnnualBudget,
    onSuccess: (_data, variables) => qc.invalidateQueries({ queryKey: ['annual-budgets', user?.id, variables.year] }),
  })
}

export function useDeleteAnnualBudget() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: ({ categoryId, year }: { categoryId: string; year: number }) => deleteAnnualBudget(user!.id, categoryId, year),
    onSuccess: (_data, variables) => qc.invalidateQueries({ queryKey: ['annual-budgets', user?.id, variables.year] }),
  })
}
