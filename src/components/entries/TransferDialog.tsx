import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useBankAccounts } from '@/hooks/useBankAccounts'
import { useCreateTransfer } from '@/hooks/useTransfers'
import { toast } from '@/hooks/useToast'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

function todayISO() { return new Date().toISOString().slice(0, 10) }

const BLANK_FORM = () => ({
  from_account_id: '', to_account_id: '', amount: '', date: todayISO(), description: '',
})

export function TransferDialog({ open, onOpenChange }: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { user } = useAuth()
  const { data: bankAccounts = [] } = useBankAccounts()
  const createTransfer = useCreateTransfer()
  const [form, setForm] = useState(BLANK_FORM())

  function reset() { setForm(BLANK_FORM()) }

  async function handleSave() {
    const amount = parseFloat(form.amount)
    if (!amount || amount <= 0) { toast({ title: 'Informe um valor válido', variant: 'destructive' }); return }
    if (!form.from_account_id || !form.to_account_id) { toast({ title: 'Selecione as duas contas', variant: 'destructive' }); return }
    if (form.from_account_id === form.to_account_id) { toast({ title: 'Origem e destino devem ser diferentes', variant: 'destructive' }); return }

    try {
      await createTransfer.mutateAsync({
        user_id: user!.id,
        from_account_id: form.from_account_id,
        to_account_id: form.to_account_id,
        amount,
        date: form.date,
        description: form.description || null,
      })
      toast({ title: 'Transferência registrada!', variant: 'success' })
      onOpenChange(false)
      reset()
    } catch (e: unknown) {
      toast({ title: 'Erro ao transferir', description: (e as Error).message, variant: 'destructive' })
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset() }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Transferência entre Contas</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Conta de Origem</Label>
            <Select value={form.from_account_id} onValueChange={(v) => setForm((p) => ({ ...p, from_account_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>{bankAccounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Conta de Destino</Label>
            <Select value={form.to_account_id} onValueChange={(v) => setForm((p) => ({ ...p, to_account_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>{bankAccounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Valor (R$)</Label>
            <Input type="number" step="0.01" placeholder="0,00" value={form.amount}
              onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Data</Label>
            <Input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição (opcional)</Label>
            <Input placeholder="Descrição" value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={createTransfer.isPending}>Transferir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
