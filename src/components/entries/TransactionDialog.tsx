import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useCategoriesByGroup } from '@/hooks/useCategories'
import { useBankAccounts } from '@/hooks/useBankAccounts'
import { useCreateTransaction, useCreateTransactions, useUpdateTransaction, useUpdateTransactionsBulk } from '@/hooks/useTransactions'
import { fetchFutureInstallments } from '@/services/transactions.service'
import { CATEGORY_GROUP_LABELS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/useToast'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectGroup, SelectLabel, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { CategoryGroup, EntryType, Transaction } from '@/types/finance.types'

const INCOME_GROUPS: CategoryGroup[] = ['RENDA_PASSIVA', 'RENDA_ATIVA_PJ', 'RENDA_ATIVA_INV']
const EXPENSE_GROUPS: CategoryGroup[] = ['DESPESAS_ESSENCIAIS', 'DESPESAS_DISCRICIONARIAS']

function todayISO() { return new Date().toISOString().slice(0, 10) }
function yesterdayISO() { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10) }

// Toda parcela leva o número da parcela na descrição, ex: "Cartão (2/6)"
const INSTALLMENT_SUFFIX_RE = / \(\d+\/\d+\)$/
function baseDescription(desc: string) { return desc.replace(INSTALLMENT_SUFFIX_RE, '') }
function withInstallmentSuffix(desc: string, n: number, total: number) {
  const base = desc.trim() || 'Despesa parcelada'
  return `${base} (${n}/${total})`
}

const BLANK_FORM = () => ({
  amount: '',
  is_settled: true,
  date: todayISO(),
  description: '',
  category_id: '',
  bank_account_id: '',
  is_ignored: false,
  installments: 1,
})

function formFromTransaction(t: Transaction): ReturnType<typeof BLANK_FORM> {
  return {
    amount: String(t.amount),
    is_settled: t.is_settled,
    date: t.date,
    description: baseDescription(t.description ?? ''),
    category_id: t.category_id,
    bank_account_id: t.bank_account_id,
    is_ignored: t.is_ignored,
    installments: 1,
  }
}

