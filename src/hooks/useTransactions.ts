import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import {
  fetchTransactions, createTransaction, createTransactions,
  updateTransaction, deleteTransaction,
  updateTransactionsBulk, deleteTransactionsBulk, setTransactionsSettled,
} from '@/services/transactions.service'

// A transaction write affects monthly_entries (any year, via installments spanning
// months) and bank_accounts.balance through DB triggers — invalidate broadly so
// every page reflects the change without needing to know the exact years touched.
function invalidateAffected(qc: ReturnType<typeof useQueryClient>, userId?: string) {
  qc.invalidateQueries({ queryKey: ['transactions', userId] })
  qc.invalidateQueries({ queryKey: ['entries', userId] })
  qc.invalidateQueries({ queryKey: ['bank-accounts', userId] })
}

export function useTransactions(year: number) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['transactions', user?.id, year],
    queryFn: () => fetchTransactions(user!.id, year),
    enabled: !!user,
  })
}

export function useCreateTransaction() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: createTransaction,
    onSuccess: () => invalidateAffected(qc, user?.id),
  })
}

export function useCreateTransactions() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: createTransactions,
    onSuccess: () => invalidateAffected(qc, user?.id),
  })
}

export function useUpdateTransaction() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Parameters<typeof updateTransaction>[1] }) =>
      updateTransaction(id, updates),
    onSuccess: () => invalidateAffected(qc, user?.id),
  })
}

export function useDeleteTransaction() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: deleteTransaction,
    onSuccess: () => invalidateAffected(qc, user?.id),
  })
}

export function useUpdateTransactionsBulk() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: ({ ids, updates }: { ids: string[]; updates: Parameters<typeof updateTransactionsBulk>[1] }) =>
      updateTransactionsBulk(ids, updates),
    onSuccess: () => invalidateAffected(qc, user?.id),
  })
}

export function useDeleteTransactionsBulk() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: deleteTransactionsBulk,
    onSuccess: () => invalidateAffected(qc, user?.id),
  })
}

export function useSetTransactionsSettled() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: ({ ids, is_settled }: { ids: string[]; is_settled: boolean }) => setTransactionsSettled(ids, is_settled),
    onSuccess: () => invalidateAffected(qc, user?.id),
  })
}
