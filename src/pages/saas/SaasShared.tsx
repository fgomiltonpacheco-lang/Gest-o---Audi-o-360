import React from 'react'
import { Link } from 'react-router-dom'
import { Crown, LayoutDashboard, Building2, Package, CreditCard } from 'lucide-react'
import { useApp } from '@/context/AppContext'

/** Cabeçalho institucional das páginas do painel SaaS. */
export const SaasPageHeader: React.FC<{
  title: string
  description?: string
  actions?: React.ReactNode
}> = ({ title, description, actions }) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
    <div className="flex items-start gap-3">
      <div className="hidden sm:flex w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 items-center justify-center text-white shadow-md shrink-0">
        <Crown className="w-6 h-6" />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
        </div>
        {description && <p className="text-sm text-slate-500 mt-0.5">{description}</p>}
      </div>
    </div>
    {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
  </div>
)

/** Trilha de navegação SaaS. */
export const SaasBreadcrumbs: React.FC<{ items: { label: string; to?: string }[] }> = ({
  items,
}) => (
  <nav className="flex items-center gap-1.5 text-sm text-slate-500 flex-wrap">
    {items.map((item, i) => (
      <React.Fragment key={i}>
        {i > 0 && <span className="text-slate-300">/</span>}
        {item.to ? (
          <Link to={item.to} className="hover:text-amber-600 transition-colors">
            {item.label}
          </Link>
        ) : (
          <span className="text-slate-700 font-medium">{item.label}</span>
        )}
      </React.Fragment>
    ))}
  </nav>
)

/** Estado de carregamento padronizado. */
export const SaasLoading: React.FC<{ message?: string }> = ({
  message = 'Carregando dados do painel SaaS…',
}) => (
  <div className="flex flex-col items-center justify-center py-20 text-slate-400">
    <div className="w-10 h-10 border-3 border-slate-200 border-t-amber-500 rounded-full animate-spin mb-3" />
    <p className="text-sm">{message}</p>
  </div>
)

/** Estado vazio padronizado. */
export const SaasEmptyState: React.FC<{
  icon?: React.ElementType
  title: string
  description?: string
}> = ({ icon: Icon = Package, title, description }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
      <Icon className="w-7 h-7" />
    </div>
    <p className="text-slate-600 font-medium">{title}</p>
    {description && <p className="text-sm text-slate-400 mt-1 max-w-md">{description}</p>}
  </div>
)

/** Verifica se o usuário atual é Super Admin (hook de conveniência). */
export function useIsSuperAdmin(): boolean {
  const { currentUser } = useApp()
  return !!currentUser?.isSuperAdmin
}

/** Resumo de navegação rápida SaaS (cards). */
export const SaasQuickLinks: React.FC = () => {
  const links = [
    { to: '/saas', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/saas/clinicas', label: 'Clínicas', icon: Building2 },
    { to: '/saas/planos', label: 'Planos', icon: Package },
    { to: '/saas/pagamentos', label: 'Pagamentos', icon: CreditCard },
  ]
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {links.map((l) => {
        const Icon = l.icon
        return (
          <Link
            key={l.to}
            to={l.to}
            className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 bg-white hover:border-amber-300 hover:shadow-sm transition-all group"
          >
            <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
              <Icon className="w-5 h-5" />
            </div>
            <span className="text-sm font-semibold text-slate-700">{l.label}</span>
          </Link>
        )
      })}
    </div>
  )
}
