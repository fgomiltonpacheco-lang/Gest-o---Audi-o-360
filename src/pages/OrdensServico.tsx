import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Wrench,
  Plus,
  Search,
  Eye,
  Pencil,
  Printer,
  Filter,
  X,
  Loader2,
  ClipboardList,
  Clock,
  CheckCircle2,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency, formatDate } from '@/lib/formatters'
import pb from '@/lib/pocketbase/client'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

// ---- Tipos locais (espelham a collection ordens_servico) ----
interface ExpandedUser {
  id: string
  name?: string
  nome?: string
}
interface ExpandedPatient {
  id: string
  name: string
}
interface ExpandedHearingAid {
  id: string
  marca?: string
  modelo?: string
}
interface OrdemServico {
  id: string
  numero: number | null
  ano: number | null
  paciente: string
  aparelho?: string
  tipo_servico: string
  descricao_problema?: string
  descricao_servico?: string
  status: string
  data_entrada?: string
  data_prevista?: string
  data_saida?: string
  valor?: number | null
  forma_pagamento?: string
  tecnico?: string
  observacoes?: string
  garantia?: boolean
  dias_garantia?: number | null
  motivo_cancelamento?: string
  historico_status?: any
  criado_por?: string
  created: string
  updated: string
  expand?: {
    paciente?: ExpandedPatient
    tecnico?: ExpandedUser
    aparelho?: ExpandedHearingAid
  }
}

const PAGE_SIZE = 10

// ---- Labels e cores ----
const STATUS_LABELS: Record<string, string> = {
  aberta: 'Aberta',
  em_andamento: 'Em Andamento',
  aguardando_aprovacao: 'Aguard. Aprovação',
  aguardando_pecas: 'Aguard. Peças',
  concluida: 'Concluída',
  entregue: 'Entregue',
  cancelada: 'Cancelada',
}

const STATUS_BADGES: Record<string, string> = {
  aberta: 'bg-blue-50 text-blue-700 border-blue-200',
  em_andamento: 'bg-orange-50 text-orange-700 border-orange-200',
  aguardando_aprovacao: 'bg-amber-50 text-amber-700 border-amber-200',
  aguardando_pecas: 'bg-purple-50 text-purple-700 border-purple-200',
  concluida: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  entregue: 'bg-emerald-700 text-white border-emerald-800',
  cancelada: 'bg-slate-100 text-slate-600 border-slate-200',
}

const TIPO_SERVICO_LABELS: Record<string, string> = {
  conserto: 'Conserto',
  manutencao: 'Manutenção',
  revisao: 'Revisão',
  ajuste: 'Ajuste',
  teste_aparelho: 'Teste de Aparelho',
  limpeza: 'Limpeza',
  molde: 'Molde',
  outro: 'Outro',
}

const TIPO_BADGES: Record<string, string> = {
  conserto: 'bg-red-50 text-red-700 border-red-200',
  manutencao: 'bg-amber-50 text-amber-700 border-amber-200',
  revisao: 'bg-blue-50 text-blue-700 border-blue-200',
  ajuste: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  teste_aparelho: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  limpeza: 'bg-teal-50 text-teal-700 border-teal-200',
  molde: 'bg-pink-50 text-pink-700 border-pink-200',
  outro: 'bg-slate-50 text-slate-600 border-slate-200',
}

// Formata Nº OS no padrão ANO/XXX (com zero à esquerda)
function formatNumeroOS(os: OrdemServico): string {
  if (os.ano && os.numero) {
    return `${os.ano}/${String(os.numero).padStart(3, '0')}`
  }
  if (os.numero) return String(os.numero)
  return '—'
}

function getTecnicoNome(os: OrdemServico): string {
  const t = os.expand?.tecnico
  if (!t) return '—'
  return t.name || t.nome || '—'
}

function getPacienteNome(os: OrdemServico): string {
  return os.expand?.paciente?.name || '—'
}

