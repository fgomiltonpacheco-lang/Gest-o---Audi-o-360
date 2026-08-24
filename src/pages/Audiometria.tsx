import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '@/context/AppContext'
import { useToast } from '@/hooks/use-toast'
import { fillAudiometriaTemplatePdf, openPdfInNewTab } from '@/lib/pdfTemplateFiller'
import { AudiogramChart } from '@/components/AudiogramChart'
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
  FileText,
  Wand2,
  Loader2,
  RotateCcw,
  AlertTriangle,
  Copy,
  Info,
  CheckCircle2,
  FileEdit,
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getEquipmentStatus } from '@/types'
import {
  AIR_FREQS,
  BONE_FREQS,
  AudiogramMap,
  AudiogramSymbol,
  AudiometryExamFull,
  IprfVocalData,
  LOSS_DEGREE_OPTIONS,
  LOSS_TYPE_OPTIONS,
  LOSS_CONFIGURATION_OPTIONS,
  emptyAudiogramMap,
  emptyIprfVocal,
  emptyAudiometryExamFull,
  ClinicSettings,
} from '@/types'
import { calculateAge, formatDate, maskCPF } from '@/lib/formatters'
import { mediaTritonal, mediaQuadritonal } from '@/lib/audiogram'
import logoImg from '@/assets/audicao-360-logo-para-papel-timbrado-da364.png'

/* Frequências da grade horizontal (via aérea e LDL). */
const ALL_INPUT_FREQS = [
  '250',
  '500',
  '750',
  '1000',
  '1500',
  '2000',
  '3000',
  '4000',
  '6000',
  '8000',
] as const

/* Via Óssea: apenas 500, 1000, 2000, 3000 e 4000 Hz. */
const BONE_FREQ_SET = new Set<string>(BONE_FREQS)

const DEFAULT_AUDIOMETER = 'AD229b'
const SPECIALIST_NAME = 'MILTON SOARES PACHECO'
const SPECIALIST_CRFA = '3-11981-5'
const CLINIC_ADDRESS = 'R. Sadoc Correa, 373 - St. Central, Araguaína - TO, 77803-060'
const CLINIC_PHONE = '(63) 3421-2611'
const REPORT_REFERENCE =
  'Lloyd e Kaplan (1978); Silman e Silverman (1997) adaptada de Carhart (1945) e Lloyd e Kaplan (1978); Jerger, Speaks, e Trammell (1968).'

/* ---------- Mappers ---------- */
/* eslint-disable @typescript-eslint/no-explicit-any */

function normalizeMap(raw: any, freqs: readonly string[]): AudiogramMap {
  const m: AudiogramMap = {}
  freqs.forEach((f) => {
    const v = raw?.[f]
    if (v && typeof v === 'object') {
      m[f] = {
        db: v.db === null || v.db === undefined ? null : Number(v.db),
        symbol: (v.symbol as AudiogramSymbol) || 'normal',
      }
    } else {
      m[f] = { db: null, symbol: 'normal' }
    }
  })
  return m
}

function normalizeIprfVocal(raw: any): IprfVocalData {
  if (!raw || typeof raw !== 'object') return emptyIprfVocal()
  const norm = (r: any) => ({
    intensidade: r?.intensidade ?? '',
    monossilabos: r?.monossilabos ?? '',
    dissilabos: r?.dissilabos ?? '',
    // Retrocompatibilidade: registros antigos não possuem estes campos.
    mascaramento: r?.mascaramento ?? '',
    palavras_faladas: r?.palavras_faladas ?? '',
    niveis: r?.niveis ?? '',
  })
  return { od: norm(raw.od), oe: norm(raw.oe) }
}

function numOr(v: any): number | null {
  return v != null && v !== '' ? Number(v) : null
}

function mapExam(r: any): AudiometryExamFull {
  return {
    id: r.id,
    patientId: r.patient || r.patientId || '',
    patientName: r.patientName || '',
    created_by: r.created_by || '',
    status: r.status || 'rascunho',
    date: r.date || '',
    cpf: r.cpf || '',
    dob: r.dob || '',
    age: r.age || '',
    sex: r.sex || '',
    referred_by: r.referred_by || '',
    hearing_rest_14h: !!r.hearing_rest_14h,
    audiometer: r.audiometer || DEFAULT_AUDIOMETER,
    calibration: r.calibration || '',
    otoscopy_od:
      r.otoscopy_od === 'Alterada' ? 'Alterada' : r.otoscopy_od === 'Normal' ? 'Normal' : '',
    otoscopy_od_obs: r.otoscopy_od_obs || '',
    otoscopy_oe:
      r.otoscopy_oe === 'Alterada' ? 'Alterada' : r.otoscopy_oe === 'Normal' ? 'Normal' : '',
    otoscopy_oe_obs: r.otoscopy_oe_obs || '',
    air_od: normalizeMap(r.air_od, AIR_FREQS),
    air_oe: normalizeMap(r.air_oe, AIR_FREQS),
    bone_od: normalizeMap(r.bone_od, BONE_FREQS),
    bone_oe: normalizeMap(r.bone_oe, BONE_FREQS),
    ldl_od: normalizeMap(r.ldl_od, AIR_FREQS),
    ldl_oe: normalizeMap(r.ldl_oe, AIR_FREQS),
    mt_od: numOr(r.mt_od),
    mt_oe: numOr(r.mt_oe),
    lrf_od: numOr(r.lrf_od),
    lrf_oe: numOr(r.lrf_oe),
    ldv_od: numOr(r.ldv_od),
    ldv_oe: numOr(r.ldv_oe),
    iprf: {
      od: { intensidade: '', monossilabos: '', dissilabos: '', mascaramento: '', palavras: '' },
      oe: { intensidade: '', monossilabos: '', dissilabos: '', mascaramento: '', palavras: '' },
    },
    iprf_od: numOr(r.iprf_od),
    iprf_oe: numOr(r.iprf_oe),
    iprf_vocal: normalizeIprfVocal(r.iprf_vocal),
    iprf_levels_od: r.iprf_levels_od || '',
    iprf_levels_oe: r.iprf_levels_oe || '',
    srt_od: numOr(r.srt_od),
    srt_oe: numOr(r.srt_oe),
    masking_air_od: numOr(r.masking_air_od),
    masking_air_oe: numOr(r.masking_air_oe),
    masking_bone_od: numOr(r.masking_bone_od),
    masking_bone_oe: numOr(r.masking_bone_oe),
    meatoscopy_od: r.meatoscopy_od || '',
    meatoscopy_oe: r.meatoscopy_oe || '',
    marital_status: r.marital_status || '',
    loss_degree: r.loss_degree || '',
    loss_type: r.loss_type || '',
    loss_configuration: r.loss_configuration || '',
    report: r.report || '',
    created: r.created || '',
    updated: r.updated || '',
  }
}

/* ---------- Laudo sugerido ---------- */
function degreeFromAvg(avg: number | null): string {
  if (avg === null) return ''
  if (avg <= 25) return 'Normal'
  if (avg <= 40) return 'Leve'
  if (avg <= 55) return 'Moderada'
  if (avg <= 70) return 'Moderadamente Severa'
  if (avg <= 90) return 'Severa'
  return 'Profunda'
}

