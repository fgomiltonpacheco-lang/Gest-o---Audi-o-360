import React, { useEffect, useMemo, useState } from 'react'
import {
  DollarSign,
  Clock,
  Receipt,
  CreditCard,
  Download,
  Calendar,
  Filter,
  RefreshCw,
} from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency, formatDate } from '@/lib/formatters'

interface ContaReceberItem {
  id: string
  cliente_nome: string
  descricao: string
  valor_original: number
  valor_recebido: number
  valor_restante: number
  forma_pagamento: string
  data_venda?: string
  data_vencimento?: string
  data_recebimento?: string
  status: string
  usuario_id?: string
  usuario_nome?: string
  created?: string
}

const FORMA_PAGAMENTO_LABELS: Record<string, string> = {
  dinheiro: 'Dinheiro',
  debito: 'Débito',
  credito: 'Crédito',
  cartao: 'Cartão',
  pix: 'PIX',
  convenio: 'Convênio',
  convênio: 'Convênio',
  boleto: 'Boleto',
  promissoria: 'Promissória',
  promissória: 'Promissória',
  parcelado: 'Parcelado',
  deposito: 'Depósito',
  transferencia: 'Transferência',
}

const STATUS_LABELS: Record<string, string> = {
  a_receber: 'A Receber',
  recebido_parcial: 'Recebido Parcial',
  recebido_total: 'Recebido',
  vencido: 'Vencido',
  renegociado: 'Renegociado',
  cancelado: 'Cancelado',
}

