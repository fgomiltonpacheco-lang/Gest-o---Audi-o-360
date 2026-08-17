import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider, useApp } from '@/context/AppContext'
import { PrintProvider } from '@/components/print/PrintProvider'
import Layout from '@/components/Layout'
import Login from '@/pages/Login'
import Index from '@/pages/Index'
import Pacientes from '@/pages/Pacientes'
import Prontuario from '@/pages/Prontuario'
import Audiometria from '@/pages/Audiometria'
import Imitanciometria from '@/pages/Imitanciometria'
import Agenda from '@/pages/Agenda'
import Aparelhos from '@/pages/Aparelhos'
import Financeiro from '@/pages/Financeiro'
import Caixa from '@/pages/Caixa'
import Vendas from '@/pages/Vendas'
import PDV from '@/pages/PDV'
import Estoque from '@/pages/Estoque'
import Relatorios from '@/pages/Relatorios'
import RelatorioFaturamento from '@/pages/relatorios/Faturamento'
import RelatorioProducao from '@/pages/relatorios/Producao'
import RelatorioConversao from '@/pages/relatorios/Conversao'
import RelatorioNoShow from '@/pages/relatorios/NoShow'
import RelatorioPacientesFluxo from '@/pages/relatorios/PacientesFluxo'
import RelatorioEstoqueBaixo from '@/pages/relatorios/EstoqueBaixo'
import RelatorioGarantias from '@/pages/relatorios/Garantias'
import Profile from '@/pages/Profile'
import AlterarSenha from '@/pages/AlterarSenha'
import Users from '@/pages/Users'
import Procedimentos from '@/pages/Procedimentos'
import Configuracoes from '@/pages/Configuracoes'
import VendasB2B from '@/pages/VendasB2B'
import RelatorioComissoesB2B from '@/pages/RelatorioComissoesB2B'
import NovaVendaB2B from '@/pages/NovaVendaB2B'
import DetalhesVendaB2B from '@/pages/DetalhesVendaB2B'
import EmpresasParceiras from '@/pages/EmpresasParceiras'
import Auditoria from '@/pages/Auditoria'
import ContasReceberPage from '@/pages/ContasReceber'
import Inadimplentes from '@/pages/Inadimplentes'
import FluxoProjetado from '@/pages/FluxoProjetado'
import Despesas from '@/pages/Despesas'
import Lembretes from '@/pages/Lembretes'
import OrdensServico from '@/pages/OrdensServico'
import NotFound from '@/pages/NotFound'
import ExamReportTemplatesList from '@/pages/laudos/ExamReportTemplatesList'
import ExamReportTemplateNovo from '@/pages/laudos/ExamReportTemplateNovo'
import ExamReportTemplateEditor from '@/pages/laudos/ExamReportTemplateEditor'
import ExamReportTemplatePreview from '@/pages/laudos/ExamReportTemplatePreview'
import ExamReportTemplateVersions from '@/pages/laudos/ExamReportTemplateVersions'
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

