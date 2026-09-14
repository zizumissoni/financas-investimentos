import { useMemo, useState } from 'react'
import { useYear } from '@/contexts/YearContext'
import { useCategoriesByGroup } from '@/hooks/useCategories'
import { useBankAccounts } from '@/hooks/useBankAccounts'
import { useTransactions, useDeleteTransaction } from '@/hooks/useTransactions'
import { useTransfers, useDeleteTransfer } from '@/hooks/useTransfers'
import { formatCurrency, cn } from '@/lib/utils'
import { toast } from '@/hooks/useToast'
import { KPICard } from '@/components/shared/KPICard'
import { LoadingPage } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { TransactionDialog } from '@/components/entries/TransactionDialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Receipt, TrendingUp, TrendingDown, Scale, CheckCircle2, Clock, EyeOff,
  ArrowLeftRight, Pencil, Trash2,
} from 'lucide-react'
import type { Transaction, AccountTransfer } from '@/types/finance.types'

const MONTHS_FULL = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]
const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

type LedgerRow = {
  id: string
  date: string
  createdAt: string
  description: string
  categoryName: string | null
  accountName: string
  amount: number
  kind: 'RECEITA' | 'DESPESA' | 'TRANSFERENCIA'
  isSettled: boolean
  isIgnored: boolean
  categoryId: string | null
  bankAccountId: string | null
  transaction?: Transaction
  transfer?: AccountTransfer
}

