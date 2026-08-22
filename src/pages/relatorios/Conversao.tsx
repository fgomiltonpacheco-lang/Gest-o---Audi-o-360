import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Target, TrendingUp, RotateCcw, XCircle, CheckCircle2 } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { formatCurrency, formatDate } from '@/lib/formatters'
import pb from '@/lib/pocketbase/client'
import { Badge } from '@/components/ui/badge'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts'
import {
  ReportHeader,
  SummaryCard,
  SummaryCardSkeleton,
  ChartCard,
  ChartSkeleton,
  DateRangeFilter,
  ProfessionalSelect,
  EmptyState,
  ErrorState,
  ReportTable,
  type Period,
  shortcutPeriod,
  type ShortcutId,
  inDateRange,
  professionalOptions,
  exportToCSVGeneric,
} from './shared'

// Espelho local do tipo hearing_aid_tests (collection do PocketBase).
interface HearingAidTest {
  id: string
  patient_id: string
  patient_name: string
  inventory_item_id: string
  product_name: string
  brand: string
  model: string
  start_date: string
  side: string
  status: string
  observations: string
  sale_type: string
  sale_id: string
  sale_number: string
  return_reason?: string
  created: string
}

type ConvStatus = 'Convertido' | 'Devolvido' | 'Cancelado' | 'Em teste'

function statusToConv(status: string): ConvStatus {
  if (status === 'Convertido em venda B2B' || status === 'Convertido em venda direta')
    return 'Convertido'
  if (status === 'Devolvido') return 'Devolvido'
  if (status === 'Cancelado') return 'Cancelado'
  return 'Em teste'
}

type Row = {
  data: string
  paciente: string
  aparelho: string
  status: ConvStatus
  statusOriginal: string
  tipoVenda: string
  valor: number
}

