import React, { useState, useCallback, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Calendar,
  FileText,
  Wallet,
  TrendingDown,
  CalendarRange,
  DollarSign,
  Package,
  BarChart3,
  ShoppingCart,
  Building2,
  PieChart,
  Handshake,
  Menu,
  MessageCircle,
  MessagesSquare,
  X,
  LogOut,
  Ear,
  Settings,
  UserCog,
  ListChecks,
  SlidersHorizontal,
  ShieldCheck,
  ChevronDown,
  Brain,
  TrendingUp,
  Target,
  CalendarX,
  UserPlus,
  Shield,
  KeyRound,
  ArrowDownCircle,
  Wrench,
  // Ícones do painel SaaS (Super Admin)
  CreditCard,
  CornerUpLeft,
  Crown,
  type LucideIcon,
} from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { getInitials, getAvatarColor, getAvatarUrl } from '@/lib/formatters'
import logoImg from '@/assets/audicao-360-logo-para-papel-timbrado-da364.png'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useSessionTimeout } from '@/lib/sessionTimeout'
import { SessionTimeoutModal } from '@/components/SessionTimeoutModal'
import { ChatWidget } from '@/components/ChatWidget'
import { Switch } from '@/components/ui/switch'
import { getLandingUrl, isAppSubdomain } from '@/lib/domain'

interface LayoutProps {
  children?: React.ReactNode
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const {
    currentUser,
    logout,
    securitySettings,
    sessionTimeoutDisabled,
    setSessionTimeoutDisabled,
    unreadMessagesCount,
  } = useApp()
  const location = useLocation()
  const navigate = useNavigate()

  // ---------- Timeout de sessão por inatividade ----------
  const [timeoutModalOpen, setTimeoutModalOpen] = useState(false)
  const printingRef = useRef(false)

  // Detecta impressão (beforeprint/afterprint) para pausar o timeout.
  React.useEffect(() => {
    const onBeforePrint = () => {
      printingRef.current = true
      setSessionTimeoutDisabled(true)
    }
    const onAfterPrint = () => {
      printingRef.current = false
      setSessionTimeoutDisabled(false)
    }
    window.addEventListener('beforeprint', onBeforePrint)
    window.addEventListener('afterprint', onAfterPrint)
    return () => {
      window.removeEventListener('beforeprint', onBeforePrint)
      window.removeEventListener('afterprint', onAfterPrint)
    }
  }, [setSessionTimeoutDisabled])

  const handleSessionExpire = useCallback(() => {
    setTimeoutModalOpen(false)
    logout()
    navigate('/login?reason=timeout')
  }, [logout, navigate])

  const handleSessionWarning = useCallback(() => {
    // Só mostra o modal se não estiver desabilitado (form sujo, impressão, download).
    if (!sessionTimeoutDisabled) {
      setTimeoutModalOpen(true)
    }
  }, [sessionTimeoutDisabled])

  const handleSessionContinue = useCallback(() => {
    setTimeoutModalOpen(false)
  }, [])

  const timeoutEnabled =
    !!securitySettings?.session_timeout_enabled &&
    (securitySettings?.session_timeout_minutes || 0) > 0

  useSessionTimeout({
    timeoutMinutes: securitySettings?.session_timeout_minutes || 15,
    warningSeconds: securitySettings?.session_timeout_warning_seconds || 60,
    onWarning: handleSessionWarning,
    onExpire: handleSessionExpire,
    isDisabled: !timeoutEnabled || sessionTimeoutDisabled,
  })

  // Mobile sidebar state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [logoutModalOpen, setLogoutModalOpen] = useState(false)
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>(() =>
    typeof window !== 'undefined'
      ? {
          '/relatorios': window.location.pathname.startsWith('/relatorios'),
          '/agenda': window.location.pathname.startsWith('/agenda'),
          '/configuracoes': window.location.pathname.startsWith('/configuracoes'),
        }
      : {},
  )

