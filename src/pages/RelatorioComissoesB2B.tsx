import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  PieChart,
  Eye,
  X,
  Filter,
  Download,
  Wallet,
  CheckCircle2,
  Receipt,
  ShoppingCart,
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
  TableFooter,
} from '@/components/ui/table'
import type { VendaB2B, NFServicoStatus } from '@/types'

const PAGE_SIZE = 10

/** Rótulo do status de NF exibido na coluna "NFS-e". */
const nfStatusLabel: Record<NFServicoStatus, string> = {
  rascunho: 'Pendente',
  emitida: 'Emitida',
  cancelada: 'Cancelada',
  cancelada_prefeitura: 'Cancelada',
}

const nfStatusColors: Record<NFServicoStatus, string> = {
  rascunho: 'bg-amber-50 text-amber-700 border-amber-200',
  emitida: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelada: 'bg-red-50 text-red-700 border-red-200',
  cancelada_prefeitura: 'bg-red-50 text-red-700 border-red-200',
}

type FiltroComissao = 'todas' | 'receber' | 'recebidas'
type FiltroNfse = 'todas' | 'emitida' | 'pendente' | 'cancelada'

/** Normaliza o status da NFS-e para o valor do filtro. */
function nfseFiltroDe(status: NFServicoStatus | undefined): FiltroNfse {
  if (!status || status === 'rascunho') return 'pendente'
  if (status === 'emitida') return 'emitida'
  return 'cancelada' // cancelada | cancelada_prefeitura
}

/** Converte "YYYY-MM-DD" -> "YYYY-MM". */
function toYearMonth(ymd: string | undefined | null): string {
  if (!ymd) return ''
  return String(ymd).slice(0, 7)
}

/** Gera os rótulos dos últimos 12 meses (incluindo o atual), do mais antigo ao mais recente. */
function last12Months(ref: Date = new Date()): { key: string; label: string }[] {
  const months: { key: string; label: string }[] = []
  const nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  for (let i = 11; i >= 0; i--) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = `${nomes[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`
    months.push({ key, label })
  }
  return months
}

