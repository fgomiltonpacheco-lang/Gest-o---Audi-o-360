import React, { useMemo, useState } from 'react'
import { ShieldCheck, AlertTriangle, ShieldX, Shield, MessageCircle } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { formatDate } from '@/lib/formatters'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ReportHeader,
  SummaryCard,
  SummaryCardSkeleton,
  DateRangeFilter,
  EmptyState,
  ReportTable,
  type Period,
  ymd,
  exportToCSVGeneric,
} from './shared'

type WStatus = 'valida' | 'vencendo' | 'vencida'
type Range = '30' | '60' | '90' | 'all'

const statusOf = (dias: number): WStatus =>
  dias < 0 ? 'vencida' : dias <= 30 ? 'vencendo' : 'valida'

const statusBadge: Record<WStatus, { label: string; cls: string }> = {
  valida: { label: 'Válida', cls: 'bg-green-50 text-green-700 border-green-200' },
  vencendo: { label: 'Vencendo', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  vencida: { label: 'Vencida', cls: 'bg-red-50 text-red-700 border-red-200' },
}

type Row = {
  id: string
  paciente: string
  pacienteId: string
  aparelho: string
  modelo: string
  dataVenda: string
  inicioGarantia: string
  fimGarantia: string
  dias: number
  status: WStatus
  phone: string
}

export default function RelatorioGarantias() {
  const { hearingAids, patients, dataLoading } = useApp()
  const [range, setRange] = useState<Range>('30')
  const [statusFilter, setStatusFilter] = useState<'all' | WStatus>('all')

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  // Período derivado do preset de vencimento (para o DateRangeFilter). Quando
  // "all", cobre um horizonte amplo a partir de hoje.
  const period: Period = useMemo(() => {
    if (range === 'all') {
      const from = new Date(today)
      from.setDate(from.getDate() - 365 * 3) // vencidas nos últimos 3 anos
      return { from: ymd(from), to: ymd(new Date(today.getTime() + 365 * 2 * 86400000)) }
    }
    const n = Number(range)
    const to = new Date(today)
    to.setDate(to.getDate() + n)
    return { from: ymd(today), to: ymd(to) }
  }, [range, today])

  // Telefone do paciente (lookup) — HearingAid não carrega phone.
  const phoneByPatient = useMemo(() => {
    const m: Record<string, string> = {}
    patients.forEach((p) => (m[p.id] = p.phone || p.mobile || ''))
    return m
  }, [patients])

  const rows: Row[] = useMemo(() => {
    let list = hearingAids
      .filter((h) => h.warrantyEndDate && (h.status === 'Vendido' || h.status === 'Em uso'))
      .map((h) => {
        const end = new Date(h.warrantyEndDate + 'T00:00:00')
        const dias = Math.ceil((end.getTime() - today.getTime()) / 86400000)
        const inicio =
          h.warrantyMonths && h.warrantyEndDate
            ? ymd(new Date(end.getTime() - h.warrantyMonths * 30 * 86400000))
            : h.saleDate || ''
        return {
          id: h.id,
          paciente: h.patientName || '—',
          pacienteId: h.patientId || '',
          aparelho: `${h.brand} ${h.model}`.trim(),
          modelo: h.model || '',
          dataVenda: h.saleDate || '',
          inicioGarantia: inicio,
          fimGarantia: h.warrantyEndDate || '',
          dias,
          status: statusOf(dias),
          phone: (h.patientId && phoneByPatient[h.patientId]) || '',
        }
      })

    // Filtro de período (horizonte): mostra garantias que vencem dentro da
    // janela selecionada + já vencidas.
    if (range !== 'all') {
      const n = Number(range)
      list = list.filter((r) => r.dias <= n)
    }

    if (statusFilter !== 'all') {
      list = list.filter((r) => r.status === statusFilter)
    }

    return list.sort((a, b) => a.dias - b.dias)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hearingAids, range, statusFilter, today, phoneByPatient])

  // Cards: totais sobre o universo de aparelhos com garantia (não filtrados por horizonte).
  const totalComGarantia = hearingAids.filter(
    (h) => h.warrantyEndDate && (h.status === 'Vendido' || h.status === 'Em uso'),
  ).length
  const vencendo30 = rows.filter((r) => r.dias >= 0 && r.dias <= 30).length
  const vencidas = rows.filter((r) => r.dias < 0).length
  const validas = rows.filter((r) => r.dias > 30).length

  const handleExport = () => {
    if (!rows.length) return
    exportToCSVGeneric(
      'relatorio-garantias',
      [
        { header: 'Paciente', accessor: (r) => r.paciente },
        { header: 'Aparelho', accessor: (r) => r.aparelho },
        { header: 'Data da Compra', accessor: (r) => r.dataVenda },
        { header: 'Início Garantia', accessor: (r) => r.inicioGarantia },
        { header: 'Fim Garantia', accessor: (r) => r.fimGarantia },
        { header: 'Dias Restantes', accessor: (r) => r.dias },
        { header: 'Status', accessor: (r) => statusBadge[r.status].label },
      ],
      rows,
    )
  }

  const notifyWhatsApp = (r: Row) => {
    const phone = (r.phone || '').replace(/\D/g, '')
    const msg = `Olá ${r.paciente}, sua garantia do aparelho ${r.modelo} vence em ${r.dias} dias. Entre em contato com a Audição360.`
    const url = phone
      ? `https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank')
  }

  const hasFilters = statusFilter !== 'all' || range !== '30'
  const clearFilters = () => {
    setRange('30')
    setStatusFilter('all')
  }

  const loading = dataLoading

  return (
    <div className="space-y-5 animate-in fade-in-50 duration-200">
      <ReportHeader
        title="Garantias Vencendo"
        description="Aparelhos com garantia próxima do vencimento ou vencida"
        icon={Shield}
        onExport={handleExport}
        exportDisabled={!rows.length}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SummaryCardSkeleton key={i} />)
        ) : (
          <>
            <SummaryCard
              label="Total c/ Garantia"
              value={String(totalComGarantia)}
              icon={ShieldCheck}
              tone="blue"
            />
            <SummaryCard
              label="Vencendo em 30 dias"
              value={String(vencendo30)}
              icon={AlertTriangle}
              tone="amber"
            />
            <SummaryCard label="Vencidas" value={String(vencidas)} icon={ShieldX} tone="red" />
            <SummaryCard label="Válidas" value={String(validas)} icon={ShieldCheck} tone="green" />
          </>
        )}
      </div>

      <DateRangeFilter
        period={period}
        onChange={() => {
          /* período derivado do preset; mantido apenas para exibição */
        }}
        hasFilters={hasFilters}
        onClear={clearFilters}
        extra={
          <div className="flex gap-2">
            <div>
              <Label className="text-[11px] text-slate-500 mb-1 block">Horizonte</Label>
              <Select value={range} onValueChange={(v) => setRange(v as Range)}>
                <SelectTrigger className="w-[170px] h-9 rounded-lg text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">Próximos 30 dias</SelectItem>
                  <SelectItem value="60">Próximos 60 dias</SelectItem>
                  <SelectItem value="90">Próximos 90 dias</SelectItem>
                  <SelectItem value="all">Todas as garantias</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11px] text-slate-500 mb-1 block">Status</Label>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                <SelectTrigger className="w-[150px] h-9 rounded-lg text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="valida">Válida</SelectItem>
                  <SelectItem value="vencendo">Vencendo</SelectItem>
                  <SelectItem value="vencida">Vencida</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        }
      />

      <ReportTable
        loading={loading}
        emptyIcon={Shield}
        emptyMessage="Nenhum dado encontrado no período selecionado."
        rows={rows}
        columns={[
          {
            header: 'Paciente',
            render: (r) =>
              r.pacienteId ? (
                <a
                  href={`/pacientes/${r.pacienteId}/prontuario`}
                  className="font-semibold text-slate-800 hover:text-blue-700 hover:underline"
                >
                  {r.paciente}
                </a>
              ) : (
                <span className="font-semibold text-slate-800">{r.paciente}</span>
              ),
            csv: (r) => r.paciente,
          },
          {
            header: 'Aparelho',
            render: (r) => <span className="text-slate-600">{r.aparelho}</span>,
            csv: (r) => r.aparelho,
          },
          {
            header: 'Data da Compra',
            render: (r) => (
              <span className="text-slate-600 whitespace-nowrap">
                {r.dataVenda ? formatDate(r.dataVenda) : '—'}
              </span>
            ),
            csv: (r) => r.dataVenda,
          },
          {
            header: 'Início Garantia',
            render: (r) => (
              <span className="text-slate-600 whitespace-nowrap">
                {r.inicioGarantia ? formatDate(r.inicioGarantia) : '—'}
              </span>
            ),
            csv: (r) => r.inicioGarantia,
          },
          {
            header: 'Fim Garantia',
            render: (r) => (
              <span className="text-slate-600 whitespace-nowrap">{formatDate(r.fimGarantia)}</span>
            ),
            csv: (r) => r.fimGarantia,
          },
          {
            header: 'Dias Restantes',
            className: 'text-right',
            render: (r) => (
              <span
                className={`block text-right font-semibold ${
                  r.dias < 0 ? 'text-red-600' : r.dias <= 30 ? 'text-amber-600' : 'text-green-600'
                }`}
              >
                {r.dias}
              </span>
            ),
            csv: (r) => r.dias,
          },
          {
            header: 'Status',
            render: (r) => (
              <Badge variant="outline" className={statusBadge[r.status].cls}>
                {statusBadge[r.status].label}
              </Badge>
            ),
            csv: (r) => statusBadge[r.status].label,
          },
          {
            header: 'Ação',
            className: 'text-center',
            render: (r) => (
              <div className="flex justify-center">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs rounded-lg border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  onClick={() => notifyWhatsApp(r)}
                >
                  <MessageCircle className="w-3.5 h-3.5 mr-1" /> WhatsApp
                </Button>
              </div>
            ),
          },
        ]}
      />
    </div>
  )
}
