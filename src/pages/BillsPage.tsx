import { useState } from 'react'
import { useYear } from '@/contexts/YearContext'
import { useBills, useCreateBill, useUpdateBill, useMarkBillPaid, useDeleteBill } from '@/hooks/useBills'
import { useAuth } from '@/hooks/useAuth'
import { formatCurrency, derivebillStatus, daysUntilDue, getCurrentMonth, formatMonthFull } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { LoadingPage } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { toast } from '@/hooks/useToast'
import { BILL_CATEGORIES, RECURRENCE_LABELS } from '@/lib/constants'
import type { Bill, RecurrenceType } from '@/types/finance.types'
import { Plus, Check, Pencil, Trash2, CreditCard, ChevronLeft, ChevronRight } from 'lucide-react'

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

function StatusBadge({ bill }: { bill: Bill }) {
  const status = derivebillStatus(bill.due_date, bill.paid_at)
  const days = daysUntilDue(bill.due_date)

  if (status === 'PAGO') return <Badge variant="success">Pago</Badge>
  if (status === 'ATRASADO') return <Badge variant="destructive">Atrasado {Math.abs(days)}d</Badge>
  if (days === 0) return <Badge variant="warning">Vence hoje</Badge>
  if (days <= 3) return <Badge variant="warning">Vence em {days}d</Badge>
  return <Badge variant="secondary">Pendente</Badge>
}

interface BillFormData {
  description: string
  amount: string
  due_date: string
  category: string
  is_recurrent: boolean
  recurrence: RecurrenceType
  notes: string
}

const defaultForm: BillFormData = {
  description: '',
  amount: '',
  due_date: '',
  category: 'Outros',
  is_recurrent: false,
  recurrence: 'NENHUMA',
  notes: '',
}

