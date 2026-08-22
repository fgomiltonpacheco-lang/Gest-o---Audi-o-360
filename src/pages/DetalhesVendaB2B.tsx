import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
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
  Download,
  Loader2,
  AlertTriangle,
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
import { usePrint } from '@/components/print/PrintProvider'
import { NFServicoComissaoPrint } from '@/components/print/NFServicoComissaoPrint'
import {
  emitirNfse,
  cancelarNfse,
  baixarPdfNfse,
  isApiConfigurada,
  type NfseApiConfig,
  type NfseDados,
} from '@/lib/nfse-api'
import type { VendaB2B, VendaB2BStatus, NFServicoStatus } from '@/types'

const statusLabel: Record<string, string> = {
  pendente: 'Pendente',
  aprovada: 'Aprovada',
  nf_emitida: 'NF Emitida',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}

const statusColors: Record<string, string> = {
  pendente: 'bg-amber-50 text-amber-700 border-amber-200',
  aprovada: 'bg-blue-50 text-blue-700 border-blue-200',
  nf_emitida: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  concluida: 'bg-green-50 text-green-800 border-green-300',
  cancelada: 'bg-red-50 text-red-700 border-red-200',
}

const DEFAULT_DISCRIMINACAO =
  'Intermediação comercial - Comissão sobre venda de aparelhos auditivos'

const ITENS_LISTA_SERVICO = [
  { value: '10.01', label: '10.01 — Intermediação de negócios' },
  { value: '10.02', label: '10.02 — Representação comercial' },
  { value: '10.04', label: '10.04 — Agenciamento de negócios' },
  { value: '01.07', label: '01.07 — Outros serviços' },
]

const nfStatusLabel = (s: NFServicoStatus) =>
  s === 'emitida'
    ? 'Emitida'
    : s === 'cancelada'
      ? 'Cancelada'
      : s === 'cancelada_prefeitura'
        ? 'Cancelada na Prefeitura'
        : 'Rascunho'

const nfStatusColor = (s: NFServicoStatus) =>
  s === 'emitida'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : s === 'cancelada' || s === 'cancelada_prefeitura'
      ? 'bg-red-50 text-red-700 border-red-200'
      : 'bg-slate-100 text-slate-600 border-slate-200'

