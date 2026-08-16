import React, { useMemo, useState } from 'react'
import { ShieldCheck, AlertTriangle, ShieldX, Shield, MessageCircle } from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ReportHeader, SummaryCard, EmptyState, downloadCSV } from './shared'

type WStatus = 'valida' | 'vencendo' | 'vencida'
type Range = '30' | '60' | '90' | 'all'

const statusOf = (dias: number): WStatus =>
  dias < 0 ? 'vencida' : dias <= 30 ? 'vencendo' : 'valida'

const statusBadge: Record<WStatus, { label: string; cls: string }> = {
  valida: { label: 'Válida', cls: 'bg-green-50 text-green-700 border-green-200' },
  vencendo: { label: 'Vencendo', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  vencida: { label: 'Vencida', cls: 'bg-red-50 text-red-700 border-red-200' },
}

export default function RelatorioGarantias() {
  const { hearingAids, patients } = useApp()
  const [range, setRange] = useState<Range>('30')
  const [statusFilter, setStatusFilter] = useState<'all' | WStatus>('all')

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Telefone do paciente (lookup) — HearingAid não carrega phone
  const phoneByPatient = useMemo(() => {
    const m: Record<string, string> = {}
    patients.forEach((p) => (m[p.id] = p.phone || ''))
    return m
  }, [patients])

  const rows = useMemo(() => {
    let list = hearingAids
      .filter((h) => h.warrantyEndDate && (h.status === 'Vendido' || h.status === 'Em uso'))
      .map((h) => {
        const end = new Date(h.warrantyEndDate + 'T00:00:00')
        const dias = Math.ceil((end.getTime() - today.getTime()) / 86400000)
        // Início da garantia derivado do fim - meses (fallback: data da venda)
        const inicio =
          h.warrantyEndDate && h.warrantyMonths
            ? new Date(end.getTime() - h.warrantyMonths * 30 * 86400000).toISOString().split('T')[0]
            : h.saleDate || ''
        return {
          id: h.id,
          paciente: h.patientName || '—',
          aparelho: `${h.brand} ${h.model}`,
          dataVenda: h.saleDate || '',
          inicioGarantia: inicio,
          fimGarantia: h.warrantyEndDate,
          dias,
          status: statusOf(dias),
          phone: (h.patientId && phoneByPatient[h.patientId]) || '',
        }
      })

    // Filtro de período (próximos N dias): mostra vencendo dentro do horizonte + vencidas
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

  const totalComGarantia = hearingAids.filter(
    (h) => h.warrantyEndDate && (h.status === 'Vendido' || h.status === 'Em uso'),
  ).length
  const vencendo30 = rows.filter((r) => r.dias >= 0 && r.dias <= 30).length
  const vencidas = rows.filter((r) => r.dias < 0).length
  const validas = rows.filter((r) => r.dias > 30).length

  const handleExport = () => {
    if (!rows.length) return
    downloadCSV(
      'relatorio-garantias',
      rows.map((r) => ({
        Paciente: r.paciente,
        Aparelho: r.aparelho,
        'Data da Venda': r.dataVenda,
        'Início Garantia': r.inicioGarantia,
        'Fim Garantia': r.fimGarantia,
        Status: statusBadge[r.status].label,
        'Dias Restantes': r.dias,
      })),
    )
  }

  const notifyWhatsApp = (r: (typeof rows)[number]) => {
    const phone = (r.phone || '').replace(/\D/g, '')
    const msg = `Olá ${r.paciente}! Este é um lembrete da Audição360: a garantia do seu aparelho auditivo ${r.aparelho} ${
      r.dias < 0 ? 'venceu' : `vence em ${r.dias} dia(s) (${formatDate(r.fimGarantia)})`
    }. Entre em contato para renovarmos ou verificarmos o seu equipamento.`
    const url = phone
      ? `https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank')
  }

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
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-end">
        <div>
          <label className="text-[11px] text-slate-500 mb-1 block">Período</label>
          <Select value={range} onValueChange={(v) => setRange(v as Range)}>
            <SelectTrigger className="w-[180px] h-9 rounded-lg text-sm">
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
          <label className="text-[11px] text-slate-500 mb-1 block">Status</label>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="w-[180px] h-9 rounded-lg text-sm">
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

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="text-xs uppercase">Paciente</TableHead>
                <TableHead className="text-xs uppercase">Aparelho</TableHead>
                <TableHead className="text-xs uppercase">Data da Venda</TableHead>
                <TableHead className="text-xs uppercase">Início Garantia</TableHead>
                <TableHead className="text-xs uppercase">Fim Garantia</TableHead>
                <TableHead className="text-xs uppercase">Status</TableHead>
                <TableHead className="text-xs uppercase text-right">Dias Restantes</TableHead>
                <TableHead className="text-xs uppercase text-center">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8}>
                    <EmptyState message="Nenhuma garantia no filtro selecionado." icon={Shield} />
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id} className="hover:bg-slate-50/60">
                    <TableCell className="font-semibold text-slate-800">{r.paciente}</TableCell>
                    <TableCell className="text-slate-600">{r.aparelho}</TableCell>
                    <TableCell className="text-slate-600 whitespace-nowrap">
                      {r.dataVenda ? formatDate(r.dataVenda) : '—'}
                    </TableCell>
                    <TableCell className="text-slate-600 whitespace-nowrap">
                      {r.inicioGarantia ? formatDate(r.inicioGarantia) : '—'}
                    </TableCell>
                    <TableCell className="text-slate-600 whitespace-nowrap">
                      {formatDate(r.fimGarantia)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusBadge[r.status].cls}>
                        {statusBadge[r.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      <span
                        className={
                          r.dias < 0
                            ? 'text-red-600'
                            : r.dias <= 30
                              ? 'text-amber-600'
                              : 'text-green-600'
                        }
                      >
                        {r.dias}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs rounded-lg border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                        onClick={() => notifyWhatsApp(r)}
                      >
                        <MessageCircle className="w-3.5 h-3.5 mr-1" /> Notificar
                      </Button>
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
