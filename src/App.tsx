import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import { YearProvider } from '@/contexts/YearContext'
import { useAuth } from '@/hooks/useAuth'
import { AppLayout } from '@/components/layout/AppLayout'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { LoginPage } from '@/pages/auth/LoginPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { EntriesPage } from '@/pages/EntriesPage'
import { InvestmentIncomePage } from '@/pages/InvestmentIncomePage'
import { PatrimonyPage } from '@/pages/PatrimonyPage'
import { BillsPage } from '@/pages/BillsPage'
import { LoadingPage } from '@/components/shared/LoadingSpinner'
import { Toaster } from '@/components/shared/Toaster'

function AuthGuard() {
  const { user, loading } = useAuth()
  if (loading) return <LoadingPage />
  if (!user) return <Navigate to="/login" replace />
  return <Outlet />
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>
      <Route element={<AuthGuard />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/entries" element={<EntriesPage />} />
          <Route path="/investments" element={<InvestmentIncomePage />} />
          <Route path="/patrimony" element={<PatrimonyPage />} />
          <Route path="/bills" element={<BillsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <YearProvider>
        <BrowserRouter>
          <AppRoutes />
          <Toaster />
        </BrowserRouter>
      </YearProvider>
    </QueryClientProvider>
  )
}