export default function RelatorioComissoesB2B() {
  const navigate = useNavigate()
  const { vendasB2B, fetchVendasB2B, empresasParceiras, fetchEmpresasParceiras } = useApp()
  const { toast } = useToast()

  const [page, setPage] = useState(1)
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [filterStatus, setFilterStatus] = useState<FiltroComissao>('todas')
  const [filterNfse, setFilterNfse] = useState<FiltroNfse>('todas')
  const [filterEmpresa, setFilterEmpresa] = useState('all')
  const [filterBusca, setFilterBusca] = useState('')

  useEffect(() => {
    fetchVendasB2B()
    fetchEmpresasParceiras()
  }, [fetchVendasB2B, fetchEmpresasParceiras])

  // Mapa de empresas por id (para CNPJ/razão social)
  const empresaById = useMemo(() => {
    const m: Record<string, { razao_social: string; cnpj: string }> = {}
    empresasParceiras.forEach((e) => {
      m[e.id] = { razao_social: e.razao_social, cnpj: e.cnpj }
    })
    return m
  }, [empresasParceiras])

  // Vendas ativas (não canceladas) dentro do período filtrado
  const vendasAtivas = useMemo(() => {
    return vendasB2B.filter((v) => {
      if (v.status === 'cancelada') return false
      const data = v.data_venda || ''
      if (filterFrom && data < filterFrom) return false
      if (filterTo && data > filterTo) return false
      return true
    })
  }, [vendasB2B, filterFrom, filterTo])

  // Cards de resumo (respeitam apenas o filtro de período; vendas ativas)
  const resumo = useMemo(() => {
    const totalComissoes = vendasAtivas.reduce((acc, v) => acc + (v.valor_comissao || 0), 0)
    const comissoesRecebidas = vendasAtivas
      .filter((v) => v.status_repasse === 'recebido')
      .reduce((acc, v) => acc + (v.valor_comissao || 0), 0)
    const comissoesAReceber = vendasAtivas
      .filter((v) => v.status_repasse === 'pendente')
      .reduce((acc, v) => acc + (v.valor_comissao || 0), 0)
    const totalVendas = vendasAtivas.length
    const nfsePendentes = vendasAtivas.filter((v) => v.nf?.status === 'rascunho').length
    return { totalComissoes, comissoesRecebidas, comissoesAReceber, totalVendas, nfsePendentes }
  }, [vendasAtivas])

  // Lista filtrada (todos os filtros, inclusive status da comissão, empresa e busca)
  const filtered = useMemo(() => {
    const busca = filterBusca.trim().toLowerCase()
    return vendasAtivas
      .filter((v) => {
        if (filterStatus === 'receber' && v.status_repasse !== 'pendente') return false
        if (filterStatus === 'recebidas' && v.status_repasse !== 'recebido') return false
        if (filterNfse !== 'todas' && nfseFiltroDe(v.nf?.status) !== filterNfse) return false
        if (filterEmpresa !== 'all' && v.cliente_empresa_id !== filterEmpresa) return false
        if (busca && !(v.numero_venda || '').toLowerCase().includes(busca)) return false
        return true
      })
      .sort((a, b) => (a.data_venda < b.data_venda ? 1 : -1))
  }, [vendasAtivas, filterStatus, filterNfse, filterEmpresa, filterBusca])

  // Totais do rodapé (sobre a lista filtrada)
  const totais = useMemo(() => {
    const totalValor = filtered.reduce((acc, v) => acc + (v.valor_total || 0), 0)
    const totalComissao = filtered.reduce((acc, v) => acc + (v.valor_comissao || 0), 0)
    return { totalValor, totalComissao }
  }, [filtered])

  // Dados do gráfico (últimos 12 meses) — sempre sobre vendas ativas, ignorando
  // os demais filtros para dar uma visão histórica consistente.
  const meses = useMemo(() => last12Months(), [])
  const chartData = useMemo(() => {
    const recebidasPorMes: Record<string, number> = {}
    const aReceberPorMes: Record<string, number> = {}
    vendasAtivas.forEach((v) => {
      const ym = toYearMonth(v.data_venda)
      if (!ym) return
      if (v.status_repasse === 'recebido') {
        recebidasPorMes[ym] = (recebidasPorMes[ym] || 0) + (v.valor_comissao || 0)
      } else if (v.status_repasse === 'pendente') {
        aReceberPorMes[ym] = (aReceberPorMes[ym] || 0) + (v.valor_comissao || 0)
      }
    })
    return meses.map((m) => ({
      ...m,
      recebidas: recebidasPorMes[m.key] || 0,
      aReceber: aReceberPorMes[m.key] || 0,
    }))
  }, [vendasAtivas, meses])

  const maxValue = useMemo(() => {
    const max = Math.max(1, ...chartData.map((d) => Math.max(d.recebidas, d.aReceber)))
    // arredonda para cima em um múltiplo "bonito"
    const pow = Math.pow(10, Math.floor(Math.log10(max)))
    return Math.ceil(max / pow) * pow
  }, [chartData])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const effectivePage = Math.min(page, totalPages)

  const hasFilters =
    !!filterFrom ||
    !!filterTo ||
    filterStatus !== 'todas' ||
    filterNfse !== 'todas' ||
    filterEmpresa !== 'all' ||
    !!filterBusca.trim()

  const clearFilters = () => {
    setFilterFrom('')
    setFilterTo('')
    setFilterStatus('todas')
    setFilterNfse('todas')
    setFilterEmpresa('all')
    setFilterBusca('')
    setPage(1)
  }

  // ---- Exportação CSV (respeita filtros ativos) ----
  const handleExportCSV = () => {
    if (filtered.length === 0) {
      toast({
        title: 'Nada para exportar',
        description: 'Não há comissões B2B visíveis com os filtros atuais.',
        variant: 'destructive',
      })
      return
    }

    const esc = (val: unknown): string => {
      const s = val === null || val === undefined ? '' : String(val)
      return `"${s.replace(/"/g, '""')}"`
    }
    const num = (v: number | undefined | null): string => Number(v || 0).toFixed(2)

    const headers = [
      'Número',
      'Data',
      'Empresa',
      'CNPJ',
      'Valor Total',
      '% Comissão',
      'Valor Comissão',
      'Status NF',
      'Status Repasse',
      'Data Recebimento',
    ]

    const rows = filtered.map((v) => {
      const emp = empresaById[v.cliente_empresa_id]
      const nfStatus = v.nf?.status || 'rascunho'
      return [
        esc(v.numero_venda),
        esc(v.data_venda),
        esc(emp?.razao_social || v.cliente_empresa_nome || ''),
        esc(emp?.cnpj || ''),
        num(v.valor_total),
        num(v.percentual_comissao),
        num(v.valor_comissao),
        esc(nfStatusLabel[nfStatus]),
        esc(v.status_repasse === 'recebido' ? 'Recebido' : 'A Receber'),
        esc(v.data_recebimento_comissao || ''),
      ].join(',')
    })

    const csvContent = '\uFEFF' + [headers.map(esc).join(','), ...rows].join('\r\n')

    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const stamp =
      `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
      `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
    const filename = `relatorio-comissoes-b2b-${stamp}.csv`

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
      description: `${filtered.length} registro(s) exportado(s) em ${filename}.`,
    })
  }

  // ---- Tooltip do gráfico ----
  const [hover, setHover] = useState<{ idx: number; x: number } | null>(null)

  return (
    <div className="space-y-5 animate-in fade-in-50 duration-200">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center">
            <PieChart className="w-6 h-6 text-blue-700" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Relatório de Comissões B2B
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Acompanhamento de comissões e repasses de vendas para empresas parceiras
            </p>
          </div>
        </div>
        <Button
          onClick={handleExportCSV}
          className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm shadow-sm"
        >
          <Download className="w-4 h-4 mr-1.5" /> Exportar CSV
        </Button>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Comissões Totais
              </p>
              <p className="text-xl font-extrabold text-blue-700 mt-1">
                {formatCurrency(resumo.totalComissoes)}
              </p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
              <Receipt className="w-4 h-4 text-blue-600" />
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
              <p className="text-[10px] text-green-600 mt-0.5">Repasses confirmados</p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
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
                {formatCurrency(resumo.comissoesAReceber)}
              </p>
              <p className="text-[10px] text-amber-600 mt-0.5">NF emitida — aguardando repasse</p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-amber-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Total de Vendas
              </p>
              <p className="text-xl font-extrabold text-slate-900 mt-1">{resumo.totalVendas}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Vendas ativas no período</p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
              <ShoppingCart className="w-4 h-4 text-slate-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">
                NFS-e Pendentes
              </p>
              <p className="text-xl font-extrabold text-amber-700 mt-1">{resumo.nfsePendentes}</p>
              <p className="text-[10px] text-amber-600 mt-0.5">Aguardando emissão</p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
              <Receipt className="w-4 h-4 text-amber-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Gráfico de barras */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-800">
              Comissões por mês (últimos 12 meses)
            </h2>
            <div className="flex items-center gap-4 mt-1.5">
              <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <span className="inline-block w-3 h-3 rounded-sm bg-amber-400" /> A Receber
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <span className="inline-block w-3 h-3 rounded-sm bg-green-500" /> Recebidas
              </span>
            </div>
          </div>
        </div>

        {/* Gráfico em SVG puro */}
        <div className="relative w-full overflow-x-auto">
          <svg
            viewBox="0 0 720 240"
            className="w-full min-w-[640px] h-[240px]"
            preserveAspectRatio="none"
            onMouseLeave={() => setHover(null)}
          >
            {/* Linhas de grade horizontais */}
            {[0, 0.25, 0.5, 0.75, 1].map((t) => (
              <line
                key={t}
                x1={40}
                x2={710}
                y1={20 + t * 180}
                y2={20 + t * 180}
                stroke="#e2e8f0"
                strokeWidth={1}
              />
            ))}
            {/* Rótulos do eixo Y */}
            {[0, 0.25, 0.5, 0.75, 1].map((t) => (
              <text
                key={`y-${t}`}
                x={34}
                y={24 + t * 180}
                textAnchor="end"
                className="fill-slate-400"
                style={{ fontSize: 9 }}
              >
                {formatCurrency(maxValue * (1 - t))
                  .replace('R$', '')
                  .trim()}
              </text>
            ))}

            {chartData.map((d, i) => {
              const groupWidth = 670 / chartData.length
              const cx = 40 + i * groupWidth + groupWidth / 2
              const barW = Math.min(14, groupWidth / 3)
              const hRecebidas = (d.recebidas / maxValue) * 180
              const hAReceber = (d.aReceber / maxValue) * 180
              const baseY = 200
              const xRecebidas = cx - barW / 2
              const xAReceber = cx + barW / 2 - barW
              // evita overlap quando ambas existem: posiciona lado a lado
              const xRec = cx - barW - 1
              const xAR = cx + 1
              return (
                <g
                  key={d.key}
                  onMouseEnter={() => setHover({ idx: i, x: cx })}
                  className="cursor-pointer"
                >
                  {/* área hover */}
                  <rect
                    x={40 + i * groupWidth}
                    y={20}
                    width={groupWidth}
                    height={180}
                    fill="transparent"
                  />
                  {/* barra A Receber (amarelo) */}
                  <rect
                    x={xAR}
                    y={baseY - hAReceber}
                    width={barW}
                    height={Math.max(0, hAReceber)}
                    rx={2}
                    className="fill-amber-400"
                  />
                  {/* barra Recebidas (verde) */}
                  <rect
                    x={xRec}
                    y={baseY - hRecebidas}
                    width={barW}
                    height={Math.max(0, hRecebidas)}
                    rx={2}
                    className="fill-green-500"
                  />
                  {/* rótulo do mês */}
                  <text
                    x={cx}
                    y={216}
                    textAnchor="middle"
                    className="fill-slate-500"
                    style={{ fontSize: 9 }}
                  >
                    {d.label}
                  </text>
                </g>
              )
            })}

            {/* linha de base */}
            <line x1={40} x2={710} y1={200} y2={200} stroke="#cbd5e1" strokeWidth={1} />
          </svg>

          {/* Tooltip */}
          {hover && chartData[hover.idx] && (
            <div
              className="absolute top-2 z-10 bg-slate-900 text-white text-[11px] rounded-lg px-2.5 py-1.5 shadow-lg pointer-events-none whitespace-nowrap"
              style={{ left: `calc(${(hover.x / 720) * 100}% )`, transform: 'translateX(-50%)' }}
            >
              <div className="font-semibold mb-0.5">{chartData[hover.idx].label}</div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-sm bg-amber-400" />
                A Receber: {formatCurrency(chartData[hover.idx].aReceber)}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-sm bg-green-500" />
                Recebidas: {formatCurrency(chartData[hover.idx].recebidas)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
            <Filter className="w-4 h-4" /> Filtros
            {hasFilters && <Badge className="bg-blue-100 text-blue-700 ml-1">Ativos</Badge>}
          </div>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-7 text-xs text-slate-500"
            >
              <X className="w-3 h-3 mr-1" /> Limpar Filtros
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2">
          <div>
            <Label className="text-[11px] text-slate-500 mb-1 block">Data início</Label>
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
            <Label className="text-[11px] text-slate-500 mb-1 block">Data fim</Label>
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
            <Label className="text-[11px] text-slate-500 mb-1 block">Status da comissão</Label>
            <Select
              value={filterStatus}
              onValueChange={(v) => {
                setFilterStatus(v as FiltroComissao)
                setPage(1)
              }}
            >
              <SelectTrigger className="h-9 rounded-lg text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="receber">A Receber</SelectItem>
                <SelectItem value="recebidas">Recebidas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px] text-slate-500 mb-1 block">Status da NFS-e</Label>
            <Select
              value={filterNfse}
              onValueChange={(v) => {
                setFilterNfse(v as FiltroNfse)
                setPage(1)
              }}
            >
              <SelectTrigger className="h-9 rounded-lg text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="emitida">Emitida</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px] text-slate-500 mb-1 block">Empresa parceira</Label>
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
            <Label className="text-[11px] text-slate-500 mb-1 block">Nº da venda</Label>
            <Input
              value={filterBusca}
              onChange={(e) => {
                setFilterBusca(e.target.value)
                setPage(1)
              }}
              placeholder="Ex.: B2B-2025-0001"
              className="h-9 rounded-lg text-sm"
            />
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="text-xs uppercase tracking-wider">Nº Venda</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Data</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Empresa</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-right">
                  Valor Total
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-right">
                  % Comissão
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-right">
                  Valor Comissão
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider">NFS-e</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Status Repasse</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Data Recebimento</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-12 text-center text-slate-400">
                    <PieChart className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    Nenhuma comissão B2B encontrada com os filtros atuais.
                  </TableCell>
                </TableRow>
              ) : (
                paged.map((v: VendaB2B) => {
                  const emp = empresaById[v.cliente_empresa_id]
                  const nfStatus = v.nf?.status || 'rascunho'
                  return (
                    <TableRow key={v.id} className="hover:bg-slate-50/60">
                      <TableCell className="font-bold text-slate-900 whitespace-nowrap">
                        {v.numero_venda}
                      </TableCell>
                      <TableCell className="text-slate-600 whitespace-nowrap">
                        {formatDate(v.data_venda)}
                      </TableCell>
                      <TableCell className="text-slate-700 max-w-[220px] truncate">
                        {emp?.razao_social || v.cliente_empresa_nome || '—'}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-slate-900 whitespace-nowrap">
                        {formatCurrency(v.valor_total)}
                      </TableCell>
                      <TableCell className="text-right text-slate-600 whitespace-nowrap">
                        {Number(v.percentual_comissao || 0).toLocaleString('pt-BR')}%
                      </TableCell>
                      <TableCell className="text-right font-semibold text-emerald-700 whitespace-nowrap">
                        {formatCurrency(v.valor_comissao)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {v.nf?.numero_nfse && (
                            <span className="text-xs font-bold text-slate-800 whitespace-nowrap">
                              Nº {v.nf.numero_nfse}
                            </span>
                          )}
                          <Badge variant="outline" className={nfStatusColors[nfStatus]}>
                            {nfStatusLabel[nfStatus]}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            v.status_repasse === 'recebido'
                              ? 'bg-green-50 text-green-800 border-green-300'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }
                        >
                          {v.status_repasse === 'recebido' ? 'Recebido' : 'A Receber'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-600 whitespace-nowrap">
                        {v.data_recebimento_comissao
                          ? formatDate(v.data_recebimento_comissao)
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <button
                          onClick={() => navigate(`/vendas-b2b/${v.id}`)}
                          title="Ver detalhes"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-blue-700 hover:bg-blue-50 text-xs font-semibold"
                        >
                          <Eye className="w-4 h-4" /> Detalhes
                        </button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
            {paged.length > 0 && (
              <TableFooter className="bg-slate-50">
                <TableRow>
                  <TableCell colSpan={3} className="font-bold text-slate-800">
                    Totais ({filtered.length} venda{filtered.length !== 1 ? 's' : ''})
                  </TableCell>
                  <TableCell className="text-right font-extrabold text-slate-900 whitespace-nowrap">
                    {formatCurrency(totais.totalValor)}
                  </TableCell>
                  <TableCell />
                  <TableCell className="text-right font-extrabold text-emerald-700 whitespace-nowrap">
                    {formatCurrency(totais.totalComissao)}
                  </TableCell>
                  <TableCell colSpan={4} />
                </TableRow>
              </TableFooter>
            )}
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
    </div>
  )
}
