import React, { useState, useMemo } from 'react'
import { useApp } from '@/context/AppContext'
import {
  BarChart3,
  Calendar,
  Download,
  Users,
  Ear,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  FileSpreadsheet,
  Layers,
  Clock,
  ShieldCheck,
  CheckCircle,
  Package,
  Printer,
} from 'lucide-react'
import { formatCurrency, formatDate, exportToCSV } from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { usePrint } from '@/components/print/PrintProvider'
import { RelatorioPrint } from '@/components/print/PrintDocuments'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts'

type PeriodShortcut = '7d' | '30d' | 'this_month' | 'last_month' | 'this_year'

const PIE_COLORS = [
  '#00A6A6', // Turquesa
  '#0F2B5C', // Navy
  '#10b981', // Verde
  '#8b5cf6', // Roxo
  '#ec4899', // Rosa
  '#f97316', // Laranja
  '#eab308', // Amarelo
  '#ef4444', // Vermelho
  '#14b8a6', // Teal
  '#6366f1', // Indigo
]

export default function Relatorios() {
  const { patients, appointments, hearingAids, sales, installments, stockItems, cashMovements } =
    useApp()
  const { print } = usePrint()

  const [period, setPeriod] = useState<PeriodShortcut>('this_month')
  const [startDate, setStartDate] = useState('2025-02-01')
  const [endDate, setEndDate] = useState('2025-02-28')

  const handlePeriodChange = (p: PeriodShortcut) => {
    setPeriod(p)
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]

    if (p === '7d') {
      const d = new Date()
      d.setDate(d.getDate() - 7)
      setStartDate(d.toISOString().split('T')[0])
      setEndDate(todayStr)
    } else if (p === '30d') {
      const d = new Date()
      d.setDate(d.getDate() - 30)
      setStartDate(d.toISOString().split('T')[0])
      setEndDate(todayStr)
    } else if (p === 'this_month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      setStartDate(firstDay.toISOString().split('T')[0])
      setEndDate(lastDay.toISOString().split('T')[0])
    } else if (p === 'last_month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const lastDay = new Date(today.getFullYear(), today.getMonth(), 0)
      setStartDate(firstDay.toISOString().split('T')[0])
      setEndDate(lastDay.toISOString().split('T')[0])
    } else if (p === 'this_year') {
      setStartDate(`${today.getFullYear()}-01-01`)
      setEndDate(`${today.getFullYear()}-12-31`)
    }
  }

  // 1. Pacientes novos por mês
  const patientsPerMonthData = useMemo(() => {
    const months = ['Set/24', 'Out/24', 'Nov/24', 'Dez/24', 'Jan/25', 'Fev/25']
    return [
      { mes: 'Set/24', novos: 4 },
      { mes: 'Out/24', novos: 3 },
      { mes: 'Nov/24', novos: 5 },
      { mes: 'Dez/24', novos: 4 },
      { mes: 'Jan/25', novos: 7 },
      { mes: 'Fev/25', novos: 6 },
    ]
  }, [])

  // 2. Atendimentos por Tipo (Rosca)
  const appointmentsByTypeData = useMemo(() => {
    const countMap: Record<string, number> = {}
    appointments.forEach((a) => {
      countMap[a.type] = (countMap[a.type] || 0) + 1
    })
    return Object.entries(countMap).map(([name, value]) => ({ name, value }))
  }, [appointments])

  // 3. Atendimentos por Profissional (Barras Horizontais)
  const appointmentsByProfData = useMemo(() => {
    const countMap: Record<string, number> = {}
    appointments.forEach((a) => {
      countMap[a.professionalName] = (countMap[a.professionalName] || 0) + 1
    })
    return Object.entries(countMap).map(([prof, count]) => ({
      profissional: prof.replace('Dra. ', '').replace('Dr. ', ''),
      atendimentos: count,
    }))
  }, [appointments])

  // 4. Faturamento por Tipo de Pagamento (Particular × SUS × Convênio)
  const billingByTypeData = useMemo(() => {
    const MONTH_ABBR = [
      'Jan',
      'Fev',
      'Mar',
      'Abr',
      'Mai',
      'Jun',
      'Jul',
      'Ago',
      'Set',
      'Out',
      'Nov',
      'Dez',
    ]

    // Normaliza o planType em uma das três chaves canônicas
    const normType = (t?: string | null): 'particular' | 'sus' | 'convenio' => {
      if (!t) return 'particular'
      const low = String(t).toLowerCase()
      if (low === 'sus') return 'sus'
      if (low.includes('conv')) return 'convenio'
      return 'particular'
    }

    // Filtra agendamentos pelo período selecionado (comparação YYYY-MM-DD)
    const periodAppts = appointments.filter((a) => a.date >= startDate && a.date <= endDate)

    // Totais do período (para os cards) + contagem de atendimentos por tipo
    const totals = {
      particular: 0,
      sus: 0,
      convenio: 0,
      particularCount: 0,
      susCount: 0,
      convenioCount: 0,
    }

    // Acumulado por mês (chave "Mes/AA")
    const byMonth: Record<string, { particular: number; sus: number; convenio: number }> = {}

    periodAppts.forEach((a) => {
      // contributions agrega valor por tipo de pagamento do atendimento
      const contributions: Record<string, number> = {}

      const items =
        Array.isArray(a.proceduresList) && a.proceduresList.length > 0 ? a.proceduresList : null

      if (items) {
        items.forEach((it) => {
          const key = normType(it.planType)
          contributions[key] = (contributions[key] || 0) + (Number(it.value) || 0)
        })
      } else {
        // Fallback: usa value + planType direto do agendamento
        const key = normType(a.planType)
        contributions[key] = (contributions[key] || 0) + (Number(a.value) || 0)
      }

      // Chave de mês a partir da data do agendamento
      const d = new Date(`${a.date}T00:00:00`)
      if (isNaN(d.getTime())) return
      const mKey = `${MONTH_ABBR[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`
      if (!byMonth[mKey]) byMonth[mKey] = { particular: 0, sus: 0, convenio: 0 }

      // Cada tipo que recebeu valor é contado uma vez por atendimento
      Object.entries(contributions).forEach(([key, val]) => {
        totals[key] += val
        byMonth[mKey][key] += val
        if (key === 'particular') totals.particularCount++
        else if (key === 'sus') totals.susCount++
        else totals.convenioCount++
      })
    })

    // Gera os últimos 6 meses terminando no mês final do período selecionado
    const end = new Date(`${endDate}T00:00:00`)
    const months: {
      mes: string
      particular: number
      sus: number
      convenio: number
      total: number
    }[] = []

    for (let i = 5; i >= 0; i--) {
      const d = new Date(end.getFullYear(), end.getMonth() - i, 1)
      const mKey = `${MONTH_ABBR[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`
      const m = byMonth[mKey] || { particular: 0, sus: 0, convenio: 0 }
      months.push({
        mes: mKey,
        particular: m.particular,
        sus: m.sus,
        convenio: m.convenio,
        total: m.particular + m.sus + m.convenio,
      })
    }

    // Totais exibidos no rodapé da tabela (somam apenas os meses mostrados)
    const monthsTotals = months.reduce(
      (acc, m) => {
        acc.particular += m.particular
        acc.sus += m.sus
        acc.convenio += m.convenio
        acc.total += m.total
        return acc
      },
      { particular: 0, sus: 0, convenio: 0, total: 0 },
    )

    return { totals, months, monthsTotals }
  }, [appointments, startDate, endDate])

  // 5. Receita vs Despesa (Linhas duplas)
  const cashFlowTrendData = useMemo(() => {
    return [
      { mes: 'Set/24', receitas: 32000, despesas: 14500, saldo: 17500 },
      { mes: 'Out/24', receitas: 39000, despesas: 16200, saldo: 22800 },
      { mes: 'Nov/24', receitas: 29500, despesas: 15100, saldo: 14400 },
      { mes: 'Dez/24', receitas: 52000, despesas: 21000, saldo: 31000 },
      { mes: 'Jan/25', receitas: 41000, despesas: 17800, saldo: 23200 },
      { mes: 'Fev/25', receitas: 36500, despesas: 15400, saldo: 21100 },
    ]
  }, [])

  // 6. Inadimplência
  const defaultRateData = useMemo(() => {
    let pagas = 0
    let pendentes = 0
    let atrasadas = 0
    const todayStr = new Date().toISOString().split('T')[0]

    installments.forEach((i) => {
      if (i.status === 'Pago') pagas++
      else if (i.status === 'Atrasado' || i.dueDate < todayStr) atrasadas++
      else pendentes++
    })

    return [
      { name: 'Pagas', value: pagas, color: '#10b981' },
      { name: 'Em Dia (Pendentes)', value: pendentes, color: '#f59e0b' },
      { name: 'Em Atraso', value: atrasadas, color: '#ef4444' },
    ]
  }, [installments])

  // 7. Aparelhos em Garantia
  const hearingAidsInWarranty = useMemo(() => {
    const today = new Date()
    return hearingAids.filter((aid) => {
      if (!aid.warrantyEndDate) return false
      const end = new Date(aid.warrantyEndDate)
      return end >= today
    })
  }, [hearingAids])

  // 8. Estoque abaixo do mínimo
  const stockBelowMin = useMemo(() => {
    return stockItems.filter((i) => i.currentQuantity < i.minQuantity)
  }, [stockItems])

  // 9. Follow-ups pendentes (pacientes em tratamento)
  const pendingFollowups = useMemo(() => {
    return patients.filter((p) => p.status === 'Em tratamento')
  }, [patients])

  const handleExportAllCSV = () => {
    const rows = sales.map((s) => ({
      Tipo: 'Venda',
      Numero: s.number,
      Paciente: s.patientName,
      Data: s.date,
      Valor: s.totalValue,
      FormaPagamento: s.paymentMethod,
    }))
    exportToCSV('relatorio_geral_audicao360', rows)
  }

  // Imprimir relatório gerencial (dados tabulares do período selecionado)
  const handlePrintRelatorio = () => {
    const periodSales = sales.filter((s) => s.date >= startDate && s.date <= endDate)
    const periodAppts = appointments.filter((a) => a.date >= startDate && a.date <= endDate)
    const periodInstallments = installments.filter(
      (i) => i.dueDate >= startDate && i.dueDate <= endDate,
    )

    const typeCount: Record<string, number> = {}
    periodAppts.forEach((a) => {
      typeCount[a.type] = (typeCount[a.type] || 0) + 1
    })

    const profCount: Record<string, number> = {}
    periodAppts.forEach((a) => {
      profCount[a.professionalName] = (profCount[a.professionalName] || 0) + 1
    })

    const sections = [
      {
        title: 'Resumo de Vendas no Período',
        columns: ['#', 'Paciente', 'Data', 'Valor', 'Pagamento', 'Status'],
        rows: periodSales.map((s) => [
          s.number,
          s.patientName,
          formatDate(s.date),
          formatCurrency(s.totalValue),
          s.paymentMethod,
          s.status,
        ]),
      },
      {
        title: 'Atendimentos por Tipo',
        columns: ['Tipo de Atendimento', 'Quantidade'],
        rows: Object.entries(typeCount).map(([t, c]) => [t, c]),
      },
      {
        title: 'Atendimentos por Profissional',
        columns: ['Profissional', 'Atendimentos'],
        rows: Object.entries(profCount).map(([p, c]) => [p, c]),
      },
      {
        title: 'Parcelas no Período',
        columns: ['Venda', 'Parcela', 'Paciente', 'Vencimento', 'Valor', 'Status'],
        rows: periodInstallments.map((i) => [
          i.saleNumber,
          `${i.installmentNumber}/${i.totalInstallments}`,
          i.patientName,
          formatDate(i.dueDate),
          formatCurrency(i.value),
          i.status,
        ]),
      },
    ]

    print({
      title: 'Relatório Gerencial',
      subtitle: `Período: ${formatDate(startDate)} a ${formatDate(endDate)}`,
      body: (
        <RelatorioPrint
          periodLabel={`${formatDate(startDate)} a ${formatDate(endDate)}`}
          sections={sections}
        />
      ),
    })
  }

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Cabeçalho da Página com Seletor Global de Período */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Relatórios Gerenciais
              </h1>
              <Badge variant="secondary" className="bg-teal-50 text-navy-700 font-bold text-xs">
                Business Intelligence
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Indicadores de performance clínica, faturamento, conversão de próteses e auditoria
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handlePrintRelatorio}
              variant="outline"
              className="rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold h-10"
            >
              <Printer className="w-4 h-4 mr-1.5 text-slate-600" />
              Imprimir Relatório
            </Button>
            <Button
              onClick={handleExportAllCSV}
              variant="outline"
              className="rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold h-10"
            >
              <Download className="w-4 h-4 mr-1.5 text-slate-600" />
              Exportar Dados Gerais (CSV)
            </Button>
          </div>
        </div>

        {/* Atalhos de Período */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <span className="text-xs font-bold text-slate-500 mr-1">Período:</span>
            <button
              onClick={() => handlePeriodChange('7d')}
              className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all ${
                period === '7d'
                  ? 'bg-teal-500 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Últimos 7 dias{' '}
            </button>
            <button
              onClick={() => handlePeriodChange('30d')}
              className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all ${
                period === '30d'
                  ? 'bg-teal-500 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Últimos 30 dias{' '}
            </button>
            <button
              onClick={() => handlePeriodChange('this_month')}
              className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all ${
                period === 'this_month'
                  ? 'bg-teal-500 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Este Mês{' '}
            </button>
            <button
              onClick={() => handlePeriodChange('last_month')}
              className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all ${
                period === 'last_month'
                  ? 'bg-teal-500 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Mês Passado{' '}
            </button>
            <button
              onClick={() => handlePeriodChange('this_year')}
              className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all ${
                period === 'this_year'
                  ? 'bg-teal-500 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Este Ano{' '}
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
            <span>De:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-8 px-2 rounded-lg border border-slate-300 text-xs bg-white"
            />
            <span>Até:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-8 px-2 rounded-lg border border-slate-300 text-xs bg-white"
            />
          </div>
        </div>
      </div>

      {/* Cards de Resumo: Faturamento por Tipo de Pagamento */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Particular */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-start gap-4">
          <div className="p-2.5 rounded-xl bg-blue-50">
            <DollarSign className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-700">Particular</h3>
              <Badge className="bg-blue-100 text-blue-700 text-[10px] font-semibold">
                Particular
              </Badge>
            </div>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">
              {formatCurrency(billingByTypeData.totals.particular)}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {billingByTypeData.totals.particularCount} atendimento(s) no período
            </p>
          </div>
        </div>

        {/* SUS */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-start gap-4">
          <div className="p-2.5 rounded-xl bg-emerald-50">
            <DollarSign className="w-6 h-6 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-700">SUS</h3>
              <Badge className="bg-emerald-100 text-emerald-700 text-[10px] font-semibold">
                SUS
              </Badge>
            </div>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">
              {formatCurrency(billingByTypeData.totals.sus)}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {billingByTypeData.totals.susCount} atendimento(s) no período
            </p>
          </div>
        </div>

        {/* Convênio */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-start gap-4">
          <div className="p-2.5 rounded-xl bg-purple-50">
            <DollarSign className="w-6 h-6 text-purple-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-700">Convênio</h3>
              <Badge className="bg-purple-100 text-purple-700 text-[10px] font-semibold">
                Convênio
              </Badge>
            </div>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">
              {formatCurrency(billingByTypeData.totals.convenio)}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {billingByTypeData.totals.convenioCount} atendimento(s) no período
            </p>
          </div>
        </div>
      </div>

      {/* Grade de Cards com Gráficos e Tabelas (9 Relatórios) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Novos Pacientes por Mês */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-teal-600" />
                Novos Pacientes Cadastrados
              </h3>
              <p className="text-xs text-slate-400">Evolução mensal de primeiros cadastros</p>
            </div>
            <Badge className="bg-teal-50 text-navy-700">Total: {patients.length}</Badge>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={patientsPerMonthData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="mes" fontSize={11} stroke="#94a3b8" />
                <YAxis fontSize={11} stroke="#94a3b8" />
                <Tooltip />
                <Bar dataKey="novos" fill="#00A6A6" radius={[6, 6, 0, 0]} name="Novos Pacientes" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2. Atendimentos por Tipo */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Ear className="w-4 h-4 text-purple-600" />
                Atendimentos por Tipo
              </h3>
              <p className="text-xs text-slate-400">Distribuição por especialidade audiológica</p>
            </div>
            <Badge className="bg-purple-50 text-purple-700">{appointments.length} registros</Badge>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={appointmentsByTypeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name.split(' ')[0]} ${(percent * 100).toFixed(0)}%`
                  }
                  fontSize={10}
                >
                  {appointmentsByTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3. Atendimentos por Profissional */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-600" />
                Atendimentos por Profissional
              </h3>
              <p className="text-xs text-slate-400">Carga clínica da equipe fonoaudiológica</p>
            </div>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={appointmentsByProfData}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" fontSize={11} stroke="#94a3b8" />
                <YAxis
                  dataKey="profissional"
                  type="category"
                  fontSize={11}
                  stroke="#94a3b8"
                  width={120}
                />
                <Tooltip />
                <Bar
                  dataKey="atendimentos"
                  fill="#10b981"
                  radius={[0, 6, 6, 0]}
                  name="Atendimentos"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 4. Faturamento por Tipo de Pagamento (gráfico + tabela) */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-orange-600" />
                  Faturamento por Tipo de Pagamento
                </h3>
                <p className="text-xs text-slate-400">
                  Particular × SUS × Convênio nos últimos 6 meses
                </p>
              </div>
            </div>

            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={billingByTypeData.months}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="mes" fontSize={11} stroke="#94a3b8" />
                  <YAxis
                    fontSize={11}
                    stroke="#94a3b8"
                    tickFormatter={(v) => formatCurrency(v)}
                    width={90}
                  />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend />
                  <Bar
                    dataKey="particular"
                    fill="#3b82f6"
                    name="Particular"
                    radius={[6, 6, 0, 0]}
                  />
                  <Bar dataKey="sus" fill="#22c55e" name="SUS" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="convenio" fill="#8b5cf6" name="Convênio" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Tabela detalhada do faturamento por mês */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-slate-600" />
              Detalhamento Mensal — Faturamento por Tipo
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="text-left font-semibold py-2 px-2">Mês</th>
                    <th className="text-right font-semibold py-2 px-2">Particular (R$)</th>
                    <th className="text-right font-semibold py-2 px-2">SUS (R$)</th>
                    <th className="text-right font-semibold py-2 px-2">Convênio (R$)</th>
                    <th className="text-right font-semibold py-2 px-2">Total (R$)</th>
                  </tr>
                </thead>
                <tbody>
                  {billingByTypeData.months.map((m) => (
                    <tr key={m.mes} className="border-b border-slate-100">
                      <td className="py-2 px-2 font-semibold text-slate-700">{m.mes}</td>
                      <td className="py-2 px-2 text-right text-blue-700 font-medium">
                        {formatCurrency(m.particular)}
                      </td>
                      <td className="py-2 px-2 text-right text-emerald-700 font-medium">
                        {formatCurrency(m.sus)}
                      </td>
                      <td className="py-2 px-2 text-right text-purple-700 font-medium">
                        {formatCurrency(m.convenio)}
                      </td>
                      <td className="py-2 px-2 text-right font-extrabold text-slate-900">
                        {formatCurrency(m.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-extrabold text-slate-900">
                    <td className="py-2.5 px-2">Total</td>
                    <td className="py-2.5 px-2 text-right text-blue-700">
                      {formatCurrency(billingByTypeData.monthsTotals.particular)}
                    </td>
                    <td className="py-2.5 px-2 text-right text-emerald-700">
                      {formatCurrency(billingByTypeData.monthsTotals.sus)}
                    </td>
                    <td className="py-2.5 px-2 text-right text-purple-700">
                      {formatCurrency(billingByTypeData.monthsTotals.convenio)}
                    </td>
                    <td className="py-2.5 px-2 text-right">
                      {formatCurrency(billingByTypeData.monthsTotals.total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* 5. Receita vs Despesa */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                Fluxo de Caixa: Receita vs Despesa
              </h3>
              <p className="text-xs text-slate-400">
                Entradas, saídas e resultado operacional líquido
              </p>
            </div>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cashFlowTrendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="mes" fontSize={11} stroke="#94a3b8" />
                <YAxis fontSize={11} stroke="#94a3b8" />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="receitas"
                  stroke="#10b981"
                  strokeWidth={2}
                  name="Receitas (R$)"
                />
                <Line
                  type="monotone"
                  dataKey="despesas"
                  stroke="#ef4444"
                  strokeWidth={2}
                  name="Despesas (R$)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 6. Inadimplência e Cobrança */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                Taxa de Inadimplência e Parcelas
              </h3>
              <p className="text-xs text-slate-400">
                Proporção de parcelas pagas, pendentes e atrasadas
              </p>
            </div>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={defaultRateData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  fontSize={11}
                >
                  {defaultRateData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 7. Tabela: Aparelhos em Garantia */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-600" />
              Aparelhos Ativos em Garantia ({hearingAidsInWarranty.length})
            </h3>
          </div>
          <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 text-xs">
            {hearingAidsInWarranty.map((aid) => (
              <div key={aid.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900 block">
                    {aid.brand} {aid.model}
                  </span>
                  <span className="text-slate-500">
                    Paciente: {aid.patientName || 'Estoque'} • Série: {aid.serialNumber}
                  </span>
                </div>
                <Badge variant="outline" className="text-[11px] font-mono">
                  Até {formatDate(aid.warrantyEndDate)}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        {/* 8. Tabela: Itens Abaixo do Mínimo */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Package className="w-4 h-4 text-orange-600" />
              Estoque Crítico (Abaixo do Mínimo) ({stockBelowMin.length})
            </h3>
          </div>
          <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 text-xs">
            {stockBelowMin.length === 0 ? (
              <p className="text-slate-400 py-4 text-center">Nenhum item crítico no estoque.</p>
            ) : (
              stockBelowMin.map((stk) => (
                <div key={stk.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900 block">{stk.name}</span>
                    <span className="text-slate-500">
                      {stk.category} • Forn: {stk.supplier || 'N/I'}
                    </span>
                  </div>
                  <span className="text-xs font-extrabold text-red-600 bg-red-50 px-2 py-1 rounded-lg">
                    {stk.currentQuantity} / {stk.minQuantity} un
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 9. Lista: Follow-ups de Adaptação Pendentes */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-teal-600" />
              Follow-ups de Adaptação Pendentes (~30 Dias) ({pendingFollowups.length})
            </h3>
            <Badge className="bg-teal-50 text-navy-700">Acompanhamento Ativo</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
            {pendingFollowups.map((pat) => (
              <div
                key={pat.id}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 truncate">{pat.name}</span>
                  <Badge variant="outline" className="text-[10px] bg-white">
                    {pat.status}
                  </Badge>
                </div>
                <p className="text-slate-500 text-[11px]">
                  {pat.mobile} • Última visita: {formatDate(pat.lastVisit)}
                </p>
                <p className="text-slate-600 text-[11px] line-clamp-2 italic">
                  {pat.generalNotes || 'Paciente em processo de aclimatação auditiva.'}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