export function TransactionDialog({ type, open, onOpenChange, editing }: {
  type: EntryType
  open: boolean
  onOpenChange: (open: boolean) => void
  editing?: Transaction | null
}) {
  const { user } = useAuth()
  const { byGroup } = useCategoriesByGroup()
  const { data: bankAccounts = [] } = useBankAccounts()
  const createOne = useCreateTransaction()
  const createMany = useCreateTransactions()
  const updateOne = useUpdateTransaction()
  const updateBulk = useUpdateTransactionsBulk()

  // `editing` dialogs are mounted fresh per edit (parent conditionally renders
  // them), so a lazy initializer is enough to prefill the form — no effect needed.
  const [form, setForm] = useState(() => (editing ? formFromTransaction(editing) : BLANK_FORM()))
  const [dateMode, setDateMode] = useState<'hoje' | 'ontem' | 'outros'>(() => (editing ? 'outros' : 'hoje'))
  const [applyToFuture, setApplyToFuture] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const hasFutureInstallments = !!editing?.installment_group_id
    && !!editing.installment_total && !!editing.installment_number
    && editing.installment_number < editing.installment_total

  const groups = type === 'RECEITA' ? INCOME_GROUPS : EXPENSE_GROUPS
  const isDespesa = type === 'DESPESA'
  const isEditing = !!editing
  const accent = type === 'RECEITA' ? 'text-green-600' : 'text-red-600'

  function reset() {
    setForm(BLANK_FORM())
    setDateMode('hoje')
  }

  function handleDateMode(mode: 'hoje' | 'ontem' | 'outros') {
    setDateMode(mode)
    if (mode === 'hoje') setForm((p) => ({ ...p, date: todayISO() }))
    if (mode === 'ontem') setForm((p) => ({ ...p, date: yesterdayISO() }))
  }

  async function handleSave(createNew: boolean) {
    const amount = parseFloat(form.amount)
    if (!amount || amount <= 0) { toast({ title: 'Informe um valor válido', variant: 'destructive' }); return }
    if (!form.category_id) { toast({ title: 'Selecione uma categoria', variant: 'destructive' }); return }
    if (!form.bank_account_id) { toast({ title: 'Selecione uma conta bancária', variant: 'destructive' }); return }

    setIsSaving(true)
    try {
      const base = {
        user_id: user!.id,
        type,
        category_id: form.category_id,
        bank_account_id: form.bank_account_id,
        is_ignored: form.is_ignored,
      }

      if (isEditing) {
        const isInstallment = !!editing.installment_total && editing.installment_total > 1
        const description = isInstallment
          ? withInstallmentSuffix(form.description, editing.installment_number!, editing.installment_total!)
          : (form.description || null)

        await updateOne.mutateAsync({
          id: editing.id,
          updates: { ...base, description, amount, date: form.date, is_settled: form.is_settled },
        })

        if (isInstallment && applyToFuture && editing.installment_group_id) {
          const future = await fetchFutureInstallments(editing.installment_group_id, editing.installment_number!)
          for (const row of future) {
            await updateBulk.mutateAsync({
              ids: [row.id],
              updates: {
                category_id: form.category_id,
                bank_account_id: form.bank_account_id,
                is_ignored: form.is_ignored,
                description: withInstallmentSuffix(form.description, row.installment_number!, row.installment_total!),
              },
            })
          }
        }
      } else if (isDespesa && form.installments > 1) {
        const n = form.installments
        const share = Math.round((amount / n) * 100) / 100
        const lastShare = Math.round((amount - share * (n - 1)) * 100) / 100
        const groupId = crypto.randomUUID()
        const rows = Array.from({ length: n }, (_, i) => {
          const d = new Date(`${form.date}T00:00:00`)
          d.setMonth(d.getMonth() + i)
          return {
            ...base,
            description: withInstallmentSuffix(form.description, i + 1, n),
            amount: i === n - 1 ? lastShare : share,
            date: d.toISOString().slice(0, 10),
            is_settled: i === 0, // só a 1ª parcela debita o saldo agora
            installment_group_id: groupId,
            installment_number: i + 1,
            installment_total: n,
          }
        })
        await createMany.mutateAsync(rows)
      } else {
        await createOne.mutateAsync({ ...base, description: form.description || null, amount, date: form.date, is_settled: form.is_settled })
      }

      toast({ title: isEditing ? 'Lançamento atualizado!' : type === 'RECEITA' ? 'Receita salva!' : 'Despesa salva!', variant: 'success' })
      if (createNew) reset()
      else onOpenChange(false)
    } catch (e: unknown) {
      toast({ title: 'Erro ao salvar', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setIsSaving(false)
    }
  }

  const isPending = createOne.isPending || createMany.isPending || updateOne.isPending || isSaving

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Lançamento' : type === 'RECEITA' ? 'Nova Receita' : 'Nova Despesa'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Valor (R$)</Label>
            <Input
              type="number" step="0.01" placeholder="0,00" value={form.amount}
              onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
              className={cn('text-lg font-semibold', accent)}
            />
          </div>

          <div className="flex items-center justify-between py-1">
            <Label className="text-sm">{type === 'RECEITA' ? 'Foi recebida' : 'Foi paga'}</Label>
            <Switch checked={form.is_settled} onCheckedChange={(v) => setForm((p) => ({ ...p, is_settled: v }))} />
          </div>

          <div className="space-y-1.5">
            <Label>Data</Label>
            <div className="flex gap-2">
              {(['hoje', 'ontem', 'outros'] as const).map((m) => (
                <button
                  key={m} type="button" onClick={() => handleDateMode(m)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-semibold transition-colors',
                    dateMode === m
                      ? type === 'RECEITA' ? 'bg-green-600 text-white' : 'bg-red-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  {m === 'hoje' ? 'Hoje' : m === 'ontem' ? 'Ontem' : 'Outros...'}
                </button>
              ))}
            </div>
            {dateMode === 'outros' && (
              <Input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} />
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Input
              placeholder="Descrição" value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select value={form.category_id} onValueChange={(v) => setForm((p) => ({ ...p, category_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  (byGroup[g]?.length ?? 0) > 0 && (
                    <SelectGroup key={g}>
                      <SelectLabel>{CATEGORY_GROUP_LABELS[g]}</SelectLabel>
                      {byGroup[g].map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectGroup>
                  )
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Conta Bancária</Label>
            <Select value={form.bank_account_id} onValueChange={(v) => setForm((p) => ({ ...p, bank_account_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>{bankAccounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between py-1">
            <Label className="text-sm">Ignorar transação</Label>
            <Switch checked={form.is_ignored} onCheckedChange={(v) => setForm((p) => ({ ...p, is_ignored: v }))} />
          </div>

          {isDespesa && !isEditing && (
            <div className="space-y-1.5">
              <Label>Parcelar em até 12x</Label>
              <Select value={String(form.installments)} onValueChange={(v) => setForm((p) => ({ ...p, installments: Number(v) }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                    <SelectItem key={n} value={String(n)}>{n === 1 ? 'À vista (1x)' : `${n}x`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.installments > 1 && (
                <p className="text-xs text-gray-400">
                  1ª parcela debita o saldo agora; as demais {form.installments - 1} ficam pendentes até você marcá-las como pagas.
                </p>
              )}
            </div>
          )}

          {isEditing && editing?.installment_total && editing.installment_total > 1 && (
            <div className="space-y-2">
              <p className="text-xs text-gray-400">
                Parcela {editing.installment_number}/{editing.installment_total}
              </p>
              {hasFutureInstallments && (
                <div className="flex items-center justify-between py-1">
                  <div>
                    <Label className="text-sm">Aplicar às próximas parcelas</Label>
                    <p className="text-xs text-gray-400">
                      Categoria, conta e descrição também mudam nas parcelas {editing.installment_number! + 1} a {editing.installment_total}
                    </p>
                  </div>
                  <Switch checked={applyToFuture} onCheckedChange={setApplyToFuture} />
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          {!isEditing && (
            <Button variant="outline" onClick={() => handleSave(true)} disabled={isPending}>Salvar e criar nova</Button>
          )}
          <Button variant={type === 'RECEITA' ? 'success' : 'destructive'} onClick={() => handleSave(false)} disabled={isPending}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
