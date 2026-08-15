import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Calendar,
  FileText,
  DollarSign,
  Package,
  BarChart3,
  Menu,
  X,
  Bell,
  LogOut,
  Ear,
} from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { getInitials, getAvatarColor } from '@/lib/formatters'
import logoImg from '@/assets/editedimage1786755251977-cb14f.png'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { NotificationsDrawer } from '@/components/NotificationsDrawer'
import { GlobalSearch } from '@/components/GlobalSearch'

interface LayoutProps {
  children?: React.ReactNode
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { currentUser, logout, unreadAlertsCount } = useApp()
  const location = useLocation()
  const navigate = useNavigate()

  // Mobile sidebar state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [logoutModalOpen, setLogoutModalOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)

  // Menu agrupado institucional
  const navigationGroups = [
    {
      groupTitle: 'Visão Geral',
      items: [
        {
          name: 'Painel',
          path: '/',
          icon: LayoutDashboard,
          exact: true,
        },
      ],
    },
    {
      groupTitle: 'Atendimento',
      items: [
        {
          name: 'Pacientes',
          path: '/pacientes',
          icon: Users,
        },
        {
          name: 'Agenda',
          path: '/agenda',
          icon: Calendar,
        },
      ],
    },
    {
      groupTitle: 'Clínico',
      items: [
        {
          name: 'Aparelhos Auditivos',
          path: '/aparelhos',
          icon: Ear,
        },
      ],
    },
    {
      groupTitle: 'Gestão',
      items: [
        {
          name: 'Financeiro',
          path: '/financeiro',
          icon: DollarSign,
        },
        {
          name: 'Estoque',
          path: '/estoque',
          icon: Package,
        },
        {
          name: 'Relatórios',
          path: '/relatorios',
          icon: BarChart3,
        },
      ],
    },
  ]

  const isCurrentActive = (path: string, exact = false) => {
    if (exact) return location.pathname === path
    return location.pathname.startsWith(path)
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* SIDEBAR DESKTOP (Fixa 260px) */}
      <aside className="hidden lg:flex flex-col fixed top-0 left-0 bottom-0 w-[260px] bg-[#1e3a8a] text-white z-40 border-r border-blue-950/40 shadow-xl select-none">
        {/* Topo / Logo */}
        <div className="h-20 px-5 flex items-center border-b border-white/10 bg-white">
          <Link to="/" className="flex items-center justify-center w-full py-2">
            <img
              src={logoImg}
              alt="Audição360 Centro Auditivo"
              className="h-16 w-auto object-contain max-w-[220px]"
            />
          </Link>
        </div>

