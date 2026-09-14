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

/** Future installments of the same group (installment_number greater than the given one). */
export async function fetchFutureInstallments(groupId: string, afterNumber: number): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('installment_group_id', groupId)
    .gt('installment_number', afterNumber)

  if (error) throw error
  return data as Transaction[]
}

export async function updateTransactionsBulk(ids: string[], updates: Partial<NewTransaction>): Promise<void> {
  if (ids.length === 0) return
  const { error } = await supabase.from('transactions').update(updates).in('id', ids)
  if (error) throw error
}

export async function deleteTransactionsBulk(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const { error } = await supabase.from('transactions').delete().in('id', ids)
  if (error) throw error
}

export async function setTransactionsSettled(ids: string[], is_settled: boolean): Promise<void> {
  if (ids.length === 0) return
  const { error } = await supabase.from('transactions').update({ is_settled }).in('id', ids)
  if (error) throw error
}
