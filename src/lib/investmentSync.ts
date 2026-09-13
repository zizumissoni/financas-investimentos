/**
 * investmentSync.ts
 *
 * Keeps "Receitas e Despesas" (monthly_entries) in sync with
 * investment_records whenever the user creates, updates or deletes
 * a record in the "Renda Investimentos" page.
 *
 * Rules (category name → filter on investment_records):
 *  - Rendimentos de FIIs    ← class = FII  AND type = RENDIMENTO (exclui vendas)
 *  - JCP                   ← class = ACAO_BR  AND type = JCP
 *  - Dividendos-Ações BR   ← class = ACAO_BR  AND type = DIVIDENDO
 *  - Exterior-Dividendos   ← class = EUA_RENDA  (any type)
 *  - Juros-CRI/CRA/DEB     ← class = CRI_CRA_DEB  (any type)
 *  - Amortizações-R.Fixa   ← class = RFIXA_BR  (any type)
 *  - ETFs-Renda Fixa       ← class = ETF  (any type)
 */

import { fetchInvestmentRecords } from '@/services/investment.service'
import { bulkUpsertEntries }       from '@/services/entries.service'
import type { Category, InvestmentRecord } from '@/types/finance.types'

type Mapping = {
  categoryName: string
  filter: (r: InvestmentRecord) => boolean
}

export const INVESTMENT_SYNC_MAPPINGS: Mapping[] = [
  {
    categoryName: 'Rendimentos de FIIs',
    filter: (r) => r.asset_class === 'FII' && r.record_type === 'RENDIMENTO',
  },
  {
    categoryName: 'JCP',
    filter: (r) => r.asset_class === 'ACAO_BR' && r.record_type === 'JCP',
  },
  {
    categoryName: 'Dividendos-Ações BR',
    filter: (r) => r.asset_class === 'ACAO_BR' && r.record_type === 'DIVIDENDO',
  },
  {
    categoryName: 'Exterior-Dividendos',
    filter: (r) => r.asset_class === 'EUA_RENDA',
  },
  {
    categoryName: 'Juros-CRI/CRA/DEB',
    filter: (r) => r.asset_class === 'CRI_CRA_DEB',
  },
  {
    categoryName: 'Amortizações-R.Fixa',
    filter: (r) => r.asset_class === 'RFIXA_BR',
  },
  {
    categoryName: 'ETFs-Renda Fixa',
    filter: (r) => r.asset_class === 'ETF',
  },
]

export type SyncResult = {
  synced: string[]      // category names successfully synced
  missing: string[]     // category names not found in DB
  rowsUpserted: number
}

/**
 * Fetches the latest investment records for `year`, sums them per category/month
 * according to INVESTMENT_SYNC_MAPPINGS, and bulk-upserts the results into
 * monthly_entries (only `realizado` — `orcado` is preserved).
 *
 * Returns a SyncResult so callers can surface feedback about missing categories.
 */
export async function syncInvestmentToEntries(
  userId: string,
  year: number,
  categories: Category[]
): Promise<SyncResult> {
  // Log available category names for debugging
  console.log('[investmentSync] Available categories:', categories.map((c) => `"${c.name}"`).join(', '))

  // Fetch fresh records directly from the DB (not from React Query cache)
  const records = await fetchInvestmentRecords(userId, year)
  console.log(`[investmentSync] Found ${records.length} investment records for year ${year}`)

  const rows: Parameters<typeof bulkUpsertEntries>[0] = []
  const synced: string[] = []
  const missing: string[] = []

  for (const { categoryName, filter } of INVESTMENT_SYNC_MAPPINGS) {
    // Normalize: trim whitespace and compare case-insensitively
    const cat = categories.find(
      (c) => c.name.trim().toLowerCase() === categoryName.trim().toLowerCase()
    )

    if (!cat) {
      missing.push(categoryName)
      console.warn(`[investmentSync] Category NOT found in DB: "${categoryName}"`)
      continue
    }

    // Sum matching records by month
    const byMonth: Record<number, number> = {}
    const matched = records.filter(filter)
    matched.forEach((r) => {
      byMonth[r.month] = (byMonth[r.month] ?? 0) + Number(r.amount)
    })

    console.log(`[investmentSync] "${categoryName}": ${matched.length} records → months:`, byMonth)

    // Generate one upsert row per month (0 clears months that had data before)
    for (let month = 1; month <= 12; month++) {
      rows.push({
        user_id: userId,
        category_id: cat.id,
        year,
        month,
        realizado: byMonth[month] ?? 0,
      })
    }

    synced.push(categoryName)
  }

  if (rows.length > 0) await bulkUpsertEntries(rows)

  console.log(`[investmentSync] Done — ${rows.length} rows upserted. Missing: [${missing.join(', ')}]`)
  return { synced, missing, rowsUpserted: rows.length }
}