// Rota proibida para a secretária: se o usuário for 'secretaria', exibe toast
// de acesso restrito e redireciona para o Painel. Demais perfis (admin,
// profissional) acessam normalmente. Usada para /aparelhos e
// /relatorios/producao, que são ProtectedRoute na origem mas não devem ser
// acessíveis à secretária via URL direta.
const NonSecretariaRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useApp()
  const { toast } = useToast()

  React.useEffect(() => {
    if (currentUser && currentUser.role === 'secretaria') {
      toast({
        title: 'Acesso restrito',
        description: 'Você não tem permissão para acessar esta área.',
        variant: 'destructive',
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, currentUser?.role])

  if (!currentUser) {
    return <Navigate to="/login" replace />
  }
  if (currentUser.role === 'secretaria') {
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
              path="/pacientes/:id/audiometria/:examId?"
              element={
                <ProtectedRoute>
                  <Audiometria />
                </ProtectedRoute>
              }
            />

            <Route
              path="/pacientes/:id/imitanciometria/:examId?"
              element={
                <ProtectedRoute>
                  <Imitanciometria />
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
              path="/agenda/lembretes"
              element={
                <ProtectedRoute>
                  <Lembretes />
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
              path="/financeiro/caixa"
              element={
                <AdminRoute>
                  <Caixa />
                </AdminRoute>
              }
            />
            <Route
              path="/financeiro/contas-receber"
              element={
                <AdminRoute>
                  <ContasReceberPage />
                </AdminRoute>
              }
            />
            <Route
              path="/financeiro/inadimplentes"
              element={
                <AdminRoute>
                  <Inadimplentes />
                </AdminRoute>
              }
            />
            <Route
              path="/financeiro/fluxo-projetado"
              element={
                <AdminRoute>
                  <FluxoProjetado />
                </AdminRoute>
              }
            />
            <Route
              path="/financeiro/despesas"
              element={
                <AdminRoute>
                  <Despesas />
                </AdminRoute>
              }
            />

            {/* ===== Módulo de Vendas / PDV ===== */}
            <Route
              path="/vendas/pdv"
              element={
                <AdminRoute>
                  <PDV />
                </AdminRoute>
              }
            />
            <Route
              path="/vendas"
              element={
                <ProtectedRoute>
                  <Vendas />
                </ProtectedRoute>
              }
            />

            {/* ===== Ordens de Serviço ===== */}
            <Route
              path="/ordens-servico"
              element={
                <ProtectedRoute>
                  <OrdensServico />
                </ProtectedRoute>
              }
            />

            {/* ===== Módulo de Vendas B2B ===== */}
            <Route
              path="/vendas-b2b"
              element={
                <AdminRoute>
                  <VendasB2B />
                </AdminRoute>
              }
            />
            <Route
              path="/vendas-b2b/nova"
              element={
                <AdminRoute>
                  <NovaVendaB2B />
                </AdminRoute>
              }
            />
            <Route
              path="/vendas-b2b/:id"
              element={
                <AdminRoute>
                  <DetalhesVendaB2B />
                </AdminRoute>
              }
            />
            <Route
              path="/relatorios/comissoes-b2b"
              element={
                <AdminRoute>
                  <RelatorioComissoesB2B />
                </AdminRoute>
              }
            />
            {/* ===== Módulo de Relatórios (expandido) ===== */}
            <Route
              path="/relatorios/faturamento"
              element={
                <AdminRoute>
                  <RelatorioFaturamento />
                </AdminRoute>
              }
            />
            <Route
              path="/relatorios/producao"
              element={
                <NonSecretariaRoute>
                  <RelatorioProducao />
                </NonSecretariaRoute>
              }
            />
            <Route
              path="/relatorios/conversao"
              element={
                <AdminRoute>
                  <RelatorioConversao />
                </AdminRoute>
              }
            />
            <Route
              path="/relatorios/no-show"
              element={
                <AdminRoute>
                  <RelatorioNoShow />
                </AdminRoute>
              }
            />
            <Route
              path="/relatorios/pacientes-fluxo"
              element={
                <AdminRoute>
                  <RelatorioPacientesFluxo />
                </AdminRoute>
              }
            />
            <Route
              path="/relatorios/estoque-baixo"
              element={
                <AdminRoute>
                  <RelatorioEstoqueBaixo />
                </AdminRoute>
              }
            />
            <Route
              path="/relatorios/garantias"
              element={
                <AdminRoute>
                  <RelatorioGarantias />
                </AdminRoute>
              }
            />
            <Route
              path="/empresas-parceiras"
              element={
                <AdminRoute>
                  <EmpresasParceiras />
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
              path="/alterar-senha"
              element={
                <ProtectedRoute>
                  <AlterarSenha />
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

            <Route
              path="/procedimentos"
              element={
                <AdminRoute>
                  <Procedimentos />
                </AdminRoute>
              }
            />

            <Route
              path="/configuracoes"
              element={
                <AdminRoute>
                  <Configuracoes />
                </AdminRoute>
              }
            />

            {/* ===== Modelos de Laudo (Admin only) ===== */}
            <Route
              path="/configuracoes/laudos"
              element={
                <AdminRoute>
                  <ExamReportTemplatesList />
                </AdminRoute>
              }
            />
            <Route
              path="/configuracoes/laudos/novo"
              element={
                <AdminRoute>
                  <ExamReportTemplateNovo />
                </AdminRoute>
              }
            />
            <Route
              path="/configuracoes/laudos/:id/editor"
              element={
                <AdminRoute>
                  <ExamReportTemplateEditor />
                </AdminRoute>
              }
            />
            <Route
              path="/configuracoes/laudos/:id/preview"
              element={
                <AdminRoute>
                  <ExamReportTemplatePreview />
                </AdminRoute>
              }
            />
            <Route
              path="/configuracoes/laudos/:id/versoes"
              element={
                <AdminRoute>
                  <ExamReportTemplateVersions />
                </AdminRoute>
              }
            />

            {/* ===== Trilha de Auditoria (Admin only) ===== */}
            <Route
              path="/admin/auditoria"
              element={
                <AdminRoute>
                  <Auditoria />
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
