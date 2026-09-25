import React, { useEffect, useMemo, useState } from 'react'
import {
  FileText,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Building2,
  User,
  Calculator,
} from 'lucide-react'
import { useApp } from '@/context/AppContext'
import pb from '@/lib/pocketbase/client'
import { formatCurrency } from '@/lib/formatters'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import type { Sale } from '@/types'

export type TipoNotaFiscal = 'nfse' | 'nfe' | 'ambas'

interface NfseEmitirModalProps {
  sale: Sale | null
  open: boolean
  onOpenChange: (open: boolean) => void
  tipoNota?: TipoNotaFiscal
}

/** Parse defensivo dos itens de uma venda (array ou JSON string) */
export function parseSaleItemsDefensive(sale: Sale | null): Array<{
  id?: string
  name: string
  quantity: number
  unitPrice: number
  totalPrice?: number
  type?: string
  category?: string
}> {
  if (!sale) return []
  const raw = (sale as any).items
  let list: any[] = []
  if (Array.isArray(raw)) {
    list = raw
  } else if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) list = parsed
    } catch {
      list = []
    }
  }

  if (list.length === 0 && sale.itemsDescription) {
    return [
      {
        name: sale.itemsDescription,
        quantity: 1,
        unitPrice: sale.totalValue || 0,
        totalPrice: sale.totalValue || 0,
        type: 'service',
      },
    ]
  }

  return list.map((it: any) => ({
    id: it.id || it.productId || it.procedureId,
    name: it.name || it.description || it.procedureName || 'Item da Venda',
    quantity: Number(it.quantity) || 1,
    unitPrice: Number(it.unitPrice ?? it.price ?? it.value ?? 0),
    totalPrice:
      Number(it.totalPrice ?? it.total) ||
      (Number(it.quantity) || 1) * Number(it.unitPrice ?? it.price ?? it.value ?? 0),
    type: it.type || it.category || '',
    category: it.category || '',
  }))
}

/** Determina automaticamente o tipo de nota a partir dos itens */
export function determineNotaFiscalType(sale: Sale | null): TipoNotaFiscal {
  const items = parseSaleItemsDefensive(sale)
  if (items.length === 0) return 'nfse'

  let hasProduct = false
  let hasService = false

  for (const it of items) {
    const isProduct = isProductItem(it)
    const isService = isServiceItem(it)

    if (isProduct) hasProduct = true
    if (isService) hasService = true
    if (!isProduct && !isService) {
      hasService = true
    }
  }

  if (hasProduct && hasService) return 'ambas'
  if (hasProduct) return 'nfe'
  return 'nfse'
}

/** Verifica se um item representa um produto físico */
export function isProductItem(it: { type?: string; category?: string; name: string }): boolean {
  const t = (it.type || '').toLowerCase()
  const cat = (it.category || '').toLowerCase()
  const name = (it.name || '').toLowerCase()

  return (
    t.includes('produto') ||
    t.includes('inventory') ||
    t.includes('hearing_aid') ||
    t.includes('aparelho') ||
    cat.includes('produto') ||
    cat.includes('estoque') ||
    name.includes('aparelho') ||
    name.includes('pilha') ||
    name.includes('filtro') ||
    name.includes('oliva') ||
    name.includes('molde')
  )
}

/** Verifica se um item representa um serviço/procedimento */
export function isServiceItem(it: { type?: string; category?: string; name: string }): boolean {
  const t = (it.type || '').toLowerCase()
  const cat = (it.category || '').toLowerCase()
  const name = (it.name || '').toLowerCase()

  return (
    t.includes('service') ||
    t.includes('servico') ||
    t.includes('procedimento') ||
    t.includes('exame') ||
    t.includes('consulta') ||
    cat.includes('servico') ||
    cat.includes('procedimento') ||
    name.includes('audiometria') ||
    name.includes('imitancio') ||
    name.includes('consulta') ||
    name.includes('atendimento') ||
    name.includes('sessão') ||
    name.includes('sessao')
  )
}

/**
 * Modal de emissão de NF (NFS-e / NF-e / Ambas) para vendas PDV e recebimentos.
 * Determina o tipo automaticamente pelos itens e persiste o registro na
 * coleção `notas_fiscais` com status 'pendente' e clinica_id obrigatório.
 */
