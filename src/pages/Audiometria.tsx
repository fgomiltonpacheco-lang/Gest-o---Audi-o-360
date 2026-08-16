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
import { ArrowLeft, Save, Printer, Activity, Ear, FileText, Wand2, Loader2 } from 'lucide-react'
import {
  AIR_FREQS,
  BONE_FREQS,
  AudiogramMap,
  AudiogramSymbol,
  AudiometryExamFull,
  IprfVocalData,
  LOSS_DEGREE_OPTIONS,
  LOSS_TYPE_OPTIONS,
  emptyAudiogramMap,
  emptyIprfVocal,
  emptyAudiometryExamFull,
} from '@/types'
import { calculateAge, formatDate, maskCPF } from '@/lib/formatters'
import { mediaTritonal, mediaQuadritonal } from '@/lib/audiogram'

/* Frequências exibidas nas grades de entrada (sem 125 Hz). */
const AIR_GRID_FREQS = ['250', '500', '750', '1000', '1500', '2000', '3000', '4000', '6000', '8000']
const BONE_GRID_FREQS = ['500', '1000', '2000', '3000', '4000']

/* Audiometria usa como default o aparelho AD229b (modelo do PDF de referência). */
const DEFAULT_AUDIOMETER = 'AD229b'
const SPECIALIST_NAME = 'MILTON SOARES PACHECO'

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
  const emptyRow = () => ({ intensidade: '', monossilabos: '', dissilabos: '' })
  if (!raw || typeof raw !== 'object') return emptyIprfVocal()
  const norm = (r: any) => ({
    intensidade: r?.intensidade ?? '',
    monossilabos: r?.monossilabos ?? '',
    dissilabos: r?.dissilabos ?? '',
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

/** Descreve a configuração dos limiares (ascendente, descendente, plana, etc.). */
function describeConfiguration(air: AudiogramMap): string {
  const order = ['250', '500', '1000', '2000', '4000', '8000']
  const pts: number[] = []
  order.forEach((f) => {
    const v = air[f]?.db
    if (v !== null && v !== undefined) pts.push(v)
  })
  if (pts.length < 3) return ''
  // Compara o limiar mais grave com o mais agudo
  const low = (pts[0] + pts[1]) / 2
  const high = (pts[pts.length - 1] + pts[pts.length - 2]) / 2
  const diff = high - low
  if (Math.abs(diff) <= 10) return 'configuração plana'
  if (diff > 10) return 'configuração descendente'
  return 'configuração ascendente'
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
    if (config) parts.push(`e ${config}`)
    lines.push(`À ${sideLabel}: ${parts.join(' ')}.`)
  }

  describeEar(airOD, boneOD, 'direita')
  describeEar(airOE, boneOE, 'esquerda')

  lines.push('(Silman e Silverman (1997) adaptada de Carhart (1945) e Lloyd e Kaplan (1978).)')
  // Segunda referência — dificuldade para compreender a fala (Jerger)
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

/* ---------- Idade detalhada (anos, meses, dias) ---------- */
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

/* ---------- Componente Principal ---------- */
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
  const [exam, setExam] = useState<
    Omit<AudiometryExamFull, 'id' | 'created' | 'updated'> & { id?: string }
  >(() => {
    const base = emptyAudiometryExamFull(id || '', patient?.name || '')
    return { ...base, audiometer: DEFAULT_AUDIOMETER }
  })

  // Carregar exame existente
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

  // Auto-preencher do paciente (novo exame)
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

  /* ---------- Updaters ---------- */
  const setField = <K extends keyof typeof exam>(key: K, value: (typeof exam)[K]) => {
    setExam((prev) => ({ ...prev, [key]: value }))
  }

  const AIR_BONE_TARGETS = new Set(['air_od', 'air_oe', 'bone_od', 'bone_oe'])

  const setPoint = (
    target: 'air_od' | 'air_oe' | 'bone_od' | 'bone_oe' | 'ldl_od' | 'ldl_oe',
    freq: string,
    patch: Partial<{ db: number | null; symbol: AudiogramSymbol }>,
  ) => {
    setExam((prev) => {
      const map = { ...(prev[target] || {}) }
      const cur = map[freq] || { db: null, symbol: 'normal' }
      let nextSymbol = cur.symbol
      if (AIR_BONE_TARGETS.has(target) && 'db' in patch) {
        nextSymbol = 'normal'
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

  /* ---------- Save ---------- */
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

  /* ---------- Print ---------- */
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

  /* ---------- Laudo sugerido ---------- */
  const handleSuggestedReport = () => {
    const text = buildSuggestedReport(exam.air_od, exam.air_oe, exam.bone_od, exam.bone_oe)
    setField('report', text)
    const odAvg = avgAir(exam.air_od)
    const odDegree = degreeFromAvg(odAvg)
    const odType = determineType(exam.air_od, exam.bone_od)
    if (odDegree) setField('loss_degree', odDegree)
    if (odType && odType !== 'Normal') setField('loss_type', odType)
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

  const odTrito = mediaTritonal(exam.air_od)
  const odQuadri = mediaQuadritonal(exam.air_od)
  const oeTrito = mediaTritonal(exam.air_oe)
  const oeQuadri = mediaQuadritonal(exam.air_oe)

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200 pb-12">
      {/* Cabeçalho da página (aplicação) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
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
            <h1 className="text-lg font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <Activity className="w-5 h-5 text-teal-600" />
              Audiometria
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {patient.name} • {isNew ? 'Novo exame' : `Exame de ${formatDate(exam.date)}`}
            </p>
          </div>
        </div>
      </div>

      {/* Prévia do exame (formato clínico compacto, visível na tela E na impressão) */}
      <ExamPreview exam={exam as AudiometryExamFull} patientAgeDetailed={patientAgeDetailed} />

      {/* ===================== Grade de Entrada de Dados (NÃO imprime) ===================== */}
      <div className="no-print space-y-6">
        {/* Identificação editável */}
        <Section title="Identificação" icon={<FileText className="w-4 h-4 text-teal-600" />}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Field label="Data do Exame">
              <Input
                type="date"
                value={exam.date}
                onChange={(e) => setField('date', e.target.value)}
                disabled={isSecretaria}
                className="h-10 rounded-xl text-xs border-slate-300"
              />
            </Field>
            <Field label="Paciente">
              <Input
                value={patient.name}
                readOnly
                className="h-10 rounded-xl text-xs bg-slate-50 border-slate-200"
              />
            </Field>
            <Field label="CPF">
              <Input
                value={maskCPF(exam.cpf)}
                readOnly
                className="h-10 rounded-xl text-xs bg-slate-50 border-slate-200 font-mono"
              />
            </Field>
            <Field label="Data de Nascimento">
              <Input
                value={formatDate(exam.dob)}
                readOnly
                className="h-10 rounded-xl text-xs bg-slate-50 border-slate-200"
              />
            </Field>
            <Field label="Idade (auto)">
              <Input
                value={patientAgeDetailed}
                readOnly
                className="h-10 rounded-xl text-xs bg-slate-50 border-slate-200"
              />
            </Field>
            <Field label="Gênero">
              <Input
                value={exam.sex}
                readOnly
                className="h-10 rounded-xl text-xs bg-slate-50 border-slate-200"
              />
            </Field>
            <Field label="Estado Civil">
              <Input
                value={exam.marital_status}
                onChange={(e) => setField('marital_status', e.target.value)}
                disabled={isSecretaria}
                placeholder="Solteiro(a), Casado(a)..."
                className="h-10 rounded-xl text-xs border-slate-300"
              />
            </Field>
            <Field label="Audiômetro">
              <Input
                value={exam.audiometer}
                onChange={(e) => setField('audiometer', e.target.value)}
                disabled={isSecretaria}
                className="h-10 rounded-xl text-xs border-slate-300"
              />
            </Field>
            <Field label="Data da Calibração">
              <Input
                type="date"
                value={exam.calibration}
                onChange={(e) => setField('calibration', e.target.value)}
                disabled={isSecretaria}
                className="h-10 rounded-xl text-xs border-slate-300"
              />
            </Field>
          </div>
        </Section>

        {/* Via Aérea */}
        <Section
          title="Via Aérea (Fones) — Limiares Tonais"
          icon={<Ear className="w-4 h-4 text-teal-600" />}
        >
          <ConductionGrid
            kind="air"
            freqs={AIR_GRID_FREQS}
            odMap={exam.air_od}
            oeMap={exam.air_oe}
            onOdDb={(f, v) => setPoint('air_od', f, { db: handleDbInput(v) })}
            onOdSymbol={(f, s) => setPoint('air_od', f, { symbol: s })}
            onOeDb={(f, v) => setPoint('air_oe', f, { db: handleDbInput(v) })}
            onOeSymbol={(f, s) => setPoint('air_oe', f, { symbol: s })}
            disabled={isSecretaria}
          />
        </Section>

        {/* Via Óssea */}
        <Section
          title="Via Óssea (Mastóide) — Limiares Tonais"
          icon={<Ear className="w-4 h-4 text-teal-600" />}
        >
          <ConductionGrid
            kind="bone"
            freqs={BONE_GRID_FREQS}
            odMap={exam.bone_od}
            oeMap={exam.bone_oe}
            onOdDb={(f, v) => setPoint('bone_od', f, { db: handleDbInput(v) })}
            onOdSymbol={(f, s) => setPoint('bone_od', f, { symbol: s })}
            onOeDb={(f, v) => setPoint('bone_oe', f, { db: handleDbInput(v) })}
            onOeSymbol={(f, s) => setPoint('bone_oe', f, { symbol: s })}
            disabled={isSecretaria}
          />
        </Section>

        {/* SRT, LDV, Mascaramento por orelha */}
        <Section
          title="SRT, LDV e Mascaramento"
          icon={<Activity className="w-4 h-4 text-teal-600" />}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(['OD', 'OE'] as const).map((side) => {
              const color = side === 'OD' ? 'text-red-600' : 'text-blue-600'
              const borderCard =
                side === 'OD'
                  ? 'border-slate-200 hover:border-red-200'
                  : 'border-slate-200 hover:border-blue-200'
              const srtKey = side === 'OD' ? 'srt_od' : 'srt_oe'
              const ldvKey = side === 'OD' ? 'ldv_od' : 'ldv_oe'
              const lrfKey = side === 'OD' ? 'lrf_od' : 'lrf_oe'
              const maskAirKey = side === 'OD' ? 'masking_air_od' : 'masking_air_oe'
              const maskBoneKey = side === 'OD' ? 'masking_bone_od' : 'masking_bone_oe'
              return (
                <div
                  key={side}
                  className={`p-4 rounded-2xl border bg-slate-50/50 shadow-sm transition-colors space-y-3 ${borderCard}`}
                >
                  <h4 className={`text-xs font-extrabold uppercase tracking-wider ${color}`}>
                    Orelha {side === 'OD' ? 'Direita (OD)' : 'Esquerda (OE)'}
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="SRT (dB)">
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
                        className="h-10 rounded-xl text-xs font-medium border-slate-300 bg-white"
                      />
                    </Field>
                    <Field label="LDV (dB)">
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
                        className="h-10 rounded-xl text-xs font-medium border-slate-300 bg-white"
                      />
                    </Field>
                    <Field label="LRF (dB)">
                      <Input
                        type="number"
                        value={exam[lrfKey] ?? ''}
                        onChange={(e) =>
                          setField(
                            lrfKey as any,
                            e.target.value === '' ? null : Number(e.target.value),
                          )
                        }
                        disabled={isSecretaria}
                        className="h-10 rounded-xl text-xs font-medium border-slate-300 bg-white"
                      />
                    </Field>
                    <Field label="Masc. V.A. (dB)">
                      <Input
                        type="number"
                        value={exam[maskAirKey] ?? ''}
                        onChange={(e) =>
                          setField(
                            maskAirKey as any,
                            e.target.value === '' ? null : Number(e.target.value),
                          )
                        }
                        disabled={isSecretaria}
                        className="h-10 rounded-xl text-xs font-medium border-slate-300 bg-white"
                      />
                    </Field>
                    <Field label="Masc. V.O. (dB)">
                      <Input
                        type="number"
                        value={exam[maskBoneKey] ?? ''}
                        onChange={(e) =>
                          setField(
                            maskBoneKey as any,
                            e.target.value === '' ? null : Number(e.target.value),
                          )
                        }
                        disabled={isSecretaria}
                        className="h-10 rounded-xl text-xs font-medium border-slate-300 bg-white"
                      />
                    </Field>
                  </div>
                </div>
              )
            })}
          </div>
        </Section>

        {/* IPRF (vocal estruturado) */}
        <Section
          title="I.P.R.F. (Logoaudiometria)"
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
              return (
                <div
                  key={side}
                  className={`p-4 rounded-2xl border bg-slate-50/50 shadow-sm space-y-3 ${borderCard}`}
                >
                  <h4 className={`text-xs font-extrabold uppercase tracking-wider ${color}`}>
                    Orelha {side === 'OD' ? 'Direita (OD)' : 'Esquerda (OE)'}
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Intensidade (dB)">
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
                        className="h-10 rounded-xl text-xs font-medium border-slate-300 bg-white"
                      />
                    </Field>
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
                        className="h-10 rounded-xl text-xs font-medium border-slate-300 bg-white"
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
                        className="h-10 rounded-xl text-xs font-medium border-slate-300 bg-white"
                      />
                    </Field>
                  </div>
                </div>
              )
            })}
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

        {/* Grau / Tipo / Parecer */}
        <Section title="Parecer Audiológico" icon={<FileText className="w-4 h-4 text-teal-600" />}>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Grau da Perda">
                <Select
                  value={exam.loss_degree || '__none'}
                  onValueChange={(v) => setField('loss_degree', v === '__none' ? '' : v)}
                  disabled={isSecretaria}
                >
                  <SelectTrigger className="h-10 rounded-xl text-xs">
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
                  <SelectTrigger className="h-10 rounded-xl text-xs">
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
          </div>
        </Section>
      </div>

      {/* Rodapé de ações: Salvar / Imprimir */}
      <div className="no-print flex flex-col sm:flex-row items-center justify-end gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
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

/* ---------- Prévia clínica (formato do PDF, visível na tela E impressão) ---------- */
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
        {/* Cabeçalho da clínica */}
        <div className="flex items-start justify-between border-b-2 border-navy-700 pb-3">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight" style={{ color: '#0F2B5C' }}>
              Audição360
            </h2>
            <p className="text-[11px] text-slate-500 leading-tight">
              R. Sadoc Correa, 373 - St. Central, Araguaína - TO, 77803-060
              <br />
              Telefone: (63) 3421-2611
            </p>
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

        {/* Parecer */}
        <div>
          <SectionLabel>PARECER AUDIOLÓGICO</SectionLabel>
          <div className="border border-slate-300 rounded-md p-2 text-[11px] text-slate-800 whitespace-pre-wrap min-h-[60px]">
            {exam.report || '—'}
          </div>
          <p className="text-[9px] text-slate-500 italic mt-1 text-justify">
            (Silman e Silverman (1997) adaptada de Carhart (1945) e Lloyd e Kaplan (1978).) (Jerger,
            Speaks e Trammell, 1968).
          </p>
        </div>

        {/* Assinatura */}
        <div className="pt-4">
          <div className="mx-auto text-center" style={{ maxWidth: 320 }}>
            <div className="border-t border-slate-500 pt-1 text-[12px] font-bold text-slate-800">
              {SPECIALIST_NAME}
            </div>
            <div className="text-[10px] text-slate-500">Fonoaudiólogo — CRFa 3-11981-5</div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------- Subcomponentes da prévia ---------- */
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
    const monoPct = r.monossilabos ? `${r.monossilabos}%` : '100%'
    const monoDb = r.intensidade ? `${r.intensidade} dB` : '- dB'
    const dissiPct = r.dissilabos ? `${r.dissilabos}%` : '100%'
    const dissiDb = r.intensidade ? `${r.intensidade} dB` : '- dB'
    return `${intens} - ${monoPct} Monossílabos (${monoDb}) / ${dissiPct} Dissílabos (${dissiDb})`
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
            <td className={`${td} text-left font-semibold`}>I.P.R.F</td>
            <td className={td}>{fmtIprf(odRow)}</td>
            <td className={td}>{fmtIprf(oeRow)}</td>
          </tr>
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

/* ---------- Grade horizontal compacta de Via Aérea / Via Óssea ---------- */

interface ConductionGridProps {
  kind: 'air' | 'bone'
  freqs: string[]
  odMap: AudiogramMap
  oeMap: AudiogramMap
  onOdDb: (freq: string, raw: string) => void
  onOdSymbol: (freq: string, sym: AudiogramSymbol) => void
  onOeDb: (freq: string, raw: string) => void
  onOeSymbol: (freq: string, sym: AudiogramSymbol) => void
  disabled?: boolean
}

/** Símbolos textuais exibidos nos botões (referência clínica). */
function symbolsFor(kind: 'air' | 'bone', side: 'OD' | 'OE') {
  if (kind === 'air') {
    if (side === 'OD')
      return {
        normal: '○',
        no_response: '○↓',
        masked: '△',
        masked_no_response: '△↓',
      }
    return { normal: '✕', no_response: '✕↓', masked: '□', masked_no_response: '□↓' }
  }
  if (side === 'OD')
    return { normal: '<', no_response: '<↓', masked: '[', masked_no_response: '[↓' }
  return { normal: '>', no_response: '>↓', masked: ']', masked_no_response: ']↓' }
}

function ConductionGrid({
  kind,
  freqs,
  odMap,
  oeMap,
  onOdDb,
  onOdSymbol,
  onOeDb,
  onOeSymbol,
  disabled,
}: ConductionGridProps) {
  const fmtFreq = (f: string) => (Number(f) >= 1000 ? `${Number(f) / 1000}k` : f)

  const renderRow = (side: 'OD' | 'OE') => {
    const map = side === 'OD' ? odMap : oeMap
    const onDb = side === 'OD' ? onOdDb : onOeDb
    const onSym = side === 'OD' ? onOdSymbol : onOeSymbol
    const syms = symbolsFor(kind, side)
    const colorTxt = side === 'OD' ? 'text-red-600' : 'text-blue-600'
    const activeBg = side === 'OD' ? 'bg-red-600' : 'bg-blue-600'

    const symBtn = (active: boolean) =>
      `w-6 h-5 text-[10px] font-bold rounded leading-none flex items-center justify-center ${
        active
          ? `${activeBg} text-white`
          : 'text-slate-600 hover:bg-slate-200 border border-slate-200'
      }`

    return (
      <tr>
        <td
          className={`py-2 px-3 font-extrabold bg-slate-50/80 border-r border-slate-200 ${colorTxt} text-xs align-top w-20`}
        >
          {side}
          <div className="text-[9px] font-medium text-slate-400 mt-0.5">
            {side === 'OD' ? 'Direita' : 'Esquerda'}
          </div>
        </td>
        {freqs.map((f) => {
          const dbVal = map[f]?.db
          const sym = map[f]?.symbol || 'normal'
          return (
            <td key={f} className="p-1 border-r border-slate-200 text-center align-top">
              <input
                type="number"
                value={dbVal ?? ''}
                onChange={(e) => onDb(f, e.target.value)}
                disabled={disabled}
                placeholder="—"
                className={`w-12 h-8 text-center text-xs font-semibold rounded bg-slate-100 border border-slate-300 focus:bg-white focus:outline-none focus:ring-1 ${
                  side === 'OD' ? 'focus:ring-red-400' : 'focus:ring-blue-400'
                }`}
              />
              <div className="flex flex-col items-center gap-0.5 mt-1">
                <button
                  type="button"
                  onClick={() => onSym(f, 'no_response')}
                  disabled={disabled}
                  title="Ausente"
                  className={symBtn(sym === 'no_response')}
                >
                  {syms.no_response}
                </button>
                <button
                  type="button"
                  onClick={() => onSym(f, 'masked')}
                  disabled={disabled}
                  title="Mascarado"
                  className={symBtn(sym === 'masked')}
                >
                  {syms.masked}
                </button>
                <button
                  type="button"
                  onClick={() => onSym(f, 'masked_no_response')}
                  disabled={disabled}
                  title="Mascarado Ausente"
                  className={symBtn(sym === 'masked_no_response')}
                >
                  {syms.masked_no_response}
                </button>
                <button
                  type="button"
                  onClick={() => onSym(f, 'normal')}
                  disabled={disabled}
                  title="Padrão"
                  className={symBtn(sym === 'normal')}
                >
                  {syms.normal}
                </button>
              </div>
            </td>
          )
        })}
      </tr>
    )
  }

  return (
    <div className="overflow-x-auto border border-slate-300 rounded-lg bg-white shadow-sm">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-slate-300 bg-slate-50">
            <th className="py-2 px-3 text-left font-bold text-slate-700 w-20 border-r border-slate-200">
              Hz
            </th>
            {freqs.map((f) => (
              <th
                key={f}
                className="py-2 px-1 text-center font-semibold text-slate-600 border-r border-slate-200"
                style={{ minWidth: '60px' }}
              >
                {fmtFreq(f)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {renderRow('OD')}
          {renderRow('OE')}
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
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6">
      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 pb-4 border-b border-slate-100 mb-4">
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
      <Label className="text-[11px] font-semibold text-slate-600 block mb-1">{label}</Label>
      {children}
    </div>
  )
}
