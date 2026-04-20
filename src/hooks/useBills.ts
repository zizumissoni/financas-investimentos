import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import {
  fetchBills, fetchUpcomingBills, createBill, updateBill,
  markBillPaid, generateNextBill, deleteBill,
} from '@/services/bills.service'
import type { Bill } from '@/types/finance.types'

export function useBills(year?: number, month?: number) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['bills', user?.id, year, month],
    queryFn: () => fetchBills(user!.id, { year, month }),
    enabled: !!user,
    staleTime: 0,
  })
}

export function useUpcomingBills() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['bills-upcoming', user?.id],
    queryFn: () => fetchUpcomingBills(user!.id),
    enabled: !!user,
    staleTime: 0,
  })
}

export function useCreateBill() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: createBill,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bills', user?.id] }),
  })
}

export function useUpdateBill() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Bill> }) => updateBill(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bills', user?.id] }),
  })
}

export function useMarkBillPaid() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (bill: Bill) => {
      const updated = await markBillPaid(bill.id)
      if (bill.is_recurrent) {
        await generateNextBill(bill.id).catch(() => null)
      }
      return updated
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bills', user?.id] })
      qc.invalidateQueries({ queryKey: ['bills-upcoming', user?.id] })
    },
  })
}

export function useDeleteBill() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: deleteBill,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bills', user?.id] })
      qc.invalidateQueries({ queryKey: ['bills-upcoming', user?.id] })
    },
  })
}
