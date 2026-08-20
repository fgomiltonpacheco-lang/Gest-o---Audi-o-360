import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Wallet,
  TrendingDown,
  Clock,
  CheckCircle2,
  Search,
  DollarSign,
  Eye,
  RefreshCw,
  XCircle,
  Plus,
  Trash2,
  PackagePlus,
  Percent,
  ChevronsUpDown,
  Check,
} from 'lucide-react'
import pb from '@/lib/pocketbase/client'
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { formatCurrency, formatDate } from '@/lib/formatters'
import {
  addDays,
  todayStr,
  diasEmAtraso,
  statusEfetivo,
  STATUS_BADGE_CLASS,
} from '@/lib/contasReceber'
import {
  CONTA_RECEBER_STATUS_LABELS,
  CONTA_RECEBER_FORMA_LABELS,
  FORMA_RECEBIMENTO_LABELS,
  type ContaReceber,
  type ContaReceberStatus,
  type FormaRecebimento,
  type Recebimento,
} from '@/types'
type StatusFilter = 'all' | ContaReceberStatus

/** Gera um id único para um item extra do recebimento (chave de lista). */
const novoItemId = () => `ie-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

export default function ContasReceberPage() {
  const {
    contasReceber,
    fetchContasReceber,
    registrarRecebimento,
    renegociarConta,
    cancelarConta,
    fetchRecebimentos,
  } = useApp()
  const { toast } = useToast()

  // ---- Filtros ----
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [formaFilter, setFormaFilter] = useState<string>('all')
  const [vencInicio, setVencInicio] = useState('')
  const [vencFim, setVencFim] = useState('')

  // ---- Modais ----
  const [recebimentoOpen, setRecebimentoOpen] = useState(false)
  const [detalhesOpen, setDetalhesOpen] = useState(false)
  const [renegociarOpen, setRenegociarOpen] = useState(false)
  const [cancelarOpen, setCancelarOpen] = useState(false)
  const [contaSelecionada, setContaSelecionada] = useState<ContaReceber | null>(null)
  const [recebimentos, setRecebimentos] = useState<Recebimento[]>([])

  // ---- Forms ----
  const [recValor, setRecValor] = useState('')
  const [recData, setRecData] = useState(todayStr())
  const [recForma, setRecForma] = useState<FormaRecebimento>('pix')
  const [recObs, setRecObs] = useState('')
  const [saving, setSaving] = useState(false)

  // ---- Itens extras + desconto (Registrar Recebimento) ----
  const [recItensExtras, setRecItensExtras] = useState<
    Array<{ id: string; nome: string; quantidade: string; valor_unitario: string }>
  >([])
  const [recDescontoTipo, setRecDescontoTipo] = useState<'valor' | 'percentual'>('valor')
  const [recDescontoValor, setRecDescontoValor] = useState('')

  // Catálogo de itens disponíveis (inventory + procedures) para o combobox
  const [catalogoItens, setCatalogoItens] = useState<
    Array<{
      id: string
      name: string
      price: number
      type: 'inventory' | 'procedure'
    }>
  >([])
  const [popoverAbertoIdx, setPopoverAbertoIdx] = useState<number | null>(null)

  useEffect(() => {
    let ativo = true
    async function carregarCatalogo() {
      try {
        const [invRes, procRes] = await Promise.all([
          pb
            .collection('inventory')
            .getFullList({ sort: 'name' })
            .catch((err) => {
              console.error('Erro ao buscar estoque (inventory) para catálogo de recebimento:', err)
              return []
            }),
          pb
            .collection('procedures')
            .getFullList({ filter: 'active = true', sort: 'name' })
            .catch((err) => {
              console.error(
                'Erro ao buscar procedimentos (procedures) para catálogo de recebimento:',
                err,
              )
              return []
            }),
        ])
        if (!ativo) return
        const itensInv = (invRes || []).map((i: any) => ({
          id: `inv-${i.id}`,
          name: i.name + (i.brand ? ` (${i.brand})` : ''),
          price: Number(i.salePrice) || 0,
          type: 'inventory' as const,
        }))
        const itensProc = (procRes || []).map((p: any) => ({
          id: `proc-${p.id}`,
          name: p.name,
          price: Number(p.valueParticular ?? p.value ?? 0),
          type: 'procedure' as const,
        }))
        setCatalogoItens([...itensInv, ...itensProc])
      } catch (err) {
        console.error('Erro geral ao carregar catálogo para recebimento:', err)
      }
    }
    carregarCatalogo()
    return () => {
      ativo = false
    }
  }, [])

  const [renVenc, setRenVenc] = useState('')
  const [renValor, setRenValor] = useState('')
  const [renParcelas, setRenParcelas] = useState('1')
  const [renMotivo, setRenMotivo] = useState('')

  const [cancelMotivo, setCancelMotivo] = useState('')

  useEffect(() => {
    fetchContasReceber()
  }, [fetchContasReceber])

  // ---- Métricas dos cards ----
  const metricas = useMemo(() => {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
    const limite7 = addDays(todayStr(), 7)

    let totalReceber = 0
    let recebidoMes = 0
    let vencido = 0
    let vencendo7 = 0

    contasReceber.forEach((c) => {
      const st = statusEfetivo(c)
      if (st === 'cancelado' || st === 'renegociado') return
      totalReceber += c.valor_restante
      if (st === 'vencido') vencido += c.valor_restante
      if (
        st !== 'vencido' &&
        st !== 'recebido_total' &&
        c.data_vencimento >= todayStr() &&
        c.data_vencimento <= limite7
      ) {
        vencendo7 += c.valor_restante
      }
      // Recebido no mês: soma dos recebimentos (aproximado pelo valor_recebido + data_recebimento)
      if (c.data_recebimento && c.data_recebimento >= inicioMes.toISOString().split('T')[0]) {
        recebidoMes += c.valor_recebido
      }
    })

    return { totalReceber, recebidoMes, vencido, vencendo7 }
  }, [contasReceber])

  // ---- Lista filtrada ----
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return contasReceber.filter((c) => {
      const st = statusEfetivo(c)
      if (statusFilter !== 'all' && st !== statusFilter) return false
      if (formaFilter !== 'all' && c.forma_pagamento !== formaFilter) return false
      if (vencInicio && c.data_vencimento < vencInicio) return false
      if (vencFim && c.data_vencimento > vencFim) return false
      if (q) {
        const blob = `${c.cliente_nome} ${c.descricao} ${c.venda_id}`.toLowerCase()
        if (!blob.includes(q)) return false
      }
      return true
    })
  }, [contasReceber, search, statusFilter, formaFilter, vencInicio, vencFim])

  // ---- Itens extras + desconto (Registrar Recebimento) ----
  const recObsAutoRef = useRef('')
  const recItensParsed = useMemo(
    () =>
      recItensExtras.map((i) => {
        const qtd = Math.max(0, Number((i.quantidade || '0').replace(',', '.')) || 0)
        const vu = Math.max(0, Number((i.valor_unitario || '0').replace(',', '.')) || 0)
        return { id: i.id, nome: i.nome, quantidade: qtd, valor_unitario: vu, subtotal: qtd * vu }
      }),
    [recItensExtras],
  )
  const recSubtotalExtras = useMemo(
    () => recItensParsed.reduce((s, i) => s + i.subtotal, 0),
    [recItensParsed],
  )
  const recValorBase = contaSelecionada?.valor_restante ?? 0
  const recDescontoValorNum = useMemo(() => {
    const v = Number((recDescontoValor || '').replace(',', '.')) || 0
    return Math.max(0, v)
  }, [recDescontoValor])
  const recDescontoRS = useMemo(() => {
    if (recDescontoTipo === 'percentual') {
      return (recValorBase + recSubtotalExtras) * (recDescontoValorNum / 100)
    }
    return recDescontoValorNum
  }, [recDescontoTipo, recDescontoValorNum, recValorBase, recSubtotalExtras])
  const recTotalReceber = useMemo(
    () => Math.max(0, recValorBase + recSubtotalExtras - recDescontoRS),
    [recValorBase, recSubtotalExtras, recDescontoRS],
  )
  const resumoItens = useMemo(() => {
    const validos = recItensParsed.filter(
      (i) => i.nome.trim() && i.quantidade > 0 && i.valor_unitario > 0,
    )
    if (validos.length === 0) return ''
    const partes = validos.map(
      (i) =>
        `${i.nome.trim()} (${i.quantidade.toLocaleString('pt-BR')}x ${formatCurrency(i.valor_unitario)})`,
    )
    return `Acrescido: ${partes.join(' + ')}`
  }, [recItensParsed])

  // Observações automáticas: prefixa o resumo dos itens, preservando o texto
  // que a secretária digitou manualmente abaixo do resumo.
  useEffect(() => {
    const novoAuto = resumoItens
    setRecObs((prev) => {
      let manual = prev
      const antigo = recObsAutoRef.current
      if (antigo && prev.startsWith(antigo)) {
        manual = prev.slice(antigo.length).replace(/^\n/, '')
      }
      recObsAutoRef.current = novoAuto
      if (!novoAuto) return manual
      return manual ? `${novoAuto}\n${manual}` : novoAuto
    })
  }, [resumoItens])

  // Sincroniza o campo "Valor a receber" com o total calculado em tempo real.
  useEffect(() => {
    setRecValor(recTotalReceber.toFixed(2))
  }, [recTotalReceber])

  // ---- Handlers ----
  const openRecebimento = (c: ContaReceber) => {
    setContaSelecionada(c)
    setRecValor(c.valor_restante.toFixed(2))
    setRecData(todayStr())
    setRecForma('pix')
    setRecObs('')
    setRecItensExtras([])
    setRecDescontoTipo('valor')
    setRecDescontoValor('')
    recObsAutoRef.current = ''
    setRecebimentoOpen(true)
  }

  const openDetalhes = async (c: ContaReceber) => {
    setContaSelecionada(c)
    setDetalhesOpen(true)
    const list = await fetchRecebimentos(c.id)
    setRecebimentos(list)
  }

  const openRenegociar = (c: ContaReceber) => {
    setContaSelecionada(c)
    setRenVenc(addDays(todayStr(), 30))
    setRenValor(c.valor_restante.toFixed(2))
    setRenParcelas('1')
    setRenMotivo('')
    setRenegociarOpen(true)
  }

  const openCancelar = (c: ContaReceber) => {
    setContaSelecionada(c)
    setCancelMotivo('')
    setCancelarOpen(true)
  }

  const submitRecebimento = async () => {
    if (!contaSelecionada) return
    setSaving(true)
    const valorBase = contaSelecionada.valor_restante
    const itensParaSalvar = recItensParsed
      .filter((i) => i.nome.trim() && i.quantidade > 0 && i.valor_unitario > 0)
      .map((i) => ({
        nome: i.nome.trim(),
        quantidade: i.quantidade,
        valor_unitario: i.valor_unitario,
        subtotal: i.subtotal,
      }))
    const temExtras = itensParaSalvar.length > 0 || recDescontoRS > 0
    const valorTotal = recTotalReceber
    const res = await registrarRecebimento(contaSelecionada.id, {
      // Com extras/desconto, registra o total; sem eles, o valor digitado.
      valor: temExtras ? valorTotal : Number(recValor.replace(',', '.')),
      data_recebimento: recData,
      forma_recebimento: recForma,
      observacoes: recObs,
      valor_base: valorBase,
      itens_extras: itensParaSalvar,
      desconto_tipo: recDescontoRS > 0 ? recDescontoTipo : '',
      desconto_valor: recDescontoRS > 0 ? recDescontoValorNum : 0,
      valor_total: valorTotal,
    })
    setSaving(false)
    if (res.success) {
      setRecebimentoOpen(false)
    } else {
      toast({ title: 'Erro', description: res.message, variant: 'destructive' })
    }
  }

  const submitRenegociar = async () => {
    if (!contaSelecionada) return
    setSaving(true)
    const res = await renegociarConta(contaSelecionada.id, {
      novo_vencimento: renVenc,
      novo_valor: Number(renValor.replace(',', '.')),
      novo_numero_parcelas: Number(renParcelas) || 1,
      motivo: renMotivo,
    })
    setSaving(false)
    if (res.success) {
      setRenegociarOpen(false)
    } else {
      toast({ title: 'Erro', description: res.message, variant: 'destructive' })
    }
  }

  const submitCancelar = async () => {
    if (!contaSelecionada) return
    setSaving(true)
    const res = await cancelarConta(contaSelecionada.id, cancelMotivo)
    setSaving(false)
    if (res.success) {
      setCancelarOpen(false)
    } else {
      toast({ title: 'Erro', description: res.message, variant: 'destructive' })
    }
  }

  const cards = [
    {
      label: 'Total a Receber',
      value: metricas.totalReceber,
      icon: Wallet,
      color: 'bg-blue-50 text-blue-700',
    },
    {
      label: 'Recebido no Mês',
      value: metricas.recebidoMes,
      icon: CheckCircle2,
      color: 'bg-emerald-50 text-emerald-700',
    },
    {
      label: 'Vencido',
      value: metricas.vencido,
      icon: TrendingDown,
      color: 'bg-red-50 text-red-700',
    },
    {
      label: 'Vencendo em 7 dias',
      value: metricas.vencendo7,
      icon: Clock,
      color: 'bg-amber-50 text-amber-700',
    },
  ]

  return (
    <div className="space-y-5 animate-in fade-in-50 duration-200">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-teal-50 flex items-center justify-center">
            <Wallet className="w-6 h-6 text-teal-700" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Contas a Receber
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Controle de vendas a prazo — Convênio, Boleto, Parcelado e Promissória
            </p>
          </div>
        </div>
        <Button
          onClick={() => fetchContasReceber()}
          variant="outline"
          className="rounded-xl text-sm"
        >
          <RefreshCw className="w-4 h-4 mr-1.5" /> Atualizar
        </Button>
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
              placeholder="Buscar por cliente, descrição ou venda..."
              className="h-9 rounded-lg text-sm pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="h-9 rounded-lg text-sm w-full sm:w-44">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {Object.entries(CONTA_RECEBER_STATUS_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={formaFilter} onValueChange={setFormaFilter}>
            <SelectTrigger className="h-9 rounded-lg text-sm w-full sm:w-44">
              <SelectValue placeholder="Forma" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as formas</SelectItem>
              {Object.entries(CONTA_RECEBER_FORMA_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
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
          {(vencInicio || vencFim || statusFilter !== 'all' || formaFilter !== 'all' || search) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setVencInicio('')
                setVencFim('')
                setStatusFilter('all')
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
                <TableHead className="text-xs uppercase tracking-wider">Venda</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Cliente</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Descrição</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-right">
                  Vl. Original
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-right">
                  Recebido
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-right">
                  Restante
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Vencimento</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Status</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-center">
                  Dias Atraso
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-12 text-center text-slate-400">
                    <Wallet className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    Nenhuma conta a receber encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((c) => {
                  const st = statusEfetivo(c)
                  const dias = diasEmAtraso(c)
                  return (
                    <TableRow key={c.id} className="hover:bg-slate-50/60">
                      <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                        <span className="font-medium">{c.venda_origem.toUpperCase()}</span>
                        <br />
                        <span className="text-slate-400">{c.venda_id.slice(0, 8)}</span>
                      </TableCell>
                      <TableCell className="font-semibold text-slate-900">
                        {c.cliente_nome || '—'}
                      </TableCell>
                      <TableCell
                        className="text-slate-600 max-w-[220px] truncate"
                        title={c.descricao}
                      >
                        {c.descricao}
                        {c.numero_parcelas > 1 && (
                          <span className="text-xs text-slate-400 ml-1">
                            ({c.parcela_atual}/{c.numero_parcelas})
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-slate-700 whitespace-nowrap">
                        {formatCurrency(c.valor_original)}
                      </TableCell>
                      <TableCell className="text-right text-emerald-700 whitespace-nowrap">
                        {formatCurrency(c.valor_recebido)}
                      </TableCell>
                      <TableCell className="text-right text-slate-900 font-semibold whitespace-nowrap">
                        {formatCurrency(c.valor_restante)}
                      </TableCell>
                      <TableCell className="text-slate-600 whitespace-nowrap">
                        {formatDate(c.data_vencimento)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_BADGE_CLASS[st]}>
                          {CONTA_RECEBER_STATUS_LABELS[st]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {dias > 0 ? (
                          <span className="text-red-600 font-semibold text-sm">{dias}</span>
                        ) : (
                          <span className="text-slate-400 text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {st !== 'recebido_total' &&
                            st !== 'cancelado' &&
                            st !== 'renegociado' && (
                              <button
                                onClick={() => openRecebimento(c)}
                                title="Registrar Recebimento"
                                className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50"
                              >
                                <DollarSign className="w-4 h-4" />
                              </button>
                            )}
                          <button
                            onClick={() => openDetalhes(c)}
                            title="Ver Detalhes"
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {st !== 'recebido_total' &&
                            st !== 'cancelado' &&
                            st !== 'renegociado' && (
                              <>
                                <button
                                  onClick={() => openRenegociar(c)}
                                  title="Renegociar"
                                  className="p-1.5 rounded-lg text-purple-600 hover:bg-purple-50"
                                >
                                  <RefreshCw className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => openCancelar(c)}
                                  title="Cancelar"
                                  className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              </>
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
      </div>

      {/* ===== Modal: Registrar Recebimento ===== */}
      <Dialog open={recebimentoOpen} onOpenChange={setRecebimentoOpen}>
        <DialogContent className="max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
          <DialogHeader className="border-b border-slate-100 pb-3">
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              Registrar Recebimento
            </DialogTitle>
            <DialogDescription className="text-xs">
              {contaSelecionada?.cliente_nome} — {contaSelecionada?.descricao}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-3">
            {/* Valor base (restante) */}
            <div className="bg-slate-50 rounded-lg p-3 text-sm flex justify-between">
              <span className="text-slate-500">Valor restante da conta:</span>
              <span className="font-bold text-slate-900">
                {formatCurrency(contaSelecionada?.valor_restante || 0)}
              </span>
            </div>

            {/* Data + Forma */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-600 mb-1 block">
                  Data do recebimento *
                </Label>
                <Input
                  type="date"
                  value={recData}
                  onChange={(e) => setRecData(e.target.value)}
                  className="h-9 rounded-lg text-sm"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-600 mb-1 block">
                  Forma de recebimento *
                </Label>
                <Select value={recForma} onValueChange={(v) => setRecForma(v as FormaRecebimento)}>
                  <SelectTrigger className="h-9 rounded-lg text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(FORMA_RECEBIMENTO_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* ===== Acrescentar Produtos/Procedimentos ===== */}
            <div className="border border-slate-200 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-slate-700">
                  <PackagePlus className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm font-semibold">Acrescentar Produtos/Procedimentos</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setRecItensExtras((prev) => {
                      const newIdx = prev.length
                      // Abre o popover automaticamente para o novo item
                      setTimeout(() => setPopoverAbertoIdx(newIdx), 50)
                      return [
                        ...prev,
                        { id: novoItemId(), nome: '', quantidade: '1', valor_unitario: '' },
                      ]
                    })
                  }}
                  className="h-7 rounded-lg text-xs"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar item
                </Button>
              </div>

              {recItensExtras.length === 0 ? (
                <p className="text-xs text-slate-400 py-1">
                  Nenhum item adicional. Clique em &quot;Adicionar item&quot; para incluir produtos
                  ou procedimentos ao recebimento.
                </p>
              ) : (
                <div className="space-y-2">
                  {recItensExtras.map((item, idx) => {
                    const parsed = recItensParsed[idx]
                    return (
                      <div
                        key={item.id}
                        className="rounded-lg border border-slate-200 bg-slate-50/50 p-2 space-y-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-slate-400 w-5">
                            {idx + 1}.
                          </span>
                          <div className="flex-1 min-w-0">
                            <Popover
                              open={popoverAbertoIdx === idx}
                              onOpenChange={(open) => setPopoverAbertoIdx(open ? idx : null)}
                            >
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  aria-expanded={popoverAbertoIdx === idx}
                                  className="w-full h-8 justify-between text-left text-xs font-normal rounded-md border-slate-300 px-2.5 bg-white"
                                >
                                  <span className="truncate">
                                    {item.nome || 'Selecione um produto ou procedimento...'}
                                  </span>
                                  <ChevronsUpDown className="ml-1.5 h-3.5 w-3.5 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[320px] sm:w-[380px] p-0" align="start">
                                <Command
                                  filter={(value, search) => {
                                    if (!search) return 1
                                    return value.toLowerCase().includes(search.toLowerCase())
                                      ? 1
                                      : 0
                                  }}
                                >
                                  <CommandInput
                                    placeholder="Buscar produto ou procedimento..."
                                    className="h-8 text-xs"
                                  />
                                  <CommandList className="max-h-56">
                                    <CommandEmpty className="py-2.5 text-center text-xs text-slate-400">
                                      Nenhum item encontrado.
                                    </CommandEmpty>
                                    <CommandGroup heading="Produtos e Procedimentos">
                                      {catalogoItens.length === 0 ? (
                                        <div className="py-2 text-center text-xs text-slate-400">
                                          Nenhum produto ou procedimento cadastrado.
                                        </div>
                                      ) : (
                                        catalogoItens.map((cat) => (
                                          <CommandItem
                                            key={cat.id}
                                            value={`${cat.name} ${cat.type === 'inventory' ? 'produto estoque' : 'procedimento'}`}
                                            onSelect={() => {
                                              setRecItensExtras((prev) =>
                                                prev.map((p) =>
                                                  p.id === item.id
                                                    ? {
                                                        ...p,
                                                        nome: cat.name,
                                                        valor_unitario: cat.price.toFixed(2),
                                                      }
                                                    : p,
                                                ),
                                              )
                                              setPopoverAbertoIdx(null)
                                            }}
                                            className="text-xs flex items-center justify-between cursor-pointer py-1.5"
                                          >
                                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                              <Check
                                                className={`h-3.5 w-3.5 shrink-0 ${
                                                  item.nome === cat.name
                                                    ? 'opacity-100'
                                                    : 'opacity-0'
                                                }`}
                                              />
                                              <span className="truncate">
                                                {cat.type === 'inventory' ? '📦 ' : '🩺 '}
                                                {cat.name}
                                              </span>
                                            </div>
                                            <span className="font-bold text-teal-700 shrink-0 ml-2">
                                              {formatCurrency(cat.price)}
                                            </span>
                                          </CommandItem>
                                        ))
                                      )}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setRecItensExtras((prev) => prev.filter((p) => p.id !== item.id))
                            }
                            title="Remover item"
                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2 pl-7">
                          <div>
                            <Label className="text-[10px] font-semibold text-slate-500 mb-0.5 block">
                              Quantidade
                            </Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.001"
                              value={item.quantidade}
                              onChange={(e) =>
                                setRecItensExtras((prev) =>
                                  prev.map((p) =>
                                    p.id === item.id ? { ...p, quantidade: e.target.value } : p,
                                  ),
                                )
                              }
                              className="h-8 rounded-md text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-[10px] font-semibold text-slate-500 mb-0.5 block">
                              Valor unitário (R$)
                            </Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.valor_unitario}
                              onChange={(e) =>
                                setRecItensExtras((prev) =>
                                  prev.map((p) =>
                                    p.id === item.id ? { ...p, valor_unitario: e.target.value } : p,
                                  ),
                                )
                              }
                              className="h-8 rounded-md text-sm"
                            />
                          </div>
                        </div>
                        <div className="pl-7 flex justify-end">
                          <span className="text-[11px] text-slate-500">
                            Subtotal:{' '}
                            <span className="font-semibold text-slate-700">
                              {formatCurrency(parsed?.subtotal ?? 0)}
                            </span>
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* ===== Desconto ===== */}
            <div className="border border-slate-200 rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-slate-700">
                <Percent className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-semibold">Desconto</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setRecDescontoTipo('valor')}
                    className={`px-3 h-9 text-xs font-semibold ${
                      recDescontoTipo === 'valor'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    R$
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecDescontoTipo('percentual')}
                    className={`px-3 h-9 text-xs font-semibold border-l border-slate-200 ${
                      recDescontoTipo === 'percentual'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    %
                  </button>
                </div>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={recDescontoValor}
                  onChange={(e) => setRecDescontoValor(e.target.value)}
                  placeholder={recDescontoTipo === 'percentual' ? '0' : '0,00'}
                  className="h-9 rounded-lg text-sm flex-1"
                />
                <span className="text-xs text-slate-500 whitespace-nowrap">
                  = {formatCurrency(recDescontoRS)}
                </span>
              </div>
            </div>

            {/* ===== Total em tempo real ===== */}
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 space-y-1">
              <div className="flex justify-between text-xs text-slate-600">
                <span>Valor original da conta</span>
                <span className="font-medium">{formatCurrency(recValorBase)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-600">
                <span>+ Subtotal dos itens extras</span>
                <span className="font-medium">{formatCurrency(recSubtotalExtras)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-600">
                <span>− Desconto</span>
                <span className="font-medium text-red-600">− {formatCurrency(recDescontoRS)}</span>
              </div>
              <div className="border-t border-emerald-200 mt-1 pt-1 flex justify-between items-center">
                <span className="text-sm font-bold text-slate-800">Total a receber</span>
                <span className="text-lg font-extrabold text-emerald-700">
                  {formatCurrency(recTotalReceber)}
                </span>
              </div>
            </div>

            {/* Valor a receber (sincronizado com o total) */}
            <div>
              <Label className="text-xs font-semibold text-slate-600 mb-1 block">
                Valor a receber *
              </Label>
              <Input
                type="number"
                step="0.01"
                value={recValor}
                onChange={(e) => setRecValor(e.target.value)}
                className="h-9 rounded-lg text-sm"
              />
            </div>

            {/* Observações (preenchida automaticamente com o resumo dos itens) */}
            <div>
              <Label className="text-xs font-semibold text-slate-600 mb-1 block">Observações</Label>
              <Textarea
                value={recObs}
                onChange={(e) => setRecObs(e.target.value)}
                className="rounded-lg text-sm min-h-[60px]"
                placeholder="Observações do recebimento..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecebimentoOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              onClick={submitRecebimento}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {saving ? 'Salvando...' : 'Confirmar Recebimento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Modal: Detalhes ===== */}
      <Dialog open={detalhesOpen} onOpenChange={setDetalhesOpen}>
        <DialogContent className="max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
          <DialogHeader className="border-b border-slate-100 pb-3">
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Eye className="w-5 h-5 text-slate-600" />
              Detalhes da Conta
            </DialogTitle>
          </DialogHeader>
          {contaSelecionada && (
            <div className="space-y-3 pt-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <DetalheItem label="Cliente" value={contaSelecionada.cliente_nome} />
                <DetalheItem label="Telefone" value={contaSelecionada.cliente_telefone || '—'} />
                <DetalheItem label="Descrição" value={contaSelecionada.descricao} full />
                <DetalheItem
                  label="Forma de pagamento"
                  value={CONTA_RECEBER_FORMA_LABELS[contaSelecionada.forma_pagamento] || '—'}
                />
                <DetalheItem
                  label="Parcelas"
                  value={`${contaSelecionada.parcela_atual}/${contaSelecionada.numero_parcelas}`}
                />
                <DetalheItem label="Data venda" value={formatDate(contaSelecionada.data_venda)} />
                <DetalheItem
                  label="Vencimento"
                  value={formatDate(contaSelecionada.data_vencimento)}
                />
                <DetalheItem
                  label="Data recebimento"
                  value={
                    contaSelecionada.data_recebimento
                      ? formatDate(contaSelecionada.data_recebimento)
                      : '—'
                  }
                />
                <DetalheItem
                  label="Valor original"
                  value={formatCurrency(contaSelecionada.valor_original)}
                />
                <DetalheItem
                  label="Valor recebido"
                  value={formatCurrency(contaSelecionada.valor_recebido)}
                />
                <DetalheItem
                  label="Valor restante"
                  value={formatCurrency(contaSelecionada.valor_restante)}
                />
                <DetalheItem
                  label="Dias em atraso"
                  value={String(diasEmAtraso(contaSelecionada))}
                />
              </div>
              {contaSelecionada.observacoes && (
                <DetalheItem label="Observações" value={contaSelecionada.observacoes} full />
              )}
              {contaSelecionada.motivo_renegociacao && (
                <DetalheItem
                  label="Motivo renegociação"
                  value={contaSelecionada.motivo_renegociacao}
                  full
                />
              )}
              {contaSelecionada.motivo_cancelamento && (
                <DetalheItem
                  label="Motivo cancelamento"
                  value={contaSelecionada.motivo_cancelamento}
                  full
                />
              )}

              {/* Histórico de recebimentos */}
              <div className="pt-2">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Histórico de Recebimentos
                </p>
                {recebimentos.length === 0 ? (
                  <p className="text-sm text-slate-400">Nenhum recebimento registrado.</p>
                ) : (
                  <div className="space-y-1.5">
                    {recebimentos.map((r) => {
                      const extrasTotal = Array.isArray(r.itens_extras)
                        ? r.itens_extras.reduce((s, it) => s + Number(it.subtotal || 0), 0)
                        : 0
                      const base = Number(r.valor_base || 0)
                      const descRS =
                        r.desconto_tipo === 'percentual'
                          ? (base + extrasTotal) * (Number(r.desconto_valor || 0) / 100)
                          : Number(r.desconto_valor || 0)
                      const temDetalhe =
                        (Array.isArray(r.itens_extras) && r.itens_extras.length > 0) ||
                        (r.desconto_tipo && (Number(r.desconto_valor) || 0) > 0)
                      return (
                        <div
                          key={r.id}
                          className="bg-slate-50 rounded-lg px-3 py-2 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-semibold text-slate-800">
                                {formatCurrency(r.valor)}
                              </span>
                              <span className="text-slate-500 ml-2">
                                {FORMA_RECEBIMENTO_LABELS[r.forma_recebimento]}
                              </span>
                            </div>
                            <div className="text-right">
                              <div className="text-slate-600">{formatDate(r.data_recebimento)}</div>
                              {r.usuario_nome && (
                                <div className="text-slate-400 text-[11px]">
                                  por {r.usuario_nome}
                                </div>
                              )}
                            </div>
                          </div>
                          {temDetalhe && (
                            <div className="text-[11px] text-slate-500 space-y-0.5 pl-2 border-l-2 border-slate-200">
                              {r.valor_base != null && <div>Conta: {formatCurrency(base)}</div>}
                              {Array.isArray(r.itens_extras) && r.itens_extras.length > 0 && (
                                <div>
                                  + Itens:{' '}
                                  {r.itens_extras
                                    .map(
                                      (it) =>
                                        `${it.nome} (${Number(it.quantidade).toLocaleString('pt-BR')}x ${formatCurrency(Number(it.valor_unitario))})`,
                                    )
                                    .join(' + ')}{' '}
                                  = {formatCurrency(extrasTotal)}
                                </div>
                              )}
                              {r.desconto_tipo && (Number(r.desconto_valor) || 0) > 0 && (
                                <div>
                                  − Desconto (
                                  {r.desconto_tipo === 'percentual'
                                    ? `${Number(r.desconto_valor).toLocaleString('pt-BR')}%`
                                    : formatCurrency(Number(r.desconto_valor))}
                                  ): − {formatCurrency(descRS)}
                                </div>
                              )}
                              <div className="font-semibold text-slate-700">
                                = Total: {formatCurrency(r.valor_total ?? r.valor)}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetalhesOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Modal: Renegociar ===== */}
      <Dialog open={renegociarOpen} onOpenChange={setRenegociarOpen}>
        <DialogContent className="max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
          <DialogHeader className="border-b border-slate-100 pb-3">
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-purple-600" />
              Renegociar Conta
            </DialogTitle>
            <DialogDescription className="text-xs">
              A conta atual será marcada como renegociada e uma nova conta será criada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-3">
            <div className="bg-purple-50 rounded-lg p-3 text-sm flex justify-between">
              <span className="text-purple-700">Valor restante atual:</span>
              <span className="font-bold text-purple-900">
                {formatCurrency(contaSelecionada?.valor_restante || 0)}
              </span>
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-600 mb-1 block">
                Novo vencimento *
              </Label>
              <Input
                type="date"
                value={renVenc}
                onChange={(e) => setRenVenc(e.target.value)}
                className="h-9 rounded-lg text-sm"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-600 mb-1 block">
                Novo valor (com desconto, se houver)
              </Label>
              <Input
                type="number"
                step="0.01"
                value={renValor}
                onChange={(e) => setRenValor(e.target.value)}
                className="h-9 rounded-lg text-sm"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-600 mb-1 block">
                Novo número de parcelas
              </Label>
              <Input
                type="number"
                min="1"
                value={renParcelas}
                onChange={(e) => setRenParcelas(e.target.value)}
                className="h-9 rounded-lg text-sm"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-600 mb-1 block">
                Motivo da renegociação *
              </Label>
              <Textarea
                value={renMotivo}
                onChange={(e) => setRenMotivo(e.target.value)}
                className="rounded-lg text-sm min-h-[70px]"
                placeholder="Ex: Cliente solicitou alongamento de prazo..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenegociarOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              onClick={submitRenegociar}
              disabled={saving}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {saving ? 'Salvando...' : 'Confirmar Renegociação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Modal: Cancelar ===== */}
      <Dialog open={cancelarOpen} onOpenChange={setCancelarOpen}>
        <DialogContent className="max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
          <DialogHeader className="border-b border-slate-100 pb-3">
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-600" />
              Cancelar Conta a Receber
            </DialogTitle>
            <DialogDescription className="text-xs">
              O cancelamento exige um motivo e será registrado na auditoria.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-3">
            <div className="bg-red-50 rounded-lg p-3 text-sm flex justify-between">
              <span className="text-red-700">Cliente:</span>
              <span className="font-bold text-red-900">{contaSelecionada?.cliente_nome}</span>
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-600 mb-1 block">
                Motivo do cancelamento *
              </Label>
              <Textarea
                value={cancelMotivo}
                onChange={(e) => setCancelMotivo(e.target.value)}
                className="rounded-lg text-sm min-h-[80px]"
                placeholder="Ex: Venda cancelada pelo cliente, erro de lançamento..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelarOpen(false)} disabled={saving}>
              Voltar
            </Button>
            <Button onClick={submitCancelar} disabled={saving} variant="destructive">
              {saving ? 'Salvando...' : 'Confirmar Cancelamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DetalheItem({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-slate-800 text-sm">{value}</p>
    </div>
  )
}
