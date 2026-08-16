import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider, useApp } from '@/context/AppContext'
import { PrintProvider } from '@/components/print/PrintProvider'
import Layout from '@/components/Layout'
import Login from '@/pages/Login'
import Index from '@/pages/Index'
import Pacientes from '@/pages/Pacientes'
import Prontuario from '@/pages/Prontuario'
import Agenda from '@/pages/Agenda'
import Aparelhos from '@/pages/Aparelhos'
import Financeiro from '@/pages/Financeiro'
import Estoque from '@/pages/Estoque'
import Relatorios from '@/pages/Relatorios'
import Profile from '@/pages/Profile'
import Users from '@/pages/Users'
import NotFound from '@/pages/NotFound'
import { Toaster } from '@/components/ui/toaster'
import { useToast } from '@/hooks/use-toast'

// Rota protegida: se não houver currentUser, redireciona para /login
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useApp()
  if (!currentUser) {
    return <Navigate to="/login" replace />
  }
  return <Layout>{children}</Layout>
}

// Rota restrita ao administrador: se o usuário não for admin, exibe toast e
// redireciona para o Painel. Usada para /financeiro, /relatorios, /estoque e /usuarios.
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useApp()
  const { toast } = useToast()

  React.useEffect(() => {
    if (currentUser && currentUser.role !== 'admin') {
      toast({
        title: 'Acesso restrito',
        description: 'Acesso restrito ao administrador.',
        variant: 'destructive',
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, currentUser?.role])

  if (!currentUser) {
    return <Navigate to="/login" replace />
  }
  if (currentUser.role !== 'admin') {
    return <Navigate to="/" replace />
  }
  return <Layout>{children}</Layout>
}

// Rota pública de login: se já autenticado, redireciona para o Painel /
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useApp()
  if (currentUser) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

export function App() {
  return (
    <AppProvider>
      <PrintProvider>
        <Router>
          <Routes>
            {/* Rota Pública */}
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              }
            />

            {/* Rotas Autenticadas com Layout Global */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Index />
                </ProtectedRoute>
              }
            />

            <Route
              path="/pacientes"
              element={
                <ProtectedRoute>
                  <Pacientes />
                </ProtectedRoute>
              }
            />

            <Route
              path="/pacientes/:id/prontuario"
              element={
                <ProtectedRoute>
                  <Prontuario />
                </ProtectedRoute>
              }
            />

            <Route
              path="/agenda"
              element={
                <ProtectedRoute>
                  <Agenda />
                </ProtectedRoute>
              }
            />

            <Route
              path="/aparelhos"
              element={
                <ProtectedRoute>
                  <Aparelhos />
                </ProtectedRoute>
              }
            />

            <Route
              path="/financeiro"
              element={
                <AdminRoute>
                  <Financeiro />
                </AdminRoute>
              }
            />

            <Route
              path="/estoque"
              element={
                <AdminRoute>
                  <Estoque />
                </AdminRoute>
              }
            />

            <Route
              path="/relatorios"
              element={
                <AdminRoute>
                  <Relatorios />
                </AdminRoute>
              }
            />

            <Route
              path="/perfil"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />

            <Route
              path="/usuarios"
              element={
                <AdminRoute>
                  <Users />
                </AdminRoute>
              }
            />

            {/* Rota 404 */}
            <Route
              path="*"
              element={
                <ProtectedRoute>
                  <NotFound />
                </ProtectedRoute>
              }
            />
          </Routes>
        </Router>
        <Toaster />
      </PrintProvider>
    </AppProvider>
  )
}

export default App
