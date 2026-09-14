import { useMemo, useState } from 'react'
import { useYear } from '@/contexts/YearContext'
import { useCategoriesByGroup } from '@/hooks/useCategories'
import { useEntries, useUpsertEntry, buildEntryMap } from '@/hooks/useEntries'
import { useTransactions } from '@/hooks/useTransactions'
import { useAnnualBudgets, useUpsertAnnualBudget, useDeleteAnnualBudget } from '@/hooks/useAnnualBudgets'
import { useAuth } from '@/hooks/useAuth'
import { formatCurrency, formatPercent, formatMonthFull, getCurrentMonth, cn, MONTHS } from '@/lib/utils'
import { CATEGORY_GROUP_LABELS } from '@/lib/constants'
import { toast } from '@/hooks/useToast'
import { KPICard } from '@/components/shared/KPICard'
import { LoadingPage } from '@/components/shared/LoadingSpinner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  TrendingUp, TrendingDown, Scale, PiggyBank, ChevronLeft, ChevronRight,
  Pencil, Trash2,
} from 'lucide-react'
import type { Category, CategoryGroup } from '@/types/finance.types'

const EXPENSE_GROUPS: CategoryGroup[] = ['DESPESAS_ESSENCIAIS', 'DESPESAS_DISCRICIONARIAS']
const INCOME_GROUPS: CategoryGroup[] = ['RENDA_PASSIVA', 'RENDA_ATIVA_PJ', 'RENDA_ATIVA_INV']

function pctColor(pct: number) {
  return pct > 100 ? 'text-red-600' : pct > 80 ? 'text-amber-600' : 'text-green-600'
}
function barColor(pct: number) {
  return pct > 100 ? 'bg-red-500' : pct > 80 ? 'bg-amber-500' : 'bg-green-500'
}

