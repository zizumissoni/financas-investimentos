import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import {
  useBankAccounts, useCreateBankAccount, useUpdateBankAccountBalance, useDeleteBankAccount,
} from '@/hooks/useBankAccounts'
import { formatCurrency, cn } from '@/lib/utils'
import { toast } from '@/hooks/useToast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingPage } from '@/components/shared/LoadingSpinner'
import { Landmark, Plus, Pencil, Trash2 } from 'lucide-react'
import type { BankAccount } from '@/types/finance.types'

function EditBalanceDialog({ account, onOpenChange }: { account: BankAccount | null; onOpenChange: (v: boolean) => void }) {
  const [value, setValue] = useState('')
  const updateBalance = useUpdateBankAccountBalance()

  async function handleSave() {
    if (!account) return
    const balance = parseFloat(value)
    if (Number.isNaN(balance)) { toast({ title: 'Informe um valor válido', variant: 'destructive' }); return }
    try {
      await updateBalance.mutateAsync({ id: account.id, balance })
      toast({ title: 'Saldo atualizado!', variant: 'success' })
      onOpenChange(false)
    } catch (e: unknown) {
      toast({ title: 'Erro ao atualizar saldo', description: (e as Error).message, variant: 'destructive' })
    }
  }

  return (
    <Dialog open={!!account} onOpenChange={(v) => { onOpenChange(v); if (!v) setValue('') }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Editar Saldo — {account?.name}</DialogTitle></DialogHeader>
        <div className="space-y-1.5 py-2">
          <Label>Novo saldo (R$)</Label>
          <Input
            type="number" step="0.01"
            placeholder={account ? String(account.balance) : '0,00'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={updateBalance.isPending}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function AccountsTab() {
  const { user } = useAuth()
  const { data: accounts = [], isLoading } = useBankAccounts()
  const sortedAccounts = [...accounts].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  const createAccount = useCreateBankAccount()
  const deleteAccount = useDeleteBankAccount()

  const [newDialogOpen, setNewDialogOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [editAccount, setEditAccount] = useState<BankAccount | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  async function handleCreate() {
    if (!newName.trim()) return
    try {
      await createAccount.mutateAsync({ user_id: user!.id, name: newName.trim() })
      toast({ title: 'Conta criada!', variant: 'success' })
      setNewDialogOpen(false)
      setNewName('')
    } catch (e: unknown) {
      toast({ title: 'Erro ao criar conta', description: (e as Error).message, variant: 'destructive' })
    }
  }

  async function handleDelete() {
    if (!deleteId) return
    try {
      await deleteAccount.mutateAsync(deleteId)
      toast({ title: 'Conta removida', variant: 'success' })
    } catch (e: unknown) {
      toast({ title: 'Erro ao remover', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setDeleteId(null)
    }
  }

  if (isLoading) return <LoadingPage />

  const totalBalance = accounts.reduce((s, a) => s + Number(a.balance), 0)

  return (
    <div className="space-y-5 mt-2">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm text-gray-500">
          Saldo total: <span className={cn('font-bold', totalBalance >= 0 ? 'text-green-600' : 'text-red-600')}>{formatCurrency(totalBalance)}</span>
        </div>
        <Button size="sm" onClick={() => setNewDialogOpen(true)}><Plus size={14} /> Nova Conta</Button>
      </div>

      {accounts.length === 0 ? (
        <EmptyState
          icon={<Landmark size={40} />}
          title="Nenhuma conta cadastrada"
          description="Adicione uma conta bancária para começar a lançar receitas e despesas"
          action={<Button onClick={() => setNewDialogOpen(true)}><Plus size={16} /> Nova Conta</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedAccounts.map((a) => (
            <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center text-violet-600">
                    <Landmark size={15} />
                  </div>
                  <span className="text-sm font-semibold text-gray-800">{a.name}</span>
                </div>
                <button onClick={() => setDeleteId(a.id)} className="p-1 rounded text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
              <div>
                <p className="text-xs text-gray-400">Saldo atual</p>
                <p className={cn('text-xl font-bold', Number(a.balance) >= 0 ? 'text-green-600' : 'text-red-600')}>
                  {formatCurrency(Number(a.balance))}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setEditAccount(a)}>
                <Pencil size={13} /> Editar Saldo
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={newDialogOpen} onOpenChange={(v) => { setNewDialogOpen(v); if (!v) setNewName('') }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nova Conta</DialogTitle></DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label>Nome da conta</Label>
            <Input placeholder="Ex: Itaú - C/C" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={createAccount.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EditBalanceDialog account={editAccount} onOpenChange={(v) => { if (!v) setEditAccount(null) }} />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(v) => { if (!v) setDeleteId(null) }}
        title="Remover conta?"
        description="A conta será desativada e deixará de aparecer nos seletores de novas transações."
        confirmLabel="Remover"
        variant="destructive"
        onConfirm={handleDelete}
        loading={deleteAccount.isPending}
      />
    </div>
  )
}