function BillFormDialog({
  open, onOpenChange, editing, onSubmit, loading
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing?: Bill
  onSubmit: (data: BillFormData) => void
  loading: boolean
}) {
  const [form, setForm] = useState<BillFormData>(
    editing
      ? {
          description: editing.description,
          amount: String(editing.amount),
          due_date: editing.due_date,
          category: editing.category,
          is_recurrent: editing.is_recurrent,
          recurrence: editing.recurrence,
          notes: editing.notes ?? '',
        }
      : defaultForm
  )

  function set(key: keyof BillFormData, value: string | boolean) {
    setForm((p) => ({ ...p, [key]: value }))
    if (key === 'is_recurrent' && !value) setForm((p) => ({ ...p, recurrence: 'NENHUMA', is_recurrent: value as boolean }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar Conta' : 'Nova Conta a Pagar'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Input placeholder="Ex: Aluguel, Netflix..." value={form.description} onChange={(e) => set('description', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" min="0" placeholder="0,00" value={form.amount} onChange={(e) => set('amount', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Vencimento</Label>
              <Input type="date" value={form.due_date} onChange={(e) => set('due_date', e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select value={form.category} onValueChange={(v) => set('category', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BILL_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <Label>Recorrente?</Label>
            <Switch checked={form.is_recurrent} onCheckedChange={(v) => set('is_recurrent', v)} />
          </div>
          {form.is_recurrent && (
            <div className="space-y-1.5">
              <Label>Frequência</Label>
              <Select value={form.recurrence} onValueChange={(v) => set('recurrence', v as RecurrenceType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(RECURRENCE_LABELS)
                    .filter(([k]) => k !== 'NENHUMA')
                    .map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Input placeholder="Opcional..." value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => onSubmit(form)} disabled={loading || !form.description || !form.amount || !form.due_date}>
            {loading ? 'Salvando...' : editing ? 'Salvar' : 'Criar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function BillsPage() {
  const { year } = useYear()
  const { user } = useAuth()
  const [month, setMonth] = useState(getCurrentMonth())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingBill, setEditingBill] = useState<Bill | undefined>()
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data: bills = [], isLoading } = useBills(year, month)
  const createBill = useCreateBill()
  const updateBill = useUpdateBill()
  const markPaid = useMarkBillPaid()
  const deleteBill = useDeleteBill()

  // Sort: ATRASADO first, then PENDENTE by date, then PAGO
  const sortedBills = [...bills].sort((a, b) => {
    const statusOrder = { ATRASADO: 0, PENDENTE: 1, PAGO: 2 }
    const sa = derivebillStatus(a.due_date, a.paid_at)
    const sb = derivebillStatus(b.due_date, b.paid_at)
    if (sa !== sb) return statusOrder[sa] - statusOrder[sb]
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
  })

  const counts = {
    atrasadas: sortedBills.filter((b) => derivebillStatus(b.due_date, b.paid_at) === 'ATRASADO').length,
    pendentes: sortedBills.filter((b) => derivebillStatus(b.due_date, b.paid_at) === 'PENDENTE').length,
    pagas: sortedBills.filter((b) => derivebillStatus(b.due_date, b.paid_at) === 'PAGO').length,
  }

  async function handleSubmit(data: BillFormData) {
    try {
      if (editingBill) {
        await updateBill.mutateAsync({
          id: editingBill.id,
          updates: {
            description: data.description,
            amount: parseFloat(data.amount),
            due_date: data.due_date,
            category: data.category,
            is_recurrent: data.is_recurrent,
            recurrence: data.recurrence,
            notes: data.notes,
          },
        })
        toast({ title: 'Conta atualizada', variant: 'success' })
      } else {
        await createBill.mutateAsync({
          user_id: user!.id,
          description: data.description,
          amount: parseFloat(data.amount),
          due_date: data.due_date,
          category: data.category,
          is_recurrent: data.is_recurrent,
          recurrence: data.recurrence,
          notes: data.notes,
          paid_at: null,
          parent_bill_id: null,
        })
        toast({ title: 'Conta criada', variant: 'success' })
      }
      setDialogOpen(false)
      setEditingBill(undefined)
    } catch (e: unknown) {
      toast({ title: 'Erro', description: (e as Error).message, variant: 'destructive' })
    }
  }

  async function handleMarkPaid(bill: Bill) {
    try {
      await markPaid.mutateAsync(bill)
      toast({ title: 'Marcada como paga!', variant: 'success' })
    } catch {
      toast({ title: 'Erro ao marcar como paga', variant: 'destructive' })
    }
  }

  async function handleDelete() {
    if (!deleteId) return
    try {
      await deleteBill.mutateAsync(deleteId)
      toast({ title: 'Conta removida', variant: 'success' })
    } catch {
      toast({ title: 'Erro ao remover', variant: 'destructive' })
    } finally {
      setDeleteId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Contas a Pagar</h1>
        <Button onClick={() => { setEditingBill(undefined); setDialogOpen(true) }}>
          <Plus size={16} />
          Nova Conta
        </Button>
      </div>

      {/* Month selector */}
      <div className="flex items-center gap-2">
        <button onClick={() => setMonth((m) => m === 1 ? 12 : m - 1)} className="p-1.5 rounded hover:bg-gray-100">
          <ChevronLeft size={16} />
        </button>
        <div className="flex gap-1 overflow-x-auto">
          {MONTHS.map((m, i) => (
            <button
              key={i}
              onClick={() => setMonth(i + 1)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                month === i + 1 ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {m.slice(0, 3)}
            </button>
          ))}
        </div>
        <button onClick={() => setMonth((m) => m === 12 ? 1 : m + 1)} className="p-1.5 rounded hover:bg-gray-100">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Status summary */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-semibold text-gray-700">{formatMonthFull(month)} / {year}</span>
        <div className="flex gap-2">
          <Badge variant="destructive">{counts.atrasadas} Atrasada{counts.atrasadas !== 1 ? 's' : ''}</Badge>
          <Badge variant="warning">{counts.pendentes} Pendente{counts.pendentes !== 1 ? 's' : ''}</Badge>
          <Badge variant="success">{counts.pagas} Paga{counts.pagas !== 1 ? 's' : ''}</Badge>
        </div>
        <span className="text-sm text-gray-500 ml-auto">
          Total pendente: <strong className="text-gray-800">
            {formatCurrency(sortedBills
              .filter((b) => derivebillStatus(b.due_date, b.paid_at) !== 'PAGO')
              .reduce((s, b) => s + Number(b.amount), 0))}
          </strong>
        </span>
      </div>

      {/* Table */}
      {isLoading ? (
        <LoadingPage />
      ) : sortedBills.length === 0 ? (
        <EmptyState
          icon={<CreditCard size={40} />}
          title="Nenhuma conta neste mês"
          description="Adicione contas para controlar seus vencimentos"
          action={
            <Button onClick={() => setDialogOpen(true)}>
              <Plus size={16} /> Nova Conta
            </Button>
          }
        />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Descrição</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Categoria</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Valor</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Vencimento</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {sortedBills.map((bill) => {
                const status = derivebillStatus(bill.due_date, bill.paid_at)
                return (
                  <tr key={bill.id} className={`border-b border-gray-50 last:border-0 hover:bg-gray-50/50 ${status === 'ATRASADO' ? 'bg-red-50/30' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{bill.description}</div>
                      {bill.is_recurrent && (
                        <span className="text-xs text-gray-400">{RECURRENCE_LABELS[bill.recurrence]}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{bill.category}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-800">{formatCurrency(Number(bill.amount))}</td>
                    <td className="px-4 py-3 text-center text-gray-600">
                      {new Date(bill.due_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge bill={bill} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {status !== 'PAGO' && (
                          <button
                            onClick={() => handleMarkPaid(bill)}
                            disabled={markPaid.isPending}
                            title="Marcar como pago"
                            className="p-1.5 rounded text-green-600 hover:bg-green-50 transition-colors"
                          >
                            <Check size={15} />
                          </button>
                        )}
                        <button
                          onClick={() => { setEditingBill(bill); setDialogOpen(true) }}
                          title="Editar"
                          className="p-1.5 rounded text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => setDeleteId(bill.id)}
                          title="Excluir"
                          className="p-1.5 rounded text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Form dialog */}
      {dialogOpen && (
        <BillFormDialog
          open={dialogOpen}
          onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditingBill(undefined) }}
          editing={editingBill}
          onSubmit={handleSubmit}
          loading={createBill.isPending || updateBill.isPending}
        />
      )}

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(v) => { if (!v) setDeleteId(null) }}
        title="Remover conta?"
        description="Esta ação não pode ser desfeita."
        confirmLabel="Remover"
        variant="destructive"
        onConfirm={handleDelete}
        loading={deleteBill.isPending}
      />
    </div>
  )
}
