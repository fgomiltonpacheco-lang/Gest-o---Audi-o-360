import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '@/context/AppContext'
import { useToast } from '@/hooks/use-toast'
import { usePrint } from '@/components/print/PrintProvider'
import { ImitanciometriaPrint, type ImitPrintData } from '@/components/print/ImitanciometriaPrint'
import { renderExamReport, buildImitanciometriaContext } from '@/components/print/PrintDocuments'
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
  ChevronLeft,
  ChevronRight,
  Info,
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { calculateAge, formatDate } from '@/lib/formatters'
import { Equipment } from '@/types'
import TimpanogramChart from '@/components/print/TimpanogramChart'

const SPECIALIST_NAME = 'MILTON SOARES PACHECO'
const SPECIALIST_CRFA = '3-11981-5'

const TIPOS_CURVA = ['A', 'Ad', 'As', 'B', 'C', 'Ad/As'] as const

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
  curva_timpanometrica?: { pressao: number; complacencia: number }[] | null
}

interface RawDataStore {
  od_pressao_inicial: string
  od_pressao_media: string
  od_pressao_final: string
  od_volume_inicial: string
  od_volume_media: string
  od_volume_final: string
  oe_pressao_inicial: string
  oe_pressao_media: string
  oe_pressao_final: string
  oe_volume_inicial: string
  oe_volume_media: string
  oe_volume_final: string
}

interface SummaryDataStore {
  pressao_om_od: string
  pressao_om_oe: string
  max_relax_od: string
  max_relax_oe: string
  compl_200_od: string
  compl_200_oe: string
  compl_estatica_od: string
  compl_estatica_oe: string
}

interface ReflexGridRow {
  limiar: string
  refl_contra: string
  diferenca: string
  ipsi: string
}

interface ReflexGridStore {
  od: Record<number, ReflexGridRow> // freq: 500, 1000, 2000, 4000
  oe: Record<number, ReflexGridRow>
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
    curva_timpanometrica: null,
  }
}

function emptyReflexGridRow(): ReflexGridRow {
  return { limiar: '', refl_contra: '', diferenca: '', ipsi: '' }
}

function emptyReflexGrid(): ReflexGridStore {
  return {
    od: {
      500: emptyReflexGridRow(),
      1000: emptyReflexGridRow(),
      2000: emptyReflexGridRow(),
      4000: emptyReflexGridRow(),
    },
    oe: {
      500: emptyReflexGridRow(),
      1000: emptyReflexGridRow(),
      2000: emptyReflexGridRow(),
      4000: emptyReflexGridRow(),
    },
  }
}

function numOr(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(String(v).replace(',', '.'))
  return isNaN(n) ? null : n
}

/**
 * Classifica automaticamente o tipo da curva com base em compliância e pressão:
 * - Tipo A: compliância entre 0.3 e 1.6 + pressão entre -100 e +50
 * - Tipo As: compliância menor que 0.3 (quando maior que limiar plano)
 * - Tipo Ad: compliância maior que 1.6
 * - Tipo B: curva plana (compliância muito baixa, próximo de zero <= 0.1 ou zero)
 * - Tipo C: pressão menor que -100
 */
