import { supabase } from '@/lib/supabase'
import type { Transaction } from '@/types/finance.types'

export async function fetchTransactions(userId: string, year: number): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .gte('date', `${year}-01-01`)
    .lte('date', `${year}-12-31`)
    .order('date', { ascending: false })

  if (error) throw error
  return data as Transaction[]
}

export type NewTransaction = Omit<Transaction, 'id' | 'created_at' | 'updated_at'>

export async function createTransaction(record: NewTransaction): Promise<Transaction> {
  const { data, error } = await supabase.from('transactions').insert(record).select().single()
  if (error) throw error
  return data as Transaction
}

export async function createTransactions(records: NewTransaction[]): Promise<Transaction[]> {
  const { data, error } = await supabase.from('transactions').insert(records).select()
  if (error) throw error
  return data as Transaction[]
}

export async function updateTransaction(id: string, updates: Partial<NewTransaction>): Promise<Transaction> {
  const { data, error } = await supabase.from('transactions').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data as Transaction
}

export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) throw error
}
