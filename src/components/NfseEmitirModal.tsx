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
import { formatCurrency } from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import type { Sale } from '@/types'

interface NfseEmitirModalProps {
  sale: Sale | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Modal de emissão de NFS-e para vendas PDV. Reutiliza a config B2B
 * (nfse_b2b_config) e a biblioteca nfse-api. Funciona mesmo sem a API
 * da prefeitura configurada (registra como pendente / erro para auditoria).
 */
export default function NfseEmitirModal({ sale, open, onOpenChange }: NfseEmitirModalProps) {
  const { patients, nfseB2BConfig, emitirNfseVenda, nfseEmitidas } = useApp()

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
    // Discriminação automática a partir dos itens da venda
    const descItens =
      Array.isArray(sale.items) && sale.items.length > 0
        ? sale.items.map((it) => `${it.quantity}x ${it.name}`).join(', ')
        : sale.itemsDescription || `Venda #${sale.number}`
    setDiscriminacao(
      nfseB2BConfig?.discriminacao_padrao
        ? `${nfseB2BConfig.discriminacao_padrao} — ${descItens}`
        : `Venda de produtos/serviços auditivos — ${descItens}`,
    )
    setObservacao('')
    setResultado(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sale?.id])

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
    try {
      const rec = await emitirNfseVenda(sale.id, {
        tomadorNome: tomadorNome.trim(),
        tomadorCpfCnpj: tomadorCpfCnpj.trim(),
        discriminacao: discriminacao.trim(),
        aliquotaIss: aliquotaNum,
        observacao: observacao.trim(),
      })
      if (rec) {
        if (rec.status === 'autorizada') {
          setResultado({
            ok: true,
            numeroNfse: rec.numero_nfse,
            codigoVerificacao: rec.codigo_verificacao,
            pdfUrl: rec.pdf_url,
            status: rec.status,
          })
        } else if (rec.status === 'erro') {
          setResultado({ ok: false, erro: rec.erro_mensagem, status: rec.status })
        } else {
          // pendente
          setResultado({
            ok: true,
            numeroNfse: rec.numero_nfse,
            codigoVerificacao: rec.codigo_verificacao,
            pdfUrl: rec.pdf_url,
            erro: rec.erro_mensagem,
            status: rec.status,
          })
        }
      } else {
        setResultado({ ok: false, erro: 'Não foi possível emitir a NFS-e.' })
      }
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
          <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            Emitir NFS-e — Venda #{sale?.number}
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
                  <strong>NFS-e registrada como pendente.</strong>
                  <div>{resultado.erro}</div>
                  <div className="text-[11px] opacity-80">
                    Configure a API da prefeitura nas Configurações para emissão automática.
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <div className="space-y-4 pt-1 text-sm">
          {/* Prestador */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              <Building2 className="w-3.5 h-3.5" /> Prestador
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
                API da prefeitura não configurada. A NFS-e será registrada como pendente.
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
                  <FileText className="w-3.5 h-3.5 mr-1.5" /> Emitir NFS-e
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
