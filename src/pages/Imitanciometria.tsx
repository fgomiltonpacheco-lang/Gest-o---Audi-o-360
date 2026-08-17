import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '@/context/AppContext'
import { useToast } from '@/hooks/use-toast'
import { usePrint } from '@/components/print/PrintProvider'
import { ImitanciometriaPrint, type ImitPrintData } from '@/components/print/ImitanciometriaPrint'
import pb from '@/lib/pocketbase/client'
import { ClientResponseError } from 'pocketbase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ArrowLeft,
  Save,
  Printer,
  Activity,
  Wand2,
  Loader2,
  CheckCircle2,
  FileEdit,
  Eye,
  Download,
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { calculateAge, formatDate, maskCPF } from '@/lib/formatters'
import logoImg from '@/assets/audicao-360-logo-para-papel-timbrado-da364.png'
import { Equipment } from '@/types'

const SPECIALIST_NAME = 'MILTON SOARES PACHECO'
const SPECIALIST_CRFA = '3-11981-5'
const CLINIC_ADDRESS = 'R. Sadoc Correa, 373 - St. Central, Araguaína - TO, 77803-060'
const CLINIC_PHONE = '(63) 3421-2611'

const TIPOS_CURVA = ['A', 'Ad', 'As', 'B', 'C', 'Ad/As'] as const
type TipoCurva = (typeof TIPOS_CURVA)[number]

const REFLEXOS_STATUS_OPTS = ['Normal', 'Reduzido', 'Ausente'] as const

const DEFAULT_REFERENCIAS =
  'Avaliação imitanciométrica baseada em Jerger (1970); Margolis e Heller (1987) para valores de normalidade; ' +
  'classificação das curvas timpanométricas segundo Jerger (1970); reflexos acústicos segundo Stach (1998).'

/* ---------- Tipos locais ---------- */
interface TimpData {
  id?: string
  orelha: 'OD' | 'OE'
  volume_meato: number | null
  complacencia: number | null
  pressao_maxima: number | null
  tipo_curva: string
  pressao_pico: number | null
  gradiente_curva: number | null
  curva_descricao: string
  observacoes: string
}

interface ReflexData {
  id?: string
  orelha: 'OD' | 'OE'
  via: 'contra_lateral' | 'ipsi_lateral'
  frequencia_500: number | null
  frequencia_1000: number | null
  frequencia_2000: number | null
  frequencia_4000: number | null
  status: string
}

interface ExamState {
  id?: string
  data_exame: string
  especialista_id: string
  especialista_nome: string
  equipment_id: string
  equipment_nome: string
  observacoes: string
  status: 'rascunho' | 'finalizado'
  tipo_curva_od: string
  tipo_curva_oe: string
  reflexos_status: string
  laudo: string
  referencias: string
  encaminhado_por: string
  meatoscopia_od_normal: boolean
  meatoscopia_od_alterada: boolean
  meatoscopia_od_obs: string
  meatoscopia_oe_normal: boolean
  meatoscopia_oe_alterada: boolean
  meatoscopia_oe_obs: string
  // denormalizados paciente
  paciente_nome: string
  paciente_cpf: string
  paciente_nascimento: string
  paciente_idade: string
  paciente_sexo: string
}

function emptyTimp(orelha: 'OD' | 'OE'): TimpData {
  return {
    orelha,
    volume_meato: null,
    complacencia: null,
    pressao_maxima: null,
    tipo_curva: '',
    pressao_pico: null,
    gradiente_curva: null,
    curva_descricao: '',
    observacoes: '',
  }
}

function emptyReflex(orelha: 'OD' | 'OE', via: 'contra_lateral' | 'ipsi_lateral'): ReflexData {
  return {
    orelha,
    via,
    frequencia_500: null,
    frequencia_1000: null,
    frequencia_2000: null,
    frequencia_4000: null,
    status: '',
  }
}

function numOr(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return isNaN(n) ? null : n
}

/* ---------- Laudo automático ---------- */
function describeCurva(tipo: string, lado: string): string {
  const t = (tipo || '').trim()
  const base = `Curva timpanométrica à ${lado}: `
  switch (t) {
    case 'A':
      return base + 'Tipo A — mobilidade do sistema tympano-ossicular dentro da normalidade.'
    case 'Ad':
      return (
        base +
        'Tipo Ad — hipermobilidade do sistema tympano-ossicular, sugestiva de desarticulação ou flacidez da cadeia ossicular.'
      )
    case 'As':
      return (
        base +
        'Tipo As — redução da mobilidade do sistema tympano-ossicular, sugestiva de otoesclerose ou fixação ossicular.'
      )
    case 'B':
      return (
        base +
        'Tipo B — curva plana, sugestiva de presença de líquido na orelha média (otite média secretora) ou perfuração timpânica.'
      )
    case 'C':
      return base + 'Tipo C — pressão negativa na orelha média, sugestiva de disfunção tubária.'
    case 'Ad/As':
      return base + 'Tipo Ad/As — variabilidade de complacência, avaliar em conjunto com a clínica.'
    default:
      return ''
  }
}

function describeReflexos(status: string): string {
  switch (status) {
    case 'Normal':
      return 'Reflexos acústicos presentes em níveis normais bilateralmente.'
    case 'Reduzido':
      return 'Reflexos acústicos reduzidos/elevados bilateralmente, sugestivos de alteração funcional.'
    case 'Ausente':
      return 'Reflexos acústicos ausentes bilateralmente, a serem correlacionados com os achados timpanométricos e audiológicos.'
    default:
      return 'Reflexos acústicos a serem avaliados conforme registro nas frequências estudadas.'
  }
}