        {/* Menu agrupado */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {navigationGroups.map((group) => (
            <div key={group.groupTitle} className="space-y-1">
              <span className="px-3 text-[11px] font-bold uppercase tracking-wider text-blue-300/60 block">
                {group.groupTitle}
              </span>
              {group.items.map((item) => {
                const active = isCurrentActive(item.path, item.exact)
                const Icon = item.icon
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 relative ${
                      active
                        ? 'bg-white/10 text-white font-semibold shadow-sm'
                        : 'text-blue-100/80 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {active && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-[#60a5fa] rounded-r-full" />
                    )}
                    <Icon
                      className={`w-4 h-4 shrink-0 ${active ? 'text-blue-300' : 'text-blue-200/70'}`}
                    />
                    <span>{item.name}</span>
                  </Link>
                )
              })}
            </div>
          ))}
        </div>

        {/* Rodapé do Usuário */}
        <div className="p-3 border-t border-white/10 bg-[#172554]/50">
          <div className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-9 h-9 rounded-full ${getAvatarColor(
                  currentUser?.name || 'Admin',
                )} text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm`}
              >
                {getInitials(currentUser?.name || 'Audição360')}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate">
                  {currentUser?.name || 'Administrador'}
                </p>
                <p className="text-[11px] text-blue-200/70 truncate">
                  {currentUser?.email || 'admin@audicao360.com.br'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setLogoutModalOpen(true)}
              title="Sair do sistema"
              className="p-1.5 rounded-lg text-blue-200/70 hover:text-red-400 hover:bg-white/10 transition-colors shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* SIDEBAR MOBILE DRAWER */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Overlay escuro translúcido */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Gaveta lateral */}
          <div className="relative w-[280px] max-w-[80vw] bg-[#1e3a8a] text-white flex flex-col z-10 shadow-2xl animate-in slide-in-from-left duration-300">
            <div className="h-20 px-5 flex items-center justify-between border-b border-white/10 bg-white">
              <Link
                to="/"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center py-2"
              >
                <img
                  src={logoImg}
                  alt="Audição360 Centro Auditivo"
                  className="h-14 w-auto object-contain max-w-[220px]"
                />
              </Link>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
              {navigationGroups.map((group) => (
                <div key={group.groupTitle} className="space-y-1">
                  <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-blue-300/60 block">
                    {group.groupTitle}
                  </span>
                  {group.items.map((item) => {
                    const active = isCurrentActive(item.path, item.exact)
                    const Icon = item.icon
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                          active
                            ? 'bg-white/10 text-white font-semibold'
                            : 'text-blue-100/80 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <Icon className="w-4 h-4 text-blue-300 shrink-0" />
                        <span>{item.name}</span>
                      </Link>
                    )
                  })}
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-white/10 bg-[#172554]/60">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{currentUser?.name}</p>
                  <p className="text-[11px] text-blue-200/70 truncate">{currentUser?.email}</p>
                </div>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false)
                    setLogoutModalOpen(true)
                  }}
                  className="p-2 text-red-300 hover:bg-red-500/20 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HEADER SUPERIOR (Fixo 64px) */}
      <header className="h-16 bg-white border-b border-slate-200 fixed top-0 right-0 left-0 lg:left-[260px] z-30 px-4 sm:px-6 flex items-center justify-between gap-4 shadow-sm">
        {/* Botão Hambúrguer Mobile */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            aria-label="Abrir menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="hidden sm:inline-block text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
            Centro de Atendimento Clínico
          </span>
        </div>

        {/* Barra de Busca Global (pacientes, agendamentos e prontuários) */}
        <GlobalSearch />

        {/* Lado Direito: Notificações & Avatar do Usuário */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Sino de Notificações */}
          <button
            onClick={() => setNotificationsOpen(true)}
            className="relative p-2 rounded-full text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            title="Ver alertas"
            aria-label="Alertas do sistema"
          >
            <Bell className="w-5 h-5" />
            {unreadAlertsCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                {unreadAlertsCount}
              </span>
            )}
          </button>

          {/* Avatar com iniciais */}
          <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
            <div
              className={`w-9 h-9 rounded-full ${getAvatarColor(
                currentUser?.name || 'Admin',
              )} text-white flex items-center justify-center font-bold text-xs shadow-sm ring-2 ring-blue-500/20`}
            >
              {getInitials(currentUser?.name || 'Audição360')}
            </div>
            <div className="hidden md:block text-left">
              <span className="text-xs font-bold text-slate-800 block leading-tight truncate max-w-[140px]">
                {currentUser?.name || 'Administrador'}
              </span>
              <span className="text-[10px] text-slate-500 block truncate">
                {currentUser?.crmCrfa || 'Fonoaudiologia'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ÁREA DE CONTEÚDO PRINCIPAL (Offset Desktop 260px e Topo 64px) */}
      <main className="flex-1 lg:ml-[260px] pt-16 p-4 sm:p-6 lg:p-8 min-h-screen">
        <div className="max-w-7xl mx-auto space-y-6">{children}</div>
      </main>

      {/* RODAPÉ GLOBAL */}
      <footer className="lg:ml-[260px] py-4 px-6 border-t border-slate-200 bg-white text-center text-xs text-slate-400">
        © 2025 Audição360 — Sistema de Gestão Clínica Integrada para Centros Auditivos
      </footer>

      {/* PAINEL LATERAL DE NOTIFICAÇÕES */}
      <NotificationsDrawer open={notificationsOpen} onOpenChange={setNotificationsOpen} />

      {/* MODAL DE CONFIRMAÇÃO DE LOGOUT */}
      <ConfirmDialog
        open={logoutModalOpen}
        onOpenChange={setLogoutModalOpen}
        title="Deseja realmente sair?"
        description="Sua sessão será encerrada com segurança no Audição360. Você precisará digitar suas credenciais para entrar novamente."
        confirmText="Sim, Sair"
        cancelText="Permanecer"
        variant="danger"
        onConfirm={() => {
          logout()
          navigate('/login')
        }}
      />
    </div>
  )
}

export default Layout