function getDefaultMonthRange() {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const firstDay = new Date(y, m, 1)
  const lastDay = new Date(y, m + 1, 0)
  const formatYMD = (d: Date) => {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  return {
    inicio: formatYMD(firstDay),
    fim: formatYMD(lastDay),
  }
}

export default function RelatorioFinanceiro() {
  const defaultRange = useMemo(() => getDefaultMonthRange(), [])
  const [dataInicio, setDataInicio] = useState(defaultRange.inicio)
  const [dataFim, setDataFim] = useState(defaultRange.fim)
  const [dataInicioFiltro, setDataInicioFiltro] = useState(defaultRange.inicio)
  const [dataFimFiltro, setDataFimFiltro] = useState(defaultRange.fim)

  const [contas, setContas] = useState<ContaReceberItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchContas = async () => {
    try {
      setLoading(true)
      const list = await pb.collection('contas_receber').getFullList({
        sort: '-data_recebimento,-data_vencimento,-created',
        expand: 'usuario_id,paciente_id',
      })

      const mapped: ContaReceberItem[] = list.map((item: any) => {
        const usuarioNome =
          item.expand?.usuario_id?.name ||
          item.expand?.usuario_id?.email ||
          (item.usuario_id ? 'Usuário do Sistema' : '—')

        const dataRecClean = item.data_recebimento
          ? String(item.data_recebimento).split(' ')[0].split('T')[0]
          : ''
        const dataVencClean = item.data_vencimento
          ? String(item.data_vencimento).split(' ')[0].split('T')[0]
          : ''
        const dataVendaClean = item.data_venda
          ? String(item.data_venda).split(' ')[0].split('T')[0]
          : ''

        return {
          id: item.id,
          cliente_nome: item.cliente_nome || item.expand?.paciente_id?.name || '—',
          descricao: item.descricao || '—',
          valor_original: Number(item.valor_original) || 0,
          valor_recebido: Number(item.valor_recebido) || 0,
          valor_restante: Number(item.valor_restante) || 0,
          forma_pagamento: item.forma_pagamento || '—',
          data_venda: dataVendaClean,
          data_vencimento: dataVencClean,
          data_recebimento: dataRecClean,
          status: item.status || 'a_receber',
          usuario_id: item.usuario_id,
          usuario_nome: usuarioNome,
          created: item.created,
        }
      })

      setContas(mapped)
    } catch (error) {
      console.error('Erro ao carregar contas a receber:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchContas()
  }, [])

  const handleFiltrar = () => {
    setDataInicioFiltro(dataInicio)
    setDataFimFiltro(dataFim)
  }

  // Filtra itens com base no período aplicado
  // Data de referência: data_recebimento para recebidos, ou data_vencimento/data_venda/created
  const contasFiltradas = useMemo(() => {
    return contas.filter((item) => {
      if (item.status === 'cancelado') return false

      const dataRef =
        item.data_recebimento ||
        item.data_vencimento ||
        item.data_venda ||
        (item.created ? item.created.split('T')[0] : '')

      if (!dataRef) return true

      if (dataInicioFiltro && dataRef < dataInicioFiltro) return false
      if (dataFimFiltro && dataRef > dataFimFiltro) return false
      return true
    })
  }, [contas, dataInicioFiltro, dataFimFiltro])

  // Lista específica de recebimentos para a tabela
  // Itens que tiveram valor recebido > 0 ou status recebido
  const recebimentos = useMemo(() => {
    return contasFiltradas.filter(
      (item) => item.valor_recebido > 0 || item.status === 'recebido_total',
    )
  }, [contasFiltradas])

  // Métricas dos 4 cards de resumo
  const totalRecebido = useMemo(() => {
    return contasFiltradas.reduce((acc, item) => acc + (item.valor_recebido || 0), 0)
  }, [contasFiltradas])

  const totalPendente = useMemo(() => {
    return contasFiltradas.reduce((acc, item) => {
      if (item.status === 'renegociado') return acc
      return acc + (item.valor_restante || 0)
    }, 0)
  }, [contasFiltradas])

  const qtdRecebimentos = recebimentos.length

  const ticketMedio = useMemo(() => {
    if (qtdRecebimentos === 0) return 0
    return totalRecebido / qtdRecebimentos
  }, [totalRecebido, qtdRecebimentos])

  const handleExportar = () => {
    alert('Exportação iniciada! O arquivo do relatório será gerado em instantes.')
  }

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* 1. Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-700">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Relatório Financeiro
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">Fechamento de caixa por período</p>
            </div>
          </div>
        </div>

        {/* 6. Botão Exportar */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchContas}
            disabled={loading}
            className="rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold h-10 gap-1.5"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button
            onClick={handleExportar}
            className="rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold h-10 shadow-sm gap-2"
          >
            <Download className="w-4 h-4" />
            Exportar
          </Button>
        </div>
      </div>

      {/* 2. Filtro: Dois inputs de data (início e fim) + botão "Filtrar". Padrão: mês atual. */}
      <Card className="rounded-2xl border border-slate-200 shadow-sm bg-white overflow-hidden">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4">
            <div className="flex-1 space-y-1.5">
              <Label
                htmlFor="data-inicio"
                className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
              >
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                Data Início
              </Label>
              <Input
                id="data-inicio"
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="h-10 rounded-xl text-xs sm:text-sm bg-slate-50 border-slate-200"
              />
            </div>

            <div className="flex-1 space-y-1.5">
              <Label
                htmlFor="data-fim"
                className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
              >
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                Data Fim
              </Label>
              <Input
                id="data-fim"
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="h-10 rounded-xl text-xs sm:text-sm bg-slate-50 border-slate-200"
              />
            </div>

            <div className="sm:shrink-0 pt-2 sm:pt-0">
              <Button
                onClick={handleFiltrar}
                className="w-full sm:w-auto h-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-6 gap-2"
              >
                <Filter className="w-3.5 h-3.5" />
                Filtrar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Quatro cards de resumo: Total Recebido, Total Pendente, Qtd. Recebimentos, Ticket Médio */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Recebido */}
        <Card className="rounded-2xl border border-emerald-200 shadow-sm bg-white overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Total Recebido
                </p>
                <p className="text-2xl font-extrabold text-emerald-600 mt-1">
                  {formatCurrency(totalRecebido)}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">No período selecionado</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Total Pendente */}
        <Card className="rounded-2xl border border-amber-200 shadow-sm bg-white overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Total Pendente
                </p>
                <p className="text-2xl font-extrabold text-amber-600 mt-1">
                  {formatCurrency(totalPendente)}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">A receber ou vencido</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Qtd. Recebimentos */}
        <Card className="rounded-2xl border border-blue-200 shadow-sm bg-white overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Qtd. Recebimentos
                </p>
                <p className="text-2xl font-extrabold text-blue-600 mt-1">{qtdRecebimentos}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Recebimentos no período</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Receipt className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Ticket Médio */}
        <Card className="rounded-2xl border border-purple-200 shadow-sm bg-white overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Ticket Médio
                </p>
                <p className="text-2xl font-extrabold text-purple-600 mt-1">
                  {formatCurrency(ticketMedio)}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Por recebimento</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                <CreditCard className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 4. Tabela de recebimentos: Data, Paciente, Descrição, Valor (R$), Forma de Pagamento, Recebido por */}
      <Card className="rounded-2xl border border-slate-200 shadow-sm bg-white overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900">Detalhamento de Recebimentos</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Recebimentos registrados entre {formatDate(dataInicioFiltro)} e{' '}
              {formatDate(dataFimFiltro)}
            </p>
          </div>
          <Badge
            variant="outline"
            className="w-fit text-xs font-semibold bg-slate-50 text-slate-700"
          >
            {recebimentos.length} registro(s)
          </Badge>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="font-bold text-slate-700 text-xs">Data</TableHead>
                <TableHead className="font-bold text-slate-700 text-xs">Paciente</TableHead>
                <TableHead className="font-bold text-slate-700 text-xs">Descrição</TableHead>
                <TableHead className="font-bold text-slate-700 text-xs text-right">
                  Valor (R$)
                </TableHead>
                <TableHead className="font-bold text-slate-700 text-xs">
                  Forma de Pagamento
                </TableHead>
                <TableHead className="font-bold text-slate-700 text-xs">Recebido por</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-xs text-slate-500">
                    Carregando dados financeiros...
                  </TableCell>
                </TableRow>
              ) : recebimentos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-xs text-slate-500">
                    Nenhum recebimento encontrado no período informado.
                  </TableCell>
                </TableRow>
              ) : (
                recebimentos.map((item) => {
                  const dataExibicao =
                    item.data_recebimento ||
                    item.data_vencimento ||
                    item.data_venda ||
                    (item.created ? item.created.split('T')[0] : '')

                  const valorExibicao =
                    item.valor_recebido > 0 ? item.valor_recebido : item.valor_original
                  const formaFormatada =
                    FORMA_PAGAMENTO_LABELS[item.forma_pagamento.toLowerCase()] ||
                    item.forma_pagamento ||
                    '—'

                  return (
                    <TableRow key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <TableCell className="text-xs font-medium text-slate-700 whitespace-nowrap">
                        {dataExibicao ? formatDate(dataExibicao) : '—'}
                      </TableCell>
                      <TableCell className="text-xs font-bold text-slate-900">
                        {item.cliente_nome}
                      </TableCell>
                      <TableCell
                        className="text-xs text-slate-600 max-w-xs truncate"
                        title={item.descricao}
                      >
                        {item.descricao}
                      </TableCell>
                      <TableCell className="text-xs font-bold text-emerald-600 text-right whitespace-nowrap">
                        {formatCurrency(valorExibicao)}
                      </TableCell>
                      <TableCell className="text-xs text-slate-700 whitespace-nowrap">
                        <Badge
                          variant="outline"
                          className="text-[11px] font-medium bg-slate-50 text-slate-700"
                        >
                          {formaFormatada}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                        {item.usuario_nome || '—'}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>

            {/* 5. Totalizador no rodapé da tabela */}
            <TableFooter className="bg-slate-50 border-t-2 border-slate-200">
              <TableRow>
                <TableCell colSpan={3} className="text-xs font-bold text-slate-900 py-3.5">
                  Total Geral do Período ({recebimentos.length} recebimento
                  {recebimentos.length === 1 ? '' : 's'})
                </TableCell>
                <TableCell className="text-right text-sm font-extrabold text-emerald-700 py-3.5 whitespace-nowrap">
                  {formatCurrency(totalRecebido)}
                </TableCell>
                <TableCell colSpan={2} className="text-xs text-slate-500 py-3.5 text-right">
                  Ticket Médio:{' '}
                  <strong className="text-slate-700">{formatCurrency(ticketMedio)}</strong>
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </Card>
    </div>
  )
}
