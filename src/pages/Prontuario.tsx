import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
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
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { CompareAudiometriesModal } from '@/components/CompareAudiometriesModal'
import { usePrint } from '@/components/print/PrintProvider'
import {
  PatientFichaPrint,
  AudiometryPrint,
  TympanometryPrint,
  BeraPrint,
} from '@/components/print/PrintDocuments'
import {
  formatDate,
  formatCurrency,
  maskCPF,
  getInitials,
  getAvatarColor,
  calculateAge,
} from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AudiometryModal } from '@/components/AudiometryModal'
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
    addAudiometry,
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
  } = useApp()

  const patient = getPatient(id || '')

  // Tab State
  const [activeTab, setActiveTab] = useState('cadastrais')

  // Modais de Exames
  const [audioModalOpen, setAudioModalOpen] = useState(false)
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
  const [evoProf, setEvoProf] = useState('Dra. Mariana Silva Costa')
  const [evoDesc, setEvoDesc] = useState('')

  // Confirmação de Exclusão
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{
    type: string
    id: string
    name: string
  } | null>(null)

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

  const examsCount = patientAudiometries.length + patientTympanometries.length + patientBeras.length

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

  const handleSaveAppointment = (data: any) => {
    const res = addAppointment(data)
    return res.success
  }

  const handleSaveAid = (data: any) => {
    addHearingAid(data)
  }

  const handleDeleteItem = () => {
    if (!deleteTarget) return
    if (deleteTarget.type === 'evolution') deleteEvolution(deleteTarget.id)
    if (deleteTarget.type === 'audiometry') deleteAudiometry(deleteTarget.id)
    if (deleteTarget.type === 'tympanometry') deleteTympanometry(deleteTarget.id)
    if (deleteTarget.type === 'bera') deleteBera(deleteTarget.id)
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
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Cabeçalho: Botão Voltar + Ações + Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-full ${getAvatarColor(
              patient.name,
            )} text-white flex items-center justify-center font-extrabold text-base shadow-md ring-4 ring-blue-50 shrink-0`}
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
                    : 'bg-blue-50 text-blue-700 border-blue-200 font-bold text-[10px]'
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
            onClick={() => setAppointmentModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold h-10 shadow-sm flex items-center gap-1.5"
          >
            <Calendar className="w-4 h-4" />
            Agendar Atendimento
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              print({
                title: 'Ficha do Paciente',
                subtitle: patient.name,
                body: (
                  <PatientFichaPrint
                    patient={patient}
                    record={existingRecord}
                    evolutions={patientEvolutions}
                  />
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
            <TabsTrigger value="prontuario" className="text-xs font-semibold py-2 rounded-lg">
              Prontuário
            </TabsTrigger>
            <TabsTrigger value="exames" className="text-xs font-semibold py-2 rounded-lg">
              Exames ({examsCount})
            </TabsTrigger>
            <TabsTrigger value="aparelhos" className="text-xs font-semibold py-2 rounded-lg">
              Aparelhos ({patientAids.length})
            </TabsTrigger>
            <TabsTrigger value="financeiro" className="text-xs font-semibold py-2 rounded-lg">
              Financeiro
            </TabsTrigger>
            <TabsTrigger value="evolucao" className="text-xs font-semibold py-2 rounded-lg">
              Evolução ({patientEvolutions.length})
            </TabsTrigger>
          </TabsList>

          {/* 1. ABA DADOS CADASTRAIS */}
          <TabsContent value="cadastrais" className="space-y-5 pt-5">
            {/* Cabeçalho do paciente */}
            <div className="flex flex-col sm:flex-row items-center gap-4 pb-5 border-b border-slate-100">
              <div
                className={`w-20 h-20 rounded-full ${getAvatarColor(
                  patient.name,
                )} text-white flex items-center justify-center font-extrabold text-2xl shadow-md ring-4 ring-blue-50 shrink-0`}
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
                        : 'bg-blue-50 text-blue-700 border-blue-200 font-bold'
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
                  <User className="w-4 h-4 text-blue-600" />
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
                  <Phone className="w-4 h-4 text-blue-600" />
                  Contato
                </h3>
                <InfoRow label="Celular" value={patient.mobile || '—'} highlight />
                <InfoRow label="Telefone Fixo" value={patient.phone || '—'} />
                <InfoRow label="E-mail" value={patient.email || '—'} />
              </div>

              {/* Convênio */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 pb-1.5 border-b border-slate-200">
                  <CreditCard className="w-4 h-4 text-blue-600" />
                  Convênio / Pagamento
                </h3>
                <InfoRow
                  label="Tipo"
                  value={
                    patient.planType === 'Convênio' ? patient.planName || 'Convênio' : 'Particular'
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
                  <MapPin className="w-4 h-4 text-blue-600" />
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
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
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
                  <Ear className="w-4 h-4 text-blue-600" />
                  Histórico Auditivo
                </h3>
                <InfoRow label="Tipo de Perda Auditiva" value={patient.hearingLossType} highlight />
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
                    <p className="text-xs text-slate-700 leading-relaxed">{patient.generalNotes}</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* 2. ABA PRONTUÁRIO (Dados Clínicos) */}
          <TabsContent value="prontuario" className="space-y-4 pt-5">
            <form onSubmit={handleSaveClinicalRecord} className="space-y-4">
              <div>
                <Label className="text-xs font-bold text-slate-800">Queixa Principal</Label>
                <Textarea
                  value={mainComplaint}
                  onChange={(e) => setMainComplaint(e.target.value)}
                  placeholder="Relato espontâneo do paciente quanto à sua audição..."
                  rows={2}
                  className="rounded-xl mt-1 text-xs border-slate-300"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-800">Anamnese Geral</Label>
                <Textarea
                  value={anamnesis}
                  onChange={(e) => setAnamnesis(e.target.value)}
                  placeholder="Início dos sintomas, evolução temporal, episódios de tontura/vertigem..."
                  rows={2}
                  className="rounded-xl mt-1 text-xs border-slate-300"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-bold text-slate-800">
                    Histórico Auditivo e Ocupacional
                  </Label>
                  <Textarea
                    value={hearingHistory}
                    onChange={(e) => setHearingHistory(e.target.value)}
                    placeholder="Exposição a ruído, histórico de otites, cirurgias..."
                    rows={2}
                    className="rounded-xl mt-1 text-xs border-slate-300"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold text-slate-800">Medicações em Uso</Label>
                  <Textarea
                    value={currentMedications}
                    onChange={(e) => setCurrentMedications(e.target.value)}
                    placeholder="Anti-hipertensivos, ototóxicos, ansiolíticos..."
                    rows={2}
                    className="rounded-xl mt-1 text-xs border-slate-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-bold text-slate-800">
                    Antecedentes Familiares
                  </Label>
                  <Textarea
                    value={familyHistory}
                    onChange={(e) => setFamilyHistory(e.target.value)}
                    placeholder="Histórico familiar de perda auditiva precoce..."
                    rows={2}
                    className="rounded-xl mt-1 text-xs border-slate-300"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold text-slate-800">
                    Diagnóstico Audiológico
                  </Label>
                  <Textarea
                    value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)}
                    placeholder="Perda neurossensorial, mista, condutiva..."
                    rows={2}
                    className="rounded-xl mt-1 text-xs border-slate-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <Label className="text-xs font-bold text-slate-800">Conduta Terapêutica</Label>
                  <Textarea
                    value={conduct}
                    onChange={(e) => setConduct(e.target.value)}
                    placeholder="Indicação de amplificação sonora, encaminhamentos..."
                    rows={2}
                    className="rounded-xl mt-1 text-xs border-slate-300"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold text-slate-800">Próximo Retorno</Label>
                  <Input
                    type="date"
                    value={nextReturn}
                    onChange={(e) => setNextReturn(e.target.value)}
                    className="h-10 rounded-xl mt-1 text-xs border-slate-300"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-100">
                <Button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm px-6"
                >
                  Salvar Prontuário Clínico
                </Button>
              </div>
            </form>
          </TabsContent>

          {/* 3. ABA EXAMES */}
          <TabsContent value="exames" className="space-y-6 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Histórico de Exames Audiológicos</h3>
              <div className="flex items-center gap-2">
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span tabIndex={0} className="inline-flex">
                        <Button
                          size="sm"
                          disabled={patientAudiometries.length < 2}
                          onClick={() => setCompareModalOpen(true)}
                          className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl h-8 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ArrowUpDown className="w-3.5 h-3.5 mr-1" />
                          Comparar Audiometrias
                        </Button>
                      </span>
                    </TooltipTrigger>
                    {patientAudiometries.length < 2 && (
                      <TooltipContent className="max-w-[220px] text-xs">
                        São necessárias pelo menos 2 audiometrias para comparar
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
                <Button
                  size="sm"
                  onClick={() => setAudioModalOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl h-8"
                >
                  + Audiometria
                </Button>
                <Button
                  size="sm"
                  onClick={() => setTympModalOpen(true)}
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
            </div>

            {/* Audiometrias */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-blue-700 flex items-center gap-1.5">
                <Activity className="w-4 h-4" />
                Audiometrias Tonais & Vocais ({patientAudiometries.length})
              </h4>
              {patientAudiometries.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Nenhuma audiometria registrada.</p>
              ) : (
                patientAudiometries.map((exam) => (
                  <div
                    key={exam.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-extrabold text-slate-900">
                          Audiometria em {formatDate(exam.date)}
                        </span>
                        <span className="text-xs text-slate-500 ml-2">
                          Examinador: {exam.professionalName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-blue-50 text-blue-700 border-blue-200">
                          {exam.lossDegree} • {exam.lossType}
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            print({
                              title: 'Laudo Audiometrico',
                              subtitle: `${patient.name} — ${formatDate(exam.date)}`,
                              body: <AudiometryPrint exam={exam} />,
                            })
                          }
                          className="h-7 w-7 p-0 text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="Imprimir laudo"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setDeleteTarget({
                              type: 'audiometry',
                              id: exam.id,
                              name: `Audiometria de ${formatDate(exam.date)}`,
                            })
                            setDeleteConfirmOpen(true)
                          }}
                          className="h-7 w-7 p-0 text-red-500 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-white p-2.5 rounded-lg border border-slate-200">
                      <div>
                        SRT OD: <strong>{exam.srtOD ?? '—'} dB</strong>
                      </div>
                      <div>
                        SRT OE: <strong>{exam.srtOE ?? '—'} dB</strong>
                      </div>
                      <div>
                        IPRF OD: <strong>{exam.iprfOD ?? '—'}%</strong>
                      </div>
                      <div>
                        IPRF OE: <strong>{exam.iprfOE ?? '—'}%</strong>
                      </div>
                    </div>

                    {exam.notes && <p className="text-xs text-slate-600 italic">{exam.notes}</p>}
                  </div>
                ))
              )}
            </div>

            {/* Imitanciometrias */}
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                <Activity className="w-4 h-4" />
                Imitanciometrias ({patientTympanometries.length})
              </h4>
              {patientTympanometries.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Nenhuma imitanciometria registrada.</p>
              ) : (
                patientTympanometries.map((exam) => (
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
                              body: <TympanometryPrint exam={exam} />,
                            })
                          }
                          className="h-7 w-7 p-0 text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="Imprimir laudo"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </Button>
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
                ))
              )}
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
                              body: <BeraPrint exam={exam} />,
                            })
                          }
                          className="h-7 w-7 p-0 text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="Imprimir laudo"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </Button>
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
                      </div>
                    </div>
                    {exam.notes && <p className="text-xs text-slate-700">{exam.notes}</p>}
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          {/* 4. ABA APARELHOS */}
          <TabsContent value="aparelhos" className="space-y-4 pt-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Aparelhos Auditivos do Paciente</h3>
              <Button
                size="sm"
                onClick={() => setAidModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl h-9"
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
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                      {aid.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* 5. ABA FINANCEIRO */}
          <TabsContent value="financeiro" className="space-y-4 pt-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Histórico Financeiro</h3>
              <Button
                size="sm"
                onClick={() => navigate('/financeiro')}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl h-9"
              >
                + Novo Orçamento / Venda
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Orçamentos */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Orçamentos ({patientBudgets.length})
                </h4>
                {patientBudgets.length === 0 ? (
                  <p className="text-xs text-slate-400">Nenhum orçamento emitido.</p>
                ) : (
                  patientBudgets.map((b) => (
                    <div
                      key={b.id}
                      className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-slate-800">#{b.number}</span>
                        <span className="text-slate-500 ml-2">{formatCurrency(b.totalValue)}</span>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {b.status}
                      </Badge>
                    </div>
                  ))
                )}
              </div>

              {/* Parcelas */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Parcelas ({patientInstallments.length})
                </h4>
                {patientInstallments.length === 0 ? (
                  <p className="text-xs text-slate-400">Nenhuma parcela cadastrada.</p>
                ) : (
                  patientInstallments.map((inst) => (
                    <div
                      key={inst.id}
                      className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-slate-800">
                          {inst.installmentNumber}/{inst.totalInstallments}
                        </span>
                        <span className="text-slate-500 ml-2">
                          {formatCurrency(inst.value)} • Venc: {formatDate(inst.dueDate)}
                        </span>
                      </div>
                      <Badge
                        className={`text-[10px] ${
                          inst.status === 'Pago'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : inst.status === 'Atrasado'
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {inst.status}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </div>
          </TabsContent>

          {/* 6. ABA EVOLUÇÃO */}
          <TabsContent value="evolucao" className="space-y-4 pt-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Linha do Tempo de Evoluções Clínicas
              </h3>
              <Button
                size="sm"
                onClick={() => setEvoModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl h-9"
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
              <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-blue-200">
                {patientEvolutions.map((evo) => (
                  <div key={evo.id} className="relative group">
                    {/* Ponto na timeline */}
                    <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-blue-600 ring-4 ring-blue-100" />

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
                    <SelectItem value="Dra. Mariana Silva Costa">
                      Dra. Mariana Silva Costa
                    </SelectItem>
                    <SelectItem value="Dr. Lucas Ferreira Santos">
                      Dr. Lucas Ferreira Santos
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">
                Descrição do Atendimento
              </Label>
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
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold"
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

      {/* Modais de Exames */}
      <AudiometryModal
        open={audioModalOpen}
        onOpenChange={setAudioModalOpen}
        patient={patient}
        onSave={addAudiometry}
      />

      {/* Modal Comparar Audiometrias */}
      <CompareAudiometriesModal
        open={compareModalOpen}
        onOpenChange={setCompareModalOpen}
        audiometries={patientAudiometries}
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
    </div>
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
          highlight ? 'font-bold text-blue-700' : 'font-semibold text-slate-800'
        } ${mono ? 'font-mono' : ''}`}
      >
        {value}
      </span>
    </div>
  )
}
