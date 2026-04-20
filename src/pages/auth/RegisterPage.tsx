import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/useToast'

export function RegisterPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    })
    setLoading(false)
    if (error) {
      toast({ title: 'Erro ao criar conta', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Conta criada!', description: 'Verifique seu e-mail para confirmar o cadastro.', variant: 'success' })
      navigate('/login')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Criar conta</h2>
        <p className="text-sm text-gray-500 mt-1">Comece a controlar suas finanças</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="name">Nome</Label>
        <Input
          id="name" type="text" placeholder="Seu nome"
          value={name} onChange={(e) => setName(e.target.value)} required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email" type="email" placeholder="seu@email.com"
          value={email} onChange={(e) => setEmail(e.target.value)} required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Senha</Label>
        <Input
          id="password" type="password" placeholder="Mínimo 6 caracteres"
          value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Criando conta...' : 'Criar conta'}
      </Button>
      <p className="text-center text-sm text-gray-500">
        Já tem conta?{' '}
        <Link to="/login" className="text-blue-600 hover:underline font-medium">
          Entrar
        </Link>
      </p>
    </form>
  )
}
