import React, { useEffect, useMemo, useState } from 'react'
import {
  DollarSign,
  Receipt,
  CreditCard,
  Calendar,
  Search,
  Filter,
  ArrowUpDown,
  FileSpreadsheet,
  FileText,
} from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency, formatDate } from '@/lib/formatters'
import {
  ReportHeader,
  SummaryCard,
  SummaryCardSkeleton,
  DateRangeFilter,
  EmptyState,
  type Period,
  shortcutPeriod,
  type ShortcutId,
  inDateRange,
  exportToCSVGeneric,
} from './relatorios/shared'

interface RecebimentoItem {
  id: string
  conta_receber_id: string
  valor: number
  data_recebimento: string
  forma_recebimento: string
  observacoes: string
  usuario_id: string
  usuario_nome: string
  valor_base?: number
  itens_extras?: any[]
  desconto_tipo?: string
  desconto_valor?: number
  valor_total?: number
  created: string
  cliente_nome?: string
}

const FORMA_LABELS: Record<string, string> = {
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  pix: 'PIX',
  transferencia: 'Transferência',
  cheque: 'Cheque',
  convenio: 'Convênio',
  boleto: 'Boleto',
}

export default function RelatorioRecebimentos() {
  const { toast } = useToast()
  const [recebimentos, setRecebimentos] = useState<RecebimentoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>(() => shortcutPeriod('this_month'))
  const [searchTerm, setSearchTerm] = useState('')
  const [formaFilter, setFormaFilter] = useState('all')

  const fetchRecebimentos = async () => {
    try {
      setLoading(true)
      // Busca recebimentos com expand de conta_receber para ter cliente_nome
      const list = await pb.collection('recebimentos').getFullList({
        sort: '-data_recebimento,-created',
        expand: 'conta_receber_id',
      })
      const mapped: RecebimentoItem[] = list.map((r: any) => ({
        id: r.id,
        conta_receber_id: r.conta_receber_id,
        valor: Number(r.valor) || 0,
        data_recebimento: r.data_recebimento
          ? String(r.data_recebimento).split(' ')[0].split('T')[0]
          : '',
        forma_recebimento: r.forma_recebimento || '',
        observacoes: r.observacoes || '',
        usuario_id: r.usuario_id || '',
        usuario_nome: r.usuario_nome || '—',
        valor_base: Number(r.valor_base) || 0,
        itens_extras: Array.isArray(r.itens_extras) ? r.itens_extras : [],
        desconto_tipo: r.desconto_tipo || '',
        desconto_valor: Number(r.desconto_valor) || 0,
        valor_total: Number(r.valor_total) || Number(r.valor) || 0,
        created: r.created,
        cliente_nome: r.expand?.conta_receber_id?.cliente_nome || '—',
      }))
      setRecebimentos(mapped)
    } catch (err) {
      console.error('Erro ao carregar relatório de recebimentos:', err)
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível buscar a lista de recebimentos.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRecebimentos()
  }, [])

  const onShortcut = (id: ShortcutId) => setPeriod(shortcutPeriod(id))

  // Filtra por período, forma de pagamento e termo de busca (cliente/observações/usuário)
  const filteredRows = useMemo(() => {
    return recebimentos.filter((r) => {
      if (!inDateRange(r.data_recebimento, period.from, period.to)) return false
      if (formaFilter !== 'all' && r.forma_recebimento !== formaFilter) return false
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase()
        const matchCliente = r.cliente_nome?.toLowerCase().includes(q)
        const matchObs = r.observacoes?.toLowerCase().includes(q)
        const matchUser = r.usuario_nome?.toLowerCase().includes(q)
        if (!matchCliente && !matchObs && !matchUser) return false
      }
      return true
    })
  }, [recebimentos, period, formaFilter, searchTerm])

  // Métricas de resumo
  const totalRecebido = useMemo(
    () => filteredRows.reduce((acc, r) => acc + r.valor, 0),
    [filteredRows],
  )
  const qtdRecebimentos = filteredRows.length
  const ticketMedio = qtdRecebimentos > 0 ? totalRecebido / qtdRecebimentos : 0

  const formaMaisUsada = useMemo(() => {
    if (filteredRows.length === 0) return '—'
    const counts: Record<string, number> = {}
    filteredRows.forEach((r) => {
      const f = r.forma_recebimento || 'outros'
      counts[f] = (counts[f] || 0) + 1
    })
    let topForma = '—'
    let max = 0
    Object.entries(counts).forEach(([forma, count]) => {
      if (count > max) {
        max = count
        topForma = FORMA_LABELS[forma] || forma
      }
    })
    return `${topForma} (${max})`
  }, [filteredRows])

  const handleExport = () => {
    if (!filteredRows.length) return
    exportToCSVGeneric(
      `relatorio-recebimentos-${period.from}-a-${period.to}`,
      [
        {
          header: 'Data',
          accessor: (r) => (r.data_recebimento ? formatDate(r.data_recebimento) : '—'),
        },
        { header: 'Cliente', accessor: (r) => r.cliente_nome || '—' },
        { header: 'Valor (R$)', accessor: (r) => r.valor.toFixed(2) },
        {
          header: 'Forma de Pagamento',
          accessor: (r) => FORMA_LABELS[r.forma_recebimento] || r.forma_recebimento || '—',
        },
        { header: 'Recebido por', accessor: (r) => r.usuario_nome || '—' },
        { header: 'Observações', accessor: (r) => r.observacoes || '' },
      ],
      filteredRows,
    )
  }

  const hasFilters = formaFilter !== 'all' || searchTerm.trim() !== ''
  const clearFilters = () => {
    setFormaFilter('all')
    setSearchTerm('')
  }

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      <ReportHeader
        title="Relatório de Recebimentos"
        description="Acompanhamento detalhado de todas as baixas e recebimentos no período"
        icon={DollarSign}
        onExport={handleExport}
        exportDisabled={!filteredRows.length}
      />

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
              label="Total Recebido"
              value={formatCurrency(totalRecebido)}
              hint={`Período: ${formatDate(period.from)} a ${formatDate(period.to)}`}
              icon={DollarSign}
              tone="green"
            />
            <SummaryCard
              label="Qtd. de Recebimentos"
              value={String(qtdRecebimentos)}
              hint="Baixas registradas"
              icon={Receipt}
              tone="blue"
            />
            <SummaryCard
              label="Ticket Médio"
              value={formatCurrency(ticketMedio)}
              hint="Por recebimento"
              icon={CreditCard}
              tone="purple"
            />
            <SummaryCard
              label="Forma Mais Usada"
              value={formaMaisUsada}
              hint="No período filtrado"
              icon={Calendar}
              tone="amber"
            />
          </>
        )}
      </div>

      {/* Filtros de Data e Extras */}
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
                value={formaFilter}
                onChange={(e) => setFormaFilter(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-200 text-sm px-2 bg-white"
              >
                <option value="all">Todas as formas</option>
                {Object.entries(FORMA_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-[11px] text-slate-500 mb-1 block">Buscar</Label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Cliente, obs, usuário..."
                  className="h-9 pl-8 text-xs bg-white"
                />
              </div>
            </div>
          </>
        }
      />

      {/* Tabela de Recebimentos */}
      <Card className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden bg-white">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-base">Recebimentos do Período</h3>
            <p className="text-xs text-slate-500">
              {filteredRows.length} registro(s) encontrado(s)
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchRecebimentos}
            className="text-xs gap-1.5"
            disabled={loading}
          >
            Atualizar
          </Button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Carregando recebimentos...</div>
        ) : filteredRows.length === 0 ? (
          <div className="p-8 text-center">
            <EmptyState message="Nenhum recebimento encontrado para o período e filtros selecionados." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-semibold text-slate-700">Data</TableHead>
                  <TableHead className="font-semibold text-slate-700">Cliente</TableHead>
                  <TableHead className="font-semibold text-slate-700 text-right">Valor</TableHead>
                  <TableHead className="font-semibold text-slate-700">Forma</TableHead>
                  <TableHead className="font-semibold text-slate-700">
                    Usuário que Recebeu
                  </TableHead>
                  <TableHead className="font-semibold text-slate-700">Observações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((r) => (
                  <TableRow key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <TableCell className="text-xs font-medium text-slate-700 whitespace-nowrap">
                      {r.data_recebimento ? formatDate(r.data_recebimento) : '—'}
                    </TableCell>
                    <TableCell className="text-xs font-semibold text-slate-900">
                      {r.cliente_nome}
                    </TableCell>
                    <TableCell className="text-xs font-bold text-emerald-700 text-right whitespace-nowrap">
                      {formatCurrency(r.valor)}
                    </TableCell>
                    <TableCell className="text-xs">
                      <Badge variant="outline" className="text-[11px] font-normal bg-slate-50">
                        {FORMA_LABELS[r.forma_recebimento] || r.forma_recebimento || '—'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                      {r.usuario_nome}
                    </TableCell>
                    <TableCell
                      className="text-xs text-slate-500 max-w-xs truncate"
                      title={r.observacoes}
                    >
                      {r.observacoes || '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Totalizador no Rodapé da Tabela */}
            <div className="bg-slate-50 border-t border-slate-200 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
              <div className="text-xs text-slate-600">
                Total de <span className="font-bold text-slate-800">{filteredRows.length}</span>{' '}
                recebimento(s) listado(s)
              </div>
              <div className="flex items-center gap-6">
                <div className="text-xs text-slate-500">
                  Ticket Médio:{' '}
                  <span className="font-bold text-slate-700">{formatCurrency(ticketMedio)}</span>
                </div>
                <div className="text-sm font-bold text-slate-800">
                  Total Geral:{' '}
                  <span className="text-base font-extrabold text-emerald-700 ml-1">
                    {formatCurrency(totalRecebido)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
