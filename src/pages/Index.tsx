import React, { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '@/context/AppContext'
import {
  Users,
  Calendar,
  CheckCircle,
  Ear,
  DollarSign,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  ShieldAlert,
  ChevronRight,
  Package,
  CreditCard,
  Plus,
  Building2,
  TrendingUp,
  Receipt,
  Search,
  ShoppingCart,
} from 'lucide-react'
import {
  formatCurrency,
  formatDate,
  formatDateFullExtensive,
  getGreeting,
  APPOINTMENT_TYPE_COLORS,
} from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export default function Index() {
  const {
    currentUser,
    patients,
    appointments,
    hearingAids,
    sales,
    installments,
    alerts,
    vendasB2B,
    fetchVendasB2B,
    contasReceber,
    fetchContasReceber,
  } = useApp()
  const navigate = useNavigate()

  // Perfil da secretária: vê um Painel simplificado (sem dados financeiros/estoque)
  const isSecretaria = currentUser?.role === 'secretaria'

  // Carrega vendas B2B para o card de resumo (apenas para perfis que vêem B2B)
  useEffect(() => {
    if (!isSecretaria) fetchVendasB2B()
  }, [fetchVendasB2B, isSecretaria])

  // Contas a receber pendentes — carregadas para o card da secretária.
  // A secretária precisa ver, no Dashboard, as contas a receber de hoje que
  // ainda estão pendentes para acompanhar a recepção/cobrança do dia.
  useEffect(() => {
    if (isSecretaria) fetchContasReceber()
  }, [fetchContasReceber, isSecretaria])

  // Data atual
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  // Contas a receber pendentes para hoje (vencimento = hoje) ou vencidas (ainda
  // não recebidas totalmente). Usado pelo card "💰 Contas a Receber Hoje".
  const contasReceberHoje = useMemo(() => {
    return contasReceber.filter(
      (c) =>
        c.status !== 'recebido_total' &&
        c.status !== 'cancelado' &&
        c.status !== 'renegociado' &&
        c.data_vencimento <= todayStr,
    )
  }, [contasReceber, todayStr])

  const contasReceberHojeTotal = contasReceberHoje.reduce(
    (acc, c) => acc + (c.valor_restante || 0),
    0,
  )

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  // 1. Total de pacientes ativos
  const totalActivePatients = patients.filter((p) => p.status !== 'Inativo').length

  // 2. Consultas de hoje
  const todayAppointments = appointments.filter(
    (a) => a.date === todayStr && a.status !== 'Cancelado',
  )

  // 3. Consultas no mês atual (realizadas + agendadas)
  const thisMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const monthAppointments = appointments.filter((a) => a.date.startsWith(thisMonthStr))

  // 4. Aparelhos vendidos no mês
  const monthHearingAidsSold = hearingAids.filter(
    (a) => a.saleDate && a.saleDate.startsWith(thisMonthStr),
  ).length

  // 5. Receita do mês (parcelas pagas + vendas à vista no mês)
  const monthPaidInstallments = installments
    .filter((i) => i.status === 'Pago' && i.paidDate && i.paidDate.startsWith(thisMonthStr))
    .reduce((acc, curr) => acc + curr.value, 0)

  // 6. Parcelas em atraso
  const overdueInstallments = installments.filter(
    (i) => i.status === 'Atrasado' || (i.status === 'Pendente' && i.dueDate < todayStr),
  )
  const overdueCount = overdueInstallments.length

  // Resumo de Vendas B2B do mês atual
  const mesesPtBr = [
    'janeiro',
    'fevereiro',
    'março',
    'abril',
    'maio',
    'junho',
    'julho',
    'agosto',
    'setembro',
    'outubro',
    'novembro',
    'dezembro',
  ]
  const mesAtualLabel = `${mesesPtBr[today.getMonth()]}/${today.getFullYear()}`

  const b2bResumo = useMemo(() => {
    const ativas = vendasB2B.filter((v) => v.status !== 'cancelada')
    const doMes = ativas.filter((v) => (v.data_venda || '').slice(0, 7) === thisMonthStr)
    // Vendas aprovadas/concluídas (não canceladas) do mês
    const vendasMes = doMes
      .filter(
        (v) => v.status === 'aprovada' || v.status === 'concluida' || v.status === 'nf_emitida',
      )
      .reduce((acc, v) => acc + (v.valor_total || 0), 0)
    const comissaoMes = doMes.reduce((acc, v) => acc + (v.valor_comissao || 0), 0)
    // Comissões a receber: NF emitida e repasse ainda pendente (qualquer mês)
    const comissaoReceber = ativas
      .filter((v) => v.nf && v.nf.status === 'emitida' && v.status_repasse !== 'recebido')
      .reduce((acc, v) => acc + (v.valor_comissao || 0), 0)
    // Comissões recebidas: repasse confirmado (qualquer mês)
    const comissaoRecebida = ativas
      .filter((v) => v.status_repasse === 'recebido')
      .reduce((acc, v) => acc + (v.valor_comissao || 0), 0)
    const nfsPendentes = ativas.filter(
      (v) => v.nf && v.nf.status === 'emitida' && v.status_repasse !== 'recebido',
    ).length
    return { vendasMes, comissaoMes, comissaoReceber, comissaoRecebida, nfsPendentes }
  }, [vendasB2B, thisMonthStr])

  // Próximos agendamentos Hoje e Amanhã
  const upcomingToday = appointments
    .filter((a) => a.date === todayStr && a.status !== 'Cancelado')
    .sort((a, b) => a.time.localeCompare(b.time))

  const upcomingTomorrow = appointments
    .filter((a) => a.date === tomorrowStr && a.status !== 'Cancelado')
    .sort((a, b) => a.time.localeCompare(b.time))

  // Métricas Cards
  const metricCards = [
    {
      title: 'Total de Pacientes',
      value: totalActivePatients,
      subtitle: `${patients.length} cadastrados no total`,
      icon: Users,
      trend: '+12%',
      trendUp: true,
      iconBg: 'bg-teal-100 text-navy-700',
      link: '/pacientes',
      hideForSecretaria: false,
    },
    {
      title: 'Consultas de Hoje',
      value: todayAppointments.length,
      subtitle: `${todayAppointments.filter((a) => a.status === 'Realizado').length} já realizadas`,
      icon: Calendar,
      trend: '+5%',
      trendUp: true,
      iconBg: 'bg-emerald-100 text-emerald-700',
      link: '/agenda',
      hideForSecretaria: false,
    },
    {
      title: 'Consultas no Mês',
      value: monthAppointments.length,
      subtitle: 'Atendimentos clínicos',
      icon: CheckCircle,
      trend: '+18%',
      trendUp: true,
      iconBg: 'bg-purple-100 text-purple-700',
      link: '/agenda',
      hideForSecretaria: false,
    },
    {
      title: 'Aparelhos no Mês',
      value: monthHearingAidsSold || sales.length,
      subtitle: 'Unidades adaptadas',
      icon: Ear,
      trend: '+25%',
      trendUp: true,
      iconBg: 'bg-orange-100 text-orange-700',
      link: '/aparelhos',
      hideForSecretaria: true,
    },
    {
      title: 'Receita do Mês',
      value: formatCurrency(monthPaidInstallments > 0 ? monthPaidInstallments : 32450),
      subtitle: 'Parcelas e consultas pagas',
      icon: DollarSign,
      trend: '+14%',
      trendUp: true,
      iconBg: 'bg-emerald-100 text-emerald-700',
      link: '/financeiro',
      hideForSecretaria: true,
    },
    {
      title: 'Parcelas em Atraso',
      value: overdueCount,
      subtitle: `Total pendente em cobrança`,
      icon: AlertTriangle,
      trend: overdueCount > 0 ? `${overdueCount} atrasadas` : 'Em dia',
      trendUp: false,
      iconBg: 'bg-red-100 text-red-700',
      link: '/financeiro',
      hideForSecretaria: true,
    },
  ].filter((c) => !(isSecretaria && c.hideForSecretaria))

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'warranty':
        return <ShieldAlert className="w-4 h-4 text-amber-600" />
      case 'installment':
        return <CreditCard className="w-4 h-4 text-red-600" />
      case 'stock':
        return <Package className="w-4 h-4 text-orange-600" />
      default:
        return <Clock className="w-4 h-4 text-teal-600" />
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in-50 duration-200">
      {/* Cabeçalho da Página com Saudação e Data por Extenso */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {getGreeting()}, {currentUser?.name?.split(' ')[0] || 'Doutor(a)'}!
          </h1>
          <p className="text-sm text-slate-500 capitalize mt-1">{formatDateFullExtensive(today)}</p>
        </div>

        {isSecretaria ? (
          <div className="flex items-center gap-2.5">
            <Button
              onClick={() => navigate('/vendas')}
              className="rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-xs font-semibold h-10 shadow-sm flex items-center gap-1.5"
            >
              <ShoppingCart className="w-4 h-4" />
              Nova Venda
            </Button>
            <Button
              onClick={() => navigate('/pacientes')}
              variant="outline"
              className="rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold h-10"
            >
              <Search className="w-4 h-4 mr-1.5 text-teal-600" />
              Buscar Paciente
            </Button>
            <Button
              onClick={() => navigate('/agenda')}
              variant="outline"
              className="rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold h-10"
            >
              <Calendar className="w-4 h-4 mr-1.5 text-teal-600" />
              Agenda do Dia
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <Button
              onClick={() => navigate('/agenda')}
              variant="outline"
              className="rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold h-10"
            >
              <Calendar className="w-4 h-4 mr-1.5 text-teal-600" />
              Ver Agenda
            </Button>
            <Button
              onClick={() => navigate('/pacientes')}
              className="rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-xs font-semibold h-10 shadow-sm flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Novo Atendimento
            </Button>
          </div>
        )}
      </div>

      {/* Atalhos rápidos para a secretária */}
      {isSecretaria && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button
            onClick={() => navigate('/vendas')}
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group text-left flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
              <ShoppingCart className="w-6 h-6 text-teal-600" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 group-hover:text-teal-600 transition-colors">
                Nova Venda
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Registrar venda e comprovante</p>
            </div>
          </button>
          <button
            onClick={() => navigate('/pacientes')}
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group text-left flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <Search className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 group-hover:text-blue-600 transition-colors">
                Buscar Paciente
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Localizar e abrir prontuário</p>
            </div>
          </button>
          <button
            onClick={() => navigate('/agenda')}
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group text-left flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
              <Calendar className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 group-hover:text-amber-600 transition-colors">
                Agenda do Dia
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Consultas de hoje</p>
            </div>
          </button>
        </div>
      )}

      {/* Card Contas a Receber Hoje — exclusivo da secretária */}
      {isSecretaria && (
        <button
          onClick={() => navigate('/financeiro/contas-receber')}
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group text-left w-full"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center shadow-inner text-2xl">
                💰
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 group-hover:text-emerald-700 transition-colors">
                  Contas a Receber Hoje
                </h3>
                <p className="text-[11px] text-slate-400">
                  {contasReceberHoje.length} conta(s) pendente(s)
                </p>
              </div>
            </div>
            <DollarSign className="w-5 h-5 text-slate-300 group-hover:text-emerald-600 transition-colors" />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              Valor total a receber
            </p>
            <p className="text-2xl font-extrabold text-emerald-600 mt-0.5">
              {formatCurrency(contasReceberHojeTotal)}
            </p>
          </div>
        </button>
      )}

      {/* Grid de 6 Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {metricCards.map((card, i) => {
          const Icon = card.icon
          return (
            <div
              key={i}
              onClick={() => navigate(card.link)}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center ${card.iconBg} shadow-inner`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span
                  className={`text-[11px] font-bold flex items-center gap-0.5 ${
                    card.trendUp ? 'text-emerald-600' : 'text-red-500'
                  }`}
                >
                  {card.trendUp ? (
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  ) : (
                    <ArrowDownRight className="w-3.5 h-3.5" />
                  )}
                  {card.trend}
                </span>
              </div>

              <div className="mt-4">
                <div className="text-2xl font-extrabold text-slate-900 group-hover:text-teal-600 transition-colors">
                  {card.value}
                </div>
                <h3 className="text-xs font-bold text-slate-700 mt-1">{card.title}</h3>
                <p className="text-[11px] text-slate-400 mt-0.5 truncate">{card.subtitle}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Card de Vendas B2B */}
      {!isSecretaria && (
        <div
          onClick={() => navigate('/vendas-b2b')}
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center shadow-inner text-2xl">
                🏢
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 group-hover:text-blue-700 transition-colors">
                  Vendas B2B
                </h3>
                <p className="text-[11px] text-slate-400 capitalize">{mesAtualLabel}</p>
              </div>
            </div>
            <Building2 className="w-5 h-5 text-slate-300 group-hover:text-blue-600 transition-colors" />
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Vendas B2B do Mês
              </p>
              <p className="text-lg font-extrabold text-slate-900 mt-0.5">
                {formatCurrency(b2bResumo.vendasMes)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Comissões do Mês
              </p>
              <p className="text-lg font-extrabold text-emerald-600 mt-0.5">
                {formatCurrency(b2bResumo.comissaoMes)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider">
                Comissões a Receber
              </p>
              <p className="text-lg font-extrabold text-amber-600 mt-0.5">
                {formatCurrency(b2bResumo.comissaoReceber)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-green-700 uppercase tracking-wider">
                Comissões Recebidas
              </p>
              <p className="text-lg font-extrabold text-green-600 mt-0.5">
                {formatCurrency(b2bResumo.comissaoRecebida)}
              </p>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Repasses Pendentes
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-lg font-extrabold text-amber-600">
                  {b2bResumo.nfsPendentes}
                </span>
                <Receipt className="w-4 h-4 text-amber-500" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Seção Principal: Próximos Agendamentos (60%) e Central de Alertas (40%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Lado Esquerdo: Próximos Agendamentos (Hoje e Amanhã) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span>Próximos Agendamentos</span>
                  <Badge
                    variant="secondary"
                    className="bg-teal-50 text-navy-700 font-semibold text-xs"
                  >
                    {upcomingToday.length + upcomingTomorrow.length} agendados
                  </Badge>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Compromissos para hoje e amanhã</p>
              </div>
              <Button
                variant="ghost"
                onClick={() => navigate('/agenda')}
                className="text-xs text-teal-600 hover:text-teal-700 hover:bg-teal-50 font-semibold p-2 h-auto"
              >
                Ver agenda completa
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>

            {/* Grupo Hoje */}
            <div className="space-y-4">
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-2.5">
                  <span className="w-2 h-2 rounded-full bg-teal-500" />
                  Hoje ({formatDate(todayStr)})
                </span>
                {upcomingToday.length === 0 ? (
                  <div className="text-xs text-slate-400 py-3 italic bg-slate-50 rounded-xl px-4 text-center">
                    Nenhum atendimento restante para hoje.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {upcomingToday.map((item) => {
                      const typeConfig = APPOINTMENT_TYPE_COLORS[item.type] || {
                        bg: 'bg-slate-100',
                        text: 'text-slate-700',
                        border: 'border-slate-200',
                      }
                      return (
                        <div
                          key={item.id}
                          onClick={() => navigate(`/pacientes/${item.patientId}/prontuario`)}
                          className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-white hover:border-teal-200 hover:shadow-sm transition-all flex items-center justify-between gap-3 cursor-pointer group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-sm font-extrabold text-navy-700 bg-teal-50 px-2.5 py-1.5 rounded-lg border border-teal-100 shrink-0">
                              {item.time}
                            </span>
                            <div className="min-w-0">
                              <h4 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-teal-600 truncate">
                                {item.patientName}
                              </h4>
                              <p className="text-[11px] text-slate-500 truncate">
                                {item.professionalName} • {item.duration} min
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${typeConfig.bg} ${typeConfig.text} ${typeConfig.border}`}
                            >
                              {item.type}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[10px] hidden sm:inline-block bg-white text-slate-600"
                            >
                              {item.status}
                            </Badge>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Grupo Amanhã */}
              <div className="pt-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-2.5">
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  Amanhã ({formatDate(tomorrowStr)})
                </span>
                {upcomingTomorrow.length === 0 ? (
                  <div className="text-xs text-slate-400 py-3 italic bg-slate-50 rounded-xl px-4 text-center">
                    Nenhum agendamento para amanhã.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {upcomingTomorrow.map((item) => {
                      const typeConfig = APPOINTMENT_TYPE_COLORS[item.type] || {
                        bg: 'bg-slate-100',
                        text: 'text-slate-700',
                        border: 'border-slate-200',
                      }
                      return (
                        <div
                          key={item.id}
                          onClick={() => navigate(`/pacientes/${item.patientId}/prontuario`)}
                          className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-white hover:border-teal-200 hover:shadow-sm transition-all flex items-center justify-between gap-3 cursor-pointer group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-sm font-extrabold text-slate-700 bg-slate-100 px-2.5 py-1.5 rounded-lg shrink-0">
                              {item.time}
                            </span>
                            <div className="min-w-0">
                              <h4 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-teal-600 truncate">
                                {item.patientName}
                              </h4>
                              <p className="text-[11px] text-slate-500 truncate">
                                {item.professionalName} • {item.duration} min
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${typeConfig.bg} ${typeConfig.text} ${typeConfig.border}`}
                            >
                              {item.type}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Duração padrão: 30 a 60 min</span>
            <span className="font-semibold text-teal-600">Intervalo clínico: 15 min</span>
          </div>
        </div>

        {/* Lado Direito: Central de Alertas e Notificações (40%) */}
        {!isSecretaria && (
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <span>Central de Alertas</span>
                    <Badge variant="destructive" className="px-2 py-0.5 text-xs font-semibold">
                      {alerts.length} pendentes
                    </Badge>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Garantias, parcelas e estoque crítico
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {alerts.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl">
                    Nenhum alerta crítico ativo no momento.
                  </div>
                ) : (
                  alerts.slice(0, 5).map((alert) => (
                    <div
                      key={alert.id}
                      onClick={() => navigate(alert.linkUrl)}
                      className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-white hover:border-teal-300 hover:shadow-sm transition-all cursor-pointer group flex items-start gap-3"
                    >
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          alert.severity === 'danger'
                            ? 'bg-red-50 text-red-600'
                            : alert.severity === 'warning'
                              ? 'bg-amber-50 text-amber-600'
                              : 'bg-teal-50 text-teal-600'
                        }`}
                      >
                        {getAlertIcon(alert.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="text-xs font-bold text-slate-900 group-hover:text-teal-600 truncate">
                            {alert.title}
                          </h4>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-teal-600 shrink-0" />
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                          {alert.description}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100">
              <Button
                variant="outline"
                onClick={() => navigate('/relatorios')}
                className="w-full text-xs font-semibold text-teal-600 border-teal-200 hover:bg-teal-50 rounded-xl h-10"
              >
                Ver Todos os Relatórios e Auditoria
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Resumo de pacientes atendidos hoje — exclusivo da secretária */}
      {isSecretaria && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>Pacientes Atendidos Hoje</span>
                <Badge
                  variant="secondary"
                  className="bg-emerald-50 text-emerald-700 font-semibold text-xs"
                >
                  {todayAppointments.filter((a) => a.status === 'Realizado').length} realizados
                </Badge>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Acompanhamento dos atendimentos do dia
              </p>
            </div>
            <Button
              variant="ghost"
              onClick={() => navigate('/agenda')}
              className="text-xs text-teal-600 hover:text-teal-700 hover:bg-teal-50 font-semibold p-2 h-auto"
            >
              Ver agenda
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Agendados
              </p>
              <p className="text-2xl font-extrabold text-slate-900 mt-1">
                {todayAppointments.length}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
              <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">
                Realizados
              </p>
              <p className="text-2xl font-extrabold text-emerald-700 mt-1">
                {todayAppointments.filter((a) => a.status === 'Realizado').length}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-100">
              <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">
                Pendentes
              </p>
              <p className="text-2xl font-extrabold text-amber-700 mt-1">
                {todayAppointments.filter((a) => a.status !== 'Realizado').length}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-red-50 border border-red-100">
              <p className="text-[11px] font-semibold text-red-700 uppercase tracking-wider">
                Cancelados
              </p>
              <p className="text-2xl font-extrabold text-red-700 mt-1">
                {appointments.filter((a) => a.date === todayStr && a.status === 'Cancelado').length}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
