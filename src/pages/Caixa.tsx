import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { useApp } from '@/context/AppContext'
import {
  Wallet,
  Banknote,
  CreditCard,
  Smartphone,
  HeartPulse,
  FileText,
  Plus,
  Lock,
  Unlock,
  Printer,
  ArrowUpCircle,
  ArrowDownCircle,
  ShoppingBag,
  AlertTriangle,
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/formatters'
import {
  FechamentoCaixa,
  MovimentacaoCaixa,
  FormaPagamentoCaixa,
  MovimentacaoCaixaTipo,
  PDVPaymentMethod,
} from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
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
  DialogDescription,
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { usePrint } from '@/components/print/PrintProvider'
import { FechamentoCaixaPrint } from '@/components/print/FechamentoCaixaPrint'
import { useToast } from '@/hooks/use-toast'

// ===== Helpers =====

/** Mapeia a forma de pagamento da venda (PDVPaymentMethod) para a chave do caixa. */
function salePaymentToCaixa(method: PDVPaymentMethod | string | undefined): FormaPagamentoCaixa {
  const m = String(method || '').toLowerCase()
  if (m.includes('débito') || m.includes('debito')) return 'debito'
  if (m.includes('crédito') || m.includes('credito')) return 'credito'
  if (m.includes('pix')) return 'pix'
  if (m.includes('convênio') || m.includes('convenio')) return 'convenio'
  if (m.includes('boleto')) return 'boleto'
  return 'dinheiro' // Dinheiro, À vista, Cartão (legado) -> dinheiro
}

const FORMA_LABEL: Record<FormaPagamentoCaixa, string> = {
  dinheiro: '💵 Dinheiro',
  debito: '💳 Débito',
  credito: '💳 Crédito',
  pix: '📱 PIX',
  convenio: '🏥 Convênio',
  boleto: '📄 Boleto',
}

const FORMA_LABEL_CURTA: Record<FormaPagamentoCaixa, string> = {
  dinheiro: 'Dinheiro',
  debito: 'Débito',
  credito: 'Crédito',
  pix: 'PIX',
  convenio: 'Convênio',
  boleto: 'Boleto',
}

const todayStr = () => new Date().toISOString().split('T')[0]

// ===== Componente principal =====

export default function Caixa() {
  const {
    currentUser,
    sales,
    fechamentosCaixa,
    fetchFechamentosCaixa,
    addFechamentoCaixa,
    updateFechamentoCaixa,
    movimentacoesCaixa,
    fetchMovimentacoesCaixa,
    addMovimentacaoCaixa,
  } = useApp()
  const { toast } = useToast()
  const { print } = usePrint()

  const today = todayStr()

  // Carrega fechamentos ao montar
  useEffect(() => {
    fetchFechamentosCaixa()
  }, [fetchFechamentosCaixa])

  // Fechamento de hoje
  const fechamentoHoje = useMemo(
    () => fechamentosCaixa.find((f) => f.data === today),
    [fechamentosCaixa, today],
  )

  // Quando o fechamento de hoje muda, carrega suas movimentações
  useEffect(() => {
    if (fechamentoHoje) {
      fetchMovimentacoesCaixa(fechamentoHoje.id)
    }
  }, [fechamentoHoje?.id, fetchMovimentacoesCaixa])

  // Vendas do dia (não canceladas/estornadas)
  const vendasDia = useMemo(() => {
    return sales.filter((s) => {
      const d = (s.date || s.createdAt || '').slice(0, 10)
      return d === today && s.status !== 'Cancelado' && s.status !== 'Estornado'
    })
  }, [sales, today])

  // Totais por forma de pagamento (das vendas)
  const totaisForma = useMemo(() => {
    const acc: Record<FormaPagamentoCaixa, number> = {
      dinheiro: 0,
      debito: 0,
      credito: 0,
      pix: 0,
      convenio: 0,
      boleto: 0,
    }
    vendasDia.forEach((s) => {
      const forma = salePaymentToCaixa(s.paymentMethod)
      acc[forma] += Number(s.totalValue) || 0
    })
    return acc
  }, [vendasDia])

  const totalVendas = useMemo(
    () => vendasDia.reduce((acc, s) => acc + (Number(s.totalValue) || 0), 0),
    [vendasDia],
  )

  // Movimentações manuais do fechamento atual
  const movsAtuais = useMemo(() => {
    if (!fechamentoHoje) return []
    return movimentacoesCaixa.filter((m) => m.fechamentoId === fechamentoHoje.id)
  }, [movimentacoesCaixa, fechamentoHoje?.id])

  const totalEntradas = useMemo(
    () => movsAtuais.filter((m) => m.tipo === 'entrada').reduce((a, m) => a + m.valor, 0),
    [movsAtuais],
  )
  const totalSaidas = useMemo(
    () => movsAtuais.filter((m) => m.tipo === 'saida').reduce((a, m) => a + m.valor, 0),
    [movsAtuais],
  )

  // ===== Modais =====
  const [abrirModalOpen, setAbrirModalOpen] = useState(false)
  const [saldoInicial, setSaldoInicial] = useState<string>('0')
  const [movModalOpen, setMovModalOpen] = useState(false)
  const [fecharModalOpen, setFecharModalOpen] = useState(false)
  const [reabrirModalOpen, setReabrirModalOpen] = useState(false)

  // Form movimentação
  const [movTipo, setMovTipo] = useState<MovimentacaoCaixaTipo>('entrada')
  const [movValor, setMovValor] = useState<string>('0')
  const [movDescricao, setMovDescricao] = useState('')
  const [movForma, setMovForma] = useState<FormaPagamentoCaixa>('dinheiro')

  // Saldo final informado + diferença
  const [saldoFinalInput, setSaldoFinalInput] = useState<string>('0')
  const [observacao, setObservacao] = useState('')

  // Reabrir
  const [justificativaReabrir, setJustificativaReabrir] = useState('')

  // Paginação tabela de vendas
  const [pageVendas, setPageVendas] = useState(0)
  const PAGE_SIZE = 8

  // Sincroniza saldo final informado e observação ao abrir/fechar
  useEffect(() => {
    if (fechamentoHoje) {
      setSaldoFinalInput(String(fechamentoHoje.saldoFinal || 0))
      setObservacao(fechamentoHoje.observacao || '')
    } else {
      setSaldoFinalInput('0')
      setObservacao('')
    }
  }, [fechamentoHoje?.id])

  const saldoCalculado = useMemo(() => {
    const ini = fechamentoHoje?.saldoInicial ?? 0
    return ini + totalVendas + totalEntradas - totalSaidas
  }, [fechamentoHoje?.saldoInicial, totalVendas, totalEntradas, totalSaidas])

  const saldoFinalNum = useMemo(() => {
    const n = parseFloat(saldoFinalInput.replace(/\./g, '').replace(',', '.'))
    return isNaN(n) ? 0 : n
  }, [saldoFinalInput])

  const diferenca = useMemo(() => saldoCalculado - saldoFinalNum, [saldoCalculado, saldoFinalNum])

  // ===== Handlers =====
  const parseCurrencyInput = (v: string): number => {
    const n = parseFloat(v.replace(/\./g, '').replace(',', '.'))
    return isNaN(n) ? 0 : n
  }

  const handleAbrirCaixa = async () => {
    const valor = parseCurrencyInput(saldoInicial)
    const created = await addFechamentoCaixa({
      data: today,
      saldoInicial: valor,
      saldoFinal: 0,
      totalDinheiro: 0,
      totalDebito: 0,
      totalCredito: 0,
      totalPix: 0,
      totalConvenio: 0,
      totalBoleto: 0,
      totalEntradas: 0,
      totalSaidas: 0,
      totalVendas: 0,
      quantidadeVendas: 0,
      diferenca: 0,
      status: 'aberto',
      observacao: '',
      usuarioId: currentUser?.id,
    })
    if (created) {
      toast({ title: 'Caixa aberto', description: `Saldo inicial: ${formatCurrency(valor)}` })
      setAbrirModalOpen(false)
      setSaldoInicial('0')
    }
  }

  const handleAddMovimentacao = async () => {
    if (!fechamentoHoje) return
    const valor = parseCurrencyInput(movValor)
    if (valor <= 0) {
      toast({ title: 'Valor inválido', variant: 'destructive' })
      return
    }
    if (!movDescricao.trim()) {
      toast({ title: 'Informe a descrição', variant: 'destructive' })
      return
    }
    const created = await addMovimentacaoCaixa({
      fechamentoId: fechamentoHoje.id,
      tipo: movTipo,
      valor,
      descricao: movDescricao.trim(),
      formaPagamento: movForma,
      data: today,
    })
    if (created) {
      toast({ title: 'Movimentação registrada' })
      setMovModalOpen(false)
      setMovValor('0')
      setMovDescricao('')
      setMovTipo('entrada')
      setMovForma('dinheiro')
    }
  }

  const handleFecharCaixa = async () => {
    if (!fechamentoHoje) return
    const res = await updateFechamentoCaixa(fechamentoHoje.id, {
      saldoFinal: saldoFinalNum,
      totalDinheiro: totaisForma.dinheiro,
      totalDebito: totaisForma.debito,
      totalCredito: totaisForma.credito,
      totalPix: totaisForma.pix,
      totalConvenio: totaisForma.convenio,
      totalBoleto: totaisForma.boleto,
      totalEntradas,
      totalSaidas,
      totalVendas,
      quantidadeVendas: vendasDia.length,
      diferenca,
      status: 'fechado',
      observacao,
    })
    if (res.success) {
      toast({ title: 'Caixa fechado', description: 'Fechamento concluído com sucesso.' })
      setFecharModalOpen(false)
      await fetchFechamentosCaixa()
    } else {
      toast({
        title: 'Erro ao fechar caixa',
        description: res.message,
        variant: 'destructive',
      })
    }
  }

  const handleReabrirCaixa = async () => {
    if (!fechamentoHoje) return
    if (!justificativaReabrir.trim()) {
      toast({ title: 'Informe a justificativa', variant: 'destructive' })
      return
    }
    const obs = `${fechamentoHoje.observacao ? fechamentoHoje.observacao + '\n' : ''}[Reaberto por ${currentUser?.name || 'Admin'} em ${today}: ${justificativaReabrir}]`
    const res = await updateFechamentoCaixa(fechamentoHoje.id, {
      status: 'aberto',
      observacao: obs,
    })
    if (res.success) {
      toast({ title: 'Caixa reaberto', description: 'O caixa foi reaberto para ajustes.' })
      setReabrirModalOpen(false)
      setJustificativaReabrir('')
      await fetchFechamentosCaixa()
    } else {
      toast({ title: 'Erro ao reabrir', description: res.message, variant: 'destructive' })
    }
  }

  const handleImprimir = () => {
    if (!fechamentoHoje) return
    print({
      title: 'Fechamento de Caixa',
      subtitle: `Data: ${formatDate(fechamentoHoje.data)}`,
      body: (
        <FechamentoCaixaPrint fechamento={fechamentoHoje} responsavelNome={currentUser?.name} />
      ),
    })
  }

  const paginatedVendas = vendasDia.slice(pageVendas * PAGE_SIZE, (pageVendas + 1) * PAGE_SIZE)
  const totalPages = Math.max(1, Math.ceil(vendasDia.length / PAGE_SIZE))

  // ===== Render =====

  // Formulários de moeda: máscara pt-BR simples ao digitar
  const fmtInputCurrency = (v: string) => {
    const digits = v.replace(/\D/g, '')
    const n = Number(digits) / 100
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#1e3a8a]/10 flex items-center justify-center">
            <Wallet className="w-6 h-6 text-[#1e3a8a]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Fechamento de Caixa
              </h1>
              <Badge
                className={
                  !fechamentoHoje
                    ? 'bg-slate-100 text-slate-600'
                    : fechamentoHoje.status === 'aberto'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }
                variant="outline"
              >
                {!fechamentoHoje
                  ? 'Não aberto'
                  : fechamentoHoje.status === 'aberto'
                    ? 'Aberto'
                    : 'Fechado'}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Data: {formatDate(today)} • {formatDateFull(today)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {fechamentoHoje?.status === 'fechado' && (
            <>
              <Button
                onClick={handleImprimir}
                variant="outline"
                className="rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold h-10"
              >
                <Printer className="w-4 h-4 mr-1.5 text-[#1e3a8a]" />
                Imprimir Resumo
              </Button>
              <Button
                onClick={() => setReabrirModalOpen(true)}
                variant="outline"
                className="rounded-xl border-amber-300 text-amber-700 hover:bg-amber-50 text-xs font-semibold h-10"
              >
                <Unlock className="w-4 h-4 mr-1.5" />
                Reabrir Caixa
              </Button>
            </>
          )}
        </div>
      </div>

      {/* CASO 1: Caixa não aberto */}
      {!fechamentoHoje && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <Wallet className="w-8 h-8 text-slate-400" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Caixa do dia não aberto</h2>
          <p className="text-sm text-slate-500 mt-1 mb-5">
            Abra o caixa para registrar vendas, movimentações e fechar o expediente.
          </p>
          <Button
            onClick={() => setAbrirModalOpen(true)}
            className="rounded-xl bg-[#1e3a8a] hover:bg-[#1e3a8a]/90 text-white text-sm font-semibold h-11 px-6"
          >
            <Unlock className="w-4 h-4 mr-2" />
            Abrir Caixa
          </Button>
        </div>
      )}

      {/* CASO 2: Caixa ABERTO */}
      {fechamentoHoje && fechamentoHoje.status === 'aberto' && (
        <>
          {/* Cards totais por forma de pagamento */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <PaymentCard
              icon={<Banknote className="w-5 h-5" />}
              label="Dinheiro"
              value={totaisForma.dinheiro}
              color="bg-emerald-50 text-emerald-700"
            />
            <PaymentCard
              icon={<CreditCard className="w-5 h-5" />}
              label="Débito"
              value={totaisForma.debito}
              color="bg-blue-50 text-blue-700"
            />
            <PaymentCard
              icon={<CreditCard className="w-5 h-5" />}
              label="Crédito"
              value={totaisForma.credito}
              color="bg-indigo-50 text-indigo-700"
            />
            <PaymentCard
              icon={<Smartphone className="w-5 h-5" />}
              label="PIX"
              value={totaisForma.pix}
              color="bg-teal-50 text-teal-700"
            />
            <PaymentCard
              icon={<HeartPulse className="w-5 h-5" />}
              label="Convênio"
              value={totaisForma.convenio}
              color="bg-purple-50 text-purple-700"
            />
            <PaymentCard
              icon={<FileText className="w-5 h-5" />}
              label="Boleto"
              value={totaisForma.boleto}
              color="bg-amber-50 text-amber-700"
            />
          </div>

          {/* Tabela de vendas do dia */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-[#1e3a8a]" />
                Vendas do Dia ({vendasDia.length})
              </h3>
              <span className="text-xs text-slate-500">
                Total: <strong className="text-slate-800">{formatCurrency(totalVendas)}</strong>
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider text-[11px] font-bold">
                  <tr>
                    <th className="py-2.5 px-4">Hora</th>
                    <th className="py-2.5 px-4">Paciente</th>
                    <th className="py-2.5 px-4">Tipo</th>
                    <th className="py-2.5 px-4">Forma Pagamento</th>
                    <th className="py-2.5 px-4 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedVendas.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-6 px-4 text-center text-slate-400 italic text-xs"
                      >
                        Nenhuma venda registrada hoje.
                      </td>
                    </tr>
                  ) : (
                    paginatedVendas.map((s) => {
                      const hora = (s.createdAt || s.date || '').slice(11, 16) || '—'
                      return (
                        <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 px-4 text-slate-600 font-mono">{hora}</td>
                          <td className="py-2.5 px-4 font-semibold text-slate-800">
                            {s.patientName || '—'}
                          </td>
                          <td className="py-2.5 px-4">
                            <Badge
                              variant="outline"
                              className={
                                s.type === 'PDV'
                                  ? 'bg-teal-50 text-teal-700 border-teal-200'
                                  : 'bg-blue-50 text-blue-700 border-blue-200'
                              }
                            >
                              {s.type === 'PDV' ? 'PDV' : 'Atendimento'}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-4 text-slate-600">
                            {FORMA_LABEL_CURTA[salePaymentToCaixa(s.paymentMethod)]}
                          </td>
                          <td className="py-2.5 px-4 text-right font-bold text-slate-800">
                            {formatCurrency(s.totalValue)}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
            {vendasDia.length > PAGE_SIZE && (
              <div className="p-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">
                  Página {pageVendas + 1} de {totalPages}
                </span>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pageVendas === 0}
                    onClick={() => setPageVendas((p) => Math.max(0, p - 1))}
                    className="h-8 text-xs"
                  >
                    Anterior
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pageVendas >= totalPages - 1}
                    onClick={() => setPageVendas((p) => p + 1)}
                    className="h-8 text-xs"
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Movimentações manuais */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ArrowUpCircle className="w-4 h-4 text-emerald-600" />
                Movimentações ({movsAtuais.length})
              </h3>
              <Button
                size="sm"
                onClick={() => setMovModalOpen(true)}
                className="bg-[#1e3a8a] hover:bg-[#1e3a8a]/90 text-white text-xs font-semibold rounded-xl h-9"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Movimentação
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider text-[11px] font-bold">
                  <tr>
                    <th className="py-2.5 px-4">Tipo</th>
                    <th className="py-2.5 px-4">Descrição</th>
                    <th className="py-2.5 px-4">Forma</th>
                    <th className="py-2.5 px-4 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {movsAtuais.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-6 px-4 text-center text-slate-400 italic text-xs"
                      >
                        Nenhuma movimentação manual registrada.
                      </td>
                    </tr>
                  ) : (
                    movsAtuais.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2.5 px-4">
                          {m.tipo === 'entrada' ? (
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
                              <ArrowUpCircle className="w-3 h-3 mr-1" /> Entrada
                            </Badge>
                          ) : (
                            <Badge className="bg-red-50 text-red-700 border-red-200">
                              <ArrowDownCircle className="w-3 h-3 mr-1" /> Saída
                            </Badge>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-slate-700">{m.descricao}</td>
                        <td className="py-2.5 px-4 text-slate-600">
                          {FORMA_LABEL_CURTA[m.formaPagamento]}
                        </td>
                        <td
                          className={`py-2.5 px-4 text-right font-bold ${
                            m.tipo === 'entrada' ? 'text-emerald-700' : 'text-red-700'
                          }`}
                        >
                          {m.tipo === 'entrada' ? '+' : '-'}
                          {formatCurrency(m.valor)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Resumo + Fechamento */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Resumo */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 lg:col-span-2">
              <h3 className="text-sm font-bold text-slate-900 mb-4">Resumo do Caixa</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <ResumoItem label="Saldo Inicial" value={fechamentoHoje.saldoInicial} />
                <ResumoItem label="Total Vendas" value={totalVendas} color="text-[#1e3a8a]" />
                <ResumoItem label="Total Entradas" value={totalEntradas} color="text-emerald-700" />
                <ResumoItem label="Total Saídas" value={totalSaidas} color="text-red-700" />
                <ResumoItem
                  label="Saldo Calculado"
                  value={saldoCalculado}
                  color="text-slate-900"
                  bold
                />
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                  <p className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                    Saldo Final Informado
                  </p>
                  <Input
                    value={saldoFinalInput}
                    onChange={(e) => setSaldoFinalInput(e.target.value)}
                    className="mt-1 h-9 text-sm font-bold text-slate-900"
                    placeholder="0,00"
                  />
                </div>
              </div>

              {/* Diferença */}
              <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <p className="text-xs text-slate-500 font-semibold">Diferença</p>
                  <p className="text-[11px] text-slate-400">
                    Saldo Calculado − Saldo Final Informado
                  </p>
                </div>
                <p
                  className={`text-xl font-extrabold ${
                    Math.abs(diferenca) > 0.009 ? 'text-red-600' : 'text-emerald-600'
                  }`}
                >
                  {formatCurrency(diferenca)}
                </p>
              </div>
              {Math.abs(diferenca) > 0.009 && (
                <div className="mt-2 flex items-center gap-2 text-xs text-red-600">
                  <AlertTriangle className="w-4 h-4" />
                  Há diferença entre o saldo calculado e o saldo informado.
                </div>
              )}
            </div>

            {/* Fechar caixa */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col">
              <h3 className="text-sm font-bold text-slate-900 mb-4">Encerrar Caixa</h3>
              <div className="space-y-3 flex-1">
                <div>
                  <Label className="text-xs text-slate-600">Observação</Label>
                  <Textarea
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value)}
                    placeholder="Observações sobre o fechamento..."
                    className="mt-1 text-sm"
                    rows={4}
                  />
                </div>
              </div>
              <Button
                onClick={() => setFecharModalOpen(true)}
                className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl h-11"
              >
                <Lock className="w-4 h-4 mr-2" />
                Fechar Caixa
              </Button>
            </div>
          </div>
        </>
      )}

      {/* CASO 3: Caixa FECHADO */}
      {fechamentoHoje && fechamentoHoje.status === 'fechado' && (
        <FechamentoResumo
          fechamento={fechamentoHoje}
          responsavelNome={currentUser?.name}
          onImprimir={handleImprimir}
        />
      )}

      {/* ===== MODAL: Abrir Caixa ===== */}
      <Dialog open={abrirModalOpen} onOpenChange={setAbrirModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Abrir Caixa</DialogTitle>
            <DialogDescription>
              Informe o saldo inicial em dinheiro disponível no caixa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs text-slate-600">Saldo Inicial (R$)</Label>
              <Input
                value={saldoInicial}
                onChange={(e) => setSaldoInicial(fmtInputCurrency(e.target.value))}
                className="mt-1 text-base font-bold"
                placeholder="0,00"
              />
            </div>
            <p className="text-xs text-slate-500">
              Data do caixa: <strong>{formatDate(today)}</strong>
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAbrirModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleAbrirCaixa}
              className="bg-[#1e3a8a] hover:bg-[#1e3a8a]/90 text-white"
            >
              Confirmar Abertura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== MODAL: Nova Movimentação ===== */}
      <Dialog open={movModalOpen} onOpenChange={setMovModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Movimentação</DialogTitle>
            <DialogDescription>Registre uma entrada ou saída manual no caixa.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs text-slate-600">Tipo</Label>
              <Select value={movTipo} onValueChange={(v) => setMovTipo(v as MovimentacaoCaixaTipo)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="saida">Saída</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-slate-600">Valor (R$)</Label>
              <Input
                value={movValor}
                onChange={(e) => setMovValor(fmtInputCurrency(e.target.value))}
                className="mt-1 font-bold"
                placeholder="0,00"
              />
            </div>
            <div>
              <Label className="text-xs text-slate-600">Forma de Pagamento</Label>
              <Select value={movForma} onValueChange={(v) => setMovForma(v as FormaPagamentoCaixa)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dinheiro">💵 Dinheiro</SelectItem>
                  <SelectItem value="debito">💳 Débito</SelectItem>
                  <SelectItem value="credito">💳 Crédito</SelectItem>
                  <SelectItem value="pix">📱 PIX</SelectItem>
                  <SelectItem value="convenio">🏥 Convênio</SelectItem>
                  <SelectItem value="boleto">📄 Boleto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-slate-600">Descrição</Label>
              <Textarea
                value={movDescricao}
                onChange={(e) => setMovDescricao(e.target.value)}
                className="mt-1"
                placeholder="Motivo da movimentação..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMovModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleAddMovimentacao}
              className="bg-[#1e3a8a] hover:bg-[#1e3a8a]/90 text-white"
            >
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== MODAL: Confirmar Fechamento ===== */}
      <ConfirmDialog
        open={fecharModalOpen}
        onOpenChange={setFecharModalOpen}
        title="Confirmar fechamento do caixa?"
        description={
          Math.abs(diferenca) > 0.009
            ? `Atenção: há uma diferença de ${formatCurrency(diferenca)}. O caixa será fechado com os valores atuais.`
            : 'O caixa será fechado com os valores informados. Esta ação pode ser desfeita apenas reabrindo o caixa.'
        }
        confirmText="Sim, Fechar Caixa"
        cancelText="Cancelar"
        variant="success"
        onConfirm={handleFecharCaixa}
      />

      {/* ===== MODAL: Reabrir Caixa ===== */}
      <Dialog open={reabrirModalOpen} onOpenChange={setReabrirModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reabrir Caixa</DialogTitle>
            <DialogDescription>
              Informe a justificativa para reabertura do caixa. A justificativa será registrada no
              histórico.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Textarea
              value={justificativaReabrir}
              onChange={(e) => setJustificativaReabrir(e.target.value)}
              placeholder="Justificativa da reabertura..."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReabrirModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleReabrirCaixa}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              Reabrir Caixa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ===== Subcomponentes =====

function PaymentCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: number
  color: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${color}`}>
        {icon}
      </div>
      <p className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">{label}</p>
      <p className="text-base font-extrabold text-slate-900 mt-0.5">{formatCurrency(value)}</p>
    </div>
  )
}

function ResumoItem({
  label,
  value,
  color,
  bold,
}: {
  label: string
  value: number
  color?: string
  bold?: boolean
}) {
  return (
    <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
      <p className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">{label}</p>
      <p
        className={`text-lg ${bold ? 'font-extrabold' : 'font-bold'} ${
          color || 'text-slate-800'
        } mt-0.5`}
      >
        {formatCurrency(value)}
      </p>
    </div>
  )
}

function FechamentoResumo({
  fechamento,
  responsavelNome,
  onImprimir,
}: {
  fechamento: FechamentoCaixa
  responsavelNome?: string
  onImprimir: () => void
}) {
  const formas: { label: string; valor: number; icon: React.ReactNode }[] = [
    { label: 'Dinheiro', valor: fechamento.totalDinheiro, icon: <Banknote className="w-4 h-4" /> },
    { label: 'Débito', valor: fechamento.totalDebito, icon: <CreditCard className="w-4 h-4" /> },
    { label: 'Crédito', valor: fechamento.totalCredito, icon: <CreditCard className="w-4 h-4" /> },
    { label: 'PIX', valor: fechamento.totalPix, icon: <Smartphone className="w-4 h-4" /> },
    {
      label: 'Convênio',
      valor: fechamento.totalConvenio,
      icon: <HeartPulse className="w-4 h-4" />,
    },
    { label: 'Boleto', valor: fechamento.totalBoleto, icon: <FileText className="w-4 h-4" /> },
  ]
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {formas.map((f) => (
          <PaymentCard
            key={f.label}
            icon={f.icon}
            label={f.label}
            value={f.valor}
            color="bg-slate-100 text-slate-700"
          />
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-bold text-slate-900">Resumo do Fechamento</h3>
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200" variant="outline">
            <Lock className="w-3 h-3 mr-1" /> Fechado
          </Badge>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <ResumoItem label="Saldo Inicial" value={fechamento.saldoInicial} />
          <ResumoItem label="Total Vendas" value={fechamento.totalVendas} color="text-[#1e3a8a]" />
          <ResumoItem label="Qtd. Vendas" value={fechamento.quantidadeVendas} />
          <ResumoItem
            label="Total Entradas"
            value={fechamento.totalEntradas}
            color="text-emerald-700"
          />
          <ResumoItem label="Total Saídas" value={fechamento.totalSaidas} color="text-red-700" />
          <ResumoItem label="Saldo Final" value={fechamento.saldoFinal} bold />
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
            <p className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">
              Diferença
            </p>
            <p
              className={`text-lg font-extrabold mt-0.5 ${
                Math.abs(fechamento.diferenca) > 0.009 ? 'text-red-600' : 'text-emerald-600'
              }`}
            >
              {formatCurrency(fechamento.diferenca)}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
            <p className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">
              Fechado por
            </p>
            <p className="text-sm font-bold text-slate-800 mt-0.5">
              {fechamento.usuarioNome || responsavelNome || '—'}
            </p>
            <p className="text-[11px] text-slate-500">{formatDate(fechamento.updated)}</p>
          </div>
        </div>

        {fechamento.observacao && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold text-slate-600 mb-1">Observações</p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{fechamento.observacao}</p>
          </div>
        )}
      </div>
    </>
  )
}

/** Data por extenso simples em pt-BR. */
function formatDateFull(d: string): string {
  try {
    const date = new Date(d + 'T00:00:00')
    if (isNaN(date.getTime())) return ''
    return new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date)
  } catch {
    return ''
  }
}
