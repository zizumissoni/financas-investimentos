import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { useCategories } from '@/hooks/useCategories'
import { syncInvestmentToEntries, type SyncResult } from '@/lib/investmentSync'

/**
 * Returns an async `sync(year)` function that:
 *  1. Fetches fresh investment_records for that year
 *  2. Computes totals per category/month
 *  3. Bulk-upserts monthly_entries (realizado only)
 *  4. Invalidates the 'entries' React Query cache so EntriesPage re-renders
 *
 * Returns SyncResult with synced/missing category names for UI feedback.
 */
export function useSyncInvestmentToEntries() {
  const { user } = useAuth()
  const { data: categories = [] } = useCategories()
  const qc = useQueryClient()

  return async function sync(year: number): Promise<SyncResult | null> {
    if (!user || categories.length === 0) return null
    try {
      const result = await syncInvestmentToEntries(user.id, year, categories)
      qc.invalidateQueries({ queryKey: ['entries', user.id, year] })
      qc.invalidateQueries({ queryKey: ['entries-all', user.id] })
      return result
    } catch (err) {
      console.error('[investmentSync] Failed to sync to entries:', err)
      return null
    }
  }
}
