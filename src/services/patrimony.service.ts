import { supabase } from '@/lib/supabase'
import type { PatrimonyItem, PatrimonyValue, PatrimonyContribution } from '@/types/finance.types'

export async function fetchPatrimonyItems(userId: string): Promise<PatrimonyItem[]> {
  const { data, error } = await supabase
    .from('patrimony_items')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('category')
    .order('display_order')
    .order('name')

  if (error) throw error
  return data as PatrimonyItem[]
}

/** Checks if a Supabase error is about a missing column */
function isMissingColumnError(msg: string, col: string) {
  return msg.includes(`'${col}'`) || msg.toLowerCase().includes(col)
}

export async function createPatrimonyItem(item: {
  user_id: string
  name: string
  category: string
  owner?: string
  display_order?: number
}): Promise<PatrimonyItem> {
  const { data, error } = await supabase.from('patrimony_items').insert(item).select().single()
  if (!error) return { ...(data as PatrimonyItem), owner: (data as PatrimonyItem).owner ?? item.owner ?? 'Giovani' }

  // If the 'owner' column doesn't exist yet, retry without it
  if (isMissingColumnError(error.message, 'owner')) {
    const { owner: _o, ...rest } = item
    const { data: d2, error: e2 } = await supabase.from('patrimony_items').insert(rest).select().single()
    if (e2) throw e2
    return { ...(d2 as PatrimonyItem), owner: item.owner ?? 'Giovani' }
  }
  throw error
}

export async function updatePatrimonyItem(id: string, updates: Partial<PatrimonyItem>): Promise<PatrimonyItem> {
  const { data, error } = await supabase.from('patrimony_items').update(updates).eq('id', id).select().single()
  if (!error) return { ...(data as PatrimonyItem), owner: (data as PatrimonyItem).owner ?? updates.owner ?? 'Giovani' }

  // If the 'owner' column doesn't exist yet, retry without it
  if (isMissingColumnError(error.message, 'owner')) {
    const { owner: _o, ...rest } = updates
    const { data: d2, error: e2 } = await supabase.from('patrimony_items').update(rest).eq('id', id).select().single()
    if (e2) throw e2
    return { ...(d2 as PatrimonyItem), owner: updates.owner ?? 'Giovani' }
  }
  throw error
}

export async function deletePatrimonyItem(id: string): Promise<void> {
  const { error } = await supabase.from('patrimony_items').update({ is_active: false }).eq('id', id)
  if (error) throw error
}

export async function fetchPatrimonyValues(userId: string): Promise<PatrimonyValue[]> {
  const { data, error } = await supabase
    .from('patrimony_values')
    .select('*')
    .eq('user_id', userId)
    .order('year')

  if (error) throw error
  return data as PatrimonyValue[]
}

export async function upsertPatrimonyValue(value: {
  user_id: string
  item_id: string
  year: number
  value: number
}): Promise<PatrimonyValue> {
  const { data, error } = await supabase
    .from('patrimony_values')
    .upsert(value, { onConflict: 'user_id,item_id,year' })
    .select()
    .single()

  if (error) throw error
  return data as PatrimonyValue
}

// ─── Aportes e Resgates ───────────────────────────────────────────────────────

export async function fetchPatrimonyContributions(userId: string): Promise<PatrimonyContribution[]> {
  const { data, error } = await supabase
    .from('patrimony_contributions')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as PatrimonyContribution[]
}

export async function createPatrimonyContribution(
  record: Omit<PatrimonyContribution, 'id' | 'created_at'>
): Promise<PatrimonyContribution> {
  const { data, error } = await supabase
    .from('patrimony_contributions')
    .insert(record)
    .select()
    .single()
  if (!error) return data as PatrimonyContribution

  // If 'category' column doesn't exist yet, retry without it
  if (isMissingColumnError(error.message, 'category')) {
    const { category: _c, ...rest } = record
    const { data: d2, error: e2 } = await supabase
      .from('patrimony_contributions').insert(rest).select().single()
    if (e2) throw e2
    return { ...(d2 as PatrimonyContribution), category: record.category ?? '' }
  }
  throw error
}

export async function updatePatrimonyContribution(
  id: string,
  updates: Partial<Omit<PatrimonyContribution, 'id' | 'user_id' | 'created_at'>>
): Promise<PatrimonyContribution> {
  const { data, error } = await supabase
    .from('patrimony_contributions')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (!error) return data as PatrimonyContribution

  // If 'category' column doesn't exist yet, retry without it
  if (isMissingColumnError(error.message, 'category')) {
    const { category: _c, ...rest } = updates
    const { data: d2, error: e2 } = await supabase
      .from('patrimony_contributions').update(rest).eq('id', id).select().single()
    if (e2) throw e2
    return { ...(d2 as PatrimonyContribution), category: updates.category ?? '' }
  }
  throw error
}

export async function deletePatrimonyContribution(id: string): Promise<void> {
  const { error } = await supabase.from('patrimony_contributions').delete().eq('id', id)
  if (error) throw error
}