function avgAir(map: AudiogramMap): number | null {
  const freqs = ['500', '1000', '2000', '4000']
  const vals = freqs
    .map((f) => map[f]?.db)
    .filter((v): v is number => v !== null && v !== undefined)
  if (vals.length === 0) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

function determineType(air: AudiogramMap, bone: AudiogramMap): string {
  const boneFreqs = ['500', '1000', '2000', '4000']
  let hasGap = false
  let airAbnormal = false
  let boneAbnormal = false
  boneFreqs.forEach((f) => {
    const a = air[f]?.db
    const b = bone[f]?.db
    if (a !== null && a !== undefined) {
      if (a > 25) airAbnormal = true
      if (b !== null && b !== undefined) {
        if (a - b > 15) hasGap = true
        if (b > 25) boneAbnormal = true
      }
    }
  })
  if (!airAbnormal) return 'Normal'
  if (hasGap && !boneAbnormal) return 'Condutiva'
  if (hasGap && boneAbnormal) return 'Mista'
  return 'Neurossensorial'
}

function describeConfiguration(air: AudiogramMap): string {
  const order = ['250', '500', '1000', '2000', '4000', '8000']
  const pts: number[] = []
  order.forEach((f) => {
    const v = air[f]?.db
    if (v !== null && v !== undefined) pts.push(v)
  })
  if (pts.length < 3) return ''
  const low = (pts[0] + pts[1]) / 2
  const high = (pts[pts.length - 1] + pts[pts.length - 2]) / 2
  const mid = pts.length > 2 ? pts[Math.floor(pts.length / 2)] : (low + high) / 2
  const diff = high - low
  if (Math.abs(diff) <= 10) return 'Plana'
  if (diff > 10 && Math.abs(mid - low) <= 15 && Math.abs(high - mid) <= 15) return 'Descendente'
  if (diff < -10 && Math.abs(mid - low) <= 15 && Math.abs(low - mid) <= 15) return 'Ascendente'
  return 'Mista'
}

function buildSuggestedReport(
  airOD: AudiogramMap,
  airOE: AudiogramMap,
  boneOD: AudiogramMap,
  boneOE: AudiogramMap,
): string {
  const lines: string[] = []

  const describeEar = (air: AudiogramMap, bone: AudiogramMap, sideLabel: string) => {
    const avg = avgAir(air)
    const degree = degreeFromAvg(avg)
    const type = determineType(air, bone)
    const config = describeConfiguration(air)
    if (avg === null) {
      lines.push(`À ${sideLabel}: dados insuficientes para análise.`)
      return
    }
    if (degree === 'Normal') {
      lines.push(`Limiares auditivos dentro dos padrões de normalidade à ${sideLabel}.`)
      return
    }
    const parts = [
      `perda auditiva do tipo ${type.toLowerCase()}`,
      `de grau ${degree.toLowerCase()}`,
    ]
    if (config) parts.push(`com configuração ${config.toLowerCase()}`)
    lines.push(`À ${sideLabel}: ${parts.join(' ')}.`)
  }

  describeEar(airOD, boneOD, 'direita')
  describeEar(airOE, boneOE, 'esquerda')

  lines.push(REPORT_REFERENCE)

  const odDegree = degreeFromAvg(avgAir(airOD))
  const oeDegree = degreeFromAvg(avgAir(airOE))
  const diffLabel = (d: string) => {
    if (!d || d === 'Normal') return 'Nenhuma dificuldade'
    if (d === 'Leve') return 'Leve dificuldade'
    if (d === 'Moderada') return 'Moderada dificuldade'
    return 'Acentuada dificuldade'
  }
  lines.push(
    `${diffLabel(odDegree)} para compreender a fala à direita e ${diffLabel(
      oeDegree,
    ).toLowerCase()} para compreender a fala à esquerda. (Jerger, Speaks e Trammell, 1968).`,
  )

  return lines.join(' ')
}

function detailedAge(dob: string | undefined, refDate?: string): string {
  if (!dob) return ''
  const birth = new Date(dob + 'T00:00:00')
  if (isNaN(birth.getTime())) return ''
  const ref = refDate ? new Date(refDate + 'T00:00:00') : new Date()
  if (isNaN(ref.getTime())) return ''
  let years = ref.getFullYear() - birth.getFullYear()
  let months = ref.getMonth() - birth.getMonth()
  let days = ref.getDate() - birth.getDate()
  if (days < 0) {
    months -= 1
    const prevMonth = new Date(ref.getFullYear(), ref.getMonth(), 0)
    days += prevMonth.getDate()
  }
  if (months < 0) {
    years -= 1
    months += 12
  }
  if (years < 0) return ''
  const parts: string[] = []
  if (years > 0) parts.push(`${years} ${years === 1 ? 'ano' : 'anos'}`)
  parts.push(`${months} ${months === 1 ? 'mês' : 'meses'}`)
  parts.push(`${days} ${days === 1 ? 'dia' : 'dias'}`)
  return parts.join(', ')
}

type ExamState = Omit<AudiometryExamFull, 'id' | 'created' | 'updated'> & { id?: string }

export default function Audiometria() {
  const { id, examId } = useParams<{ id: string; examId?: string }>()
  const navigate = useNavigate()
  const { getPatient, currentUser, equipments, clinicSettings } = useApp()
  const { toast } = useToast()

  const patient = getPatient(id || '')
  const isSecretaria = currentUser?.role === 'secretaria'
  const isNew = !examId || examId === 'novo'

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [exam, setExam] = useState<ExamState>(() => {
    const base = emptyAudiometryExamFull(id || '', patient?.name || '')
    return { ...base, status: 'rascunho', audiometer: DEFAULT_AUDIOMETER }
  })

  const readOnly = isSecretaria || exam?.status === 'finalizado'

  const loadExam = useCallback(async () => {
    if (!examId || examId === 'novo') return
    setLoading(true)
    try {
      const rec: any = await pb.collection('audiometry_exams').getOne(examId)
      const mapped = mapExam(rec)
      const { id: _id, created: _c, updated: _u, ...rest } = mapped
      void _id
      void _c
      void _u
      setExam({ ...rest, id: mapped.id })
    } catch (err) {
      console.error('Erro ao carregar audiometria:', err)
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

  useEffect(() => {
    if (isNew && patient) {
      const age = calculateAge(patient.birthDate)
      setExam((prev) => ({
        ...prev,
        patientId: patient.id,
        patientName: patient.name,
        cpf: patient.cpf || '',
        dob: patient.birthDate || '',
        age: age !== null ? String(age) : '',
        sex: patient.gender || '',
        audiometer: prev.audiometer || DEFAULT_AUDIOMETER,
      }))
    }
  }, [patient?.id, isNew])

  // ---------- Equipamentos (audiômetro) ----------
  // Pré-seleciona automaticamente quando há apenas 1 equipamento cadastrado,
  // ou sincroniza a data de calibração do equipamento selecionado.
  const selectedEquipment = useMemo(
    () => equipments.find((e) => e.nome === exam.audiometer) || null,
    [equipments, exam.audiometer],
  )

  useEffect(() => {
    // Se ainda não há audiômetro definido e existe apenas 1 equipamento, pré-seleciona.
    if (equipments.length === 1 && !selectedEquipment) {
      const eq = equipments[0]
      setExam((prev) => ({
        ...prev,
        audiometer: eq.nome,
        calibration: eq.data_calibracao || prev.calibration,
      }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipments])

  const equipmentStatus = selectedEquipment
    ? getEquipmentStatus(selectedEquipment.proxima_calibracao)
    : 'valid'

  const patientAgeDetailed = useMemo(() => detailedAge(exam.dob, exam.date), [exam.dob, exam.date])

  const setField = <K extends keyof ExamState>(key: K, value: ExamState[K]) => {
    setExam((prev) => ({ ...prev, [key]: value }))
  }

  const setPoint = (
    target: 'air_od' | 'air_oe' | 'bone_od' | 'bone_oe' | 'ldl_od' | 'ldl_oe',
    freq: string,
    patch: Partial<{ db: number | null; symbol: AudiogramSymbol }>,
  ) => {
    setExam((prev) => {
      const map = { ...(prev[target] || {}) }
      const cur = map[freq] || { db: null, symbol: 'normal' }
      let nextSymbol = cur.symbol

      // Se o usuário está digitando um valor de dB, se symbol não foi explicitamente alterado e ainda for normal, mantém normal.
      // Se symbol foi passado, atualiza.
      if ('symbol' in patch && patch.symbol) {
        nextSymbol = patch.symbol
      } else if ('db' in patch && !cur.symbol) {
        nextSymbol = 'normal'
      }

      map[freq] = { ...cur, ...patch, symbol: nextSymbol }
      return { ...prev, [target]: map }
    })
  }

  const copyValuesToOtherEar = (fromEar: 'OD' | 'OE') => {
    const toEar = fromEar === 'OD' ? 'OE' : 'OD'
    setExam((prev) => {
      if (fromEar === 'OD') {
        return {
          ...prev,
          air_oe: JSON.parse(JSON.stringify(prev.air_od)),
          bone_oe: JSON.parse(JSON.stringify(prev.bone_od)),
          ldl_oe: JSON.parse(JSON.stringify(prev.ldl_od)),
          srt_oe: prev.srt_od,
          ldv_oe: prev.ldv_od,
          iprf_vocal: {
            ...prev.iprf_vocal,
            oe: JSON.parse(JSON.stringify(prev.iprf_vocal.od)),
          },
        }
      } else {
        return {
          ...prev,
          air_od: JSON.parse(JSON.stringify(prev.air_oe)),
          bone_od: JSON.parse(JSON.stringify(prev.bone_oe)),
          ldl_od: JSON.parse(JSON.stringify(prev.ldl_oe)),
          srt_od: prev.srt_oe,
          ldv_od: prev.ldv_oe,
          iprf_vocal: {
            ...prev.iprf_vocal,
            od: JSON.parse(JSON.stringify(prev.iprf_vocal.oe)),
          },
        }
      }
    })
    toast({
      title: `Valores replicados`,
      description: `Valores copiados de Orelha ${fromEar === 'OD' ? 'Direita' : 'Esquerda'} para Orelha ${
        toEar === 'OD' ? 'Direita' : 'Esquerda'
      }.`,
    })
  }

  const handleDbInput = (raw: string): number | null => {
    if (raw === '') return null
    const n = Number(raw)
    if (isNaN(n)) return null
    if (n < -10) return -10
    if (n > 120) return 120
    return n
  }

  const handleSave = async (finalizar = false) => {
    if (!patient) {
      toast({ title: 'Paciente não encontrado', variant: 'destructive' })
      return
    }
    setSaving(true)
    const nextStatus = finalizar ? 'finalizado' : exam.status || 'rascunho'
    // MT (Média Tritonal) calculada automaticamente a partir do mapa aéreo
    // quando não estiver explicitamente preenchida. LRF usa srt como fallback.
    //
    // mediaTritonal espera AudiogramMap (Record<string, {db, symbol}>), mas o
    // banco pode ter persistido air_od/air_oe como Record<string, number>
    // (formato plano). Normalizamos antes de chamar para garantir o cálculo.
    const toAudiogramMap = (raw: any): AudiogramMap => {
      if (!raw || typeof raw !== 'object') return {}
      const out: AudiogramMap = {}
      Object.keys(raw).forEach((f) => {
        const v = raw[f]
        if (v !== null && v !== undefined && typeof v === 'object') {
          out[f] = {
            db: v.db === null || v.db === undefined ? null : Number(v.db),
            symbol: (v.symbol as AudiogramSymbol) || 'normal',
          }
        } else if (v !== null && v !== undefined && v !== '') {
          // valor plano (number) — converte para o formato esperado
          out[f] = { db: Number(v), symbol: 'normal' }
        }
      })
      return out
    }
    const airOdMap = toAudiogramMap(exam.air_od)
    const airOeMap = toAudiogramMap(exam.air_oe)
    const mtOD = exam.mt_od || mediaTritonal(airOdMap)
    const mtOE = exam.mt_oe || mediaTritonal(airOeMap)
    const lrfOD = exam.lrf_od || exam.srt_od
    const lrfOE = exam.lrf_oe || exam.srt_oe
    const payload: Record<string, any> = {
      patient: patient.id,
      patientName: patient.name,
      created_by: currentUser?.id || '',
      clinica_id: ((pb.authStore as any).model || (pb.authStore as any).record)?.clinica_id || '',
      status: nextStatus,
      date: exam.date,
      cpf: exam.cpf,
      dob: exam.dob,
      age: exam.age,
      sex: exam.sex,
      referred_by: exam.referred_by,
      hearing_rest_14h: !!exam.hearing_rest_14h,
      audiometer: exam.audiometer || DEFAULT_AUDIOMETER,
      calibration: exam.calibration,
      otoscopy_od: exam.otoscopy_od,
      otoscopy_od_obs: exam.otoscopy_od_obs,
      otoscopy_oe: exam.otoscopy_oe,
      otoscopy_oe_obs: exam.otoscopy_oe_obs,
      air_od: exam.air_od,
      air_oe: exam.air_oe,
      bone_od: exam.bone_od,
      bone_oe: exam.bone_oe,
      ldl_od: exam.ldl_od,
      ldl_oe: exam.ldl_oe,
      mt_od: mtOD,
      mt_oe: mtOE,
      lrf_od: lrfOD,
      lrf_oe: lrfOE,
      ldv_od: exam.ldv_od,
      ldv_oe: exam.ldv_oe,
      iprf: exam.iprf,
      iprf_od: exam.iprf_od,
      iprf_oe: exam.iprf_oe,
      iprf_vocal: exam.iprf_vocal,
      iprf_levels_od: exam.iprf_levels_od,
      iprf_levels_oe: exam.iprf_levels_oe,
      srt_od: exam.srt_od,
      srt_oe: exam.srt_oe,
      masking_air_od: exam.masking_air_od,
      masking_air_oe: exam.masking_air_oe,
      masking_bone_od: exam.masking_bone_od,
      masking_bone_oe: exam.masking_bone_oe,
      meatoscopy_od: exam.meatoscopy_od,
      meatoscopy_oe: exam.meatoscopy_oe,
      marital_status: exam.marital_status,
      loss_degree: exam.loss_degree,
      loss_type: exam.loss_type,
      loss_configuration: exam.loss_configuration,
      report: exam.report,
    }
    try {
      if (exam.id) {
        const rec: any = await pb.collection('audiometry_exams').update(exam.id, payload)
        const mapped = mapExam(rec)
        const { id: _id, created: _c, updated: _u, ...rest } = mapped
        void _id
        void _c
        void _u
        setExam({ ...rest, id: mapped.id, status: nextStatus })
        toast({
          title: finalizar ? 'Exame finalizado' : 'Exame atualizado',
          description: 'Audiometria salva com sucesso.',
        })
      } else {
        const rec: any = await pb.collection('audiometry_exams').create(payload)
        const mapped = mapExam(rec)
        const { id: _id, created: _c, updated: _u, ...rest } = mapped
        void _id
        void _c
        void _u
        setExam({ ...rest, id: mapped.id, status: nextStatus })
        toast({
          title: finalizar ? 'Exame finalizado' : 'Exame criado',
          description: 'Audiometria salva com sucesso.',
        })
        navigate(`/pacientes/${patient.id}/audiometria/${mapped.id}`, { replace: true })
      }
    } catch (err) {
      console.error('Erro ao salvar audiometria:', err)
      let msg = 'Não foi possível salvar o exame.'
      if (err instanceof ClientResponseError) {
        msg = err.message || msg
      }
      toast({ title: 'Erro ao salvar', description: msg, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handlePrintPdfTemplate = async () => {
    const fullExam: AudiometryExamFull = {
      ...(exam as AudiometryExamFull),
      id: exam.id || 'novo',
      created: '',
      updated: '',
    }

    let fetchUrl = clinicSettings?.template_audiometria_url || ''

    try {
      // 1. Buscar registro fresco de clinic_settings para obter o template e URL atualizada
      let freshSettings: any = null
      const clinicaId = currentUser?.clinicaId
      const knownSettingsId = clinicSettings?.id

      if (clinicaId) {
        try {
          freshSettings = await pb
            .collection('clinic_settings')
            .getFirstListItem(`clinica_id = "${clinicaId}"`)
        } catch {
          /* fallback */
        }
      }

      if (!freshSettings && knownSettingsId) {
        try {
          freshSettings = await pb.collection('clinic_settings').getOne(knownSettingsId)
        } catch {
          /* fallback */
        }
      }

      if (!freshSettings) {
        try {
          freshSettings = await pb.collection('clinic_settings').getFirstListItem('')
        } catch {
          /* fallback */
        }
      }

      const fileName = freshSettings?.template_audiometria
      if (freshSettings && fileName) {
        fetchUrl = pb.files.getUrl(freshSettings, fileName)
      }

      if (!fetchUrl) {
        toast({
          title: 'Template PDF não configurado',
          description:
            'Cadastre o arquivo de template PDF de audiometria nas Configurações da clínica.',
          variant: 'destructive',
        })
        return
      }

      const response = await fetch(fetchUrl)
      if (!response.ok) throw new Error(`Falha ao baixar template PDF: status ${response.status}`)
      const templateBytes = await response.arrayBuffer()
      // Tentar carregar logo da clínica (URL pública ou asset local)
      let logoArrayBuffer: ArrayBuffer | null = null
      const logoFileName = freshSettings?.logo || clinicSettings?.logo
      const logoCustomUrl = freshSettings?.logo_url || clinicSettings?.logo_url
      let logoFetchUrl = ''
      if (freshSettings && logoFileName) {
        logoFetchUrl = pb.files.getUrl(freshSettings, logoFileName)
      } else if (logoCustomUrl) {
        logoFetchUrl = logoCustomUrl
      } else if (logoImg) {
        logoFetchUrl = logoImg
      }

      if (logoFetchUrl) {
        try {
          const logoRes = await fetch(logoFetchUrl)
          if (logoRes.ok) {
            logoArrayBuffer = await logoRes.arrayBuffer()
          }
        } catch (logoErr) {
          console.warn('Erro ao carregar imagem da logo para o PDF:', logoErr)
        }
      }

      const filledBytes = await fillAudiometriaTemplatePdf(templateBytes, {
        exam: fullExam,
        patient,
        clinicSettings: freshSettings || clinicSettings,
        professional: currentUser ? { name: currentUser.name, crmCrfa: currentUser.crmCrfa } : null,
        logoBytes: logoArrayBuffer,
      })
      openPdfInNewTab(filledBytes, `Laudo_Audiometria_${patient?.name || 'paciente'}.pdf`)
    } catch (err) {
      console.error('Erro ao preencher PDF template:', err)
      toast({
        title: 'Erro ao gerar laudo em PDF',
        description: 'Não foi possível carregar ou preencher o template PDF.',
        variant: 'destructive',
      })
    }
  }

  const handleSuggestedReport = () => {
    const text = buildSuggestedReport(exam.air_od, exam.air_oe, exam.bone_od, exam.bone_oe)
    setExam((prev) => ({
      ...prev,
      report: text,
      loss_degree: degreeFromAvg(avgAir(exam.air_od)) || prev.loss_degree,
      loss_type: (() => {
        const t = determineType(exam.air_od, exam.bone_od)
        return t && t !== 'Normal' ? t : prev.loss_type
      })(),
      loss_configuration: describeConfiguration(exam.air_od) || prev.loss_configuration,
    }))
    toast({ title: 'Laudo sugerido gerado', description: 'Revise e edite conforme necessário.' })
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

  return (
    <div className="space-y-3 animate-in fade-in-50 duration-200 pb-12 print:p-0 print:m-0 print:pb-0">
      {/* Cabeçalho da página */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
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
              <Activity className="w-5 h-5 text-teal-600" />
              Audiometria
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

      {/* Prévia do exame (formato clínico compacto — visível na impressão) */}
      <div className="hidden print:block">
        <ExamPreview
          exam={{
            ...(exam as AudiometryExamFull),
            patientName: patient?.name || exam.patientName || '',
          }}
          patientAgeDetailed={patientAgeDetailed}
          clinicSettings={clinicSettings}
          professional={
            currentUser ? { name: currentUser.name, crmCrfa: currentUser.crmCrfa } : null
          }
          patientConvenio={
            patient?.planType === 'Convênio'
              ? patient.planName || 'Convênio'
              : patient?.planType || 'Particular'
          }
          patientName={patient?.name}
        />
      </div>
      {/* ===================== Entrada de Dados e Visualização ===================== */}
      <div className="no-print space-y-4">
        {/* 1. Visualização em Tempo Real (Gráficos dos audiogramas no topo) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Activity className="w-4 h-4 text-teal-600" />
              Visualização em Tempo Real
            </h2>
            <span className="text-[11px] text-slate-500 font-medium">
              Atualiza conforme a digitação
            </span>
          </div>

          <AudiogramChart
            airOD={exam.air_od}
            airOE={exam.air_oe}
            boneOD={exam.bone_od}
            boneOE={exam.bone_oe}
            ldlOD={exam.ldl_od}
            ldlOE={exam.ldl_oe}
            srtOD={exam.srt_od}
            srtOE={exam.srt_oe}
            ldvOD={exam.ldv_od}
            ldvOE={exam.ldv_oe}
            hideLegend
          />

          {/* Resumo de Médias Aérea no Topo (como na imagem 1) */}
          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100 text-xs">
            <div className="text-slate-700">
              <span className="font-extrabold text-red-600 block">Orelha Direita</span>
              <span className="text-[10px] text-slate-400 block font-semibold">REF.:</span>
              <span className="text-slate-600 font-medium">Média Aérea: </span>
              <strong className="text-slate-900 font-bold">
                {mediaTritonal(exam.air_od) !== null ? mediaTritonal(exam.air_od)?.toFixed(2) : '—'}
              </strong>
            </div>
            <div className="text-slate-700">
              <span className="font-extrabold text-blue-600 block">Orelha Esquerda</span>
              <span className="text-[10px] text-slate-400 block font-semibold">REF.:</span>
              <span className="text-slate-600 font-medium">Média Aérea: </span>
              <strong className="text-slate-900 font-bold">
                {mediaTritonal(exam.air_oe) !== null ? mediaTritonal(exam.air_oe)?.toFixed(2) : '—'}
              </strong>
            </div>
          </div>
        </div>

        {/* Seletor de equipamento (audiômetro) */}
        <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1">
              <Field label="Audiômetro (equipamento)">
                {equipments.length === 0 ? (
                  <Input
                    value={exam.audiometer || ''}
                    onChange={(e) => setField('audiometer', e.target.value)}
                    placeholder="Nenhum equipamento cadastrado — digite o nome"
                    disabled={readOnly}
                    readOnly={readOnly}
                    className="h-9 rounded-xl text-xs font-medium border-slate-300 bg-white"
                  />
                ) : (
                  <Select
                    value={exam.audiometer || '__none'}
                    onValueChange={(v) => {
                      const eq = equipments.find((e) => e.nome === v)
                      setExam((prev) => ({
                        ...prev,
                        audiometer: v === '__none' ? '' : v,
                        calibration: eq?.data_calibracao || prev.calibration,
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
                        <SelectItem key={eq.id} value={eq.nome}>
                          {eq.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Field>
            </div>
            <div className="sm:w-48">
              <Field label="Data da Calibração">
                <Input
                  type="date"
                  value={exam.calibration || ''}
                  onChange={(e) => setField('calibration', e.target.value)}
                  disabled={readOnly}
                  readOnly={readOnly}
                  className="h-9 rounded-xl text-xs font-medium border-slate-300 bg-white"
                />
              </Field>
            </div>
          </div>
          {selectedEquipment && equipmentStatus === 'expired' && (
            <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                Calibração do equipamento {selectedEquipment.nome} está vencida desde{' '}
                {formatDate(selectedEquipment.proxima_calibracao)}. Renove a calibração antes de
                utilizar.
              </span>
            </div>
          )}
          {selectedEquipment && equipmentStatus === 'expiring' && (
            <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                Calibração do equipamento {selectedEquipment.nome} vence em{' '}
                {formatDate(selectedEquipment.proxima_calibracao)}.
              </span>
            </div>
          )}
        </div>

        {/* 2. Interface por Abas: Orelha Direita / Orelha Esquerda */}
        <Tabs defaultValue="od" className="w-full">
          <TabsList className="bg-slate-100 p-1 rounded-xl border border-slate-200 h-auto">
            <TabsTrigger
              value="od"
              className="data-[state=active]:bg-white data-[state=active]:text-red-600 font-extrabold text-xs px-5 py-2 rounded-lg transition-all"
            >
              Orelha Direita
            </TabsTrigger>
            <TabsTrigger
              value="oe"
              className="data-[state=active]:bg-white data-[state=active]:text-blue-600 font-extrabold text-xs px-5 py-2 rounded-lg transition-all"
            >
              Orelha Esquerda
            </TabsTrigger>
          </TabsList>

          {/* ABA ORELHA DIREITA */}
          <TabsContent value="od" className="space-y-4 mt-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              {/* Botão de Replicação de Valores + Indicador OD */}
              <div className="flex items-center justify-between gap-3 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-red-50 border border-red-200 text-red-600 font-extrabold text-sm flex items-center justify-center">
                    D
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">Audiometria Orelha Direita</h3>
                </div>
                {!readOnly && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copyValuesToOtherEar('OD')}
                    className="bg-slate-700 hover:bg-slate-800 text-white border-slate-700 rounded-xl text-xs font-semibold h-8"
                  >
                    <Copy className="w-3.5 h-3.5 mr-1.5" />
                    Replicar Valores para outra Orelha
                  </Button>
                )}
              </div>

              {/* Grade tonal OD */}
              <EarAudiometrySection
                side="OD"
                airMap={exam.air_od}
                boneMap={exam.bone_od}
                ldlMap={exam.ldl_od}
                onAirDb={(f, raw) => setPoint('air_od', f, { db: handleDbInput(raw) })}
                onAirSym={(f, sym) => setPoint('air_od', f, { symbol: sym })}
                onBoneDb={(f, raw) => setPoint('bone_od', f, { db: handleDbInput(raw) })}
                onBoneSym={(f, sym) => setPoint('bone_od', f, { symbol: sym })}
                onLdlDb={(f, raw) => setPoint('ldl_od', f, { db: handleDbInput(raw) })}
                onLdlSym={(f, sym) => setPoint('ldl_od', f, { symbol: sym })}
                disabled={readOnly}
              />

              {/* Seção Audiometria Vocal & IPRF OD (conforme imagem 3) */}
              <EarVocalAndIprfSection
                side="OD"
                exam={exam}
                setField={setField}
                disabled={readOnly}
                isSecretaria={isSecretaria}
              />
            </div>
          </TabsContent>

          {/* ABA ORELHA ESQUERDA */}
          <TabsContent value="oe" className="space-y-4 mt-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              {/* Botão de Replicação de Valores + Indicador OE */}
              <div className="flex items-center justify-between gap-3 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 font-extrabold text-sm flex items-center justify-center">
                    E
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">Audiometria Orelha Esquerda</h3>
                </div>
                {!readOnly && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copyValuesToOtherEar('OE')}
                    className="bg-slate-700 hover:bg-slate-800 text-white border-slate-700 rounded-xl text-xs font-semibold h-8"
                  >
                    <Copy className="w-3.5 h-3.5 mr-1.5" />
                    Replicar Valores para outra Orelha
                  </Button>
                )}
              </div>

              {/* Grade tonal OE */}
              <EarAudiometrySection
                side="OE"
                airMap={exam.air_oe}
                boneMap={exam.bone_oe}
                ldlMap={exam.ldl_oe}
                onAirDb={(f, raw) => setPoint('air_oe', f, { db: handleDbInput(raw) })}
                onAirSym={(f, sym) => setPoint('air_oe', f, { symbol: sym })}
                onBoneDb={(f, raw) => setPoint('bone_oe', f, { db: handleDbInput(raw) })}
                onBoneSym={(f, sym) => setPoint('bone_oe', f, { symbol: sym })}
                onLdlDb={(f, raw) => setPoint('ldl_oe', f, { db: handleDbInput(raw) })}
                onLdlSym={(f, sym) => setPoint('ldl_oe', f, { symbol: sym })}
                disabled={readOnly}
              />

              {/* Seção Audiometria Vocal & IPRF OE */}
              <EarVocalAndIprfSection
                side="OE"
                exam={exam}
                setField={setField}
                disabled={readOnly}
                isSecretaria={isSecretaria}
              />
            </div>
          </TabsContent>
        </Tabs>

        {/* Grau / Tipo / Configuração / Parecer */}
        <Section title="Parecer Audiológico" icon={<FileText className="w-4 h-4 text-teal-600" />}>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Grau da Perda">
                <Select
                  value={exam.loss_degree || '__none'}
                  onValueChange={(v) => setField('loss_degree', v === '__none' ? '' : v)}
                  disabled={readOnly}
                >
                  <SelectTrigger className="h-8 rounded-xl text-[11px]">
                    <SelectValue placeholder="Selecione o grau" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">—</SelectItem>
                    {LOSS_DEGREE_OPTIONS.map((g) => (
                      <SelectItem key={g} value={g}>
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Tipo da Perda">
                <Select
                  value={exam.loss_type || '__none'}
                  onValueChange={(v) => setField('loss_type', v === '__none' ? '' : v)}
                  disabled={readOnly}
                >
                  <SelectTrigger className="h-8 rounded-xl text-[11px]">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">—</SelectItem>
                    {LOSS_TYPE_OPTIONS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Configuração">
                <Select
                  value={exam.loss_configuration || '__none'}
                  onValueChange={(v) => setField('loss_configuration', v === '__none' ? '' : v)}
                  disabled={readOnly}
                >
                  <SelectTrigger className="h-8 rounded-xl text-[11px]">
                    <SelectValue placeholder="Selecione a configuração" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">—</SelectItem>
                    {LOSS_CONFIGURATION_OPTIONS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-slate-700">
                Parecer / Laudo Audiológico
              </Label>
              {!readOnly && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSuggestedReport}
                  className="rounded-xl border-slate-300 text-xs font-semibold h-8"
                >
                  <Wand2 className="w-3.5 h-3.5 mr-1" />
                  Gerar Laudo Sugerido
                </Button>
              )}
            </div>
            <Textarea
              value={exam.report}
              onChange={(e) => setField('report', e.target.value)}
              disabled={readOnly}
              readOnly={readOnly}
              placeholder="Descreva o parecer audiológico..."
              rows={6}
              className="rounded-xl text-xs border-slate-300 resize-y"
            />
            <p className="text-[10px] text-slate-500 italic text-justify">{REPORT_REFERENCE}</p>
          </div>
        </Section>
      </div>

      {/* Rodapé de ações */}
      <div className="no-print flex flex-col sm:flex-row items-center justify-end gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
        <Button
          variant="outline"
          onClick={() => window.print()}
          className="rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold h-10 w-full sm:w-auto"
        >
          <Printer className="w-4 h-4 mr-1.5" />
          Imprimir Laudo
        </Button>
        {!readOnly && (
          <>
            <Button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold h-10 shadow-sm w-full sm:w-auto"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-1.5" />
              )}
              Salvar
            </Button>
            <Button
              onClick={() => handleSave(true)}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold h-10 shadow-sm w-full sm:w-auto"
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
    </div>
  )
}

/* =========================================================================
   COMPONENTE: Seção Audiometria Orelha Direita (vermelho) / Esquerda (azul)
   Grade horizontal idêntica à imagem clínica anexada
   ========================================================================= */

interface EarAudiometrySectionProps {
  side: 'OD' | 'OE'
  airMap: AudiogramMap
  boneMap: AudiogramMap
  ldlMap?: AudiogramMap
  onAirDb: (freq: string, raw: string) => void
  onAirSym: (freq: string, sym: AudiogramSymbol) => void
  onBoneDb: (freq: string, raw: string) => void
  onBoneSym: (freq: string, sym: AudiogramSymbol) => void
  onLdlDb: (freq: string, raw: string) => void
  onLdlSym: (freq: string, sym: AudiogramSymbol) => void
  disabled?: boolean
}

function EarAudiometrySection({
  side,
  airMap,
  boneMap,
  ldlMap = {},
  onAirDb,
  onAirSym,
  onBoneDb,
  onBoneSym,
  onLdlDb,
  onLdlSym,
  disabled,
}: EarAudiometrySectionProps) {
  const isOd = side === 'OD'
  const titleColor = isOd ? 'text-red-600' : 'text-blue-600'
  const headerFreqColor = isOd ? 'text-red-500' : 'text-blue-500'
  const title = isOd ? 'Audiometria Orelha Direita' : 'Audiometria Orelha Esquerda'

  const fmtFreq = (f: string) => (Number(f) >= 1000 ? `${Number(f) / 1000}k` : f)

  // Símbolos alternativos por linha conforme especificação:
  // Aérea OD: Mascarado △, Ausente ○↓, Mascarado Ausente △↓
  // Aérea OE: Mascarado □, Ausente ✕↓, Mascarado Ausente □↓
  // Óssea OD: Mascarado [, Ausente <↓, Mascarado Ausente [↓
  // Óssea OE: Mascarado ], Ausente >↓, Mascarado Ausente ]↓
  // LDL: Ausente (símbolo de ausência em LDL)

  const symBtnClass = (active: boolean) =>
    `px-0 py-0 min-w-[16px] h-4 text-[9px] font-bold rounded flex items-center justify-center transition-all select-none ${
      active
        ? isOd
          ? 'bg-red-600 text-white shadow-sm scale-105'
          : 'bg-blue-600 text-white shadow-sm scale-105'
        : 'text-slate-700 hover:bg-slate-200 border border-slate-200 bg-white'
    }`

  const resetBtnClass = (active: boolean) =>
    `p-0.5 w-3.5 h-4 text-[10px] rounded flex items-center justify-center transition-all ${
      active
        ? 'text-slate-400 bg-slate-100'
        : 'text-slate-500 hover:bg-slate-200 border border-slate-200 bg-slate-50'
    }`

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-1.5 sm:p-2 space-y-2">
      <h2 className={`text-[11px] font-extrabold tracking-tight ${titleColor}`}>{title}</h2>

      <div className="overflow-x-auto border border-slate-300 rounded-lg bg-white">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-300 bg-white">
              <th className="py-1.5 px-1 text-center text-slate-400 font-bold border-r border-slate-200 w-16">
                .
              </th>
              {ALL_INPUT_FREQS.map((f) => (
                <th
                  key={f}
                  className={`py-1 px-0 text-center font-bold border-r border-slate-200 min-w-[28px] ${headerFreqColor}`}
                >
                  {fmtFreq(f)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {/* 1. Linha Aérea (Inputs dB) */}
            <tr>
              <td className="py-1 px-1 font-bold text-slate-800 text-right border-r border-slate-200 bg-white text-[10px]">
                Aérea
              </td>
              {ALL_INPUT_FREQS.map((f) => {
                const dbVal = airMap[f]?.db
                return (
                  <td key={f} className="p-0.5 border-r border-slate-200 text-center align-middle">
                    <input
                      type="number"
                      value={dbVal ?? ''}
                      onChange={(e) => onAirDb(f, e.target.value)}
                      disabled={disabled}
                      readOnly={disabled}
                      placeholder=""
                      className={`w-full h-6 px-0 text-center text-[10px] font-semibold rounded bg-slate-100 border border-slate-300 focus:bg-white focus:outline-none focus:ring-2 ${
                        isOd ? 'focus:ring-red-400' : 'focus:ring-blue-400'
                      }`}
                    />
                  </td>
                )
              })}
            </tr>

            {/* 2. Linha Masc / Ausências (Aérea) */}
            <tr>
              <td className="py-1 px-1 font-bold text-slate-800 text-right border-r border-slate-200 bg-white text-[10px]">
                Masc / Ausências
              </td>
              {ALL_INPUT_FREQS.map((f) => {
                const sym = airMap[f]?.symbol || 'normal'
                return (
                  <td key={f} className="p-0.5 border-r border-slate-200 text-center align-middle">
                    <div className="flex items-center justify-center gap-0">
                      {isOd ? (
                        <>
                          {/* OD Aérea alternativos: Mascarado △, Ausente ○↓, Mascarado Ausente △↓ */}
                          <button
                            type="button"
                            onClick={() => onAirSym(f, sym === 'masked' ? 'normal' : 'masked')}
                            disabled={disabled}
                            title="Mascarado (△)"
                            className={symBtnClass(sym === 'masked')}
                          >
                            △
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onAirSym(f, sym === 'no_response' ? 'normal' : 'no_response')
                            }
                            disabled={disabled}
                            title="Ausente (○↓)"
                            className={symBtnClass(sym === 'no_response')}
                          >
                            ○↓
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onAirSym(
                                f,
                                sym === 'masked_no_response' ? 'normal' : 'masked_no_response',
                              )
                            }
                            disabled={disabled}
                            title="Mascarado Ausente (△↓)"
                            className={symBtnClass(sym === 'masked_no_response')}
                          >
                            △↓
                          </button>
                        </>
                      ) : (
                        <>
                          {/* OE Aérea alternativos: Mascarado □, Ausente ✕↓, Mascarado Ausente □↓ */}
                          <button
                            type="button"
                            onClick={() => onAirSym(f, sym === 'masked' ? 'normal' : 'masked')}
                            disabled={disabled}
                            title="Mascarado (□)"
                            className={symBtnClass(sym === 'masked')}
                          >
                            □
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onAirSym(f, sym === 'no_response' ? 'normal' : 'no_response')
                            }
                            disabled={disabled}
                            title="Ausente (✕↓)"
                            className={symBtnClass(sym === 'no_response')}
                          >
                            ✕↓
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onAirSym(
                                f,
                                sym === 'masked_no_response' ? 'normal' : 'masked_no_response',
                              )
                            }
                            disabled={disabled}
                            title="Mascarado Ausente (□↓)"
                            className={symBtnClass(sym === 'masked_no_response')}
                          >
                            □↓
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => onAirSym(f, 'normal')}
                        disabled={disabled}
                        title="Reverter ao Padrão"
                        className={resetBtnClass(sym === 'normal')}
                      >
                        <RotateCcw className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </td>
                )
              })}
            </tr>

            {/* 3. Linha Óssea (Inputs dB) — apenas 500, 1000, 2000, 3000 e 4000 Hz */}
            <tr>
              <td className="py-1 px-1 font-bold text-slate-800 text-right border-r border-slate-200 bg-white text-[10px]">
                Óssea
              </td>
              {ALL_INPUT_FREQS.map((f) => {
                if (!BONE_FREQ_SET.has(f)) {
                  return <td key={f} className="p-0.5 border-r border-slate-200" />
                }
                const dbVal = boneMap[f]?.db
                return (
                  <td key={f} className="p-0.5 border-r border-slate-200 text-center align-middle">
                    <input
                      type="number"
                      value={dbVal ?? ''}
                      onChange={(e) => onBoneDb(f, e.target.value)}
                      disabled={disabled}
                      readOnly={disabled}
                      placeholder=""
                      className={`w-full h-6 px-0 text-center text-[10px] font-semibold rounded bg-slate-100 border border-slate-300 focus:bg-white focus:outline-none focus:ring-2 ${
                        isOd ? 'focus:ring-red-400' : 'focus:ring-blue-400'
                      }`}
                    />
                  </td>
                )
              })}
            </tr>

            {/* 4. Linha Masc / Ausências (Óssea) */}
            <tr>
              <td className="py-1 px-1 font-bold text-slate-800 text-right border-r border-slate-200 bg-white text-[10px]">
                Masc / Ausências
              </td>
              {ALL_INPUT_FREQS.map((f) => {
                const sym = boneMap[f]?.symbol || 'normal'
                return (
                  <td key={f} className="p-0.5 border-r border-slate-200 text-center align-middle">
                    <div className="flex items-center justify-center gap-0 sm:gap-1">
                      {isOd ? (
                        <>
                          {/* OD Óssea alternativos: Mascarado [, Ausente <↓, Mascarado Ausente [↓ */}
                          <button
                            type="button"
                            onClick={() => onBoneSym(f, sym === 'masked' ? 'normal' : 'masked')}
                            disabled={disabled}
                            title="Mascarado ([)"
                            className={symBtnClass(sym === 'masked')}
                          >
                            [
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onBoneSym(f, sym === 'no_response' ? 'normal' : 'no_response')
                            }
                            disabled={disabled}
                            title="Ausente (<↓)"
                            className={symBtnClass(sym === 'no_response')}
                          >
                            &lt;↓
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onBoneSym(
                                f,
                                sym === 'masked_no_response' ? 'normal' : 'masked_no_response',
                              )
                            }
                            disabled={disabled}
                            title="Mascarado Ausente ([↓)"
                            className={symBtnClass(sym === 'masked_no_response')}
                          >
                            [↓
                          </button>
                        </>
                      ) : (
                        <>
                          {/* OE Óssea alternativos: Mascarado ], Ausente >↓, Mascarado Ausente ]↓ */}
                          <button
                            type="button"
                            onClick={() => onBoneSym(f, sym === 'masked' ? 'normal' : 'masked')}
                            disabled={disabled}
                            title="Mascarado (])"
                            className={symBtnClass(sym === 'masked')}
                          >
                            ]
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onBoneSym(f, sym === 'no_response' ? 'normal' : 'no_response')
                            }
                            disabled={disabled}
                            title="Ausente (>↓)"
                            className={symBtnClass(sym === 'no_response')}
                          >
                            &gt;↓
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onBoneSym(
                                f,
                                sym === 'masked_no_response' ? 'normal' : 'masked_no_response',
                              )
                            }
                            disabled={disabled}
                            title="Mascarado Ausente (]↓)"
                            className={symBtnClass(sym === 'masked_no_response')}
                          >
                            ]↓
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => onBoneSym(f, 'normal')}
                        disabled={disabled}
                        title="Reverter ao Padrão"
                        className={resetBtnClass(sym === 'normal')}
                      >
                        <RotateCcw className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </td>
                )
              })}
            </tr>

            {/* 5. Linha Limiar de Desconforto (LDL) (Inputs dB) */}
            <tr>
              <td className="py-1 px-1 font-bold text-slate-800 text-right border-r border-slate-200 bg-white text-[10px]">
                Limiar de Desconforto (LDL)
              </td>
              {ALL_INPUT_FREQS.map((f) => {
                const dbVal = ldlMap[f]?.db
                return (
                  <td key={f} className="p-0.5 border-r border-slate-200 text-center align-middle">
                    <input
                      type="number"
                      value={dbVal ?? ''}
                      onChange={(e) => onLdlDb(f, e.target.value)}
                      disabled={disabled}
                      readOnly={disabled}
                      placeholder=""
                      className={`w-full h-6 px-0 text-center text-[10px] font-semibold rounded bg-slate-100 border border-slate-300 focus:bg-white focus:outline-none focus:ring-2 ${
                        isOd ? 'focus:ring-red-400' : 'focus:ring-blue-400'
                      }`}
                    />
                  </td>
                )
              })}
            </tr>

            {/* 6. Linha Ausências (LDL) */}
            <tr>
              <td className="py-1 px-1 font-bold text-slate-800 text-right border-r border-slate-200 bg-white text-[10px]">
                Ausências
              </td>
              {ALL_INPUT_FREQS.map((f) => {
                const sym = ldlMap[f]?.symbol || 'normal'
                return (
                  <td key={f} className="p-0.5 border-r border-slate-200 text-center align-middle">
                    <div className="flex items-center justify-center gap-0 sm:gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          onLdlSym(f, sym === 'no_response' ? 'normal' : 'no_response')
                        }
                        disabled={disabled}
                        title="Ausência em LDL"
                        className={symBtnClass(sym === 'no_response')}
                      >
                        {/* Ícone estilizado de ausência em LDL conforme imagem clínica */}
                        <span className="inline-flex flex-col items-center leading-none text-[11px]">
                          <span className="font-extrabold font-mono text-xs">m</span>
                          <span className="text-[9px] -mt-1 font-bold">↓</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onLdlSym(f, 'normal')}
                        disabled={disabled}
                        title="Reverter ao Padrão"
                        className={resetBtnClass(sym === 'normal')}
                      >
                        <RotateCcw className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ---------- Subcomponentes da prévia clínica (Layout de Impressão Exato) ---------- */
function ExamPreview({
  exam,
  patientAgeDetailed: _patientAgeDetailed,
  clinicSettings,
  professional: _professional,
  patientConvenio,
  patientName,
}: {
  exam: AudiometryExamFull
  patientAgeDetailed?: string
  clinicSettings?: ClinicSettings | null
  professional?: { name: string; crmCrfa?: string } | null
  patientConvenio?: string
  patientName?: string
}) {
  const odTrito = mediaTritonal(exam.air_od)
  const oeTrito = mediaTritonal(exam.air_oe)

  const srtOdVal =
    exam.srt_od === -1
      ? 'AUS'
      : exam.srt_od !== null && exam.srt_od !== undefined
        ? `${exam.srt_od}`
        : '-'
  const srtOeVal =
    exam.srt_oe === -1
      ? 'AUS'
      : exam.srt_oe !== null && exam.srt_oe !== undefined
        ? `${exam.srt_oe}`
        : '-'
  const ldvOdVal =
    exam.ldv_od === -1
      ? 'AUS'
      : exam.ldv_od !== null && exam.ldv_od !== undefined
        ? `${exam.ldv_od}`
        : '-'
  const ldvOeVal =
    exam.ldv_oe === -1
      ? 'AUS'
      : exam.ldv_oe !== null && exam.ldv_oe !== undefined
        ? `${exam.ldv_oe}`
        : '-'

  const tritoOdVal = odTrito !== null ? `${odTrito.toFixed(0)}` : '-'
  const tritoOeVal = oeTrito !== null ? `${oeTrito.toFixed(0)}` : '-'

  const convText = patientConvenio || 'Particular'
  const audiometerText = exam.audiometer || DEFAULT_AUDIOMETER
  const rawCalib =
    exam.calibration ||
    clinicSettings?.calibracao ||
    (clinicSettings as any)?.audiometro_calibracao ||
    ''
  const calibText = rawCalib ? formatDate(rawCalib) : '-'

  return (
    <div
      className="bg-white text-slate-900 mx-auto p-4 sm:p-6 print:p-0 print:m-0 w-full font-sans clinic-audiometry"
      style={{ maxWidth: '210mm', fontFamily: 'Arial, Helvetica, sans-serif' }}
    >
      <div className="space-y-3 print:space-y-2">
        {/* Topo com Logo da Clínica Centralizada */}
        <div className="flex justify-center items-center py-2">
          <img
            src={clinicSettings?.logo_url || (clinicSettings as any)?.logo || logoImg}
            alt="Logo da Clínica"
            className="h-20 md:h-24 max-w-[280px] object-contain"
          />
        </div>

        {/* 1. Header: Título "AUDIOMETRIA" centralizado com linhas azuis horizontais */}
        <div className="py-0.5">
          <div className="w-full border-t-2 border-[#0F2B5C] mb-1.5" />
          <h1
            className="text-center text-xl font-bold tracking-widest uppercase my-1"
            style={{ color: '#0F2B5C' }}
          >
            AUDIOMETRIA
          </h1>
          <div className="w-full border-b-2 border-[#0F2B5C] mt-1.5" />
        </div>

        {/* 2. Patient Data: Caixa com borda azul e 3 colunas com sublinhados pontilhados */}
        <div className="border border-[#0F2B5C] rounded-md p-2.5 text-[11px] leading-tight text-slate-800">
          <div className="grid grid-cols-12 gap-x-4 gap-y-1.5">
            {/* Coluna 1 (NOME, CONVÊNIO, AUDIÔMETRO) */}
            <div className="col-span-6 space-y-1.5">
              <div className="flex items-baseline gap-1">
                <span className="font-bold text-[#0F2B5C] whitespace-nowrap">NOME:</span>
                <span className="flex-1 border-b border-dotted border-slate-400 font-medium px-1 text-slate-900 truncate">
                  {patientName || exam.patientName || '—'}
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-bold text-[#0F2B5C] whitespace-nowrap">CONVÊNIO:</span>
                <span className="flex-1 border-b border-dotted border-slate-400 font-medium px-1 text-slate-900 truncate">
                  {convText}
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-bold text-[#0F2B5C] whitespace-nowrap">AUDIÔMETRO:</span>
                <span className="flex-1 border-b border-dotted border-slate-400 font-medium px-1 text-slate-900 truncate">
                  {audiometerText}
                </span>
              </div>
            </div>

            {/* Coluna 2 (DATA, DN) */}
            <div className="col-span-3 space-y-1.5">
              <div className="flex items-baseline gap-1">
                <span className="font-bold text-[#0F2B5C] whitespace-nowrap">DATA:</span>
                <span className="flex-1 border-b border-dotted border-slate-400 font-medium px-1 text-slate-900 text-center">
                  {formatDate(exam.date) || '—'}
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-bold text-[#0F2B5C] whitespace-nowrap">DN:</span>
                <span className="flex-1 border-b border-dotted border-slate-400 font-medium px-1 text-slate-900 text-center">
                  {formatDate(exam.dob) || '—'}
                </span>
              </div>
            </div>

            {/* Coluna 3 (CPF, SEXO, CALIBRAÇÃO) */}
            <div className="col-span-3 space-y-1.5">
              <div className="flex items-baseline gap-1">
                <span className="font-bold text-[#0F2B5C] whitespace-nowrap">CPF:</span>
                <span className="flex-1 border-b border-dotted border-slate-400 font-medium px-1 text-slate-900 text-center truncate">
                  {maskCPF(exam.cpf) || '—'}
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-bold text-[#0F2B5C] whitespace-nowrap">SEXO:</span>
                <span className="flex-1 border-b border-dotted border-slate-400 font-medium px-1 text-slate-900 text-center">
                  {exam.sex || '—'}
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-bold text-[#0F2B5C] whitespace-nowrap">CALIBRAÇÃO:</span>
                <span className="flex-1 border-b border-dotted border-slate-400 font-medium px-1 text-slate-900 text-center truncate">
                  {calibText}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Audiogram Charts lado a lado */}
        <div className="pt-1">
          <AudiogramChart
            airOD={exam.air_od}
            airOE={exam.air_oe}
            boneOD={exam.bone_od}
            boneOE={exam.bone_oe}
            srtOD={exam.srt_od}
            srtOE={exam.srt_oe}
            ldvOD={exam.ldv_od}
            ldvOE={exam.ldv_oe}
            hideLegend
            compact
            hideSrtLdvSummary
          />
        </div>

        {/* 4. Results Layout (Side-by-Side): Esquerda (Tabelas MT/LRF/LDV e IRF) | Direita (Legenda) */}
        <div className="grid grid-cols-12 gap-3 items-start pt-1">
          {/* Coluna Esquerda: Tabelas MT/LRF/LDV e IRF */}
          <div className="col-span-7 space-y-3">
            {/* Tabela MT / LRF / LDV */}
            <div>
              <div className="text-center font-bold text-[11px] text-[#0F2B5C] mb-1">
                LIMIARES AUDIOMÉTRICOS
              </div>
              <div className="overflow-hidden rounded border border-[#0F2B5C]">
                <table className="w-full border-collapse text-[10px] text-center">
                  <thead>
                    <tr className="bg-slate-50 text-[#0F2B5C] font-bold border-b border-[#0F2B5C]">
                      <th className="py-1 px-2 border-r border-[#0F2B5C] w-1/4 text-center">
                        ORELHA
                      </th>
                      <th className="py-1 px-2 border-r border-[#0F2B5C] w-1/4 text-center">MT</th>
                      <th className="py-1 px-2 border-r border-[#0F2B5C] w-1/4 text-center">LRF</th>
                      <th className="py-1 px-2 border-r border-[#0F2B5C] w-1/4 text-center">LDV</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#0F2B5C]">
                    <tr>
                      <td className="py-1 px-2 font-bold text-red-600 border-r border-[#0F2B5C] text-center">
                        OD
                      </td>
                      <td className="py-1 px-2 font-semibold text-red-600 border-r border-[#0F2B5C] text-center">
                        {tritoOdVal !== '-' ? `${tritoOdVal} dB` : 'dB'}
                      </td>
                      <td className="py-1 px-2 font-semibold text-red-600 border-r border-[#0F2B5C] text-center">
                        {srtOdVal !== '-' ? (srtOdVal === 'AUS' ? 'AUS' : `${srtOdVal} dB`) : 'dB'}
                      </td>
                      <td className="py-1 px-2 font-semibold text-red-600 border-r border-[#0F2B5C] text-center">
                        {ldvOdVal !== '-' ? (ldvOdVal === 'AUS' ? 'AUS' : `${ldvOdVal} dB`) : 'dB'}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1 px-2 font-bold text-blue-600 border-r border-[#0F2B5C] text-center">
                        OE
                      </td>
                      <td className="py-1 px-2 font-semibold text-blue-600 border-r border-[#0F2B5C] text-center">
                        {tritoOeVal !== '-' ? `${tritoOeVal} dB` : 'dB'}
                      </td>
                      <td className="py-1 px-2 font-semibold text-blue-600 border-r border-[#0F2B5C] text-center">
                        {srtOeVal !== '-' ? (srtOeVal === 'AUS' ? 'AUS' : `${srtOeVal} dB`) : 'dB'}
                      </td>
                      <td className="py-1 px-2 font-semibold text-blue-600 border-r border-[#0F2B5C] text-center">
                        {ldvOeVal !== '-' ? (ldvOeVal === 'AUS' ? 'AUS' : `${ldvOeVal} dB`) : 'dB'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tabela IRF / IPRF */}
            <div>
              <div className="text-center font-bold text-[11px] text-[#0F2B5C] mb-1">
                ÍNDICE DE RECONHECIMENTO DE FALA (IRF)
              </div>
              <div className="overflow-hidden rounded border border-[#0F2B5C]">
                <table className="w-full border-collapse text-[10px] text-center">
                  <thead>
                    <tr className="bg-slate-50 text-[#0F2B5C] font-bold border-b border-[#0F2B5C]">
                      <th className="py-1 px-1.5 border-r border-[#0F2B5C] text-center">ORELHA</th>
                      <th className="py-1 px-1.5 border-r border-[#0F2B5C] text-center">
                        INTENSIDADE
                      </th>
                      <th className="py-1 px-1.5 border-r border-[#0F2B5C] text-center">
                        DISSÍLABOS
                      </th>
                      <th className="py-1 px-1.5 border-r border-[#0F2B5C] text-center">
                        MONOSSÍLABOS
                      </th>
                      <th className="py-1 px-1.5 border-r border-[#0F2B5C] text-center">MASC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#0F2B5C]">
                    <tr>
                      <td className="py-1 px-1.5 font-bold text-red-600 border-r border-[#0F2B5C] text-center">
                        OD
                      </td>
                      <td className="py-1 px-1.5 font-semibold text-red-600 border-r border-[#0F2B5C] text-center">
                        {exam.iprf_vocal.od.intensidade
                          ? `${exam.iprf_vocal.od.intensidade} dB`
                          : 'dB'}
                      </td>
                      <td className="py-1 px-1.5 font-semibold text-red-600 border-r border-[#0F2B5C] text-center">
                        {exam.iprf_vocal.od.dissilabos ? `${exam.iprf_vocal.od.dissilabos} %` : '%'}
                      </td>
                      <td className="py-1 px-1.5 font-semibold text-red-600 border-r border-[#0F2B5C] text-center">
                        {exam.iprf_vocal.od.monossilabos
                          ? `${exam.iprf_vocal.od.monossilabos} %`
                          : '%'}
                      </td>
                      <td className="py-1 px-1.5 font-semibold text-red-600 border-r border-[#0F2B5C] text-center">
                        {exam.iprf_vocal.od.mascaramento
                          ? `${exam.iprf_vocal.od.mascaramento} dB`
                          : 'dB'}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1 px-1.5 font-bold text-blue-600 border-r border-[#0F2B5C] text-center">
                        OE
                      </td>
                      <td className="py-1 px-1.5 font-semibold text-blue-600 border-r border-[#0F2B5C] text-center">
                        {exam.iprf_vocal.oe.intensidade
                          ? `${exam.iprf_vocal.oe.intensidade} dB`
                          : 'dB'}
                      </td>
                      <td className="py-1 px-1.5 font-semibold text-blue-600 border-r border-[#0F2B5C] text-center">
                        {exam.iprf_vocal.oe.dissilabos ? `${exam.iprf_vocal.oe.dissilabos} %` : '%'}
                      </td>
                      <td className="py-1 px-1.5 font-semibold text-blue-600 border-r border-[#0F2B5C] text-center">
                        {exam.iprf_vocal.oe.monossilabos
                          ? `${exam.iprf_vocal.oe.monossilabos} %`
                          : '%'}
                      </td>
                      <td className="py-1 px-1.5 font-semibold text-blue-600 border-r border-[#0F2B5C] text-center">
                        {exam.iprf_vocal.oe.mascaramento
                          ? `${exam.iprf_vocal.oe.mascaramento} dB`
                          : 'dB'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Coluna Direita: Tabela LEGENDA */}
          <div className="col-span-5">
            <div className="text-center font-bold text-[11px] text-[#0F2B5C] mb-1">LEGENDA</div>
            <div className="overflow-hidden rounded border border-[#0F2B5C]">
              <table className="w-full border-collapse text-[9px]">
                <thead>
                  <tr className="bg-slate-50 text-[#0F2B5C] font-bold border-b border-[#0F2B5C] text-center">
                    <th className="py-1 px-1 border-r border-[#0F2B5C] text-[8.5px] leading-tight">
                      POSICIONAMENTO DO FONE
                    </th>
                    <th className="py-1 px-1 border-r border-[#0F2B5C] text-red-600 text-[8.5px] w-16">
                      ORELHA DIREITA
                    </th>
                    <th className="py-1 px-1 border-r border-[#0F2B5C] text-blue-600 text-[8.5px] w-16">
                      ORELHA ESQUERDA
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#0F2B5C]">
                  {/* VIA AÉREA (FONE) - 4 linhas */}
                  <tr>
                    <td className="py-0.5 px-1 border-r border-[#0F2B5C] text-[8px] leading-tight text-slate-700">
                      <div className="font-bold text-[7.5px] text-[#0F2B5C] uppercase">
                        VIA AÉREA (FONE)
                      </div>
                      Presença de resposta não mascarada
                    </td>
                    <td className="py-0.5 px-1 border-r border-[#0F2B5C] text-center font-bold text-red-600 text-sm">
                      ○
                    </td>
                    <td className="py-0.5 px-1 border-r border-[#0F2B5C] text-center font-bold text-blue-600 text-sm">
                      ✕
                    </td>
                  </tr>
                  <tr>
                    <td className="py-0.5 px-1 border-r border-[#0F2B5C] text-[8px] leading-tight text-slate-700">
                      Presença de resposta mascarada
                    </td>
                    <td className="py-0.5 px-1 border-r border-[#0F2B5C] text-center font-bold text-red-600 text-xs">
                      △
                    </td>
                    <td className="py-0.5 px-1 border-r border-[#0F2B5C] text-center font-bold text-blue-600 text-xs">
                      □
                    </td>
                  </tr>
                  <tr>
                    <td className="py-0.5 px-1 border-r border-[#0F2B5C] text-[8px] leading-tight text-slate-700">
                      Ausência de resposta não mascarada
                    </td>
                    <td className="py-0.5 px-1 border-r border-[#0F2B5C] text-center font-bold text-red-600 text-xs">
                      <span className="inline-flex items-center">
                        ○<span className="text-[9px] -ml-0.5">↓</span>
                      </span>
                    </td>
                    <td className="py-0.5 px-1 border-r border-[#0F2B5C] text-center font-bold text-blue-600 text-xs">
                      <span className="inline-flex items-center">
                        ✕<span className="text-[9px] -ml-0.5">↓</span>
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-0.5 px-1 border-r border-[#0F2B5C] text-[8px] leading-tight text-slate-700">
                      Ausência de resposta mascarada
                    </td>
                    <td className="py-0.5 px-1 border-r border-[#0F2B5C] text-center font-bold text-red-600 text-xs">
                      <span className="inline-flex items-center">
                        △<span className="text-[9px] -ml-0.5">↓</span>
                      </span>
                    </td>
                    <td className="py-0.5 px-1 border-r border-[#0F2B5C] text-center font-bold text-blue-600 text-xs">
                      <span className="inline-flex items-center">
                        □<span className="text-[9px] -ml-0.5">↓</span>
                      </span>
                    </td>
                  </tr>

                  {/* VIA ÓSSEA (MASTÓIDE) - 3 linhas */}
                  <tr>
                    <td className="py-0.5 px-1 border-r border-[#0F2B5C] text-[8px] leading-tight text-slate-700">
                      <div className="font-bold text-[7.5px] text-[#0F2B5C] uppercase">
                        VIA ÓSSEA (MASTÓIDE)
                      </div>
                      Presença de resposta mascarada
                    </td>
                    <td className="py-0.5 px-1 border-r border-[#0F2B5C] text-center font-bold text-red-600 text-xs">
                      &lt;
                    </td>
                    <td className="py-0.5 px-1 border-r border-[#0F2B5C] text-center font-bold text-blue-600 text-xs">
                      &gt;
                    </td>
                  </tr>
                  <tr>
                    <td className="py-0.5 px-1 border-r border-[#0F2B5C] text-[8px] leading-tight text-slate-700">
                      Ausência de resposta não mascarada
                    </td>
                    <td className="py-0.5 px-1 border-r border-[#0F2B5C] text-center font-bold text-red-600 text-xs">
                      ]
                    </td>
                    <td className="py-0.5 px-1 border-r border-[#0F2B5C] text-center font-bold text-blue-600 text-xs">
                      [
                    </td>
                  </tr>
                  <tr>
                    <td className="py-0.5 px-1 border-r border-[#0F2B5C] text-[8px] leading-tight text-slate-700">
                      Ausência de resposta mascarada
                    </td>
                    <td className="py-0.5 px-1 border-r border-[#0F2B5C] text-center font-bold text-red-600 text-xs">
                      ↓
                    </td>
                    <td className="py-0.5 px-1 border-r border-[#0F2B5C] text-center font-bold text-blue-600 text-xs">
                      <span className="inline-flex items-center">
                        ↓<span className="text-[8px]">ₛ</span>
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 5. Parecer Audiológico: Título e caixa com borda azul arredondada + nota de referência */}
        <div className="pt-1">
          <div
            className="font-bold text-[11px] uppercase tracking-wide mb-1"
            style={{ color: '#0F2B5C' }}
          >
            PARECER AUDIOLÓGICO
          </div>
          <div className="border border-[#0F2B5C] rounded-lg p-2.5 text-[10.5px] leading-relaxed text-slate-800 min-h-[55px] whitespace-pre-wrap">
            {exam.report || 'Audiometria dentro dos padrões de normalidade bilateralmente.'}
          </div>
          <p className="text-[8px] text-slate-500 italic mt-1 leading-tight text-left">
            * Baseado nas classificações de Lloyd e Kaplan (1978); Silman e Silverman (1997)
            adaptada de Carhart (1945) e Lloyd e Kaplan (1978); Jerger, Speaks e Trammell (1968).
          </p>
        </div>

        {/* 6. Footer: Assinatura com espaço para carimbo/assinatura manual */}
        <div className="pt-20 print:pt-24">
          {/* Assinatura com linha azul */}
          <div className="mx-auto text-center" style={{ maxWidth: 300 }}>
            <div className="w-full border-t border-[#0F2B5C] pt-1.5">
              <div className="text-[11px] font-bold text-slate-900">Milton Soares Pacheco</div>
              <div className="text-[9.5px] text-slate-600 leading-tight">
                Fonoaudiólogo – CRFa 3-11981-5
              </div>
              <div className="text-[9.5px] text-slate-600 leading-tight">
                Especialista em Audiologia
              </div>
            </div>
          </div>
        </div>

        {/* 7. Rodapé com Endereço e Telefone da Clínica */}
        {(() => {
          const address = clinicSettings?.endereco?.trim() || CLINIC_ADDRESS
          const phone = clinicSettings?.telefone?.trim() || CLINIC_PHONE
          const footerInfo = [address, phone ? `Tel: ${phone}` : ''].filter(Boolean).join(' • ')

          return footerInfo ? (
            <div className="pt-2 text-center text-[8.5px] text-slate-500 font-normal leading-tight">
              {footerInfo}
            </div>
          ) : null
        })()}
      </div>
    </div>
  )
}

/* =========================================================================
   COMPONENTE: Seção Audiometria Vocal & Tabela IPRF por Orelha (Imagem 3)
   ========================================================================= */

interface EarVocalAndIprfSectionProps {
  side: 'OD' | 'OE'
  exam: ExamState
  setField: <K extends keyof ExamState>(key: K, value: ExamState[K]) => void
  disabled?: boolean
  isSecretaria?: boolean
}

function EarVocalAndIprfSection({
  side,
  exam,
  setField,
  disabled,
  isSecretaria,
}: EarVocalAndIprfSectionProps) {
  const isInputDisabled = disabled || isSecretaria
  const isOd = side === 'OD'
  const sideKey = isOd ? 'od' : 'oe'
  const vocalRow = exam.iprf_vocal[sideKey]
  const airMap = isOd ? exam.air_od : exam.air_oe

  const trito = mediaTritonal(airMap)
  const quadri = mediaQuadritonal(airMap)

  const srtKey = isOd ? 'srt_od' : 'srt_oe'
  const ldvKey = isOd ? 'ldv_od' : 'ldv_oe'

  const updateVocalField = (field: string, val: string) => {
    setField('iprf_vocal', {
      ...exam.iprf_vocal,
      [sideKey]: {
        ...vocalRow,
        [field]: val,
      },
    })
  }

  // Se o usuário digitar nº de erros em Monossílabos/Dissílabos ou vice-versa, podemos calcular ou permitir digitação direta
  // Na imagem 3: Monossílabos, Dissílabos, Trissílabos, Polissílabos com Erros (#), Acertos (%), Intensidade (dB), Mascaramento e Valor do Mascaramento.
  // Para manter compatibilidade total e extensibilidade, mapeamos monossílabos e dissílabos nos campos existentes.

  return (
    <div className="space-y-4 pt-2">
      {/* Tabela IPRF */}
      <div className="border border-slate-200 rounded-xl bg-white p-3 space-y-3">
        <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">Tabela IPRF</h4>

        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse border border-slate-200">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 text-[11px] font-bold">
                <th className="py-2 px-3 text-left border-r border-slate-200">Sílabas</th>
                <th className="py-2 px-3 text-center border-r border-slate-200">
                  <span className="inline-flex items-center gap-1">
                    Erros <Info className="w-3 h-3 text-slate-400" />
                  </span>
                </th>
                <th className="py-2 px-3 text-center border-r border-slate-200">Acertos</th>
                <th className="py-2 px-3 text-center border-r border-slate-200">Intensidade</th>
                <th className="py-2 px-3 text-center border-r border-slate-200">Mascaramento</th>
                <th className="py-2 px-3 text-center">Valor do Mascaramento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {/* Monossílabos */}
              <tr>
                <td className="py-2 px-3 font-semibold text-slate-800 border-r border-slate-200">
                  Monossílabos
                </td>
                <td className="p-1 border-r border-slate-200 text-center">
                  <div className="flex items-center justify-center gap-1 max-w-[100px] mx-auto">
                    <Input
                      type="number"
                      value={vocalRow.monossilabos_erros ?? ''}
                      onChange={(e) => {
                        const err = e.target.value
                        const acerto =
                          err !== ''
                            ? String(Math.max(0, 100 - Number(err) * 4))
                            : vocalRow.monossilabos
                        updateVocalField('monossilabos_erros', err)
                        updateVocalField('monossilabos', acerto)
                      }}
                      disabled={isInputDisabled}
                      readOnly={isInputDisabled}
                      className="h-7 text-center text-xs font-semibold rounded border-slate-300 bg-white"
                    />
                    <span className="text-[10px] text-slate-500 font-bold">#</span>
                  </div>
                </td>
                <td className="p-1 border-r border-slate-200 text-center">
                  <div className="flex items-center justify-center gap-1 max-w-[100px] mx-auto">
                    <Input
                      type="number"
                      value={vocalRow.monossilabos}
                      onChange={(e) => updateVocalField('monossilabos', e.target.value)}
                      disabled={isInputDisabled}
                      readOnly={isInputDisabled}
                      className="h-7 text-center text-xs font-semibold rounded border-slate-300 bg-white"
                    />
                    <span className="text-[10px] text-slate-500 font-bold">%</span>
                  </div>
                </td>
                <td className="p-1 border-r border-slate-200 text-center">
                  <div className="flex items-center justify-center gap-1 max-w-[100px] mx-auto">
                    <Input
                      type="number"
                      value={vocalRow.intensidade}
                      onChange={(e) => updateVocalField('intensidade', e.target.value)}
                      disabled={isInputDisabled}
                      readOnly={isInputDisabled}
                      className="h-7 text-center text-xs font-semibold rounded border-slate-300 bg-white"
                    />
                    <span className="text-[10px] text-slate-500 font-bold">dB</span>
                  </div>
                </td>
                <td className="p-1 border-r border-slate-200 text-center">
                  <Select
                    value={vocalRow.tipo_mascaramento || '__none'}
                    onValueChange={(v) =>
                      updateVocalField('tipo_mascaramento', v === '__none' ? '' : v)
                    }
                    disabled={isInputDisabled}
                  >
                    <SelectTrigger className="h-7 text-xs font-semibold border-slate-300 bg-white mx-auto max-w-[120px]">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">Selecione...</SelectItem>
                      <SelectItem value="SN">SN</SelectItem>
                      <SelectItem value="WN">WN</SelectItem>
                      <SelectItem value="NB">NB</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-1 text-center">
                  <div className="flex items-center justify-center max-w-[100px] mx-auto">
                    <Input
                      type="number"
                      value={vocalRow.mascaramento}
                      onChange={(e) => updateVocalField('mascaramento', e.target.value)}
                      disabled={isInputDisabled}
                      readOnly={isInputDisabled}
                      className="h-7 text-center text-xs font-semibold rounded border-slate-300 bg-white"
                    />
                  </div>
                </td>
              </tr>

              {/* Dissílabos */}
              <tr>
                <td className="py-2 px-3 font-semibold text-slate-800 border-r border-slate-200">
                  Dissílabos
                </td>
                <td className="p-1 border-r border-slate-200 text-center">
                  <div className="flex items-center justify-center gap-1 max-w-[100px] mx-auto">
                    <Input
                      type="number"
                      value={vocalRow.dissilabos_erros ?? ''}
                      onChange={(e) => {
                        const err = e.target.value
                        const acerto =
                          err !== ''
                            ? String(Math.max(0, 100 - Number(err) * 4))
                            : vocalRow.dissilabos
                        updateVocalField('dissilabos_erros', err)
                        updateVocalField('dissilabos', acerto)
                      }}
                      disabled={isInputDisabled}
                      readOnly={isInputDisabled}
                      className="h-7 text-center text-xs font-semibold rounded border-slate-300 bg-white"
                    />
                    <span className="text-[10px] text-slate-500 font-bold">#</span>
                  </div>
                </td>
                <td className="p-1 border-r border-slate-200 text-center">
                  <div className="flex items-center justify-center gap-1 max-w-[100px] mx-auto">
                    <Input
                      type="number"
                      value={vocalRow.dissilabos}
                      onChange={(e) => updateVocalField('dissilabos', e.target.value)}
                      disabled={isInputDisabled}
                      readOnly={isInputDisabled}
                      className="h-7 text-center text-xs font-semibold rounded border-slate-300 bg-white"
                    />
                    <span className="text-[10px] text-slate-500 font-bold">%</span>
                  </div>
                </td>
                <td className="p-1 border-r border-slate-200 text-center">
                  <div className="flex items-center justify-center gap-1 max-w-[100px] mx-auto">
                    <Input
                      type="number"
                      value={vocalRow.intensidade_dissilabos ?? vocalRow.intensidade}
                      onChange={(e) => updateVocalField('intensidade_dissilabos', e.target.value)}
                      disabled={isInputDisabled}
                      readOnly={isInputDisabled}
                      className="h-7 text-center text-xs font-semibold rounded border-slate-300 bg-white"
                    />
                    <span className="text-[10px] text-slate-500 font-bold">dB</span>
                  </div>
                </td>
                <td className="p-1 border-r border-slate-200 text-center">
                  <Select
                    value={
                      vocalRow.tipo_mascaramento_dissilabos ||
                      vocalRow.tipo_mascaramento ||
                      '__none'
                    }
                    onValueChange={(v) =>
                      updateVocalField('tipo_mascaramento_dissilabos', v === '__none' ? '' : v)
                    }
                    disabled={isInputDisabled}
                  >
                    <SelectTrigger className="h-7 text-xs font-semibold border-slate-300 bg-white mx-auto max-w-[120px]">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">Selecione...</SelectItem>
                      <SelectItem value="SN">SN</SelectItem>
                      <SelectItem value="WN">WN</SelectItem>
                      <SelectItem value="NB">NB</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-1 text-center">
                  <div className="flex items-center justify-center max-w-[100px] mx-auto">
                    <Input
                      type="number"
                      value={vocalRow.mascaramento_dissilabos ?? vocalRow.mascaramento}
                      onChange={(e) => updateVocalField('mascaramento_dissilabos', e.target.value)}
                      disabled={isInputDisabled}
                      readOnly={isInputDisabled}
                      className="h-7 text-center text-xs font-semibold rounded border-slate-300 bg-white"
                    />
                  </div>
                </td>
              </tr>

              {/* Trissílabos */}
              <tr>
                <td className="p-1 border-r border-slate-200 text-center"></td>
                <td className="p-1 border-r border-slate-200 text-center"></td>

                <td className="p-1 text-center">
                  <div className="flex items-center justify-center max-w-[100px] mx-auto"></div>
                </td>
              </tr>

              {/* Polissílabos */}
              <tr>
                <td className="p-1 border-r border-slate-200 text-center"></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Cartões LRF (SRT) e LDV com Média Tritonal e Quadritonal (Imagem 3) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* LRF / SRT */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold text-red-600">LRF</span>
              <button
                type="button"
                onClick={() => setField(srtKey as any, exam[srtKey] === -1 ? null : -1)}
                disabled={isInputDisabled}
                className={`text-[10px] font-bold px-2 py-0.5 rounded transition-all ${
                  exam[srtKey] === -1
                    ? 'bg-slate-700 text-white'
                    : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                }`}
              >
                AUS
              </button>
            </div>
            <div className="text-right text-[10px] text-slate-500 font-medium">
              <div>Média Tritonal: {trito !== null ? `${trito.toFixed(2)} dB` : '—'}</div>
              <div>Média Quadritonal: {quadri !== null ? `${quadri.toFixed(2)} dB` : '—'}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <Label className="text-[10px] font-bold text-slate-600 block mb-1">Intensidade</Label>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  value={exam[srtKey] === -1 ? '' : (exam[srtKey] ?? '')}
                  onChange={(e) =>
                    setField(srtKey as any, e.target.value === '' ? null : Number(e.target.value))
                  }
                  disabled={isInputDisabled || exam[srtKey] === -1}
                  readOnly={isInputDisabled}
                  className="h-8 text-xs font-semibold border-slate-300 bg-white"
                />
                <span className="text-xs font-bold text-slate-500">dB</span>
              </div>
            </div>
            <div>
              <Label className="text-[10px] font-bold text-slate-600 block mb-1">
                Mascaramento
              </Label>
              <Select
                value={vocalRow.mascaramento_srt_tipo || '__none'}
                onValueChange={(v) =>
                  updateVocalField('mascaramento_srt_tipo', v === '__none' ? '' : v)
                }
                disabled={isInputDisabled}
              >
                <SelectTrigger className="h-8 text-xs border-slate-300 bg-white">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Selecione...</SelectItem>
                  <SelectItem value="SN">SN</SelectItem>
                  <SelectItem value="WN">WN</SelectItem>
                  <SelectItem value="NB">NB</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* LDV */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold text-red-600">LDV</span>
              <button
                type="button"
                onClick={() => setField(ldvKey as any, exam[ldvKey] === -1 ? null : -1)}
                disabled={isInputDisabled}
                className={`text-[10px] font-bold px-2 py-0.5 rounded transition-all ${
                  exam[ldvKey] === -1
                    ? 'bg-slate-700 text-white'
                    : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                }`}
              >
                AUS
              </button>
            </div>
            <div className="text-right text-[10px] text-slate-500 font-medium">
              <div>Média Tritonal: {trito !== null ? `${trito.toFixed(2)} dB` : '—'}</div>
              <div>Média Quadritonal: {quadri !== null ? `${quadri.toFixed(2)} dB` : '—'}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <Label className="text-[10px] font-bold text-slate-600 block mb-1">Intensidade</Label>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  value={exam[ldvKey] === -1 ? '' : (exam[ldvKey] ?? '')}
                  onChange={(e) =>
                    setField(ldvKey as any, e.target.value === '' ? null : Number(e.target.value))
                  }
                  disabled={isInputDisabled || exam[ldvKey] === -1}
                  readOnly={isInputDisabled}
                  className="h-8 text-xs font-semibold border-slate-300 bg-white"
                />
                <span className="text-xs font-bold text-slate-500">dB</span>
              </div>
            </div>
            <div>
              <Label className="text-[10px] font-bold text-slate-600 block mb-1">
                Mascaramento
              </Label>
              <Select
                value={vocalRow.mascaramento_ldv_tipo || '__none'}
                onValueChange={(v) =>
                  updateVocalField('mascaramento_ldv_tipo', v === '__none' ? '' : v)
                }
                disabled={isInputDisabled}
              >
                <SelectTrigger className="h-8 text-xs border-slate-300 bg-white">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Selecione...</SelectItem>
                  <SelectItem value="SN">SN</SelectItem>
                  <SelectItem value="WN">WN</SelectItem>
                  <SelectItem value="NB">NB</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({
  title,
  icon,
  children,
}: {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 sm:p-4">
      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100 mb-2">
        {icon}
        {title}
      </h3>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-[10px] font-semibold text-slate-600 block mb-0.5">{label}</Label>
      {children}
    </div>
  )
}
