import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { fetchTransfers, createTransfer, deleteTransfer } from '@/services/transfers.service'

function invalidateAffected(qc: ReturnType<typeof useQueryClient>, userId?: string) {
  qc.invalidateQueries({ queryKey: ['transfers', userId] })
  qc.invalidateQueries({ queryKey: ['bank-accounts', userId] })
}

export function useTransfers() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['transfers', user?.id],
    queryFn: () => fetchTransfers(user!.id),
    enabled: !!user,
  })
}

export function useCreateTransfer() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: createTransfer,
    onSuccess: () => invalidateAffected(qc, user?.id),
  })
}

export function useDeleteTransfer() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: deleteTransfer,
    onSuccess: () => invalidateAffected(qc, user?.id),
  })
}
