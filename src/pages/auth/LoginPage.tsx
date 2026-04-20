import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/useToast'

export function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      toast({ title: 'Erro ao entrar', description: error.message, variant: 'destructive' })
    } else {
      navigate('/dashboard')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Entrar</h2>
        <p className="text-sm text-gray-500 mt-1">Acesse sua conta para continuar</p>
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
          id="password" type="password" placeholder="••••••••"
          value={password} onChange={(e) => setPassword(e.target.value)} required
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Entrando...' : 'Entrar'}
      </Button>
      <p className="text-center text-sm text-gray-500">
        Não tem conta?{' '}
        <Link to="/register" className="text-blue-600 hover:underline font-medium">
          Criar conta
        </Link>
      </p>
    </form>
  )
}