  // ---------- Modo Super Admin (SaaS) ----------
  // Toggle visível apenas para o dono do SaaS (isSuperAdmin). Persiste em
  // localStorage e alterna entre "Minha Clínica" (modo normal) e "Gestão SaaS"
  // (painel multi-clínicas). Ao ativar o modo SaaS, redireciona para /saas.
  const isSuperAdmin = !!currentUser?.isSuperAdmin
  const [saasMode, setSaasMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try {
      return window.localStorage.getItem('audicao360_saas_mode') === '1'
    } catch {
      return false
    }
  })

  const toggleSaasMode = useCallback(
    (next: boolean) => {
      setSaasMode(next)
      try {
        window.localStorage.setItem('audicao360_saas_mode', next ? '1' : '0')
      } catch {
        /* ignore */
      }
      if (next) {
        navigate('/saas')
      } else {
        navigate('/')
      }
    },
    [navigate],
  )

  // Se o usuário não é mais super admin (ex.: trocou de conta), reseta o modo.
  React.useEffect(() => {
    if (!isSuperAdmin && saasMode) {
      setSaasMode(false)
      try {
        window.localStorage.setItem('audicao360_saas_mode', '0')
      } catch {
        /* ignore */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin])

  interface NavItem {
    name: string
    path: string
    icon: LucideIcon
    exact?: boolean
    // Perfis que podem ver este item. Ausente = visível para todos.
    roles?: string[]
    children?: NavItem[]
  }

  // Perfis disponíveis no sistema
  const ALL_ROLES = ['admin', 'profissional', 'secretaria']
  const ADMIN_ONLY: string[] = ['admin']

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
          roles: ALL_ROLES,
        },
        {
          name: 'Mensagens',
          path: '/mensagens',
          icon: MessagesSquare,
          roles: ALL_ROLES,
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
          roles: ALL_ROLES,
        },
        {
          name: 'Agenda',
          path: '/agenda',
          icon: Calendar,
          roles: ALL_ROLES,
          children: [
            {
              name: 'Agenda',
              path: '/agenda',
              icon: Calendar,
              exact: true,
              roles: ALL_ROLES,
            },
            {
              name: 'Lembretes',
              path: '/agenda/lembretes',
              icon: MessageCircle,
              roles: ALL_ROLES,
            },
          ],
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
          roles: ['admin', 'profissional'],
        },
        {
          name: 'Ordens de Serviço',
          path: '/ordens-servico',
          icon: Wrench,
          roles: ALL_ROLES,
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
          roles: ALL_ROLES,
        },
        {
          name: 'Vendas B2B',
          path: '/vendas-b2b',
          icon: Building2,
          roles: ADMIN_ONLY,
        },
        {
          name: 'Comissões B2B',
          path: '/relatorios/comissoes-b2b',
          icon: PieChart,
          roles: ADMIN_ONLY,
        },
        {
          name: 'Parceiros',
          path: '/empresas-parceiras',
          icon: Handshake,
          roles: ADMIN_ONLY,
        },
        {
          name: 'Financeiro',
          path: '/financeiro',
          icon: DollarSign,
          roles: ADMIN_ONLY,
        },
        {
          name: 'Caixa',
          path: '/financeiro/caixa',
          icon: Wallet,
          roles: ADMIN_ONLY,
        },
        {
          name: 'Contas a Receber',
          path: '/financeiro/contas-receber',
          icon: DollarSign,
          roles: ADMIN_ONLY,
        },
        {
          name: 'Relatório Financeiro',
          path: '/financeiro/relatorio',
          icon: FileText,
          roles: ADMIN_ONLY,
        },
        {
          name: 'Relatório de Recebimentos',
          path: '/financeiro/relatorio-recebimentos',
          icon: FileText,
          roles: ALL_ROLES,
        },
        {
          name: 'Biblioteca de Procedimentos',
          path: '/configuracoes/procedimentos',
          icon: ListChecks,
          roles: ALL_ROLES,
        },
        {
          name: 'Despesas',
          path: '/financeiro/despesas',
          icon: ArrowDownCircle,
          roles: ADMIN_ONLY,
        },
        {
          name: 'Notas Fiscais',
          path: '/financeiro/notas-fiscais',
          icon: FileText,
          roles: ALL_ROLES,
        },
        {
          name: 'Inadimplentes',
          path: '/financeiro/inadimplentes',
          icon: TrendingDown,
          roles: ADMIN_ONLY,
        },
        {
          name: 'Fluxo Projetado',
          path: '/financeiro/fluxo-projetado',
          icon: CalendarRange,
          roles: ADMIN_ONLY,
        },
        {
          name: 'Estoque',
          path: '/estoque',
          icon: Package,
          roles: ADMIN_ONLY,
        },
        {
          name: 'Relatórios',
          path: '/relatorios',
          icon: BarChart3,
          roles: ['admin', 'profissional'],
          children: [
            {
              name: 'Comissões B2B',
              path: '/relatorios/comissoes-b2b',
              icon: PieChart,
              roles: ADMIN_ONLY,
            },
            {
              name: 'Faturamento',
              path: '/relatorios/faturamento',
              icon: DollarSign,
              roles: ADMIN_ONLY,
            },
            {
              name: 'Produção por Profissional',
              path: '/relatorios/producao',
              icon: BarChart3,
              roles: ['admin', 'profissional'],
            },
            {
              name: 'Taxa de Conversão',
              path: '/relatorios/conversao',
              icon: Target,
              roles: ADMIN_ONLY,
            },
            {
              name: 'No-Show / Faltas',
              path: '/relatorios/no-show',
              icon: CalendarX,
              roles: ADMIN_ONLY,
            },
            {
              name: 'Pacientes Novos vs. Retornos',
              path: '/relatorios/pacientes-fluxo',
              icon: UserPlus,
              roles: ADMIN_ONLY,
            },
            {
              name: 'Estoque Baixo',
              path: '/relatorios/estoque-baixo',
              icon: Package,
              roles: ADMIN_ONLY,
            },
            {
              name: 'Garantias Vencendo',
              path: '/relatorios/garantias',
              icon: Shield,
              roles: ADMIN_ONLY,
            },
          ],
        },
        {
          name: 'Configurações',
          path: '/configuracoes',
          icon: SlidersHorizontal,
          roles: ADMIN_ONLY,
          children: [
            {
              name: 'Geral',
              path: '/configuracoes',
              icon: SlidersHorizontal,
              exact: true,
              roles: ADMIN_ONLY,
            },
            {
              name: 'Editor de IA',
              path: '/configuracoes/ia',
              icon: Brain,
              roles: ADMIN_ONLY,
            },
          ],
        },
        {
          name: 'Auditoria',
          path: '/admin/auditoria',
          icon: ShieldCheck,
          roles: ADMIN_ONLY,
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
          roles: ALL_ROLES,
        },
        {
          name: 'Alterar Senha',
          path: '/alterar-senha',
          icon: KeyRound,
          roles: ALL_ROLES,
        },
        {
          name: 'Usuários',
          path: '/usuarios',
          icon: UserCog,
          roles: ADMIN_ONLY,
        },
        {
          name: 'Procedimentos',
          path: '/configuracoes/procedimentos',
          icon: ListChecks,
          roles: ALL_ROLES,
        },
      ],
    },
  ]

  // Item visível quando não define `roles` (todos) ou quando o role do
  // usuário atual está listado em `roles`.
  const itemAllowed = (item: NavItem) =>
    !item.roles || (currentUser?.role ? item.roles.includes(currentUser.role) : false)

  const navigationGroups = allNavigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(itemAllowed).map((item) =>
        item.children
          ? {
              ...item,
              children: item.children.filter(itemAllowed),
            }
          : item,
      ),
    }))
    .filter((group) => group.items.length > 0)

  // ---------- Navegação do painel SaaS (Super Admin) ----------
  const saasNavItems: NavItem[] = [
    { name: 'Dashboard', path: '/saas', icon: LayoutDashboard, exact: true },
    { name: 'Clínicas', path: '/saas/clinicas', icon: Building2 },
    { name: 'Planos', path: '/saas/planos', icon: Package },
    { name: 'Pagamentos', path: '/saas/pagamentos', icon: CreditCard },
  ]

  const isCurrentActive = (path: string, exact = false) => {
    if (exact) return location.pathname === path
    return location.pathname.startsWith(path)
  }

  // Renderiza um item de menu, com suporte a submenu expansível (children)
  const renderNavItem = (item: NavItem, { mobile }: { mobile: boolean }) => {
    const active = isCurrentActive(item.path, item.exact)
    const Icon = item.icon

    // Item com submenu
    if (item.children && item.children.length > 0) {
      const parentActive = location.pathname.startsWith(item.path)
      const open = openMenus[item.path] || parentActive
      return (
        <div key={item.path}>
          <button
            onClick={() => setOpenMenus((prev) => ({ ...prev, [item.path]: !prev[item.path] }))}
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 relative w-full text-left ${
              parentActive
                ? 'bg-white/10 text-white font-semibold shadow-sm'
                : 'text-slate-300/80 hover:bg-white/5 hover:text-white'
            }`}
          >
            {parentActive && (
              <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-teal-500 rounded-r-full" />
            )}
            <Icon
              className={`w-4 h-4 shrink-0 ${parentActive ? 'text-teal-300' : 'text-slate-300/70'}`}
            />
            <span className="flex-1">{item.name}</span>
            <ChevronDown
              className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            />
          </button>
          {open && (
            <div className="mt-0.5 ml-3 pl-3 border-l border-white/10 space-y-0.5">
              {item.children.map((child) => {
                const cActive =
                  isCurrentActive(child.path, true) || location.pathname === child.path
                const CIcon = child.icon
                return (
                  <Link
                    key={child.path}
                    to={child.path}
                    onClick={() => mobile && setMobileMenuOpen(false)}
                    className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] transition-all ${
                      cActive
                        ? 'bg-teal-500/15 text-teal-200 font-semibold'
                        : 'text-slate-300/70 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <CIcon className="w-3.5 h-3.5 shrink-0" />
                    <span>{child.name}</span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      )
    }

    // Item simples
    return (
      <Link
        key={item.path}
        to={item.path}
        onClick={() => mobile && setMobileMenuOpen(false)}
        className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 relative ${
          active
            ? 'bg-white/10 text-white font-semibold shadow-sm'
            : 'text-slate-300/80 hover:bg-white/5 hover:text-white'
        }`}
      >
        {active && (
          <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-teal-500 rounded-r-full" />
        )}
        <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-teal-300' : 'text-slate-300/70'}`} />
        <span>{item.name}</span>
      </Link>
    )
  }

  // Renderiza a navegação SaaS (modo Super Admin).
  const renderSaasNav = ({ mobile }: { mobile: boolean }) => (
    <div className="space-y-1">{saasNavItems.map((item) => renderNavItem(item, { mobile }))}</div>
  )

  // Bloco do toggle de modos (Super Admin). Visível apenas para o dono do SaaS.
  const renderSaasToggle = ({ mobile }: { mobile: boolean }) => {
    if (!isSuperAdmin) return null
    return (
      <div className={`px-3 ${mobile ? 'py-3' : 'py-2'}`}>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-200/80">
                  Modo de Gestão
                </span>
              </div>
              <p className="text-[12px] font-semibold text-white mt-1 truncate">
                {saasMode ? '👑 Gestão SaaS' : '🏥 Minha Clínica'}
              </p>
              <p className="text-[10px] text-slate-300/60 truncate">
                {saasMode ? 'Painel do Super Admin' : 'Dados da clínica atual'}
              </p>
            </div>
            <Switch
              checked={saasMode}
              onCheckedChange={toggleSaasMode}
              aria-label="Alternar modo Super Admin"
            />
          </div>
        </div>
      </div>
    )
  }

  // Bloco "Voltar para Minha Clínica" no rodapé (modo SaaS).
  const renderBackToClinic = ({ mobile }: { mobile: boolean }) => {
    if (!saasMode) return null
    return (
      <div className="px-3 pb-2">
        <button
          onClick={() => {
            toggleSaasMode(false)
            if (mobile) setMobileMenuOpen(false)
          }}
          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-sm font-medium text-slate-300/80 hover:bg-white/5 hover:text-white transition-all"
        >
          <CornerUpLeft className="w-4 h-4 shrink-0 text-teal-300" />
          <span>Voltar para Minha Clínica</span>
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* SIDEBAR DESKTOP (Fixa 260px) — `transform-none` anula qualquer acidente
          de stacking que desfaria o `fixed` e faria a sidebar rolar com a página. */}
      <aside className="hidden lg:flex flex-col fixed top-0 left-0 bottom-0 w-[260px] bg-navy-700 text-white z-40 border-r border-navy-900/40 shadow-xl select-none transform-none">
        {/* Topo / Logo */}
        <div className="h-20 px-4 flex items-center justify-center border-b border-white/10 bg-white overflow-hidden">
          <Link
            to="/"
            className="flex items-center justify-center w-full h-full py-2"
            title={isAppSubdomain() ? 'Painel Audição360' : 'Voltar para Landing Page'}
          >
            <img
              src={logoImg}
              alt="Audição360 Centro Auditivo"
              className="max-h-full max-w-full object-contain mx-auto"
            />
          </Link>
        </div>

        {/* Menu agrupado */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {saasMode ? (
            <>
              <div className="space-y-1">
                <span className="px-3 text-[11px] font-bold uppercase tracking-wider text-amber-300/70 block">
                  Gestão SaaS
                </span>
                {renderSaasNav({ mobile: false })}
              </div>
              {renderBackToClinic({ mobile: false })}
            </>
          ) : (
            <>
              {navigationGroups.map((group) => (
                <div key={group.groupTitle} className="space-y-1">
                  <span className="px-3 text-[11px] font-bold uppercase tracking-wider text-teal-300/60 block">
                    {group.groupTitle}
                  </span>
                  {group.items.map((item) => renderNavItem(item, { mobile: false }))}
                </div>
              ))}
              {renderSaasToggle({ mobile: false })}
            </>
          )}
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
              {saasMode ? (
                <>
                  <div className="space-y-1">
                    <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-amber-300/70 block">
                      Gestão SaaS
                    </span>
                    {renderSaasNav({ mobile: true })}
                  </div>
                  {renderBackToClinic({ mobile: true })}
                </>
              ) : (
                <>
                  {navigationGroups.map((group) => (
                    <div key={group.groupTitle} className="space-y-1">
                      <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-teal-300/60 block">
                        {group.groupTitle}
                      </span>
                      {group.items.map((item) => renderNavItem(item, { mobile: true }))}
                    </div>
                  ))}
                  {renderSaasToggle({ mobile: true })}
                </>
              )}
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
      <div className="no-print lg:hidden sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
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
        <div className="flex items-center gap-1">
          {/* Badge de mensagens não lidas */}
          <Link
            to="/mensagens"
            className="relative p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            aria-label="Mensagens"
            title="Mensagens"
          >
            <MessagesSquare className="w-5 h-5" />
            {unreadMessagesCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
                {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* BADGE DE MENSAGENS NO TOPO (desktop) — flutua no canto superior direito */}
      <Link
        to="/mensagens"
        className="no-print hidden lg:flex fixed top-4 right-6 z-30 items-center justify-center w-11 h-11 rounded-full bg-white border border-slate-200 shadow-sm text-slate-600 hover:text-teal-600 hover:border-teal-300 transition-colors"
        aria-label="Mensagens"
        title="Mensagens"
      >
        <MessagesSquare className="w-5 h-5" />
        {unreadMessagesCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-red-600 text-white text-[11px] font-bold flex items-center justify-center ring-2 ring-white">
            {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
          </span>
        )}
      </Link>

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

      {/* MODAL DE TIMEOUT DE SESSÃO */}
      <SessionTimeoutModal
        open={timeoutModalOpen}
        initialSeconds={securitySettings?.session_timeout_warning_seconds || 60}
        onContinue={handleSessionContinue}
        onExpire={handleSessionExpire}
      />

      {/* WIDGET DE CHAT FLUTUANTE (canto inferior direito) */}
      <div className="no-print">
        <ChatWidget />
      </div>
    </div>
  )
}

export default Layout
