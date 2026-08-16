import React, { useMemo, useState } from 'react'
import { Package, AlertTriangle, PackageX, DollarSign, Boxes } from 'lucide-react'
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
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { ReportHeader, SummaryCard, PeriodFilterBar, EmptyState, downloadCSV } from './shared'

type Status = 'ok' | 'abaixo' | 'zero'

function statusOf(atual: number, min: number): Status {
  if (atual <= 0) return 'zero'
  if (min > 0 && atual < min) return 'abaixo'
  return 'ok'
}

const statusBadge: Record<Status, { label: string; cls: string }> = {
  zero: { label: 'Sem estoque', cls: 'bg-red-50 text-red-700 border-red-200' },
  abaixo: { label: 'Abaixo do mínimo', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  ok: { label: 'OK', cls: 'bg-green-50 text-green-700 border-green-200' },
}

export default function RelatorioEstoqueBaixo() {
  const { stockItems } = useApp()
  const [apenasAbaixo, setApenasAbaixo] = useState(true)

  // Última movimentação por item — lê direto de stockItems (que já vem com
  // .movements populado pelo AppContext).
  const ultimaMov = useMemo(() => {
    const m: Record<string, string> = {}
    stockItems.forEach((it) => {
      const movs = (it as any).movements as
        | Array<{ date?: string; stockItemId?: string }>
        | undefined
      if (movs && movs.length) {
        const last = movs
          .map((mv) => mv.date || '')
          .filter(Boolean)
          .sort()
          .pop()
        if (last) m[it.id] = last
      }
    })
    return m
  }, [stockItems])

  const rows = useMemo(() => {
    const list = stockItems.map((it) => {
      const status = statusOf(it.currentQuantity, it.minQuantity)
      return {
        id: it.id,
        produto: it.name,
        categoria: it.category,
        atual: it.currentQuantity,
        minimo: it.minQuantity,
        status,
        custo: it.costPrice * it.currentQuantity,
        ultima: ultimaMov[it.id] || it.createdAt.split('T')[0],
      }
    })
    const filtered = apenasAbaixo ? list.filter((r) => r.status !== 'ok') : list
    return filtered.sort((a, b) => {
      // ordena por criticidade: zero > abaixo > ok
      const ord = { zero: 0, abaixo: 1, ok: 2 }
      if (ord[a.status] !== ord[b.status]) return ord[a.status] - ord[b.status]
      return a.produto.localeCompare(b.produto, 'pt-BR')
    })
  }, [stockItems, ultimaMov, apenasAbaixo])

  const totalItens = stockItems.length
  const abaixo = stockItems.filter(
    (it) => statusOf(it.currentQuantity, it.minQuantity) !== 'ok',
  ).length
  const semEstoque = stockItems.filter((it) => it.currentQuantity <= 0).length
  const valorEmEstoque = stockItems.reduce((acc, it) => acc + it.costPrice * it.currentQuantity, 0)

  const hasFilters = apenasAbaixo

  const handleExport = () => {
    if (!rows.length) return
    downloadCSV(
      'relatorio-estoque-baixo',
      rows.map((r) => ({
        Produto: r.produto,
        Categoria: r.categoria,
        'Estoque Atual': r.atual,
        'Estoque Mínimo': r.minimo,
        Status: statusBadge[r.status].label,
        'Última Movimentação': r.ultima,
      })),
    )
  }

  return (
    <div className="space-y-5 animate-in fade-in-50 duration-200">
      <ReportHeader
        title="Estoque Baixo"
        description="Itens abaixo do estoque mínimo ou sem estoque"
        icon={Package}
        onExport={handleExport}
        exportDisabled={!rows.length}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard label="Total de Itens" value={String(totalItens)} icon={Boxes} tone="blue" />
        <SummaryCard
          label="Abaixo do Mínimo"
          value={String(abaixo)}
          icon={AlertTriangle}
          tone="amber"
        />
        <SummaryCard label="Sem Estoque" value={String(semEstoque)} icon={PackageX} tone="red" />
        <SummaryCard
          label="Valor em Estoque"
          value={formatCurrency(valorEmEstoque)}
          icon={DollarSign}
          tone="green"
        />
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
        <Switch id="abaixo" checked={apenasAbaixo} onCheckedChange={setApenasAbaixo} />
        <Label htmlFor="abaixo" className="text-sm text-slate-700 cursor-pointer">
          Mostrar apenas itens abaixo do mínimo
        </Label>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="text-xs uppercase">Produto</TableHead>
                <TableHead className="text-xs uppercase">Categoria</TableHead>
                <TableHead className="text-xs uppercase text-right">Estoque Atual</TableHead>
                <TableHead className="text-xs uppercase text-right">Estoque Mínimo</TableHead>
                <TableHead className="text-xs uppercase">Status</TableHead>
                <TableHead className="text-xs uppercase">Última Movimentação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <EmptyState message="Nenhum item com estoque baixo." icon={Package} />
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id} className="hover:bg-slate-50/60">
                    <TableCell className="font-semibold text-slate-800">{r.produto}</TableCell>
                    <TableCell className="text-slate-600">{r.categoria}</TableCell>
                    <TableCell className="text-right font-semibold">{r.atual}</TableCell>
                    <TableCell className="text-right text-slate-500">{r.minimo}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusBadge[r.status].cls}>
                        {statusBadge[r.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-600 whitespace-nowrap">
                      {formatDate(r.ultima)}
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
