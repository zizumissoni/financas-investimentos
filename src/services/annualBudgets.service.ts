import { supabase } from '@/lib/supabase'
import type { AnnualBudget } from '@/types/finance.types'

export async function fetchAnnualBudgets(userId: string, year: number): Promise<AnnualBudget[]> {
  const { data, error } = await supabase
    .from('annual_budgets')
    .select('*')
    .eq('user_id', userId)
    .eq('year', year)

  if (error) throw error
  return data as AnnualBudget[]
}

export async function upsertAnnualBudget(budget: {
  user_id: string
  category_id: string
  year: number
  amount: number
}): Promise<AnnualBudget> {
  const { data, error } = await supabase
    .from('annual_budgets')
    .upsert(budget, { onConflict: 'user_id,category_id,year' })
    .select()
    .single()

  if (error) throw error
  return data as AnnualBudget
}

export async function deleteAnnualBudget(userId: string, categoryId: string, year: number): Promise<void> {
  const { error } = await supabase
    .from('annual_budgets')
    .delete()
    .eq('user_id', userId)
    .eq('category_id', categoryId)
    .eq('year', year)
  if (error) throw error
}
