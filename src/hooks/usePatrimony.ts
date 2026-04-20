import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import {
  fetchPatrimonyItems, createPatrimonyItem, updatePatrimonyItem, deletePatrimonyItem,
  fetchPatrimonyValues, upsertPatrimonyValue,
  fetchPatrimonyContributions, createPatrimonyContribution,
  updatePatrimonyContribution, deletePatrimonyContribution,
} from '@/services/patrimony.service'

export function usePatrimonyItems() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['patrimony-items', user?.id],
    queryFn: () => fetchPatrimonyItems(user!.id),
    enabled: !!user,
  })
}

export function useCreatePatrimonyItem() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: createPatrimonyItem,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patrimony-items', user?.id] }),
  })
}

export function useUpdatePatrimonyItem() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Parameters<typeof updatePatrimonyItem>[1] }) =>
      updatePatrimonyItem(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patrimony-items', user?.id] }),
  })
}

export function useDeletePatrimonyItem() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: deletePatrimonyItem,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patrimony-items', user?.id] }),
  })
}

export function usePatrimonyValues() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['patrimony-values', user?.id],
    queryFn: () => fetchPatrimonyValues(user!.id),
    enabled: !!user,
  })
}

export function useUpsertPatrimonyValue() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: upsertPatrimonyValue,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patrimony-values', user?.id] }),
  })
}

// ─── Aportes e Resgates ───────────────────────────────────────────────────────

export function usePatrimonyContributions() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['patrimony-contributions', user?.id],
    queryFn: () => fetchPatrimonyContributions(user!.id),
    enabled: !!user,
  })
}

export function useCreatePatrimonyContribution() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: createPatrimonyContribution,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patrimony-contributions', user?.id] }),
  })
}

export function useUpdatePatrimonyContribution() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Parameters<typeof updatePatrimonyContribution>[1] }) =>
      updatePatrimonyContribution(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patrimony-contributions', user?.id] }),
  })
}

export function useDeletePatrimonyContribution() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: deletePatrimonyContribution,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patrimony-contributions', user?.id] }),
  })
}
