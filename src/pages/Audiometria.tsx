import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '@/context/AppContext'
import { useToast } from '@/hooks/use-toast'
import { usePrint } from '@/components/print/PrintProvider'
import { AudiometriaFullPrint } from '@/components/print/PrintDocuments'
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
  Ear,
  FileText,
  Wand2,
  Loader2,
  RotateCcw,
} from 'lucide-react'
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
  'Laudo audiológico baseado em Silman e Silverman (1997) adaptada de Carhart (1945) e Lloyd e Kaplan (1978); Jerger, Speaks e Trammell (1968).'

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
  const { getPatient, currentUser } = useApp()
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

      // Se o usuário está digitando um valor de dB, o símbolo PADRÃO é aplicado automaticamente
      if ('db' in patch) {
        nextSymbol = 'normal'
      }
      if ('symbol' in patch && patch.symbol) {
        nextSymbol = patch.symbol
      }

      map[freq] = { ...cur, ...patch, symbol: nextSymbol }
      return { ...prev, [target]: map }
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
      mt_od: exam.mt_od,
      mt_oe: exam.mt_oe,
      lrf_od: exam.lrf_od,
      lrf_oe: exam.lrf_oe,
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

  const handlePrint = () => {
    const fullExam: AudiometryExamFull = {
      ...(exam as AudiometryExamFull),
      id: exam.id || 'novo',
      created: '',
      updated: '',
    }
    print({
      title: 'Audiometria',
      subtitle: `${patient?.name || ''} — ${formatDate(exam.date)}`,
      body: <AudiometriaFullPrint exam={fullExam} />,
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
        <ExamPreview exam={exam as AudiometryExamFull} patientAgeDetailed={patientAgeDetailed} />
      </div>

      {/* ===================== Entrada de Dados por Orelha ===================== */}
      <div className="no-print space-y-3">
        {/* Audiometria Orelha Direita (VERMELHO) */}
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

        {/* Audiometria Orelha Esquerda (AZUL) */}
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

        {/* SRT, LDV */}
        <Section title="SRT e LDV" icon={<Activity className="w-4 h-4 text-teal-600" />}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(['OD', 'OE'] as const).map((side) => {
              const color = side === 'OD' ? 'text-red-600' : 'text-blue-600'
              const borderCard =
                side === 'OD'
                  ? 'border-slate-200 hover:border-red-200'
                  : 'border-slate-200 hover:border-blue-200'
              const srtKey = side === 'OD' ? 'srt_od' : 'srt_oe'
              const ldvKey = side === 'OD' ? 'ldv_od' : 'ldv_oe'
              return (
                <div
                  key={side}
                  className={`p-4 rounded-2xl border bg-slate-50/50 shadow-sm transition-colors space-y-3 ${borderCard}`}
                >
                  <h4 className={`text-xs font-extrabold uppercase tracking-wider ${color}`}>
                    Orelha {side === 'OD' ? 'Direita (OD)' : 'Esquerda (OE)'}
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="SRT — Limiar de Reconhecimento de Fala (dB)">
                      <Input
                        type="number"
                        value={exam[srtKey] ?? ''}
                        onChange={(e) =>
                          setField(
                            srtKey as any,
                            e.target.value === '' ? null : Number(e.target.value),
                          )
                        }
                        disabled={isSecretaria}
                        className="h-8 rounded-xl text-[11px] font-medium border-slate-300 bg-white"
                      />
                    </Field>
                    <Field label="LDV — Limiar de Detecção de Voz (dB)">
                      <Input
                        type="number"
                        value={exam[ldvKey] ?? ''}
                        onChange={(e) =>
                          setField(
                            ldvKey as any,
                            e.target.value === '' ? null : Number(e.target.value),
                          )
                        }
                        disabled={isSecretaria}
                        className="h-8 rounded-xl text-[11px] font-medium border-slate-300 bg-white"
                      />
                    </Field>
                  </div>
                </div>
              )
            })}
          </div>
        </Section>

        {/* IPRF */}
        <Section
          title="I.P.R.F. (Índice de Reconhecimento Percentual de Fala)"
          icon={<Activity className="w-4 h-4 text-teal-600" />}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(['OD', 'OE'] as const).map((side) => {
              const color = side === 'OD' ? 'text-red-600' : 'text-blue-600'
              const borderCard =
                side === 'OD'
                  ? 'border-slate-200 hover:border-red-200'
                  : 'border-slate-200 hover:border-blue-200'
              const sideKey = side === 'OD' ? 'od' : 'oe'
              const row = exam.iprf_vocal[sideKey]
              const levelsKey = side === 'OD' ? 'iprf_levels_od' : 'iprf_levels_oe'
              return (
                <div
                  key={side}
                  className={`p-4 rounded-2xl border bg-slate-50/50 shadow-sm space-y-3 ${borderCard}`}
                >
                  <h4 className={`text-xs font-extrabold uppercase tracking-wider ${color}`}>
                    Orelha {side === 'OD' ? 'Direita (OD)' : 'Esquerda (OE)'}
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Monossílabos (%)">
                      <Input
                        type="number"
                        value={row.monossilabos}
                        onChange={(e) =>
                          setField('iprf_vocal', {
                            ...exam.iprf_vocal,
                            [sideKey]: { ...row, monossilabos: e.target.value },
                          })
                        }
                        disabled={isSecretaria}
                        className="h-8 rounded-xl text-[11px] font-medium border-slate-300 bg-white"
                      />
                    </Field>
                    <Field label="Intensidade Monoss. (dB)">
                      <Input
                        type="number"
                        value={row.intensidade}
                        onChange={(e) =>
                          setField('iprf_vocal', {
                            ...exam.iprf_vocal,
                            [sideKey]: { ...row, intensidade: e.target.value },
                          })
                        }
                        disabled={isSecretaria}
                        className="h-8 rounded-xl text-[11px] font-medium border-slate-300 bg-white"
                      />
                    </Field>
                    <Field label="Dissílabos (%)">
                      <Input
                        type="number"
                        value={row.dissilabos}
                        onChange={(e) =>
                          setField('iprf_vocal', {
                            ...exam.iprf_vocal,
                            [sideKey]: { ...row, dissilabos: e.target.value },
                          })
                        }
                        disabled={isSecretaria}
                        className="h-8 rounded-xl text-[11px] font-medium border-slate-300 bg-white"
                      />
                    </Field>
                  </div>
                  <Field label="Níveis de intensidade (ex.: 100% a 45 dB, 76% a 95 dB)">
                    <Input
                      value={exam[levelsKey] || row.niveis || ''}
                      onChange={(e) => setField(levelsKey as any, e.target.value)}
                      disabled={isSecretaria}
                      placeholder="100% a 45 dB, 76% a 95 dB"
                      className="h-8 rounded-xl text-[11px] font-medium border-slate-300 bg-white"
                    />
                  </Field>
                </div>
              )
            })}
          </div>
        </Section>

        {/* Mascaramento */}
        <Section title="Mascaramento" icon={<Activity className="w-4 h-4 text-teal-600" />}>
          <div className="overflow-x-auto border border-slate-300 rounded-lg bg-white shadow-sm">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-300 bg-slate-50">
                  <th className="py-2 px-3 text-left font-bold text-slate-700 border-r border-slate-200">
                    Via
                  </th>
                  <th className="py-2 px-3 text-center font-semibold text-red-600 border-r border-slate-200">
                    O.D. (dB)
                  </th>
                  <th className="py-2 px-3 text-center font-semibold text-blue-600">O.E. (dB)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr>
                  <td className="py-2 px-3 font-bold text-slate-700 border-r border-slate-200">
                    V.A. (Via Aérea)
                  </td>
                  <td className="p-2 border-r border-slate-200 text-center">
                    <Input
                      type="number"
                      value={exam.masking_air_od ?? ''}
                      onChange={(e) =>
                        setField(
                          'masking_air_od',
                          e.target.value === '' ? null : Number(e.target.value),
                        )
                      }
                      disabled={isSecretaria}
                      className="w-20 h-8 mx-auto text-center text-[11px] font-semibold rounded bg-slate-100 border border-slate-300 focus:bg-white"
                    />
                  </td>
                  <td className="p-2 text-center">
                    <Input
                      type="number"
                      value={exam.masking_air_oe ?? ''}
                      onChange={(e) =>
                        setField(
                          'masking_air_oe',
                          e.target.value === '' ? null : Number(e.target.value),
                        )
                      }
                      disabled={isSecretaria}
                      className="w-20 h-8 mx-auto text-center text-[11px] font-semibold rounded bg-slate-100 border border-slate-300 focus:bg-white"
                    />
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-bold text-slate-700 border-r border-slate-200">
                    V.O. (Via Óssea)
                  </td>
                  <td className="p-2 border-r border-slate-200 text-center">
                    <Input
                      type="number"
                      value={exam.masking_bone_od ?? ''}
                      onChange={(e) =>
                        setField(
                          'masking_bone_od',
                          e.target.value === '' ? null : Number(e.target.value),
                        )
                      }
                      disabled={isSecretaria}
                      className="w-20 h-8 mx-auto text-center text-[11px] font-semibold rounded bg-slate-100 border border-slate-300 focus:bg-white"
                    />
                  </td>
                  <td className="p-2 text-center">
                    <Input
                      type="number"
                      value={exam.masking_bone_oe ?? ''}
                      onChange={(e) =>
                        setField(
                          'masking_bone_oe',
                          e.target.value === '' ? null : Number(e.target.value),
                        )
                      }
                      disabled={isSecretaria}
                      className="w-20 h-8 mx-auto text-center text-[11px] font-semibold rounded bg-slate-100 border border-slate-300 focus:bg-white"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>

        {/* Meatoscopia */}
        <Section
          title="Inspeção do Meato Acústico Externo"
          icon={<Ear className="w-4 h-4 text-teal-600" />}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(['OD', 'OE'] as const).map((side) => {
              const color = side === 'OD' ? 'text-red-600' : 'text-blue-600'
              const key = side === 'OD' ? 'meatoscopy_od' : 'meatoscopy_oe'
              return (
                <Field key={side} label={`Orelha ${side === 'OD' ? 'Direita' : 'Esquerda'}`}>
                  <Textarea
                    value={exam[key]}
                    onChange={(e) => setField(key as any, e.target.value)}
                    disabled={isSecretaria}
                    rows={2}
                    placeholder="Ex.: Em condições de exame"
                    className="rounded-xl text-xs border-slate-300 resize-y"
                  />
                  <span className={`text-[10px] font-bold ${color}`}>{side}</span>
                </Field>
              )
            })}
          </div>
        </Section>

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
    `px-0.5 py-0 min-w-[18px] h-5 text-[10px] font-bold rounded flex items-center justify-center transition-all select-none ${
      active
        ? isOd
          ? 'bg-red-600 text-white shadow-sm scale-105'
          : 'bg-blue-600 text-white shadow-sm scale-105'
        : 'text-slate-700 hover:bg-slate-200 border border-slate-200 bg-white'
    }`

  const resetBtnClass = (active: boolean) =>
    `p-0.5 w-4 h-5 text-[10px] rounded flex items-center justify-center transition-all ${
      active
        ? 'text-slate-400 bg-slate-100'
        : 'text-slate-500 hover:bg-slate-200 border border-slate-200 bg-slate-50'
    }`

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-2 sm:p-3 space-y-2">
      <h2 className={`text-xs sm:text-sm font-extrabold tracking-tight ${titleColor}`}>{title}</h2>

      <div className="overflow-x-auto border border-slate-300 rounded-lg bg-white">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-300 bg-white">
              <th className="py-1.5 px-1 text-center text-slate-400 font-bold border-r border-slate-200 w-20">
                .
              </th>
              {ALL_INPUT_FREQS.map((f) => (
                <th
                  key={f}
                  className={`py-1.5 px-0.5 text-center font-bold border-r border-slate-200 min-w-[38px] ${headerFreqColor}`}
                >
                  {fmtFreq(f)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {/* 1. Linha Aérea (Inputs dB) */}
            <tr>
              <td className="py-1 px-2 font-bold text-slate-800 text-right border-r border-slate-200 bg-white">
                Aérea
              </td>
              {ALL_INPUT_FREQS.map((f) => {
                const dbVal = airMap[f]?.db
                return (
                  <td key={f} className="p-1 border-r border-slate-200 text-center align-middle">
                    <input
                      type="number"
                      value={dbVal ?? ''}
                      onChange={(e) => onAirDb(f, e.target.value)}
                      disabled={disabled}
                      placeholder=""
                      className={`w-full h-7 text-center text-[11px] font-semibold rounded bg-slate-100 border border-slate-300 focus:bg-white focus:outline-none focus:ring-2 ${
                        isOd ? 'focus:ring-red-400' : 'focus:ring-blue-400'
                      }`}
                    />
                  </td>
                )
              })}
            </tr>

            {/* 2. Linha Masc / Ausências (Aérea) */}
            <tr>
              <td className="py-1 px-2 font-bold text-slate-800 text-right border-r border-slate-200 bg-white">
                Masc / Ausências
              </td>
              {ALL_INPUT_FREQS.map((f) => {
                const sym = airMap[f]?.symbol || 'normal'
                return (
                  <td key={f} className="p-1 border-r border-slate-200 text-center align-middle">
                    <div className="flex items-center justify-center gap-0.5">
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
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                )
              })}
            </tr>

            {/* 3. Linha Óssea (Inputs dB) — apenas 500, 1000, 2000, 3000 e 4000 Hz */}
            <tr>
              <td className="py-1 px-2 font-bold text-slate-800 text-right border-r border-slate-200 bg-white">
                Óssea
              </td>
              {ALL_INPUT_FREQS.map((f) => {
                if (!BONE_FREQ_SET.has(f)) {
                  return <td key={f} className="p-1 border-r border-slate-200" />
                }
                const dbVal = boneMap[f]?.db
                return (
                  <td key={f} className="p-1 border-r border-slate-200 text-center align-middle">
                    <input
                      type="number"
                      value={dbVal ?? ''}
                      onChange={(e) => onBoneDb(f, e.target.value)}
                      disabled={disabled}
                      placeholder=""
                      className={`w-full h-7 text-center text-[11px] font-semibold rounded bg-slate-100 border border-slate-300 focus:bg-white focus:outline-none focus:ring-2 ${
                        isOd ? 'focus:ring-red-400' : 'focus:ring-blue-400'
                      }`}
                    />
                  </td>
                )
              })}
            </tr>

            {/* 4. Linha Masc / Ausências (Óssea) */}
            <tr>
              <td className="py-1 px-2 font-bold text-slate-800 text-right border-r border-slate-200 bg-white">
                Masc / Ausências
              </td>
              {ALL_INPUT_FREQS.map((f) => {
                const sym = boneMap[f]?.symbol || 'normal'
                return (
                  <td key={f} className="p-1 border-r border-slate-200 text-center align-middle">
                    <div className="flex items-center justify-center gap-0.5 sm:gap-1">
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
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                )
              })}
            </tr>

            {/* 5. Linha Limiar de Desconforto (LDL) (Inputs dB) */}
            <tr>
              <td className="py-1 px-2 font-bold text-slate-800 text-right border-r border-slate-200 bg-white">
                Limiar de Desconforto (LDL)
              </td>
              {ALL_INPUT_FREQS.map((f) => {
                const dbVal = ldlMap[f]?.db
                return (
                  <td key={f} className="p-1 border-r border-slate-200 text-center align-middle">
                    <input
                      type="number"
                      value={dbVal ?? ''}
                      onChange={(e) => onLdlDb(f, e.target.value)}
                      disabled={disabled}
                      placeholder=""
                      className={`w-full h-7 text-center text-[11px] font-semibold rounded bg-slate-100 border border-slate-300 focus:bg-white focus:outline-none focus:ring-2 ${
                        isOd ? 'focus:ring-red-400' : 'focus:ring-blue-400'
                      }`}
                    />
                  </td>
                )
              })}
            </tr>

            {/* 6. Linha Ausências (LDL) */}
            <tr>
              <td className="py-1 px-2 font-bold text-slate-800 text-right border-r border-slate-200 bg-white">
                Ausências
              </td>
              {ALL_INPUT_FREQS.map((f) => {
                const sym = ldlMap[f]?.symbol || 'normal'
                return (
                  <td key={f} className="p-1 border-r border-slate-200 text-center align-middle">
                    <div className="flex items-center justify-center gap-0.5 sm:gap-1">
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
                        <RotateCcw className="w-3 h-3" />
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
}: {
  exam: AudiometryExamFull
  patientAgeDetailed: string
}) {
  const odTrito = mediaTritonal(exam.air_od)
  const odQuadri = mediaQuadritonal(exam.air_od)
  const oeTrito = mediaTritonal(exam.air_oe)
  const oeQuadri = mediaQuadritonal(exam.air_oe)

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 clinic-audiometry">
      <div className="space-y-4">
        {/* Cabeçalho da clínica com logo */}
        <div className="flex items-start justify-between border-b-2 border-navy-700 pb-3">
          <div className="flex items-center gap-3">
            <img src={logoImg} alt="Audição360" className="max-h-12 max-w-[140px] object-contain" />
            <div>
              <h2 className="text-lg font-extrabold tracking-tight" style={{ color: '#0F2B5C' }}>
                Audição360
              </h2>
              <p className="text-[11px] text-slate-500 leading-tight">
                {CLINIC_ADDRESS}
                <br />
                Telefone: {CLINIC_PHONE}
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
            <IdentField label="ESPECIALISTA" value={SPECIALIST_NAME} className="sm:col-span-4" />
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

        {/* Mascaramento */}
        <MaskingTable exam={exam} />

        {/* Inspeção do Meato Acústico Externo */}
        <div>
          <SectionLabel>INSPEÇÃO DO MEATO ACÚSTICO EXTERNO</SectionLabel>
          <div className="border border-slate-300 rounded-md p-2 text-[11px] text-slate-800 space-y-1">
            <div>
              <strong style={{ color: '#dc2626' }}>ORELHA DIREITA:</strong>{' '}
              {exam.meatoscopy_od || 'Em condições de exame'}
            </div>
            <div>
              <strong style={{ color: '#2563eb' }}>ORELHA ESQUERDA:</strong>{' '}
              {exam.meatoscopy_oe || 'Em condições de exame'}
            </div>
          </div>
        </div>

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
              {SPECIALIST_NAME}
            </div>
            <div className="text-[10px] text-slate-500">Fonoaudiólogo — CRfa {SPECIALIST_CRFA}</div>
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
  const odLevels = exam.iprf_levels_od || odRow.niveis || ''
  const oeLevels = exam.iprf_levels_oe || oeRow.niveis || ''
  const fmtIprf = (r: { intensidade: string; monossilabos: string; dissilabos: string }) => {
    const intens = r.intensidade ? `${r.intensidade} dB` : '- dB'
    const monoPct = r.monossilabos ? `${r.monossilabos}%` : '-'
    const dissiPct = r.dissilabos ? `${r.dissilabos}%` : '-'
    return `${intens} — ${monoPct} Monossílabos / ${dissiPct} Dissílabos`
  }
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
          {(odLevels || oeLevels) && (
            <tr>
              <td className={`${td} text-left font-semibold`}>Níveis</td>
              <td className={td}>{odLevels || '—'}</td>
              <td className={td}>{oeLevels || '—'}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function MaskingTable({ exam }: { exam: AudiometryExamFull }) {
  const th = 'border border-slate-400 bg-slate-100 text-[10px] font-bold text-center px-1 py-0.5'
  const td = 'border border-slate-400 text-[10px] text-center px-1 py-0.5'
  const fmtDb = (v: number | null) => (v === null ? '- dB' : `${v} dB`)
  return (
    <div>
      <SectionLabel>MASCARAMENTO</SectionLabel>
      <table className="w-full border-collapse" style={{ maxWidth: 480 }}>
        <thead>
          <tr>
            <th className={th}></th>
            <th className={th} style={{ color: '#dc2626' }}>
              O.D.
            </th>
            <th className={th} style={{ color: '#2563eb' }}>
              O.E.
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={`${td} text-left font-semibold`}>V.A.:</td>
            <td className={td}>{fmtDb(exam.masking_air_od)}</td>
            <td className={td}>{fmtDb(exam.masking_air_oe)}</td>
          </tr>
          <tr>
            <td className={`${td} text-left font-semibold`}>V.O.:</td>
            <td className={td}>{fmtDb(exam.masking_bone_od)}</td>
            <td className={td}>{fmtDb(exam.masking_bone_oe)}</td>
          </tr>
        </tbody>
      </table>
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
