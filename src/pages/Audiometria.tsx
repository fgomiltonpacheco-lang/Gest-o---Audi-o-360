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
import { Badge } from '@/components/ui/badge'
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
  IprfData,
  IprfRow,
  LOSS_DEGREE_OPTIONS,
  LOSS_TYPE_OPTIONS,
  emptyAudiogramMap,
  emptyIprf,
  emptyAudiometryExamFull,
} from '@/types'
import { calculateAge, formatDate, maskCPF } from '@/lib/formatters'
import { mediaTritonal, mediaQuadritonal } from '@/lib/audiogram'

/* Frequências exibidas nas grades (sem 125 Hz — não usado na prática clínica deste exame) */
const AIR_GRID_FREQS = ['250', '500', '750', '1000', '1500', '2000', '3000', '4000', '6000', '8000']
const BONE_GRID_FREQS = ['500', '1000', '2000', '3000', '4000']

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

function normalizeIprf(raw: any): IprfData {
  const emptyRow = (): IprfRow => ({
    intensidade: '',
    monossilabos: '',
    dissilabos: '',
    mascaramento: '',
    palavras: '',
  })
  if (!raw || typeof raw !== 'object') return emptyIprf()
  const norm = (r: any): IprfRow => ({
    intensidade: r?.intensidade ?? '',
    monossilabos: r?.monossilabos ?? '',
    dissilabos: r?.dissilabos ?? '',
    mascaramento: r?.mascaramento ?? '',
    palavras: r?.palavras ?? '',
  })
  return { od: norm(raw.od), oe: norm(raw.oe) }
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
    audiometer: r.audiometer || 'R27a Resonance',
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
    mt_od: r.mt_od != null && r.mt_od !== '' ? Number(r.mt_od) : null,
    mt_oe: r.mt_oe != null && r.mt_oe !== '' ? Number(r.mt_oe) : null,
    lrf_od: r.lrf_od != null && r.lrf_od !== '' ? Number(r.lrf_od) : null,
    lrf_oe: r.lrf_oe != null && r.lrf_oe !== '' ? Number(r.lrf_oe) : null,
    ldv_od: r.ldv_od != null && r.ldv_od !== '' ? Number(r.ldv_od) : null,
    ldv_oe: r.ldv_oe != null && r.ldv_oe !== '' ? Number(r.ldv_oe) : null,
    iprf: normalizeIprf(r.iprf),
    iprf_od: r.iprf_od != null && r.iprf_od !== '' ? Number(r.iprf_od) : null,
    iprf_oe: r.iprf_oe != null && r.iprf_oe !== '' ? Number(r.iprf_oe) : null,
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

function earLabel(side: 'OD' | 'OE'): string {
  return side === 'OD' ? 'Orelha Direita (OD)' : 'Orelha Esquerda (OE)'
}

function buildSuggestedReport(
  airOD: AudiogramMap,
  airOE: AudiogramMap,
  boneOD: AudiogramMap,
  boneOE: AudiogramMap,
  patientName: string,
): string {
  const lines: string[] = []
  lines.push(
    `Paciente: ${patientName}. Realizado exame audiológico tonal e vocal para avaliação da acuidade auditiva.`,
  )

  const describeEar = (side: 'OD' | 'OE', air: AudiogramMap, bone: AudiogramMap) => {
    const avg = avgAir(air)
    const degree = degreeFromAvg(avg)
    const type = determineType(air, bone)
    if (avg === null) {
      lines.push(`${earLabel(side)}: dados insuficientes para análise.`)
      return
    }
    lines.push(
      `${earLabel(side)}: limiares por via aérea com média de 500, 1000, 2000 e 4000 Hz de ${avg.toFixed(0)} dB, compatível com perda ${degree.toLowerCase()}.`,
    )
    lines.push(`Tipo de perda: ${type}.`)
  }

  describeEar('OD', airOD, boneOD)
  describeEar('OE', airOE, boneOE)
  lines.push(
    'Laudo audiológico baseado em Lloyd e Kaplan (1978); Silman e Silverman (1997) adaptada de Carhart (1945) e Lloyd e Kaplan (1978); Jerger, Speaks, e Trammell (1968).',
  )
  return lines.join('\n')
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
  >(() => emptyAudiometryExamFull(id || '', patient?.name || ''))

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
      }))
    }
  }, [patient?.id, isNew])

  const patientAge = useMemo(() => {
    if (exam.age) return exam.age
    if (exam.dob) return calculateAge(exam.dob)?.toString() || ''
    return ''
  }, [exam.age, exam.dob])

  /* ---------- Updaters ---------- */
  const setField = <K extends keyof typeof exam>(key: K, value: (typeof exam)[K]) => {
    setExam((prev) => ({ ...prev, [key]: value }))
  }

  // Alvos de via aérea/óssea: ao digitar um valor de dB, o símbolo PADRÃO
  // (○ para OD aérea, ✕ para OE aérea, < para OD óssea, > para OE óssea)
  // é aplicado automaticamente — sem que o usuário precise clicar em "Padrão".
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
        // Símbolo padrão automático sempre que o dB é alterado por digitação.
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
      age: exam.age || patientAge,
      sex: exam.sex,
      referred_by: exam.referred_by,
      hearing_rest_14h: !!exam.hearing_rest_14h,
      audiometer: exam.audiometer || 'R27a Resonance',
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
      title: 'Audiometria Tonal e Vocal',
      subtitle: `${patient?.name || ''} — ${formatDate(exam.date)}`,
      body: <AudiometriaFullPrint exam={fullExam} />,
    })
  }

  /* ---------- Laudo sugerido ---------- */
  const handleSuggestedReport = () => {
    const text = buildSuggestedReport(
      exam.air_od,
      exam.air_oe,
      exam.bone_od,
      exam.bone_oe,
      patient?.name || '',
    )
    setField('report', text)
    // Pré-preenche grau/tipo com base no OD (se houver dados)
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
      {/* Cabeçalho */}
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
              Audiometria Tonal e Vocal
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {patient.name} • {isNew ? 'Novo exame' : `Exame de ${formatDate(exam.date)}`}
            </p>
          </div>
        </div>
      </div>

      {/* Identificação */}
      <Section title="Identificação" icon={<FileText className="w-4 h-4 text-teal-600" />}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Field label="Paciente">
            <Input
              value={patient.name}
              readOnly
              className="h-10 rounded-xl text-xs bg-slate-50 border-slate-200"
            />
          </Field>
          <Field label="Data do Exame">
            <Input
              type="date"
              value={exam.date}
              onChange={(e) => setField('date', e.target.value)}
              disabled={isSecretaria}
              className="h-10 rounded-xl text-xs border-slate-300"
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
          <Field label="Idade">
            <Input
              value={patientAge ? `${patientAge} anos` : ''}
              readOnly
              className="h-10 rounded-xl text-xs bg-slate-50 border-slate-200"
            />
          </Field>
          <Field label="Sexo">
            <Input
              value={exam.sex}
              readOnly
              className="h-10 rounded-xl text-xs bg-slate-50 border-slate-200"
            />
          </Field>
          <Field label="Encaminhado por">
            <Input
              value={exam.referred_by}
              onChange={(e) => setField('referred_by', e.target.value)}
              disabled={isSecretaria}
              placeholder="Nome do solicitante"
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
          <Field label="Calibração">
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

      {/* Grade de Via Aérea (Fones) */}
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

      {/* Grade de Via Óssea (Mastóide) */}
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

      {/* Audiograma Interativo */}
      <Section
        title="Audiograma Tonal (Interativo)"
        icon={<Activity className="w-4 h-4 text-teal-600" />}
      >
        <AudiogramChart
          airOD={exam.air_od}
          airOE={exam.air_oe}
          boneOD={exam.bone_od}
          boneOE={exam.bone_oe}
          ldlOD={exam.ldl_od}
          ldlOE={exam.ldl_oe}
        />

        {/* Médias automáticas por orelha */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3 rounded-xl border border-red-200 bg-red-50/50">
            <h4 className="text-xs font-bold uppercase tracking-wider text-red-600 mb-1">
              OD — Orelha Direita
            </h4>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <span className="text-slate-700">
                <strong>Média Tritonal:</strong>{' '}
                <span className="font-semibold text-slate-900">
                  {odTrito === null ? '—' : `${odTrito} dB`}
                </span>
              </span>
              <span className="text-slate-700">
                <strong>Média Quadritonal:</strong>{' '}
                <span className="font-semibold text-slate-900">
                  {odQuadri === null ? '—' : `${odQuadri} dB`}
                </span>
              </span>
            </div>
          </div>
          <div className="p-3 rounded-xl border border-blue-200 bg-blue-50/50">
            <h4 className="text-xs font-bold uppercase tracking-wider text-blue-600 mb-1">
              OE — Orelha Esquerda
            </h4>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <span className="text-slate-700">
                <strong>Média Tritonal:</strong>{' '}
                <span className="font-semibold text-slate-900">
                  {oeTrito === null ? '—' : `${oeTrito} dB`}
                </span>
              </span>
              <span className="text-slate-700">
                <strong>Média Quadritonal:</strong>{' '}
                <span className="font-semibold text-slate-900">
                  {oeQuadri === null ? '—' : `${oeQuadri} dB`}
                </span>
              </span>
            </div>
          </div>
        </div>
      </Section>

      {/* Audiometria Vocal */}
      <Section title="Audiometria Vocal" icon={<Activity className="w-4 h-4 text-teal-600" />}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(['OD', 'OE'] as const).map((side) => {
            const color = side === 'OD' ? 'text-red-600' : 'text-blue-600'
            const borderCard =
              side === 'OD'
                ? 'border-slate-200 hover:border-red-200'
                : 'border-slate-200 hover:border-blue-200'
            const lrfKey = side === 'OD' ? 'lrf_od' : 'lrf_oe'
            const ldvKey = side === 'OD' ? 'ldv_od' : 'ldv_oe'
            const iprfKey = side === 'OD' ? 'iprf_od' : 'iprf_oe'
            return (
              <div
                key={side}
                className={`p-4 rounded-2xl border bg-slate-50/50 shadow-sm transition-colors space-y-3 ${borderCard}`}
              >
                <h4 className={`text-xs font-extrabold uppercase tracking-wider ${color}`}>
                  Orelha {side === 'OD' ? 'Direita (OD)' : 'Esquerda (OE)'}
                </h4>
                <div className="grid grid-cols-3 gap-3">
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
                      className="h-10 rounded-xl text-xs font-medium border-slate-300 bg-white focus:ring-2 focus:ring-teal-500/20"
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
                      className="h-10 rounded-xl text-xs font-medium border-slate-300 bg-white focus:ring-2 focus:ring-teal-500/20"
                    />
                  </Field>
                  <Field label="IPRF (%)">
                    <Input
                      type="number"
                      value={exam[iprfKey] ?? ''}
                      onChange={(e) =>
                        setField(
                          iprfKey as any,
                          e.target.value === '' ? null : Number(e.target.value),
                        )
                      }
                      disabled={isSecretaria}
                      placeholder="0-100"
                      className="h-10 rounded-xl text-xs font-medium border-slate-300 bg-white focus:ring-2 focus:ring-teal-500/20"
                    />
                  </Field>
                </div>
              </div>
            )
          })}
        </div>
      </Section>

      {/* Laudo Clínico */}
      <Section title="Laudo Clínico" icon={<FileText className="w-4 h-4 text-teal-600" />}>
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
          <p className="text-[10px] text-slate-400 italic">
            Laudo audiológico baseado em Lloyd e Kaplan (1978); Silman e Silverman (1997) adaptada
            de Carhart (1945) e Lloyd e Kaplan (1978); Jerger, Speaks, e Trammell (1968)
          </p>
        </div>
      </Section>

      {/* Resumo rápido do grau/tipo */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200">
        <Badge className="bg-red-50 text-red-700 border-red-200">
          OD (Vermelho): {degreeFromAvg(avgAir(exam.air_od)) || '—'} •{' '}
          {determineType(exam.air_od, exam.bone_od)}
        </Badge>
        <Badge className="bg-blue-50 text-blue-700 border-blue-200">
          OE (Azul): {degreeFromAvg(avgAir(exam.air_oe)) || '—'} •{' '}
          {determineType(exam.air_oe, exam.bone_oe)}
        </Badge>
      </div>

      {/* Rodapé de ações: Salvar / Imprimir */}
      <div className="flex flex-col sm:flex-row items-center justify-end gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
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
              {/* Botões de símbolo abaixo do input */}
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
