import { supabase } from '@/lib/supabase'
import type { AccountTransfer } from '@/types/finance.types'

export async function fetchTransfers(userId: string): Promise<AccountTransfer[]> {
  const { data, error } = await supabase
    .from('account_transfers')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as AccountTransfer[]
}

export async function createTransfer(
  record: Omit<AccountTransfer, 'id' | 'created_at'>
): Promise<AccountTransfer> {
  const { data, error } = await supabase.from('account_transfers').insert(record).select().single()
  if (error) throw error
  return data as AccountTransfer
}

export async function deleteTransfer(id: string): Promise<void> {
  const { error } = await supabase.from('account_transfers').delete().eq('id', id)
  if (error) throw error
}
