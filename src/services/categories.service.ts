import { supabase } from '@/lib/supabase'
import type { Category } from '@/types/finance.types'

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('group_name')
    .order('display_order')

  if (error) throw error
  return data as Category[]
}
