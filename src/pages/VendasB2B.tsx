import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2,
  Plus,
  Eye,
  Ban,
  ArrowLeft,
  DollarSign,
  TrendingUp,
  Receipt,
  X,
  Filter,
  Download,
  Wallet,
  CheckCircle2,
} from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import type { VendaB2B, VendaB2BStatus } from '@/types'

const PAGE_SIZE = 10

const statusLabel: Record<VendaB2BStatus, string> = {
  pendente: 'Pendente',
  aprovada: 'Aprovada',
  nf_emitida: 'NF Emitida',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}

const statusColors: Record<VendaB2BStatus, string> = {
  pendente: 'bg-amber-50 text-amber-700 border-amber-200',
  aprovada: 'bg-blue-50 text-blue-700 border-blue-200',
  nf_emitida: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  concluida: 'bg-green-50 text-green-800 border-green-300',
  cancelada: 'bg-red-50 text-red-700 border-red-200',
}

export default function VendasB2B() {
  const navigate = useNavigate()
  const { vendasB2B, fetchVendasB2B, empresasParceiras, fetchEmpresasParceiras, cancelVendaB2B } =
    useApp()
  const { toast } = useToast()

  const [page, setPage] = useState(1)
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | VendaB2BStatus>('all')
  const [filterEmpresa, setFilterEmpresa] = useState('all')
  const [showFilters, setShowFilters] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<VendaB2B | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelLoading, setCancelLoading] = useState(false)

  useEffect(() => {
    fetchVendasB2B()
    fetchEmpresasParceiras()
  }, [fetchVendasB2B, fetchEmpresasParceiras])

  // Resumo do mês atual
  const now = new Date()
  const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const resumo = useMemo(() => {
    const ativas = vendasB2B.filter((v) => v.status !== 'cancelada')
    const doMes = ativas.filter((v) => (v.data_venda || '').slice(0, 7) === mesAtual)
    const totalVendasMes = doMes.reduce((acc, v) => acc + (v.valor_total || 0), 0)
    const totalComissaoMes = doMes.reduce((acc, v) => acc + (v.valor_comissao || 0), 0)
    const qtdVendas = doMes.length
    const nfsEmitidas = vendasB2B.filter((v) => v.status === 'nf_emitida').length
    // Comissões a receber: NF emitida e repasse ainda pendente (qualquer mês)
    const comissoesReceber = ativas
      .filter((v) => v.nf && v.nf.status === 'emitida' && v.status_repasse !== 'recebido')
      .reduce((acc, v) => acc + (v.valor_comissao || 0), 0)
    const qtdComissoesReceber = ativas.filter(
      (v) => v.nf && v.nf.status === 'emitida' && v.status_repasse !== 'recebido',
    ).length
    // Comissões recebidas: repasse confirmado (qualquer mês)
    const comissoesRecebidas = ativas
      .filter((v) => v.status_repasse === 'recebido')
      .reduce((acc, v) => acc + (v.valor_comissao || 0), 0)
    const qtdComissoesRecebidas = ativas.filter((v) => v.status_repasse === 'recebido').length
    return {
      totalVendasMes,
      totalComissaoMes,
      qtdVendas,
      nfsEmitidas,
      comissoesReceber,
      qtdComissoesReceber,
      comissoesRecebidas,
      qtdComissoesRecebidas,
    }
  }, [vendasB2B, mesAtual])

  const filtered = useMemo(() => {
    return vendasB2B
      .filter((v) => {
        if (filterFrom && (v.data_venda || '') < filterFrom) return false
        if (filterTo && (v.data_venda || '') > filterTo) return false
        if (filterStatus !== 'all' && v.status !== filterStatus) return false
        if (filterEmpresa !== 'all' && v.cliente_empresa_id !== filterEmpresa) return false
        return true
      })
      .sort((a, b) => (a.data_venda < b.data_venda ? 1 : -1))
  }, [vendasB2B, filterFrom, filterTo, filterStatus, filterEmpresa])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const effectivePage = Math.min(page, totalPages)

  const hasFilters = filterFrom || filterTo || filterStatus !== 'all' || filterEmpresa !== 'all'

  const clearFilters = () => {
    setFilterFrom('')
    setFilterTo('')
    setFilterStatus('all')
    setFilterEmpresa('all')
    setPage(1)
  }

  const handleCancel = async () => {
    if (!cancelTarget) return
    setCancelLoading(true)
    try {
      const res = await cancelVendaB2B(cancelTarget.id, cancelReason)
      if (res.success) {
        setCancelTarget(null)
        setCancelReason('')
      } else if (res.message) {
        toast({ title: 'Erro ao cancelar', description: res.message, variant: 'destructive' })
      }
    } finally {
      setCancelLoading(false)
    }
  }

  // Mapa de empresas por id (para obter CNPJ na exportação)
  const empresaById = useMemo(() => {
    const m: Record<string, { razao_social: string; cnpj: string }> = {}
    empresasParceiras.forEach((e) => {
      m[e.id] = { razao_social: e.razao_social, cnpj: e.cnpj }
    })
    return m
  }, [empresasParceiras])

  const handleExportCSV = () => {
    if (filtered.length === 0) {
      toast({
        title: 'Nada para exportar',
        description: 'Não há vendas B2B visíveis com os filtros atuais.',
        variant: 'destructive',
      })
      return
    }

    // Escapa campo CSV: envolve em aspas e duplica aspas internas
    const esc = (val: unknown): string => {
      const s = val === null || val === undefined ? '' : String(val)
      return `"${s.replace(/"/g, '""')}"`
    }
    // Formata valor monetário como número (ex.: 3000.00) sem símbolo R$
    const num = (v: number | undefined | null): string => {
      const n = Number(v || 0)
      return n.toFixed(2).replace(/\.(?=\d{0,1}$)/, '.')
    }

    const headers = [
      'Número da Venda',
      'Data',
      'Empresa (razão social)',
      'CNPJ',
      'Valor Total',
      '% Comissão',
      'Valor Comissão',
      'Valor Repasse',
      'Status',
      'Especialista',
    ]

    const rows = filtered.map((v) => {
      const emp = empresaById[v.cliente_empresa_id]
      return [
        esc(v.numero_venda),
        esc(v.data_venda),
        esc(emp?.razao_social || v.cliente_empresa_nome || ''),
        esc(emp?.cnpj || ''),
        num(v.valor_total),
        num(v.percentual_comissao),
        num(v.valor_comissao),
        num(v.valor_repasse),
        esc(statusLabel[v.status]),
        esc(v.especialista_nome),
      ].join(',')
    })

    // BOM UTF-8 para abrir corretamente no Excel em português
    const csvContent = '\uFEFF' + [headers.map(esc).join(','), ...rows].join('\r\n')

    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const stamp =
      `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
      `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
    const filename = `vendas-b2b-${stamp}.csv`

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast({
      title: 'Exportação concluída',
      description: `${filtered.length} venda(s) exportada(s) em ${filename}.`,
    })
  }

  return (
    <div className="space-y-5 animate-in fade-in-50 duration-200">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center">
            <Building2 className="w-6 h-6 text-blue-700" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Vendas B2B</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Vendas para empresas parceiras com comissão de 30%
            </p>
          </div>
        </div>
        <Button
          onClick={() => navigate('/vendas-b2b/nova')}
          className="bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-sm shadow-sm"
        >
          <Plus className="w-4 h-4 mr-1.5" /> Nova Venda B2B
        </Button>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Vendas B2B (mês)
              </p>
              <p className="text-xl font-extrabold text-blue-700 mt-1">
                {formatCurrency(resumo.totalVendasMes)}
              </p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">
                Comissões a Receber
              </p>
              <p className="text-xl font-extrabold text-amber-700 mt-1">
                {formatCurrency(resumo.comissoesReceber)}
              </p>
              <p className="text-[10px] text-amber-600 mt-0.5">
                {resumo.qtdComissoesReceber} NF(s) emitida(s) — aguardando repasse
              </p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-amber-600" />
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-green-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-green-700 uppercase tracking-wider">
                Comissões Recebidas
              </p>
              <p className="text-xl font-extrabold text-green-700 mt-1">
                {formatCurrency(resumo.comissoesRecebidas)}
              </p>
              <p className="text-[10px] text-green-600 mt-0.5">
                {resumo.qtdComissoesRecebidas} repasse(s) confirmado(s)
              </p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                NF's Emitidas
              </p>
              <p className="text-xl font-extrabold text-slate-900 mt-1">{resumo.nfsEmitidas}</p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
              <Receipt className="w-4 h-4 text-amber-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setShowFilters((v) => !v)}
            className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 hover:text-blue-700"
          >
            <Filter className="w-4 h-4" /> Filtros
            {hasFilters && <Badge className="bg-blue-100 text-blue-700 ml-1">Ativos</Badge>}
          </button>
          <div className="flex items-center gap-2">
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-7 text-xs text-slate-500"
              >
                <X className="w-3 h-3 mr-1" /> Limpar
              </Button>
            )}
            <Button
              onClick={handleExportCSV}
              size="sm"
              className="h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" /> Exportar CSV
            </Button>
          </div>
        </div>
        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-2 border-t border-slate-100">
            <div>
              <Label className="text-[11px] text-slate-500 mb-1 block">De</Label>
              <Input
                type="date"
                value={filterFrom}
                onChange={(e) => {
                  setFilterFrom(e.target.value)
                  setPage(1)
                }}
                className="h-9 rounded-lg text-sm"
              />
            </div>
            <div>
              <Label className="text-[11px] text-slate-500 mb-1 block">Até</Label>
              <Input
                type="date"
                value={filterTo}
                onChange={(e) => {
                  setFilterTo(e.target.value)
                  setPage(1)
                }}
                className="h-9 rounded-lg text-sm"
              />
            </div>
            <div>
              <Label className="text-[11px] text-slate-500 mb-1 block">Empresa</Label>
              <Select
                value={filterEmpresa}
                onValueChange={(v) => {
                  setFilterEmpresa(v)
                  setPage(1)
                }}
              >
                <SelectTrigger className="h-9 rounded-lg text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {empresasParceiras.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.razao_social}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11px] text-slate-500 mb-1 block">Status</Label>
              <Select
                value={filterStatus}
                onValueChange={(v) => {
                  setFilterStatus(v as 'all' | VendaB2BStatus)
                  setPage(1)
                }}
              >
                <SelectTrigger className="h-9 rounded-lg text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="aprovada">Aprovada</SelectItem>
                  <SelectItem value="nf_emitida">NF Emitida</SelectItem>
                  <SelectItem value="concluida">Concluída</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="text-xs uppercase tracking-wider">Nº Venda</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Empresa</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Data</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-right">
                  Valor Total
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-right">
                  Comissão
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Status</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-slate-400">
                    <Building2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    Nenhuma venda B2B encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                paged.map((v) => (
                  <TableRow key={v.id} className="hover:bg-slate-50/60">
                    <TableCell className="font-bold text-slate-900">{v.numero_venda}</TableCell>
                    <TableCell className="text-slate-700 max-w-[220px] truncate">
                      {v.cliente_empresa_nome || '—'}
                    </TableCell>
                    <TableCell className="text-slate-600 whitespace-nowrap">
                      {formatDate(v.data_venda)}
                    </TableCell>
                    <TableCell className="text-right font-bold text-slate-900 whitespace-nowrap">
                      {formatCurrency(v.valor_total)}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-emerald-700 whitespace-nowrap">
                      {formatCurrency(v.valor_comissao)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant="outline" className={statusColors[v.status]}>
                          {statusLabel[v.status]}
                        </Badge>
                        {v.nf && v.nf.status === 'emitida' && v.status !== 'cancelada' && (
                          <Badge
                            variant="outline"
                            className={
                              v.status_repasse === 'recebido'
                                ? 'bg-green-50 text-green-800 border-green-300'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }
                          >
                            {v.status_repasse === 'recebido'
                              ? 'Comissão Recebida'
                              : 'Comissão a Receber'}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => navigate(`/vendas-b2b/${v.id}`)}
                          title="Ver detalhes"
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {(v.status === 'pendente' || v.status === 'aprovada') && (
                          <button
                            onClick={() => navigate(`/vendas-b2b/${v.id}`)}
                            title="Emitir NF"
                            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50"
                          >
                            <Receipt className="w-4 h-4" />
                          </button>
                        )}
                        {v.status !== 'cancelada' && v.status !== 'concluida' && (
                          <button
                            onClick={() => {
                              setCancelTarget(v)
                              setCancelReason('')
                            }}
                            title="Cancelar venda"
                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-xs text-slate-500">
            <span>
              Mostrando {(effectivePage - 1) * PAGE_SIZE + 1}–
              {Math.min(effectivePage * PAGE_SIZE, filtered.length)} de {filtered.length}
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={effectivePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-7 rounded-lg"
              >
                Anterior
              </Button>
              <span className="px-2 py-1 font-semibold text-slate-700">
                {effectivePage}/{totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={effectivePage >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="h-7 rounded-lg"
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de cancelamento */}
      <Dialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <DialogContent className="max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
          <DialogHeader className="border-b border-slate-100 pb-3">
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Ban className="w-5 h-5 text-red-500" />
              Cancelar Venda {cancelTarget?.numero_venda}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <p className="text-sm text-slate-600">
              Ao cancelar a venda, os produtos serão devolvidos ao estoque (se já tiverem sido
              baixados) e o status passará para <strong>Cancelada</strong>.
            </p>
            <div>
              <Label className="text-xs font-semibold text-slate-600 mb-1 block">
                Motivo do cancelamento
              </Label>
              <Textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Informe o motivo..."
                className="rounded-xl text-sm min-h-[80px]"
              />
            </div>
          </div>
          <DialogFooter className="pt-2 border-t border-slate-100">
            <Button
              variant="outline"
              onClick={() => setCancelTarget(null)}
              className="rounded-xl text-xs"
              disabled={cancelLoading}
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Voltar
            </Button>
            <Button
              onClick={handleCancel}
              disabled={cancelLoading}
              className="rounded-xl text-xs bg-red-500 hover:bg-red-600 text-white"
            >
              Confirmar Cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