export default function NfseEmitirModal({
  sale,
  open,
  onOpenChange,
  tipoNota: tipoNotaProp,
}: NfseEmitirModalProps) {
  const { currentUser, patients, nfseB2BConfig, emitirNfseVenda, nfseEmitidas } = useApp()

  const [tipoNota, setTipoNota] = useState<TipoNotaFiscal>(tipoNotaProp || 'nfse')
  const [tomadorNome, setTomadorNome] = useState('')
  const [tomadorCpfCnpj, setTomadorCpfCnpj] = useState('')
  const [aliquota, setAliquota] = useState('3')
  const [discriminacao, setDiscriminacao] = useState('')
  const [observacao, setObservacao] = useState('')
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState<null | {
    ok: boolean
    numeroNfse?: string
    codigoVerificacao?: string
    pdfUrl?: string
    erro?: string
    status?: string
  }>(null)

  // Pré-preenche os dados quando a venda muda
  useEffect(() => {
    if (!sale) return
    const paciente = patients.find((p) => p.id === sale.patientId)
    setTomadorNome(paciente?.name || sale.patientName || 'CONSUMIDOR FINAL')
    setTomadorCpfCnpj(paciente?.cpf || '')
    setAliquota(String(nfseB2BConfig?.aliquota_iss_padrao ?? 3))

    // Determinação automática de tipo caso não tenha vindo forçado por prop
    const autoTipo = tipoNotaProp || determineNotaFiscalType(sale)
    setTipoNota(autoTipo)

    // Discriminação automática a partir dos itens da venda
    const parsed = parseSaleItemsDefensive(sale)
    const descItens =
      parsed.length > 0
        ? parsed.map((it) => `${it.quantity}x ${it.name}`).join(', ')
        : sale.itemsDescription || `Venda #${sale.number}`
    setDiscriminacao(
      nfseB2BConfig?.discriminacao_padrao
        ? `${nfseB2BConfig.discriminacao_padrao} — ${descItens}`
        : `Venda de produtos/serviços auditivos — ${descItens}`,
    )
    setObservacao('')
    setResultado(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sale?.id, tipoNotaProp])

  const valorServico = sale?.totalValue || 0
  const aliquotaNum = Number(aliquota) || 0
  const valorIss = (valorServico * aliquotaNum) / 100
  const valorLiquido = valorServico - valorIss

  const apiConfigurada = !!nfseB2BConfig?.url_api

  // Verifica se já existe NFS-e emitida (autorizada) para esta venda
  const nfExistente = useMemo(() => {
    if (!sale) return null
    return (
      nfseEmitidas.find(
        (n) => n.sale === sale.id && (n.status === 'autorizada' || n.status === 'enviada'),
      ) || null
    )
  }, [nfseEmitidas, sale])

  const handleEmitir = async () => {
    if (!sale) return
    if (!tomadorNome.trim()) return
    setLoading(true)
    setResultado(null)

    // clinica_id obrigatório do projeto
    const clinicaId = currentUser?.clinicaId || (pb.authStore as any)?.model?.clinica_id || ''

    try {
      // 1. Gera próximo número sequencial da coleção notas_fiscais
      let proximoNumero = 1
      try {
        const lastRecords = await pb.collection('notas_fiscais').getList(1, 1, {
          sort: '-numero',
          fields: 'numero',
        })
        if (lastRecords.items.length > 0 && lastRecords.items[0].numero) {
          proximoNumero = Number(lastRecords.items[0].numero) + 1
        }
      } catch (err) {
        console.warn('Não foi possível obter último número de notas_fiscais:', err)
      }

      // 2. Prepara os itens formatados
      const parsedItens = parseSaleItemsDefensive(sale)
      const itensFormatados =
        parsedItens.length > 0
          ? parsedItens.map((it) => ({
              descricao: it.name,
              quantidade: it.quantity,
              valor_unitario: it.unitPrice,
              valor_total: it.totalPrice ?? it.quantity * it.unitPrice,
              tipo: isProductItem(it) ? ('produto' as const) : ('servico' as const),
            }))
          : [
              {
                descricao: discriminacao || `Venda #${sale.number}`,
                quantidade: 1,
                valor_unitario: valorServico,
                valor_total: valorServico,
                tipo: tipoNota === 'nfe' ? ('produto' as const) : ('servico' as const),
              },
            ]

      const itensProdutos = itensFormatados.filter((it) => it.tipo === 'produto')
      const itensServicos = itensFormatados.filter((it) => it.tipo === 'servico')
      const isMista = itensProdutos.length > 0 && itensServicos.length > 0

      const hoje = new Date().toISOString().split('T')[0]
      const pacienteRelationId = sale.patientId || ''

      const buildChaveAcesso = (num: number) => {
        const rawNum = String(num).padStart(9, '0')
        return `35${hoje.replace(/-/g, '').slice(2, 6)}00000000000155001000${rawNum}100000001`
      }

      let chavePrincipal = ''
      let numeroPrincipal = proximoNumero
      let resultadoDetalhe = ''

      // 3. Emissão: se tipoNota for 'ambas' numa venda mista, criar DOIS registros separados
      if (tipoNota === 'ambas' && isMista) {
        const numNfe = proximoNumero
        const numNfse = proximoNumero + 1
        const chaveNfe = buildChaveAcesso(numNfe)
        const chaveNfse = buildChaveAcesso(numNfse)
        chavePrincipal = chaveNfse
        numeroPrincipal = numNfse

        const totalProdutos = itensProdutos.reduce((acc, it) => acc + (it.valor_total || 0), 0)
        const totalServicos = itensServicos.reduce((acc, it) => acc + (it.valor_total || 0), 0)

        const payloadNfe: Record<string, any> = {
          clinica_id: clinicaId,
          numero: numNfe,
          serie: '1',
          data_emissao: hoje,
          venda: sale.id,
          tipo: 'nfe',
          itens: itensProdutos,
          valor_total: totalProdutos,
          chave_acesso: chaveNfe,
          status: 'pendente',
          observacoes: observacao
            ? `${observacao} | Tomador: ${tomadorNome} (NF-e de Produtos)`
            : `Tomador: ${tomadorNome} (NF-e de Produtos)`,
        }
        if (pacienteRelationId) {
          payloadNfe.paciente = pacienteRelationId
        }

        const payloadNfse: Record<string, any> = {
          clinica_id: clinicaId,
          numero: numNfse,
          serie: '1',
          data_emissao: hoje,
          venda: sale.id,
          tipo: 'nfse',
          itens: itensServicos,
          valor_total: totalServicos,
          chave_acesso: chaveNfse,
          status: 'pendente',
          observacoes: observacao
            ? `${observacao} | Tomador: ${tomadorNome} (NFS-e de Serviços)`
            : `Tomador: ${tomadorNome} (NFS-e de Serviços)`,
        }
        if (pacienteRelationId) {
          payloadNfse.paciente = pacienteRelationId
        }

        try {
          await pb.collection('notas_fiscais').create(payloadNfe)
          await pb.collection('notas_fiscais').create(payloadNfse)
        } catch (errNotas) {
          console.error('Erro ao gravar registros na coleção notas_fiscais:', errNotas)
        }

        resultadoDetalhe = `NF-e nº ${numNfe} (${formatCurrency(totalProdutos)}) + NFS-e nº ${numNfse} (${formatCurrency(totalServicos)}) registradas com status pendente.`
      } else {
        // Registro único para venda não-mista ou tipo específico selecionado
        chavePrincipal = buildChaveAcesso(proximoNumero)
        const payloadNotasFiscais: Record<string, any> = {
          clinica_id: clinicaId,
          numero: proximoNumero,
          serie: '1',
          data_emissao: hoje,
          venda: sale.id,
          tipo: tipoNota,
          itens: itensFormatados,
          valor_total: valorServico,
          chave_acesso: chavePrincipal,
          status: 'pendente',
          observacoes: observacao
            ? `${observacao} | Tomador: ${tomadorNome}`
            : `Tomador: ${tomadorNome}`,
        }
        if (pacienteRelationId) {
          payloadNotasFiscais.paciente = pacienteRelationId
        }

        try {
          await pb.collection('notas_fiscais').create(payloadNotasFiscais)
        } catch (errNotas) {
          console.error('Erro ao gravar registro na coleção notas_fiscais:', errNotas)
        }

        const rotuloTipo =
          tipoNota === 'nfe' ? 'NF-e' : tipoNota === 'nfse' ? 'NFS-e' : 'NF-e + NFS-e'
        resultadoDetalhe = `${rotuloTipo} nº ${proximoNumero} registrada como pendente (sem integração externa ativa).`
      }

      // 4. Se a nota for NFS-e ou Ambas, também dispara a rotina de nfse (se houver API configurada ou para auditoria)
      let recNfse: any = null
      if (tipoNota === 'nfse' || tipoNota === 'ambas') {
        try {
          recNfse = await emitirNfseVenda(sale.id, {
            tomadorNome: tomadorNome.trim(),
            tomadorCpfCnpj: tomadorCpfCnpj.trim(),
            discriminacao: discriminacao.trim(),
            aliquotaIss: aliquotaNum,
            observacao: observacao.trim(),
          })
        } catch (errNfse) {
          console.warn('Aviso: falha na rotina secundária de NFS-e:', errNfse)
        }
      }

      // 5. Atualiza o estado de resultado para feedback visual do usuário
      if (recNfse && recNfse.status === 'autorizada') {
        setResultado({
          ok: true,
          numeroNfse: recNfse.numero_nfse || String(numeroPrincipal),
          codigoVerificacao: recNfse.codigo_verificacao,
          pdfUrl: recNfse.pdf_url,
          status: 'autorizada',
        })
      } else {
        // Registrada(s) como pendente
        setResultado({
          ok: true,
          numeroNfse: String(numeroPrincipal),
          codigoVerificacao: chavePrincipal.slice(-8),
          erro: resultadoDetalhe,
          status: 'pendente',
        })
      }
    } catch (err: any) {
      console.error('Erro geral ao emitir nota fiscal:', err)
      setResultado({
        ok: false,
        erro: err?.message || 'Não foi possível registrar a nota fiscal.',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleClose = (o: boolean) => {
    if (!o) {
      setResultado(null)
    }
    onOpenChange(o)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b border-slate-100 pb-3">
          <DialogTitle className="text-lg font-bold text-slate-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              <span>Emitir Nota Fiscal — Venda #{sale?.number}</span>
            </div>
            <Badge
              variant="outline"
              className={
                tipoNota === 'nfe'
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : tipoNota === 'nfse'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-purple-50 text-purple-700 border-purple-200'
              }
            >
              {tipoNota === 'nfe'
                ? 'NF-e (Produtos)'
                : tipoNota === 'nfse'
                  ? 'NFS-e (Serviços)'
                  : 'Ambas (Produtos + Serviços)'}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {nfExistente && !resultado && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <strong>NFS-e já emitida para esta venda.</strong> NFS-e nº{' '}
              {nfExistente.numero_nfse || '—'} ({nfExistente.status}). Uma nova emissão criará um
              novo registro.
            </div>
          </div>
        )}

        {resultado && (
          <div
            className={`rounded-xl border p-3 text-xs flex items-start gap-2 ${
              resultado.ok && resultado.status === 'autorizada'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : resultado.status === 'erro'
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-amber-200 bg-amber-50 text-amber-700'
            }`}
          >
            {resultado.ok && resultado.status === 'autorizada' ? (
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            )}
            <div className="space-y-1">
              {resultado.status === 'autorizada' ? (
                <>
                  <strong>NFS-e emitida com sucesso!</strong>
                  <div>NFS-e nº: {resultado.numeroNfse || '—'}</div>
                  <div>Código de verificação: {resultado.codigoVerificacao || '—'}</div>
                  {resultado.pdfUrl && (
                    <a
                      href={resultado.pdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-indigo-600 hover:underline font-medium"
                    >
                      <ExternalLink className="w-3 h-3" /> Baixar PDF da NFS-e
                    </a>
                  )}
                </>
              ) : resultado.status === 'erro' ? (
                <>
                  <strong>Erro ao emitir NFS-e na prefeitura.</strong>
                  <div>{resultado.erro}</div>
                  <div className="text-[11px] opacity-80">
                    O registro foi salvo com status "erro" para auditoria.
                  </div>
                </>
              ) : (
                <>
                  <strong>Nota Fiscal registrada como pendente.</strong>
                  <div>{resultado.erro}</div>
                  <div className="text-[11px] opacity-80">
                    Os registros foram salvos no histórico financeiro do paciente.
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <div className="space-y-4 pt-1 text-sm">
          {/* Seletor do Tipo de Nota */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <Label className="text-xs font-bold text-slate-700 block">
                  Tipo de Documento Fiscal
                </Label>
                <p className="text-[11px] text-slate-500">
                  Identificado automaticamente pelos itens da venda (ajuste se necessário)
                </p>
              </div>
              <Select value={tipoNota} onValueChange={(v: TipoNotaFiscal) => setTipoNota(v)}>
                <SelectTrigger className="w-full sm:w-56 h-9 rounded-lg text-xs bg-white font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nfse">NFS-e (Serviços)</SelectItem>
                  <SelectItem value="nfe">NF-e (Produtos)</SelectItem>
                  <SelectItem value="ambas">Ambas (Produtos + Serviços)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Prestador */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              <Building2 className="w-3.5 h-3.5" /> Prestador / Emitente
            </div>
            <div className="grid grid-cols-3 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
              <div>
                <span className="text-slate-500 block">CNPJ</span>
                <strong className="text-slate-800">
                  {nfseB2BConfig ? '—' : 'Não configurado'}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">Insc. Municipal</span>
                <strong className="text-slate-800">
                  {nfseB2BConfig?.inscricao_municipal || '—'}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">Município</span>
                <strong className="text-slate-800">
                  {nfseB2BConfig ? `${nfseB2BConfig.municipio}/${nfseB2BConfig.uf}` : '—'}
                </strong>
              </div>
            </div>
            {!apiConfigurada && (
              <p className="text-[11px] text-amber-600 mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Sem integração direta ativa. O documento será registrado como pendente na base
                local.
              </p>
            )}
          </div>

          {/* Tomador */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              <User className="w-3.5 h-3.5" /> Tomador
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px] text-slate-500 mb-1 block">Nome / Razão Social</Label>
                <Input
                  value={tomadorNome}
                  onChange={(e) => setTomadorNome(e.target.value)}
                  className="h-9 rounded-lg text-sm"
                  placeholder="Nome do tomador"
                />
              </div>
              <div>
                <Label className="text-[11px] text-slate-500 mb-1 block">CPF / CNPJ</Label>
                <Input
                  value={tomadorCpfCnpj}
                  onChange={(e) => setTomadorCpfCnpj(e.target.value)}
                  className="h-9 rounded-lg text-sm"
                  placeholder="CPF ou CNPJ do tomador"
                />
              </div>
            </div>
          </div>

          {/* Serviço */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              <Calculator className="w-3.5 h-3.5" /> Serviço
            </div>
            <div className="grid grid-cols-4 gap-2 rounded-xl border border-slate-200 p-3 text-xs">
              <div>
                <span className="text-slate-500 block">Valor da Venda</span>
                <strong className="text-slate-800">{formatCurrency(valorServico)}</strong>
              </div>
              <div>
                <Label className="text-[11px] text-slate-500 mb-0.5 block">Alíquota ISS (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={aliquota}
                  onChange={(e) => setAliquota(e.target.value)}
                  className="h-8 rounded-md text-xs"
                />
              </div>
              <div>
                <span className="text-slate-500 block">Valor ISS</span>
                <strong className="text-slate-800">{formatCurrency(valorIss)}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Valor Líquido</span>
                <strong className="text-slate-800">{formatCurrency(valorLiquido)}</strong>
              </div>
            </div>
          </div>

          {/* Discriminação */}
          <div>
            <Label className="text-xs font-semibold text-slate-600 mb-1 block">Discriminação</Label>
            <Textarea
              value={discriminacao}
              onChange={(e) => setDiscriminacao(e.target.value)}
              className="rounded-xl text-sm min-h-[70px]"
              placeholder="Descrição dos serviços/produtos"
            />
          </div>

          {/* Observações */}
          <div>
            <Label className="text-xs font-semibold text-slate-600 mb-1 block">
              Observações <span className="text-slate-400 font-normal">(opcional)</span>
            </Label>
            <Textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              className="rounded-xl text-sm min-h-[50px]"
              placeholder="Observações adicionais..."
            />
          </div>

          {sale && (
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <Badge variant="outline" className="bg-slate-50 text-slate-600">
                Venda #{sale.number}
              </Badge>
              <span>
                {sale.patientName || 'Venda avulsa'} · {formatCurrency(sale.totalValue)}
              </span>
            </div>
          )}
        </div>

        <DialogFooter className="pt-2 border-t border-slate-100">
          <Button
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={loading}
            className="rounded-xl text-xs"
          >
            {resultado ? 'Fechar' : 'Cancelar'}
          </Button>
          {!resultado && (
            <Button
              onClick={handleEmitir}
              disabled={loading || !tomadorNome.trim() || !sale}
              className="rounded-xl text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Emitindo...
                </>
              ) : (
                <>
                  <FileText className="w-3.5 h-3.5 mr-1.5" /> Emitir Nota Fiscal
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