// ─── Dialog de edição da meta planejada ────────────────────────────────────────
function EditMetaDialog({ category, currentValue, onOpenChange, onSave }: {
  category: Category | null
  currentValue: number
  onOpenChange: (v: boolean) => void
  onSave: (value: number) => Promise<void>
}) {
  const [value, setValue] = useState(String(currentValue || ''))
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    const n = parseFloat(value)
    if (Number.isNaN(n) || n < 0) { toast({ title: 'Informe um valor válido', variant: 'destructive' }); return }
    setSaving(true)
    try {
      await onSave(n)
      onOpenChange(false)
    } catch (e: unknown) {
      toast({ title: 'Erro ao salvar meta', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!category} onOpenChange={(v) => { onOpenChange(v); if (!v) setValue('') }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Meta Planejada — {category?.name}</DialogTitle></DialogHeader>
        <div className="space-y-1.5 py-2">
          <Label>Valor (R$)</Label>
          <Input type="number" step="0.01" placeholder="0,00" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Aguarde...' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function PlanningTab() {
  const { year } = useYear()
  const { user } = useAuth()
  const { byGroup, categories, isLoading: loadingCats } = useCategoriesByGroup()
  const { data: entries = [], isLoading: loadingEntries } = useEntries(year)
  const { data: transactions = [], isLoading: loadingTx } = useTransactions(year)
  const { data: annualBudgets = [], isLoading: loadingAnnual } = useAnnualBudgets(year)
  const upsert = useUpsertEntry()
  const upsertAnnual = useUpsertAnnualBudget()
  const deleteAnnual = useDeleteAnnualBudget()

  const [mode, setMode] = useState<'mensal' | 'anual'>('mensal')
  const [month, setMonth] = useState(getCurrentMonth())
  const [editCat, setEditCat] = useState<Category | null>(null)
  const [resetCat, setResetCat] = useState<Category | null>(null)

  const entryMap = buildEntryMap(categories, entries)
  const annualBudgetMap = useMemo(() => new Map(annualBudgets.map((b) => [b.category_id, Number(b.amount)])), [annualBudgets])
  const monthsInScope = mode === 'mensal' ? [month] : MONTHS

  // Meta: no mensal vem do orçado do mês; no anual é um valor independente (annual_budgets)
  function metaFor(catId: string) {
    if (mode === 'anual') return annualBudgetMap.get(catId) ?? 0
    return entryMap[catId]?.[month]?.orcado ?? 0
  }
  // Despesas pagas: sempre o realizado de verdade (soma do mês ou dos 12 meses do ano)
  function pagasFor(catId: string) {
    return monthsInScope.reduce((s, m) => s + (entryMap[catId]?.[m]?.realizado ?? 0), 0)
  }
  function previstasFor(catId: string) {
    const monthsSet = new Set(monthsInScope)
    return transactions
      .filter((t) => t.category_id === catId && !t.is_settled && !t.is_ignored && monthsSet.has(Number(t.date.slice(5, 7))))
      .reduce((s, t) => s + Number(t.amount), 0)
  }
  function receitasFor() {
    return INCOME_GROUPS.flatMap((g) => byGroup[g] ?? [])
      .reduce((s, cat) => s + pagasFor(cat.id), 0)
  }

  const despesaCategories = EXPENSE_GROUPS.flatMap((g) => byGroup[g] ?? [])

  const totals = useMemo(() => {
    let meta = 0, pagas = 0, previstas = 0
    despesaCategories.forEach((cat) => {
      meta += metaFor(cat.id)
      pagas += pagasFor(cat.id)
      previstas += previstasFor(cat.id)
    })
    const totalGasto = pagas + previstas
    const receitas = receitasFor()
    const gastosPlanejados = meta
    const balancoPlanejado = receitas - gastosPlanejados
    const economiaPlanejada = receitas > 0 ? (balancoPlanejado / receitas) * 100 : 0
    return { meta, pagas, previstas, totalGasto, receitas, gastosPlanejados, balancoPlanejado, economiaPlanejada }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [despesaCategories, entryMap, transactions, annualBudgetMap, mode, monthsInScope.join(','), byGroup])

  async function handleSaveMeta(cat: Category, value: number) {
    if (mode === 'anual') {
      await upsertAnnual.mutateAsync({ user_id: user!.id, category_id: cat.id, year, amount: value })
    } else {
      const curr = entryMap[cat.id]?.[month]
      await upsert.mutateAsync({
        user_id: user!.id, category_id: cat.id, year, month,
        realizado: curr?.realizado ?? 0, orcado: value,
      })
    }
    toast({ title: 'Meta atualizada!', variant: 'success' })
  }

  async function handleReset() {
    if (!resetCat) return
    try {
      if (mode === 'anual') {
        await deleteAnnual.mutateAsync({ categoryId: resetCat.id, year })
      } else {
        const curr = entryMap[resetCat.id]?.[month]
        await upsert.mutateAsync({
          user_id: user!.id, category_id: resetCat.id, year, month,
          realizado: curr?.realizado ?? 0, orcado: 0,
        })
      }
      toast({ title: 'Meta removida', variant: 'success' })
    } catch (e: unknown) {
      toast({ title: 'Erro ao remover meta', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setResetCat(null)
    }
  }

  if (loadingCats || loadingEntries || loadingTx || loadingAnnual) return <LoadingPage />

  const pagasPct = totals.meta > 0 ? (totals.pagas / totals.meta) * 100 : 0
  const previstasPct = totals.meta > 0 ? (totals.previstas / totals.meta) * 100 : 0

  return (
    <div className="mt-2 grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-5">
      <div className="space-y-5">
        {/* ── Modo + Navegação temporal ── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-1">
            {(['mensal', 'anual'] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                  mode === m ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                {m === 'mensal' ? 'Planejamento Mensal' : 'Planejamento Anual'}
              </button>
            ))}
          </div>
          {mode === 'mensal' ? (
            <div className="flex items-center gap-2">
              <button onClick={() => setMonth((m) => m === 1 ? 12 : m - 1)} className="p-1 rounded-full hover:bg-gray-100 text-gray-400">
                <ChevronLeft size={18} />
              </button>
              <span className="text-sm font-bold text-violet-700 bg-violet-50 border border-violet-200 rounded-full px-4 py-1">
                {formatMonthFull(month)} {year}
              </span>
              <button onClick={() => setMonth((m) => m === 12 ? 1 : m + 1)} className="p-1 rounded-full hover:bg-gray-100 text-gray-400">
                <ChevronRight size={18} />
              </button>
            </div>
          ) : (
            <span className="text-sm font-bold text-violet-700 bg-violet-50 border border-violet-200 rounded-full px-4 py-1">
              Ano {year}
            </span>
          )}
        </div>

        {/* ── Card resumo ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-400 font-medium">Restam</p>
          <p className={cn('text-2xl font-bold', totals.meta - totals.totalGasto >= 0 ? 'text-gray-900' : 'text-red-600')}>
            {formatCurrency(totals.meta - totals.totalGasto)}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {formatCurrency(totals.totalGasto)} de {formatCurrency(totals.meta)} gastos
          </p>
          <div className="mt-3 h-2.5 w-full rounded-full bg-gray-100 overflow-hidden flex">
            <div className={cn('h-full', barColor(pagasPct))} style={{ width: `${Math.min(pagasPct, 100)}%` }} />
            <div className="h-full bg-pink-300" style={{ width: `${Math.min(previstasPct, Math.max(0, 100 - pagasPct))}%` }} />
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs">
            <span className={cn('font-semibold', pctColor(pagasPct))}>● {formatPercent(pagasPct)} pagas</span>
            <span className="font-semibold text-pink-500">● {formatPercent(previstasPct)} previstas</span>
          </div>
        </div>

        {/* ── Tabela por categoria ── */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Categoria</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Meta Planejada</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Despesas Pagas</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Despesas Previstas</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Gasto</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[140px]">Progresso</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Ações</th>
                </tr>
              </thead>
              <tbody>
                {EXPENSE_GROUPS.map((g) => {
                  const cats = byGroup[g] ?? []
                  if (cats.length === 0) return null
                  return (
                    <>
                      <tr key={`hdr-${g}`} className="bg-violet-50 border-b border-gray-200">
                        <td colSpan={7} className="px-4 py-2 text-xs font-bold text-violet-800 uppercase tracking-wide">
                          {CATEGORY_GROUP_LABELS[g]}
                        </td>
                      </tr>
                      {cats.map((cat) => {
                        const meta = metaFor(cat.id)
                        const pagas = pagasFor(cat.id)
                        const previstas = previstasFor(cat.id)
                        const totalGasto = pagas + previstas
                        const pct = meta > 0 ? (totalGasto / meta) * 100 : (totalGasto > 0 ? 100 : 0)
                        return (
                          <tr key={cat.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                            <td className="px-4 py-2.5 text-gray-700">{cat.name}</td>
                            <td className="px-4 py-2.5 text-right text-gray-600">{formatCurrency(meta)}</td>
                            <td className="px-4 py-2.5 text-right text-gray-800">{formatCurrency(pagas)}</td>
                            <td className="px-4 py-2.5 text-right text-pink-500">{formatCurrency(previstas)}</td>
                            <td className={cn('px-4 py-2.5 text-right font-semibold', pctColor(pct))}>{formatCurrency(totalGasto)}</td>
                            <td className="px-4 py-2.5">
                              <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                                <div className={cn('h-full', barColor(pct))} style={{ width: `${Math.min(pct, 100)}%` }} />
                              </div>
                              <p className={cn('text-[11px] font-semibold mt-0.5', pctColor(pct))}>{formatPercent(pct)}</p>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => setEditCat(cat)}
                                  className="p-1.5 rounded text-blue-400 hover:bg-blue-50 transition-colors"
                                  title="Editar meta"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  onClick={() => setResetCat(cat)}
                                  disabled={meta === 0}
                                  className="p-1.5 rounded text-red-400 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                  title="Remover meta"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-xs text-gray-400">
          {mode === 'anual'
            ? 'O Planejamento Anual é independente do mensal — cada categoria tem uma meta única para o ano inteiro. As despesas pagas continuam refletindo os valores reais gastos nos 12 meses.'
            : 'Meta de cada categoria para o mês selecionado, sem relação com o Planejamento Anual.'}
        </p>
      </div>

      {/* ── KPIs laterais ── */}
      <div className="grid grid-cols-2 xl:grid-cols-1 gap-4">
        <KPICard title={mode === 'mensal' ? 'Receitas do Mês' : 'Receitas do Ano'} value={formatCurrency(totals.receitas)} icon={<TrendingUp size={18} />} trend="up" />
        <KPICard title="Gastos Planejados" value={formatCurrency(totals.gastosPlanejados)} icon={<TrendingDown size={18} />} trend="down" />
        <KPICard
          title="Balanço Planejado" value={formatCurrency(totals.balancoPlanejado)} icon={<Scale size={18} />}
          trend={totals.balancoPlanejado >= 0 ? 'up' : 'down'} valueClassName={totals.balancoPlanejado >= 0 ? 'text-green-600' : 'text-red-600'}
        />
        <KPICard title="Economia Planejada" value={formatPercent(totals.economiaPlanejada)} icon={<PiggyBank size={18} />} trend={totals.economiaPlanejada >= 0 ? 'up' : 'down'} />
      </div>

      <EditMetaDialog
        category={editCat}
        currentValue={editCat ? metaFor(editCat.id) : 0}
        onOpenChange={(v) => { if (!v) setEditCat(null) }}
        onSave={(value) => handleSaveMeta(editCat!, value)}
      />

      <ConfirmDialog
        open={!!resetCat}
        onOpenChange={(v) => { if (!v) setResetCat(null) }}
        title="Remover meta planejada?"
        description={mode === 'anual'
          ? `A meta anual de "${resetCat?.name}" para ${year} será removida.`
          : `A meta de "${resetCat?.name}" para ${formatMonthFull(month)}/${year} será zerada.`}
        confirmLabel="Remover"
        variant="destructive"
        onConfirm={handleReset}
        loading={upsert.isPending || upsertAnnual.isPending || deleteAnnual.isPending}
      />
    </div>
  )
}
