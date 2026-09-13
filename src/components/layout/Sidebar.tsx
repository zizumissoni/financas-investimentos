import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Receipt, Wallet, CreditCard, LogOut, PiggyBank, BarChart3
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

const navItems = [
  { to: '/dashboard',   icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/entries',     icon: Receipt,         label: 'Finanças Pessoais' },
  { to: '/investments', icon: BarChart3,        label: 'Renda Investimentos' },
  { to: '/patrimony',   icon: Wallet,           label: 'Patrimônio' },
  { to: '/bills',       icon: CreditCard,       label: 'Contas a Pagar' },
]

export function Sidebar() {
  const navigate = useNavigate()

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <aside className="w-64 flex flex-col bg-slate-900 text-slate-300 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-700">
        <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
          <PiggyBank size={18} className="text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white leading-tight">Finanças</p>
          <p className="text-xs text-slate-400 leading-tight">& Investimentos</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              )
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-slate-700">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors w-full"
        >
          <LogOut size={18} />
          Sair
        </button>
      </div>
    </aside>
  )
}
