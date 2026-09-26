import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import {
  FileText,
  Receipt,
  MessageCircle,
  CreditCard,
  Save,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Eye,
  EyeOff,
  RefreshCw,
  ShieldCheck,
  Building,
} from 'lucide-react'
import {
  getIntegracoes,
  saveIntegracoes,
  listarIntegracaoLogs,
  getSafeClinicaId,
} from '@/services/integracoesService'
import type {
  IntegracoesConfig,
  IntegracaoLog,
  NfeAmbiente,
  NfseProvedor,
  WhatsAppProvedor,
} from '@/types'

interface IntegracoesTabProps {
  clinicaId?: string
}

export const IntegracoesTab: React.FC<IntegracoesTabProps> = ({ clinicaId }) => {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [savingSection, setSavingSection] = useState<string | null>(null)

  // Configurações
  const [configId, setConfigId] = useState<string | undefined>(undefined)

  // 1. NF-e
  const [nfeAtivo, setNfeAtivo] = useState(false)
  const [nfeCertificadoFile, setNfeCertificadoFile] = useState<File | null>(null)
  const [nfeCertificadoNome, setNfeCertificadoNome] = useState('')
  const [nfeSenhaCertificado, setNfeSenhaCertificado] = useState('')
  const [nfeAmbiente, setNfeAmbiente] = useState<NfeAmbiente>('homologacao')
  const [showNfeSenha, setShowNfeSenha] = useState(false)

  // 2. NFS-e
  const [nfseAtivo, setNfseAtivo] = useState(false)
  const [nfseMunicipio, setNfseMunicipio] = useState('')
  const [nfseProvedor, setNfseProvedor] = useState<NfseProvedor>('padrao_abrasf')
  const [nfseUsuario, setNfseUsuario] = useState('')
  const [nfseSenha, setNfseSenha] = useState('')
  const [showNfseSenha, setShowNfseSenha] = useState(false)

  // 3. WhatsApp
  const [whatsappAtivo, setWhatsappAtivo] = useState(false)
  const [whatsappProvedor, setWhatsappProvedor] = useState<WhatsAppProvedor>('evolution')
  const [whatsappToken, setWhatsappToken] = useState('')
  const [whatsappNumero, setWhatsappNumero] = useState('')
  const [showWhatsappToken, setShowWhatsappToken] = useState(false)

  // 4. BTG Pactual
  const [btgAtivo, setBtgAtivo] = useState(false)
  const [btgApiKey, setBtgApiKey] = useState('')
  const [btgCertificado, setBtgCertificado] = useState('')
  const [btgConta, setBtgConta] = useState('')
  const [showBtgKey, setShowBtgKey] = useState(false)

  // Logs recentes
  const [logs, setLogs] = useState<IntegracaoLog[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)

  const activeClinicaId = getSafeClinicaId(clinicaId)

  // Carrega configurações
  const carregarDados = async () => {
    setLoading(true)
    try {
      const cfg = await getIntegracoes(activeClinicaId)
      if (cfg) {
        setConfigId(cfg.id)
        // NF-e
        setNfeAtivo(cfg.nfe_ativo || false)
        setNfeCertificadoNome(cfg.nfe_certificado_a1 || '')
        setNfeSenhaCertificado(cfg.nfe_senha_certificado || '')
        setNfeAmbiente(cfg.nfe_ambiente || 'homologacao')

        // NFS-e
        setNfseAtivo(cfg.nfse_ativo || false)
        setNfseMunicipio(cfg.nfse_municipio || '')
        setNfseProvedor(cfg.nfse_provedor || 'padrao_abrasf')
        setNfseUsuario(cfg.nfse_usuario_credenciais || '')
        setNfseSenha(cfg.nfse_senha_credenciais || '')

        // WhatsApp
        setWhatsappAtivo(cfg.whatsapp_ativo || false)
        setWhatsappProvedor(cfg.whatsapp_provedor || 'evolution')
        setWhatsappToken(cfg.whatsapp_token || '')
        setWhatsappNumero(cfg.whatsapp_numero || '')

        // BTG
        setBtgAtivo(cfg.btg_ativo || false)
        setBtgApiKey(cfg.btg_api_key || '')
        setBtgCertificado(cfg.btg_certificado || '')
        setBtgConta(cfg.btg_conta || '')
      }
    } catch (err) {
      console.error('Erro ao carregar integrações:', err)
      toast({
        title: 'Erro ao carregar integrações',
        description: 'Não foi possível buscar as configurações salvas.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const carregarLogs = async () => {
    setLoadingLogs(true)
    try {
      const res = await listarIntegracaoLogs(activeClinicaId, undefined, 10)
      setLogs(res)
    } catch (err) {
      console.warn('Erro ao carregar logs:', err)
    } finally {
      setLoadingLogs(false)
    }
  }

  useEffect(() => {
    if (activeClinicaId) {
      carregarDados()
      carregarLogs()
    }
  }, [activeClinicaId])

  // Verificações de preenchimento obrigatório para ligar o toggle
  const isNfeConfigurado = Boolean(
    (nfeCertificadoFile || nfeCertificadoNome) && nfeSenhaCertificado.trim(),
  )
  const isNfseConfigurado = Boolean(nfseMunicipio.trim() && nfseUsuario.trim() && nfseSenha.trim())
  const isWhatsappConfigurado = Boolean(whatsappToken.trim() && whatsappNumero.trim())
  const isBtgConfigurado = Boolean(btgApiKey.trim() && btgConta.trim())

  // Salvar NF-e
  const handleSaveNfe = async () => {
    setSavingSection('nfe')
    try {
      if (nfeCertificadoFile) {
        const formData = new FormData()
        formData.append('clinica_id', activeClinicaId)
        formData.append('nfe_certificado_a1', nfeCertificadoFile)
        formData.append('nfe_senha_certificado', nfeSenhaCertificado)
        formData.append('nfe_ambiente', nfeAmbiente)
        formData.append('nfe_ativo', String(nfeAtivo && isNfeConfigurado))
        const res = await saveIntegracoes(formData, activeClinicaId)
        setConfigId(res.id)
        if (res.nfe_certificado_a1) setNfeCertificadoNome(res.nfe_certificado_a1)
      } else {
        const res = await saveIntegracoes(
          {
            nfe_senha_certificado: nfeSenhaCertificado,
            nfe_ambiente: nfeAmbiente,
            nfe_ativo: nfeAtivo && isNfeConfigurado,
          },
          activeClinicaId,
        )
        setConfigId(res.id)
      }
      toast({
        title: 'Configuração salva',
        description: 'Integração de NF-e atualizada com sucesso.',
      })
      carregarLogs()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar NF-e',
        description: err?.message || 'Falha ao gravar configurações.',
        variant: 'destructive',
      })
    } finally {
      setSavingSection(null)
    }
  }

  // Salvar NFS-e
  const handleSaveNfse = async () => {
    setSavingSection('nfse')
    try {
      const res = await saveIntegracoes(
        {
          nfse_municipio: nfseMunicipio,
          nfse_provedor: nfseProvedor,
          nfse_usuario_credenciais: nfseUsuario,
          nfse_senha_credenciais: nfseSenha,
          nfse_ativo: nfseAtivo && isNfseConfigurado,
        },
        activeClinicaId,
      )
      setConfigId(res.id)
      toast({
        title: 'Configuração salva',
        description: 'Integração de NFS-e atualizada com sucesso.',
      })
      carregarLogs()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar NFS-e',
        description: err?.message || 'Falha ao gravar configurações.',
        variant: 'destructive',
      })
    } finally {
      setSavingSection(null)
    }
  }

  // Salvar WhatsApp
  const handleSaveWhatsapp = async () => {
    setSavingSection('whatsapp')
    try {
      const res = await saveIntegracoes(
        {
          whatsapp_provedor: whatsappProvedor,
          whatsapp_token: whatsappToken,
          whatsapp_numero: whatsappNumero,
          whatsapp_ativo: whatsappAtivo && isWhatsappConfigurado,
        },
        activeClinicaId,
      )
      setConfigId(res.id)
      toast({
        title: 'Configuração salva',
        description: 'Integração do WhatsApp atualizada com sucesso.',
      })
      carregarLogs()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar WhatsApp',
        description: err?.message || 'Falha ao gravar configurações.',
        variant: 'destructive',
      })
    } finally {
      setSavingSection(null)
    }
  }

  // Salvar BTG Pactual
  const handleSaveBtg = async () => {
    setSavingSection('btg')
    try {
      const res = await saveIntegracoes(
        {
          btg_api_key: btgApiKey,
          btg_certificado: btgCertificado,
          btg_conta: btgConta,
          btg_ativo: btgAtivo && isBtgConfigurado,
        },
        activeClinicaId,
      )
      setConfigId(res.id)
      toast({
        title: 'Configuração salva',
        description: 'Integração BTG Pactual atualizada com sucesso.',
      })
      carregarLogs()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar BTG Pactual',
        description: err?.message || 'Falha ao gravar configurações.',
        variant: 'destructive',
      })
    } finally {
      setSavingSection(null)
    }
  }

  // Badges de status
  const renderStatusBadge = (configurado: boolean, ativo: boolean) => {
    if (ativo && configurado) {
      return (
        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 flex items-center gap-1 text-[11px] font-semibold">
          <CheckCircle2 className="w-3 h-3" /> Ativo
        </Badge>
      )
    }
    if (configurado && !ativo) {
      return (
        <Badge className="bg-amber-100 text-amber-800 border-amber-300 flex items-center gap-1 text-[11px] font-semibold">
          <Clock className="w-3 h-3" /> Configurado (Inativo)
        </Badge>
      )
    }
    return (
      <Badge className="bg-slate-100 text-slate-600 border-slate-300 flex items-center gap-1 text-[11px] font-semibold">
        <AlertTriangle className="w-3 h-3" /> Não configurado
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho informativo */}
      <div className="rounded-2xl border border-teal-100 bg-gradient-to-r from-teal-50/70 via-cyan-50/40 to-slate-50 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-teal-600 text-white shadow-sm">
              <ShieldCheck className="w-4 h-4" />
            </span>
            <h2 className="text-base font-bold text-slate-900">Painel de Integrações Externas</h2>
          </div>
          <p className="text-xs text-slate-600 max-w-2xl">
            Credenciais criptografadas e restritas para Administradores. Nenhum serviço externo é
            acionado sem que as credenciais obrigatórias estejam completas e a integração ativada.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            carregarDados()
            carregarLogs()
          }}
          disabled={loading || loadingLogs}
          className="rounded-xl border-slate-300 text-xs font-semibold h-9 shrink-0 gap-1.5 bg-white"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Recarregar dados
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ================================================================ */}
        {/* 1. NF-e (Nota Fiscal de Produtos)                                */}
        {/* ================================================================ */}
        <Card className="rounded-2xl border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center font-bold">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900">
                      NF-e (Produtos)
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500">
                      Emissão para aparelhos auditivos e acessórios
                    </CardDescription>
                  </div>
                </div>
                {renderStatusBadge(isNfeConfigurado, nfeAtivo)}
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {/* Toggle de ativação */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="space-y-0.5">
                  <Label className="text-xs font-semibold text-slate-800">
                    Ativar integração NF-e
                  </Label>
                  <p className="text-[11px] text-slate-500">
                    {isNfeConfigurado
                      ? 'Habilita envio em homologação/produção'
                      : 'Preencha certificado A1 e senha para habilitar'}
                  </p>
                </div>
                <Switch
                  checked={nfeAtivo}
                  disabled={!isNfeConfigurado && !nfeAtivo}
                  onCheckedChange={(checked) => {
                    if (checked && !isNfeConfigurado) {
                      toast({
                        title: 'Campos obrigatórios pendentes',
                        description: 'Informe o certificado A1 e a senha antes de ativar.',
                        variant: 'destructive',
                      })
                      return
                    }
                    setNfeAtivo(checked)
                  }}
                />
              </div>

              {/* Upload do Certificado A1 */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Certificado Digital A1 (.pfx / .p12) <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="file"
                  accept=".pfx,.p12"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      setNfeCertificadoFile(file)
                      setNfeCertificadoNome(file.name)
                    }
                  }}
                  className="h-9 rounded-xl text-xs border-slate-300 file:mr-3 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 cursor-pointer"
                />
                {nfeCertificadoNome && (
                  <p className="text-[11px] text-teal-700 font-medium truncate">
                    Certificado cadastrado: {nfeCertificadoNome}
                  </p>
                )}
              </div>

              {/* Senha do Certificado */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Senha do Certificado <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    type={showNfeSenha ? 'text' : 'password'}
                    value={nfeSenhaCertificado}
                    onChange={(e) => setNfeSenhaCertificado(e.target.value)}
                    placeholder="Digite a senha do arquivo A1"
                    className="h-9 rounded-xl text-xs border-slate-300 pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNfeSenha(!showNfeSenha)}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                    title={showNfeSenha ? 'Ocultar senha' : 'Ver senha'}
                  >
                    {showNfeSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Ambiente */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Ambiente de Emissão</Label>
                <Select value={nfeAmbiente} onValueChange={(v) => setNfeAmbiente(v as NfeAmbiente)}>
                  <SelectTrigger className="h-9 rounded-xl border-slate-300 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="homologacao" className="text-xs">
                      Homologação (Testes / Sem valor fiscal)
                    </SelectItem>
                    <SelectItem value="producao" className="text-xs">
                      Produção (Ambiente Oficial SEFAZ)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </div>
          <div className="p-4 border-t border-slate-100 flex justify-end">
            <Button
              onClick={handleSaveNfe}
              disabled={savingSection === 'nfe'}
              className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-xl h-9 px-4 gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              {savingSection === 'nfe' ? 'Salvando...' : 'Salvar NF-e'}
            </Button>
          </div>
        </Card>

        {/* ================================================================ */}
        {/* 2. NFS-e (Nota Fiscal de Serviços)                               */}
        {/* ================================================================ */}
        <Card className="rounded-2xl border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900">
                      NFS-e (Serviços)
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500">
                      Emissão para exames, consultas e manutenções
                    </CardDescription>
                  </div>
                </div>
                {renderStatusBadge(isNfseConfigurado, nfseAtivo)}
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {/* Toggle de ativação */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="space-y-0.5">
                  <Label className="text-xs font-semibold text-slate-800">
                    Ativar integração NFS-e
                  </Label>
                  <p className="text-[11px] text-slate-500">
                    {isNfseConfigurado
                      ? 'Habilita envio à prefeitura'
                      : 'Preencha município, provedor e credenciais para habilitar'}
                  </p>
                </div>
                <Switch
                  checked={nfseAtivo}
                  disabled={!isNfseConfigurado && !nfseAtivo}
                  onCheckedChange={(checked) => {
                    if (checked && !isNfseConfigurado) {
                      toast({
                        title: 'Campos obrigatórios pendentes',
                        description:
                          'Informe município, usuário e senha da prefeitura antes de ativar.',
                        variant: 'destructive',
                      })
                      return
                    }
                    setNfseAtivo(checked)
                  }}
                />
              </div>

              {/* Município */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Município da Clínica <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={nfseMunicipio}
                  onChange={(e) => setNfseMunicipio(e.target.value)}
                  placeholder="Ex.: Florianópolis, Caçador, São Paulo..."
                  className="h-9 rounded-xl text-xs border-slate-300"
                />
              </div>

              {/* Provedor */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Provedor Municipal</Label>
                <Select
                  value={nfseProvedor}
                  onValueChange={(v) => setNfseProvedor(v as NfseProvedor)}
                >
                  <SelectTrigger className="h-9 rounded-xl border-slate-300 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="padrao_abrasf" className="text-xs">
                      Padrão Nacional ABRASF
                    </SelectItem>
                    <SelectItem value="betha" className="text-xs">
                      Betha Sistemas
                    </SelectItem>
                    <SelectItem value="simpliss" className="text-xs">
                      SimplISS
                    </SelectItem>
                    <SelectItem value="ginfes" className="text-xs">
                      GINFES
                    </SelectItem>
                    <SelectItem value="outro" className="text-xs">
                      Outro Provedor Municipal
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Credenciais da prefeitura */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">
                    Usuário / Inscrição <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={nfseUsuario}
                    onChange={(e) => setNfseUsuario(e.target.value)}
                    placeholder="Login do portal fiscal"
                    className="h-9 rounded-xl text-xs border-slate-300"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">
                    Senha / Token WebService <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      type={showNfseSenha ? 'text' : 'password'}
                      value={nfseSenha}
                      onChange={(e) => setNfseSenha(e.target.value)}
                      placeholder="Senha do webservice"
                      className="h-9 rounded-xl text-xs border-slate-300 pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNfseSenha(!showNfseSenha)}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                      title={showNfseSenha ? 'Ocultar senha' : 'Ver senha'}
                    >
                      {showNfseSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </CardContent>
          </div>
          <div className="p-4 border-t border-slate-100 flex justify-end">
            <Button
              onClick={handleSaveNfse}
              disabled={savingSection === 'nfse'}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl h-9 px-4 gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              {savingSection === 'nfse' ? 'Salvando...' : 'Salvar NFS-e'}
            </Button>
          </div>
        </Card>

        {/* ================================================================ */}
        {/* 3. WhatsApp (Notificações, Lembretes e Cobranças)                 */}
        {/* ================================================================ */}
        <Card className="rounded-2xl border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                    <MessageCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900">
                      WhatsApp Business
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500">
                      Disparo de lembretes, confirmações e cobranças
                    </CardDescription>
                  </div>
                </div>
                {renderStatusBadge(isWhatsappConfigurado, whatsappAtivo)}
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {/* Toggle de ativação */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="space-y-0.5">
                  <Label className="text-xs font-semibold text-slate-800">
                    Ativar integração WhatsApp
                  </Label>
                  <p className="text-[11px] text-slate-500">
                    {isWhatsappConfigurado
                      ? 'Habilita disparos automáticos'
                      : 'Preencha token de API e número para habilitar'}
                  </p>
                </div>
                <Switch
                  checked={whatsappAtivo}
                  disabled={!isWhatsappConfigurado && !whatsappAtivo}
                  onCheckedChange={(checked) => {
                    if (checked && !isWhatsappConfigurado) {
                      toast({
                        title: 'Campos obrigatórios pendentes',
                        description: 'Informe o token e o número do WhatsApp antes de ativar.',
                        variant: 'destructive',
                      })
                      return
                    }
                    setWhatsappAtivo(checked)
                  }}
                />
              </div>

              {/* Provedor */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Provedor de Conexão WhatsApp
                </Label>
                <Select
                  value={whatsappProvedor}
                  onValueChange={(v) => setWhatsappProvedor(v as WhatsAppProvedor)}
                >
                  <SelectTrigger className="h-9 rounded-xl border-slate-300 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="evolution" className="text-xs">
                      Evolution API (Recomendado)
                    </SelectItem>
                    <SelectItem value="zapi" className="text-xs">
                      Z-API
                    </SelectItem>
                    <SelectItem value="meta" className="text-xs">
                      Meta Cloud API (Oficial Business)
                    </SelectItem>
                    <SelectItem value="outro" className="text-xs">
                      Outro Gateway HTTP
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Token / Chave de API */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Token / API Key <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    type={showWhatsappToken ? 'text' : 'password'}
                    value={whatsappToken}
                    onChange={(e) => setWhatsappToken(e.target.value)}
                    placeholder="Chave secreta de autenticação do provedor"
                    className="h-9 rounded-xl text-xs border-slate-300 pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowWhatsappToken(!showWhatsappToken)}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                    title={showWhatsappToken ? 'Ocultar token' : 'Ver token'}
                  >
                    {showWhatsappToken ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Número do WhatsApp */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Número do WhatsApp da Clínica <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={whatsappNumero}
                  onChange={(e) => setWhatsappNumero(e.target.value)}
                  placeholder="5549999999999 (com DDI e DDD)"
                  className="h-9 rounded-xl text-xs border-slate-300"
                />
                <p className="text-[11px] text-slate-400">
                  Número de envio cadastrado na API (ex.: 55 + DDD + número).
                </p>
              </div>
            </CardContent>
          </div>
          <div className="p-4 border-t border-slate-100 flex justify-end">
            <Button
              onClick={handleSaveWhatsapp}
              disabled={savingSection === 'whatsapp'}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl h-9 px-4 gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              {savingSection === 'whatsapp' ? 'Salvando...' : 'Salvar WhatsApp'}
            </Button>
          </div>
        </Card>

        {/* ================================================================ */}
        {/* 4. BTG Pactual (Faturamento de Assinaturas SaaS)                 */}
        {/* ================================================================ */}
        <Card className="rounded-2xl border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900">
                      BTG Pactual (Gateway SaaS)
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500">
                      Cobrança bancária automática (PIX e Boleto)
                    </CardDescription>
                  </div>
                </div>
                {renderStatusBadge(isBtgConfigurado, btgAtivo)}
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {/* Toggle de ativação */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="space-y-0.5">
                  <Label className="text-xs font-semibold text-slate-800">
                    Ativar integração BTG Pactual
                  </Label>
                  <p className="text-[11px] text-slate-500">
                    {isBtgConfigurado
                      ? 'Habilita faturamento automático'
                      : 'Preencha API Key e Conta para habilitar'}
                  </p>
                </div>
                <Switch
                  checked={btgAtivo}
                  disabled={!isBtgConfigurado && !btgAtivo}
                  onCheckedChange={(checked) => {
                    if (checked && !isBtgConfigurado) {
                      toast({
                        title: 'Campos obrigatórios pendentes',
                        description: 'Informe a API Key e Conta BTG antes de ativar.',
                        variant: 'destructive',
                      })
                      return
                    }
                    setBtgAtivo(checked)
                  }}
                />
              </div>

              {/* API Key */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  BTG API Key <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    type={showBtgKey ? 'text' : 'password'}
                    value={btgApiKey}
                    onChange={(e) => setBtgApiKey(e.target.value)}
                    placeholder="Chave de API fornecida pelo BTG Pactual Empresas"
                    className="h-9 rounded-xl text-xs border-slate-300 pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowBtgKey(!showBtgKey)}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                    title={showBtgKey ? 'Ocultar chave' : 'Ver chave'}
                  >
                    {showBtgKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Conta BTG */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Conta Corrente BTG <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={btgConta}
                  onChange={(e) => setBtgConta(e.target.value)}
                  placeholder="Ex.: 123456-7"
                  className="h-9 rounded-xl text-xs border-slate-300"
                />
              </div>

              {/* Certificado BTG (opcional mTLS) */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Certificado BTG / Client Certificate (mTLS)
                </Label>
                <Input
                  value={btgCertificado}
                  onChange={(e) => setBtgCertificado(e.target.value)}
                  placeholder="ID ou chave do certificado mTLS cadastrado no BTG"
                  className="h-9 rounded-xl text-xs border-slate-300"
                />
                <p className="text-[11px] text-slate-400">
                  Utilizado para autenticação mTLS de segurança bancária.
                </p>
              </div>
            </CardContent>
          </div>
          <div className="p-4 border-t border-slate-100 flex justify-end">
            <Button
              onClick={handleSaveBtg}
              disabled={savingSection === 'btg'}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl h-9 px-4 gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              {savingSection === 'btg' ? 'Salvando...' : 'Salvar BTG Pactual'}
            </Button>
          </div>
        </Card>
      </div>

      {/* ================================================================ */}
      {/* Histórico / Logs Recentes de Integração                           */}
      {/* ================================================================ */}
      <Card className="rounded-2xl border-slate-200 shadow-sm mt-6">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" />
              Logs Recentes de Retorno das Integrações
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Registro auditável de tentativas de emissão fiscal, mensagens WhatsApp e faturamento
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={carregarLogs}
            disabled={loadingLogs}
            className="text-xs text-slate-600 hover:text-slate-900 h-8 gap-1"
          >
            <RefreshCw className={`w-3 h-3 ${loadingLogs ? 'animate-spin' : ''}`} />
            Atualizar logs
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              Nenhum log registrado ainda para esta clínica. Conforme as integrações forem
              acionadas, os retornos serão gravados aqui.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {logs.map((log) => {
                const statusBadge =
                  log.status === 'sucesso' ? (
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                      Sucesso
                    </Badge>
                  ) : log.status === 'pendente' ? (
                    <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
                      Pendente
                    </Badge>
                  ) : (
                    <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px]">
                      Erro
                    </Badge>
                  )

                const tipoLabel =
                  {
                    nfe: 'NF-e',
                    nfse: 'NFS-e',
                    whatsapp: 'WhatsApp',
                    btg: 'BTG Pactual',
                  }[log.tipo] || log.tipo.toUpperCase()

                return (
                  <div
                    key={log.id}
                    className="p-3.5 flex items-start justify-between gap-4 text-xs hover:bg-slate-50/60 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                          [{tipoLabel}]
                        </span>
                        <span className="font-semibold text-slate-700">{log.acao}</span>
                        {statusBadge}
                      </div>
                      <p className="text-slate-600 text-xs">{log.mensagem}</p>
                      {log.payload_json && Object.keys(log.payload_json).length > 0 && (
                        <p className="text-[11px] font-mono text-slate-400 truncate max-w-xl">
                          {JSON.stringify(log.payload_json)}
                        </p>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 shrink-0 whitespace-nowrap">
                      {new Date(log.created).toLocaleString('pt-BR')}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default IntegracoesTab