export function TransactionsTab() {
  const { year } = useYear()
  const { categories } = useCategoriesByGroup()
  const { data: bankAccounts = [] } = useBankAccounts()
  const { data: transactions = [], isLoading: loadingTx } = useTransactions(year)
  const { data: transfers = [], isLoading: loadingTr } = useTransfers()
  const deleteTransaction = useDeleteTransaction()
  const deleteTransfer = useDeleteTransfer()

  const [timeMode, setTimeMode] = useState<'anual' | 'mensal' | 'custom'>('mensal')
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1)
  const [customFrom, setCustomFrom] = useState(1)
  const [customTo, setCustomTo] = useState(12)
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [accountFilter, setAccountFilter] = useState('ALL')

  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [deleteRow, setDeleteRow] = useState<LedgerRow | null>(null)

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories])
  const accountMap = useMemo(() => new Map(bankAccounts.map((a) => [a.id, a.name])), [bankAccounts])

  const rows = useMemo<LedgerRow[]>(() => {
    const txRows: LedgerRow[] = transactions
      .filter((t) => new Date(`${t.date}T00:00:00`).getFullYear() === year)
      .map((t) => ({
        id: t.id,
        date: t.date,
        createdAt: t.created_at,
        description: t.description || (t.type === 'RECEITA' ? 'Receita' : 'Despesa'),
        categoryName: categoryMap.get(t.category_id) ?? '—',
        accountName: accountMap.get(t.bank_account_id) ?? '—',
        amount: t.type === 'RECEITA' ? Number(t.amount) : -Number(t.amount),
        kind: t.type,
        isSettled: t.is_settled,
        isIgnored: t.is_ignored,
        categoryId: t.category_id,
        bankAccountId: t.bank_account_id,
        transaction: t,
      }))

    const trRows: LedgerRow[] = transfers
      .filter((tr) => new Date(`${tr.date}T00:00:00`).getFullYear() === year)
      .map((tr) => ({
        id: tr.id,
        date: tr.date,
        createdAt: tr.created_at,
        description: tr.description || 'Transferência',
        categoryName: null,
        accountName: `${accountMap.get(tr.from_account_id) ?? '—'} → ${accountMap.get(tr.to_account_id) ?? '—'}`,
        amount: Number(tr.amount),
        kind: 'TRANSFERENCIA' as const,
        isSettled: true,
        isIgnored: false,
        categoryId: null,
        bankAccountId: null,
        transfer: tr,
      }))

    return [...txRows, ...trRows].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  }, [transactions, transfers, year, categoryMap, accountMap])

  const filteredRows = useMemo(() => rows.filter((r) => {
    const month = Number(r.date.slice(5, 7))
    const timeOk =
      timeMode === 'anual' ? true :
      timeMode === 'mensal' ? month === filterMonth :
      month >= customFrom && month <= customTo
    const catOk = categoryFilter === 'ALL' || r.categoryId === categoryFilter
    const accOk = accountFilter === 'ALL' || r.bankAccountId === accountFilter ||
      (r.transfer && (r.transfer.from_account_id === accountFilter || r.transfer.to_account_id === accountFilter))
    return timeOk && catOk && accOk
  }), [rows, timeMode, filterMonth, customFrom, customTo, categoryFilter, accountFilter])

  const totalReceitas = filteredRows.filter((r) => r.kind === 'RECEITA' && !r.isIgnored).reduce((s, r) => s + r.amount, 0)
  const totalDespesas = filteredRows.filter((r) => r.kind === 'DESPESA' && !r.isIgnored).reduce((s, r) => s + Math.abs(r.amount), 0)
  const saldoPeriodo = totalReceitas - totalDespesas

  async function handleDelete() {
    if (!deleteRow) return
    try {
      if (deleteRow.transaction) await deleteTransaction.mutateAsync(deleteRow.transaction.id)
      else if (deleteRow.transfer) await deleteTransfer.mutateAsync(deleteRow.transfer.id)
      toast({ title: 'Lançamento excluído — saldos e categorias atualizados', variant: 'success' })
    } catch (e: unknown) {
      toast({ title: 'Erro ao excluir', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setDeleteRow(null)
    }
  }

  if (loadingTx || loadingTr) return <LoadingPage />

  return (
    <div className="space-y-5 mt-2">
      {/* ── KPIs do período filtrado ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KPICard title="Receitas" value={formatCurrency(totalReceitas)} icon={<TrendingUp size={18} />} trend="up" subtitle={`${filteredRows.filter(r => r.kind === 'RECEITA').length} lançamento(s)`} />
        <KPICard title="Despesas" value={formatCurrency(totalDespesas)} icon={<TrendingDown size={18} />} trend="down" subtitle={`${filteredRows.filter(r => r.kind === 'DESPESA').length} lançamento(s)`} />
        <KPICard title="Saldo do Período" value={formatCurrency(saldoPeriodo)} icon={<Scale size={18} />} trend={saldoPeriodo >= 0 ? 'up' : 'down'} valueClassName={saldoPeriodo >= 0 ? 'text-green-600' : 'text-red-600'} />
      </div>

      {/* ── Filtro temporal ── */}
      <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold text-gray-500">PERÍODO:</span>
        {(['anual', 'mensal', 'custom'] as const).map((m) => (
          <button key={m} onClick={() => setTimeMode(m)}
            className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
              timeMode === m ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
            {m === 'anual' ? 'Anual' : m === 'mensal' ? 'Mensal' : 'Customizado'}
          </button>
        ))}
        {timeMode === 'mensal' && (
          <select value={filterMonth} onChange={(e) => setFilterMonth(Number(e.target.value))}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300">
            {MONTHS_FULL.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
        )}
        {timeMode === 'custom' && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">De:</span>
            <select value={customFrom} onChange={(e) => setCustomFrom(Number(e.target.value))}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300">
              {MONTHS_SHORT.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
            <span className="text-xs text-gray-500">até:</span>
            <select value={customTo} onChange={(e) => setCustomTo(Number(e.target.value))}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300">
              {MONTHS_SHORT.map((m, i) => <option key={i + 1} value={i + 1} disabled={i + 1 < customFrom}>{m}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* ── Filtros de categoria e conta ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-gray-500">CATEGORIA:</span>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-48 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas</SelectItem>
              {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-gray-500">CONTA:</span>
          <Select value={accountFilter} onValueChange={setAccountFilter}>
            <SelectTrigger className="w-48 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas</SelectItem>
              {bankAccounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Tabela ── */}
      {filteredRows.length === 0 ? (
        <EmptyState
          icon={<Receipt size={40} />}
          title="Nenhum lançamento encontrado"
          description="Ajuste os filtros ou adicione uma nova receita, despesa ou transferência"
        />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Situação</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Data</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Descrição</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Categoria</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Conta</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Valor</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => (
                <tr key={`${r.kind}-${r.id}`} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                  <td className="px-3 py-2.5 text-center">
                    {r.isIgnored
                      ? <EyeOff size={15} className="text-gray-300 inline" />
                      : r.isSettled
                        ? <CheckCircle2 size={15} className="text-green-500 inline" />
                        : <Clock size={15} className="text-amber-400 inline" />}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{r.date.split('-').reverse().join('/')}</td>
                  <td className="px-4 py-2.5 text-gray-800">{r.description}</td>
                  <td className="px-4 py-2.5">
                    {r.kind === 'TRANSFERENCIA'
                      ? <span className="inline-flex items-center gap-1 text-xs bg-violet-50 text-violet-600 px-2 py-0.5 rounded-full font-medium"><ArrowLeftRight size={11} /> Transferência</span>
                      : <span className="text-gray-600">{r.categoryName}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{r.accountName}</td>
                  <td className={cn('px-4 py-2.5 text-right font-semibold',
                    r.kind === 'RECEITA' ? 'text-green-600' : r.kind === 'DESPESA' ? 'text-red-600' : 'text-violet-600')}>
                    {r.kind === 'TRANSFERENCIA' ? formatCurrency(r.amount) : formatCurrency(r.amount)}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-center gap-1">
                      {r.transaction && (
                        <button onClick={() => setEditingTx(r.transaction!)}
                          className="p-1.5 rounded text-blue-400 hover:bg-blue-50 transition-colors" title="Editar">
                          <Pencil size={14} />
                        </button>
                      )}
                      <button onClick={() => setDeleteRow(r)}
                        className="p-1.5 rounded text-red-400 hover:bg-red-50 transition-colors" title="Excluir">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editingTx && (
        <TransactionDialog
          type={editingTx.type}
          open={!!editingTx}
          onOpenChange={(v) => { if (!v) setEditingTx(null) }}
          editing={editingTx}
        />
      )}

      <ConfirmDialog
        open={!!deleteRow}
        onOpenChange={(v) => { if (!v) setDeleteRow(null) }}
        title="Excluir lançamento?"
        description="O saldo da conta e o total da categoria em Receitas/Despesas serão recalculados automaticamente."
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={handleDelete}
        loading={deleteTransaction.isPending || deleteTransfer.isPending}
      />
    </div>
  )
}
