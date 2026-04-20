import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from './useAuth'
import {
  fetchInvestmentRecords,
  fetchAllInvestmentRecords,
  createInvestmentRecord,
  updateInvestmentRecord,
  deleteInvestmentRecord,
} from '@/services/investment.service'

const invalidate = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ['investment_records'] })
  qc.invalidateQueries({ queryKey: ['investment_records_all'] })
}

export function useInvestmentRecords(year: number) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['investment_records', user?.id, year],
    queryFn: () => fetchInvestmentRecords(user!.id, year),
    enabled: !!user,
  })
}

export function useAllInvestmentRecords() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['investment_records_all', user?.id],
    queryFn: () => fetchAllInvestmentRecords(user!.id),
    enabled: !!user,
  })
}

export function useCreateInvestmentRecord() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createInvestmentRecord,
    onSuccess: () => invalidate(qc),
  })
}

export function useUpdateInvestmentRecord() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Parameters<typeof updateInvestmentRecord>[1] }) =>
      updateInvestmentRecord(id, updates),
    onSuccess: () => invalidate(qc),
  })
}

export function useDeleteInvestmentRecord() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteInvestmentRecord,
    onSuccess: () => invalidate(qc),
  })
}
