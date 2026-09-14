import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import {
  fetchBankAccounts, createBankAccount, updateBankAccountBalance, deleteBankAccount,
} from '@/services/bankAccounts.service'

export function useBankAccounts() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['bank-accounts', user?.id],
    queryFn: () => fetchBankAccounts(user!.id),
    enabled: !!user,
  })
}

export function useCreateBankAccount() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: createBankAccount,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bank-accounts', user?.id] }),
  })
}

export function useUpdateBankAccountBalance() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: ({ id, balance }: { id: string; balance: number }) => updateBankAccountBalance(id, balance),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bank-accounts', user?.id] }),
  })
}

export function useDeleteBankAccount() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: deleteBankAccount,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bank-accounts', user?.id] }),
  })
}
