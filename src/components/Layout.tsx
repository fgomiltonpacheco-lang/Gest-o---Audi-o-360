import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Calendar,
  FileText,
  Wallet,
  DollarSign,
  Package,
  BarChart3,
  ShoppingCart,
  Menu,
  X,
  LogOut,
  Ear,
  Settings,
  UserCog,
  ListChecks,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { getInitials, getAvatarColor, getAvatarUrl } from '@/lib/formatters'
import logoImg from '@/assets/audicao-360-logo-para-papel-timbrado-da364.png'
import { ConfirmDialog } from '@/components/ConfirmDialog'

interface LayoutProps {
  children?: React.ReactNode
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { currentUser, logout } = useApp()
  const location = useLocation()
  const navigate = useNavigate()

  // Mobile sidebar state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [logoutModalOpen, setLogoutModalOpen] = useState(false)

  interface NavItem {
    name: string
    path: string
    icon: LucideIcon
    exact?: boolean
    adminOnly?: boolean
  }

  // Menu agrupado institucional
  const allNavigationGroups: { groupTitle: string; items: NavItem[] }[] = [
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
          name: 'Vendas',
          path: '/vendas',
          icon: ShoppingCart,
        },
        {
          name: 'Financeiro',
          path: '/financeiro',
          icon: DollarSign,
          adminOnly: true,
        },
        {
          name: 'Caixa',
          path: '/financeiro/caixa',
          icon: Wallet,
          adminOnly: true,
        },
        {
          name: 'Estoque',
          path: '/estoque',
          icon: Package,
          adminOnly: true,
        },
        {
          name: 'Relatórios',
          path: '/relatorios',
          icon: BarChart3,
          adminOnly: true,
        },
        {
          name: 'Configurações',
          path: '/configuracoes',
          icon: SlidersHorizontal,
          adminOnly: true,
        },
      ],
    },
    {
      groupTitle: 'Configurações',
      items: [
        {
          name: 'Perfil',
          path: '/perfil',
          icon: Settings,
        },
        {
          name: 'Usuários',
          path: '/usuarios',
          icon: UserCog,
          adminOnly: true,
        },
        {
          name: 'Procedimentos',
          path: '/procedimentos',
          icon: ListChecks,
          adminOnly: true,
        },
      ],
    },
  ]

  const navigationGroups = allNavigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.adminOnly || currentUser?.role === 'admin'),
    }))
    .filter((group) => group.items.length > 0)

  const isCurrentActive = (path: string, exact = false) => {
    if (exact) return location.pathname === path
    return location.pathname.startsWith(path)
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* SIDEBAR DESKTOP (Fixa 260px) — `transform-none` anula qualquer acidente
          de stacking que desfaria o `fixed` e faria a sidebar rolar com a página. */}
      <aside className="hidden lg:flex flex-col fixed top-0 left-0 bottom-0 w-[260px] bg-navy-700 text-white z-40 border-r border-navy-900/40 shadow-xl select-none transform-none">
        {/* Topo / Logo */}
        <div className="h-20 px-4 flex items-center justify-center border-b border-white/10 bg-white overflow-hidden">
          <Link to="/" className="flex items-center justify-center w-full h-full py-2">
            <img
              src={logoImg}
              alt="Audição360 Centro Auditivo"
              className="max-h-full max-w-full object-contain mx-auto"
            />
          </Link>
        </div>

        {/* Menu agrupado */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {navigationGroups.map((group) => (
            <div key={group.groupTitle} className="space-y-1">
              <span className="px-3 text-[11px] font-bold uppercase tracking-wider text-teal-300/60 block">
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
                        : 'text-slate-300/80 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {active && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-teal-500 rounded-r-full" />
                    )}
                    <Icon
                      className={`w-4 h-4 shrink-0 ${active ? 'text-teal-300' : 'text-slate-300/70'}`}
                    />
                    <span>{item.name}</span>
                  </Link>
                )
              })}
            </div>
          ))}
        </div>

        {/* Rodapé do Usuário */}
        <div className="p-3 border-t border-white/10 bg-navy-900/60">
          <div className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/10">
            <Link
              to="/perfil"
              className="flex items-center gap-2.5 min-w-0 group/user flex-1"
              title="Editar perfil"
            >
              {getAvatarUrl(currentUser) ? (
                <img
                  src={getAvatarUrl(currentUser) || ''}
                  alt={currentUser?.name || 'Avatar'}
                  className="w-9 h-9 rounded-full object-cover shrink-0 shadow-sm"
                />
              ) : (
                <div
                  className={`w-9 h-9 rounded-full ${getAvatarColor(
                    currentUser?.name || 'Admin',
                  )} text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm`}
                >
                  {getInitials(currentUser?.name || 'Audição360')}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate group-hover/user:text-teal-300 transition-colors">
                  {currentUser?.name || 'Administrador'}
                </p>
                <p className="text-[11px] text-slate-300/70 truncate">
                  {currentUser?.email || 'admin@audicao360.com.br'}
                </p>
              </div>
            </Link>
            <div className="flex items-center gap-1 shrink-0">
              <Link
                to="/perfil"
                title="Editar perfil"
                className="p-1.5 rounded-lg text-slate-300/70 hover:text-teal-300 hover:bg-white/10 transition-colors"
              >
                <Settings className="w-4 h-4" />
              </Link>
              <button
                onClick={() => setLogoutModalOpen(true)}
                title="Sair do sistema"
                className="p-1.5 rounded-lg text-slate-300/70 hover:text-red-400 hover:bg-white/10 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
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
          <div className="relative w-[280px] max-w-[80vw] bg-navy-700 text-white flex flex-col z-10 shadow-2xl animate-in slide-in-from-left duration-300">
            <div className="h-20 px-4 flex items-center justify-between border-b border-white/10 bg-white overflow-hidden">
              <Link
                to="/"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center flex-1 h-full py-2"
              >
                <img
                  src={logoImg}
                  alt="Audição360 Centro Auditivo"
                  className="max-h-full max-w-full object-contain mx-auto"
                />
              </Link>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 shrink-0 ml-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
              {navigationGroups.map((group) => (
                <div key={group.groupTitle} className="space-y-1">
                  <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-teal-300/60 block">
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
                            : 'text-slate-300/80 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <Icon className="w-4 h-4 text-teal-300 shrink-0" /> <span>{item.name}</span>
                      </Link>
                    )
                  })}
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-white/10 bg-navy-900/60">
              <div className="flex items-center justify-between gap-2">
                <Link
                  to="/perfil"
                  onClick={() => setMobileMenuOpen(false)}
                  className="min-w-0 flex-1"
                  title="Editar perfil"
                >
                  <p className="text-xs font-semibold text-white truncate hover:text-teal-300 transition-colors">
                    {currentUser?.name}
                  </p>
                  <p className="text-[11px] text-slate-300/70 truncate">{currentUser?.email}</p>
                </Link>
                <div className="flex items-center gap-1 shrink-0">
                  <Link
                    to="/perfil"
                    onClick={() => setMobileMenuOpen(false)}
                    title="Editar perfil"
                    className="p-2 text-slate-300/70 hover:text-teal-300 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                  </Link>
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
        </div>
      )}

      {/* BOTÃO HAMBÚRGUER MOBILE FLUTUANTE / BARRA MINIMALISTA MOBILE */}
      <div className="lg:hidden sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          aria-label="Abrir menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <Link to="/" className="flex items-center h-8">
          <img src={logoImg} alt="Audição360" className="h-full object-contain" />
        </Link>
        <div className="w-9" /> {/* balance spacer */}
      </div>

      {/* ÁREA DE CONTEÚDO PRINCIPAL (Offset Desktop 260px sem padding superior de header) */}
      <main className="flex-1 lg:ml-[260px] p-4 sm:p-6 lg:p-8 min-h-screen">
        <div className="max-w-7xl mx-auto space-y-6">{children}</div>
      </main>

      {/* RODAPÉ GLOBAL */}
      <footer className="lg:ml-[260px] py-4 px-6 border-t border-slate-200 bg-white text-center text-xs text-slate-400">
        © 2025 Audição360 — Sistema de Gestão Clínica Integrada para Centros Auditivos
      </footer>

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
