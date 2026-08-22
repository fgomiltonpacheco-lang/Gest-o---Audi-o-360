import React, { useMemo, useState } from 'react'
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Receipt,
  ShoppingBag,
  Building2,
  BarChart3,
  ArrowDownCircle,
  PiggyBank,
} from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { DESPESA_CATEGORIA_LABELS, type Despesa } from '@/types'
import {
  ReportHeader,
  SummaryCard,
  SummaryCardSkeleton,
  ChartCard,
  ChartSkeleton,
  DateRangeFilter,
  ProfessionalSelect,
  EmptyState,
  ReportTable,
  type Period,
  shortcutPeriod,
  type ShortcutId,
  prevPeriod,
  inDateRange,
  professionalOptions,
  normalizePaymentMethod,
  PAYMENT_GROUPS,
  growthPct,
  fmtPct,
  exportToCSVGeneric,
} from './shared'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'

type Origem = 'Direta' | 'B2B'
type Row = {
  data: string
  venda: string
  cliente: string
  itens: string
  valor: number
  forma: string
  profissional: string
  status: string
  origem: Origem
}

export default function RelatorioFaturamento() {
  const { sales, vendasB2B, appointments, currentUser, dataLoading, despesas, fetchDespesas } =
    useApp()

  // Carrega despesas para a seção de Lucro Líquido.
  React.useEffect(() => {
    fetchDespesas()
  }, [fetchDespesas])

  const [period, setPeriod] = useState<Period>(() => shortcutPeriod('this_month'))
  const [pmFilter, setPmFilter] = useState<string>('all')
  const [profFilter, setProfFilter] = useState<string>('all')

  const profs = useMemo(
    () => professionalOptions(appointments, vendasB2B),
    [appointments, vendasB2B],
  )

  const onShortcut = (id: ShortcutId) => setPeriod(shortcutPeriod(id))

  // Vendas diretas (PDV/atendimento) ativas no período
  const directSales = useMemo(
    () =>
      sales.filter(
        (s) =>
          s.status !== 'Cancelado' &&
          s.status !== 'Estornado' &&
          inDateRange(s.date, period.from, period.to),
      ),
    [sales, period],
  )

  // Vendas B2B ativas no período
  const b2bSales = useMemo(
    () =>
      vendasB2B.filter(
        (v) => v.status !== 'cancelada' && inDateRange(v.data_venda, period.from, period.to),
      ),
    [vendasB2B, period],
  )

  const rows: Row[] = useMemo(() => {
    const direct: Row[] = directSales.map((s) => ({
      data: s.date,
      venda: `#${s.number} (PDV)`,
      cliente: s.patientName || '—',
      itens: s.itemsDescription || s.items?.map((i) => i.name).join(', ') || '',
      valor: s.totalValue || 0,
      forma: normalizePaymentMethod(s.paymentMethod),
      profissional: currentUser?.name || '—',
      status: s.status || 'Concluída',
      origem: 'Direta',
    }))
    const b2b: Row[] = b2bSales.map((v) => ({
      data: v.data_venda || '',
      venda: String(v.numero_venda || 'B2B'),
      cliente: v.cliente_empresa_nome || '—',
      itens:
        v.itens
          ?.map((i) => `${'produto_nome' in i ? i.produto_nome : 'Item'} x${i.quantidade}`)
          .join(', ') || '',
      valor: v.valor_total || 0,
      forma: 'Boleto',
      profissional: v.especialista_nome || '—',
      status: v.status || 'aprovada',
      origem: 'B2B',
    }))
    return [...direct, ...b2b]
      .filter((r) => (pmFilter === 'all' ? true : r.forma === pmFilter))
      .filter((r) => (profFilter === 'all' ? true : r.profissional === profFilter))
      .sort((a, b) => (a.data < b.data ? 1 : -1))
  }, [directSales, b2bSales, pmFilter, profFilter, currentUser])

  // Cards de resumo
  const receitaTotal = rows.reduce((acc, r) => acc + r.valor, 0)
  const ticketMedio = rows.length ? receitaTotal / rows.length : 0
  const receitaB2B = rows.filter((r) => r.origem === 'B2B').reduce((a, r) => a + r.valor, 0)
  const receitaDireta = receitaTotal - receitaB2B
  const porForma = PAYMENT_GROUPS.map((g) => ({
    forma: g,
    valor: rows.filter((r) => r.forma === g).reduce((a, r) => a + r.valor, 0),
  }))

  // ---- Despesas no período (pelo vencimento) e Lucro Líquido ----
  const despesasPeriodo = useMemo<Despesa[]>(
    () =>
      despesas.filter(
        (d) => d.status !== 'cancelado' && inDateRange(d.data_vencimento, period.from, period.to),
      ),
    [despesas, period],
  )
  const totalDespesas = despesasPeriodo.reduce(
    (acc, d) => acc + (Number(d.valor) || 0) - (Number(d.valor_pago) || 0),
    0,
  )
  const despesasPagas = despesasPeriodo
    .filter((d) => d.status === 'pago')
    .reduce((acc, d) => acc + (Number(d.valor_pago) || Number(d.valor) || 0), 0)
  const lucroLiquido = receitaTotal - totalDespesas
  // Despesas por categoria
  const despesasPorCategoria = useMemo(() => {
    const map: Record<string, number> = {}
    despesasPeriodo.forEach((d) => {
      const cat = DESPESA_CATEGORIA_LABELS[d.categoria] || d.categoria
      map[cat] = (map[cat] || 0) + ((Number(d.valor) || 0) - (Number(d.valor_pago) || 0))
    })
    return Object.entries(map)
      .map(([categoria, valor]) => ({ categoria, valor }))
      .sort((a, b) => b.valor - a.valor)
  }, [despesasPeriodo])

  // Faturamento diário
  const dailyMap: Record<string, number> = {}
  rows.forEach((r) => {
    dailyMap[r.data] = (dailyMap[r.data] || 0) + r.valor
  })
  const dailyData = Object.keys(dailyMap)
    .sort()
    .map((d) => ({ data: formatDate(d), valor: dailyMap[d] }))

  // Comparativo com período anterior
  const prev = prevPeriod(period)
  const prevTotal = useMemo(() => {
    const ds = sales.filter(
      (s) =>
        s.status !== 'Cancelado' &&
        s.status !== 'Estornado' &&
        inDateRange(s.date, prev.from, prev.to),
    )
    const bs = vendasB2B.filter(
      (v) => v.status !== 'cancelada' && inDateRange(v.data_venda, prev.from, prev.to),
    )
    let total = 0
    ds.forEach((s) => (total += s.totalValue || 0))
    bs.forEach((v) => (total += v.valor_total || 0))
    return total
  }, [sales, vendasB2B, prev])
  const g = growthPct(receitaTotal, prevTotal)

  const hasFilters = pmFilter !== 'all' || profFilter !== 'all'
  const clearFilters = () => {
    setPmFilter('all')
    setProfFilter('all')
  }

  const handleExport = () => {
    if (!rows.length) return
    exportToCSVGeneric(
      'relatorio-faturamento',
      [
        { header: 'Data', accessor: (r) => r.data },
        { header: 'Venda', accessor: (r) => r.venda },
        { header: 'Cliente', accessor: (r) => r.cliente },
        { header: 'Itens', accessor: (r) => r.itens },
        { header: 'Valor Total', accessor: (r) => r.valor.toFixed(2) },
        { header: 'Forma de Pagamento', accessor: (r) => r.forma },
        { header: 'Profissional', accessor: (r) => r.profissional },
        { header: 'Status', accessor: (r) => r.status },
        { header: 'Origem', accessor: (r) => r.origem },
      ],
      rows,
    )
  }

  const loading = dataLoading

  return (
    <div className="space-y-5 animate-in fade-in-50 duration-200">
      <ReportHeader
        title="Relatório de Faturamento"
        description="Receita total, por forma de pagamento e comparação com período anterior"
        icon={DollarSign}
        onExport={handleExport}
        exportDisabled={!rows.length}
      />

      {/* Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {loading ? (
          <>
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
          </>
        ) : (
          <>
            <SummaryCard
              label="Receita Total"
              value={formatCurrency(receitaTotal)}
              hint={`Período: ${formatDate(period.from)} a ${formatDate(period.to)}`}
              icon={DollarSign}
              tone="blue"
            />
            <SummaryCard
              label="Ticket Médio"
              value={formatCurrency(ticketMedio)}
              hint={`${rows.length} venda(s)`}
              icon={Receipt}
              tone="purple"
            />
            <SummaryCard
              label="Receita Direta"
              value={formatCurrency(receitaDireta)}
              hint="PDV / Atendimento"
              icon={ShoppingBag}
              tone="green"
            />
            <SummaryCard
              label="Receita B2B"
              value={formatCurrency(receitaB2B)}
              hint="Empresas parceiras"
              icon={Building2}
              tone="amber"
            />
          </>
        )}
      </div>

      {/* Comparativo período anterior */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
        {g === null ? (
          <TrendingUp className="w-5 h-5 text-slate-400" />
        ) : g >= 0 ? (
          <TrendingUp className="w-5 h-5 text-emerald-600" />
        ) : (
          <TrendingDown className="w-5 h-5 text-red-600" />
        )}
        <div className="text-sm">
          <span className="font-semibold text-slate-700">Comparativo período anterior:</span>{' '}
          <span className="text-slate-500">
            {formatCurrency(prevTotal)} (anterior) → {formatCurrency(receitaTotal)} (atual)
          </span>{' '}
          <span
            className={`font-bold ${g === null ? 'text-slate-400' : g >= 0 ? 'text-emerald-600' : 'text-red-600'}`}
          >
            {g === null ? '—' : fmtPct(g)}
          </span>
        </div>
      </div>

      {/* Receita por forma de pagamento */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm animate-pulse"
              >
                <div className="h-2.5 w-16 bg-slate-200 rounded" />
                <div className="h-4 w-24 bg-slate-200 rounded mt-2" />
              </div>
            ))
          : porForma.map((p) => (
              <div
                key={p.forma}
                className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm"
              >
                <p className="text-[10px] font-semibold text-slate-500 uppercase">{p.forma}</p>
                <p className="text-base font-bold text-slate-900 mt-1">{formatCurrency(p.valor)}</p>
              </div>
            ))}
      </div>

      {/* Filtros */}
      <DateRangeFilter
        period={period}
        onChange={setPeriod}
        hasFilters={hasFilters}
        onClear={clearFilters}
        extra={
          <>
            <div>
              <Label className="text-[11px] text-slate-500 mb-1 block">Forma de Pagamento</Label>
              <select
                value={pmFilter}
                onChange={(e) => setPmFilter(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-200 text-sm px-2 bg-white"
              >
                <option value="all">Todas</option>
                {PAYMENT_GROUPS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            <ProfessionalSelect value={profFilter} onChange={setProfFilter} options={profs} />
          </>
        }
      />

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="Faturamento diário" subtitle="Receita por dia no período">
          {loading ? (
            <ChartSkeleton />
          ) : dailyData.length === 0 ? (
            <EmptyState message="Sem dados no período." icon={BarChart3} />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={dailyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="data" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} width={70} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Line
                  type="monotone"
                  dataKey="valor"
                  stroke="#0F2B5C"
                  strokeWidth={2}
                  name="Receita"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
        <ChartCard title="Faturamento por forma de pagamento" subtitle="Barras por categoria">
          {loading ? (
            <ChartSkeleton />
          ) : porForma.every((p) => p.valor === 0) ? (
            <EmptyState message="Sem dados no período." icon={BarChart3} />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={porForma} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="forma" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} width={70} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="valor" name="Receita" fill="#00A6A6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Tabela */}
      <ReportTable
        loading={loading}
        emptyIcon={BarChart3}
        emptyMessage="Nenhuma venda no período selecionado."
        rows={rows}
        columns={[
          {
            header: 'Data',
            render: (r) => (
              <span className="text-slate-600 whitespace-nowrap">{formatDate(r.data)}</span>
            ),
            csv: (r) => r.data,
            total: () => 'Total',
            className: 'text-slate-800',
          },
          {
            header: 'Nº Venda',
            render: (r) => <span className="font-semibold text-slate-800">{r.venda}</span>,
            csv: (r) => r.venda,
          },
          {
            header: 'Cliente',
            render: (r) => (
              <span className="text-slate-700 max-w-[200px] truncate block">{r.cliente}</span>
            ),
            csv: (r) => r.cliente,
          },
          {
            header: 'Itens',
            render: (r) => (
              <span className="text-slate-600 max-w-[260px] truncate block">{r.itens || '—'}</span>
            ),
            csv: (r) => r.itens,
          },
          {
            header: 'Valor Total',
            className: 'text-right',
            render: (r) => (
              <span className="text-right font-semibold whitespace-nowrap block">
                {formatCurrency(r.valor)}
              </span>
            ),
            csv: (r) => r.valor.toFixed(2),
            total: (rs) => (
              <span className="text-right block">
                {formatCurrency(rs.reduce((a, x) => a + x.valor, 0))}
              </span>
            ),
          },
          {
            header: 'Forma de Pagamento',
            render: (r) => <span className="text-slate-600">{r.forma}</span>,
            csv: (r) => r.forma,
          },
          {
            header: 'Profissional',
            render: (r) => <span className="text-slate-600">{r.profissional}</span>,
            csv: (r) => r.profissional,
          },
          {
            header: 'Status',
            render: (r) => (
              <Badge
                variant="outline"
                className={
                  r.origem === 'B2B'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }
              >
                {r.status}
              </Badge>
            ),
            csv: (r) => r.status,
          },
        ]}
      />

      {/* ===== Seção de Despesas e Lucro Líquido ===== */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pt-2">
          <ArrowDownCircle className="w-5 h-5 text-rose-600" />
          <h2 className="text-base font-bold text-slate-900">Despesas e Lucro Líquido</h2>
          <span className="text-xs text-slate-500">
            (despesas com vencimento no período: {formatDate(period.from)} a {formatDate(period.to)}
            )
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <SummaryCard
            label="Receita Total"
            value={formatCurrency(receitaTotal)}
            hint="Vendas no período"
            icon={DollarSign}
            tone="blue"
          />
          <SummaryCard
            label="Total de Despesas"
            value={formatCurrency(totalDespesas)}
            hint={`${despesasPeriodo.length} despesa(s)`}
            icon={ArrowDownCircle}
            tone="amber"
          />
          <SummaryCard
            label="Despesas Pagas"
            value={formatCurrency(despesasPagas)}
            hint="Quitadas no período"
            icon={Receipt}
            tone="purple"
          />
          <SummaryCard
            label="Lucro Líquido"
            value={formatCurrency(lucroLiquido)}
            hint="Receitas − Despesas"
            icon={PiggyBank}
            tone={lucroLiquido >= 0 ? 'green' : 'amber'}
          />
        </div>

        {/* Despesas por categoria */}
        {despesasPorCategoria.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800">Despesas por Categoria</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="text-left px-4 py-2 font-semibold">Categoria</th>
                    <th className="text-right px-4 py-2 font-semibold">Valor Pendente</th>
                    <th className="text-right px-4 py-2 font-semibold">% do Total</th>
                  </tr>
                </thead>
                <tbody>
                  {despesasPorCategoria.map((c) => (
                    <tr key={c.categoria} className="border-t border-slate-100">
                      <td className="px-4 py-2 text-slate-700 font-medium">{c.categoria}</td>
                      <td className="px-4 py-2 text-right text-rose-700 font-semibold">
                        {formatCurrency(c.valor)}
                      </td>
                      <td className="px-4 py-2 text-right text-slate-500">
                        {totalDespesas > 0 ? ((c.valor / totalDespesas) * 100).toFixed(1) : '0'}%
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50">
                  <tr>
                    <td className="px-4 py-2 font-bold text-slate-900">Total</td>
                    <td className="px-4 py-2 text-right font-extrabold text-rose-700">
                      {formatCurrency(totalDespesas)}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-500">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Resumo do Lucro Líquido */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center ${lucroLiquido >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}
            >
              <PiggyBank
                className={`w-6 h-6 ${lucroLiquido >= 0 ? 'text-emerald-600' : 'text-red-600'}`}
              />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Lucro Líquido do período</p>
              <p className="text-sm text-slate-500">
                {formatCurrency(receitaTotal)} (receita) − {formatCurrency(totalDespesas)}{' '}
                (despesas)
              </p>
            </div>
          </div>
          <p
            className={`text-2xl font-extrabold ${lucroLiquido >= 0 ? 'text-emerald-700' : 'text-red-600'}`}
          >
            {formatCurrency(lucroLiquido)}
          </p>
        </div>
      </div>
    </div>
  )
}
