import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useApp } from '@/context/AppContext'
import {
  Calendar,
  Activity,
  Ear,
  Plus,
  ArrowLeft,
  Trash2,
  Zap,
  User,
  Phone,
  Mail,
  MapPin,
  ShieldCheck,
  CreditCard,
  Stethoscope,
  ArrowUpDown,
  Printer,
  Search,
  CheckCircle2,
  AlertCircle,
  Package,
  Receipt,
  Check,
  Play,
  XCircle,
  Building2,
  ShoppingCart,
  RotateCcw,
  Wallet,
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { CompareAudiometriesModal } from '@/components/CompareAudiometriesModal'
import { usePrint } from '@/components/print/PrintProvider'

// Importação lazy dos componentes de impressão para que um erro de runtime
// em PrintDocuments.tsx (ex.: durante a avaliação do módulo) não quebre a
// página inteira do prontuário. O erro só acontecerá ao tentar imprimir.
const PatientFichaPrint = lazy(() =>
  import('@/components/print/PrintDocuments').then((m) => ({ default: m.PatientFichaPrint })),
)
const TympanometryPrint = lazy(() =>
  import('@/components/print/PrintDocuments').then((m) => ({ default: m.TympanometryPrint })),
)
const BeraPrint = lazy(() =>
  import('@/components/print/PrintDocuments').then((m) => ({ default: m.BeraPrint })),
)
import {
  formatDate,
  formatCurrency,
  maskCPF,
  getInitials,
  getAvatarColor,
  calculateAge,
} from '@/lib/formatters'
import {
  AppointmentProcedureItem,
  getProcedureValueByPlan,
  Procedure,
  StockItem,
  Patient,
  Sale,
  PDVPaymentMethod,
  HearingAidSide,
  Consentimento,
  TipoConsentimento,
  ROTULO_CONSENTIMENTO,
  TEXTO_PADRAO_CONSENTIMENTO,
  TIPOS_CONSENTIMENTO,
} from '@/types'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { ScrollText, FileSignature, Ban, Lock, Sparkles, Loader2 } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import pb from '@/lib/pocketbase/client'
import { TympanometryModal } from '@/components/TympanometryModal'
import { BeraModal } from '@/components/BeraModal'
import { HearingAidModal } from '@/components/HearingAidModal'
import { AppointmentModal } from '@/components/AppointmentModal'
import { ConfirmDialog } from '@/components/ConfirmDialog'

export default function Prontuario() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const {
    getPatient,
    clinicalRecords,
    updateClinicalRecord,
    evolutions,
    addEvolution,
    deleteEvolution,
    audiometries,
    deleteAudiometry,
    tympanometries,
    deleteTympanometry,
    addTympanometry,
    beras,
    deleteBera,
    addBera,
    hearingAids,
    addHearingAid,
    budgets,
    sales,
    installments,
    addAppointment,
    currentUser,
    clinicSettings,
    fetchConsentimentos,
    registrarConsentimento,
    revogarConsentimento,
    fetchLgpdPolicyTexts,
  } = useApp()
  const { toast } = useToast()

  const patient = getPatient(id || '')

  // Permissões: secretária não edita/exclui exames nem prontuário clínico
  const isSecretaria = currentUser?.role === 'secretaria'

  // Tab State
  const [activeTab, setActiveTab] = useState('cadastrais')

  // LGPD — Consentimentos do paciente
  const [consentimentos, setConsentimentos] = useState<Consentimento[]>([])
  const [loadingConsent, setLoadingConsent] = useState(false)
  const [consentModalOpen, setConsentModalOpen] = useState(false)
  const [revokeModalOpen, setRevokeModalOpen] = useState(false)
  const [revokeTarget, setRevokeTarget] = useState<Consentimento | null>(null)
  const [consentTipo, setConsentTipo] = useState<TipoConsentimento>('dados_cadastrais')
  const [consentTexto, setConsentTexto] = useState('')
  const [consentChecked, setConsentChecked] = useState(false)
  const [revokeMotivo, setRevokeMotivo] = useState('')
  const [consentSaving, setConsentSaving] = useState(false)
  const [policyTextsCache, setPolicyTextsCache] = useState<Record<
    TipoConsentimento,
    string
  > | null>(null)

  const loadConsentimentos = useCallback(
    async (pid: string) => {
      setLoadingConsent(true)
      try {
        const list = await fetchConsentimentos(pid)
        setConsentimentos(list)
      } catch (err) {
        console.error('Erro ao carregar consentimentos:', err)
      } finally {
        setLoadingConsent(false)
      }
    },
    [fetchConsentimentos],
  )

  React.useEffect(() => {
    if (patient?.id) loadConsentimentos(patient.id)
  }, [patient?.id, loadConsentimentos])

  // Carrega os textos configurados dos termos (para pré-preencher o modal).
  React.useEffect(() => {
    if (!policyTextsCache) {
      fetchLgpdPolicyTexts()
        .then((texts: any) => {
          setPolicyTextsCache({
            dados_cadastrais:
              texts?.dados_cadastrais?.texto ||
              texts?.dados_cadastrais ||
              TEXTO_PADRAO_CONSENTIMENTO.dados_cadastrais,
            dados_saude:
              texts?.dados_saude?.texto ||
              texts?.dados_saude ||
              TEXTO_PADRAO_CONSENTIMENTO.dados_saude,
            marketing:
              texts?.marketing?.texto || texts?.marketing || TEXTO_PADRAO_CONSENTIMENTO.marketing,
            pesquisa:
              texts?.pesquisa?.texto || texts?.pesquisa || TEXTO_PADRAO_CONSENTIMENTO.pesquisa,
          })
        })
        .catch(() => {
          setPolicyTextsCache({
            dados_cadastrais: TEXTO_PADRAO_CONSENTIMENTO.dados_cadastrais,
            dados_saude: TEXTO_PADRAO_CONSENTIMENTO.dados_saude,
            marketing: TEXTO_PADRAO_CONSENTIMENTO.marketing,
            pesquisa: TEXTO_PADRAO_CONSENTIMENTO.pesquisa,
          })
        })
    }
  }, [policyTextsCache, fetchLgpdPolicyTexts])

  const openConsentModal = () => {
    setConsentTipo('dados_cadastrais')
    setConsentTexto(
      policyTextsCache?.dados_cadastrais || TEXTO_PADRAO_CONSENTIMENTO.dados_cadastrais,
    )
    setConsentChecked(false)
    setConsentModalOpen(true)
  }

  const onChangeConsentTipo = (tipo: TipoConsentimento) => {
    setConsentTipo(tipo)
    setConsentTexto(policyTextsCache?.[tipo] || TEXTO_PADRAO_CONSENTIMENTO[tipo])
  }

  const handleSaveConsent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!patient) return
    if (!consentChecked) {
      toast({
        title: 'Consentimento obrigatório',
        description: 'Marque a opção confirmando que o paciente leu e concordou.',
        variant: 'destructive',
      })
      return
    }
    setConsentSaving(true)
    const res = await registrarConsentimento(patient.id, consentTipo, consentTexto)
    setConsentSaving(false)
    if (res.success) {
      setConsentModalOpen(false)
      loadConsentimentos(patient.id)
    }
  }

  const openRevokeModal = (c: Consentimento) => {
    setRevokeTarget(c)
    setRevokeMotivo('')
    setRevokeModalOpen(true)
  }

  const handleRevokeConsent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!revokeTarget) return
    if (!revokeMotivo.trim()) {
      toast({ title: 'Informe o motivo da revogação.', variant: 'destructive' })
      return
    }
    setConsentSaving(true)
    const res = await revogarConsentimento(revokeTarget.id, revokeMotivo.trim())
    setConsentSaving(false)
    if (res.success) {
      setRevokeModalOpen(false)
      setRevokeTarget(null)
      if (patient) loadConsentimentos(patient.id)
    }
  }

  const formatConsentDate = (dt?: string | null) => {
    if (!dt) return '—'
    try {
      const d = new Date(dt)
      if (isNaN(d.getTime())) return dt
      return d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return dt
    }
  }
  // Modais de Exames
  const [tympModalOpen, setTympModalOpen] = useState(false)
  const [beraModalOpen, setBeraModalOpen] = useState(false)

  // Modal Aparelho
  const [aidModalOpen, setAidModalOpen] = useState(false)

  // Modal Agendamento
  const [appointmentModalOpen, setAppointmentModalOpen] = useState(false)

  // Modal Comparar Audiometrias
  const [compareModalOpen, setCompareModalOpen] = useState(false)

  // Modal Nova Evolução
  const [evoModalOpen, setEvoModalOpen] = useState(false)
  const [evoDate, setEvoDate] = useState(new Date().toISOString().split('T')[0])
  const [evoProf, setEvoProf] = useState('Milton Soares Pacheco')
  const [evoDesc, setEvoDesc] = useState('')
  // Loading do botão "Corrigir com IA" na evolução.
  const [aiCorrecting, setAiCorrecting] = useState(false)

  // Confirmação de Exclusão
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{
    type: string
    id: string
    name: string
  } | null>(null)

  // Exames de audiometria completa (coleção audiometry_exams)
  const [fullAudiometries, setFullAudiometries] = useState<any[]>([])
  const [loadingFullAudio, setLoadingFullAudio] = useState(false)
  const loadFullAudiometries = async (pid: string) => {
    setLoadingFullAudio(true)
    try {
      const recs = await pb.collection('audiometry_exams').getFullList({
        filter: `patient = "${pid}"`,
        sort: '-date',
      })
      setFullAudiometries(recs as any[])
    } catch (err) {
      console.error('Erro ao carregar audiometrias completas:', err)
      setFullAudiometries([])
    } finally {
      setLoadingFullAudio(false)
    }
  }
  React.useEffect(() => {
    if (patient?.id) loadFullAudiometries(patient.id)
  }, [patient?.id])

  // Imitanciometrias (coleção imitanciometrias — novo módulo completo)
  const [imitanciometrias, setImitanciometrias] = useState<any[]>([])
  const [loadingImit, setLoadingImit] = useState(false)
  const loadImitanciometrias = async (pid: string) => {
    setLoadingImit(true)
    try {
      const recs = await pb.collection('imitanciometrias').getFullList({
        filter: `paciente_id = "${pid}"`,
        sort: '-data_exame',
      })
      setImitanciometrias(recs as any[])
    } catch (err) {
      console.error('Erro ao carregar imitanciometrias:', err)
      setImitanciometrias([])
    } finally {
      setLoadingImit(false)
    }
  }
  React.useEffect(() => {
    if (patient?.id) loadImitanciometrias(patient.id)
  }, [patient?.id])

  // Impressão
  const { print } = usePrint()

  // State local para Dados Clínicos
  const existingRecord = patient ? clinicalRecords[patient.id] : null

  const [mainComplaint, setMainComplaint] = useState(existingRecord?.mainComplaint || '')
  const [anamnesis, setAnamnesis] = useState(existingRecord?.anamnesis || '')
  const [hearingHistory, setHearingHistory] = useState(existingRecord?.hearingHistory || '')
  const [currentMedications, setCurrentMedications] = useState(
    existingRecord?.currentMedications || '',
  )
  const [familyHistory, setFamilyHistory] = useState(existingRecord?.familyHistory || '')
  const [diagnosis, setDiagnosis] = useState(existingRecord?.diagnosis || '')
  const [conduct, setConduct] = useState(existingRecord?.conduct || '')
  const [nextReturn, setNextReturn] = useState(existingRecord?.nextReturn || '')

  if (!patient) {
    return (
      <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-4">
        <h2 className="text-xl font-bold text-slate-800">Paciente não localizado</h2>
        <p className="text-xs text-slate-500">
          O paciente solicitado não existe ou foi removido do sistema.
        </p>
        <Button onClick={() => navigate('/pacientes')} variant="outline">
          Voltar para Lista de Pacientes
        </Button>
      </div>
    )
  }

  // Filtrar dados do paciente
  const patientEvolutions = evolutions.filter((e) => e.patientId === patient.id)
  const patientAudiometries = audiometries.filter((a) => a.patientId === patient.id)
  const patientTympanometries = tympanometries.filter((t) => t.patientId === patient.id)
  const patientBeras = beras.filter((b) => b.patientId === patient.id)
  const patientAids = hearingAids.filter((a) => a.patientId === patient.id)
  const patientBudgets = budgets.filter((b) => b.patientId === patient.id)
  const patientSales = sales.filter((s) => s.patientId === patient.id)
  const patientInstallments = installments.filter((i) => i.patientId === patient.id)

  const examsCount =
    fullAudiometries.length +
    patientAudiometries.length +
    patientTympanometries.length +
    patientBeras.length +
    imitanciometrias.length

  const handleSaveClinicalRecord = (e: React.FormEvent) => {
    e.preventDefault()
    updateClinicalRecord(patient.id, {
      mainComplaint,
      anamnesis,
      hearingHistory,
      currentMedications,
      familyHistory,
      diagnosis,
      conduct,
      nextReturn,
    })
  }

  const handleSaveEvolution = (e: React.FormEvent) => {
    e.preventDefault()
    if (!evoDesc.trim()) return
    addEvolution({
      patientId: patient.id,
      date: evoDate,
      professionalName: evoProf,
      description: evoDesc.trim(),
    })
    setEvoDesc('')
    setEvoModalOpen(false)
  }

  /**
   * Envia o texto da evolução para a IA corrigir gramática/ortografia/clareza
   * e substitui o conteúdo do campo pelo resultado. A chamada é feita pelo
   * endpoint do AI Gateway do Skip (pb_hook `/backend/v1/ai/correct-text`),
   * que mantém as credenciais no servidor — nunca no bundle do frontend.
   * Em caso de erro, exibe um toast e mantém o texto original.
   */
  const handleAiCorrectEvolution = async () => {
    if (!evoDesc.trim()) {
      toast({
        title: 'Texto vazio',
        description: 'Digite o texto da evolução antes de corrigir.',
        variant: 'destructive',
      })
      return
    }
    setAiCorrecting(true)
    try {
      const data = await pb.send('/backend/v1/ai/correct-text', {
        method: 'POST',
        body: { text: evoDesc.trim() },
      })
      const corrected: string | undefined = data?.corrected?.trim()
      if (!corrected) throw new Error('Resposta vazia da IA.')
      setEvoDesc(corrected)
      toast({
        title: 'Texto corrigido',
        description: 'A IA revisou sua evolução clínica.',
      })
    } catch (err) {
      console.error('Erro ao corrigir com IA:', err)
      toast({
        title: 'Erro na IA',
        description: 'Não foi possível corrigir o texto. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setAiCorrecting(false)
    }
  }

  const handleSaveAppointment = (data: any) => {
    const res = addAppointment(data)
    return res.success
  }

  const handleSaveAid = (data: any) => {
    addHearingAid(data)
  }

  const handleDeleteItem = async () => {
    if (!deleteTarget) return
    if (deleteTarget.type === 'evolution') deleteEvolution(deleteTarget.id)
    if (deleteTarget.type === 'audiometry') deleteAudiometry(deleteTarget.id)
    if (deleteTarget.type === 'tympanometry') deleteTympanometry(deleteTarget.id)
    if (deleteTarget.type === 'bera') deleteBera(deleteTarget.id)
    if (deleteTarget.type === 'audiometry_exam') {
      try {
        await pb.collection('audiometry_exams').delete(deleteTarget.id)
        if (patient?.id) {
          await loadFullAudiometries(patient.id)
        }
      } catch (err) {
        console.error('Erro ao excluir exame de audiometria:', err)
      }
    }
    if (deleteTarget.type === 'imitanciometria') {
      try {
        await pb.collection('imitanciometrias').delete(deleteTarget.id)
        if (patient?.id) {
          await loadImitanciometrias(patient.id)
        }
      } catch (err) {
        console.error('Erro ao excluir imitanciometria:', err)
      }
    }
    setDeleteTarget(null)
  }

  const patientAge = calculateAge(patient.birthDate)

  // Endereço completo formatado
  const fullAddress = [
    patient.street ? `${patient.street}, ${patient.number}` : '',
    patient.complement ? patient.complement : '',
    patient.neighborhood ? patient.neighborhood : '',
    patient.city || patient.state ? `${patient.city}/${patient.state}` : '',
    patient.cep ? `CEP: ${patient.cep}` : '',
  ]
    .filter(Boolean)
    .join(' — ')

  return (
    <ErrorBoundary
      title="Erro ao carregar o prontuário"
      description="Ocorreu um erro inesperado ao carregar este prontuário. Tente recarregar a página. Se o problema persistir, entre em contato com o suporte."
    >
      <div className="space-y-6 animate-in fade-in-50 duration-200">
        {/* Cabeçalho: Botão Voltar + Ações + Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-full ${getAvatarColor(
                patient.name,
              )} text-white flex items-center justify-center font-extrabold text-base shadow-md ring-4 ring-teal-50 shrink-0`}
            >
              {getInitials(patient.name)}
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-slate-900 tracking-tight leading-tight">
                {patient.name}
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge
                  variant="outline"
                  className={
                    patient.status === 'Ativo'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold text-[10px]'
                      : 'bg-teal-50 text-navy-700 border-teal-200 font-bold text-[10px]'
                  }
                >
                  {patient.status}
                </Badge>
                <span className="text-[11px] text-slate-500">
                  {patientAge ? `${patientAge} anos` : 'Idade N/I'} • {patient.gender}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => navigate('/pacientes')}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Voltar
            </Button>
            <Button
              onClick={() =>
                navigate('/agenda', {
                  state: {
                    openModal: true,
                    patientId: patient.id,
                    patientName: patient.name,
                  },
                })
              }
              className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-xs font-semibold h-10 shadow-sm flex items-center gap-1.5"
            >
              <Calendar className="w-4 h-4" />
              Agendar Retorno
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                print({
                  title: 'Ficha do Paciente',
                  subtitle: patient.name,
                  body: (
                    <Suspense fallback={null}>
                      <PatientFichaPrint
                        patient={patient}
                        record={existingRecord}
                        evolutions={patientEvolutions}
                      />
                    </Suspense>
                  ),
                })
              }
              className="rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold h-10 flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              Imprimir Ficha
            </Button>
          </div>
        </div>

        {/* Á única com Tabs ocupando toda a largura */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            {/* Lista de abas: 3 colunas no mobile (2 linhas), 6 no desktop */}
            <TabsList className="grid grid-cols-3 sm:grid-cols-6 bg-slate-100 p-1 rounded-xl h-auto gap-1 w-full">
              <TabsTrigger
                value="cadastrais"
                className="text-xs font-semibold py-2 rounded-lg col-span-1"
              >
                Dados Cadastrais
              </TabsTrigger>
              <TabsTrigger value="anamnese" className="text-xs font-semibold py-2 rounded-lg">
                Anamnese
              </TabsTrigger>
              <TabsTrigger value="exames" className="text-xs font-semibold py-2 rounded-lg">
                Exames ({examsCount})
              </TabsTrigger>
              <TabsTrigger value="aparelhos" className="text-xs font-semibold py-2 rounded-lg">
                Aparelhos ({patientAids.length})
              </TabsTrigger>
              <TabsTrigger value="evolucao" className="text-xs font-semibold py-2 rounded-lg">
                Evolução ({patientEvolutions.length})
              </TabsTrigger>
              <TabsTrigger value="financeiro" className="text-xs font-semibold py-2 rounded-lg">
                Financeiro
              </TabsTrigger>
            </TabsList>

            {/* 1. ABA DADOS CADASTRAIS */}
            <TabsContent value="cadastrais" className="space-y-5 pt-5">
              {' '}
              {/* Cabeçalho do paciente */}
              <div className="flex flex-col sm:flex-row items-center gap-4 pb-5 border-b border-slate-100">
                <div
                  className={`w-20 h-20 rounded-full ${getAvatarColor(
                    patient.name,
                  )} text-white flex items-center justify-center font-extrabold text-2xl shadow-md ring-4 ring-teal-50 shrink-0`}
                >
                  {getInitials(patient.name)}
                </div>
                <div className="text-center sm:text-left">
                  <h2 className="text-xl font-bold text-slate-900">{patient.name}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {patientAge ? `${patientAge} anos` : 'Idade N/I'} • {patient.gender} • ID:{' '}
                    {patient.id}
                  </p>
                  <div className="flex items-center justify-center sm:justify-start gap-2 mt-2">
                    <Badge
                      variant="outline"
                      className={
                        patient.status === 'Ativo'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold'
                          : 'bg-teal-50 text-navy-700 border-teal-200 font-bold'
                      }
                    >
                      {patient.status}
                    </Badge>
                    {patient.lastVisit && (
                      <span className="text-[11px] text-slate-400">
                        Última visita: {formatDate(patient.lastVisit)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {/* Grid de informações cadastrais */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Dados Pessoais */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 pb-1.5 border-b border-slate-200">
                    <User className="w-4 h-4 text-teal-600" />
                    Dados Pessoais
                  </h3>
                  <InfoRow label="CPF" value={maskCPF(patient.cpf)} mono />
                  <InfoRow label="Data de Nascimento" value={formatDate(patient.birthDate)} />
                  <InfoRow
                    label="Idade"
                    value={patientAge ? `${patientAge} anos` : 'Não informada'}
                  />
                  <InfoRow label="Sexo" value={patient.gender} />
                </div>

                {/* Contato */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 pb-1.5 border-b border-slate-200">
                    <Phone className="w-4 h-4 text-teal-600" />
                    Contato
                  </h3>
                  <InfoRow label="Celular" value={patient.mobile || '—'} highlight />
                  <InfoRow label="Telefone Fixo" value={patient.phone || '—'} />
                  <InfoRow label="E-mail" value={patient.email || '—'} />
                </div>

                {/* Convênio */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 pb-1.5 border-b border-slate-200">
                    <CreditCard className="w-4 h-4 text-teal-600" />
                    Convênio / Pagamento
                  </h3>
                  <InfoRow
                    label="Tipo"
                    value={
                      patient.planType === 'Convênio'
                        ? patient.planName || 'Convênio'
                        : patient.planType === 'SUS'
                          ? 'SUS'
                          : 'Particular'
                    }
                    highlight
                  />
                  {patient.planType === 'Convênio' && patient.cardNumber && (
                    <InfoRow label="Carteira" value={patient.cardNumber} />
                  )}
                  <InfoRow label="Cadastrado em" value={formatDate(patient.createdAt)} />
                </div>

                {/* Endereço */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 pb-1.5 border-b border-slate-200">
                    <MapPin className="w-4 h-4 text-teal-600" />
                    Endereço
                  </h3>
                  <div className="space-y-1 text-xs">
                    {patient.street ? (
                      <InfoRow label="Rua" value={`${patient.street}, ${patient.number}`} />
                    ) : null}
                    {patient.complement ? (
                      <InfoRow label="Complemento" value={patient.complement} />
                    ) : null}
                    {patient.neighborhood ? (
                      <InfoRow label="Bairro" value={patient.neighborhood} />
                    ) : null}
                    <InfoRow label="Cidade / UF" value={`${patient.city}/${patient.state}`} />
                    {patient.cep ? <InfoRow label="CEP" value={patient.cep} /> : null}
                  </div>
                  {fullAddress && (
                    <p className="text-[11px] text-slate-500 italic pt-1 border-t border-slate-200">
                      {fullAddress}
                    </p>
                  )}
                </div>

                {/* Responsável Financeiro */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 pb-1.5 border-b border-slate-200">
                    <ShieldCheck className="w-4 h-4 text-teal-600" />
                    Responsável Financeiro
                  </h3>
                  {patient.hasResponsible && patient.responsible ? (
                    <>
                      <InfoRow label="Nome" value={patient.responsible.name} highlight />
                      <InfoRow label="Parentesco" value={patient.responsible.relationship} />
                      <InfoRow label="CPF" value={maskCPF(patient.responsible.cpf)} mono />
                      <InfoRow label="Telefone" value={patient.responsible.phone} />
                      <InfoRow label="E-mail" value={patient.responsible.email || '—'} />
                    </>
                  ) : (
                    <p className="text-xs text-slate-400 italic">
                      O próprio paciente é o responsável financeiro.
                    </p>
                  )}
                </div>

                {/* Histórico Auditivo */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 pb-1.5 border-b border-slate-200">
                    <Ear className="w-4 h-4 text-teal-600" />
                    Histórico Auditivo
                  </h3>
                  <InfoRow
                    label="Tipo de Perda Auditiva"
                    value={patient.hearingLossType}
                    highlight
                  />
                  <InfoRow
                    label="Uso Anterior de Aparelho"
                    value={patient.previousHearingAid ? 'Sim' : 'Não'}
                  />
                  {patient.previousHearingAid && (
                    <>
                      {patient.previousAidBrand && (
                        <InfoRow label="Marca Anterior" value={patient.previousAidBrand} />
                      )}
                      {patient.previousAidModel && (
                        <InfoRow label="Modelo Anterior" value={patient.previousAidModel} />
                      )}
                    </>
                  )}
                  {patient.generalNotes && (
                    <div className="pt-1.5 border-t border-slate-200">
                      <span className="text-[11px] text-slate-500 font-medium block mb-1">
                        Observações Gerais
                      </span>
                      <p className="text-xs text-slate-700 leading-relaxed">
                        {patient.generalNotes}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              {/* Bloco Consentimentos LGPD */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 border-b border-slate-200">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <ScrollText className="w-4 h-4 text-teal-600" />
                    Consentimentos LGPD
                  </h3>
                  <Button
                    size="sm"
                    onClick={openConsentModal}
                    className="bg-teal-500 hover:bg-teal-600 text-white text-xs font-semibold rounded-lg h-8 flex items-center gap-1.5 self-start sm:self-auto"
                  >
                    <FileSignature className="w-3.5 h-3.5" />
                    Registrar Consentimento
                  </Button>
                </div>

                {loadingConsent ? (
                  <p className="text-xs text-slate-400 italic">Carregando consentimentos...</p>
                ) : consentimentos.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">
                    Nenhum consentimento registrado para este paciente.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {consentimentos.map((c) => (
                      <div
                        key={c.id}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-2.5 rounded-lg border border-slate-100 bg-slate-50/60"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-800">
                              {ROTULO_CONSENTIMENTO[c.tipo_consentimento] || c.tipo_consentimento}
                            </span>
                            <Badge
                              variant="outline"
                              className={
                                (c.status as any) === 'aceito'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-semibold'
                                  : c.status === 'revogado'
                                    ? 'bg-red-50 text-red-700 border-red-200 text-[10px] font-semibold'
                                    : 'bg-slate-100 text-slate-600 border-slate-200 text-[10px] font-semibold'
                              }
                            >
                              {(c.status as any) === 'aceito'
                                ? 'Aceito'
                                : c.status === 'revogado'
                                  ? 'Revogado'
                                  : 'Expirado'}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Aceito em:{' '}
                            {formatConsentDate(
                              (c as any).data_aceitacao || (c as any).data_criacao,
                            )}
                            {c.status === 'revogado' && (c as any).data_revogacao
                              ? ` • Revogado em: ${formatConsentDate((c as any).data_revogacao)}`
                              : ''}
                            {(c as any).usuario_nome ? ` • Por: ${(c as any).usuario_nome}` : ''}
                          </p>
                          {c.status === 'revogado' && (c as any).observacoes && (
                            <p className="text-[11px] text-red-600 mt-0.5 italic">
                              Motivo: {(c as any).observacoes}
                            </p>
                          )}
                        </div>
                        {(c.status as any) === 'aceito' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openRevokeModal(c)}
                            className="h-7 px-2 text-xs text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-1 self-start sm:self-auto"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            Revogar
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* 2. ABA ANAMNESE (Dados Clínicos) */}
            <TabsContent value="anamnese" className="space-y-4 pt-5">
              <form onSubmit={handleSaveClinicalRecord} className="space-y-4">
                {' '}
                <div>
                  <Label className="text-xs font-bold text-slate-800">Anamnese Geral</Label>
                  <Textarea
                    value={anamnesis}
                    onChange={(e) => setAnamnesis(e.target.value)}
                    placeholder="Início dos sintomas, evolução temporal, episódios de tontura/vertigem..."
                    rows={2}
                    disabled={isSecretaria}
                    className="rounded-xl mt-1 text-xs border-slate-300"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div></div>
                  <div></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2"></div>
                </div>
                {!isSecretaria && (
                  <div className="flex justify-end pt-2 border-t border-slate-100">
                    <Button
                      type="submit"
                      className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-xs font-semibold shadow-sm px-6"
                    >
                      Salvar Prontuário Clínico
                    </Button>
                  </div>
                )}
              </form>
            </TabsContent>

            {/* 3. ABA EXAMES */}
            <TabsContent value="exames" className="space-y-6 pt-5 text-[0rem]">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900">
                  Histórico de Exames Audiológicos
                </h3>
                {!isSecretaria && (
                  <div className="flex items-center gap-2">
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span tabIndex={0} className="inline-flex">
                            <Button
                              size="sm"
                              disabled={fullAudiometries.length < 2}
                              onClick={() => setCompareModalOpen(true)}
                              className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl h-8 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <ArrowUpDown className="w-3.5 h-3.5 mr-1" />
                              Comparar Audiometrias
                            </Button>
                          </span>
                        </TooltipTrigger>
                        {fullAudiometries.length < 2 && (
                          <TooltipContent className="max-w-[220px] text-xs">
                            São necessárias pelo menos 2 audiometrias para comparar
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                    <Button
                      size="sm"
                      onClick={() => navigate(`/pacientes/${patient.id}/audiometria/novo`)}
                      className="bg-teal-500 hover:bg-teal-600 text-white text-xs font-semibold rounded-xl h-8"
                    >
                      + Audiometria
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => navigate(`/pacientes/${patient.id}/imitanciometria/novo`)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl h-8"
                    >
                      + Imitanciometria
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setBeraModalOpen(true)}
                      className="bg-pink-600 hover:bg-pink-700 text-white text-xs font-semibold rounded-xl h-8"
                    >
                      + BERA
                    </Button>
                  </div>
                )}
              </div>

              {/* Audiometria Tonal e Vocal (audiometry_exams) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-teal-700 flex items-center gap-1.5">
                    <Activity className="w-4 h-4" />
                    Audiometria Tonal e Vocal ({fullAudiometries.length})
                  </h4>
                </div>
                {loadingFullAudio ? (
                  <p className="text-xs text-slate-400 italic">Carregando exames...</p>
                ) : fullAudiometries.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">
                    Nenhum exame audiológico completo registrado.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {fullAudiometries.map((exam) => {
                      const date = exam.date ? formatDate(exam.date) : '—'
                      const report = (exam.report || '').slice(0, 80)
                      return (
                        <div
                          key={exam.id}
                          className="w-full text-left p-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:border-teal-300 hover:shadow-sm transition-all flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-extrabold text-slate-900">
                              Audiometria — {date}
                            </span>
                            {report && (
                              <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                                {report}
                                {exam.report && exam.report.length > 80 ? '…' : ''}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              size="sm"
                              onClick={() =>
                                navigate(`/pacientes/${patient.id}/audiometria/${exam.id}`)
                              }
                              className="bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-semibold h-7 px-3 rounded-lg"
                            >
                              Ver / Editar
                            </Button>
                            {!isSecretaria && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setDeleteTarget({
                                    type: 'audiometry_exam',
                                    id: exam.id,
                                    name: `Audiometria de ${date}`,
                                  })
                                  setDeleteConfirmOpen(true)
                                }}
                                className="h-7 w-7 p-0 text-red-500 hover:bg-red-50 rounded-lg"
                                title="Excluir exame"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Imitanciometrias (novo módulo completo — imitanciometrias) */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                  <Activity className="w-4 h-4" />
                  Imitanciometrias ({imitanciometrias.length})
                </h4>
                {loadingImit ? (
                  <p className="text-xs text-slate-400 italic">Carregando exames...</p>
                ) : imitanciometrias.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">
                    Nenhuma imitanciometria registrada.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {imitanciometrias.map((exam) => {
                      const date = exam.data_exame ? formatDate(exam.data_exame) : '—'
                      const curvaOD = exam.tipo_curva_od || '—'
                      const curvaOE = exam.tipo_curva_oe || '—'
                      const statusLabel = exam.status === 'finalizado' ? 'Finalizado' : 'Rascunho'
                      return (
                        <div
                          key={exam.id}
                          className="w-full text-left p-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:border-emerald-300 hover:shadow-sm transition-all flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-extrabold text-slate-900">
                              Imitanciometria — {date}
                            </span>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Curva OD: <strong>{curvaOD}</strong> • Curva OE:{' '}
                              <strong>{curvaOE}</strong> •{' '}
                              <span
                                className={
                                  exam.status === 'finalizado'
                                    ? 'text-emerald-600 font-semibold'
                                    : 'text-amber-600 font-semibold'
                                }
                              >
                                {statusLabel}
                              </span>
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              size="sm"
                              onClick={() =>
                                navigate(`/pacientes/${patient.id}/imitanciometria/${exam.id}`)
                              }
                              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold h-7 px-3 rounded-lg"
                            >
                              Ver / Editar
                            </Button>
                            {!isSecretaria && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setDeleteTarget({
                                    type: 'imitanciometria',
                                    id: exam.id,
                                    name: `Imitanciometria de ${date}`,
                                  })
                                  setDeleteConfirmOpen(true)
                                }}
                                className="h-7 w-7 p-0 text-red-500 hover:bg-red-50 rounded-lg"
                                title="Excluir exame"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Imitanciometrias (legado — tympanometries) */}
              <div className="space-y-3 pt-2">
                {patientTympanometries.length === 0
                  ? null
                  : patientTympanometries.map((exam) => (
                      <div
                        key={exam.id}
                        className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-slate-900">
                            Imitanciometria em {formatDate(exam.date)}
                          </span>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                print({
                                  title: 'Laudo de Imitanciometria',
                                  subtitle: `${patient.name} — ${formatDate(exam.date)}`,
                                  body: (
                                    <Suspense fallback={null}>
                                      <TympanometryPrint exam={exam} />
                                    </Suspense>
                                  ),
                                })
                              }
                              className="h-7 w-7 p-0 text-teal-600 hover:bg-teal-50 rounded-lg"
                              title="Imprimir laudo"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </Button>
                            {!isSecretaria && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setDeleteTarget({
                                    type: 'tympanometry',
                                    id: exam.id,
                                    name: `Imitanciometria de ${formatDate(exam.date)}`,
                                  })
                                  setDeleteConfirmOpen(true)
                                }}
                                className="h-7 w-7 p-0 text-red-500 hover:bg-red-50 rounded-lg"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs bg-white p-2.5 rounded-lg border border-slate-200">
                          <div>
                            Curva OD: <strong>Tipo {exam.tympanometryOD.curve}</strong>
                          </div>
                          <div>
                            Curva OE: <strong>Tipo {exam.tympanometryOE.curve}</strong>
                          </div>
                        </div>
                        <p className="text-xs text-slate-700">{exam.conclusion}</p>
                      </div>
                    ))}
              </div>

              {/* BERAs */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-pink-700 flex items-center gap-1.5">
                  <Zap className="w-4 h-4" />
                  Exames BERA / PEATE ({patientBeras.length})
                </h4>
                {patientBeras.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Nenhum exame BERA registrado.</p>
                ) : (
                  patientBeras.map((exam) => (
                    <div
                      key={exam.id}
                      className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-slate-900">
                          BERA em {formatDate(exam.date)}
                        </span>
                        <div className="flex items-center gap-2">
                          <Badge
                            className={
                              exam.classification === 'Normal'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-red-50 text-red-700 border-red-200'
                            }
                          >
                            {exam.classification}
                          </Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              print({
                                title: 'Laudo BERA / PEATE',
                                subtitle: `${patient.name} — ${formatDate(exam.date)}`,
                                body: (
                                  <Suspense fallback={null}>
                                    <BeraPrint exam={exam} />
                                  </Suspense>
                                ),
                              })
                            }
                            className="h-7 w-7 p-0 text-teal-600 hover:bg-teal-50 rounded-lg"
                            title="Imprimir laudo"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </Button>
                          {!isSecretaria && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setDeleteTarget({
                                  type: 'bera',
                                  id: exam.id,
                                  name: `BERA de ${formatDate(exam.date)}`,
                                })
                                setDeleteConfirmOpen(true)
                              }}
                              className="h-7 w-7 p-0 text-red-500 hover:bg-red-50 rounded-lg"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                      {exam.notes && <p className="text-xs text-slate-700">{exam.notes}</p>}
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            {/* 4. ABA APARELHOS */}
            <TabsContent value="aparelhos" className="space-y-5 pt-5">
              {/* Seção: Teste com Aparelho */}
              <TesteAparelhoSection patient={patient} />

              {/* Seção: Aparelhos vinculados */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">
                    Aparelhos Auditivos do Paciente
                  </h3>
                  <Button
                    size="sm"
                    onClick={() => setAidModalOpen(true)}
                    className="bg-teal-500 hover:bg-teal-600 text-white text-xs font-semibold rounded-xl h-9"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Vincular Aparelho
                  </Button>
                </div>

                {patientAids.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-xs bg-slate-50 rounded-xl">
                    Nenhum aparelho auditivo vinculado a este paciente.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {patientAids.map((aid) => (
                      <div
                        key={aid.id}
                        className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between gap-4"
                      >
                        <div>
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                            {aid.brand} {aid.model}
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Tipo: {aid.type} • Lado: {aid.side} • Série: {aid.serialNumber}
                          </p>
                          <p className="text-[11px] text-slate-600 mt-1">
                            Garantia até: <strong>{formatDate(aid.warrantyEndDate)}</strong> •{' '}
                            {aid.powerSource}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className="bg-teal-50 text-navy-700 border-teal-200"
                        >
                          {aid.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* 5. ABA EVOLUÇÃO */}
            <TabsContent value="evolucao" className="space-y-4 pt-5">
              {' '}
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">
                  Linha do Tempo de Evoluções Clínicas
                </h3>
                <Button
                  size="sm"
                  onClick={() => setEvoModalOpen(true)}
                  className="bg-teal-500 hover:bg-teal-600 text-white text-xs font-semibold rounded-xl h-9"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Nova Evolução
                </Button>
              </div>
              {patientEvolutions.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs bg-slate-50 rounded-xl">
                  Nenhuma evolução clínica registrada ainda para este paciente.
                </div>
              ) : (
                <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-teal-200">
                  {patientEvolutions.map((evo) => (
                    <div key={evo.id} className="relative group">
                      {/* Ponto na timeline */}
                      <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-teal-500 ring-4 ring-teal-100" />

                      <div className="bg-slate-50 hover:bg-white p-4 rounded-xl border border-slate-200 hover:shadow-sm transition-all space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">
                              {formatDate(evo.date)}
                            </span>
                            <span className="text-xs text-slate-500 font-medium">
                              • {evo.professionalName}
                            </span>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setDeleteTarget({
                                type: 'evolution',
                                id: evo.id,
                                name: `Evolução de ${formatDate(evo.date)}`,
                              })
                              setDeleteConfirmOpen(true)
                            }}
                            className="h-7 w-7 p-0 text-red-400 hover:text-red-600 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                          {evo.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* 6. ABA FINANCEIRO - Interface de Lançamento no Atendimento */}
            <TabsContent value="financeiro" className="space-y-5 pt-5">
              <FinanceiroAtendimentoSection patient={patient} />
            </TabsContent>
          </Tabs>
        </div>

        {/* MODAL NOVA EVOLUÇÃO */}
        <Dialog open={evoModalOpen} onOpenChange={setEvoModalOpen}>
          <DialogContent className="max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-slate-900">
                Registrar Evolução Clínica
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSaveEvolution} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Data</Label>
                  <Input
                    type="date"
                    value={evoDate}
                    onChange={(e) => setEvoDate(e.target.value)}
                    className="h-10 rounded-xl mt-1 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Profissional</Label>
                  <Select value={evoProf} onValueChange={setEvoProf}>
                    <SelectTrigger className="h-10 rounded-xl mt-1 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Milton Soares Pacheco">
                        Milton Soares Pacheco (CRFa 3-11981-5)
                      </SelectItem>
                      <SelectItem value="Dr. Lucas Ferreira Santos">
                        Dr. Lucas Ferreira Santos
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-slate-700">
                    Descrição do Atendimento
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAiCorrectEvolution}
                    disabled={aiCorrecting || !evoDesc.trim()}
                    className="h-7 px-2.5 text-[11px] font-semibold rounded-lg border-teal-200 text-teal-700 hover:bg-teal-50 disabled:opacity-50"
                    title="Corrigir gramática e clareza do texto com IA"
                  >
                    {aiCorrecting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                        Corrigindo...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 mr-1" />
                        Corrigir com IA
                      </>
                    )}
                  </Button>
                </div>
                <Textarea
                  value={evoDesc}
                  onChange={(e) => setEvoDesc(e.target.value)}
                  placeholder="Descreva a evolução clínica, respostas a testes, ajustes finos realizados..."
                  rows={4}
                  required
                  className="rounded-xl mt-1 text-xs border-slate-300"
                />
              </div>

              <DialogFooter className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEvoModalOpen(false)}
                  className="rounded-xl text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-xs font-semibold"
                >
                  Salvar Evolução
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Modal de Agendamento */}
        <AppointmentModal
          open={appointmentModalOpen}
          onOpenChange={setAppointmentModalOpen}
          initialPatientId={patient.id}
          initialPatientName={patient.name}
          onSave={handleSaveAppointment}
        />

        {/* Modal de Aparelho Auditivo */}
        <HearingAidModal
          open={aidModalOpen}
          onOpenChange={setAidModalOpen}
          initialPatientId={patient.id}
          onSave={handleSaveAid}
        />

        {/* Modal Comparar Audiometrias */}
        <CompareAudiometriesModal
          open={compareModalOpen}
          onOpenChange={setCompareModalOpen}
          audiometries={fullAudiometries}
        />
        <TympanometryModal
          open={tympModalOpen}
          onOpenChange={setTympModalOpen}
          patient={patient}
          onSave={addTympanometry}
        />
        <BeraModal
          open={beraModalOpen}
          onOpenChange={setBeraModalOpen}
          patient={patient}
          onSave={addBera}
        />

        {/* Confirmação de Exclusão */}
        <ConfirmDialog
          open={deleteConfirmOpen}
          onOpenChange={setDeleteConfirmOpen}
          title="Excluir registro?"
          description={`Deseja realmente remover o registro "${deleteTarget?.name}"? Esta ação não pode ser desfeita.`}
          confirmText="Excluir"
          cancelText="Cancelar"
          variant="danger"
          onConfirm={handleDeleteItem}
        />

        {/* Modal: Registrar Consentimento LGPD */}
        <Dialog open={consentModalOpen} onOpenChange={setConsentModalOpen}>
          <DialogContent className="max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <DialogHeader className="border-b border-slate-100 pb-3">
              <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <ScrollText className="w-5 h-5 text-teal-600" />
                <span>Registrar Consentimento LGPD</span>
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveConsent} className="space-y-4 pt-2">
              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Tipo de Consentimento <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={consentTipo}
                  onValueChange={(v) => onChangeConsentTipo(v as TipoConsentimento)}
                >
                  <SelectTrigger className="h-10 rounded-xl mt-1 text-sm border-slate-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_CONSENTIMENTO.map((t) => (
                      <SelectItem key={t} value={t} className="text-sm">
                        {ROTULO_CONSENTIMENTO[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Texto do Termo (editável)
                </Label>
                <Textarea
                  value={consentTexto}
                  onChange={(e) => setConsentTexto(e.target.value)}
                  rows={8}
                  className="rounded-xl mt-1 text-xs border-slate-300 resize-y"
                />
              </div>
              <div className="flex items-start gap-2.5 rounded-lg bg-slate-50 border border-slate-200 p-3">
                <Checkbox
                  id="lgpd-consent-check"
                  checked={consentChecked}
                  onCheckedChange={(v) => setConsentChecked(!!v)}
                  className="border-slate-400 data-[state=checked]:bg-teal-500 mt-0.5"
                />
                <Label
                  htmlFor="lgpd-consent-check"
                  className="text-xs font-medium text-slate-700 cursor-pointer select-none leading-relaxed"
                >
                  Paciente leu e concordou com o termo de consentimento acima.
                </Label>
              </div>
              <DialogFooter className="pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setConsentModalOpen(false)}
                  className="rounded-xl border-slate-300 text-xs font-semibold h-10"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={consentSaving || !consentChecked}
                  className="bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-xl h-10 flex items-center gap-1.5"
                >
                  <Lock className="w-4 h-4" />
                  {consentSaving ? 'Salvando...' : 'Salvar Consentimento'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Modal: Revogar Consentimento LGPD */}
        <Dialog open={revokeModalOpen} onOpenChange={setRevokeModalOpen}>
          <DialogContent className="max-w-md w-full rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <DialogHeader className="border-b border-slate-100 pb-3">
              <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Ban className="w-5 h-5 text-red-500" />
                <span>Revogar Consentimento</span>
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleRevokeConsent} className="space-y-4 pt-2">
              <p className="text-xs text-slate-600">
                Você está revogando o consentimento de{' '}
                <strong>
                  {revokeTarget ? ROTULO_CONSENTIMENTO[revokeTarget.tipo_consentimento] : ''}
                </strong>
                . Esta ação registra a revogação imediata do tratamento dos dados.
              </p>
              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Motivo da Revogação <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  value={revokeMotivo}
                  onChange={(e) => setRevokeMotivo(e.target.value)}
                  rows={4}
                  required
                  placeholder="Descreva o motivo da revogação do consentimento..."
                  className="rounded-xl mt-1 text-sm border-slate-300 resize-none"
                />
              </div>
              <DialogFooter className="pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRevokeModalOpen(false)}
                  className="rounded-xl border-slate-300 text-xs font-semibold h-10"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={consentSaving || !revokeMotivo.trim()}
                  className="bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl h-10 flex items-center gap-1.5"
                >
                  <Ban className="w-4 h-4" />
                  {consentSaving ? 'Revogando...' : 'Revogar Consentimento'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      )
    </ErrorBoundary>
  )
}

/* ---------- Helper de linha de informação (Dados Cadastrais) ---------- */
function InfoRow({
  label,
  value,
  mono = false,
  highlight = false,
}: {
  label: string
  value: string
  mono?: boolean
  highlight?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-0.5">
      <span className="text-[11px] text-slate-500 font-medium shrink-0">{label}:</span>
      <span
        className={`text-xs text-right ${
          highlight ? 'font-bold text-navy-700' : 'font-semibold text-slate-800'
        } ${mono ? 'font-mono' : ''}`}
      >
        {value}
      </span>
    </div>
  )
}

/* ---------- Subcomponente: Teste com Aparelho (Aba Aparelhos) ---------- */
interface HearingAidTest {
  id: string
  patient_id: string
  patient_name: string
  inventory_item_id: string
  product_name: string
  brand: string
  model: string
  start_date: string
  side: string
  status: string
  observations: string
  sale_type: string
  sale_id: string
  sale_number: string
  return_reason?: string
  created: string
}

function TesteAparelhoSection({ patient }: { patient: Patient }) {
  const {
    stockItems,
    empresasParceiras,
    fetchEmpresasParceiras,
    addVendaB2B,
    addSale,
    addStockExit,
    addStockEntry,
    addHearingAid,
    currentUser,
  } = useApp()
  const { toast } = useToast()

  // Calcula a data final de garantia (saleDate + meses).
  const computeWarrantyEnd = (saleDate: string, months: number): string => {
    const d = new Date(saleDate + 'T00:00:00')
    if (isNaN(d.getTime())) return ''
    d.setMonth(d.getMonth() + months)
    return d.toISOString().split('T')[0]
  }

  // Cria o vínculo de HearingAid a partir de um teste convertido em venda.
  const vincularHearingAid = (
    t: HearingAidTest,
    saleValue: number,
    method: PDVPaymentMethod = 'À vista',
  ): string => {
    const item = stockItems.find((p) => p.id === t.inventory_item_id)
    const warrantyMonths = 24
    const warrantyEndDate = computeWarrantyEnd(today, warrantyMonths)
    addHearingAid({
      patientId: patient.id,
      patientName: patient.name,
      brand: item?.brand || t.brand || '',
      model: item?.model || t.model || '',
      type: 'BTE',
      side: (t.side as HearingAidSide) || 'Bilateral',
      serialNumber: t.inventory_item_id ? t.inventory_item_id : `TST-${today}`,
      saleDate: today,
      saleValue,
      paymentMethod: method,
      warrantyMonths,
      warrantyEndDate,
      powerSource: 'Recarregável',
      earMold: false,
      status: 'Em uso',
      notes: `Venda realizada via teste com aparelho em ${today}`,
    } as any)
    return warrantyEndDate
  }

  const [tests, setTests] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // Form de novo teste
  const today = new Date().toISOString().split('T')[0]
  const [newOpen, setNewOpen] = useState(false)
  const [selItemId, setSelItemId] = useState('')
  const [startDate, setStartDate] = useState(today)
  const [side, setSide] = useState('Bilateral')
  const [observations, setObservations] = useState('')

  // Modal venda B2B
  const [b2bOpen, setB2bOpen] = useState(false)
  const [b2bTarget, setB2bTarget] = useState<HearingAidTest | null>(null)
  const [b2bEmpresaId, setB2bEmpresaId] = useState('')
  const [b2bPercentual, setB2bPercentual] = useState(30)
  const [b2bValor, setB2bValor] = useState(0)
  const [savingB2B, setSavingB2B] = useState(false)

  // Modal venda direta
  const [diretaOpen, setDiretaOpen] = useState(false)
  const [diretaTarget, setDiretaTarget] = useState<HearingAidTest | null>(null)
  const [diretaValor, setDiretaValor] = useState(0)
  const [diretaDesconto, setDiretaDesconto] = useState(0)
  const [diretaPagamento, setDiretaPagamento] = useState<PDVPaymentMethod>('Dinheiro')
  const [savingDireta, setSavingDireta] = useState(false)

  // Modal devolução ao estoque
  const [devolverOpen, setDevolverOpen] = useState(false)
  const [devolverTarget, setDevolverTarget] = useState<HearingAidTest | null>(null)
  const [devolverMotivo, setDevolverMotivo] = useState('')
  const [savingDevolver, setSavingDevolver] = useState(false)

  // Empresas ativas
  const empresasAtivas = useMemo(
    () => empresasParceiras.filter((e) => (e.status as any) === 'ativo'),
    [empresasParceiras],
  )

  // Aparelhos auditivos disponíveis (mesma lógica do NovaVendaB2B)
  const aparelhosAuditivos = useMemo(
    () =>
      stockItems.filter(
        (p) =>
          (p.category || '').toLowerCase().replace(/ó/g, 'o') === 'aparelhos auditivos' &&
          (p.currentQuantity || 0) > 0,
      ),
    [stockItems],
  )

  const loadTests = useCallback(async () => {
    try {
      setLoading(true)
      const recs = await pb.collection('hearing_aid_tests').getFullList({
        filter: `patient_id = "${patient.id}"`,
        sort: '-created',
      })
      setTests(recs as any[])
    } catch (err) {
      console.error('Erro ao carregar testes de aparelho:', err)
      setTests([])
    } finally {
      setLoading(false)
    }
  }, [patient.id])

  useEffect(() => {
    loadTests()
  }, [loadTests])

  useEffect(() => {
    fetchEmpresasParceiras()
  }, [fetchEmpresasParceiras])

  const onSelectItem = (id: string) => {
    setSelItemId(id)
  }

  const handleCreateTest = async () => {
    const item = aparelhosAuditivos.find((p) => p.id === selItemId)
    if (!item) {
      toast({ title: 'Selecione um aparelho do estoque', variant: 'destructive' })
      return
    }
    if (!startDate) {
      toast({ title: 'Informe a data de início', variant: 'destructive' })
      return
    }
    try {
      const rec: any = await pb.collection('hearing_aid_tests').create({
        patient_id: patient.id,
        patient_name: patient.name,
        inventory_item_id: item.id,
        product_name: item.name,
        brand: item.brand || '',
        model: item.model || '',
        start_date: startDate,
        side,
        status: 'Em teste',
        observations: observations.trim(),
        sale_type: '',
        sale_id: '',
        sale_number: '',
      })
      setTests((prev) => [rec, ...prev])
      toast({
        title: 'Teste iniciado',
        description: `${item.name} marcado como "Em teste" para ${patient.name}.`,
      })
      setSelItemId('')
      setStartDate(today)
      setSide('Bilateral')
      setObservations('')
      setNewOpen(false)
    } catch (err) {
      console.error('Erro ao criar teste:', err)
      toast({
        title: 'Erro ao iniciar teste',
        description: 'Não foi possível registrar o teste. Tente novamente.',
        variant: 'destructive',
      })
    }
  }

  const handleCancelTest = async (t: HearingAidTest) => {
    try {
      await pb.collection('hearing_aid_tests').update(t.id, { status: 'Cancelado' })
      setTests((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: 'Cancelado' } : x)))
      toast({ title: 'Teste cancelado', description: `Teste de ${t.product_name} cancelado.` })
    } catch (err) {
      console.error('Erro ao cancelar teste:', err)
      toast({ title: 'Erro ao cancelar teste', variant: 'destructive' })
    }
  }

  const openDevolver = (t: HearingAidTest) => {
    setDevolverTarget(t)
    setDevolverMotivo('')
    setDevolverOpen(true)
  }

  const handleConfirmDevolver = async () => {
    if (!devolverTarget) return
    if (!devolverMotivo.trim()) {
      toast({ title: 'Informe o motivo da devolução', variant: 'destructive' })
      return
    }
    setSavingDevolver(true)
    try {
      // Restaura a quantidade no estoque caso o item tenha sido baixado ao
      // iniciar o teste. A baixa só ocorre na venda; quando não houve baixa,
      // esta entrada apenas registra o movimento de devolução.
      addStockEntry(
        devolverTarget.inventory_item_id,
        1,
        `Devolução de teste — ${devolverMotivo.trim()}`,
        currentUser?.name || 'Sistema',
        today,
      )

      await pb.collection('hearing_aid_tests').update(devolverTarget.id, {
        status: 'Devolvido',
        return_reason: devolverMotivo.trim(),
      })
      setTests((prev) =>
        prev.map((x) =>
          x.id === devolverTarget.id
            ? { ...x, status: 'Devolvido', return_reason: devolverMotivo.trim() }
            : x,
        ),
      )

      toast({
        title: 'Aparelho devolvido ao estoque',
        description: `Motivo: ${devolverMotivo.trim()}`,
      })
      setDevolverOpen(false)
      setDevolverTarget(null)
      setDevolverMotivo('')
    } catch (err) {
      console.error('Erro ao devolver aparelho ao estoque:', err)
      toast({ title: 'Erro ao devolver aparelho', variant: 'destructive' })
    } finally {
      setSavingDevolver(false)
    }
  }

  const openB2B = (t: HearingAidTest) => {
    const item = stockItems.find((p) => p.id === t.inventory_item_id)
    setB2bTarget(t)
    setB2bEmpresaId('')
    setB2bPercentual(30)
    setB2bValor(item?.salePrice || 0)
    setB2bOpen(true)
  }

  const handleConfirmB2B = async () => {
    if (!b2bTarget) return
    if (!b2bEmpresaId) {
      toast({ title: 'Selecione a empresa parceira', variant: 'destructive' })
      return
    }
    setSavingB2B(true)
    try {
      const valorSubtotal = Number(b2bValor) || 0
      const venda = await addVendaB2B({
        cliente_empresa_id: b2bEmpresaId,
        cliente_empresa_nome:
          empresasParceiras.find((e) => e.id === b2bEmpresaId)?.razao_social || '',
        data_venda: today,
        valor_total: valorSubtotal,
        percentual_comissao: Number(b2bPercentual) || 0,
        valor_comissao: (valorSubtotal * (Number(b2bPercentual) || 0)) / 100,
        valor_repasse: valorSubtotal - (valorSubtotal * (Number(b2bPercentual) || 0)) / 100,
        status: 'aprovada',
        especialista_id: currentUser?.id || '',
        especialista_nome: currentUser?.name || '',
        observacoes: `Origem: teste de aparelho do paciente ${patient.name} (${b2bTarget.product_name}).`,
        itens: [
          {
            produto_id: b2bTarget.inventory_item_id,
            produto_nome: b2bTarget.product_name,
            quantidade: 1,
            valor_unitario: valorSubtotal,
            valor_subtotal: valorSubtotal,
          },
        ],
      })

      if (!venda) {
        toast({ title: 'Erro ao criar venda B2B', variant: 'destructive' })
        return
      }

      // A baixa no estoque é feita pela própria addVendaB2B quando status='aprovada'.

      // Atualiza o teste
      await pb.collection('hearing_aid_tests').update(b2bTarget.id, {
        status: 'Convertido em venda B2B',
        sale_type: 'B2B',
        sale_id: venda.id,
        sale_number: venda.numero_venda,
      })
      setTests((prev) =>
        prev.map((x) =>
          x.id === b2bTarget.id
            ? {
                ...x,
                status: 'Convertido em venda B2B',
                sale_type: 'B2B',
                sale_id: venda.id,
                sale_number: venda.numero_venda,
              }
            : x,
        ),
      )

      // Cria vínculo de aparelho auditivo no paciente
      const warrantyEndDate = vincularHearingAid(b2bTarget, valorSubtotal)
      toast({
        title: 'Venda B2B criada com sucesso!',
        description: `${venda.numero_venda} registrada e estoque baixado.`,
      })
      toast({
        title: 'Aparelho vinculado ao paciente',
        description: `Garantia até ${formatDate(warrantyEndDate)}.`,
      })
      setB2bOpen(false)
      setB2bTarget(null)
    } catch (err) {
      console.error('Erro ao confirmar venda B2B:', err)
      toast({ title: 'Erro ao criar venda B2B', variant: 'destructive' })
    } finally {
      setSavingB2B(false)
    }
  }

  const openDireta = (t: HearingAidTest) => {
    const item = stockItems.find((p) => p.id === t.inventory_item_id)
    setDiretaTarget(t)
    setDiretaValor(item?.salePrice || 0)
    setDiretaDesconto(0)
    setDiretaPagamento('Dinheiro')
    setDiretaOpen(true)
  }

  const handleConfirmDireta = async () => {
    if (!diretaTarget) return
    setSavingDireta(true)
    try {
      const valor = Number(diretaValor) || 0
      const desconto = Number(diretaDesconto) || 0
      const total = Math.max(0, valor - desconto)

      // Baixa no estoque
      addStockExit(
        diretaTarget.inventory_item_id,
        1,
        `Venda direta (Teste)`,
        currentUser?.name || 'Sistema',
        diretaTarget.patient_name,
        today,
      )

      // Cria venda via addSale
      const newSale: Sale = addSale({
        patientId: patient.id,
        patientName: patient.name,
        date: today,
        itemsDescription: `1x ${diretaTarget.product_name} (Venda direta a partir de teste)`,
        totalValue: total,
        paymentMethod: diretaPagamento,
        installmentsCount: 1,
        interestPercent: 0,
        firstDueDate: today,
        status: 'Concluída',
        type: 'PDV',
        items: [
          {
            id: diretaTarget.inventory_item_id,
            name: diretaTarget.product_name,
            type: 'inventory',
            stockItemId: diretaTarget.inventory_item_id,
            quantity: 1,
            unitPrice: valor,
            subtotal: total,
          },
        ],
        subtotal: valor,
        discountValue: desconto,
        discountPercent: valor > 0 ? (desconto / valor) * 100 : 0,
      })

      // Atualiza o teste
      await pb.collection('hearing_aid_tests').update(diretaTarget.id, {
        status: 'Convertido em venda direta',
        sale_type: 'Direta',
        sale_id: newSale.id,
        sale_number: String(newSale.number),
      })
      setTests((prev) =>
        prev.map((x) =>
          x.id === diretaTarget.id
            ? {
                ...x,
                status: 'Convertido em venda direta',
                sale_type: 'Direta',
                sale_id: newSale.id,
                sale_number: String(newSale.number),
              }
            : x,
        ),
      )

      // Cria vínculo de aparelho auditivo no paciente
      const warrantyEndDate = vincularHearingAid(diretaTarget, total, diretaPagamento)
      toast({
        title: 'Venda direta registrada!',
        description: `Venda #${newSale.number} criada e estoque baixado.`,
      })
      toast({
        title: 'Aparelho vinculado ao paciente',
        description: `Garantia até ${formatDate(warrantyEndDate)}.`,
      })
      setDiretaOpen(false)
      setDiretaTarget(null)
    } catch (err) {
      console.error('Erro ao confirmar venda direta:', err)
      toast({ title: 'Erro ao criar venda direta', variant: 'destructive' })
    } finally {
      setSavingDireta(false)
    }
  }

  const statusBadgeClass = (status: string) => {
    switch (status) {
      case 'Em teste':
        return 'bg-amber-50 text-amber-700 border-amber-200'
      case 'Convertido em venda B2B':
        return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'Convertido em venda direta':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200'
      case 'Cancelado':
        return 'bg-slate-100 text-slate-500 border-slate-200'
      case 'Devolvido':
        return 'bg-amber-100 text-amber-800 border-amber-300'
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200'
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
          <Play className="w-4 h-4 text-teal-600" />
          Teste com Aparelho
        </h3>
        <Button
          size="sm"
          onClick={() => setNewOpen(true)}
          className="bg-teal-500 hover:bg-teal-600 text-white text-xs font-semibold rounded-xl h-9"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Iniciar Teste
        </Button>
      </div>

      {loading ? (
        <p className="text-xs text-slate-400 italic">Carregando testes...</p>
      ) : tests.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
          Nenhum teste de aparelho registrado para este paciente.
        </div>
      ) : (
        <div className="space-y-2">
          {tests.map((t) => (
            <div
              key={t.id}
              className="p-4 rounded-xl border border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900">{t.product_name}</h4>
                  <Badge variant="outline" className={statusBadgeClass(t.status)}>
                    {t.status}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t.brand} {t.model} • Início: {formatDate(t.start_date)} • Orelha: {t.side}
                </p>
                {t.sale_number && (
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Venda: <strong>{t.sale_number}</strong> ({t.sale_type})
                  </p>
                )}
                {t.observations && (
                  <p className="text-[11px] text-slate-600 mt-0.5 italic">{t.observations}</p>
                )}
              </div>

              {t.status === 'Em teste' && (
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    onClick={() => openB2B(t)}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg h-8"
                    title="Vender como B2B"
                  >
                    <Building2 className="w-3.5 h-3.5 mr-1" />
                    Vender como B2B
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => openDireta(t)}
                    className="bg-teal-500 hover:bg-teal-600 text-white text-xs font-semibold rounded-lg h-8"
                    title="Vender Direto (Estoque)"
                  >
                    <ShoppingCart className="w-3.5 h-3.5 mr-1" />
                    Vender Direto
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openDevolver(t)}
                    className="bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200 text-xs font-semibold rounded-lg h-8"
                    title="Devolver ao estoque"
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1" />
                    Devolver ao Estoque
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCancelTest(t)}
                    className="h-8 w-8 p-0 text-red-500 hover:bg-red-50 rounded-lg"
                    title="Cancelar teste"
                  >
                    <XCircle className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal: Novo Teste */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">
              Iniciar Teste com Aparelho
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-semibold text-slate-700">Aparelho do Estoque *</Label>
              <Select value={selItemId} onValueChange={onSelectItem}>
                <SelectTrigger className="h-10 rounded-xl mt-1 text-xs">
                  <SelectValue placeholder="Selecione um aparelho auditivo..." />
                </SelectTrigger>
                <SelectContent>
                  {aparelhosAuditivos.length === 0 ? (
                    <SelectItem value="_empty" disabled>
                      Nenhum aparelho auditivo em estoque
                    </SelectItem>
                  ) : (
                    aparelhosAuditivos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                        {p.brand ? ` — ${p.brand}` : ''}
                        {p.model ? ` ${p.model}` : ''} (Saldo: {p.currentQuantity})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-700">Data de Início</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-10 rounded-xl mt-1 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-700">Orelha Testada</Label>
                <Select value={side} onValueChange={setSide}>
                  <SelectTrigger className="h-10 rounded-xl mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Direito">Direito</SelectItem>
                    <SelectItem value="Esquerdo">Esquerdo</SelectItem>
                    <SelectItem value="Bilateral">Bilateral</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700">Observações</Label>
              <Textarea
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Ajustes iniciais, impressões do paciente durante o teste..."
                rows={3}
                className="rounded-xl mt-1 text-xs border-slate-300"
              />
            </div>
          </div>
          <DialogFooter className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setNewOpen(false)}
              className="rounded-xl text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleCreateTest}
              className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-xs font-semibold"
            >
              <Play className="w-3.5 h-3.5 mr-1" />
              Iniciar Teste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Venda B2B */}
      <Dialog open={b2bOpen} onOpenChange={setB2bOpen}>
        <DialogContent className="max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-700" />
              Vender como B2B
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3 border border-slate-200">
              {b2bTarget?.product_name} — {b2bTarget?.brand} {b2bTarget?.model}
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700">Empresa Parceira *</Label>
              <Select value={b2bEmpresaId} onValueChange={setB2bEmpresaId}>
                <SelectTrigger className="h-10 rounded-xl mt-1 text-xs">
                  <SelectValue placeholder="Selecione a empresa..." />
                </SelectTrigger>
                <SelectContent>
                  {empresasAtivas.length === 0 ? (
                    <SelectItem value="_empty" disabled>
                      Nenhuma empresa ativa
                    </SelectItem>
                  ) : (
                    empresasAtivas.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.razao_social}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-700">Comissão (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={b2bPercentual}
                  onChange={(e) => setB2bPercentual(Number(e.target.value))}
                  className="h-10 rounded-xl mt-1 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-700">Valor de Venda (R$)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={b2bValor}
                  onChange={(e) => setB2bValor(Number(e.target.value))}
                  className="h-10 rounded-xl mt-1 text-xs"
                />
              </div>
            </div>
            <div className="flex items-center justify-between text-xs bg-blue-50 border border-blue-200 rounded-lg p-3">
              <span className="font-semibold text-blue-700">
                Comissão ({(Number(b2bPercentual) || 0).toFixed(2)}%)
              </span>
              <span className="font-bold text-blue-700">
                {formatCurrency(((Number(b2bValor) || 0) * (Number(b2bPercentual) || 0)) / 100)}
              </span>
            </div>
          </div>
          <DialogFooter className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setB2bOpen(false)}
              disabled={savingB2B}
              className="rounded-xl text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmB2B}
              disabled={savingB2B}
              className="bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-semibold"
            >
              <Building2 className="w-3.5 h-3.5 mr-1" />
              {savingB2B ? 'Salvando...' : 'Confirmar Venda B2B'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Venda Direta */}
      <Dialog open={diretaOpen} onOpenChange={setDiretaOpen}>
        <DialogContent className="max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-teal-600" />
              Vender Direto (Estoque)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3 border border-slate-200">
              {diretaTarget?.product_name} — {diretaTarget?.brand} {diretaTarget?.model}
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700">Valor de Venda (R$)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={diretaValor}
                onChange={(e) => setDiretaValor(Number(e.target.value))}
                className="h-10 rounded-xl mt-1 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-700">Desconto (R$)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={diretaDesconto}
                  onChange={(e) => setDiretaDesconto(Number(e.target.value))}
                  className="h-10 rounded-xl mt-1 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-700">Forma de Pagamento</Label>
                <Select
                  value={diretaPagamento}
                  onValueChange={(v) => setDiretaPagamento(v as PDVPaymentMethod)}
                >
                  <SelectTrigger className="h-10 rounded-xl mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="Cartão de Débito">Cartão de Débito</SelectItem>
                    <SelectItem value="Cartão de Crédito">Cartão de Crédito</SelectItem>
                    <SelectItem value="PIX">PIX</SelectItem>
                    <SelectItem value="Boleto">Boleto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs bg-teal-50 border border-teal-200 rounded-lg p-3">
              <span className="font-semibold text-teal-700">Total Líquido</span>
              <span className="font-bold text-teal-700">
                {formatCurrency(
                  Math.max(0, (Number(diretaValor) || 0) - (Number(diretaDesconto) || 0)),
                )}
              </span>
            </div>
          </div>
          <DialogFooter className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDiretaOpen(false)}
              disabled={savingDireta}
              className="rounded-xl text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmDireta}
              disabled={savingDireta}
              className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-xs font-semibold"
            >
              <ShoppingCart className="w-3.5 h-3.5 mr-1" />
              {savingDireta ? 'Salvando...' : 'Confirmar Venda'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Devolver ao Estoque */}
      <Dialog open={devolverOpen} onOpenChange={setDevolverOpen}>
        <DialogContent className="max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-amber-600" />
              Devolver ao Estoque
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3 border border-slate-200">
              {devolverTarget?.product_name} — {devolverTarget?.brand} {devolverTarget?.model}
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700">Motivo da Devolução *</Label>
              <Textarea
                value={devolverMotivo}
                onChange={(e) => setDevolverMotivo(e.target.value)}
                placeholder="Não adaptou ao paciente, paciente preferiu outro modelo, aparelho com defeito..."
                rows={3}
                required
                className="rounded-xl mt-1 text-xs border-slate-300"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                O aparelho retornará ao estoque e o teste será marcado como devolvido.
              </p>
            </div>
          </div>
          <DialogFooter className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDevolverOpen(false)}
              disabled={savingDevolver}
              className="rounded-xl text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmDevolver}
              disabled={savingDevolver}
              className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              {savingDevolver ? 'Salvando...' : 'Confirmar Devolução'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ---------- Subcomponente: Interface de Lançamento no Atendimento (Aba Financeiro) ---------- */
function FinanceiroAtendimentoSection({ patient }: { patient: Patient }) {
  const { appointments, updateAppointment, addSale } = useApp()
  const { toast } = useToast()
  const navigate = useNavigate()

  const today = new Date().toISOString().split('T')[0]

  // Forma de pagamento do atendimento. Quando diferente de "À vista", a
  // venda gera automaticamente uma conta a receber (Convênio/Boleto = 1
  // conta; Parcelado = N contas, uma por parcela).
  const [formaPagamento, setFormaPagamento] = React.useState<PDVPaymentMethod>('Boleto')
  const [parcelas, setParcelas] = React.useState<number>(1)

  // Espelha os valores atuais do seletor em refs para que o
  // `handleFinalizarAtendimento` sempre leia o valor mais recente
  // selecionado pelo usuário, evitando ler um valor obsoleto do estado
  // (stale closure) no momento de chamar `addSale`. Sem isso, a forma de
  // pagamento chegava sempre como "À vista" ao addSale e nenhuma conta a
  // receber era criada para Convênio/Boleto/Parcelado.
  const formaPagamentoRef = React.useRef(formaPagamento)
  React.useEffect(() => {
    formaPagamentoRef.current = formaPagamento
  }, [formaPagamento])
  const parcelasRef = React.useRef(parcelas)
  React.useEffect(() => {
    parcelasRef.current = parcelas
  }, [parcelas])

  // Buscar agendamento do paciente para hoje não cancelado
  const todayAppointment = React.useMemo(() => {
    return appointments.find(
      (a) => a.patientId === patient.id && a.date === today && a.status !== 'Cancelado',
    )
  }, [appointments, patient.id, today])

  // Lista de itens do atendimento
  const [items, setItems] = React.useState<AppointmentProcedureItem[]>([])

  // Carregar do agendamento quando disponível
  React.useEffect(() => {
    if (todayAppointment) {
      if (
        Array.isArray(todayAppointment.proceduresList) &&
        todayAppointment.proceduresList.length > 0
      ) {
        setItems(todayAppointment.proceduresList.map((it) => ({ ...it })))
      } else if (todayAppointment.procedureId || todayAppointment.type) {
        setItems([
          {
            procedureId: todayAppointment.procedureId || '',
            procedureName: todayAppointment.type || 'Consulta / Procedimento',
            value: todayAppointment.value ?? 0,
            planType: todayAppointment.planType || (patient.planType as any) || 'Particular',
          },
        ])
      } else {
        setItems([])
      }
    } else {
      setItems([])
    }
  }, [todayAppointment?.id])

  // Catálogo unificado (procedimentos + estoque)
  const [catalog, setCatalog] = React.useState<
    Array<{
      id: string
      name: string
      type: 'procedure' | 'inventory'
      price: number
      raw: any
    }>
  >([])
  const [loadingCatalog, setLoadingCatalog] = React.useState(false)

  // Carregar coleções 'procedures' e 'inventory'
  React.useEffect(() => {
    let isMounted = true
    async function loadCatalog() {
      setLoadingCatalog(true)
      try {
        const [procRes, invRes] = await Promise.all([
          pb.collection('procedures').getFullList({ filter: 'active = true', sort: 'name' }),
          pb.collection('inventory').getFullList({ sort: 'name' }),
        ])

        if (!isMounted) return

        const plan = (patient.planType as any) || 'Particular'

        const procItems = procRes.map((p: any) => {
          const mappedProc: Procedure = {
            id: p.id,
            name: p.name,
            duration: p.duration,
            value: p.valueParticular ?? p.value ?? 0,
            valueParticular: p.valueParticular ?? p.value ?? 0,
            valueSUS: p.valueSUS ?? 0,
            valueConvenio: p.valueConvenio ?? 0,
            category: p.category,
            active: p.active,
            createdAt: p.created,
            updatedAt: p.updated,
          }
          const price = getProcedureValueByPlan(mappedProc, plan)
          return {
            id: p.id,
            name: p.name,
            type: 'procedure' as const,
            price,
            raw: mappedProc,
          }
        })

        const invItems = invRes.map((i: any) => ({
          id: i.id,
          name: `${i.name}${i.brand ? ` (${i.brand})` : ''}`,
          type: 'inventory' as const,
          price: Number(i.salePrice) || 0,
          raw: i,
        }))

        setCatalog([...procItems, ...invItems])
      } catch (err) {
        console.error('Erro ao carregar catálogo para lançamento financeiro:', err)
      } finally {
        if (isMounted) setLoadingCatalog(false)
      }
    }

    loadCatalog()
    return () => {
      isMounted = false
    }
  }, [patient.planType])

  // Estado do formulário de seleção
  const [selectedItemId, setSelectedItemId] = React.useState('')
  const [searchTerm, setSearchTerm] = React.useState('')

  const filteredCatalog = React.useMemo(() => {
    if (!searchTerm.trim()) return catalog
    const q = searchTerm.toLowerCase()
    return catalog.filter((c) => c.name.toLowerCase().includes(q))
  }, [catalog, searchTerm])

  const [saving, setSaving] = React.useState(false)

  // Total
  const totalValue = React.useMemo(() => {
    return items.reduce((acc, item) => acc + (Number(item.value) || 0), 0)
  }, [items])

  // Função auxiliar para atualizar o agendamento no state global / PB
  const syncAppointment = (newItems: AppointmentProcedureItem[]) => {
    if (!todayAppointment) return
    const total = newItems.reduce((acc, item) => acc + (Number(item.value) || 0), 0)
    updateAppointment(
      todayAppointment.id,
      {
        proceduresList: newItems,
        value: total,
      },
      { ignoreConflict: true },
    )
  }

  // Adicionar item
  const handleAddItem = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!selectedItemId) return

    const catItem = catalog.find((c) => c.id === selectedItemId)
    if (!catItem) return

    const newItem: AppointmentProcedureItem = {
      procedureId: catItem.id,
      procedureName: catItem.name,
      value: catItem.price,
      planType: (patient.planType as any) || 'Particular',
    }

    const updated = [...items, newItem]
    setItems(updated)
    syncAppointment(updated)
    setSelectedItemId('')
    setSearchTerm('')

    toast({
      title: 'Item adicionado',
      description: `${catItem.name} (${formatCurrency(catItem.price)}) adicionado ao atendimento.`,
    })
  }

  // Remover item
  const handleRemoveItem = (index: number) => {
    const updated = items.filter((_, i) => i !== index)
    setItems(updated)
    syncAppointment(updated)

    toast({
      title: 'Item removido',
      description: 'O item foi removido do atendimento.',
    })
  }

  // Finalizar Atendimento e Enviar para Cobrança
  const handleFinalizarAtendimento = async () => {
    if (items.length === 0) {
      toast({
        title: 'Nenhum item adicionado',
        description: 'Adicione ao menos um procedimento ou produto antes de finalizar.',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      const itemsSummary = items
        .map((it) => `${it.procedureName} (${formatCurrency(it.value)})`)
        .join(' + ')

      // Lê o valor mais recente do seletor a partir da ref, garantindo
      // que a forma de pagamento escolhida pelo usuário (e não um valor
      // obsoleto) seja repassada ao addSale. Isso é o que dispara a
      // criação da conta a receber para Convênio/Boleto/Parcelado.
      const formaSelecionada = formaPagamentoRef.current
      const numParcelas =
        formaSelecionada === 'Parcelado' ? Math.max(1, Number(parcelasRef.current) || 1) : 1

      // 1. Criar Venda na coleção sales (e no estado).
      //    O addSale já cria automaticamente as contas a receber quando a
      //    forma de pagamento é Convênio, Boleto ou Parcelado.
      addSale({
        patientId: patient.id,
        patientName: patient.name,
        date: today,
        itemsDescription: itemsSummary,
        totalValue: totalValue,
        paymentMethod: formaSelecionada,
        installmentsCount: numParcelas,
        interestPercent: 0,
        firstDueDate: today,
        status: 'Concluída',
        type: 'atendimento',
      })

      // 2. Atualizar agendamento status = 'Realizado', reception = ''
      if (todayAppointment) {
        updateAppointment(
          todayAppointment.id,
          {
            status: 'Realizado',
            reception: '',
            proceduresList: items,
            value: totalValue,
          },
          { ignoreConflict: true },
        )
      }

      toast({
        title: 'Atendimento finalizado com sucesso!',
        description: `Procedimentos concluídos e atendimento marcado como realizado. Redirecionando para a agenda...`,
      })

      // Redireciona automaticamente para a agenda do dia (Página Inicial '/')
      setTimeout(() => {
        navigate('/')
      }, 800)
    } catch (err) {
      console.error('Erro ao finalizar atendimento:', err)
      toast({
        title: 'Erro ao finalizar',
        description: 'Não foi possível registrar a cobrança. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Banner status do Agendamento de Hoje */}
      {todayAppointment ? (
        <div className="p-4 rounded-xl border border-teal-200 bg-teal-50/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-teal-500 text-white shrink-0">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-slate-900 flex items-center gap-2">
                <span>
                  Agendamento de Hoje ({formatDate(todayAppointment.date)} às{' '}
                  {todayAppointment.time})
                </span>
                <Badge
                  className={
                    todayAppointment.status === 'Realizado'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : 'bg-teal-100 text-teal-800 border-teal-300'
                  }
                >
                  {todayAppointment.status}
                </Badge>
              </div>
              <p className="text-slate-600 mt-0.5">
                Profissional:{' '}
                <span className="font-medium text-slate-800">
                  {todayAppointment.professionalName}
                </span>{' '}
                • Plano:{' '}
                <span className="font-medium text-slate-800">
                  {patient.planType || 'Particular'}
                </span>
              </p>
            </div>
          </div>

          <div className="text-right sm:text-right shrink-0">
            <span className="text-[11px] text-slate-500 block">Total Efetivado</span>
            <span className="text-sm font-extrabold text-teal-700">
              {formatCurrency(totalValue)}
            </span>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/70 flex items-center gap-3 text-xs text-amber-800">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <p className="font-bold">
              Nenhum agendamento ativo encontrado para hoje ({formatDate(today)}).
            </p>
            <p className="text-[11px] text-amber-700">
              Você ainda pode adicionar itens abaixo. Ao finalizar, será gerada uma venda no módulo
              de Finanças/Recepção para o paciente.
            </p>
          </div>
        </div>
      )}

      {/* Formulário de Lançamento */}
      <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-4">
        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <Plus className="w-4 h-4 text-teal-600" />
          Lançamento de Procedimentos e Produtos
        </h4>

        <form onSubmit={handleAddItem} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          {/* Busca / Seleção de Item */}
          <div className="md:col-span-9 space-y-1">
            <Label className="text-xs font-semibold text-slate-700">
              Selecionar Procedimento (Serviços/Exames) ou Item de Estoque (Produtos)
            </Label>
            <Select value={selectedItemId} onValueChange={setSelectedItemId}>
              <SelectTrigger className="h-10 rounded-xl text-xs border-slate-300">
                <SelectValue
                  placeholder={
                    loadingCatalog
                      ? 'Carregando catálogo...'
                      : 'Selecione um procedimento ou produto...'
                  }
                />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                <div className="p-2 border-b border-slate-100">
                  <Input
                    placeholder="Filtrar itens..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-8 text-xs rounded-lg"
                  />
                </div>
                {filteredCatalog.length === 0 ? (
                  <div className="p-3 text-center text-xs text-slate-400">
                    Nenhum item encontrado
                  </div>
                ) : (
                  filteredCatalog.map((item) => (
                    <SelectItem key={item.id} value={item.id} className="text-xs">
                      <div className="flex items-center justify-between w-full gap-4">
                        <span className="font-medium text-slate-800">
                          {item.type === 'inventory' ? '📦 ' : '🩺 '}
                          {item.name}
                        </span>
                        <span className="font-bold text-teal-700 shrink-0">
                          {formatCurrency(item.price)}
                        </span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Botão Adicionar */}
          <div className="md:col-span-3">
            <Button
              type="submit"
              disabled={!selectedItemId}
              className="w-full h-10 bg-teal-500 hover:bg-teal-600 text-white font-semibold text-xs rounded-xl shadow-sm flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Adicionar Item
            </Button>
          </div>
        </form>

        {/* Tabela compacta dos itens do atendimento atual */}
        <div className="mt-4 border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                <th className="py-2.5 px-3.5">Item / Procedimento</th>
                <th className="py-2.5 px-3.5 text-center">Plano</th>
                <th className="py-2.5 px-3.5 text-right">Valor Unitário</th>
                <th className="py-2.5 px-3.5 text-center">Qtd</th>
                <th className="py-2.5 px-3.5 text-right">Subtotal</th>
                <th className="py-2.5 px-3.5 text-center w-12">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                    Nenhum procedimento ou produto adicionado a este atendimento ainda.
                  </td>
                </tr>
              ) : (
                items.map((item, index) => (
                  <tr
                    key={`${item.procedureId}-${index}`}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="py-2.5 px-3.5 font-semibold text-slate-800">
                      {item.procedureName}
                    </td>
                    <td className="py-2.5 px-3.5 text-center">
                      <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-700">
                        {item.planType || patient.planType || 'Particular'}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3.5 text-right text-slate-600 font-mono">
                      {formatCurrency(item.value)}
                    </td>
                    <td className="py-2.5 px-3.5 text-center font-medium text-slate-700">1</td>
                    <td className="py-2.5 px-3.5 text-right font-bold text-slate-900 font-mono">
                      {formatCurrency(item.value)}
                    </td>
                    <td className="py-2.5 px-3.5 text-center">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveItem(index)}
                        className="h-7 w-7 p-0 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="bg-teal-50/80 border-t-2 border-teal-200 text-slate-900 font-extrabold">
                <td
                  colSpan={4}
                  className="py-3 px-3.5 text-right text-xs uppercase tracking-wider text-teal-900"
                >
                  Valor Total do Atendimento:
                </td>
                <td className="py-3 px-3.5 text-right text-sm text-teal-800 font-mono">
                  {formatCurrency(totalValue)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Forma de Pagamento */}

      {/* Botão Finalizar Atendimento */}
      <div className="flex items-center justify-end pt-2">
        <Button
          onClick={handleFinalizarAtendimento}
          disabled={saving || items.length === 0}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl h-11 px-6 shadow-md transition-all flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4" />
          Finalizar Atendimento e Enviar para Cobrança ({formatCurrency(totalValue)})
        </Button>
      </div>
    </div>
  )
}