const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

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
    cancelNFServicoComissao,
    fetchItensVendaB2B,
    nfseB2BConfig,
    fetchNfseB2BConfig,
  } = useApp()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [itensCarregados, setItensCarregados] = useState<any[]>([])
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelLoading, setCancelLoading] = useState(false)

  // Modal de cancelamento de NFS-e (com motivo obrigatório)
  const [cancelNfOpen, setCancelNfOpen] = useState(false)
  const [cancelNfMotivo, setCancelNfMotivo] = useState('')
  const [cancelNfLoading, setCancelNfLoading] = useState(false)

  // Formulário de emissão da NFS-e de Comissão
  const [nfForm, setNfForm] = useState({
    numero_nfse: '',
    codigo_verificacao: '',
    aliquota_iss: 3,
    item_lista_servico: '10.01',
    discriminacao_servico: DEFAULT_DISCRIMINACAO,
    data_emissao: todayStr(),
    // Dados do tomador (auto-preenchidos a partir da empresa parceira)
    tomador_cnpj: '',
    tomador_razao_social: '',
    tomador_endereco: '',
    tomador_municipio: '',
    tomador_uf: '',
    tomador_cep: '',
    tomador_email: '',
    pdf_url: '',
  })
  const [emitLoading, setEmitLoading] = useState(false)
  const [baixarPdfLoading, setBaixarPdfLoading] = useState(false)

  /** Constrói o objeto NfseApiConfig a partir das configurações salvas. */
  const nfseApiConfig: NfseApiConfig | null = useMemo(() => {
    if (!nfseB2BConfig) return null
    return {
      baseUrl: nfseB2BConfig.url_api || '',
      usuario: nfseB2BConfig.login_api || '',
      senha: nfseB2BConfig.token_api || '',
      ambiente: nfseB2BConfig.ambiente,
      provedor: nfseB2BConfig.provedor,
      codigoMunicipio: nfseB2BConfig.codigo_municipio,
    }
  }, [nfseB2BConfig])

  const apiConfigurada = isApiConfigurada(nfseApiConfig)

  useEffect(() => {
    fetchNfseB2BConfig()
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

  // Pré-preenche alíquota, discriminação e item da lista conforme Settings
  useEffect(() => {
    if (nfseB2BConfig) {
      setNfForm((prev) => ({
        ...prev,
        aliquota_iss: nfseB2BConfig.aliquota_iss_padrao || prev.aliquota_iss,
        item_lista_servico: nfseB2BConfig.item_lista_servico || prev.item_lista_servico,
        discriminacao_servico: nfseB2BConfig.discriminacao_padrao || prev.discriminacao_servico,
      }))
    }
  }, [nfseB2BConfig])

  // Pré-preenche os dados do tomador a partir do cadastro da empresa parceira
  useEffect(() => {
    if (empresa && !nf) {
      setNfForm((prev) => ({
        ...prev,
        tomador_cnpj: empresa.cnpj || prev.tomador_cnpj,
        tomador_razao_social: empresa.razao_social || prev.tomador_razao_social,
        tomador_endereco: empresa.endereco || prev.tomador_endereco,
        tomador_municipio: empresa.cidade || prev.tomador_municipio,
        tomador_uf: empresa.estado || prev.tomador_uf,
        tomador_cep: empresa.cep || prev.tomador_cep,
        tomador_email: empresa.email || prev.tomador_email,
      }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresa?.id])

  const valorIssCalc = ((venda?.valor_comissao || 0) * (Number(nfForm.aliquota_iss) || 0)) / 100
  const valorLiquidoCalc = (venda?.valor_comissao || 0) - valorIssCalc

  const handleEmitirNF = async () => {
    if (!venda) return
    // RN1: só pode emitir NFS-e com venda aprovada
    if (venda.status !== 'aprovada') {
      toast({
        title: 'Venda não aprovada',
        description: 'A NFS-e só pode ser emitida após a aprovação da venda B2B.',
        variant: 'destructive',
      })
      return
    }
    if (!nfForm.tomador_cnpj.trim() || !nfForm.tomador_razao_social.trim()) {
      toast({
        title: 'Dados do tomador incompletos',
        description: 'Informe o CNPJ e a razão social do tomador.',
        variant: 'destructive',
      })
      return
    }
    setEmitLoading(true)
    try {
      const base = venda.valor_comissao // RN2: base = comissão
      const aliquota = Number(nfForm.aliquota_iss) || 0
      const iss = (base * aliquota) / 100
      const liquido = base - iss
      const discriminacao = nfForm.discriminacao_servico || DEFAULT_DISCRIMINACAO
      const itemLista = nfForm.item_lista_servico || '10.01'

      // Chama a API da prefeitura (se configurada). Se não houver URL base,
      // a função retorna erro — exibimos e não persistimos a NFS-e.
      let numeroNfse = nfForm.numero_nfse.trim()
      let codigoVerificacao = nfForm.codigo_verificacao.trim()
      let pdfUrl = nfForm.pdf_url.trim()

      if (nfseApiConfig) {
        const dados: NfseDados = {
          prestador: {
            cnpj: '',
            inscricaoMunicipal: nfseB2BConfig?.inscricao_municipal || '',
            razaoSocial: clinicSettings?.nome,
            municipio: nfseB2BConfig?.municipio,
            uf: nfseB2BConfig?.uf,
          },
          tomador: {
            cnpj: nfForm.tomador_cnpj.trim(),
            razaoSocial: nfForm.tomador_razao_social.trim(),
            endereco: nfForm.tomador_endereco.trim(),
            municipio: nfForm.tomador_municipio.trim(),
            uf: nfForm.tomador_uf.trim(),
            cep: nfForm.tomador_cep.trim(),
            email: nfForm.tomador_email.trim(),
          },
          servico: {
            valorBase: base,
            aliquotaIss: aliquota,
            valorIss: iss,
            valorLiquido: liquido,
            itemListaServico: itemLista,
            discriminacao,
          },
          numeroVendaB2B: String(venda.numero_venda || ''),
        }
        const resp = await emitirNfse(nfseApiConfig, dados)
        if (!resp.sucesso) {
          toast({
            title: 'Erro ao emitir NFS-e na prefeitura',
            description: resp.erro,
            variant: 'destructive',
          })
          return
        }
        numeroNfse = resp.numeroNfse || numeroNfse
        codigoVerificacao = resp.codigoVerificacao || codigoVerificacao
        pdfUrl = resp.pdfUrl || pdfUrl
      }

      const result = await addNFServicoComissao({
        venda_id: venda.id,
        venda_b2b_id: venda.id,
        numero_nfse: numeroNfse,
        codigo_verificacao: codigoVerificacao,
        data_emissao: nfForm.data_emissao,
        valor_base: base,
        aliquota_iss: aliquota,
        valor_iss: iss,
        valor_liquido: liquido,
        discriminacao_servico: discriminacao,
        item_lista_servico: itemLista,
        tomador_cnpj: nfForm.tomador_cnpj.trim(),
        tomador_razao_social: nfForm.tomador_razao_social.trim(),
        tomador_endereco: nfForm.tomador_endereco.trim(),
        tomador_municipio: nfForm.tomador_municipio.trim(),
        tomador_uf: nfForm.tomador_uf.trim(),
        tomador_cep: nfForm.tomador_cep.trim(),
        tomador_email: nfForm.tomador_email.trim(),
        pdf_url: pdfUrl,
        status: 'emitida',
      } as any)
      if (result) {
        toast({ title: 'NFS-e de Comissão emitida com sucesso' })
      }
    } finally {
      setEmitLoading(false)
    }
  }

  const handleCancelarNF = async () => {
    if (!nf) return
    if (!cancelNfMotivo.trim()) {
      toast({ title: 'Informe o motivo do cancelamento', variant: 'destructive' })
      return
    }
    setCancelNfLoading(true)
    try {
      // RN4: cancelar NFS-e na prefeitura antes de cancelar venda B2B.
      // Se a API estiver configurada e a NFS-e estiver ativa, chama a prefeitura.
      if (nfseApiConfig && nf.numero_nfse && nf.status === 'emitida') {
        const resp = await cancelarNfse(nfseApiConfig, nf.numero_nfse, cancelNfMotivo.trim())
        if (!resp.sucesso) {
          toast({
            title: 'Erro ao cancelar NFS-e na prefeitura',
            description: resp.erro,
            variant: 'destructive',
          })
          return
        }
      }
      // Atualiza o registro local para 'cancelada_prefeitura' quando a API confirmou,
      // senão mantém 'cancelada' (cancelamento apenas interno).
      const novoStatus: 'cancelada' | 'cancelada_prefeitura' =
        nfseApiConfig && nf.numero_nfse && nf.status === 'emitida'
          ? 'cancelada_prefeitura'
          : 'cancelada'
      const res = await cancelNFServicoComissao(nf.id, cancelNfMotivo, novoStatus)
      if (res.success) {
        setCancelNfOpen(false)
        setCancelNfMotivo('')
      } else {
        toast({ title: 'Erro ao cancelar NFS-e', description: res.message, variant: 'destructive' })
      }
    } finally {
      setCancelNfLoading(false)
    }
  }

  const handleRegistrarRepasse = async () => {
    if (!venda) return
    await updateVendaB2B(venda.id, {
      status_repasse: 'recebido',
      data_recebimento_comissao: todayStr(),
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
      title: `NFS-e ${nf.numero_nfse} — ${venda.numero_venda}`,
      body: (
        <NFServicoComissaoPrint venda={venda} nf={nf} empresa={empresa} clinic={clinicSettings} />
      ),
    })
  }

  const handleBaixarPdf = async () => {
    if (!nf) return
    // Se houver URL remota de PDF, abre diretamente.
    if (nf.pdf_url) {
      window.open(nf.pdf_url, '_blank')
      return
    }
    // Caso contrário, baixa via API da prefeitura (se configurada).
    if (!nfseApiConfig || !apiConfigurada) {
      toast({
        title: 'PDF indisponível',
        description: 'Configure a API da prefeitura nas Configurações para baixar o PDF.',
        variant: 'destructive',
      })
      return
    }
    if (!nf.numero_nfse) {
      toast({ title: 'NFS-e sem número', variant: 'destructive' })
      return
    }
    setBaixarPdfLoading(true)
    try {
      const blob = await baixarPdfNfse(nfseApiConfig, nf.numero_nfse)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `NFSe-${nf.numero_nfse}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err: any) {
      toast({
        title: 'Erro ao baixar PDF',
        description: err?.message,
        variant: 'destructive',
      })
    } finally {
      setBaixarPdfLoading(false)
    }
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
      const res = await cancelVendaB2B(venda.id, cancelReason)
      if (res.success) {
        setCancelOpen(false)
        setCancelReason('')
      } else {
        toast({
          title: 'Não foi possível cancelar',
          description: res.message,
          variant: 'destructive',
        })
      }
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
  // RN1: só pode emitir NFS-e com venda aprovada. RN3: uma venda só pode ter uma NFS-e.
  const canEmitNF = venda.status === 'aprovada' && !nf
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
          {(venda.status === 'aprovada' || (venda.status as any) === 'nf_emitida') && (
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

          {/* Seção NFS-e de Comissão */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-blue-700" /> NFS-e de Comissão
            </h2>

            {venda.status === 'cancelada' ? (
              <div className="text-sm text-slate-500 italic">
                Venda cancelada — não é possível emitir NFS-e.
              </div>
            ) : nf ? (
              /* NFS-e já emitida */
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <Badge variant="outline" className={nfStatusColor(nf.status as any)}>
                    {nfStatusLabel(nf.status as any)}
                  </Badge>
                  <div className="flex gap-2">
                    {nf.status === 'emitida' && (
                      <>
                        <Button
                          size="sm"
                          onClick={handleImprimirNF}
                          className="rounded-lg text-xs bg-blue-700 hover:bg-blue-800 text-white"
                        >
                          <Printer className="w-3.5 h-3.5 mr-1" /> Imprimir
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleBaixarPdf}
                          disabled={baixarPdfLoading}
                          className="rounded-lg text-xs"
                        >
                          {baixarPdfLoading ? (
                            <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                          ) : (
                            <Download className="w-3.5 h-3.5 mr-1" />
                          )}{' '}
                          Baixar PDF
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setCancelNfOpen(true)}
                          className="rounded-lg text-xs text-red-600 border-red-200 hover:bg-red-50"
                        >
                          <Ban className="w-3.5 h-3.5 mr-1" /> Cancelar NFS-e
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  <div>
                    <span className="text-xs text-slate-500 font-semibold">Nº NFS-e</span>
                    <p className="font-bold text-slate-900">{nf.numero_nfse || '—'}</p>
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
                {/* Dados do tomador */}
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                  <p className="text-xs font-bold text-slate-600 mb-1">Tomador</p>
                  <div className="grid grid-cols-2 gap-1 text-xs text-slate-600">
                    <span>
                      <strong>Razão Social:</strong> {nf.tomador_razao_social || '—'}
                    </span>
                    <span>
                      <strong>CNPJ:</strong> {nf.tomador_cnpj || '—'}
                    </span>
                    <span className="col-span-2">
                      <strong>Endereço:</strong> {nf.tomador_endereco}
                      {nf.tomador_municipio ? ` — ${nf.tomador_municipio}` : ''}
                      {nf.tomador_uf ? `/${nf.tomador_uf}` : ''}
                      {nf.tomador_cep ? ` · CEP ${nf.tomador_cep}` : ''}
                    </span>
                    <span>
                      <strong>E-mail:</strong> {nf.tomador_email || '—'}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-slate-500">
                  <span className="font-semibold">Discriminação:</span> {nf.discriminacao_servico}
                </div>
                <div className="text-xs text-slate-500">
                  <span className="font-semibold">Item Lista Serviço:</span> {nf.item_lista_servico}
                </div>
                {nf.motivo_cancelamento && (
                  <div className="text-xs text-red-600">
                    <span className="font-semibold">Motivo do cancelamento:</span>{' '}
                    {nf.motivo_cancelamento}
                  </div>
                )}
              </div>
            ) : canEmitNF ? (
              /* Formulário de emissão */
              <div className="space-y-4">
                {/* Aviso de regra de negócio */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
                  A NFS-e de Comissão é emitida sobre o valor da comissão (R${' '}
                  {formatCurrency(venda.valor_comissao)}), e não sobre o valor total da venda.
                </div>

                {/* Aviso de API não configurada */}
                {!apiConfigurada && (
                  <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <div>
                      Configure a API da prefeitura nas{' '}
                      <Link
                        to="/configuracoes"
                        className="font-bold underline hover:text-amber-900"
                      >
                        Configurações
                      </Link>{' '}
                      para emitir a NFS-e diretamente. Sem a API, a NFS-e será registrada apenas
                      localmente (número/código devem ser informados manualmente).
                    </div>
                  </div>
                )}

                {/* Referência: valor total da venda (não tributado) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                    <span className="text-xs text-slate-500 font-semibold">
                      Valor da Venda (referência — não tributado)
                    </span>
                    <p className="text-lg font-bold text-slate-700">
                      {formatCurrency(venda.valor_total)}
                    </p>
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
                    <span className="text-xs text-emerald-700 font-semibold">
                      Valor Base da NFS-e (Comissão)
                    </span>
                    <p className="text-lg font-extrabold text-emerald-700">
                      {formatCurrency(venda.valor_comissao)}
                    </p>
                  </div>
                </div>

                {/* Dados da NFS-e */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold text-slate-600 mb-1 block">
                      Nº da NFS-e
                    </Label>
                    <Input
                      value={nfForm.numero_nfse}
                      onChange={(e) => setNfForm({ ...nfForm, numero_nfse: e.target.value })}
                      className="h-9 rounded-lg text-sm"
                      placeholder="Gerado pela prefeitura"
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
                  <div className="sm:col-span-2">
                    <Label className="text-xs font-semibold text-slate-600 mb-1 block">
                      Item da Lista de Serviço
                    </Label>
                    <Select
                      value={nfForm.item_lista_servico}
                      onValueChange={(v) => setNfForm({ ...nfForm, item_lista_servico: v })}
                    >
                      <SelectTrigger className="h-9 rounded-lg text-sm">
                        <SelectValue placeholder="Selecione o item" />
                      </SelectTrigger>
                      <SelectContent>
                        {ITENS_LISTA_SERVICO.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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

                {/* Dados do Tomador */}
                <div className="border-t border-slate-100 pt-3">
                  <p className="text-xs font-bold text-slate-700 mb-2">
                    Dados do Tomador (Empresa Parceira)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <Label className="text-xs font-semibold text-slate-600 mb-1 block">
                        Razão Social
                      </Label>
                      <Input
                        value={nfForm.tomador_razao_social}
                        onChange={(e) =>
                          setNfForm({ ...nfForm, tomador_razao_social: e.target.value })
                        }
                        className="h-9 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-slate-600 mb-1 block">
                        CNPJ
                      </Label>
                      <Input
                        value={nfForm.tomador_cnpj}
                        onChange={(e) => setNfForm({ ...nfForm, tomador_cnpj: e.target.value })}
                        className="h-9 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-slate-600 mb-1 block">CEP</Label>
                      <Input
                        value={nfForm.tomador_cep}
                        onChange={(e) => setNfForm({ ...nfForm, tomador_cep: e.target.value })}
                        className="h-9 rounded-lg text-sm"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-xs font-semibold text-slate-600 mb-1 block">
                        Endereço
                      </Label>
                      <Input
                        value={nfForm.tomador_endereco}
                        onChange={(e) => setNfForm({ ...nfForm, tomador_endereco: e.target.value })}
                        className="h-9 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-slate-600 mb-1 block">
                        Município
                      </Label>
                      <Input
                        value={nfForm.tomador_municipio}
                        onChange={(e) =>
                          setNfForm({ ...nfForm, tomador_municipio: e.target.value })
                        }
                        className="h-9 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-slate-600 mb-1 block">UF</Label>
                      <Input
                        value={nfForm.tomador_uf}
                        onChange={(e) => setNfForm({ ...nfForm, tomador_uf: e.target.value })}
                        className="h-9 rounded-lg text-sm"
                        maxLength={2}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-xs font-semibold text-slate-600 mb-1 block">
                        E-mail (para envio da NFS-e)
                      </Label>
                      <Input
                        type="email"
                        value={nfForm.tomador_email}
                        onChange={(e) => setNfForm({ ...nfForm, tomador_email: e.target.value })}
                        className="h-9 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Preview cálculo do ISS */}
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
                  {emitLoading ? (
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  ) : (
                    <FileText className="w-4 h-4 mr-1.5" />
                  )}
                  {emitLoading
                    ? apiConfigurada
                      ? 'Emitindo na prefeitura...'
                      : 'Salvando...'
                    : apiConfigurada
                      ? 'Emitir NFS-e na Prefeitura'
                      : 'Emitir NFS-e de Comissão'}
                </Button>
              </div>
            ) : (
              <div className="text-sm text-slate-500 italic flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" />
                Aprove a venda antes de emitir a NFS-e de Comissão.
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
                  Após a emissão da NFS-e de Comissão, a empresa parceira deve repassar os{' '}
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

      {/* Modal de cancelamento da NFS-e */}
      <Dialog open={cancelNfOpen} onOpenChange={setCancelNfOpen}>
        <DialogContent className="max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
          <DialogHeader className="border-b border-slate-100 pb-3">
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Ban className="w-5 h-5 text-red-500" />
              Cancelar NFS-e {nf?.numero_nfse}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <p className="text-sm text-slate-600">
              O cancelamento da NFS-e é obrigatório antes de cancelar a venda B2B. Informe o motivo
              do cancelamento.
            </p>
            <div>
              <Label className="text-xs font-semibold text-slate-600 mb-1 block">
                Motivo do cancelamento *
              </Label>
              <Textarea
                value={cancelNfMotivo}
                onChange={(e) => setCancelNfMotivo(e.target.value)}
                placeholder="Informe o motivo..."
                className="rounded-xl text-sm min-h-[80px]"
              />
            </div>
          </div>
          <DialogFooter className="pt-2 border-t border-slate-100">
            <Button
              variant="outline"
              onClick={() => setCancelNfOpen(false)}
              className="rounded-xl text-xs"
              disabled={cancelNfLoading}
            >
              Voltar
            </Button>
            <Button
              onClick={handleCancelarNF}
              disabled={cancelNfLoading}
              className="rounded-xl text-xs bg-red-500 hover:bg-red-600 text-white"
            >
              <Save className="w-3.5 h-3.5 mr-1" />
              {cancelNfLoading ? 'Cancelando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de cancelamento da venda */}
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
              {nf && nf.status === 'emitida' && (
                <span className="block mt-1 text-red-600 font-semibold">
                  Esta venda possui uma NFS-e ativa — cancele-a antes de cancelar a venda.
                </span>
              )}
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
