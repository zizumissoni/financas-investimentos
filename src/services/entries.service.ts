import { supabase } from '@/lib/supabase'
import type { MonthlyEntry } from '@/types/finance.types'

export async function fetchEntries(userId: string, year: number): Promise<MonthlyEntry[]> {
  const { data, error } = await supabase
    .from('monthly_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('year', year)

  if (error) throw error
  return data as MonthlyEntry[]
}

/** All monthly_entries across every year — used by the Histórico Anual tab. */
export async function fetchAllEntries(userId: string): Promise<MonthlyEntry[]> {
  const { data, error } = await supabase
    .from('monthly_entries')
    .select('*')
    .eq('user_id', userId)

  if (error) throw error
  return data as MonthlyEntry[]
}

export async function upsertEntry(entry: {
  user_id: string
  category_id: string
  year: number
  month: number
  realizado?: number
  orcado?: number
  notes?: string
}): Promise<MonthlyEntry> {
  const { data, error } = await supabase
    .from('monthly_entries')
    .upsert(entry, { onConflict: 'user_id,category_id,year,month' })
    .select()
    .single()

  if (error) throw error
  return data as MonthlyEntry
}

export async function deleteEntry(id: string): Promise<void> {
  const { error } = await supabase.from('monthly_entries').delete().eq('id', id)
  if (error) throw error
}

/** Upsert many monthly_entries in one request. Only overwrites `realizado`; preserves `orcado`. */
export async function bulkUpsertEntries(
  entries: { user_id: string; category_id: string; year: number; month: number; realizado: number }[]
): Promise<void> {
  if (entries.length === 0) return
  const { error } = await supabase
    .from('monthly_entries')
    .upsert(entries, { onConflict: 'user_id,category_id,year,month' })
  if (error) throw error
}