function determineCurveType(
  complianceVal: string | number | null | undefined,
  pressureVal: string | number | null | undefined,
): string | null {
  const c = numOr(complianceVal)
  const p = numOr(pressureVal)

  // Se nenhum dado foi inserido, não altera/calcula tipo
  if (c === null && p === null) return null

  // Regra Tipo B: curva plana (compliância muito baixa, próximo de zero)
  if (c !== null && c <= 0.1) {
    return 'B'
  }

  // Regra Tipo Ad: compliância maior que 1.6
  if (c !== null && c > 1.6) {
    return 'Ad'
  }

  // Regra Tipo As: compliância menor que 0.3 (e > 0.1)
  if (c !== null && c < 0.3) {
    return 'As'
  }

  // Regra Tipo C: pressão menor que -100
  if (p !== null && p < -100) {
    return 'C'
  }

  // Regra Tipo A: compliância entre 0.3 e 1.6 + pressão entre -100 e +50
  // Também caso compliância esteja na faixa e pressão esteja dentro de [-100, +50] (ou pressão não informada mas compliância normal)
  if (c !== null && c >= 0.3 && c <= 1.6) {
    if (p !== null) {
      if (p >= -100 && p <= 50) {
        return 'A'
      }
      // Se pressão for > 50 mas compliância normal, mantém A ou padrão
      if (p > 50) {
        return 'A'
      }
    } else {
      return 'A'
    }
  }

  // Se apenas pressão informada:
  if (p !== null) {
    if (p < -100) return 'C'
    if (p >= -100 && p <= 50) return 'A'
  }

  return null
}

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

  // Tabelas Numéricas
  const [rawData, setRawData] = useState<RawDataStore>({
    od_pressao_inicial: '',
    od_pressao_media: '',
    od_pressao_final: '',
    od_volume_inicial: '',
    od_volume_media: '',
    od_volume_final: '',
    oe_pressao_inicial: '',
    oe_pressao_media: '',
    oe_pressao_final: '',
    oe_volume_inicial: '',
    oe_volume_media: '',
    oe_volume_final: '',
  })

  const [summaryData, setSummaryData] = useState<SummaryDataStore>({
    pressao_om_od: '',
    pressao_om_oe: '',
    max_relax_od: '',
    max_relax_oe: '',
    compl_200_od: '',
    compl_200_oe: '',
    compl_estatica_od: '',
    compl_estatica_oe: '',
  })

  // Grade de reflexos acústicos
  const [reflexGrid, setReflexGrid] = useState<ReflexGridStore>(emptyReflexGrid())

  // Carregar dados de um exame existente
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

      const odCurvePts = Array.isArray(rec.curva_timpanometrica_od)
        ? rec.curva_timpanometrica_od
        : null
      const oeCurvePts = Array.isArray(rec.curva_timpanometrica_oe)
        ? rec.curva_timpanometrica_oe
        : null

      // Carrega timpanometria do PocketBase
      try {
        const timpRecs: any[] = await pb.collection('timpanometria_dados').getFullList({
          filter: `imitanciometria_id = "${examId}"`,
        })
        const od = timpRecs.find((r) => r.orelha === 'OD')
        const oe = timpRecs.find((r) => r.orelha === 'OE')

        if (od) {
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
            curva_timpanometrica: odCurvePts,
          })
          setRawData((prev) => ({
            ...prev,
            od_pressao_media:
              od.pressao_pico != null ? String(od.pressao_pico) : prev.od_pressao_media,
            od_volume_media:
              od.volume_meato != null ? String(od.volume_meato) : prev.od_volume_media,
          }))
          setSummaryData((prev) => ({
            ...prev,
            pressao_om_od: od.pressao_pico != null ? String(od.pressao_pico) : prev.pressao_om_od,
            compl_estatica_od:
              od.complacencia != null ? String(od.complacencia) : prev.compl_estatica_od,
          }))
        }

        if (oe) {
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
            curva_timpanometrica: oeCurvePts,
          })
          setRawData((prev) => ({
            ...prev,
            oe_pressao_media:
              oe.pressao_pico != null ? String(oe.pressao_pico) : prev.oe_pressao_media,
            oe_volume_media:
              oe.volume_meato != null ? String(oe.volume_meato) : prev.oe_volume_media,
          }))
          setSummaryData((prev) => ({
            ...prev,
            pressao_om_oe: oe.pressao_pico != null ? String(oe.pressao_pico) : prev.pressao_om_oe,
            compl_estatica_oe:
              oe.complacencia != null ? String(oe.complacencia) : prev.compl_estatica_oe,
          }))
        }
      } catch {
        /* ignore */
      }

      // Carrega reflexos do PocketBase
      try {
        const reflexRecs: any[] = await pb.collection('reflexo_acustico_dados').getFullList({
          filter: `imitanciometria_id = "${examId}"`,
        })
        const newGrid = emptyReflexGrid()
        const freqs = [500, 1000, 2000, 4000] as const

        reflexRecs.forEach((r) => {
          const side = r.orelha === 'OD' ? 'od' : r.orelha === 'OE' ? 'oe' : null
          if (!side) return
          freqs.forEach((f) => {
            const val = r[`frequencia_${f}`]
            if (val != null) {
              const valStr = String(val)
              if (r.via === 'contra_lateral') {
                newGrid[side][f].refl_contra = valStr
              } else if (r.via === 'ipsi_lateral') {
                newGrid[side][f].ipsi = valStr
              }
            }
          })
        })
        setReflexGrid(newGrid)
      } catch {
        /* ignore */
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
  }, [examId, today, toast])

  useEffect(() => {
    loadExam()
  }, [loadExam])

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
  }, [patient, isNew])

  // Pré-seleciona equipamento único
  useEffect(() => {
    if (equipments.length === 1 && !exam.equipment_id) {
      const eq = equipments[0]
      setExam((prev) => ({ ...prev, equipment_id: eq.id, equipment_nome: eq.nome }))
    }
  }, [equipments, exam.equipment_id])

  const setField = <K extends keyof ExamState>(key: K, value: ExamState[K]) => {
    setExam((prev) => ({ ...prev, [key]: value }))
  }

  // Atualiza campo numérico de resumo e recalcula timpanometria e tipo de curva em tempo real
  const handleSummaryChange = (field: keyof SummaryDataStore, value: string, side: 'OD' | 'OE') => {
    setSummaryData((prevSummary) => {
      const nextSummary = { ...prevSummary, [field]: value }

      // Atualiza estado timpOD / timpOE
      if (side === 'OD') {
        const pressaoVal = field === 'pressao_om_od' ? value : nextSummary.pressao_om_od
        const complVal =
          field === 'max_relax_od'
            ? value
            : field === 'compl_estatica_od'
              ? value
              : nextSummary.max_relax_od || nextSummary.compl_estatica_od
        const volumeVal = field === 'compl_200_od' ? value : nextSummary.compl_200_od

        const pressaoNum = numOr(pressaoVal)
        const complNum = numOr(complVal)
        const volumeNum = numOr(volumeVal)

        // Sincroniza rawData
        if (field === 'pressao_om_od') {
          setRawData((r) => ({ ...r, od_pressao_media: value }))
        } else if (field === 'compl_200_od') {
          setRawData((r) => ({ ...r, od_volume_media: value }))
        }

        // Determinação automática do tipo de curva
        const autoTipo = determineCurveType(complVal, pressaoVal)

        setTimpOD((prev) => ({
          ...prev,
          pressao_pico: pressaoNum,
          complacencia: complNum,
          volume_meato: volumeNum,
          tipo_curva: autoTipo || prev.tipo_curva,
        }))

        if (autoTipo) {
          setExam((prev) => ({ ...prev, tipo_curva_od: autoTipo }))
        }
      } else {
        const pressaoVal = field === 'pressao_om_oe' ? value : nextSummary.pressao_om_oe
        const complVal =
          field === 'max_relax_oe'
            ? value
            : field === 'compl_estatica_oe'
              ? value
              : nextSummary.max_relax_oe || nextSummary.compl_estatica_oe
        const volumeVal = field === 'compl_200_oe' ? value : nextSummary.compl_200_oe

        const pressaoNum = numOr(pressaoVal)
        const complNum = numOr(complVal)
        const volumeNum = numOr(volumeVal)

        // Sincroniza rawData
        if (field === 'pressao_om_oe') {
          setRawData((r) => ({ ...r, oe_pressao_media: value }))
        } else if (field === 'compl_200_oe') {
          setRawData((r) => ({ ...r, oe_volume_media: value }))
        }

        // Determinação automática do tipo de curva
        const autoTipo = determineCurveType(complVal, pressaoVal)

        setTimpOE((prev) => ({
          ...prev,
          pressao_pico: pressaoNum,
          complacencia: complNum,
          volume_meato: volumeNum,
          tipo_curva: autoTipo || prev.tipo_curva,
        }))

        if (autoTipo) {
          setExam((prev) => ({ ...prev, tipo_curva_oe: autoTipo }))
        }
      }

      return nextSummary
    })
  }

  // Preenche "AUS" no campo de reflexo acústico
  const handleSetAus = (side: 'od' | 'oe', freq: number, field: 'refl_contra' | 'ipsi') => {
    setReflexGrid((prev) => {
      const row = { ...prev[side][freq], [field]: 'AUS' }
      return {
        ...prev,
        [side]: {
          ...prev[side],
          [freq]: row,
        },
      }
    })
  }

  // Salvar rascunho / finalizar
  const handleSave = async (finalizar = false) => {
    if (!patient) {
      toast({ title: 'Paciente não encontrado', variant: 'destructive' })
      return
    }
    setSaving(true)

    // Ajusta timpOD e timpOE com valores das tabelas
    const finalTimpOD: TimpData = {
      ...timpOD,
      tipo_curva: exam.tipo_curva_od || timpOD.tipo_curva,
      pressao_pico:
        rawData.od_pressao_media !== ''
          ? parseFloat(rawData.od_pressao_media)
          : timpOD.pressao_pico,
      volume_meato:
        rawData.od_volume_media !== '' ? parseFloat(rawData.od_volume_media) : timpOD.volume_meato,
      complacencia:
        summaryData.compl_estatica_od !== ''
          ? parseFloat(summaryData.compl_estatica_od)
          : timpOD.complacencia,
    }

    const finalTimpOE: TimpData = {
      ...timpOE,
      tipo_curva: exam.tipo_curva_oe || timpOE.tipo_curva,
      pressao_pico:
        rawData.oe_pressao_media !== ''
          ? parseFloat(rawData.oe_pressao_media)
          : timpOE.pressao_pico,
      volume_meato:
        rawData.oe_volume_media !== '' ? parseFloat(rawData.oe_volume_media) : timpOE.volume_meato,
      complacencia:
        summaryData.compl_estatica_oe !== ''
          ? parseFloat(summaryData.compl_estatica_oe)
          : timpOE.complacencia,
    }

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
      tipo_curva_od: exam.tipo_curva_od,
      tipo_curva_oe: exam.tipo_curva_oe,
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
      } else {
        const rec: any = await pb.collection('imitanciometrias').create(payload)
        imitId = rec.id
        setExam((prev) => ({ ...prev, id: imitId }))
        navigate(`/pacientes/${patient.id}/imitanciometria/${imitId}`, { replace: true })
      }

      // Persistir Timpanometria Subcollections
      const timpUpsert = async (t: TimpData) => {
        const p = {
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
          await pb.collection('timpanometria_dados').update(t.id, p)
        } else {
          const rec: any = await pb.collection('timpanometria_dados').create(p)
          t.id = rec.id
        }
      }
      await timpUpsert(finalTimpOD)
      await timpUpsert(finalTimpOE)

      // Persistir Reflexo Subcollections
      const freqs = [500, 1000, 2000, 4000] as const
      const buildReflexPayload = (
        orelha: 'OD' | 'OE',
        via: 'contra_lateral' | 'ipsi_lateral',
      ): ReflexData => {
        const side = orelha === 'OD' ? 'od' : 'oe'
        const getFreqVal = (f: (typeof freqs)[number]) => {
          const raw =
            via === 'contra_lateral' ? reflexGrid[side][f].refl_contra : reflexGrid[side][f].ipsi
          if (raw === 'AUS' || raw === 'aus' || raw === '') return null
          const n = parseFloat(raw)
          return isNaN(n) ? null : n
        }

        return {
          orelha,
          via,
          frequencia_500: getFreqVal(500),
          frequencia_1000: getFreqVal(1000),
          frequencia_2000: getFreqVal(2000),
          frequencia_4000: getFreqVal(4000),
          status: '',
        }
      }

      const mapReflexes: { orelha: 'OD' | 'OE'; via: 'contra_lateral' | 'ipsi_lateral' }[] = [
        { orelha: 'OD', via: 'contra_lateral' },
        { orelha: 'OD', via: 'ipsi_lateral' },
        { orelha: 'OE', via: 'contra_lateral' },
        { orelha: 'OE', via: 'ipsi_lateral' },
      ]

      for (const item of mapReflexes) {
        const rData = buildReflexPayload(item.orelha, item.via)
        const p = {
          imitanciometria_id: imitId,
          orelha: rData.orelha,
          via: rData.via,
          frequencia_500: rData.frequencia_500,
          frequencia_1000: rData.frequencia_1000,
          frequencia_2000: rData.frequencia_2000,
          frequencia_4000: rData.frequencia_4000,
          status: rData.status,
        }

        // Tenta buscar se existe
        try {
          const existing: any[] = await pb.collection('reflexo_acustico_dados').getFullList({
            filter: `imitanciometria_id = "${imitId}" && orelha = "${rData.orelha}" && via = "${rData.via}"`,
          })
          if (existing.length > 0) {
            await pb.collection('reflexo_acustico_dados').update(existing[0].id, p)
          } else {
            await pb.collection('reflexo_acustico_dados').create(p)
          }
        } catch {
          await pb.collection('reflexo_acustico_dados').create(p)
        }
      }

      if (finalizar) setField('status', 'finalizado')

      toast({
        title: finalizar ? 'Exame finalizado' : 'Exame salvo',
        description: 'Imitanciometria salva com sucesso.',
      })
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

  const buildPrintData = (): ImitPrintData => {
    // Monta dados de reflexos para impressão a partir da reflexGrid
    const mapReflexFromGrid = (
      orelha: 'OD' | 'OE',
      via: 'contra_lateral' | 'ipsi_lateral',
    ): ReflexData => {
      const side = orelha === 'OD' ? 'od' : 'oe'
      const getFreq = (f: 500 | 1000 | 2000 | 4000) => {
        const val =
          via === 'contra_lateral' ? reflexGrid[side][f].refl_contra : reflexGrid[side][f].ipsi
        if (val === 'AUS' || val === '' || isNaN(Number(val))) return null
        return Number(val)
      }
      return {
        orelha,
        via,
        frequencia_500: getFreq(500),
        frequencia_1000: getFreq(1000),
        frequencia_2000: getFreq(2000),
        frequencia_4000: getFreq(4000),
        status: '',
      }
    }

    return {
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
      tipo_curva_od: exam.tipo_curva_od,
      tipo_curva_oe: exam.tipo_curva_oe,
      reflexos_status: exam.reflexos_status,
      laudo: exam.laudo,
      referencias: exam.referencias,
      timpanometria: {
        OD: {
          volume_meato: rawData.od_volume_media
            ? Number(rawData.od_volume_media)
            : timpOD.volume_meato,
          complacencia: summaryData.compl_estatica_od
            ? Number(summaryData.compl_estatica_od)
            : timpOD.complacencia,
          pressao_maxima: timpOD.pressao_maxima,
          tipo_curva: exam.tipo_curva_od || timpOD.tipo_curva,
          pressao_pico: rawData.od_pressao_media
            ? Number(rawData.od_pressao_media)
            : timpOD.pressao_pico,
          gradiente_curva: timpOD.gradiente_curva,
          curva_descricao: timpOD.curva_descricao,
          observacoes: timpOD.observacoes,
          curva_timpanometrica: timpOD.curva_timpanometrica ?? null,
        },
        OE: {
          volume_meato: rawData.oe_volume_media
            ? Number(rawData.oe_volume_media)
            : timpOE.volume_meato,
          complacencia: summaryData.compl_estatica_oe
            ? Number(summaryData.compl_estatica_oe)
            : timpOE.complacencia,
          pressao_maxima: timpOE.pressao_maxima,
          tipo_curva: exam.tipo_curva_oe || timpOE.tipo_curva,
          pressao_pico: rawData.oe_pressao_media
            ? Number(rawData.oe_pressao_media)
            : timpOE.pressao_pico,
          gradiente_curva: timpOE.gradiente_curva,
          curva_descricao: timpOE.curva_descricao,
          observacoes: timpOE.observacoes,
          curva_timpanometrica: timpOE.curva_timpanometrica ?? null,
        },
      },
      reflexos: {
        OD: {
          contra_lateral: mapReflexFromGrid('OD', 'contra_lateral'),
          ipsi_lateral: mapReflexFromGrid('OD', 'ipsi_lateral'),
        },
        OE: {
          contra_lateral: mapReflexFromGrid('OE', 'contra_lateral'),
          ipsi_lateral: mapReflexFromGrid('OE', 'ipsi_lateral'),
        },
      },
    }
  }

  const professionalData = currentUser
    ? { name: currentUser.name, crmCrfa: currentUser.crmCrfa }
    : null

  const [previewOpen, setPreviewOpen] = useState(false)

  const handlePrint = async () => {
    const fallbackNode = (
      <ImitanciometriaPrint
        data={buildPrintData()}
        clinicSettings={clinicSettings}
        professional={professionalData}
      />
    )
    const printData = buildPrintData()
    const ctx = buildImitanciometriaContext({
      patientName: printData.paciente_nome,
      patientCpf: printData.paciente_cpf,
      patientBirthDate: printData.paciente_nascimento,
      patientAge: printData.paciente_idade,
      patientSex: printData.paciente_sexo,
      examDate: printData.data_exame,
      professionalName: professionalData?.name,
      professionalCrfa: professionalData?.crmCrfa,
      exam: {
        tipo_curva_od: printData.tipo_curva_od,
        tipo_curva_oe: printData.tipo_curva_oe,
        reflexos_status: printData.reflexos_status,
        laudo: printData.laudo,
        observacoes: printData.observacoes,
        encaminhado_por: printData.encaminhado_por,
        equipment_nome: printData.equipment_nome,
        equipment_calibracao: printData.equipment_calibracao,
        referencias: printData.referencias,
        meatoscopia: printData.meatoscopia,
        timpanometria: printData.timpanometria,
        reflexos: printData.reflexos,
      },
      clinicName: clinicSettings?.nome,
      clinicAddress: clinicSettings?.endereco,
      clinicPhone: clinicSettings?.telefone,
      clinicEmail: clinicSettings?.email,
    })
    const bodyNode = await renderExamReport({
      tipoExame: 'imitanciometria',
      context: ctx,
      fallback: fallbackNode,
    })
    print({
      title: 'Imitanciometria',
      subtitle: `${patient?.name || ''} — ${formatDate(exam.data_exame)}`,
      body: bodyNode,
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
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    )
  }

  const readOnly = isSecretaria || exam.status === 'finalizado'

  return (
    <div className="space-y-4 animate-in fade-in-50 duration-200 pb-16 text-slate-800">
      {/* Top Header / Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={() => navigate(`/pacientes/${patient.id}/prontuario`)}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg h-8"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Voltar
          </Button>
          <div>
            <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
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

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPreviewOpen(true)}
            className="h-8 text-xs font-semibold rounded-lg"
          >
            <Eye className="w-3.5 h-3.5 mr-1" />
            PDF
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="h-8 text-xs font-semibold rounded-lg"
          >
            <Printer className="w-3.5 h-3.5 mr-1" />
            Imprimir
          </Button>

          {!isSecretaria && (
            <>
              <Button
                size="sm"
                onClick={() => handleSave(false)}
                disabled={saving || exam.status === 'finalizado'}
                className="bg-slate-700 hover:bg-slate-800 text-white h-8 text-xs font-semibold rounded-lg"
              >
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5 mr-1" />
                )}
                Salvar
              </Button>

              <Button
                size="sm"
                onClick={() => handleSave(true)}
                disabled={saving || exam.status === 'finalizado'}
                className="bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs font-semibold rounded-lg"
              >
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                )}
                Finalizar
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Main Container Layout */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-5 shadow-sm">
        {/* Header Metadata Info Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pb-3 border-b border-slate-200 text-xs">
          <div>
            <Label className="text-[10px] font-semibold text-slate-500 block mb-0.5">
              Data do Exame
            </Label>
            <Input
              type="date"
              value={exam.data_exame}
              onChange={(e) => setField('data_exame', e.target.value)}
              disabled={readOnly}
              className="h-8 text-xs rounded-md border-slate-300"
            />
          </div>
          <div>
            <Label className="text-[10px] font-semibold text-slate-500 block mb-0.5">
              Especialista
            </Label>
            <Input
              value={exam.especialista_nome}
              onChange={(e) => setField('especialista_nome', e.target.value)}
              disabled={readOnly}
              className="h-8 text-xs rounded-md border-slate-300"
            />
          </div>
          <div>
            <Label className="text-[10px] font-semibold text-slate-500 block mb-0.5">
              Equipamento
            </Label>
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
              <SelectTrigger className="h-8 text-xs rounded-md border-slate-300">
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
          </div>
        </div>

        {/* 1. GRÁFICOS NO TOPO */}
        <div>
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Timpanometria
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* OD Box (Vermelho) */}
            <div className="border border-red-500 rounded-md p-2 bg-white flex flex-col items-center">
              <div className="w-full h-48 relative">
                <TimpanogramChart
                  width={340}
                  height={190}
                  odPoints={timpOD.curva_timpanometrica}
                  odTimp={{
                    tipo_curva: exam.tipo_curva_od || timpOD.tipo_curva,
                    pressao_pico: rawData.od_pressao_media
                      ? Number(rawData.od_pressao_media)
                      : timpOD.pressao_pico,
                    complacencia: summaryData.compl_estatica_od
                      ? Number(summaryData.compl_estatica_od)
                      : timpOD.complacencia,
                  }}
                  showLegend={false}
                  showTitle={false}
                />
              </div>
              <div className="w-full flex justify-between items-center text-xs font-bold text-red-600 mt-1 px-1">
                <span>DIREITA</span>
                <span>CURVA TIPO</span>
              </div>
            </div>

            {/* OE Box (Azul) */}
            <div className="border border-blue-600 rounded-md p-2 bg-white flex flex-col items-center">
              <div className="w-full h-48 relative">
                <TimpanogramChart
                  width={340}
                  height={190}
                  oePoints={timpOE.curva_timpanometrica}
                  oeTimp={{
                    tipo_curva: exam.tipo_curva_oe || timpOE.tipo_curva,
                    pressao_pico: rawData.oe_pressao_media
                      ? Number(rawData.oe_pressao_media)
                      : timpOE.pressao_pico,
                    complacencia: summaryData.compl_estatica_oe
                      ? Number(summaryData.compl_estatica_oe)
                      : timpOE.complacencia,
                  }}
                  showLegend={false}
                  showTitle={false}
                />
              </div>
              <div className="w-full flex justify-between items-center text-xs font-bold text-blue-700 mt-1 px-1">
                <span>ESQUERDA</span>
                <span>CURVA TIPO</span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. SELEÇÃO DE CURVA */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs font-bold text-slate-700 block mb-1">Curva Tipo (OD)</Label>
            <Select
              value={exam.tipo_curva_od || '__none'}
              onValueChange={(v) => {
                const val = v === '__none' ? '' : v
                setField('tipo_curva_od', val)
                setTimpOD((prev) => ({ ...prev, tipo_curva: val }))
              }}
              disabled={readOnly}
            >
              <SelectTrigger className="h-9 text-xs rounded-md border-slate-300">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Selecione...</SelectItem>
                {TIPOS_CURVA.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs font-bold text-slate-700 block mb-1">Curva Tipo (OE)</Label>
            <Select
              value={exam.tipo_curva_oe || '__none'}
              onValueChange={(v) => {
                const val = v === '__none' ? '' : v
                setField('tipo_curva_oe', val)
                setTimpOE((prev) => ({ ...prev, tipo_curva: val }))
              }}
              disabled={readOnly}
            >
              <SelectTrigger className="h-9 text-xs rounded-md border-slate-300">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Selecione...</SelectItem>
                {TIPOS_CURVA.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 3. BARRA DE DESTAQUE */}
        <div className="bg-sky-400 text-white font-bold text-xs py-2 px-4 text-center rounded shadow-sm">
          Definição da Curva no campo Observação
        </div>

        {/* 4. TABELAS NUMÉRICAS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start text-center">
          {/* Tabela 1: Dados Brutos (OD/OE x Inicial/Média/Final) */}
          <div className="space-y-2">
            <div className="grid grid-cols-3 text-center text-xs font-bold text-slate-700 mb-1"></div>
          </div>

          {/* Tabela 2: Resumo (Direita / Esquerda) */}
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_120px_120px] text-center text-xs font-bold mb-1">
              <div></div>
              <div className="text-red-600">DIREITA</div>
              <div className="text-blue-700">ESQUERDA</div>
            </div>

            <div className="border border-slate-300 rounded bg-white p-2 space-y-2">
              <div className="grid grid-cols-[1fr_120px_120px] items-center gap-2 text-[11px] font-bold text-slate-700 text-center">
                <span>PRESSÃO OUVIDO MÉDIO (daPa)</span>
                <Input
                  value={summaryData.pressao_om_od}
                  onChange={(e) => handleSummaryChange('pressao_om_od', e.target.value, 'OD')}
                  onInput={(e) =>
                    handleSummaryChange('pressao_om_od', (e.target as HTMLInputElement).value, 'OD')
                  }
                  disabled={readOnly}
                  className="h-8 text-center text-xs rounded border-slate-300 bg-slate-100"
                />
                <Input
                  value={summaryData.pressao_om_oe}
                  onChange={(e) => handleSummaryChange('pressao_om_oe', e.target.value, 'OE')}
                  onInput={(e) =>
                    handleSummaryChange('pressao_om_oe', (e.target as HTMLInputElement).value, 'OE')
                  }
                  disabled={readOnly}
                  className="h-8 text-center text-xs rounded border-slate-300 bg-slate-100"
                />
              </div>

              <div className="grid grid-cols-[1fr_120px_120px] items-center gap-2 text-[11px] font-bold text-slate-700 text-center">
                <span>COMPLIÂNCIA (ml)</span>
                <Input
                  value={summaryData.max_relax_od}
                  onChange={(e) => handleSummaryChange('max_relax_od', e.target.value, 'OD')}
                  onInput={(e) =>
                    handleSummaryChange('max_relax_od', (e.target as HTMLInputElement).value, 'OD')
                  }
                  disabled={readOnly}
                  className="h-8 text-center text-xs rounded border-slate-300 bg-slate-100"
                />
                <Input
                  value={summaryData.max_relax_oe}
                  onChange={(e) => handleSummaryChange('max_relax_oe', e.target.value, 'OE')}
                  onInput={(e) =>
                    handleSummaryChange('max_relax_oe', (e.target as HTMLInputElement).value, 'OE')
                  }
                  disabled={readOnly}
                  className="h-8 text-center text-xs rounded border-slate-300 bg-slate-100"
                />
              </div>

              <div className="grid grid-cols-[1fr_120px_120px] items-center gap-2 text-[11px] font-bold text-slate-700 text-center">
                <span>VOLUME (ml)</span>
                <Input
                  value={summaryData.compl_200_od}
                  onChange={(e) => handleSummaryChange('compl_200_od', e.target.value, 'OD')}
                  onInput={(e) =>
                    handleSummaryChange('compl_200_od', (e.target as HTMLInputElement).value, 'OD')
                  }
                  disabled={readOnly}
                  className="h-8 text-center text-xs rounded border-slate-300 bg-slate-100"
                />
                <Input
                  value={summaryData.compl_200_oe}
                  onChange={(e) => handleSummaryChange('compl_200_oe', e.target.value, 'OE')}
                  onInput={(e) =>
                    handleSummaryChange('compl_200_oe', (e.target as HTMLInputElement).value, 'OE')
                  }
                  disabled={readOnly}
                  className="h-8 text-center text-xs rounded border-slate-300 bg-slate-100"
                />
              </div>

              <div className="grid grid-cols-[1fr_120px_120px] items-center gap-2 text-[11px] font-bold text-slate-700 text-center">
                <span>COMPLIÂNCIA ESTÁTICA</span>
                <Input
                  value={summaryData.compl_estatica_od}
                  onChange={(e) => handleSummaryChange('compl_estatica_od', e.target.value, 'OD')}
                  onInput={(e) =>
                    handleSummaryChange(
                      'compl_estatica_od',
                      (e.target as HTMLInputElement).value,
                      'OD',
                    )
                  }
                  disabled={readOnly}
                  className="h-8 text-center text-xs rounded border-slate-300 bg-slate-100"
                />
                <Input
                  value={summaryData.compl_estatica_oe}
                  onChange={(e) => handleSummaryChange('compl_estatica_oe', e.target.value, 'OE')}
                  onInput={(e) =>
                    handleSummaryChange(
                      'compl_estatica_oe',
                      (e.target as HTMLInputElement).value,
                      'OE',
                    )
                  }
                  disabled={readOnly}
                  className="h-8 text-center text-xs rounded border-slate-300 bg-slate-100"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 5. REFLEXOS ACÚSTICOS */}
        <div className="space-y-2 pt-2">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Reflexos Acústicos
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2">
            {/* Grade OD (Vermelha) */}
            <div className="border border-red-500 rounded p-2.5 bg-white space-y-2">
              {/* Header Colunas */}
              <div className="grid grid-cols-4 text-center text-[11px] font-bold text-slate-700 gap-1.5 mb-1">
                <div>Limiar</div>
                <div className="flex items-center justify-center gap-0.5">
                  Refl. Contra D <Info className="w-3 h-3 text-slate-400" />
                </div>
                <div>Diferença</div>
                <div className="flex items-center justify-center gap-0.5">
                  IPSI <Info className="w-3 h-3 text-slate-400" />
                </div>
              </div>

              {[500, 1000, 2000, 4000].map((freq) => {
                const row = reflexGrid.od[freq]
                return (
                  <div key={`od-${freq}`} className="grid grid-cols-4 gap-1.5 items-center">
                    {/* Limiar */}
                    <Input
                      value={row.limiar}
                      onChange={(e) =>
                        setReflexGrid((prev) => ({
                          ...prev,
                          od: {
                            ...prev.od,
                            [freq]: { ...prev.od[freq], limiar: e.target.value },
                          },
                        }))
                      }
                      disabled={readOnly}
                      className="h-8 text-center text-xs rounded border-red-300 focus:border-red-500"
                    />

                    {/* Refl. Contra D + Botão AUS */}
                    <div className="flex items-center border border-red-300 rounded bg-white overflow-hidden h-8">
                      <input
                        type="text"
                        value={row.refl_contra}
                        onChange={(e) =>
                          setReflexGrid((prev) => ({
                            ...prev,
                            od: {
                              ...prev.od,
                              [freq]: { ...prev.od[freq], refl_contra: e.target.value },
                            },
                          }))
                        }
                        disabled={readOnly}
                        className="w-full text-center text-xs font-semibold focus:outline-none bg-transparent"
                      />
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => handleSetAus('od', freq, 'refl_contra')}
                          className="text-[10px] font-bold text-slate-500 px-1 hover:text-slate-800 border-l border-slate-200 h-full bg-slate-50"
                        >
                          AUS
                        </button>
                      )}
                    </div>

                    {/* Diferença */}
                    <Input
                      value={row.diferenca}
                      onChange={(e) =>
                        setReflexGrid((prev) => ({
                          ...prev,
                          od: {
                            ...prev.od,
                            [freq]: { ...prev.od[freq], diferenca: e.target.value },
                          },
                        }))
                      }
                      disabled={readOnly}
                      className="h-8 text-center text-xs rounded border-slate-300 bg-slate-100"
                    />

                    {/* IPSI + Botão AUS */}
                    <div className="flex items-center border border-red-300 rounded bg-white overflow-hidden h-8">
                      <input
                        type="text"
                        value={row.ipsi}
                        onChange={(e) =>
                          setReflexGrid((prev) => ({
                            ...prev,
                            od: {
                              ...prev.od,
                              [freq]: { ...prev.od[freq], ipsi: e.target.value },
                            },
                          }))
                        }
                        disabled={readOnly}
                        className="w-full text-center text-xs font-semibold focus:outline-none bg-transparent"
                      />
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => handleSetAus('od', freq, 'ipsi')}
                          className="text-[10px] font-bold text-slate-500 px-1 hover:text-slate-800 border-l border-slate-200 h-full bg-slate-50"
                        >
                          AUS
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Coluna Central de Frequências (Hz) */}
            <div className="flex flex-col justify-between py-8 px-2 text-center text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded">
              <div className="text-[10px] font-bold text-slate-400 mb-1">Freq (Hz)</div>
              <div>500</div>
              <div>1000</div>
              <div>2000</div>
              <div>4000</div>
            </div>

            {/* Grade OE (Azul) */}
            <div className="border border-blue-600 rounded p-2.5 bg-white space-y-2">
              {/* Header Colunas */}
              <div className="grid grid-cols-4 text-center text-[11px] font-bold text-slate-700 gap-1.5 mb-1">
                <div>Limiar</div>
                <div className="flex items-center justify-center gap-0.5">
                  Refl. Contra E <Info className="w-3 h-3 text-slate-400" />
                </div>
                <div>Diferença</div>
                <div className="flex items-center justify-center gap-0.5">
                  IPSI <Info className="w-3 h-3 text-slate-400" />
                </div>
              </div>

              {[500, 1000, 2000, 4000].map((freq) => {
                const row = reflexGrid.oe[freq]
                return (
                  <div key={`oe-${freq}`} className="grid grid-cols-4 gap-1.5 items-center">
                    {/* Limiar */}
                    <Input
                      value={row.limiar}
                      onChange={(e) =>
                        setReflexGrid((prev) => ({
                          ...prev,
                          oe: {
                            ...prev.oe,
                            [freq]: { ...prev.oe[freq], limiar: e.target.value },
                          },
                        }))
                      }
                      disabled={readOnly}
                      className="h-8 text-center text-xs rounded border-blue-300 focus:border-blue-500"
                    />

                    {/* Refl. Contra E + Botão AUS */}
                    <div className="flex items-center border border-blue-300 rounded bg-white overflow-hidden h-8">
                      <input
                        type="text"
                        value={row.refl_contra}
                        onChange={(e) =>
                          setReflexGrid((prev) => ({
                            ...prev,
                            oe: {
                              ...prev.oe,
                              [freq]: { ...prev.oe[freq], refl_contra: e.target.value },
                            },
                          }))
                        }
                        disabled={readOnly}
                        className="w-full text-center text-xs font-semibold focus:outline-none bg-transparent"
                      />
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => handleSetAus('oe', freq, 'refl_contra')}
                          className="text-[10px] font-bold text-slate-500 px-1 hover:text-slate-800 border-l border-slate-200 h-full bg-slate-50"
                        >
                          AUS
                        </button>
                      )}
                    </div>

                    {/* Diferença */}
                    <Input
                      value={row.diferenca}
                      onChange={(e) =>
                        setReflexGrid((prev) => ({
                          ...prev,
                          oe: {
                            ...prev.oe,
                            [freq]: { ...prev.oe[freq], diferenca: e.target.value },
                          },
                        }))
                      }
                      disabled={readOnly}
                      className="h-8 text-center text-xs rounded border-slate-300 bg-slate-100"
                    />

                    {/* IPSI + Botão AUS */}
                    <div className="flex items-center border border-blue-300 rounded bg-white overflow-hidden h-8">
                      <input
                        type="text"
                        value={row.ipsi}
                        onChange={(e) =>
                          setReflexGrid((prev) => ({
                            ...prev,
                            oe: {
                              ...prev.oe,
                              [freq]: { ...prev.oe[freq], ipsi: e.target.value },
                            },
                          }))
                        }
                        disabled={readOnly}
                        className="w-full text-center text-xs font-semibold focus:outline-none bg-transparent"
                      />
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => handleSetAus('oe', freq, 'ipsi')}
                          className="text-[10px] font-bold text-slate-500 px-1 hover:text-slate-800 border-l border-slate-200 h-full bg-slate-50"
                        >
                          AUS
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* 6. RODAPÉ (REFERÊNCIA E OBSERVAÇÃO) */}
        <div className="space-y-3 pt-2">
          <div>
            <Label className="text-xs font-bold text-slate-700 block mb-1">Referência</Label>
            <Select
              value={exam.referencias || DEFAULT_REFERENCIAS}
              onValueChange={(v) => setField('referencias', v)}
              disabled={readOnly}
            >
              <SelectTrigger className="h-9 text-xs rounded-md border-slate-300">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={DEFAULT_REFERENCIAS}>
                  Jerger (1970); Margolis e Heller (1987); Stach (1998)
                </SelectItem>
                <SelectItem value="Avaliação imitanciométrica padronizada conforme protocolos clínicos nacionais.">
                  Protocolo Nacional Simplificado
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs font-bold text-slate-700 block mb-1">Observação</Label>
            <Textarea
              value={exam.observacoes}
              onChange={(e) => setField('observacoes', e.target.value)}
              disabled={readOnly}
              rows={4}
              placeholder="Digite aqui as observações do exame..."
              className="rounded-md text-xs border-slate-300 resize-y"
            />
          </div>
        </div>

        {/* 7. NAVEGAÇÃO (ANTERIOR / PRÓXIMO) */}
        <div className="flex justify-between items-center pt-4 border-t border-slate-200">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(`/pacientes/${patient.id}/audiometria/novo`)}
            className="border-slate-300 text-slate-700 text-xs font-semibold h-8 rounded"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Anterior
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(`/pacientes/${patient.id}/prontuario`)}
            className="border-slate-300 text-slate-700 text-xs font-semibold h-8 rounded"
          >
            Próximo
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
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
              className="rounded-lg text-xs"
            >
              Fechar
            </Button>
            <Button
              onClick={() => {
                setPreviewOpen(false)
                handlePrint()
              }}
              className="rounded-lg text-xs bg-blue-600 hover:bg-blue-700 text-white"
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
