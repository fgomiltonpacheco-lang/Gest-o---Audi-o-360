import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Building2,
  TrendingUp,
  UserPlus,
  Crown,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  ArrowRight,
  CreditCard,
  Package,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  SaasPageHeader,
  SaasBreadcrumbs,
  SaasLoading,
  SaasQuickLinks,
} from '@/pages/saas/SaasShared'
import {
  fetchClinicas,
  fetchPagamentos,
  clinicaStatusLabel,
  clinicaStatusClass,
  calcularStats,
  diasAtraso,
  pagamentoStatusClass,
} from '@/pages/saas/shared'
import { Clinica, PagamentoSaaS } from '@/types'
import { formatCurrency } from '@/lib/formatters'

const fmtDate = (s?: string) => {
  if (!s) return '—'
  const [y, m, d] = s.split('-')
  if (!y || !m || !d) return s
  return `${d}/${m}/${y}`
}

export default function SaasDashboard() {
  const [clinicas, setClinicas] = useState<Clinica[]>([])
  const [pagamentos, setPagamentos] = useState<PagamentoSaaS[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        setErro('')
        const [c, p] = await Promise.all([fetchClinicas(), fetchPagamentos()])
        if (!mounted) return
        setClinicas(c)
        setPagamentos(p)
      } catch (e: any) {
        if (mounted) setErro(e?.message || 'Erro ao carregar dados do painel SaaS.')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <SaasPageHeader
          title="Painel SaaS"
          description="Visão geral do Audição360 como plataforma multi-clínicas."
        />
        <SaasLoading />
      </div>
    )
  }

  if (erro) {
    return (
      <div className="space-y-6">
        <SaasPageHeader title="Painel SaaS" />
        <Card>
          <CardContent className="py-10 text-center text-red-600">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
            {erro}
          </CardContent>
        </Card>
      </div>
    )
  }

  const stats = calcularStats(clinicas)
  const recentes = clinicas.slice(0, 5)
  const inadimplentes = pagamentos.filter((p) => diasAtraso(p.data_vencimento) >= 7)
  const pendentes = pagamentos.filter((p) => p.status === 'pendente')

  const metrics = [
    {
      label: 'Total de Clínicas',
      value: stats.total_clinicas,
      icon: Building2,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Clínicas Ativas',
      value: stats.ativas,
      icon: CheckCircle2,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      sub: `${stats.trial} em trial`,
    },
    {
      label: 'Receita Mensal Projetada',
      value: formatCurrency(stats.receita_mensal),
      icon: TrendingUp,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: 'Novas nos últimos 30 dias',
      value: stats.novas_30dias,
      icon: UserPlus,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      label: 'Inadimplentes',
      value: stats.inadimplentes,
      icon: AlertTriangle,
      color: 'text-red-600',
      bg: 'bg-red-50',
    },
    {
      label: 'Canceladas',
      value: stats.canceladas,
      icon: XCircle,
      color: 'text-slate-500',
      bg: 'bg-slate-100',
    },
  ]

  // Barras de status para mini gráfico
  const statusBars = [
    {
      label: 'Ativas',
      count: stats.ativas,
      color: 'bg-emerald-500',
      textColor: 'text-emerald-700',
    },
    { label: 'Trial', count: stats.trial, color: 'bg-blue-500', textColor: 'text-blue-700' },
    {
      label: 'Inadimplentes',
      count: stats.inadimplentes,
      color: 'bg-red-500',
      textColor: 'text-red-700',
    },
    {
      label: 'Canceladas',
      count: stats.canceladas,
      color: 'bg-slate-400',
      textColor: 'text-slate-600',
    },
  ]
  const maxBar = Math.max(1, ...statusBars.map((s) => s.count))

  return (
    <div className="space-y-6">
      <SaasBreadcrumbs items={[{ label: 'Gestão SaaS' }, { label: 'Dashboard' }]} />
      <SaasPageHeader
        title="Painel SaaS"
        description="Visão geral do Audição360 como plataforma multi-clínicas."
        actions={
          <Link to="/saas/clinicas">
            <Button variant="default" className="bg-amber-600 hover:bg-amber-700">
              <Building2 className="w-4 h-4" />
              Gerenciar Clínicas
            </Button>
          </Link>
        }
      />

      <SaasQuickLinks />

      {/* Métricas principais */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {metrics.map((m) => {
          const Icon = m.icon
          return (
            <Card key={m.label} className="border-slate-200 shadow-sm">
              <CardContent className="p-4">
                <div
                  className={`w-9 h-9 rounded-lg ${m.bg} ${m.color} flex items-center justify-center mb-2.5`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  {m.label}
                </p>
                <p className="text-2xl font-bold text-slate-800 mt-0.5 leading-tight">{m.value}</p>
                {m.sub && <p className="text-[11px] text-slate-400 mt-0.5">{m.sub}</p>}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Distribuição por status */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-slate-700">
              Distribuição por Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {statusBars.map((s) => (
              <div key={s.label}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className={`font-medium ${s.textColor}`}>{s.label}</span>
                  <span className="font-bold text-slate-700">{s.count}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full ${s.color} rounded-full transition-all`}
                    style={{ width: `${(s.count / maxBar) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Total</span>
              <span className="font-bold text-slate-800">{stats.total_clinicas}</span>
            </div>
          </CardContent>
        </Card>

        {/* Clínicas recentes */}
        <Card className="border-slate-200 shadow-sm lg:col-span-2">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold text-slate-700">
              Clínicas Recentes
            </CardTitle>
            <Link
              to="/saas/clinicas"
              className="text-xs font-medium text-amber-600 hover:text-amber-700 flex items-center gap-1"
            >
              Ver todas <ArrowRight className="w-3 h-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {recentes.length === 0 ? (
              <p className="text-center text-slate-400 py-8 text-sm">Nenhuma clínica cadastrada.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Clínica</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="pr-6 text-right">Cadastro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentes.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="pl-6 font-medium text-slate-800">{c.nome}</TableCell>
                      <TableCell className="text-slate-600">
                        {c.plano_nome || '—'}
                        {c.plano_preco ? (
                          <span className="text-slate-400 ml-1">
                            ({formatCurrency(c.plano_preco)}/mês)
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`border ${clinicaStatusClass(c.status)}`}
                        >
                          {clinicaStatusLabel(c.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="pr-6 text-right text-slate-500 text-sm">
                        {fmtDate(c.created)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Status de Pagamentos */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-amber-600" />
            Status de Pagamentos
          </CardTitle>
          <Link
            to="/saas/pagamentos"
            className="text-xs font-medium text-amber-600 hover:text-amber-700 flex items-center gap-1"
          >
            Ver todos <ArrowRight className="w-3 h-3" />
          </Link>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-semibold text-emerald-700">Pagos</span>
            </div>
            <p className="text-2xl font-bold text-emerald-700">
              {pagamentos.filter((p) => p.status === 'pago').length}
            </p>
            <p className="text-xs text-emerald-600/70 mt-1">mensalidades quitadas</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-semibold text-amber-700">Pendentes</span>
            </div>
            <p className="text-2xl font-bold text-amber-700">{pendentes.length}</p>
            <p className="text-xs text-amber-600/70 mt-1">aguardando pagamento</p>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50/50 p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span className="text-sm font-semibold text-red-700">Inadimplentes (7+ dias)</span>
            </div>
            <p className="text-2xl font-bold text-red-700">{inadimplentes.length}</p>
            <p className="text-xs text-red-600/70 mt-1">em atraso crítico</p>
          </div>
        </CardContent>
      </Card>

      {/* Atalhos para gestão */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          to="/saas/planos"
          className="flex items-center gap-4 p-5 rounded-xl border border-slate-200 bg-white hover:border-amber-300 hover:shadow-md transition-all group"
        >
          <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
            <Package className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-slate-800">Gerenciar Planos</p>
            <p className="text-sm text-slate-500">
              Configure preços, funcionalidades e limites dos planos.
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-amber-500 transition-colors" />
        </Link>
        <Link
          to="/saas/pagamentos"
          className="flex items-center gap-4 p-5 rounded-xl border border-slate-200 bg-white hover:border-amber-300 hover:shadow-md transition-all group"
        >
          <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
            <CreditCard className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-slate-800">Registrar Pagamentos</p>
            <p className="text-sm text-slate-500">
              Controle mensalidades e acompanhe inadimplência.
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-amber-500 transition-colors" />
        </Link>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 flex items-center gap-3">
        <Crown className="w-5 h-5 text-amber-600 shrink-0" />
        <p className="text-sm text-amber-800">
          Você está no <strong>modo Gestão SaaS</strong>. Os dados exibidos refletem todas as
          clínicas cadastradas na plataforma Audição360. Para voltar aos dados da sua clínica,
          desative o toggle no menu lateral.
        </p>
      </div>
    </div>
  )
}
