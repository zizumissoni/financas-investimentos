import { useState, useRef, useEffect, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import {
  usePatrimonyItems, useCreatePatrimonyItem, useUpdatePatrimonyItem, useDeletePatrimonyItem,
  usePatrimonyValues, useUpsertPatrimonyValue,
  usePatrimonyContributions, useCreatePatrimonyContribution,
  useUpdatePatrimonyContribution, useDeletePatrimonyContribution,
} from '@/hooks/usePatrimony'
import { useCategories } from '@/hooks/useCategories'
import { useEntries } from '@/hooks/useEntries'
import { useInvestmentRecords } from '@/hooks/useInvestment'
import { getOwnerMap, saveOwner } from '@/lib/patrimonyOwners'
import { formatCurrency, formatPercent, getCurrentYear } from '@/lib/utils'
import { PATRIMONY_CATEGORIES, CONTRIBUTION_CATEGORIES } from '@/lib/constants'
import { KPICard } from '@/components/shared/KPICard'
import { LoadingPage } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/hooks/useToast'
import { cn } from '@/lib/utils'
import type { PatrimonyItem, PatrimonyValue, PatrimonyContribution } from '@/types/finance.types'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Plus, Trash2, Pencil, Wallet, TrendingUp, TrendingDown, Minus, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const OWNERS = ['Giovani', 'Adriele'] as const
type Owner = typeof OWNERS[number]

function VariationBadge({ prev, curr }: { prev: number; curr: number }) {
  if (prev === 0) return <span className="text-xs text-gray-400">—</span>
  const pct = ((curr - prev) / prev) * 100
  if (pct > 1) return (
    <span className="flex items-center gap-0.5 text-xs font-semibold text-green-600">
      <TrendingUp size={12} /> {formatPercent(pct)}
    </span>
  )
  if (pct < -1) return (
    <span className="flex items-center gap-0.5 text-xs font-semibold text-red-600">
      <TrendingDown size={12} /> {formatPercent(pct)}
    </span>
  )
  return (
    <span className="flex items-center gap-0.5 text-xs text-gray-500">
      <Minus size={12} /> Estável
    </span>
  )
}

function ValueCell({
  item, year, value, onSaved,
}: {
  item: PatrimonyItem; year: number; value: number; onSaved: () => void
}) {
  const { user } = useAuth()
  const upsert = useUpsertPatrimonyValue()
  const [open, setOpen] = useState(false)
  const [local, setLocal] = useState(String(value || ''))
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => { setLocal(value > 0 ? String(value) : '') }, [value])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        handleSave(); setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open, local])

  async function handleSave() {
    const v = parseFloat(local) || 0
    if (v === value) return
    try {
      await upsert.mutateAsync({ user_id: user!.id, item_id: item.id, year, value: v })
      onSaved()
    } catch {
      toast({ title: 'Erro ao salvar', variant: 'destructive' })
    }
  }

  return (
    <div ref={ref} className="relative">
      <div
        onClick={() => setOpen(true)}
        className={cn('cursor-pointer px-2 py-1.5 rounded text-right text-sm hover:bg-blue-50 transition-colors min-w-[110px]', open && 'ring-2 ring-blue-400 bg-blue-50')}
      >
        {value > 0
          ? <span className="font-medium text-gray-800">{formatCurrency(value)}</span>
          : <span className="text-gray-300">—</span>}
      </div>
      {open && (
        <div className="absolute z-30 bg-white border border-gray-200 rounded-lg shadow-xl p-3 w-48 top-full right-0 mt-1">
          <p className="text-xs font-semibold text-gray-600 mb-2">{year}</p>
          <input
            autoFocus
            type="number"
            step="0.01"
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { handleSave(); setOpen(false) }
              if (e.key === 'Escape') setOpen(false)
            }}
            placeholder="0,00"
          />
          <button
            onClick={() => { handleSave(); setOpen(false) }}
            className="w-full mt-2 bg-blue-600 text-white text-xs py-1.5 rounded hover:bg-blue-700"
          >
            Salvar
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Patrimony Section ────────────────────────────────────────────────────────

interface PatrimonySectionProps {
  owner: Owner
  items: PatrimonyItem[]
  values: PatrimonyValue[]
  years: number[]
  receitasGeradas: number
  onAddItem: () => void
  onEditItem: (item: PatrimonyItem) => void
  onDeleteItem: (id: string) => void
}

function PatrimonySection({ owner, items, values, years, receitasGeradas, onAddItem, onEditItem, onDeleteItem }: PatrimonySectionProps) {
  const [, forceUpdate] = useState(0)
  const ownerItems = items.filter((i) => (i.owner ?? 'Giovani') === owner)

  // Value map for this owner's items only
  const valueMap: Record<string, Record<number, number>> = {}
  values.forEach((v) => {
    if (!valueMap[v.item_id]) valueMap[v.item_id] = {}
    valueMap[v.item_id][v.year] = Number(v.value)
  })

  const prevYear = years[0]
  const currYear = years[years.length - 1]

  const totals = years.map((y) =>
    ownerItems.reduce((s, item) => s + (valueMap[item.id]?.[y] ?? 0), 0)
  )
  const prevTotal = totals[0] ?? 0
  const currTotal = totals[totals.length - 1] ?? 0
  const variation = currTotal - prevTotal

  // Chart data: all years that have any data for this owner
  const allYearsWithData = [...new Set(
    values.filter((v) => ownerItems.some((i) => i.id === v.item_id)).map((v) => v.year)
  )].sort()
  const chartData = allYearsWithData.map((y) => ({
    year: String(y),
    total: ownerItems.reduce((s, item) => s + (valueMap[item.id]?.[y] ?? 0), 0),
  }))

  // Group by category
  const byCategory: Record<string, PatrimonyItem[]> = {}
  ownerItems.forEach((item) => {
    if (!byCategory[item.category]) byCategory[item.category] = []
    byCategory[item.category].push(item)
  })

  const gradId = `patGrad-${owner}`

  return (
    <div className="space-y-5">
      {/* KPIs */}
      {(() => {
        const saldoReceitas = variation - receitasGeradas
        // Vermelho: Receitas < Variação (saldo positivo → patrimônio cresceu mais do que gerou receita)
        // Azul:     Receitas > Variação (saldo negativo → receitas superaram a variação patrimonial)
        const saldoTrend = receitasGeradas > variation ? 'blue' : receitasGeradas < variation ? 'down' : 'neutral'
        const saldoIcon  = receitasGeradas > variation
          ? <TrendingUp size={18} />
          : receitasGeradas < variation
            ? <TrendingDown size={18} />
            : <Minus size={18} />
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            <KPICard title={`Total ${prevYear}`} value={formatCurrency(prevTotal)} icon={<Wallet size={18} />} />
            <KPICard
              title={`Total ${currYear}`} value={formatCurrency(currTotal)}
              icon={<Wallet size={18} />}
              trend={currTotal > prevTotal ? 'up' : currTotal < prevTotal ? 'down' : 'neutral'}
            />
            <KPICard
              title="Variação"
              value={formatCurrency(variation)}
              icon={variation >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
              trend={variation >= 0 ? 'up' : 'down'}
              subtitle={prevTotal > 0 ? formatPercent(((currTotal - prevTotal) / prevTotal) * 100) + ' de crescimento' : undefined}
            />
            <KPICard
              title={`Receitas Geradas ${currYear}`}
              value={formatCurrency(receitasGeradas)}
              icon={<TrendingUp size={18} />}
              trend="up"
              subtitle="Receitas + Renda Investimentos"
            />
            <KPICard
              title="Saldo — Receitas s/ Variação"
              value={formatCurrency(saldoReceitas)}
              icon={saldoIcon}
              trend={saldoTrend}
              subtitle={
                receitasGeradas > variation
                  ? 'Receitas superam a variação'
                  : receitasGeradas < variation
                    ? 'Variação supera as receitas'
                    : 'Receitas = Variação'
              }
            />
          </div>
        )
      })()}

      {/* Chart */}
      {chartData.length > 1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Evolução Patrimonial — {owner}</h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={owner === 'Giovani' ? '#3B82F6' : '#8B5CF6'} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={owner === 'Giovani' ? '#3B82F6' : '#8B5CF6'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              <Area
                type="monotone" dataKey="total" name="Patrimônio"
                stroke={owner === 'Giovani' ? '#3B82F6' : '#8B5CF6'}
                fill={`url(#${gradId})`} strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table */}
      {ownerItems.length === 0 ? (
        <EmptyState
          icon={<Wallet size={40} />}
          title="Nenhum bem cadastrado"
          description={`Adicione bens e direitos de ${owner} para acompanhar o crescimento patrimonial`}
          action={<Button onClick={onAddItem}><Plus size={16} /> Adicionar Bem</Button>}
        />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex justify-end px-4 py-3 border-b border-gray-100">
            <Button size="sm" onClick={onAddItem}><Plus size={14} /> Adicionar Bem</Button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Bem / Direito</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[120px]">{prevYear}</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[120px]">{currYear}</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Variação</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Ações</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(byCategory).map(([category, catItems]) => {
                const catPrev = catItems.reduce((s, i) => s + (valueMap[i.id]?.[prevYear] ?? 0), 0)
                const catCurr = catItems.reduce((s, i) => s + (valueMap[i.id]?.[currYear] ?? 0), 0)
                return (
                  <>
                    <tr key={`cat-${category}`} className="bg-blue-50 border-b border-gray-200">
                      <td colSpan={5} className="px-4 py-2 text-xs font-bold text-blue-800 uppercase tracking-wide">{category}</td>
                    </tr>
                    {catItems.map((item) => {
                      const prev = valueMap[item.id]?.[prevYear] ?? 0
                      const curr = valueMap[item.id]?.[currYear] ?? 0
                      return (
                        <tr key={item.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                          <td className="px-4 py-2.5 text-gray-700 pl-8">{item.name}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex justify-end">
                              <ValueCell item={item} year={prevYear} value={prev} onSaved={() => forceUpdate((n) => n + 1)} />
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex justify-end">
                              <ValueCell item={item} year={currYear} value={curr} onSaved={() => forceUpdate((n) => n + 1)} />
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <VariationBadge prev={prev} curr={curr} />
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => onEditItem(item)}
                                className="p-1.5 rounded text-blue-400 hover:bg-blue-50 transition-colors"
                                title="Editar"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={() => onDeleteItem(item.id)}
                                className="p-1.5 rounded text-red-400 hover:bg-red-50 transition-colors"
                                title="Excluir"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                    <tr key={`cat-total-${category}`} className="bg-gray-50 border-b border-gray-200">
                      <td className="px-4 py-2 text-xs font-semibold text-gray-600 pl-8">Subtotal</td>
                      <td className="px-4 py-2 text-right text-xs font-bold text-gray-700">{formatCurrency(catPrev)}</td>
                      <td className="px-4 py-2 text-right text-xs font-bold text-gray-700">{formatCurrency(catCurr)}</td>
                      <td className="px-4 py-2 text-center"><VariationBadge prev={catPrev} curr={catCurr} /></td>
                      <td />
                    </tr>
                  </>
                )
              })}
              <tr className="bg-blue-100 font-bold">
                <td className="px-4 py-3 text-blue-900">TOTAL — {owner.toUpperCase()}</td>
                <td className="px-4 py-3 text-right text-blue-900">{formatCurrency(prevTotal)}</td>
                <td className="px-4 py-3 text-right text-blue-900">{formatCurrency(currTotal)}</td>
                <td className="px-4 py-3 text-center"><VariationBadge prev={prevTotal} curr={currTotal} /></td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Contributions Section ────────────────────────────────────────────────────

const BLANK_CONTRIBUTION = (): Omit<PatrimonyContribution, 'id' | 'user_id' | 'created_at'> => ({
  date: new Date().toISOString().slice(0, 10),
  description: '',
  category: CONTRIBUTION_CATEGORIES[0],
  type: 'APORTE',
  amount: 0,
  account: 'Giovani',
})

function ContributionsSection() {
  const { user } = useAuth()
  const { data: contributions = [], isLoading } = usePatrimonyContributions()
  const { data: items = [] } = usePatrimonyItems()
  const { data: values = [] } = usePatrimonyValues()
  const upsertValue = useUpsertPatrimonyValue()
  const createC = useCreatePatrimonyContribution()
  const updateC = useUpdatePatrimonyContribution()
  const deleteC = useDeletePatrimonyContribution()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [originalContrib, setOriginalContrib] = useState<PatrimonyContribution | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState(BLANK_CONTRIBUTION())

  // Build enriched items with owner from localStorage
  const enrichedItems = useMemo(() => {
    if (!user) return items
    const ownerMap = getOwnerMap(user.id)
    return items.map((i) => ({ ...i, owner: i.owner ?? ownerMap[i.id] ?? 'Giovani' }))
  }, [items, user])

  // Build value map: item_id → year → value
  const valueMap = useMemo(() => {
    const m: Record<string, Record<number, number>> = {}
    values.forEach((v) => {
      if (!m[v.item_id]) m[v.item_id] = {}
      m[v.item_id][v.year] = Number(v.value)
    })
    return m
  }, [values])

  /**
   * Apply or reverse a contribution's effect on the matching patrimony item.
   * direction =  1 → apply  (Aporte: +amount  |  Resgate: -amount)
   * direction = -1 → reverse (Aporte: -amount  |  Resgate: +amount)
   */
  async function applyEffect(
    contrib: { category: string; account: string; date: string; type: 'APORTE' | 'RESGATE'; amount: number },
    direction: 1 | -1
  ) {
    const matchItem = enrichedItems.find(
      (i) => i.name === contrib.category && i.owner === contrib.account
    )
    if (!matchItem) return   // no matching bem — skip silently

    const year = parseInt(contrib.date.slice(0, 4), 10)
    const current = valueMap[matchItem.id]?.[year] ?? 0
    const delta = (contrib.type === 'APORTE' ? Number(contrib.amount) : -Number(contrib.amount)) * direction
    const newValue = Math.max(0, current + delta)

    await upsertValue.mutateAsync({ user_id: user!.id, item_id: matchItem.id, year, value: newValue })
  }

  function openCreate() {
    setEditId(null)
    setOriginalContrib(null)
    setForm(BLANK_CONTRIBUTION())
    setDialogOpen(true)
  }

  function openEdit(c: PatrimonyContribution) {
    setEditId(c.id)
    setOriginalContrib(c)
    setForm({ date: c.date, description: c.description, category: c.category ?? CONTRIBUTION_CATEGORIES[0], type: c.type, amount: c.amount, account: c.account })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.description || !form.amount) return
    try {
      if (editId && originalContrib) {
        // 1. Reverse the old contribution's effect on patrimony
        await applyEffect(originalContrib, -1)
        // 2. Save updated record
        await updateC.mutateAsync({ id: editId, updates: form })
        // 3. Apply new contribution's effect on patrimony
        await applyEffect(form as PatrimonyContribution, 1)
        toast({ title: 'Registro atualizado e patrimônio recalculado!', variant: 'success' })
      } else {
        // 1. Save new record
        await createC.mutateAsync({ ...form, user_id: user!.id })
        // 2. Apply contribution's effect on patrimony
        await applyEffect(form as PatrimonyContribution, 1)
        toast({ title: 'Registro criado e patrimônio atualizado!', variant: 'success' })
      }
      setDialogOpen(false)
    } catch (e: unknown) {
      toast({ title: 'Erro', description: (e as Error).message, variant: 'destructive' })
    }
  }

  async function handleDelete() {
    if (!deleteId) return
    const contrib = contributions.find((c) => c.id === deleteId)
    try {
      // 1. Reverse effect on patrimony before deleting
      if (contrib) await applyEffect(contrib, -1)
      // 2. Delete record
      await deleteC.mutateAsync(deleteId)
      toast({ title: 'Registro removido e patrimônio ajustado', variant: 'success' })
    } catch {
      toast({ title: 'Erro ao remover', variant: 'destructive' })
    } finally {
      setDeleteId(null)
    }
  }

  const totalAportes  = contributions.filter((c) => c.type === 'APORTE').reduce((s, c) => s + Number(c.amount), 0)
  const totalResgates = contributions.filter((c) => c.type === 'RESGATE').reduce((s, c) => s + Number(c.amount), 0)
  const saldo = totalAportes - totalResgates

  if (isLoading) return <div className="text-center py-10 text-gray-400">Carregando...</div>

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard title="Total Aportes"  value={formatCurrency(totalAportes)}  icon={<ArrowDownCircle size={18} />} trend="up" />
        <KPICard title="Total Resgates" value={formatCurrency(totalResgates)} icon={<ArrowUpCircle size={18} />}  trend="down" />
        <KPICard
          title="Saldo Líquido"
          value={formatCurrency(saldo)}
          icon={saldo >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
          trend={saldo >= 0 ? 'up' : 'down'}
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Histórico de Aportes e Resgates</h2>
          <Button size="sm" onClick={openCreate}><Plus size={14} /> Novo Registro</Button>
        </div>

        {contributions.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">
            Nenhum registro encontrado. Clique em "Novo Registro" para adicionar.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Data</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Categoria</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Descrição</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipo</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Valor</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Conta</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Ações</th>
                </tr>
              </thead>
              <tbody>
                {contributions.map((c) => (
                  <tr key={c.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">
                      {new Date(c.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-2.5 text-gray-700 font-medium whitespace-nowrap">
                      {c.category || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">{c.description}</td>
                    <td className="px-4 py-2.5 text-center">
                      <Badge
                        className={cn(
                          'text-xs font-semibold',
                          c.type === 'APORTE'
                            ? 'bg-green-100 text-green-700 hover:bg-green-100'
                            : 'bg-red-100 text-red-700 hover:bg-red-100'
                        )}
                        variant="secondary"
                      >
                        {c.type === 'APORTE' ? '↓ Aporte' : '↑ Resgate'}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-gray-800">
                      {formatCurrency(Number(c.amount))}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={cn(
                        'text-xs font-medium px-2 py-0.5 rounded-full',
                        c.account === 'Giovani' ? 'bg-blue-50 text-blue-700' : 'bg-violet-50 text-violet-700'
                      )}>
                        {c.account}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openEdit(c)} className="p-1.5 rounded text-blue-400 hover:bg-blue-50 transition-colors" title="Editar">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => setDeleteId(c.id)} className="p-1.5 rounded text-red-400 hover:bg-red-50 transition-colors" title="Excluir">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t border-gray-200">
                  <td colSpan={4} className="px-4 py-2 text-xs font-semibold text-gray-500">Saldo Líquido (Aportes − Resgates)</td>
                  <td className={cn('px-4 py-2 text-right text-xs font-bold', saldo >= 0 ? 'text-green-700' : 'text-red-700')}>
                    {formatCurrency(saldo)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Dialog add/edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? 'Editar Registro' : 'Novo Aporte / Resgate'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Data</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Conta</Label>
                <Select value={form.account} onValueChange={(v) => setForm((p) => ({ ...p, account: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Giovani">Giovani</SelectItem>
                    <SelectItem value="Adriele">Adriele</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={form.category} onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione a categoria..." /></SelectTrigger>
                <SelectContent>
                  {CONTRIBUTION_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-400">
                A categoria deve coincidir com o "Nome do Bem" no patrimônio para atualização automática.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Input
                placeholder="Ex: Aporte mensal programado..."
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={(v) => setForm((p) => ({ ...p, type: v as 'APORTE' | 'RESGATE' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="APORTE">Aporte</SelectItem>
                    <SelectItem value="RESGATE">Resgate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={form.amount || ''}
                  onChange={(e) => setForm((p) => ({ ...p, amount: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={!form.description || !form.amount || createC.isPending || updateC.isPending}
            >
              {createC.isPending || updateC.isPending ? 'Salvando...' : editId ? 'Salvar Alterações' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(v) => { if (!v) setDeleteId(null) }}
        title="Remover registro?"
        description="O aporte/resgate será excluído e o saldo do bem patrimonial correspondente será revertido."
        confirmLabel="Remover"
        variant="destructive"
        onConfirm={handleDelete}
        loading={deleteC.isPending}
      />
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type TabKey = 'giovani' | 'adriele' | 'aportes'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'giovani',  label: 'Patrimônio Giovani' },
  { key: 'adriele',  label: 'Patrimônio Adriele' },
  { key: 'aportes',  label: 'Aportes e Resgates' },
]

// Categories whose 'realizado' entries count as Giovani's revenue
const GIOVANI_ENTRY_CATEGORIES = new Set([
  'Dividendos Empresa', 'Honorários (PF)', 'Pró Labore',
  'Venda Ações BR-Trib', 'Venda Ações Isento', 'Venda de FIIs',
  'Venda Criptos', 'Venda Ativos EUA', 'ETFs-Renda Fixa',
  'Exterior-Dividendos', 'Dividendos-Ações BR', 'JCP',
  'Rendimentos de FIIs',
])

export function PatrimonyPage() {
  const { user } = useAuth()
  const currentYear = getCurrentYear()

  const [activeTab, setActiveTab]   = useState<TabKey>('giovani')
  const [years, setYears]           = useState([currentYear - 1, currentYear])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editItem, setEditItem]     = useState<PatrimonyItem | null>(null)
  const [deleteId, setDeleteId]     = useState<string | null>(null)
  const [form, setForm]             = useState({ name: '', category: 'Renda Variável', owner: 'Giovani' })
  const [ownerTick, setOwnerTick]   = useState(0) // forces re-read of localStorage

  const { data: items = [],  isLoading: loadingItems  } = usePatrimonyItems()
  const { data: values = [], isLoading: loadingValues } = usePatrimonyValues()
  const createItem = useCreatePatrimonyItem()
  const updateItem = useUpdatePatrimonyItem()
  const deleteItem = useDeletePatrimonyItem()

  // Enrich items with owner: DB value takes priority, then localStorage, then 'Giovani'
  const enrichedItems = useMemo(() => {
    if (!user) return items
    const map = getOwnerMap(user.id)
    return items.map((item) => ({
      ...item,
      owner: item.owner ?? map[item.id] ?? 'Giovani',
    }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, user, ownerTick])

  // ── Receitas Geradas ─────────────────────────────────────────────────────────
  // currYear is always years[1]; hooks must be called unconditionally
  const currYearForRecipes = years[years.length - 1]
  const { data: categories = [] } = useCategories()
  const { data: entries = [] }    = useEntries(currYearForRecipes)
  const { data: investments = [] } = useInvestmentRecords(currYearForRecipes)

  const receitasGiovani = useMemo(() => {
    // Part 1: monthly_entries realizado where category name ∈ GIOVANI_ENTRY_CATEGORIES
    const giovaniCatIds = new Set(
      categories.filter((c) => GIOVANI_ENTRY_CATEGORIES.has(c.name)).map((c) => c.id)
    )
    const entriesSum = entries
      .filter((e) => giovaniCatIds.has(e.category_id))
      .reduce((s, e) => s + Number(e.realizado), 0)

    // Part 2: investment_records where class ∈ CRI_CRA_DEB | RFIXA_BR AND account = Giovani
    const investSum = investments
      .filter((r) => (r.asset_class === 'CRI_CRA_DEB' || r.asset_class === 'RFIXA_BR') && r.bank_account === 'Giovani')
      .reduce((s, r) => s + Number(r.amount), 0)

    return entriesSum + investSum
  }, [categories, entries, investments])

  const receitasAdriele = useMemo(() => {
    // Part 1: monthly_entries realizado where category name = 'Adriele'
    const adrieleCat = categories.find((c) => c.name === 'Adriele')
    const entriesSum = adrieleCat
      ? entries.filter((e) => e.category_id === adrieleCat.id).reduce((s, e) => s + Number(e.realizado), 0)
      : 0

    // Part 2: investment_records where class ∈ CRI_CRA_DEB | RFIXA_BR AND account = Adriele
    const investSum = investments
      .filter((r) => (r.asset_class === 'CRI_CRA_DEB' || r.asset_class === 'RFIXA_BR') && r.bank_account === 'Adriele')
      .reduce((s, r) => s + Number(r.amount), 0)

    return entriesSum + investSum
  }, [categories, entries, investments])

  function openAddItem(owner: Owner) {
    setEditItem(null)
    setForm({ name: '', category: 'Renda Variável', owner })
    setDialogOpen(true)
  }

  function openEditItem(item: PatrimonyItem) {
    setEditItem(item)
    setForm({ name: item.name, category: item.category, owner: item.owner ?? 'Giovani' })
    setDialogOpen(true)
  }

  async function handleSaveItem() {
    if (!form.name) return
    try {
      if (editItem) {
        await updateItem.mutateAsync({ id: editItem.id, updates: { name: form.name, category: form.category, owner: form.owner } })
        // Always persist owner locally as fallback (in case DB column is missing)
        saveOwner(user!.id, editItem.id, form.owner)
        setOwnerTick((n) => n + 1)
        toast({ title: 'Bem atualizado!', variant: 'success' })
      } else {
        const newItem = await createItem.mutateAsync({ user_id: user!.id, name: form.name, category: form.category, owner: form.owner })
        // Persist owner locally as fallback
        saveOwner(user!.id, newItem.id, form.owner)
        setOwnerTick((n) => n + 1)
        toast({ title: 'Bem cadastrado!', variant: 'success' })
      }
      setDialogOpen(false)
    } catch (e: unknown) {
      toast({ title: 'Erro', description: (e as Error).message, variant: 'destructive' })
    }
  }

  async function handleDeleteItem() {
    if (!deleteId) return
    try {
      await deleteItem.mutateAsync(deleteId)
      toast({ title: 'Bem removido', variant: 'success' })
    } catch {
      toast({ title: 'Erro ao remover', variant: 'destructive' })
    } finally {
      setDeleteId(null)
    }
  }

  if (loadingItems || loadingValues) return <LoadingPage />

  const prevYear = years[0]
  const currYear = years[years.length - 1]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Crescimento Patrimonial</h1>
        <div className="flex items-center gap-2 text-sm">
          <Label className="text-gray-500">Comparar anos:</Label>
          <Select value={String(prevYear)} onValueChange={(v) => setYears([Number(v), currYear])}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 10 }, (_, i) => currentYear - 9 + i).map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-gray-400">→</span>
          <Select value={String(currYear)} onValueChange={(v) => setYears([prevYear, Number(v)])}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 10 }, (_, i) => currentYear - 9 + i).map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={cn(
              'px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeTab === t.key
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'giovani' && (
        <PatrimonySection
          owner="Giovani"
          items={enrichedItems}
          values={values}
          years={years}
          receitasGeradas={receitasGiovani}
          onAddItem={() => openAddItem('Giovani')}
          onEditItem={openEditItem}
          onDeleteItem={(id) => setDeleteId(id)}
        />
      )}
      {activeTab === 'adriele' && (
        <PatrimonySection
          owner="Adriele"
          items={enrichedItems}
          values={values}
          years={years}
          receitasGeradas={receitasAdriele}
          onAddItem={() => openAddItem('Adriele')}
          onEditItem={openEditItem}
          onDeleteItem={(id) => setDeleteId(id)}
        />
      )}
      {activeTab === 'aportes' && <ContributionsSection />}

      {/* Add / Edit Item dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editItem ? 'Editar Bem / Direito' : 'Adicionar Bem / Direito'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome do Bem</Label>
              <Input
                placeholder="Ex: Apartamento, MXRF11, CDB..."
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={form.category} onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PATRIMONY_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Proprietário</Label>
              <Select value={form.owner} onValueChange={(v) => setForm((p) => ({ ...p, owner: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Giovani">Giovani</SelectItem>
                  <SelectItem value="Adriele">Adriele</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSaveItem}
              disabled={!form.name || createItem.isPending || updateItem.isPending}
            >
              {createItem.isPending || updateItem.isPending ? 'Salvando...' : editItem ? 'Salvar Alterações' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete item confirm */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(v) => { if (!v) setDeleteId(null) }}
        title="Remover bem?"
        description="O item e todos os valores associados serão removidos permanentemente."
        confirmLabel="Remover"
        variant="destructive"
        onConfirm={handleDeleteItem}
        loading={deleteItem.isPending}
      />
    </div>
  )
}
