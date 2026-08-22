import React, { useEffect, useMemo, useState } from 'react'
import {
  ArrowDownCircle,
  RefreshCw,
  Plus,
  Search,
  Check,
  Pencil,
  X,
  Download,
  Paperclip,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
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
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatCurrency, formatDate, exportToCSV } from '@/lib/formatters'
import pb from '@/lib/pocketbase/client'
import {
  type Despesa,
  type DespesaCategoria,
  type DespesaFormaPagamento,
  type DespesaStatus,
  DESPESA_CATEGORIA_LABELS,
  DESPESA_FORMA_PAGAMENTO_LABELS,
  DESPESA_STATUS_LABELS,
} from '@/types'

const STATUS_BADGE_CLASS: Record<DespesaStatus, string> = {
  a_pagar: 'bg-blue-50 text-blue-700 border-blue-200',
  pendente: 'bg-blue-50 text-blue-700 border-blue-200',
  pago: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  vencido: 'bg-red-50 text-red-700 border-red-200',
  atrasado: 'bg-red-50 text-red-700 border-red-200',
  cancelado: 'bg-slate-100 text-slate-600 border-slate-200',
}

/** Status efetivo: despesas a_pagar com vencimento no passado viram "vencido". */
function statusEfetivo(d: Despesa): DespesaStatus {
  if (d.status === 'cancelado' || d.status === 'pago') return d.status
  const hoje = new Date().toISOString().split('T')[0]
  if (d.data_vencimento && d.data_vencimento < hoje) return 'vencido'
  return 'a_pagar'
}

const PAGE_SIZE = 20