function isMesAtual(dataStr?: string): boolean {
  if (!dataStr) return false
  const d = new Date(dataStr)
  if (isNaN(d.getTime())) return false
  const hoje = new Date()
  return d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear()
}

export default function OrdensServico() {
  const { toast } = useToast()

  const [ordens, setOrdens] = useState<OrdemServico[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  // Filtros
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterTipo, setFilterTipo] = useState('all')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [showFilters, setShowFilters] = useState(true)

  // Detalhe
  const [detailOS, setDetailOS] = useState<OrdemServico | null>(null)

  const carregarOrdens = useCallback(async () => {
    setLoading(true)
    try {
      const res = await pb.collection('ordens_servico').getList<OrdemServico>(1, 500, {
        sort: '-created',
        expand: 'paciente,tecnico,aparelho',
      })
      setOrdens(res.items as unknown as OrdemServico[])
    } catch (err) {
      console.error('Erro ao carregar ordens de serviço:', err)
      toast({
        title: 'Erro ao carregar ordens de serviço.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    carregarOrdens()
  }, [carregarOrdens])

  // ---- Cards de resumo ----
  const totalOS = ordens.length
  const emAberto = useMemo(() => ordens.filter((o) => o.status === 'aberta').length, [ordens])
  const emAndamento = useMemo(
    () => ordens.filter((o) => o.status === 'em_andamento').length,
    [ordens],
  )
  const concluidasMes = useMemo(
    () =>
      ordens.filter(
        (o) =>
          (o.status === 'concluida' || o.status === 'entregue') &&
          isMesAtual(o.data_saida || o.created),
      ).length,
    [ordens],
  )

  // ---- Filtros aplicados ----
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return ordens.filter((o) => {
      // busca por nome do paciente ou nº da OS
      if (q) {
        const nome = getPacienteNome(o).toLowerCase()
        const numStr = formatNumeroOS(o).toLowerCase()
        const numRaw = o.numero != null ? String(o.numero) : ''
        if (!nome.includes(q) && !numStr.includes(q) && !numRaw.includes(q)) return false
      }
      if (filterStatus !== 'all' && o.status !== filterStatus) return false
      if (filterTipo !== 'all' && o.tipo_servico !== filterTipo) return false
      const entrada = (o.data_entrada || '').slice(0, 10)
      if (filterDateFrom && entrada < filterDateFrom) return false
      if (filterDateTo && entrada > filterDateTo) return false
      return true
    })
  }, [ordens, search, filterStatus, filterTipo, filterDateFrom, filterDateTo])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const effectivePage = Math.min(page, totalPages)
  const paged = filtered.slice((effectivePage - 1) * PAGE_SIZE, effectivePage * PAGE_SIZE)

  const hasFilters =
    search || filterStatus !== 'all' || filterTipo !== 'all' || filterDateFrom || filterDateTo

  const clearFilters = () => {
    setSearch('')
    setFilterStatus('all')
    setFilterTipo('all')
    setFilterDateFrom('')
    setFilterDateTo('')
    setPage(1)
  }

  const handlePrint = (os: OrdemServico) => {
    const win = window.open('', '_blank', 'width=800,height=600')
    if (!win) {
      toast({ title: 'Bloqueador de pop-up ativo.', variant: 'destructive' })
      return
    }
    const paciente = getPacienteNome(os)
    const tecnico = getTecnicoNome(os)
    const aparelho = os.expand?.aparelho
    const aparelhoStr = aparelho
      ? [aparelho.marca, aparelho.modelo].filter(Boolean).join(' - ')
      : '—'
    win.document.write(`
      <html>
        <head>
          <title>Ordem de Serviço ${formatNumeroOS(os)}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 32px; color: #1e293b; }
            h1 { color: #0f766e; margin-bottom: 4px; }
            .muted { color: #64748b; font-size: 12px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin: 16px 0; font-size: 13px; }
            .grid div span { color: #64748b; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
            th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
            th { background: #f1f5f9; }
            .total { text-align: right; font-size: 16px; font-weight: bold; margin-top: 12px; color: #0f766e; }
            .footer { margin-top: 32px; display: flex; justify-content: space-between; font-size: 12px; }
            .signature { border-top: 1px solid #475569; width: 220px; padding-top: 6px; text-align: center; }
          </style>
        </head>
        <body>
          <h1>Ordem de Serviço ${formatNumeroOS(os)}</h1>
          <p class="muted">Emitida em ${formatDate(new Date().toISOString())}</p>
          <div class="grid">
            <div><span>Paciente:</span> <strong>${paciente}</strong></div>
            <div><span>Técnico:</span> <strong>${tecnico}</strong></div>
            <div><span>Tipo de Serviço:</span> <strong>${TIPO_SERVICO_LABELS[os.tipo_servico] || os.tipo_servico}</strong></div>
            <div><span>Status:</span> <strong>${STATUS_LABELS[os.status] || os.status}</strong></div>
            <div><span>Data de Entrada:</span> <strong>${formatDate(os.data_entrada)}</strong></div>
            <div><span>Data Prevista:</span> <strong>${formatDate(os.data_prevista)}</strong></div>
            <div><span>Data de Saída:</span> <strong>${formatDate(os.data_saida)}</strong></div>
            <div><span>Aparelho:</span> <strong>${aparelhoStr}</strong></div>
            ${os.garantia ? `<div><span>Garantia:</span> <strong>${os.dias_garantia || 0} dias</strong></div>` : ''}
          </div>
          ${os.descricao_problema ? `<h3>Descrição do Problema</h3><p>${os.descricao_problema}</p>` : ''}
          ${os.descricao_servico ? `<h3>Serviço Realizado</h3><p>${os.descricao_servico}</p>` : ''}
          ${os.observacoes ? `<h3>Observações</h3><p>${os.observacoes}</p>` : ''}
          ${os.motivo_cancelamento ? `<h3 style="color:#dc2626">Motivo de Cancelamento</h3><p>${os.motivo_cancelamento}</p>` : ''}
          <div class="total">Valor: ${formatCurrency(os.valor)}</div>
          <div class="footer">
            <div class="signature">Assinatura do Técnico</div>
            <div class="signature">Assinatura do Cliente</div>
          </div>
        </body>
      </html>
    `)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 300)
  }

  const podeImprimir = (os: OrdemServico) => os.status === 'concluida' || os.status === 'entregue'

  return (
    <div className="space-y-5 animate-in fade-in-50 duration-200">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-teal-50 flex items-center justify-center">
            <Wrench className="w-6 h-6 text-teal-600" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Ordens de Serviço
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Gerenciamento de ordens de serviço — manutenção, conserto e revisão
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => toast({ title: 'Formulário de Nova OS em desenvolvimento.' })}
            className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-sm shadow-sm"
          >
            <Plus className="w-4 h-4 mr-1.5" /> Nova OS
          </Button>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Total de OS
              </p>
              <p className="text-xl font-extrabold text-slate-900 mt-1">{totalOS}</p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center">
              <ClipboardList className="w-4 h-4 text-teal-600" />
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Em Aberto
              </p>
              <p className="text-xl font-extrabold text-blue-700 mt-1">{emAberto}</p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
              <Clock className="w-4 h-4 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Em Andamento
              </p>
              <p className="text-xl font-extrabold text-orange-700 mt-1">{emAndamento}</p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center">
              <Wrench className="w-4 h-4 text-orange-600" />
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Concluídas no Mês
              </p>
              <p className="text-xl font-extrabold text-emerald-700 mt-1">{concluidasMes}</p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setShowFilters((v) => !v)}
            className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 hover:text-teal-600"
          >
            <Filter className="w-4 h-4" /> Filtros
            {hasFilters && <Badge className="bg-teal-100 text-teal-700 ml-1">Ativos</Badge>}
          </button>
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
        </div>
        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 pt-2 border-t border-slate-100">
            <div className="lg:col-span-1">
              <Label className="text-[11px] text-slate-500 mb-1 block">Busca</Label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
                <Input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setPage(1)
                  }}
                  placeholder="Paciente ou nº da OS"
                  className="h-9 rounded-lg text-sm pl-8"
                />
              </div>
            </div>
            <div>
              <Label className="text-[11px] text-slate-500 mb-1 block">Status</Label>
              <Select
                value={filterStatus}
                onValueChange={(v) => {
                  setFilterStatus(v)
                  setPage(1)
                }}
              >
                <SelectTrigger className="h-9 rounded-lg text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11px] text-slate-500 mb-1 block">Tipo de Serviço</Label>
              <Select
                value={filterTipo}
                onValueChange={(v) => {
                  setFilterTipo(v)
                  setPage(1)
                }}
              >
                <SelectTrigger className="h-9 rounded-lg text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {Object.entries(TIPO_SERVICO_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11px] text-slate-500 mb-1 block">Entrada (De)</Label>
              <Input
                type="date"
                value={filterDateFrom}
                onChange={(e) => {
                  setFilterDateFrom(e.target.value)
                  setPage(1)
                }}
                className="h-9 rounded-lg text-sm"
              />
            </div>
            <div>
              <Label className="text-[11px] text-slate-500 mb-1 block">Entrada (Até)</Label>
              <Input
                type="date"
                value={filterDateTo}
                onChange={(e) => {
                  setFilterDateTo(e.target.value)
                  setPage(1)
                }}
                className="h-9 rounded-lg text-sm"
              />
            </div>
          </div>
        )}
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr className="text-left">
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">Nº OS</th>
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">
                  Paciente
                </th>
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">
                  Tipo de Serviço
                </th>
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">
                  Data Entrada
                </th>
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">
                  Data Prevista
                </th>
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">
                  Técnico
                </th>
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-right">
                  Valor
                </th>
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-right">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin text-teal-500" />
                    Carregando ordens de serviço...
                  </td>
                </tr>
              ) : paged.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                    <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    Nenhuma ordem de serviço encontrada.
                  </td>
                </tr>
              ) : (
                paged.map((os) => (
                  <tr key={os.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900">{formatNumeroOS(os)}</div>
                    </td>
                    <td
                      className="px-4 py-3 text-slate-700 max-w-[180px] truncate"
                      title={getPacienteNome(os)}
                    >
                      {getPacienteNome(os)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        className={
                          TIPO_BADGES[os.tipo_servico] ||
                          'bg-slate-50 text-slate-600 border-slate-200'
                        }
                        variant="outline"
                      >
                        {TIPO_SERVICO_LABELS[os.tipo_servico] || os.tipo_servico}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        className={
                          STATUS_BADGES[os.status] || 'bg-slate-100 text-slate-600 border-slate-200'
                        }
                        variant="outline"
                      >
                        {STATUS_LABELS[os.status] || os.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {formatDate(os.data_entrada)}
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {formatDate(os.data_prevista)}
                    </td>
                    <td
                      className="px-4 py-3 text-slate-600 max-w-[140px] truncate"
                      title={getTecnicoNome(os)}
                    >
                      {getTecnicoNome(os)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900 whitespace-nowrap">
                      {formatCurrency(os.valor)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setDetailOS(os)}
                          title="Ver detalhes"
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => toast({ title: 'Edição de OS em desenvolvimento.' })}
                          title="Editar"
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {podeImprimir(os) && (
                          <button
                            onClick={() => handlePrint(os)}
                            title="Imprimir"
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
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

      {/* Detalhe da OS */}
      <Dialog open={!!detailOS} onOpenChange={(o) => !o && setDetailOS(null)}>
        <DialogContent className="max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
          <DialogHeader className="border-b border-slate-100 pb-3">
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-teal-600" />
              Ordem de Serviço {detailOS ? formatNumeroOS(detailOS) : ''}
            </DialogTitle>
          </DialogHeader>
          {detailOS && (
            <div className="space-y-3 pt-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-500">Paciente:</span>{' '}
                  <strong className="text-slate-800">{getPacienteNome(detailOS)}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Técnico:</span>{' '}
                  <strong className="text-slate-800">{getTecnicoNome(detailOS)}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Tipo de Serviço:</span>{' '}
                  <Badge
                    className={
                      TIPO_BADGES[detailOS.tipo_servico] ||
                      'bg-slate-50 text-slate-600 border-slate-200'
                    }
                    variant="outline"
                  >
                    {TIPO_SERVICO_LABELS[detailOS.tipo_servico] || detailOS.tipo_servico}
                  </Badge>
                </div>
                <div>
                  <span className="text-slate-500">Status:</span>{' '}
                  <Badge
                    className={
                      STATUS_BADGES[detailOS.status] ||
                      'bg-slate-100 text-slate-600 border-slate-200'
                    }
                    variant="outline"
                  >
                    {STATUS_LABELS[detailOS.status] || detailOS.status}
                  </Badge>
                </div>
                <div>
                  <span className="text-slate-500">Entrada:</span>{' '}
                  <strong className="text-slate-800">{formatDate(detailOS.data_entrada)}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Previsão:</span>{' '}
                  <strong className="text-slate-800">{formatDate(detailOS.data_prevista)}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Saída:</span>{' '}
                  <strong className="text-slate-800">{formatDate(detailOS.data_saida)}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Valor:</span>{' '}
                  <strong className="text-slate-800">{formatCurrency(detailOS.valor)}</strong>
                </div>
                {detailOS.expand?.aparelho && (
                  <div className="col-span-2">
                    <span className="text-slate-500">Aparelho:</span>{' '}
                    <strong className="text-slate-800">
                      {[detailOS.expand.aparelho.marca, detailOS.expand.aparelho.modelo]
                        .filter(Boolean)
                        .join(' - ') || '—'}
                    </strong>
                  </div>
                )}
                {detailOS.garantia && (
                  <div>
                    <span className="text-slate-500">Garantia:</span>{' '}
                    <strong className="text-slate-800">{detailOS.dias_garantia || 0} dias</strong>
                  </div>
                )}
                {detailOS.forma_pagamento && (
                  <div>
                    <span className="text-slate-500">Pagamento:</span>{' '}
                    <strong className="text-slate-800">{detailOS.forma_pagamento}</strong>
                  </div>
                )}
              </div>

              {detailOS.descricao_problema && (
                <div className="rounded-lg border border-slate-200 p-2.5">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Descrição do Problema
                  </div>
                  <p className="text-slate-700 whitespace-pre-wrap">
                    {detailOS.descricao_problema}
                  </p>
                </div>
              )}
              {detailOS.descricao_servico && (
                <div className="rounded-lg border border-slate-200 p-2.5">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Serviço Realizado
                  </div>
                  <p className="text-slate-700 whitespace-pre-wrap">{detailOS.descricao_servico}</p>
                </div>
              )}
              {detailOS.observacoes && (
                <div className="rounded-lg border border-slate-200 p-2.5">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Observações
                  </div>
                  <p className="text-slate-700 whitespace-pre-wrap">{detailOS.observacoes}</p>
                </div>
              )}
              {detailOS.motivo_cancelamento && (
                <div className="p-2.5 rounded-lg bg-red-50 border border-red-100 text-xs text-red-700">
                  <strong>Cancelamento:</strong> {detailOS.motivo_cancelamento}
                </div>
              )}
            </div>
          )}
          <DialogFooter className="pt-2 border-t border-slate-100 flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => detailOS && handlePrint(detailOS)}
              className="rounded-xl text-xs"
            >
              <Printer className="w-3.5 h-3.5 mr-1.5" /> Imprimir
            </Button>
            <Button
              variant="outline"
              onClick={() => toast({ title: 'Edição de OS em desenvolvimento.' })}
              className="rounded-xl text-xs"
            >
              <Pencil className="w-3.5 h-3.5 mr-1.5" /> Editar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