function buildSuggestedLaudo(tipoOD: string, tipoOE: string, reflexos: string): string {
  const parts: string[] = []
  const d = describeCurva(tipoOD, 'direita')
  if (d) parts.push(d)
  const e = describeCurva(tipoOE, 'esquerda')
  if (e) parts.push(e)
  parts.push(describeReflexos(reflexos))
  return parts.filter(Boolean).join(' ')
}

/* ---------- Componente ---------- */
export default function Imitanciometria() {
  const { id, examId } = useParams<{ id: string; examId?: string }>()
  const navigate = useNavigate()
  const { getPatient, currentUser, equipments, clinicSettings } = useApp()
  const { toast } = useToast()
  const { print } = usePrint()

  const patient = getPatient(id || '')
  const isSecretaria = currentUser?.role === 'secretaria'
  const isNew = !examId || examId === 'novo'

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)

  const today = new Date().toISOString().slice(0, 10)

  const [exam, setExam] = useState<ExamState>(() => ({
    data_exame: today,
    especialista_id: currentUser?.id || '',
    especialista_nome: currentUser?.name || SPECIALIST_NAME,
    equipment_id: '',
    equipment_nome: '',
    observacoes: '',
    status: 'rascunho',
    tipo_curva_od: '',
    tipo_curva_oe: '',
    reflexos_status: '',
    laudo: '',
    referencias: DEFAULT_REFERENCIAS,
    encaminhado_por: '',
    meatoscopia_od_normal: false,
    meatoscopia_od_alterada: false,
    meatoscopia_od_obs: '',
    meatoscopia_oe_normal: false,
    meatoscopia_oe_alterada: false,
    meatoscopia_oe_obs: '',
    paciente_nome: patient?.name || '',
    paciente_cpf: patient?.cpf || '',
    paciente_nascimento: patient?.birthDate || '',
    paciente_idade: patient ? String(calculateAge(patient.birthDate) ?? '') : '',
    paciente_sexo: patient?.gender || '',
  }))

  const [timpOD, setTimpOD] = useState<TimpData>(emptyTimp('OD'))
  const [timpOE, setTimpOE] = useState<TimpData>(emptyTimp('OE'))
  const [reflexODContra, setReflexODContra] = useState<ReflexData>(
    emptyReflex('OD', 'contra_lateral'),
  )
  const [reflexODIpsi, setReflexODIpsi] = useState<ReflexData>(emptyReflex('OD', 'ipsi_lateral'))
  const [reflexOEContra, setReflexOEContra] = useState<ReflexData>(
    emptyReflex('OE', 'contra_lateral'),
  )
  const [reflexOEIpsi, setReflexOEIpsi] = useState<ReflexData>(emptyReflex('OE', 'ipsi_lateral'))

  // Pré-preenche dados do paciente ao criar novo
  useEffect(() => {
    if (isNew && patient) {
      const age = calculateAge(patient.birthDate)
      setExam((prev) => ({
        ...prev,
        paciente_nome: patient.name,
        paciente_cpf: patient.cpf || '',
        paciente_nascimento: patient.birthDate || '',
        paciente_idade: age !== null ? String(age) : '',
        paciente_sexo: patient.gender || '',
      }))
    }
  }, [patient?.id, isNew])

  // Pré-seleciona equipamento único
  useEffect(() => {
    if (equipments.length === 1 && !exam.equipment_id) {
      const eq = equipments[0]
      setExam((prev) => ({ ...prev, equipment_id: eq.id, equipment_nome: eq.nome }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipments])

  const loadExam = useCallback(async () => {
    if (!examId || examId === 'novo') return
    setLoading(true)
    try {
      const rec: any = await pb.collection('imitanciometrias').getOne(examId)
      setExam({
        id: rec.id,
        data_exame: rec.data_exame || today,
        especialista_id: rec.especialista_id || '',
        especialista_nome: rec.especialista_nome || SPECIALIST_NAME,
        equipment_id: rec.equipment_id || '',
        equipment_nome: rec.equipment_nome || '',
        observacoes: rec.observacoes || '',
        status: rec.status || 'rascunho',
        tipo_curva_od: rec.tipo_curva_od || '',
        tipo_curva_oe: rec.tipo_curva_oe || '',
        reflexos_status: rec.reflexos_status || '',
        laudo: rec.laudo || '',
        referencias: rec.referencias || DEFAULT_REFERENCIAS,
        encaminhado_por: rec.encaminhado_por || '',
        meatoscopia_od_normal: !!rec.meatoscopia_od_normal,
        meatoscopia_od_alterada: !!rec.meatoscopia_od_alterada,
        meatoscopia_od_obs: rec.meatoscopia_od_obs || '',
        meatoscopia_oe_normal: !!rec.meatoscopia_oe_normal,
        meatoscopia_oe_alterada: !!rec.meatoscopia_oe_alterada,
        meatoscopia_oe_obs: rec.meatoscopia_oe_obs || '',
        paciente_nome: rec.paciente_nome || '',
        paciente_cpf: rec.paciente_cpf || '',
        paciente_nascimento: rec.paciente_nascimento || '',
        paciente_idade: rec.paciente_idade || '',
        paciente_sexo: rec.paciente_sexo || '',
      })

      // Carrega timpanometria
      try {
        const timpRecs: any[] = await pb.collection('timpanometria_dados').getFullList({
          filter: `imitanciometria_id = "${examId}"`,
        })
        const od = timpRecs.find((r) => r.orelha === 'OD')
        const oe = timpRecs.find((r) => r.orelha === 'OE')
        if (od)
          setTimpOD({
            id: od.id,
            orelha: 'OD',
            volume_meato: numOr(od.volume_meato),
            complacencia: numOr(od.complacencia),
            pressao_maxima: numOr(od.pressao_maxima),
            tipo_curva: od.tipo_curva || '',
            pressao_pico: numOr(od.pressao_pico),
            gradiente_curva: numOr(od.gradiente_curva),
            curva_descricao: od.curva_descricao || '',
            observacoes: od.observacoes || '',
          })
        if (oe)
          setTimpOE({
            id: oe.id,
            orelha: 'OE',
            volume_meato: numOr(oe.volume_meato),
            complacencia: numOr(oe.complacencia),
            pressao_maxima: numOr(oe.pressao_maxima),
            tipo_curva: oe.tipo_curva || '',
            pressao_pico: numOr(oe.pressao_pico),
            gradiente_curva: numOr(oe.gradiente_curva),
            curva_descricao: oe.curva_descricao || '',
            observacoes: oe.observacoes || '',
          })
      } catch {
        /* intentionally ignored */
      }

      // Carrega reflexos
      try {
        const reflexRecs: any[] = await pb.collection('reflexo_acustico_dados').getFullList({
          filter: `imitanciometria_id = "${examId}"`,
        })
        const find = (o: string, v: string) => reflexRecs.find((r) => r.orelha === o && r.via === v)
        const mapReflex = (
          r: any,
          o: 'OD' | 'OE',
          v: 'contra_lateral' | 'ipsi_lateral',
        ): ReflexData =>
          r
            ? {
                id: r.id,
                orelha: o,
                via: v,
                frequencia_500: numOr(r.frequencia_500),
                frequencia_1000: numOr(r.frequencia_1000),
                frequencia_2000: numOr(r.frequencia_2000),
                frequencia_4000: numOr(r.frequencia_4000),
                status: r.status || '',
              }
            : emptyReflex(o, v)
        setReflexODContra(mapReflex(find('OD', 'contra_lateral'), 'OD', 'contra_lateral'))
        setReflexODIpsi(mapReflex(find('OD', 'ipsi_lateral'), 'OD', 'ipsi_lateral'))
        setReflexOEContra(mapReflex(find('OE', 'contra_lateral'), 'OE', 'contra_lateral'))
        setReflexOEIpsi(mapReflex(find('OE', 'ipsi_lateral'), 'OE', 'ipsi_lateral'))
      } catch {
        /* intentionally ignored */
      }
    } catch (err) {
      console.error('Erro ao carregar imitanciometria:', err)
      toast({
        title: 'Erro ao carregar',
        description: 'Não foi possível carregar o exame.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [examId, toast])

  useEffect(() => {
    loadExam()
  }, [loadExam])

  const setField = <K extends keyof ExamState>(key: K, value: ExamState[K]) => {
    setExam((prev) => ({ ...prev, [key]: value }))
  }

  // Sincroniza tipo_curva das orelhas nos campos do parecer
  useEffect(() => {
    setExam((prev) => ({
      ...prev,
      tipo_curva_od: timpOD.tipo_curva || prev.tipo_curva_od,
      tipo_curva_oe: timpOE.tipo_curva || prev.tipo_curva_oe,
    }))
  }, [timpOD.tipo_curva, timpOE.tipo_curva])

  const handleSuggestedLaudo = () => {
    const text = buildSuggestedLaudo(exam.tipo_curva_od, exam.tipo_curva_oe, exam.reflexos_status)
    if (text) setField('laudo', text)
    toast({ title: 'Laudo sugerido gerado', description: 'Revise e edite conforme necessário.' })
  }

  // Estatísticas de reflexos (para exibição)
  const reflexesPresentes = useMemo(() => {
    const rows = [reflexODContra, reflexODIpsi, reflexOEContra, reflexOEIpsi]
    let present = 0
    let total = 0
    rows.forEach((r) => {
      ;(
        ['frequencia_500', 'frequencia_1000', 'frequencia_2000', 'frequencia_4000'] as const
      ).forEach((f) => {
        if (r[f] !== null) {
          total++
          if (r[f]! <= 100) present++
        }
      })
    })
    return { present, total }
  }, [reflexODContra, reflexODIpsi, reflexOEContra, reflexOEIpsi])

  const persistSubcollections = async (imitId: string) => {
    // Timpanometria
    const timpUpsert = async (t: TimpData) => {
      const payload = {
        imitanciometria_id: imitId,
        orelha: t.orelha,
        volume_meato: t.volume_meato,
        complacencia: t.complacencia,
        pressao_maxima: t.pressao_maxima,
        tipo_curva: t.tipo_curva,
        pressao_pico: t.pressao_pico,
        gradiente_curva: t.gradiente_curva,
        curva_descricao: t.curva_descricao,
        observacoes: t.observacoes,
      }
      if (t.id) {
        await pb.collection('timpanometria_dados').update(t.id, payload)
      } else {
        const rec: any = await pb.collection('timpanometria_dados').create(payload)
        t.id = rec.id
      }
    }
    await timpUpsert(timpOD)
    await timpUpsert(timpOE)

    // Reflexos
    const reflexUpsert = async (r: ReflexData) => {
      const payload = {
        imitanciometria_id: imitId,
        orelha: r.orelha,
        via: r.via,
        frequencia_500: r.frequencia_500,
        frequencia_1000: r.frequencia_1000,
        frequencia_2000: r.frequencia_2000,
        frequencia_4000: r.frequencia_4000,
        status: r.status,
      }
      if (r.id) {
        await pb.collection('reflexo_acustico_dados').update(r.id, payload)
      } else {
        const rec: any = await pb.collection('reflexo_acustico_dados').create(payload)
        r.id = rec.id
      }
    }
    await reflexUpsert(reflexODContra)
    await reflexUpsert(reflexODIpsi)
    await reflexUpsert(reflexOEContra)
    await reflexUpsert(reflexOEIpsi)
  }

  const handleSave = async (finalizar = false) => {
    if (!patient) {
      toast({ title: 'Paciente não encontrado', variant: 'destructive' })
      return
    }
    setSaving(true)
    const payload: Record<string, any> = {
      paciente_id: patient.id,
      medical_record_id: '',
      data_exame: exam.data_exame,
      especialista_id: exam.especialista_id || currentUser?.id || '',
      especialista_nome: exam.especialista_nome || currentUser?.name || SPECIALIST_NAME,
      equipment_id: exam.equipment_id || '',
      equipment_nome: exam.equipment_nome || '',
      observacoes: exam.observacoes,
      status: finalizar ? 'finalizado' : exam.status,
      tipo_curva_od: exam.tipo_curva_od || timpOD.tipo_curva,
      tipo_curva_oe: exam.tipo_curva_oe || timpOE.tipo_curva,
      reflexos_status: exam.reflexos_status,
      laudo: exam.laudo,
      referencias: exam.referencias,
      encaminhado_por: exam.encaminhado_por,
      meatoscopia_od_normal: exam.meatoscopia_od_normal,
      meatoscopia_od_alterada: exam.meatoscopia_od_alterada,
      meatoscopia_od_obs: exam.meatoscopia_od_obs,
      meatoscopia_oe_normal: exam.meatoscopia_oe_normal,
      meatoscopia_oe_alterada: exam.meatoscopia_oe_alterada,
      meatoscopia_oe_obs: exam.meatoscopia_oe_obs,
      paciente_nome: patient.name,
      paciente_cpf: patient.cpf || '',
      paciente_nascimento: patient.birthDate || '',
      paciente_idade: String(calculateAge(patient.birthDate) ?? ''),
      paciente_sexo: patient.gender || '',
    }
    try {
      let imitId: string
      if (exam.id) {
        const rec: any = await pb.collection('imitanciometrias').update(exam.id, payload)
        imitId = rec.id
        toast({
          title: finalizar ? 'Exame finalizado' : 'Exame atualizado',
          description: 'Imitanciometria salva com sucesso.',
        })
      } else {
        const rec: any = await pb.collection('imitanciometrias').create(payload)
        imitId = rec.id
        setExam((prev) => ({ ...prev, id: imitId }))
        toast({ title: 'Exame criado', description: 'Imitanciometria salva com sucesso.' })
        navigate(`/pacientes/${patient.id}/imitanciometria/${imitId}`, { replace: true })
      }
      await persistSubcollections(imitId)
      if (finalizar) setField('status', 'finalizado')
    } catch (err) {
      console.error('Erro ao salvar imitanciometria:', err)
      let msg = 'Não foi possível salvar o exame.'
      if (err instanceof ClientResponseError) msg = err.message || msg
      toast({ title: 'Erro ao salvar', description: msg, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const selectedEquipment: Equipment | undefined = useMemo(
    () => equipments.find((e) => e.id === exam.equipment_id),
    [equipments, exam.equipment_id],
  )

  const buildPrintData = (): ImitPrintData => ({
    paciente_nome: exam.paciente_nome,
    paciente_cpf: exam.paciente_cpf,
    paciente_nascimento: exam.paciente_nascimento,
    paciente_idade: exam.paciente_idade,
    paciente_sexo: exam.paciente_sexo,
    data_exame: exam.data_exame,
    especialista_nome: exam.especialista_nome,
    especialista_crm: currentUser?.crmCrfa || '',
    equipment_nome: exam.equipment_nome,
    equipment_calibracao: selectedEquipment?.data_calibracao || '',
    encaminhado_por: exam.encaminhado_por,
    observacoes: exam.observacoes,
    meatoscopia: {
      od_normal: exam.meatoscopia_od_normal,
      od_alterada: exam.meatoscopia_od_alterada,
      od_obs: exam.meatoscopia_od_obs,
      oe_normal: exam.meatoscopia_oe_normal,
      oe_alterada: exam.meatoscopia_oe_alterada,
      oe_obs: exam.meatoscopia_oe_obs,
    },
    tipo_curva_od: exam.tipo_curva_od || timpOD.tipo_curva,
    tipo_curva_oe: exam.tipo_curva_oe || timpOE.tipo_curva,
    reflexos_status: exam.reflexos_status,
    laudo: exam.laudo,
    referencias: exam.referencias,
    timpanometria: {
      OD: {
        volume_meato: timpOD.volume_meato,
        complacencia: timpOD.complacencia,
        pressao_maxima: timpOD.pressao_maxima,
        tipo_curva: timpOD.tipo_curva,
        pressao_pico: timpOD.pressao_pico,
        gradiente_curva: timpOD.gradiente_curva,
        curva_descricao: timpOD.curva_descricao,
        observacoes: timpOD.observacoes,
      },
      OE: {
        volume_meato: timpOE.volume_meato,
        complacencia: timpOE.complacencia,
        pressao_maxima: timpOE.pressao_maxima,
        tipo_curva: timpOE.tipo_curva,
        pressao_pico: timpOE.pressao_pico,
        gradiente_curva: timpOE.gradiente_curva,
        curva_descricao: timpOE.curva_descricao,
        observacoes: timpOE.observacoes,
      },
    },
    reflexos: {
      OD: { contra_lateral: reflexODContra, ipsi_lateral: reflexODIpsi },
      OE: { contra_lateral: reflexOEContra, ipsi_lateral: reflexOEIpsi },
    },
  })

  const professionalData = currentUser
    ? { name: currentUser.name, crmCrfa: currentUser.crmCrfa }
    : null

  const [previewOpen, setPreviewOpen] = useState(false)

  const handlePrint = () => {
    print({
      title: 'Imitanciometria',
      subtitle: `${patient?.name || ''} — ${formatDate(exam.data_exame)}`,
      body: (
        <ImitanciometriaPrint
          data={buildPrintData()}
          clinicSettings={clinicSettings}
          professional={professionalData}
        />
      ),
    })
  }

  const handlePreview = () => {
    setPreviewOpen(true)
  }

  const handleDownload = () => {
    print({
      title: 'Imitanciometria',
      subtitle: `${patient?.name || ''} — ${formatDate(exam.data_exame)}`,
      body: (
        <ImitanciometriaPrint
          data={buildPrintData()}
          clinicSettings={clinicSettings}
          professional={professionalData}
        />
      ),
    })
  }

  if (!patient) {
    return (
      <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-4">
        <h2 className="text-xl font-bold text-slate-800">Paciente não localizado</h2>
        <Button onClick={() => navigate('/pacientes')} variant="outline">
          Voltar para Lista de Pacientes
        </Button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
      </div>
    )
  }

  const readOnly = isSecretaria || exam.status === 'finalizado'

  return (
    <div className="space-y-3 animate-in fade-in-50 duration-200 pb-12">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={() => navigate(`/pacientes/${patient.id}/prontuario`)}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Voltar
          </Button>
          <div>
            <h1 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-600" />
              Imitanciometria
            </h1>
          </div>
          {exam.status === 'finalizado' && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5">
              <CheckCircle2 className="w-3 h-3" />
              Finalizado
            </span>
          )}
          {exam.status === 'rascunho' && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5">
              <FileEdit className="w-3 h-3" />
              Rascunho
            </span>
          )}
        </div>
      </div>

      {/* Prévia para impressão */}
      <div className="hidden print:block">
        <ImitanciometriaPrint
          data={buildPrintData()}
          clinicSettings={clinicSettings}
          professional={professionalData}
        />
      </div>

      <div className="no-print space-y-3">
        {/* Dados gerais / Identificação */}
        <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Data do Exame">
              <Input
                type="date"
                value={exam.data_exame}
                onChange={(e) => setField('data_exame', e.target.value)}
                disabled={readOnly}
                className="h-9 rounded-xl text-xs font-medium border-slate-300 bg-white"
              />
            </Field>
            <Field label="Especialista">
              <Input
                value={exam.especialista_nome}
                onChange={(e) => setField('especialista_nome', e.target.value)}
                disabled={readOnly}
                className="h-9 rounded-xl text-xs font-medium border-slate-300 bg-white"
              />
            </Field>
            <Field label="Equipamento (instrumento)">
              <Select
                value={exam.equipment_id || '__none'}
                onValueChange={(v) => {
                  const eq = equipments.find((e) => e.id === v)
                  setExam((prev) => ({
                    ...prev,
                    equipment_id: v === '__none' ? '' : v,
                    equipment_nome: eq?.nome || '',
                  }))
                }}
                disabled={readOnly}
              >
                <SelectTrigger className="h-9 rounded-xl text-xs font-medium border-slate-300 bg-white">
                  <SelectValue placeholder="Selecione o equipamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">—</SelectItem>
                  {equipments.map((eq) => (
                    <SelectItem key={eq.id} value={eq.id}>
                      {eq.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="mt-3">
            <Field label="Encaminhado por">
              <Input
                value={exam.encaminhado_por}
                onChange={(e) => setField('encaminhado_por', e.target.value)}
                disabled={readOnly}
                placeholder="Profissional/entidade que encaminhou o paciente (opcional)"
                className="h-9 rounded-xl text-xs font-medium border-slate-300 bg-white"
              />
            </Field>
          </div>
        </div>

        {/* Seção: Meatoscopia */}
        <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100 mb-3">
            <Activity className="w-4 h-4 text-emerald-600" />
            Meatoscopia
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MeatoscopiaCard
              label="Orelha Direita (OD)"
              color="red"
              normal={exam.meatoscopia_od_normal}
              alterada={exam.meatoscopia_od_alterada}
              obs={exam.meatoscopia_od_obs}
              onNormal={(v) => setField('meatoscopia_od_normal', v)}
              onAlterada={(v) => setField('meatoscopia_od_alterada', v)}
              onObs={(v) => setField('meatoscopia_od_obs', v)}
              disabled={readOnly}
            />
            <MeatoscopiaCard
              label="Orelha Esquerda (OE)"
              color="blue"
              normal={exam.meatoscopia_oe_normal}
              alterada={exam.meatoscopia_oe_alterada}
              obs={exam.meatoscopia_oe_obs}
              onNormal={(v) => setField('meatoscopia_oe_normal', v)}
              onAlterada={(v) => setField('meatoscopia_oe_alterada', v)}
              onObs={(v) => setField('meatoscopia_oe_obs', v)}
              disabled={readOnly}
            />
          </div>
        </div>

        {/* Seção 2: Timpanometria — duas colunas OD/OE */}
        <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100 mb-3">
            <Activity className="w-4 h-4 text-emerald-600" />
            Timpanometria
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TimpCard
              label="Orelha Direita (OD)"
              color="red"
              data={timpOD}
              onChange={setTimpOD}
              disabled={readOnly}
            />
            <TimpCard
              label="Orelha Esquerda (OE)"
              color="blue"
              data={timpOE}
              onChange={setTimpOE}
              disabled={readOnly}
            />
          </div>
        </div>

        {/* Seção 3: Reflexo Acústico */}
        <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100 mb-3">
            <Activity className="w-4 h-4 text-emerald-600" />
            Reflexo Acústico
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ReflexCard
              label="Orelha Direita (OD)"
              color="red"
              contra={reflexODContra}
              ipsi={reflexODIpsi}
              onContra={setReflexODContra}
              onIpsi={setReflexODIpsi}
              disabled={readOnly}
            />
            <ReflexCard
              label="Orelha Esquerda (OE)"
              color="blue"
              contra={reflexOEContra}
              ipsi={reflexOEIpsi}
              onContra={setReflexOEContra}
              onIpsi={setReflexOEIpsi}
              disabled={readOnly}
            />
          </div>
          {reflexesPresentes.total > 0 && (
            <p className="text-[11px] text-slate-500 mt-2">
              Reflexos presentes: {reflexesPresentes.present} de {reflexesPresentes.total}{' '}
              registros.
            </p>
          )}
        </div>

        {/* Seção 4: Parecer */}
        <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100 mb-3">
            <Activity className="w-4 h-4 text-emerald-600" />
            Parecer
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <Field label="Tipo de Curva OD">
              <Select
                value={exam.tipo_curva_od || '__none'}
                onValueChange={(v) => setField('tipo_curva_od', v === '__none' ? '' : v)}
                disabled={readOnly}
              >
                <SelectTrigger className="h-9 rounded-xl text-xs font-medium border-slate-300 bg-white">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">—</SelectItem>
                  {TIPOS_CURVA.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Tipo de Curva OE">
              <Select
                value={exam.tipo_curva_oe || '__none'}
                onValueChange={(v) => setField('tipo_curva_oe', v === '__none' ? '' : v)}
                disabled={readOnly}
              >
                <SelectTrigger className="h-9 rounded-xl text-xs font-medium border-slate-300 bg-white">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">—</SelectItem>
                  {TIPOS_CURVA.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Reflexos Acústicos">
              <Select
                value={exam.reflexos_status || '__none'}
                onValueChange={(v) => setField('reflexos_status', v === '__none' ? '' : v)}
                disabled={readOnly}
              >
                <SelectTrigger className="h-9 rounded-xl text-xs font-medium border-slate-300 bg-white">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">—</SelectItem>
                  {REFLEXOS_STATUS_OPTS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="flex items-center justify-between mb-1">
            <Label className="text-[10px] font-semibold text-slate-600">
              Laudo automático (editável)
            </Label>
            {!readOnly && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleSuggestedLaudo}
                className="h-7 text-[11px] rounded-lg"
              >
                <Wand2 className="w-3 h-3 mr-1" />
                Gerar laudo
              </Button>
            )}
          </div>
          <Textarea
            value={exam.laudo}
            onChange={(e) => setField('laudo', e.target.value)}
            disabled={readOnly}
            rows={5}
            placeholder="Laudo gerado a partir das seleções acima. Edite conforme necessário."
            className="rounded-xl text-xs border-slate-300 resize-y"
          />
          <Label className="text-[10px] font-semibold text-slate-600 block mt-3 mb-0.5">
            Referências (editável)
          </Label>
          <Textarea
            value={exam.referencias}
            onChange={(e) => setField('referencias', e.target.value)}
            disabled={readOnly}
            rows={2}
            className="rounded-xl text-[11px] border-slate-300 resize-y italic text-slate-600"
          />
          <Label className="text-[10px] font-semibold text-slate-600 block mt-3 mb-0.5">
            Observações
          </Label>
          <Textarea
            value={exam.observacoes}
            onChange={(e) => setField('observacoes', e.target.value)}
            disabled={readOnly}
            rows={2}
            placeholder="Observações adicionais (opcional)"
            className="rounded-xl text-xs border-slate-300 resize-y"
          />
        </div>

        {/* Seção 5: Assinatura (somente leitura) */}
        <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100 mb-3">
            <Activity className="w-4 h-4 text-emerald-600" />
            Assinatura
          </h3>
          <div className="text-center py-2">
            <div className="mx-auto" style={{ maxWidth: 320 }}>
              <div className="border-t border-slate-400 pt-1 text-sm font-bold text-slate-800">
                {(currentUser?.name || SPECIALIST_NAME).toUpperCase()}
              </div>
              <div className="text-[11px] text-slate-500">
                Fonoaudiólogo — CRFa{' '}
                {(currentUser?.crmCrfa || SPECIALIST_CRFA).replace(/^crfa\s*/i, '')}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Rodapé de ações */}
      <div className="no-print flex flex-col sm:flex-row items-center justify-end gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
        <Button
          variant="outline"
          onClick={handlePreview}
          className="rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold h-10 w-full sm:w-auto"
        >
          <Eye className="w-4 h-4 mr-1.5" />
          Visualizar PDF
        </Button>
        <Button
          variant="outline"
          onClick={handlePrint}
          className="rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold h-10 w-full sm:w-auto"
        >
          <Printer className="w-4 h-4 mr-1.5" />
          Imprimir
        </Button>
        <Button
          variant="outline"
          onClick={handleDownload}
          className="rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold h-10 w-full sm:w-auto"
        >
          <Download className="w-4 h-4 mr-1.5" />
          Baixar PDF
        </Button>
        {!isSecretaria && (
          <>
            <Button
              onClick={() => handleSave(false)}
              disabled={saving || exam.status === 'finalizado'}
              className="bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold h-10 shadow-sm w-full sm:w-auto disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-1.5" />
              )}
              Salvar Rascunho
            </Button>
            <Button
              onClick={() => handleSave(true)}
              disabled={saving || exam.status === 'finalizado'}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold h-10 shadow-sm w-full sm:w-auto disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
              )}
              Finalizar
            </Button>
          </>
        )}
      </div>

      {/* Modal de pré-visualização do PDF */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pré-visualização — Imitanciometria</DialogTitle>
          </DialogHeader>
          <div className="border border-slate-200 rounded-lg p-4 bg-white">
            <ImitanciometriaPrint
              data={buildPrintData()}
              clinicSettings={clinicSettings}
              professional={professionalData}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setPreviewOpen(false)}
              className="rounded-xl text-xs"
            >
              Fechar
            </Button>
            <Button
              onClick={() => {
                setPreviewOpen(false)
                handlePrint()
              }}
              className="rounded-xl text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Printer className="w-4 h-4 mr-1.5" />
              Imprimir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ---------- Subcomponentes ---------- */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-[10px] font-semibold text-slate-600 block mb-0.5">{label}</Label>
      {children}
    </div>
  )
}

function TimpCard({
  label,
  color,
  data,
  onChange,
  disabled,
}: {
  label: string
  color: 'red' | 'blue'
  data: TimpData
  onChange: (d: TimpData) => void
  disabled?: boolean
}) {
  const titleColor = color === 'red' ? 'text-red-600' : 'text-blue-600'
  const ring = color === 'red' ? 'focus:ring-red-400' : 'focus:ring-blue-400'
  const inputCls = `h-8 rounded-xl text-[11px] font-medium border-slate-300 bg-white focus:ring-2 ${ring}`
  const patch = (p: Partial<TimpData>) => onChange({ ...data, ...p })
  return (
    <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2">
      <h4 className={`text-xs font-extrabold uppercase tracking-wider ${titleColor}`}>{label}</h4>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Volume do Meato (ml)">
          <Input
            type="number"
            step="0.01"
            value={data.volume_meato ?? ''}
            onChange={(e) =>
              patch({ volume_meato: e.target.value === '' ? null : Number(e.target.value) })
            }
            disabled={disabled}
            className={inputCls}
          />
        </Field>
        <Field label="Complacência (ml)">
          <Input
            type="number"
            step="0.01"
            value={data.complacencia ?? ''}
            onChange={(e) =>
              patch({ complacencia: e.target.value === '' ? null : Number(e.target.value) })
            }
            disabled={disabled}
            className={inputCls}
          />
        </Field>
        <Field label="Pressão de Pico (daPa)">
          <Input
            type="number"
            min={-400}
            max={200}
            value={data.pressao_pico ?? ''}
            onChange={(e) =>
              patch({ pressao_pico: e.target.value === '' ? null : Number(e.target.value) })
            }
            disabled={disabled}
            className={inputCls}
          />
        </Field>
        <Field label="Pressão Máxima (daPa)">
          <Input
            type="number"
            value={data.pressao_maxima ?? ''}
            onChange={(e) =>
              patch({ pressao_maxima: e.target.value === '' ? null : Number(e.target.value) })
            }
            disabled={disabled}
            className={inputCls}
          />
        </Field>
      </div>
      <Field label="Tipo de Curva">
        <Select
          value={data.tipo_curva || '__none'}
          onValueChange={(v) => patch({ tipo_curva: v === '__none' ? '' : v })}
          disabled={disabled}
        >
          <SelectTrigger className="h-8 rounded-xl text-[11px] font-medium border-slate-300 bg-white">
            <SelectValue placeholder="Selecione o tipo de curva" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">—</SelectItem>
            {TIPOS_CURVA.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Gradiente da curva">
        <Input
          type="number"
          step="0.01"
          value={data.gradiente_curva ?? ''}
          onChange={(e) =>
            patch({ gradiente_curva: e.target.value === '' ? null : Number(e.target.value) })
          }
          disabled={disabled}
          className={inputCls}
        />
      </Field>
      <Field label="Descrição da curva timpanométrica">
        <Input
          value={data.curva_descricao}
          onChange={(e) => patch({ curva_descricao: e.target.value })}
          disabled={disabled}
          placeholder="Ex.: Curva tipo A com pico em 0 daPa"
          className={inputCls}
        />
      </Field>
      <Field label="Observações (timpanometria)">
        <Textarea
          value={data.observacoes}
          onChange={(e) => patch({ observacoes: e.target.value })}
          disabled={disabled}
          rows={2}
          placeholder="Observações específicas desta orelha (opcional)"
          className="rounded-xl text-[11px] border-slate-300 resize-y"
        />
      </Field>
    </div>
  )
}

function MeatoscopiaCard({
  label,
  color,
  normal,
  alterada,
  obs,
  onNormal,
  onAlterada,
  onObs,
  disabled,
}: {
  label: string
  color: 'red' | 'blue'
  normal: boolean
  alterada: boolean
  obs: string
  onNormal: (v: boolean) => void
  onAlterada: (v: boolean) => void
  onObs: (v: string) => void
  disabled?: boolean
}) {
  const titleColor = color === 'red' ? 'text-red-600' : 'text-blue-600'
  return (
    <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2">
      <h4 className={`text-xs font-extrabold uppercase tracking-wider ${titleColor}`}>{label}</h4>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-[11px] font-medium text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={normal}
            onChange={(e) => onNormal(e.target.checked)}
            disabled={disabled}
            className="w-4 h-4 rounded border-slate-300"
          />
          Normal
        </label>
        <label className="flex items-center gap-2 text-[11px] font-medium text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={alterada}
            onChange={(e) => onAlterada(e.target.checked)}
            disabled={disabled}
            className="w-4 h-4 rounded border-slate-300"
          />
          Alterada
        </label>
      </div>
      <Field label="Observação">
        <Textarea
          value={obs}
          onChange={(e) => onObs(e.target.value)}
          disabled={disabled}
          rows={2}
          placeholder="Descreva achados da meatoscopia (opcional)"
          className="rounded-xl text-[11px] border-slate-300 resize-y"
        />
      </Field>
    </div>
  )
}

const REFLEX_FREQS: { key: keyof ReflexData; label: string }[] = [
  { key: 'frequencia_500', label: '500 Hz' },
  { key: 'frequencia_1000', label: '1000 Hz' },
  { key: 'frequencia_2000', label: '2000 Hz' },
  { key: 'frequencia_4000', label: '4000 Hz' },
]

function ReflexCard({
  label,
  color,
  contra,
  ipsi,
  onContra,
  onIpsi,
  disabled,
}: {
  label: string
  color: 'red' | 'blue'
  contra: ReflexData
  ipsi: ReflexData
  onContra: (r: ReflexData) => void
  onIpsi: (r: ReflexData) => void
  disabled?: boolean
}) {
  const titleColor = color === 'red' ? 'text-red-600' : 'text-blue-600'
  const ring = color === 'red' ? 'focus:ring-red-400' : 'focus:ring-blue-400'
  const inputCls = `w-full h-7 px-0.5 text-center text-[10px] font-semibold rounded bg-slate-100 border border-slate-300 focus:bg-white focus:outline-none focus:ring-2 ${ring}`
  const th = 'border border-slate-300 bg-slate-100 text-[10px] font-bold text-center px-1 py-0.5'
  const td = 'border border-slate-300 text-center px-0.5 py-0.5'

  const renderRow = (viaLabel: string, row: ReflexData, onChange: (r: ReflexData) => void) => (
    <tr>
      <td className={`${td} text-left font-semibold text-[10px] pl-1`}>{viaLabel}</td>
      {REFLEX_FREQS.map((f) => (
        <td key={f.key} className={td}>
          <input
            type="number"
            value={(row[f.key] as number | null) ?? ''}
            onChange={(e) =>
              onChange({
                ...row,
                [f.key]: e.target.value === '' ? null : Number(e.target.value),
              })
            }
            disabled={disabled}
            placeholder="—"
            className={inputCls}
          />
        </td>
      ))}
      <td className={td}>
        <Select
          value={row.status || '__none'}
          onValueChange={(v) => onChange({ ...row, status: v === '__none' ? '' : v })}
          disabled={disabled}
        >
          <SelectTrigger className="h-7 rounded-md text-[10px] font-medium border-slate-300 bg-white px-1">
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">—</SelectItem>
            <SelectItem value="presente">Presente</SelectItem>
            <SelectItem value="ausente">Ausente</SelectItem>
            <SelectItem value="elevado">Elevado</SelectItem>
          </SelectContent>
        </Select>
      </td>
    </tr>
  )

  return (
    <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2">
      <h4 className={`text-xs font-extrabold uppercase tracking-wider ${titleColor}`}>{label}</h4>
      <div className="overflow-x-auto border border-slate-300 rounded-lg bg-white">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={th}>Via</th>
              {REFLEX_FREQS.map((f) => (
                <th key={f.key} className={th}>
                  {f.label}
                </th>
              ))}
              <th className={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {renderRow('Contra-lateral', contra, onContra)}
            {renderRow('Ipsi-lateral', ipsi, onIpsi)}
          </tbody>
        </table>
      </div>
    </div>
  )
}
