import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '@/context/AppContext'
import { useToast } from '@/hooks/use-toast'
import { usePrint } from '@/components/print/PrintProvider'
import {
  AudiometriaFullPrint,
  renderExamReport,
  buildAudiometryContext,
} from '@/components/print/PrintDocuments'
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
  const { print } = usePrint()

  const patient = getPatient(id || '')
  const isSecretaria = currentUser?.role === 'secretaria'
  const isNew = !examId || examId === 'novo'

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [exam, setExam] = useState<ExamState>(() => {
    const base = emptyAudiometryExamFull(id || '', patient?.name || '')
    return { ...base, audiometer: DEFAULT_AUDIOMETER }
  })

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

  const handleSave = async () => {
    if (!patient) {
      toast({ title: 'Paciente não encontrado', variant: 'destructive' })
      return
    }
    setSaving(true)
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
        setExam({ ...rest, id: mapped.id })
        toast({ title: 'Exame atualizado', description: 'Audiometria salva com sucesso.' })
      } else {
        const rec: any = await pb.collection('audiometry_exams').create(payload)
        const mapped = mapExam(rec)
        const { id: _id, created: _c, updated: _u, ...rest } = mapped
        void _id
        void _c
        void _u
        setExam({ ...rest, id: mapped.id })
        toast({ title: 'Exame criado', description: 'Audiometria salva com sucesso.' })
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

  const handlePrint = async () => {
    const fullExam: AudiometryExamFull = {
      ...(exam as AudiometryExamFull),
      id: exam.id || 'novo',
      created: '',
      updated: '',
    }

    // Se houver um PDF template cadastrado nas configurações da clínica, preenche com pdf-lib
    const templatePdfUrl = clinicSettings?.template_audiometria_url
    if (templatePdfUrl) {
      try {
        const response = await fetch(templatePdfUrl)
        if (!response.ok) throw new Error('Falha ao baixar template PDF')
        const templateBytes = await response.arrayBuffer()
        const filledBytes = await fillAudiometriaTemplatePdf(templateBytes, {
          exam: fullExam,
          patient,
          clinicSettings,
          professional: currentUser
            ? { name: currentUser.name, crmCrfa: currentUser.crmCrfa }
            : null,
        })
        openPdfInNewTab(filledBytes, `Laudo_Audiometria_${patient?.name || 'paciente'}.pdf`)
        return
      } catch (err) {
        console.error('Erro ao preencher PDF template:', err)
        toast({
          title: 'Aviso',
          description:
            'Não foi possível carregar o PDF template. Utilizando impressão padrão do sistema.',
          variant: 'default',
        })
      }
    }

    // Fallback: visualização e impressão HTML padrão do sistema
    const fallbackNode = (
      <AudiometriaFullPrint
        exam={fullExam}
        patient={patient}
        clinicSettings={clinicSettings}
        professional={currentUser ? { name: currentUser.name, crmCrfa: currentUser.crmCrfa } : null}
      />
    )
    const ctx = buildAudiometryContext({
      patientName: patient?.name,
      patientCpf: patient?.cpf,
      patientBirthDate: patient?.birthDate,
      patientSex: patient?.gender,
      patientPhone: patient?.mobile,
      examDate: exam.date,
      professionalName: currentUser?.name,
      professionalCrfa: currentUser?.crmCrfa,
      exam: exam as unknown as Record<string, unknown>,
      clinicName: clinicSettings?.nome,
      clinicAddress: clinicSettings?.endereco,
      clinicPhone: clinicSettings?.telefone,
    })
    const bodyNode = fallbackNode
    print({
      title: 'Audiometria',
      subtitle: `${patient?.name || ''} — ${formatDate(exam.date)}`,
      body: bodyNode,
    })
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
    <div className="space-y-3 animate-in fade-in-50 duration-200 pb-12">
      {/* Cabeçalho da página */}
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
              <Activity className="w-5 h-5 text-teal-600" />
              Audiometria
            </h1>
          </div>
        </div>
      </div>

      {/* Prévia do exame (formato clínico compacto — visível na impressão) */}
      <div className="hidden print:block">
        <ExamPreview
          exam={exam as AudiometryExamFull}
          patientAgeDetailed={patientAgeDetailed}
          clinicSettings={clinicSettings}
          professional={
            currentUser ? { name: currentUser.name, crmCrfa: currentUser.crmCrfa } : null
          }
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
                    disabled={isSecretaria}
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
                    disabled={isSecretaria}
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
                  disabled={isSecretaria}
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
                {!isSecretaria && (
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
                disabled={isSecretaria}
              />

              {/* Seção Audiometria Vocal & IPRF OD (conforme imagem 3) */}
              <EarVocalAndIprfSection
                side="OD"
                exam={exam}
                setField={setField}
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
                {!isSecretaria && (
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
                disabled={isSecretaria}
              />

              {/* Seção Audiometria Vocal & IPRF OE */}
              <EarVocalAndIprfSection
                side="OE"
                exam={exam}
                setField={setField}
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
                  disabled={isSecretaria}
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
                  disabled={isSecretaria}
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
                  disabled={isSecretaria}
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
              {!isSecretaria && (
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
              disabled={isSecretaria}
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
          onClick={handlePrint}
          className="rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold h-10 w-full sm:w-auto"
        >
          <Printer className="w-4 h-4 mr-1.5" />
          Imprimir
        </Button>
        {!isSecretaria && (
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold h-10 shadow-sm w-full sm:w-auto"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-1.5" />
            )}
            Salvar
          </Button>
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

/* ---------- Subcomponentes da prévia clínica ---------- */
function ExamPreview({
  exam,
  patientAgeDetailed,
  clinicSettings,
  professional,
}: {
  exam: AudiometryExamFull
  patientAgeDetailed: string
  clinicSettings?: ClinicSettings | null
  professional?: { name: string; crmCrfa?: string } | null
}) {
  const profName = (professional?.name?.trim() || SPECIALIST_NAME).toUpperCase()
  const profCrfaRaw = professional?.crmCrfa?.trim() || SPECIALIST_CRFA
  const profCrfa = profCrfaRaw.replace(/^crfa\s*/i, '')
  const profSubtitle = profCrfa ? `Fonoaudiólogo — CRFa ${profCrfa}` : 'Fonoaudiólogo'

  const odTrito = mediaTritonal(exam.air_od)
  const odQuadri = mediaQuadritonal(exam.air_od)
  const oeTrito = mediaTritonal(exam.air_oe)
  const oeQuadri = mediaQuadritonal(exam.air_oe)

  const clinicName = clinicSettings?.nome?.trim() || 'Audição360'
  const clinicAddress = clinicSettings?.endereco?.trim() || CLINIC_ADDRESS
  const clinicPhone = clinicSettings?.telefone?.trim() || CLINIC_PHONE

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 clinic-audiometry">
      <div className="space-y-4">
        {/* Cabeçalho da clínica com logo */}
        <div className="flex items-start justify-between border-b-2 border-navy-700 pb-3">
          <div className="flex items-center gap-3">
            <img src={logoImg} alt={clinicName} className="max-h-12 max-w-[140px] object-contain" />
            <div>
              <h2 className="text-lg font-extrabold tracking-tight" style={{ color: '#0F2B5C' }}>
                {clinicName}
              </h2>
              <p className="text-[11px] text-slate-500 leading-tight">
                {clinicAddress}
                <br />
                Telefone: {clinicPhone}
              </p>
            </div>
          </div>
          <div className="text-right text-[11px] text-slate-700">
            <div>
              <strong>DATA DO EXAME</strong>
            </div>
            <div className="font-semibold">{formatDate(exam.date)}</div>
          </div>
        </div>

        {/* Bloco de identificação do paciente */}
        <div className="border border-slate-300 rounded-md p-3 text-[11px] text-slate-800">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-y-1 gap-x-3">
            <IdentField label="NOME COMPLETO" value={exam.patientName} className="sm:col-span-12" />
            <IdentField label="CPF" value={maskCPF(exam.cpf)} className="sm:col-span-4" />
            <IdentField label="GÊNERO" value={exam.sex} className="sm:col-span-4" />
            <IdentField
              label="DATA DE NASC."
              value={formatDate(exam.dob)}
              className="sm:col-span-4"
            />
            <IdentField label="IDADE" value={patientAgeDetailed} className="sm:col-span-4" />
            <IdentField
              label="ESTADO CIVIL"
              value={exam.marital_status}
              className="sm:col-span-4"
            />
            <IdentField label="ESPECIALISTA" value={profName} className="sm:col-span-4" />
            <IdentField
              label="APARELHO AUDIÔMETRO"
              value={exam.audiometer || DEFAULT_AUDIOMETER}
              className="sm:col-span-6"
            />
            <IdentField
              label="DATA DA CALIBRAÇÃO"
              value={formatDate(exam.calibration)}
              className="sm:col-span-6"
            />
          </div>
        </div>

        {/* Título AUDIOMETRIA */}
        <h3
          className="text-center text-base font-extrabold tracking-wide"
          style={{ color: '#1e293b' }}
        >
          AUDIOMETRIA
        </h3>

        {/* Legenda */}
        <Legend />

        {/* Audiogramas lado a lado */}
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
        />

        {/* Médias */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <MediaTable
            title="MÉDIA TRITONAL"
            airOd={odTrito}
            airOe={oeTrito}
            boneOd={mediaTritonal(exam.bone_od)}
            boneOe={mediaTritonal(exam.bone_oe)}
          />
          <MediaTable
            title="MÉDIA QUADRITONAL"
            airOd={odQuadri}
            airOe={oeQuadri}
            boneOd={mediaQuadritonal(exam.bone_od)}
            boneOe={mediaQuadritonal(exam.bone_oe)}
          />
        </div>

        {/* IPRF */}
        <IprfTable exam={exam} />

        {/* Grau / Tipo / Configuração */}
        {(exam.loss_degree || exam.loss_type || exam.loss_configuration) && (
          <div className="text-[11px] text-slate-800">
            <strong>Grau:</strong> {exam.loss_degree || '—'} &nbsp;|&nbsp; <strong>Tipo:</strong>{' '}
            {exam.loss_type || '—'} &nbsp;|&nbsp; <strong>Configuração:</strong>{' '}
            {exam.loss_configuration || '—'}
          </div>
        )}

        {/* Parecer */}
        <div>
          <SectionLabel>PARECER AUDIOLÓGICO</SectionLabel>
          <div className="border border-slate-300 rounded-md p-2 text-[11px] text-slate-800 whitespace-pre-wrap min-h-[60px]">
            {exam.report || '—'}
          </div>
          <p className="text-[9px] text-slate-500 italic mt-1 text-justify">{REPORT_REFERENCE}</p>
        </div>

        {/* Assinatura */}
        <div className="pt-4">
          <div className="mx-auto text-center" style={{ maxWidth: 320 }}>
            <div className="border-t border-slate-500 pt-1 text-[12px] font-bold text-slate-800">
              {profName}
            </div>
            <div className="text-[10px] text-slate-500">{profSubtitle}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function IdentField({
  label,
  value,
  className,
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div className={className}>
      <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wide">
        {label}:
      </span>{' '}
      <span className="font-semibold">{value || '—'}</span>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[12px] font-extrabold tracking-wide mb-1" style={{ color: '#0F2B5C' }}>
      {children}
    </div>
  )
}

function Legend() {
  const cellTh =
    'border border-slate-400 bg-slate-100 text-[10px] font-bold text-center px-1 py-0.5'
  const cellTd = 'border border-slate-400 text-[10px] text-center px-1 py-0.5'
  const od = (s: string) => (
    <span style={{ color: '#dc2626' }} className="font-bold">
      {s}
    </span>
  )
  const oe = (s: string) => (
    <span style={{ color: '#2563eb' }} className="font-bold">
      {s}
    </span>
  )
  return (
    <div>
      <SectionLabel>LEGENDA</SectionLabel>
      <table className="w-full border-collapse" style={{ maxWidth: 640 }}>
        <thead>
          <tr>
            <th className={cellTh}></th>
            <th colSpan={2} className={cellTh}>
              Normal
            </th>
            <th colSpan={2} className={cellTh}>
              Ausente
            </th>
          </tr>
          <tr>
            <th className={cellTh}></th>
            <th className={cellTh}>OD</th>
            <th className={cellTh}>OE</th>
            <th className={cellTh}>OD</th>
            <th className={cellTh}>OE</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={`${cellTd} text-left font-semibold`}>Via Aérea s/ masc.</td>
            <td className={cellTd}>{od('○')}</td>
            <td className={cellTd}>{oe('✕')}</td>
            <td className={cellTd}>{od('○↓')}</td>
            <td className={cellTd}>{oe('✕↓')}</td>
          </tr>
          <tr>
            <td className={`${cellTd} text-left font-semibold`}>Via Aérea c/ masc.</td>
            <td className={cellTd}>{od('△')}</td>
            <td className={cellTd}>{oe('□')}</td>
            <td className={cellTd}>{od('△↓')}</td>
            <td className={cellTd}>{oe('□↓')}</td>
          </tr>
          <tr>
            <td className={`${cellTd} text-left font-semibold`}>Via Óssea s/ masc.</td>
            <td className={cellTd}>{od('<')}</td>
            <td className={cellTd}>{oe('>')}</td>
            <td className={cellTd}>{od('<↓')}</td>
            <td className={cellTd}>{oe('>↓')}</td>
          </tr>
          <tr>
            <td className={`${cellTd} text-left font-semibold`}>Via Óssea c/ masc.</td>
            <td className={cellTd}>{od('[')}</td>
            <td className={cellTd}>{oe(']')}</td>
            <td className={cellTd}>{od('[↓')}</td>
            <td className={cellTd}>{oe(']↓')}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function MediaTable({
  title,
  airOd,
  airOe,
  boneOd,
  boneOe,
}: {
  title: string
  airOd: number | null
  airOe: number | null
  boneOd: number | null
  boneOe: number | null
}) {
  const th = 'border border-slate-400 bg-slate-100 text-[10px] font-bold text-center px-1 py-0.5'
  const td = 'border border-slate-400 text-[10px] text-center px-1 py-0.5'
  const fmt = (v: number | null) => (v === null ? '-' : v)
  return (
    <div>
      <SectionLabel>{title}</SectionLabel>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={th}></th>
            <th className={th} style={{ color: '#dc2626' }}>
              OD
            </th>
            <th className={th} style={{ color: '#2563eb' }}>
              OE
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={`${td} text-left font-semibold`}>Via Aérea</td>
            <td className={td}>{fmt(airOd)}</td>
            <td className={td}>{fmt(airOe)}</td>
          </tr>
          <tr>
            <td className={`${td} text-left font-semibold`}>Via Óssea</td>
            <td className={td}>{fmt(boneOd)}</td>
            <td className={td}>{fmt(boneOe)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function IprfTable({ exam }: { exam: AudiometryExamFull }) {
  const th = 'border border-slate-400 bg-slate-100 text-[10px] font-bold text-center px-1 py-0.5'
  const td = 'border border-slate-400 text-[10px] text-center px-1 py-0.5'
  const odRow = exam.iprf_vocal.od
  const oeRow = exam.iprf_vocal.oe
  const fmtIprf = (r: { intensidade: string; monossilabos: string; dissilabos: string }) => {
    const intens = r.intensidade ? `${r.intensidade} dB` : '- dB'
    const monoPct = r.monossilabos ? `${r.monossilabos}%` : '-'
    const dissiPct = r.dissilabos ? `${r.dissilabos}%` : '-'
    return `${intens} — ${monoPct} Monossílabos / ${dissiPct} Dissílabos`
  }
  const fmtMasc = (r: { mascaramento?: string }) => (r.mascaramento ? `${r.mascaramento} dB` : '—')
  const fmtPalavras = (r: { palavras_faladas?: string }) =>
    r.palavras_faladas ? r.palavras_faladas : '—'
  return (
    <div>
      <SectionLabel>I.P.R.F</SectionLabel>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={th}></th>
            <th className={th} style={{ color: '#dc2626' }}>
              OD
            </th>
            <th className={th} style={{ color: '#2563eb' }}>
              OE
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={`${td} text-left font-semibold`}>Monossílabos / Dissílabos</td>
            <td className={td}>{fmtIprf(odRow)}</td>
            <td className={td}>{fmtIprf(oeRow)}</td>
          </tr>
          <tr>
            <td className={`${td} text-left font-semibold`}>Mascaramento (dB)</td>
            <td className={td}>{fmtMasc(odRow)}</td>
            <td className={td}>{fmtMasc(oeRow)}</td>
          </tr>
          <tr>
            <td className={`${td} text-left font-semibold`}>Palavras Faladas</td>
            <td className={td}>{fmtPalavras(odRow)}</td>
            <td className={td}>{fmtPalavras(oeRow)}</td>
          </tr>
        </tbody>
      </table>
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
  isSecretaria?: boolean
}

function EarVocalAndIprfSection({
  side,
  exam,
  setField,
  isSecretaria,
}: EarVocalAndIprfSectionProps) {
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
                      disabled={isSecretaria}
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
                      disabled={isSecretaria}
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
                      disabled={isSecretaria}
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
                    disabled={isSecretaria}
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
                      disabled={isSecretaria}
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
                      disabled={isSecretaria}
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
                      disabled={isSecretaria}
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
                      disabled={isSecretaria}
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
                    disabled={isSecretaria}
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
                      disabled={isSecretaria}
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
                disabled={isSecretaria}
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
                  disabled={isSecretaria || exam[srtKey] === -1}
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
                disabled={isSecretaria}
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
                disabled={isSecretaria}
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
                  disabled={isSecretaria || exam[ldvKey] === -1}
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
                disabled={isSecretaria}
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
