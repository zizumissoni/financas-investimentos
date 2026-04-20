import { supabase } from '@/lib/supabase'
import type { Bill } from '@/types/finance.types'

export async function fetchBills(
  userId: string,
  filters?: { year?: number; month?: number }
): Promise<Bill[]> {
  let query = supabase
    .from('bills')
    .select('*')
    .eq('user_id', userId)

  if (filters?.year && filters?.month) {
    const start = `${filters.year}-${String(filters.month).padStart(2, '0')}-01`
    const endMonth = filters.month === 12 ? 1 : filters.month + 1
    const endYear = filters.month === 12 ? filters.year + 1 : filters.year
    const end = `${endYear}-${String(endMonth).padStart(2, '0')}-01`
    query = query.gte('due_date', start).lt('due_date', end)
  } else if (filters?.year) {
    query = query
      .gte('due_date', `${filters.year}-01-01`)
      .lte('due_date', `${filters.year}-12-31`)
  }

  const { data, error } = await query.order('due_date')
  if (error) throw error
  return data as Bill[]
}

export async function fetchUpcomingBills(userId: string, days = 7): Promise<Bill[]> {
  const today = new Date().toISOString().split('T')[0]
  const future = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('bills')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['PENDENTE', 'ATRASADO'])
    .gte('due_date', today)
    .lte('due_date', future)
    .order('due_date')

  if (error) throw error
  return data as Bill[]
}

export async function createBill(bill: Omit<Bill, 'id' | 'user_id' | 'status' | 'created_at'>& { user_id: string }): Promise<Bill> {
  const { data, error } = await supabase.from('bills').insert(bill).select().single()
  if (error) throw error
  return data as Bill
}

export async function updateBill(id: string, updates: Partial<Bill>): Promise<Bill> {
  const { data, error } = await supabase.from('bills').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data as Bill
}

export async function markBillPaid(id: string): Promise<Bill> {
  const { data, error } = await supabase
    .from('bills')
    .update({ paid_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Bill
}

export async function generateNextBill(billId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('generate_next_bill', { p_bill_id: billId })
  if (error) throw error
  return data as string | null
}

export async function deleteBill(id: string): Promise<void> {
  const { error } = await supabase.from('bills').delete().eq('id', id)
  if (error) throw error
}
