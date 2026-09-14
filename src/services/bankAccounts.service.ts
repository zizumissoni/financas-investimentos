import { supabase } from '@/lib/supabase'
import type { BankAccount } from '@/types/finance.types'

export async function fetchBankAccounts(userId: string): Promise<BankAccount[]> {
  const { data, error } = await supabase
    .from('bank_accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('display_order')
    .order('name')

  if (error) throw error
  return data as BankAccount[]
}

export async function createBankAccount(account: {
  user_id: string
  name: string
  balance?: number
  display_order?: number
}): Promise<BankAccount> {
  const { data, error } = await supabase.from('bank_accounts').insert(account).select().single()
  if (error) throw error
  return data as BankAccount
}

export async function updateBankAccountBalance(id: string, balance: number): Promise<BankAccount> {
  const { data, error } = await supabase
    .from('bank_accounts')
    .update({ balance })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as BankAccount
}

export async function deleteBankAccount(id: string): Promise<void> {
  const { error } = await supabase.from('bank_accounts').update({ is_active: false }).eq('id', id)
  if (error) throw error
}