export default function Despesas() {
  const { despesas, fetchDespesas, createDespesa, updateDespesa, pagarDespesa, cancelarDespesa } =
    useApp()
  const { toast } = useToast()

  // ---- Filtros ----
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [categoriaFilter, setCategoriaFilter] = useState<string>('all')
  const [formaFilter, setFormaFilter] = useState<string>('all')
  const [vencInicio, setVencInicio] = useState('')
  const [vencFim, setVencFim] = useState('')

  // ---- Paginação ----
  const [page, setPage] = useState(1)

  // ---- Modais ----
  const [formOpen, setFormOpen] = useState(false)
  const [pagarOpen, setPagarOpen] = useState(false)
  const [cancelarOpen, setCancelarOpen] = useState(false)
  const [despesaSel, setDespesaSel] = useState<Despesa | null>(null)
  const [saving, setSaving] = useState(false)

  // ---- Form Nova/Editar ----
  const [fDescricao, setFDescricao] = useState('')
  const [fValor, setFValor] = useState('')
  const [fVencimento, setFVencimento] = useState('')
  const [fCategoria, setFCategoria] = useState<DespesaCategoria>('outros')
  const [fForma, setFForma] = useState<DespesaFormaPagamento>('pix')
  const [fObs, setFObs] = useState('')
  const [fComprovante, setFComprovante] = useState<File | null>(null)
  const [fComprovanteNome, setFComprovanteNome] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  // ---- Form Pagar ----
  const [pValor, setPValor] = useState('')
  const [pData, setPData] = useState(new Date().toISOString().split('T')[0])
  const [pForma, setPForma] = useState<DespesaFormaPagamento>('pix')
  const [pObs, setPObs] = useState('')

  // ---- Form Cancelar ----
  const [cMotivo, setCMotivo] = useState('')

  useEffect(() => {
    fetchDespesas()
  }, [fetchDespesas])

  // ---- Métricas (mês atual) ----
  const metricas = useMemo(() => {
    const hoje = new Date()
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0]
    let totalMes = 0
    let pagas = 0
    let aPagar = 0
    let vencido = 0
    despesas.forEach((d) => {
      const st = statusEfetivo(d)
      if (st === 'cancelado') return
      // Total do mês: vencimento dentro do mês corrente
      if (d.data_vencimento >= inicioMes) {
        totalMes += Number(d.valor) || 0
      }
      if (st === 'pago') pagas += Number(d.valor_pago || d.valor) || 0
      if (st === 'a_pagar') aPagar += (Number(d.valor) || 0) - (Number(d.valor_pago) || 0)
      if (st === 'vencido') vencido += (Number(d.valor) || 0) - (Number(d.valor_pago) || 0)
    })
    return { totalMes, pagas, aPagar, vencido }
  }, [despesas])

  // ---- Lista filtrada ----
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return despesas.filter((d) => {
      const st = statusEfetivo(d)
      if (statusFilter !== 'all' && st !== statusFilter) return false
      if (categoriaFilter !== 'all' && d.categoria !== categoriaFilter) return false
      if (formaFilter !== 'all' && d.forma_pagamento !== formaFilter) return false
      if (vencInicio && d.data_vencimento < vencInicio) return false
      if (vencFim && d.data_vencimento > vencFim) return false
      if (q && !d.descricao.toLowerCase().includes(q)) return false
      return true
    })
  }, [despesas, search, statusFilter, categoriaFilter, formaFilter, vencInicio, vencFim])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter, categoriaFilter, formaFilter, vencInicio, vencFim])

  // ---- Handlers ----
  const openNova = () => {
    setEditingId(null)
    setFDescricao('')
    setFValor('')
    setFVencimento(new Date().toISOString().split('T')[0])
    setFCategoria('outros')
    setFForma('pix')
    setFObs('')
    setFComprovante(null)
    setFComprovanteNome('')
    setFormOpen(true)
  }

  const openEditar = (d: Despesa) => {
    setEditingId(d.id)
    setFDescricao(d.descricao)
    setFValor(String(d.valor))
    setFVencimento(d.data_vencimento)
    setFCategoria(d.categoria)
    setFForma(d.forma_pagamento || 'pix')
    setFObs(d.observacoes || '')
    setFComprovante(null)
    setFComprovanteNome(d.comprovante || '')
    setDespesaSel(d)
    setFormOpen(true)
  }

  const openPagar = (d: Despesa) => {
    setDespesaSel(d)
    const restante = (Number(d.valor) || 0) - (Number(d.valor_pago) || 0)
    setPValor(restante.toFixed(2))
    setPData(new Date().toISOString().split('T')[0])
    setPForma(d.forma_pagamento || 'pix')
    setPObs('')
    setPagarOpen(true)
  }

  const openCancelar = (d: Despesa) => {
    setDespesaSel(d)
    setCMotivo('')
    setCancelarOpen(true)
  }

  const submitForm = async () => {
    if (!fDescricao.trim()) {
      toast({ title: 'Informe a descrição', variant: 'destructive' })
      return
    }
    const valorNum = Number(fValor.replace(',', '.'))
    if (!valorNum || valorNum <= 0) {
      toast({ title: 'Informe um valor válido', variant: 'destructive' })
      return
    }
    if (!fVencimento) {
      toast({ title: 'Informe a data de vencimento', variant: 'destructive' })
      return
    }
    setSaving(true)
    const payload = {
      descricao: fDescricao.trim(),
      valor: valorNum,
      data_vencimento: fVencimento,
      categoria: fCategoria,
      forma_pagamento: fForma,
      status: 'a_pagar' as DespesaStatus,
      valor_pago: 0,
      observacoes: fObs,
      comprovanteFile: fComprovante,
    }
    const res =
      editingId != null ? await updateDespesa(editingId, payload) : await createDespesa(payload)
    setSaving(false)
    if (res.success) {
      setFormOpen(false)
    } else {
      toast({ title: 'Erro', description: res.message, variant: 'destructive' })
    }
  }

  const submitPagar = async () => {
    if (!despesaSel) return
    setSaving(true)
    const res = await pagarDespesa(despesaSel.id, {
      data_pagamento: pData,
      forma_pagamento: pForma,
      valor: Number(pValor.replace(',', '.')),
      observacoes: pObs,
    })
    setSaving(false)
    if (res.success) {
      setPagarOpen(false)
    } else {
      toast({ title: 'Erro', description: res.message, variant: 'destructive' })
    }
  }

  const submitCancelar = async () => {
    if (!despesaSel) return
    setSaving(true)
    const res = await cancelarDespesa(despesaSel.id, cMotivo)
    setSaving(false)
    if (res.success) {
      setCancelarOpen(false)
    } else {
      toast({ title: 'Erro', description: res.message, variant: 'destructive' })
    }
  }

  const handleExport = () => {
    if (!filtered.length) {
      toast({ title: 'Nada para exportar', variant: 'destructive' })
      return
    }
    const rows = filtered.map((d) => ({
      Vencimento: d.data_vencimento,
      Descricao: d.descricao,
      Categoria: DESPESA_CATEGORIA_LABELS[d.categoria],
      Valor: (Number(d.valor) || 0).toFixed(2),
      FormaPagamento: d.forma_pagamento ? DESPESA_FORMA_PAGAMENTO_LABELS[d.forma_pagamento] : '',
      Status: DESPESA_STATUS_LABELS[statusEfetivo(d)],
      ValorPago: (Number(d.valor_pago) || 0).toFixed(2),
      DataPagamento: d.data_pagamento || '',
      Observacoes: d.observacoes || '',
    }))
    exportToCSV('despesas', rows)
  }

  const comprovanteUrl = (d: Despesa): string => {
    if (!d.comprovante) return ''
    try {
      return pb.files.getUrl(
        { id: d.id, collectionId: 'despesas', collectionName: 'despesas' } as any,
        d.comprovante,
      )
    } catch {
      return ''
    }
  }

  const cards = [
    {
      label: 'Total de Despesas no Mês',
      value: metricas.totalMes,
      icon: ArrowDownCircle,
      color: 'bg-slate-50 text-slate-700',
    },
    {
      label: 'Despesas Pagas',
      value: metricas.pagas,
      icon: CheckCircle2,
      color: 'bg-emerald-50 text-emerald-700',
    },
    {
      label: 'Despesas a Pagar',
      value: metricas.aPagar,
      icon: Clock,
      color: 'bg-blue-50 text-blue-700',
    },
    {
      label: 'Despesas Vencidas',
      value: metricas.vencido,
      icon: AlertTriangle,
      color: 'bg-red-50 text-red-700',
    },
  ]

  return (
    <div className="space-y-5 animate-in fade-in-50 duration-200">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-rose-50 flex items-center justify-center">
            <ArrowDownCircle className="w-6 h-6 text-rose-600" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Despesas</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Controle de despesas da clínica — integração automática com o caixa
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={openNova} className="rounded-xl text-sm bg-rose-600 hover:bg-rose-700">
            <Plus className="w-4 h-4 mr-1.5" /> Nova Despesa
          </Button>
          <Button onClick={() => fetchDespesas()} variant="outline" className="rounded-xl text-sm">
            <RefreshCw className="w-4 h-4 mr-1.5" /> Atualizar
          </Button>
        </div>
      </div>

      {/* Cards de métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.label} className="p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium">{card.label}</p>
                  <p className="text-xl font-extrabold text-slate-900 mt-1">
                    {formatCurrency(card.value)}
                  </p>
                </div>
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.color}`}
                >
                  <Icon className="w-5 h-5" />
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por descrição..."
              className="h-9 rounded-lg text-sm pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 rounded-lg text-sm w-full sm:w-44">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {(Object.keys(DESPESA_STATUS_LABELS) as DespesaStatus[]).map((v) => (
                <SelectItem key={v} value={v}>
                  {DESPESA_STATUS_LABELS[v]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
            <SelectTrigger className="h-9 rounded-lg text-sm w-full sm:w-44">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {(Object.keys(DESPESA_CATEGORIA_LABELS) as DespesaCategoria[]).map((v) => (
                <SelectItem key={v} value={v}>
                  {DESPESA_CATEGORIA_LABELS[v]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={formaFilter} onValueChange={setFormaFilter}>
            <SelectTrigger className="h-9 rounded-lg text-sm w-full sm:w-44">
              <SelectValue placeholder="Forma de pagamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as formas</SelectItem>
              {(Object.keys(DESPESA_FORMA_PAGAMENTO_LABELS) as DespesaFormaPagamento[]).map((v) => (
                <SelectItem key={v} value={v}>
                  {DESPESA_FORMA_PAGAMENTO_LABELS[v]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1">
            <Label className="text-xs font-semibold text-slate-600 mb-1 block">
              Vencimento a partir de
            </Label>
            <Input
              type="date"
              value={vencInicio}
              onChange={(e) => setVencInicio(e.target.value)}
              className="h-9 rounded-lg text-sm"
            />
          </div>
          <div className="flex-1">
            <Label className="text-xs font-semibold text-slate-600 mb-1 block">
              Vencimento até
            </Label>
            <Input
              type="date"
              value={vencFim}
              onChange={(e) => setVencFim(e.target.value)}
              className="h-9 rounded-lg text-sm"
            />
          </div>
          <Button onClick={handleExport} variant="outline" className="rounded-xl text-sm">
            <Download className="w-4 h-4 mr-1.5" /> Exportar CSV
          </Button>
          {(vencInicio ||
            vencFim ||
            statusFilter !== 'all' ||
            categoriaFilter !== 'all' ||
            formaFilter !== 'all' ||
            search) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setVencInicio('')
                setVencFim('')
                setStatusFilter('all')
                setCategoriaFilter('all')
                setFormaFilter('all')
                setSearch('')
              }}
              className="text-xs"
            >
              Limpar filtros
            </Button>
          )}
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="text-xs uppercase tracking-wider">Vencimento</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Descrição</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Categoria</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-right">Valor</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Forma Pgto</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Status</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Data Pgto</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-12 text-center text-slate-400">
                    <ArrowDownCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    Nenhuma despesa encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                pageItems.map((d) => {
                  const st = statusEfetivo(d)
                  return (
                    <TableRow key={d.id} className="hover:bg-slate-50/60">
                      <TableCell className="text-slate-600 whitespace-nowrap">
                        {formatDate(d.data_vencimento)}
                      </TableCell>
                      <TableCell className="font-semibold text-slate-900">
                        <div
                          className="flex items-center gap-1.5 max-w-[260px] truncate"
                          title={d.descricao}
                        >
                          {d.comprovante && (
                            <Paperclip className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          )}
                          <span className="truncate">{d.descricao}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-600 whitespace-nowrap">
                        {DESPESA_CATEGORIA_LABELS[d.categoria]}
                      </TableCell>
                      <TableCell className="text-right text-slate-900 font-semibold whitespace-nowrap">
                        {formatCurrency(d.valor)}
                        {Number(d.valor_pago) > 0 && Number(d.valor_pago) < Number(d.valor) && (
                          <span className="block text-[11px] text-emerald-600 font-medium">
                            Pago {formatCurrency(d.valor_pago)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-600 whitespace-nowrap">
                        {d.forma_pagamento
                          ? DESPESA_FORMA_PAGAMENTO_LABELS[d.forma_pagamento]
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_BADGE_CLASS[st]}>
                          {DESPESA_STATUS_LABELS[st]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-600 whitespace-nowrap">
                        {d.data_pagamento ? formatDate(d.data_pagamento) : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {st !== 'pago' && st !== 'cancelado' && (
                            <button
                              onClick={() => openPagar(d)}
                              title="Marcar como Pago"
                              className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => openEditar(d)}
                            title="Editar"
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {st !== 'cancelado' && (
                            <button
                              onClick={() => openCancelar(d)}
                              title="Cancelar"
                              className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-sm">
            <span className="text-slate-500">
              {filtered.length} despesa(s) — página {currentPage} de {totalPages}
            </span>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                disabled={currentPage <= 1}
                onClick={() => setPage(currentPage - 1)}
                className="rounded-lg"
              >
                Anterior
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={currentPage >= totalPages}
                onClick={() => setPage(currentPage + 1)}
                className="rounded-lg"
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ===== Modal Nova/Editar Despesa ===== */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
          <DialogHeader className="border-b border-slate-100 pb-3">
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <ArrowDownCircle className="w-5 h-5 text-rose-600" />
              {editingId ? 'Editar Despesa' : 'Nova Despesa'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {editingId
                ? 'Altere os campos abaixo e salve.'
                : 'Preencha os dados da despesa. Comprovante é opcional.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-3">
            <div>
              <Label className="text-xs font-semibold text-slate-600 mb-1 block">Descrição *</Label>
              <Input
                value={fDescricao}
                onChange={(e) => setFDescricao(e.target.value)}
                placeholder="Ex: Aluguel do consultório"
                className="h-9 rounded-lg text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-600 mb-1 block">
                  Valor (R$) *
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  value={fValor}
                  onChange={(e) => setFValor(e.target.value)}
                  className="h-9 rounded-lg text-sm"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-600 mb-1 block">
                  Data Vencimento *
                </Label>
                <Input
                  type="date"
                  value={fVencimento}
                  onChange={(e) => setFVencimento(e.target.value)}
                  className="h-9 rounded-lg text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-600 mb-1 block">Categoria</Label>
                <Select
                  value={fCategoria}
                  onValueChange={(v) => setFCategoria(v as DespesaCategoria)}
                >
                  <SelectTrigger className="h-9 rounded-lg text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(DESPESA_CATEGORIA_LABELS) as DespesaCategoria[]).map((v) => (
                      <SelectItem key={v} value={v}>
                        {DESPESA_CATEGORIA_LABELS[v]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-600 mb-1 block">
                  Forma de Pagamento
                </Label>
                <Select value={fForma} onValueChange={(v) => setFForma(v as DespesaFormaPagamento)}>
                  <SelectTrigger className="h-9 rounded-lg text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(DESPESA_FORMA_PAGAMENTO_LABELS) as DespesaFormaPagamento[]).map(
                      (v) => (
                        <SelectItem key={v} value={v}>
                          {DESPESA_FORMA_PAGAMENTO_LABELS[v]}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-600 mb-1 block">
                Comprovante (imagem/PDF) — opcional
              </Label>
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                onChange={(e) => {
                  setFComprovante(e.target.files?.[0] || null)
                  setFComprovanteNome(e.target.files?.[0]?.name || '')
                }}
                className="h-9 rounded-lg text-sm file:mr-3 file:py-1 file:px-2 file:rounded file:border-0 file:bg-slate-100 file:text-slate-700"
              />
              {fComprovanteNome && !fComprovante && editingId && despesaSel?.comprovante && (
                <a
                  href={comprovanteUrl(despesaSel)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-teal-600 hover:underline mt-1 inline-flex items-center gap-1"
                >
                  <Paperclip className="w-3 h-3" /> {fComprovanteNome}
                </a>
              )}
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-600 mb-1 block">Observações</Label>
              <Textarea
                value={fObs}
                onChange={(e) => setFObs(e.target.value)}
                className="rounded-lg text-sm min-h-[70px]"
                placeholder="Anotações adicionais..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              onClick={submitForm}
              disabled={saving}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Modal Marcar como Pago ===== */}
      <Dialog open={pagarOpen} onOpenChange={setPagarOpen}>
        <DialogContent className="max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
          <DialogHeader className="border-b border-slate-100 pb-3">
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Check className="w-5 h-5 text-emerald-600" />
              Marcar como Pago
            </DialogTitle>
            <DialogDescription className="text-xs">{despesaSel?.descricao}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-3">
            <div className="bg-slate-50 rounded-lg p-3 text-sm flex justify-between">
              <span className="text-slate-500">Valor restante:</span>
              <span className="font-bold text-slate-900">
                {formatCurrency(
                  (Number(despesaSel?.valor) || 0) - (Number(despesaSel?.valor_pago) || 0),
                )}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-600 mb-1 block">
                  Data Pagamento *
                </Label>
                <Input
                  type="date"
                  value={pData}
                  onChange={(e) => setPData(e.target.value)}
                  className="h-9 rounded-lg text-sm"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-600 mb-1 block">
                  Valor pago *
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  value={pValor}
                  onChange={(e) => setPValor(e.target.value)}
                  className="h-9 rounded-lg text-sm"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-600 mb-1 block">
                Forma de Pagamento *
              </Label>
              <Select value={pForma} onValueChange={(v) => setPForma(v as DespesaFormaPagamento)}>
                <SelectTrigger className="h-9 rounded-lg text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(DESPESA_FORMA_PAGAMENTO_LABELS) as DespesaFormaPagamento[]).map(
                    (v) => (
                      <SelectItem key={v} value={v}>
                        {DESPESA_FORMA_PAGAMENTO_LABELS[v]}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-600 mb-1 block">Observações</Label>
              <Textarea
                value={pObs}
                onChange={(e) => setPObs(e.target.value)}
                className="rounded-lg text-sm min-h-[60px]"
              />
            </div>
            <p className="text-[11px] text-slate-500">
              Pagamento parcial mantém o status “A Pagar”. Quitação total muda para “Pago” e gera
              saída automática no caixa.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPagarOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              onClick={submitPagar}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {saving ? 'Salvando...' : 'Confirmar Pagamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Modal Cancelar Despesa ===== */}
      <Dialog open={cancelarOpen} onOpenChange={setCancelarOpen}>
        <DialogContent className="max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
          <DialogHeader className="border-b border-slate-100 pb-3">
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <X className="w-5 h-5 text-red-500" />
              Cancelar Despesa
            </DialogTitle>
            <DialogDescription className="text-xs">{despesaSel?.descricao}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-3">
            {Number(despesaSel?.valor_pago) > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                Esta despesa já possui pagamentos registrados (R${' '}
                {Number(despesaSel?.valor_pago || 0).toFixed(2)}). O cancelamento gerará um estorno
                de entrada no caixa e será registrado na auditoria.
              </div>
            )}
            <div>
              <Label className="text-xs font-semibold text-slate-600 mb-1 block">
                Motivo do cancelamento *
              </Label>
              <Textarea
                value={cMotivo}
                onChange={(e) => setCMotivo(e.target.value)}
                className="rounded-lg text-sm min-h-[80px]"
                placeholder="Descreva o motivo..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelarOpen(false)} disabled={saving}>
              Fechar
            </Button>
            <Button onClick={submitCancelar} disabled={saving} variant="destructive">
              {saving ? 'Cancelando...' : 'Confirmar Cancelamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
