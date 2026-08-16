import React, { useMemo, useState } from 'react'
import { Filter, TrendingUp, RotateCcw, XCircle, CheckCircle2, Target } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { formatCurrency, formatDate } from '@/lib/formatters'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
  ChartCard,
  PeriodFilterBar,
  EmptyState,
  type Period,
  thisMonthRange,
  last30Range,
  inDateRange,
  professionalOptions,
  downloadCSV,
  ProfessionalSelect,
} from './shared'
import { Badge } from '@/components/ui/badge'

type ConvStatus = 'Convertido' | 'Devolvido' | 'Cancelado'

export default function RelatorioConversao() {
  const { appointments, sales, vendasB2B, hearingAids } = useApp()
  const [period, setPeriod] = useState<Period>(() => thisMonthRange())
  const [profFilter, setProfFilter] = useState<string>('all')

  const profs = useMemo(
    () => professionalOptions(appointments, vendasB2B),
    [appointments, vendasB2B],
  )

  const setShortcut = (s: 'this_month' | 'last_30d' | 'last_month' | 'this_year') => {
    if (s === 'this_month') setPeriod(thisMonthRange())
    else if (s === 'last_30d') setPeriod(last30Range())
    else if (s === 'last_month') {
      const t = new Date()
      setPeriod({
        from: new Date(t.getFullYear(), t.getMonth() - 1, 1).toISOString().split('T')[0],
        to: new Date(t.getFullYear(), t.getMonth(), 0).toISOString().split('T')[0],
      })
    } else {
      const y = new Date().getFullYear()
      setPeriod({ from: `${y}-01-01`, to: `${y}-12-31` })
    }
  }

  // Testes = atendimentos do tipo "Teste" no período
  const testes = useMemo(
    () =>
      appointments.filter(
        (a) =>
          /teste/i.test(a.type || '') &&
          inDateRange(a.date, period.from, period.to) &&
          (profFilter === 'all' || a.professionalName === profFilter),
      ),
    [appointments, period, profFilter],
  )

  // Conversões: aparelhos vendidos no período com paciente
  const aparelhosVendidos = useMemo(
    () =>
      hearingAids.filter(
        (h) =>
          h.status === 'Vendido' &&
          h.saleDate &&
          inDateRange(h.saleDate, period.from, period.to) &&
          (profFilter === 'all' || true),
      ),
    [hearingAids, period],
  )

  // Vendas diretas (PDV) e B2B no período
  const diretas = useMemo(
    () =>
      sales.filter(
        (s) =>
          s.status !== 'Cancelado' &&
          s.status !== 'Estornado' &&
          inDateRange(s.date, period.from, period.to),
      ),
    [sales, period],
  )
  const b2b = useMemo(
    () =>
      vendasB2B.filter(
        (v) => v.status !== 'cancelada' && inDateRange(v.data_venda, period.from, period.to),
      ),
    [vendasB2B, period],
  )

  // Tabela de testes → resultado
  type Row = {
    data: string
    paciente: string
    aparelho: string
    status: ConvStatus
    tipoVenda: string
    valor: number
  }

  // Pacientes que converteram (compraram aparelho depois do teste)
  const pacientesConvertidos = new Set(aparelhosVendidos.map((h) => h.patientId).filter(Boolean))
  const pacientesDevolucao = new Set(
    hearingAids
      .filter(
        (h) =>
          h.status === 'Estoque' &&
          h.patientId &&
          inDateRange(h.createdAt.split('T')[0], period.from, period.to),
      )
      .map((h) => h.patientId!),
  )

  const rows: Row[] = useMemo(() => {
    const r: Row[] = testes.map((t) => {
      const convertido = pacientesConvertidos.has(t.patientId)
      const devolvido = pacientesDevolucao.has(t.patientId)
      const status: ConvStatus =
        t.status === 'Cancelado'
          ? 'Cancelado'
          : convertido
            ? 'Convertido'
            : devolvido
              ? 'Devolvido'
              : 'Cancelado'
      const aparelho = aparelhosVendidos.find((h) => h.patientId === t.patientId)
      const vendaDireta = diretas.find((s) => s.patientId === t.patientId)
      const vendaB2b = b2b.find((v) => v.cliente_empresa_id) // placeholder
      const tipoVenda = vendaDireta ? 'Venda Direta' : vendaB2b ? 'Venda B2B' : '—'
      const valor = aparelho?.saleValue || vendaDireta?.totalValue || 0
      return {
        data: t.date,
        paciente: t.patientName,
        aparelho: aparelho ? `${aparelho.brand} ${aparelho.model}` : '—',
        status,
        tipoVenda,
        valor,
      }
    })
    return r.sort((a, b) => (a.data < b.data ? 1 : -1))
  }, [testes, pacientesConvertidos, pacientesDevolucao, aparelhosVendidos, diretas, b2b])

  const totalTestes = rows.length
  const convertidos = rows.filter((r) => r.status === 'Convertido').length
  const devolvidos = rows.filter((r) => r.status === 'Devolvido').length
  const cancelados = rows.filter((r) => r.status === 'Cancelado').length
  const taxaConversao = totalTestes > 0 ? (convertidos / totalTestes) * 100 : 0

  // Funil
  const funil = [
    { etapa: 'Testes Iniciados', valor: totalTestes, fill: '#0F2B5C' },
    { etapa: 'Vendas B2B', valor: b2b.length, fill: '#f97316' },
    { etapa: 'Vendas Diretas', valor: diretas.length, fill: '#10b981' },
    { etapa: 'Devolvidos', valor: devolvidos, fill: '#ef4444' },
  ]

  const hasFilters = profFilter !== 'all'
  const clearFilters = () => setProfFilter('all')

  const handleExport = () => {
    if (!rows.length) return
    downloadCSV(
      'relatorio-conversao',
      rows.map((r) => ({
        Data: r.data,
        Paciente: r.paciente,
        Aparelho: r.aparelho,
        Status: r.status,
        'Tipo de Venda': r.tipoVenda,
        Valor: r.valor.toFixed(2),
      })),
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
        <SummaryCard label="Devolvidos" value={String(devolvidos)} icon={RotateCcw} tone="amber" />
        <SummaryCard label="Cancelados" value={String(cancelados)} icon={XCircle} tone="red" />
        <SummaryCard
          label="Taxa de Conversão"
          value={`${taxaConversao.toFixed(1).replace('.', ',')}%`}
          icon={TrendingUp}
          tone="purple"
        />
      </div>

      <PeriodFilterBar
        from={period.from}
        to={period.to}
        onFrom={(v) => setPeriod((p) => ({ ...p, from: v }))}
        onTo={(v) => setPeriod((p) => ({ ...p, to: v }))}
        onShortcut={setShortcut}
        hasFilters={hasFilters}
        onClear={clearFilters}
        extra={<ProfessionalSelect value={profFilter} onChange={setProfFilter} options={profs} />}
      />

      <ChartCard
        title="Funil de Conversão"
        subtitle="Testes → Vendas B2B → Vendas Diretas → Devolvidos"
      >
        {funil.every((f) => f.valor === 0) ? (
          <EmptyState message="Sem dados no período." icon={Target} />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={funil}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="etapa" tick={{ fontSize: 11 }} width={120} />
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

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="text-xs uppercase">Data</TableHead>
                <TableHead className="text-xs uppercase">Paciente</TableHead>
                <TableHead className="text-xs uppercase">Aparelho</TableHead>
                <TableHead className="text-xs uppercase">Status</TableHead>
                <TableHead className="text-xs uppercase">Tipo de Venda</TableHead>
                <TableHead className="text-xs uppercase text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <EmptyState message="Nenhum teste no período." icon={Target} />
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r, i) => (
                  <TableRow key={i} className="hover:bg-slate-50/60">
                    <TableCell className="text-slate-600 whitespace-nowrap">
                      {formatDate(r.data)}
                    </TableCell>
                    <TableCell className="text-slate-700">{r.paciente}</TableCell>
                    <TableCell className="text-slate-600">{r.aparelho}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          r.status === 'Convertido'
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : r.status === 'Devolvido'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-red-50 text-red-700 border-red-200'
                        }
                      >
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-600">{r.tipoVenda}</TableCell>
                    <TableCell className="text-right font-semibold whitespace-nowrap">
                      {r.valor ? formatCurrency(r.valor) : '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
