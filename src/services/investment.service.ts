import { supabase } from '@/lib/supabase'
import type { InvestmentRecord } from '@/types/finance.types'

export async function fetchInvestmentRecords(
  userId: string,
  year: number
): Promise<InvestmentRecord[]> {
  const { data, error } = await supabase
    .from('investment_records')
    .select('*')
    .eq('user_id', userId)
    .eq('year', year)
    .order('month', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as InvestmentRecord[]
}

export async function fetchAllInvestmentRecords(
  userId: string
): Promise<InvestmentRecord[]> {
  const { data, error } = await supabase
    .from('investment_records')
    .select('*')
    .eq('user_id', userId)
    .order('year', { ascending: false })
    .order('month', { ascending: false })
  if (error) throw error
  return data as InvestmentRecord[]
}

export async function createInvestmentRecord(
  record: Omit<InvestmentRecord, 'id' | 'created_at'>
): Promise<InvestmentRecord> {
  const { data, error } = await supabase
    .from('investment_records')
    .insert(record)
    .select()
    .single()
  if (error) throw error
  return data as InvestmentRecord
}

export async function bulkCreateInvestmentRecords(
  records: Omit<InvestmentRecord, 'id' | 'created_at'>[]
): Promise<{ inserted: number; errorMsg?: string }> {
  if (records.length === 0) return { inserted: 0 }
  // Supabase aceita array → uma única requisição para N linhas
  const { data, error } = await supabase
    .from('investment_records')
    .insert(records)
    .select('id')
  if (error) return { inserted: 0, errorMsg: error.message }
  return { inserted: data?.length ?? records.length }
}

export async function updateInvestmentRecord(
  id: string,
  updates: Partial<Omit<InvestmentRecord, 'id' | 'user_id' | 'created_at'>>
): Promise<InvestmentRecord> {
  const { data, error } = await supabase
    .from('investment_records')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as InvestmentRecord
}

export async function deleteInvestmentRecord(id: string): Promise<void> {
  const { error } = await supabase.from('investment_records').delete().eq('id', id)
  if (error) throw error
}
