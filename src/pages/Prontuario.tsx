import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '@/context/AppContext'
import {
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  FileText,
  Activity,
  Ear,
  DollarSign,
  Plus,
  ArrowLeft,
  Clock,
  ShieldCheck,
  CheckCircle,
  Pencil,
  Trash2,
  Stethoscope,
  ChevronRight,
  Zap,
} from 'lucide-react'
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
    budgets,
    sales,
    installments,
  } = useApp()

  const patient = getPatient(id || '')

  // Tab State
  const [activeTab, setActiveTab] = useState('clinicos')

  // Modais de Exames
  const [audioModalOpen, setAudioModalOpen] = useState(false)
  const [tympModalOpen, setTympModalOpen] = useState(false)
  const [beraModalOpen, setBeraModalOpen] = useState(false)

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

  const handleDeleteItem = () => {
    if (!deleteTarget) return
    if (deleteTarget.type === 'evolution') deleteEvolution(deleteTarget.id)
    if (deleteTarget.type === 'audiometry') deleteAudiometry(deleteTarget.id)
    if (deleteTarget.type === 'tympanometry') deleteTympanometry(deleteTarget.id)
    if (deleteTarget.type === 'bera') deleteBera(deleteTarget.id)
    setDeleteTarget(null)
  }

  const patientAge = calculateAge(patient.birthDate)

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Barra de Topo com Botão Voltar */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => navigate('/pacientes')}
          className="text-xs font-semibold text-slate-600 hover:text-slate-900 -ml-2"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Voltar para Lista de Pacientes
        </Button>

        <div className="flex items-center gap-2">
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
          <span className="text-xs text-slate-400">ID: {patient.id}</span>
        </div>
      </div>

      {/* Grid Principal: Ficha do Paciente (30%) + Prontuário em Abas (70%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* COLUNA ESQUERDA: FICHA DO PACIENTE (30% -> col-span-4) */}
        <div className="lg:col-span-4 space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
            {/* Avatar & Nome */}
            <div className="text-center pb-5 border-b border-slate-100">
              <div
                className={`w-20 h-20 rounded-full ${getAvatarColor(
                  patient.name,
                )} text-white flex items-center justify-center font-extrabold text-2xl mx-auto shadow-md ring-4 ring-blue-50`}
              >
                {getInitials(patient.name)}
              </div>
              <h2 className="text-lg font-bold text-slate-900 mt-3">{patient.name}</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {patientAge ? `${patientAge} anos` : 'Idade N/I'} • {patient.gender}
              </p>
            </div>

            {/* Informações de Contato e Documento */}
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-500 font-medium">CPF:</span>
                <span className="font-mono font-bold text-slate-800">{maskCPF(patient.cpf)}</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-500 font-medium">Celular:</span>
                <span className="font-bold text-blue-700">{patient.mobile || '—'}</span>
              </div>
              {patient.phone && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-500 font-medium">Fixo:</span>
                  <span className="text-slate-700">{patient.phone}</span>
                </div>
              )}
              {patient.email && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-500 font-medium">E-mail:</span>
                  <span className="text-slate-700 truncate max-w-[170px]">{patient.email}</span>
                </div>
              )}
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-500 font-medium">Convênio:</span>
                <span className="font-semibold text-slate-800">
                  {patient.planType === 'Convênio' ? patient.planName || 'Convênio' : 'Particular'}
                </span>
              </div>
              <div className="flex items-start justify-between py-1">
                <span className="text-slate-500 font-medium">Endereço:</span>
                <span className="text-slate-700 text-right max-w-[170px]">
                  {patient.street}, {patient.number} - {patient.city}/{patient.state}
                </span>
              </div>
            </div>

            {/* Ações Rápidas da Coluna Esquerda */}
            <div className="pt-4 border-t border-slate-100 space-y-2">
              <Button
                onClick={() => {
                  setEvoModalOpen(true)
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold h-10 shadow-sm flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Nova Evolução
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  navigate('/agenda')
                }}
                className="w-full rounded-xl border-slate-300 text-slate-700 text-xs font-semibold h-10 hover:bg-slate-50"
              >
                <Calendar className="w-4 h-4 mr-1.5 text-blue-600" />
                Agendar Atendimento
              </Button>
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA: PRONTUÁRIO COM ABAS (70% -> col-span-8) */}
        <div className="lg:col-span-8">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid grid-cols-2 sm:grid-cols-5 bg-slate-100 p-1 rounded-xl h-auto gap-1">
                <TabsTrigger value="clinicos" className="text-xs font-semibold py-2 rounded-lg">
                  Dados Clínicos
                </TabsTrigger>
                <TabsTrigger value="evolucao" className="text-xs font-semibold py-2 rounded-lg">
                  Evolução ({patientEvolutions.length})
                </TabsTrigger>
                <TabsTrigger value="exames" className="text-xs font-semibold py-2 rounded-lg">
                  Exames (
                  {patientAudiometries.length + patientTympanometries.length + patientBeras.length})
                </TabsTrigger>
                <TabsTrigger value="aparelhos" className="text-xs font-semibold py-2 rounded-lg">
                  Aparelhos ({patientAids.length})
                </TabsTrigger>
                <TabsTrigger
                  value="financeiro"
                  className="text-xs font-semibold py-2 rounded-lg col-span-2 sm:col-span-1"
                >
                  Financeiro
                </TabsTrigger>
              </TabsList>

              {/* 1. ABA DADOS CLÍNICOS */}
              <TabsContent value="clinicos" className="space-y-4 pt-4">
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
                      <Label className="text-xs font-bold text-slate-800">
                        Conduta Terapêutica
                      </Label>
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

              {/* 2. ABA EVOLUÇÃO (Linha do Tempo Vertical) */}
              <TabsContent value="evolucao" className="space-y-4 pt-4">
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

              {/* 3. ABA EXAMES */}
              <TabsContent value="exames" className="space-y-6 pt-4">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900">
                    Histórico de Exames Audiológicos
                  </h3>
                  <div className="flex items-center gap-2">
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

                        {exam.notes && (
                          <p className="text-xs text-slate-600 italic">{exam.notes}</p>
                        )}
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
                    <p className="text-xs text-slate-400 italic">
                      Nenhuma imitanciometria registrada.
                    </p>
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

              {/* 4. ABA APARELHOS AUDITIVOS */}
              <TabsContent value="aparelhos" className="space-y-4 pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">
                    Aparelhos Auditivos do Paciente
                  </h3>
                  <Button
                    size="sm"
                    onClick={() => navigate('/aparelhos')}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl h-9"
                  >
                    + Vincular Aparelho
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
                          className="bg-blue-50 text-blue-700 border-blue-200"
                        >
                          {aid.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* 5. ABA FINANCEIRO DO PACIENTE */}
              <TabsContent value="financeiro" className="space-y-4 pt-4">
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
                            <span className="text-slate-500 ml-2">
                              {formatCurrency(b.totalValue)}
                            </span>
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
            </Tabs>
          </div>
        </div>
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

      {/* Modais de Exames */}
      <AudiometryModal
        open={audioModalOpen}
        onOpenChange={setAudioModalOpen}
        patient={patient}
        onSave={addAudiometry}
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
