import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Building2,
  Ban,
  Receipt,
  Printer,
  CheckCircle2,
  FileText,
  Save,
  ShieldAlert,
  Wallet,
} from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
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
import { usePrint } from '@/components/print/PrintProvider'
import { NFServicoComissaoPrint } from '@/components/print/NFServicoComissaoPrint'
import type { VendaB2B, VendaB2BStatus, NFServicoComissao } from '@/types'

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

const DEFAULT_DISCRIMINACAO =
  'Promoção de vendas e intermediação comercial - Comissão sobre venda de aparelhos auditivos'

export default function DetalhesVendaB2B() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { print } = usePrint()
  const {
    vendasB2B,
    fetchVendasB2B,
    empresasParceiras,
    clinicSettings,
    updateVendaB2B,
    cancelVendaB2B,
    addNFServicoComissao,
    updateNFServicoComissao,
    fetchItensVendaB2B,
  } = useApp()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [itensCarregados, setItensCarregados] = useState<any[]>([])
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelLoading, setCancelLoading] = useState(false)

  // Formulário de NF
  const [nfForm, setNfForm] = useState({
    numero_nf: '',
    codigo_verificacao: '',
    aliquota_iss: 3,
    item_lista_servico: '10.01',
    discriminacao_servico: DEFAULT_DISCRIMINACAO,
    data_emissao: (() => {
      const d = new Date()
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate(),
      ).padStart(2, '0')}`
    })(),
  })
  const [emitLoading, setEmitLoading] = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true)
      await fetchVendasB2B()
      if (id) {
        const itens = await fetchItensVendaB2B(id)
        if (active) setItensCarregados(itens)
      }
      if (active) setLoading(false)
    })()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const venda = useMemo<VendaB2B | undefined>(
    () => vendasB2B.find((v) => v.id === id),
    [vendasB2B, id],
  )

  const empresa = useMemo(
    () => empresasParceiras.find((e) => e.id === venda?.cliente_empresa_id),
    [empresasParceiras, venda],
  )

  const nf = venda?.nf || null

  const valorIssCalc = ((venda?.valor_comissao || 0) * (Number(nfForm.aliquota_iss) || 0)) / 100
  const valorLiquidoCalc = (venda?.valor_comissao || 0) - valorIssCalc

  const handleEmitirNF = async () => {
    if (!venda) return
    if (!nfForm.numero_nf.trim()) {
      toast({ title: 'Informe o número da NF', variant: 'destructive' })
      return
    }
    setEmitLoading(true)
    try {
      const base = venda.valor_comissao
      const iss = (base * Number(nfForm.aliquota_iss || 0)) / 100
      const liquido = base - iss
      const result = await addNFServicoComissao({
        venda_b2b_id: venda.id,
        numero_nf: nfForm.numero_nf.trim(),
        codigo_verificacao: nfForm.codigo_verificacao.trim(),
        data_emissao: nfForm.data_emissao,
        valor_base: base,
        aliquota_iss: Number(nfForm.aliquota_iss) || 0,
        valor_iss: iss,
        valor_liquido: liquido,
        discriminacao_servico: nfForm.discriminacao_servico || DEFAULT_DISCRIMINACAO,
        item_lista_servico: nfForm.item_lista_servico || '10.01',
        status: 'emitida',
      })
      if (result) {
        toast({ title: 'NF de Promoção de Vendas emitida com sucesso' })
      }
    } finally {
      setEmitLoading(false)
    }
  }

  const handleCancelarNF = async () => {
    if (!nf) return
    const res = await updateNFServicoComissao(nf.id, { status: 'cancelada' })
    if (res.success) {
      // volta status da venda para aprovada e limpa o repasse
      await updateVendaB2B(venda!.id, {
        status: 'aprovada',
        status_repasse: 'pendente',
        data_recebimento_comissao: undefined,
      })
      toast({ title: 'NF de Promoção de Vendas cancelada', variant: 'destructive' })
    }
  }

  const handleRegistrarRepasse = async () => {
    if (!venda) return
    const hoje = (() => {
      const d = new Date()
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate(),
      ).padStart(2, '0')}`
    })()
    await updateVendaB2B(venda.id, {
      status_repasse: 'recebido',
      data_recebimento_comissao: hoje,
    })
    toast({ title: 'Repasse de comissão recebido' })
  }

  const handleEstornarRepasse = async () => {
    if (!venda) return
    await updateVendaB2B(venda.id, {
      status_repasse: 'pendente',
      data_recebimento_comissao: undefined,
    })
    toast({ title: 'Repasse reaberto', variant: 'destructive' })
  }

  const handleImprimirNF = () => {
    if (!venda || !nf) return
    print({
      title: `NF ${nf.numero_nf} — ${venda.numero_venda}`,
      body: (
        <NFServicoComissaoPrint venda={venda} nf={nf} empresa={empresa} clinic={clinicSettings} />
      ),
    })
  }

  const handleAprovar = async () => {
    if (!venda) return
    await updateVendaB2B(venda.id, { status: 'aprovada' })
    toast({ title: 'Venda aprovada — baixa de estoque realizada' })
  }

  const handleConcluir = async () => {
    if (!venda) return
    await updateVendaB2B(venda.id, { status: 'concluida' })
    toast({ title: 'Venda concluída' })
  }

  const handleCancelar = async () => {
    if (!venda) return
    setCancelLoading(true)
    try {
      await cancelVendaB2B(venda.id, cancelReason)
      setCancelOpen(false)
      setCancelReason('')
    } finally {
      setCancelLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        Carregando venda...
      </div>
    )
  }

  if (!venda) {
    return (
      <div className="space-y-5">
        <Button
          variant="outline"
          onClick={() => navigate('/vendas-b2b')}
          className="rounded-xl text-sm"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Voltar
        </Button>
        <div className="bg-white p-10 rounded-2xl border border-slate-200 text-center text-slate-500">
          Venda B2B não encontrada.
        </div>
      </div>
    )
  }

  const itens = venda.itens?.length ? venda.itens : itensCarregados
  const canEmitNF = (venda.status === 'pendente' || venda.status === 'aprovada') && !nf
  const canCancelVenda = venda.status !== 'cancelada' && venda.status !== 'concluida'

  return (
    <div className="space-y-5 animate-in fade-in-50 duration-200">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/vendas-b2b')}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                {venda.numero_venda}
              </h1>
              <Badge variant="outline" className={statusColors[venda.status]}>
                {statusLabel[venda.status]}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Venda B2B · {formatDate(venda.data_venda)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {venda.status === 'pendente' && (
            <Button
              onClick={handleAprovar}
              className="rounded-xl text-xs bg-blue-700 hover:bg-blue-800 text-white"
            >
              <CheckCircle2 className="w-4 h-4 mr-1" /> Aprovar
            </Button>
          )}
          {(venda.status === 'aprovada' || venda.status === 'nf_emitida') && (
            <Button onClick={handleConcluir} variant="outline" className="rounded-xl text-xs">
              <CheckCircle2 className="w-4 h-4 mr-1" /> Concluir
            </Button>
          )}
          {canCancelVenda && (
            <Button
              onClick={() => setCancelOpen(true)}
              variant="outline"
              className="rounded-xl text-xs text-red-600 border-red-200 hover:bg-red-50"
            >
              <Ban className="w-4 h-4 mr-1" /> Cancelar Venda
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Coluna principal */}
        <div className="lg:col-span-2 space-y-5">
          {/* Dados da venda */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-700" /> Dados da Venda
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-xs text-slate-500 font-semibold">Nº Venda</span>
                <p className="font-bold text-slate-900">{venda.numero_venda}</p>
              </div>
              <div>
                <span className="text-xs text-slate-500 font-semibold">Data</span>
                <p className="font-semibold text-slate-900">{formatDate(venda.data_venda)}</p>
              </div>
              <div>
                <span className="text-xs text-slate-500 font-semibold">Empresa</span>
                <p className="font-semibold text-slate-900">
                  {venda.cliente_empresa_nome || empresa?.razao_social || '—'}
                </p>
                {empresa?.cnpj && <p className="text-xs text-slate-500">CNPJ: {empresa.cnpj}</p>}
              </div>
              <div>
                <span className="text-xs text-slate-500 font-semibold">Especialista</span>
                <p className="font-semibold text-slate-900">{venda.especialista_nome || '—'}</p>
              </div>
            </div>
          </div>

          {/* Itens */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900 mb-3">Itens da Venda</h2>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="text-xs uppercase tracking-wider">Produto</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider text-right">
                      Qtd.
                    </TableHead>
                    <TableHead className="text-xs uppercase tracking-wider text-right">
                      Valor Unit.
                    </TableHead>
                    <TableHead className="text-xs uppercase tracking-wider text-right">
                      Subtotal
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itens.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-slate-400 py-6">
                        Sem itens.
                      </TableCell>
                    </TableRow>
                  ) : (
                    itens.map((it: any) => (
                      <TableRow key={it.id || it.key}>
                        <TableCell className="font-medium text-slate-800">
                          {it.produto_nome || '—'}
                        </TableCell>
                        <TableCell className="text-right">{it.quantidade}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(it.valor_unitario)}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {formatCurrency(it.valor_subtotal)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Observações */}
          {venda.observacoes && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <h2 className="text-sm font-bold text-slate-900 mb-2">Observações</h2>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{venda.observacoes}</p>
            </div>
          )}

          {/* Seção NF de Promoção de Vendas */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-blue-700" /> NF de Promoção de Vendas
            </h2>

            {venda.status === 'cancelada' ? (
              <div className="text-sm text-slate-500 italic">
                Venda cancelada — não é possível emitir NF.
              </div>
            ) : nf ? (
              /* NF já emitida */
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <Badge
                    variant="outline"
                    className={
                      nf.status === 'emitida'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : nf.status === 'cancelada'
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                    }
                  >
                    {nf.status === 'emitida'
                      ? 'Emitida'
                      : nf.status === 'cancelada'
                        ? 'Cancelada'
                        : 'Rascunho'}
                  </Badge>
                  <div className="flex gap-2">
                    {nf.status === 'emitida' && (
                      <>
                        <Button
                          size="sm"
                          onClick={handleImprimirNF}
                          className="rounded-lg text-xs bg-blue-700 hover:bg-blue-800 text-white"
                        >
                          <Printer className="w-3.5 h-3.5 mr-1" /> Imprimir NF
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCancelarNF}
                          className="rounded-lg text-xs text-red-600 border-red-200 hover:bg-red-50"
                        >
                          <Ban className="w-3.5 h-3.5 mr-1" /> Cancelar NF
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  <div>
                    <span className="text-xs text-slate-500 font-semibold">Nº NF</span>
                    <p className="font-bold text-slate-900">{nf.numero_nf}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-semibold">Cód. Verificação</span>
                    <p className="font-semibold text-slate-900">{nf.codigo_verificacao || '—'}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-semibold">Data Emissão</span>
                    <p className="font-semibold text-slate-900">{formatDate(nf.data_emissao)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-semibold">Valor Base</span>
                    <p className="font-bold text-slate-900">{formatCurrency(nf.valor_base)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-semibold">
                      ISS ({Number(nf.aliquota_iss || 0).toFixed(2)}%)
                    </span>
                    <p className="font-semibold text-slate-900">{formatCurrency(nf.valor_iss)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-semibold">Valor Líquido</span>
                    <p className="font-extrabold text-blue-700">
                      {formatCurrency(nf.valor_liquido)}
                    </p>
                  </div>
                </div>
                <div className="text-xs text-slate-500">
                  <span className="font-semibold">Discriminação:</span> {nf.discriminacao_servico}
                </div>
                <div className="text-xs text-slate-500">
                  <span className="font-semibold">Item Lista Serviço:</span> {nf.item_lista_servico}
                </div>
              </div>
            ) : canEmitNF ? (
              /* Formulário de emissão */
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold text-slate-600 mb-1 block">
                      Nº da NF *
                    </Label>
                    <Input
                      value={nfForm.numero_nf}
                      onChange={(e) => setNfForm({ ...nfForm, numero_nf: e.target.value })}
                      className="h-9 rounded-lg text-sm"
                      placeholder="Ex: 0001"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-slate-600 mb-1 block">
                      Código de Verificação
                    </Label>
                    <Input
                      value={nfForm.codigo_verificacao}
                      onChange={(e) => setNfForm({ ...nfForm, codigo_verificacao: e.target.value })}
                      className="h-9 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-slate-600 mb-1 block">
                      Data Emissão
                    </Label>
                    <Input
                      type="date"
                      value={nfForm.data_emissao}
                      onChange={(e) => setNfForm({ ...nfForm, data_emissao: e.target.value })}
                      className="h-9 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-slate-600 mb-1 block">
                      Alíquota ISS (%)
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={nfForm.aliquota_iss}
                      onChange={(e) =>
                        setNfForm({ ...nfForm, aliquota_iss: Number(e.target.value) })
                      }
                      className="h-9 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-slate-600 mb-1 block">
                      Item Lista Serviço
                    </Label>
                    <Input
                      value={nfForm.item_lista_servico}
                      onChange={(e) => setNfForm({ ...nfForm, item_lista_servico: e.target.value })}
                      className="h-9 rounded-lg text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs font-semibold text-slate-600 mb-1 block">
                      Discriminação do Serviço
                    </Label>
                    <Textarea
                      value={nfForm.discriminacao_servico}
                      onChange={(e) =>
                        setNfForm({ ...nfForm, discriminacao_servico: e.target.value })
                      }
                      className="rounded-lg text-sm min-h-[60px]"
                    />
                  </div>
                </div>

                {/* Preview cálculo */}
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Valor Base (Comissão)</span>
                    <span className="font-semibold">{formatCurrency(venda.valor_comissao)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">
                      ISS ({Number(nfForm.aliquota_iss || 0).toFixed(2)}%)
                    </span>
                    <span className="font-semibold">{formatCurrency(valorIssCalc)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-1">
                    <span className="font-bold text-slate-700">Valor Líquido</span>
                    <span className="font-extrabold text-blue-700">
                      {formatCurrency(valorLiquidoCalc)}
                    </span>
                  </div>
                </div>

                <Button
                  onClick={handleEmitirNF}
                  disabled={emitLoading}
                  className="rounded-xl text-sm bg-blue-700 hover:bg-blue-800 text-white"
                >
                  <FileText className="w-4 h-4 mr-1.5" />
                  {emitLoading ? 'Emitindo...' : 'Emitir NF de Promoção de Vendas'}
                </Button>
              </div>
            ) : (
              <div className="text-sm text-slate-500 italic flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" />
                Aprove a venda antes de emitir a NF de Promoção de Vendas.
              </div>
            )}
          </div>

          {/* Seção Repasse da Comissão */}
          {nf && nf.status === 'emitida' && venda.status !== 'cancelada' && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-blue-700" /> Repasse da Comissão
              </h2>
              <div className="space-y-3">
                <p className="text-xs text-slate-500">
                  Após a emissão da NF de Promoção de Vendas, a empresa parceira deve repassar os{' '}
                  {Number(venda.percentual_comissao || 0).toFixed(2)}% de comissão para a
                  Audição360.
                </p>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <Badge
                    variant="outline"
                    className={
                      venda.status_repasse === 'recebido'
                        ? 'bg-green-50 text-green-800 border-green-300'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }
                  >
                    {venda.status_repasse === 'recebido'
                      ? 'Comissão Recebida'
                      : 'Aguardando Repasse'}
                  </Badge>
                  {venda.data_recebimento_comissao && (
                    <span className="text-xs text-slate-500">
                      Recebido em {formatDate(venda.data_recebimento_comissao)}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {venda.status_repasse !== 'recebido' ? (
                    <Button
                      size="sm"
                      onClick={handleRegistrarRepasse}
                      className="rounded-lg text-xs bg-green-600 hover:bg-green-700 text-white"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Registrar Repasse Recebido
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleEstornarRepasse}
                      className="rounded-lg text-xs text-amber-700 border-amber-200 hover:bg-amber-50"
                    >
                      <Ban className="w-3.5 h-3.5 mr-1" /> Reabrir Repasse
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Resumo lateral */}
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900 mb-4">Valores</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Valor Total
                </span>
                <span className="text-lg font-extrabold text-slate-900">
                  {formatCurrency(venda.valor_total)}
                </span>
              </div>
              <div
                className={`flex items-center justify-between py-2 px-3 rounded-xl border ${
                  venda.status_repasse === 'recebido'
                    ? 'bg-green-50 border-green-300'
                    : 'bg-emerald-50 border-emerald-200'
                }`}
              >
                <span
                  className={`text-xs font-semibold uppercase tracking-wider ${
                    venda.status_repasse === 'recebido' ? 'text-green-800' : 'text-emerald-700'
                  }`}
                >
                  Comissão ({Number(venda.percentual_comissao || 0).toFixed(2)}%)
                  {venda.status_repasse === 'recebido' && ' · Recebida'}
                </span>
                <span
                  className={`text-lg font-extrabold ${
                    venda.status_repasse === 'recebido' ? 'text-green-700' : 'text-emerald-700'
                  }`}
                >
                  {formatCurrency(venda.valor_comissao)}
                </span>
              </div>
              {venda.data_recebimento_comissao && (
                <p className="text-[11px] text-green-700 -mt-1">
                  Repasse recebido em {formatDate(venda.data_recebimento_comissao)}
                </p>
              )}
              <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Repasse ao Fornecedor
                </span>
                <span className="text-base font-bold text-slate-700">
                  {formatCurrency(venda.valor_repasse)}
                </span>
              </div>
            </div>
          </div>

          {/* Dados da empresa */}
          {empresa && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <h2 className="text-sm font-bold text-slate-900 mb-3">Empresa Parceira</h2>
              <div className="space-y-1 text-sm">
                <p className="font-bold text-slate-900">{empresa.razao_social}</p>
                {empresa.nome_fantasia && (
                  <p className="text-slate-500 text-xs">{empresa.nome_fantasia}</p>
                )}
                {empresa.cnpj && <p className="text-slate-600 text-xs">CNPJ: {empresa.cnpj}</p>}
                {empresa.endereco && (
                  <p className="text-slate-600 text-xs">
                    {empresa.endereco}
                    {empresa.cidade ? ` — ${empresa.cidade}/${empresa.estado}` : ''}
                  </p>
                )}
                {empresa.telefone && (
                  <p className="text-slate-600 text-xs">Tel.: {empresa.telefone}</p>
                )}
                {empresa.email && <p className="text-slate-600 text-xs">{empresa.email}</p>}
              </div>
            </div>
          )}

          <Button
            variant="outline"
            onClick={() => navigate('/vendas-b2b')}
            className="w-full rounded-xl text-sm"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Voltar à Listagem
          </Button>
        </div>
      </div>

      {/* Modal de cancelamento */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
          <DialogHeader className="border-b border-slate-100 pb-3">
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Ban className="w-5 h-5 text-red-500" />
              Cancelar Venda {venda.numero_venda}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <p className="text-sm text-slate-600">
              Ao cancelar, os produtos serão devolvidos ao estoque (se já tiverem sido baixados).
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
              onClick={() => setCancelOpen(false)}
              className="rounded-xl text-xs"
              disabled={cancelLoading}
            >
              Voltar
            </Button>
            <Button
              onClick={handleCancelar}
              disabled={cancelLoading}
              className="rounded-xl text-xs bg-red-500 hover:bg-red-600 text-white"
            >
              <Save className="w-3.5 h-3.5 mr-1" />
              {cancelLoading ? 'Cancelando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