export default function RelatorioConversao() {
  const { sales, vendasB2B, appointments, currentUser } = useApp()
  const isAdmin = currentUser?.role === 'admin'

  const [period, setPeriod] = useState<Period>(() => shortcutPeriod('this_month'))
  const [profFilter, setProfFilter] = useState<string>(isAdmin ? 'all' : currentUser?.name || 'all')

  const [tests, setTests] = useState<HearingAidTest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const profs = useMemo(
    () => professionalOptions(appointments, vendasB2B),
    [appointments, vendasB2B],
  )

  const onShortcut = (id: ShortcutId) => setPeriod(shortcutPeriod(id))

  // Carrega todos os testes de aparelho da coleção hearing_aid_tests.
  const loadTests = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const recs = await pb.collection('hearing_aid_tests').getFullList({
        sort: '-created',
      })
      setTests(recs as unknown as HearingAidTest[])
    } catch (err) {
      console.error('Erro ao carregar testes de aparelho:', err)
      setError('Não foi possível carregar os testes de aparelho.')
      setTests([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTests()
  }, [loadTests])

  // Mapas para resolução do valor de venda convertido.
  const saleById = useMemo(() => {
    const m: Record<string, { valor: number; numero: string }> = {}
    sales.forEach((s) => {
      m[s.id] = { valor: s.totalValue || 0, numero: `#${s.number}` }
    })
    return m
  }, [sales])
  const b2bById = useMemo(() => {
    const m: Record<string, { valor: number; numero: string }> = {}
    vendasB2B.forEach((v) => {
      m[v.id] = { valor: v.valor_total || 0, numero: String(v.numero_venda || 'B2B') }
    })
    return m
  }, [vendasB2B])

  // Testes filtrados pelo período + profissional (via paciente vinculado ao
  // profissional que realizou o atendimento — aproximação usando appointments).
  const profsByPatient = useMemo(() => {
    const m: Record<string, string> = {}
    appointments.forEach((a) => {
      if (a.patientId && a.professionalName) m[a.patientId] = a.professionalName
    })
    return m
  }, [appointments])

  const rows: Row[] = useMemo(() => {
    const filtered = tests
      .filter((t) => {
        // Usa start_date como referência temporal do teste.
        const d = t.start_date || t.created?.slice(0, 10) || ''
        return inDateRange(d, period.from, period.to)
      })
      .filter((t) => {
        if (profFilter === 'all') return true
        const prof = profsByPatient[t.patient_id] || ''
        return prof === profFilter
      })

    return filtered
      .map((t) => {
        const conv = statusToConv(t.status)
        let tipoVenda = '—'
        let valor = 0
        if (t.status === 'Convertido em venda direta') {
          tipoVenda = 'Venda Direta'
          if (t.sale_id && saleById[t.sale_id]) {
            valor = saleById[t.sale_id].valor
          }
        } else if (t.status === 'Convertido em venda B2B') {
          tipoVenda = 'Venda B2B'
          if (t.sale_id && b2bById[t.sale_id]) {
            valor = b2bById[t.sale_id].valor
          }
        }
        return {
          data: t.start_date || t.created?.slice(0, 10) || '',
          paciente: t.patient_name || '—',
          aparelho: [t.brand, t.model].filter(Boolean).join(' ') || t.product_name || '—',
          status: conv,
          statusOriginal: t.status,
          tipoVenda,
          valor,
        }
      })
      .sort((a, b) => (a.data < b.data ? 1 : -1))
  }, [tests, period, profFilter, profsByPatient, saleById, b2bById])

  const totalTestes = rows.length
  const convertidos = rows.filter((r) => r.status === 'Convertido').length
  const convertidosB2B = rows.filter((r) => r.statusOriginal === 'Convertido em venda B2B').length
  const convertidosDireto = rows.filter(
    (r) => r.statusOriginal === 'Convertido em venda direta',
  ).length
  const devolvidos = rows.filter((r) => r.status === 'Devolvido').length
  const cancelados = rows.filter((r) => r.status === 'Cancelado').length
  const taxaConversao = totalTestes > 0 ? (convertidos / totalTestes) * 100 : 0

  // Funil: 5 etapas conforme especificação
  const funil = [
    { etapa: 'Testes Iniciados', valor: totalTestes, fill: '#0F2B5C' },
    { etapa: 'Convertidos B2B', valor: convertidosB2B, fill: '#f97316' },
    { etapa: 'Convertidos Direto', valor: convertidosDireto, fill: '#10b981' },
    { etapa: 'Devolvidos', valor: devolvidos, fill: '#f59e0b' },
    { etapa: 'Cancelados', valor: cancelados, fill: '#ef4444' },
  ]

  const hasFilters = profFilter !== 'all'
  const clearFilters = () => setProfFilter('all')

  const handleExport = () => {
    if (!rows.length) return
    exportToCSVGeneric(
      'relatorio-conversao',
      [
        { header: 'Data', accessor: (r) => r.data },
        { header: 'Paciente', accessor: (r) => r.paciente },
        { header: 'Aparelho', accessor: (r) => r.aparelho },
        { header: 'Status', accessor: (r) => r.statusOriginal },
        { header: 'Tipo de Venda', accessor: (r) => r.tipoVenda },
        { header: 'Valor', accessor: (r) => (r.valor ? r.valor.toFixed(2) : '') },
      ],
      rows,
    )
  }

  const statusBadge = (r: Row) => {
    const cls =
      r.status === 'Convertido'
        ? 'bg-green-50 text-green-700 border-green-200'
        : r.status === 'Devolvido'
          ? 'bg-amber-50 text-amber-700 border-amber-200'
          : r.status === 'Cancelado'
            ? 'bg-red-50 text-red-700 border-red-200'
            : 'bg-slate-100 text-slate-600 border-slate-200'
    return (
      <Badge variant="outline" className={cls}>
        {r.statusOriginal}
      </Badge>
    )
  }

  return (
    <div className="space-y-5 animate-in fade-in-50 duration-200">
      <ReportHeader
        title="Taxa de Conversão"
        description="Conversão de testes com aparelho em vendas (diretas e B2B)"
        icon={Target}
        onExport={handleExport}
        exportDisabled={!rows.length}
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <SummaryCardSkeleton key={i} />)
        ) : (
          <>
            <SummaryCard
              label="Testes Iniciados"
              value={String(totalTestes)}
              icon={Target}
              tone="blue"
            />
            <SummaryCard
              label="Convertidos"
              value={String(convertidos)}
              icon={CheckCircle2}
              tone="green"
            />
            <SummaryCard
              label="Devolvidos"
              value={String(devolvidos)}
              icon={RotateCcw}
              tone="amber"
            />
            <SummaryCard label="Cancelados" value={String(cancelados)} icon={XCircle} tone="red" />
            <SummaryCard
              label="Taxa de Conversão"
              value={`${taxaConversao.toFixed(1).replace('.', ',')}%`}
              icon={TrendingUp}
              tone="purple"
            />
          </>
        )}
      </div>

      <DateRangeFilter
        period={period}
        onChange={setPeriod}
        hasFilters={hasFilters}
        onClear={clearFilters}
        extra={<ProfessionalSelect value={profFilter} onChange={setProfFilter} options={profs} />}
      />

      {error ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <ErrorState message={error} />
        </div>
      ) : (
        <ChartCard
          title="Funil de Conversão"
          subtitle="Testes Iniciados → Convertidos B2B → Convertidos Direto → Devolvidos → Cancelados"
        >
          {loading ? (
            <ChartSkeleton height={260} />
          ) : funil.every((f) => f.valor === 0) ? (
            <EmptyState message="Sem dados no período." icon={Target} />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={funil}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                <YAxis type="category" dataKey="etapa" tick={{ fontSize: 11 }} width={130} />
                <Tooltip />
                <Bar dataKey="valor" name="Quantidade" radius={[0, 4, 4, 0]}>
                  {funil.map((f, i) => (
                    <Cell key={i} fill={f.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      )}

      <ReportTable
        loading={loading}
        emptyIcon={Target}
        emptyMessage="Nenhum teste no período selecionado."
        rows={rows}
        columns={[
          {
            header: 'Data',
            render: (r) => (
              <span className="text-slate-600 whitespace-nowrap">{formatDate(r.data)}</span>
            ),
            csv: (r) => r.data,
          },
          {
            header: 'Paciente',
            render: (r) => <span className="text-slate-700">{r.paciente}</span>,
            csv: (r) => r.paciente,
          },
          {
            header: 'Aparelho (marca/modelo)',
            render: (r) => <span className="text-slate-600">{r.aparelho}</span>,
            csv: (r) => r.aparelho,
          },
          {
            header: 'Status',
            render: (r) => statusBadge(r),
            csv: (r) => r.statusOriginal,
          },
          {
            header: 'Tipo de Venda',
            render: (r) => <span className="text-slate-600">{r.tipoVenda}</span>,
            csv: (r) => r.tipoVenda,
          },
          {
            header: 'Valor',
            className: 'text-right',
            render: (r) => (
              <span className="text-right font-semibold whitespace-nowrap block">
                {r.valor ? formatCurrency(r.valor) : '—'}
              </span>
            ),
            csv: (r) => (r.valor ? r.valor.toFixed(2) : ''),
            total: (rs) => {
              const total = rs.reduce((a, x) => a + x.valor, 0)
              return <span className="text-right block">{formatCurrency(total)}</span>
            },
          },
        ]}
      />
    </div>
  )
}
