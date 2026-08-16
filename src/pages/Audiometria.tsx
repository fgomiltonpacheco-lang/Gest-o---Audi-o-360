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
  ArrowLeft,
  Save,
  Printer,
  Activity,
  Stethoscope,
  Ear,
  FileText,
  Wand2,
  Loader2,
} from 'lucide-react'
import {
  AIR_FREQS,
  BONE_FREQS,
  AudiogramMap,
  AudiogramSymbol,
  AudiometryExamFull,
  IprfData,
  IprfRow,
  emptyAudiogramMap,
  emptyIprf,
  emptyAudiometryExamFull,
} from '@/types'
import { calculateAge, formatDate, maskCPF } from '@/lib/formatters'

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
    report: r.report || '',
    created: r.created || '',
    updated: r.updated || '',
  }
}

/* ---------- Laudo sugerido ---------- */
function degreeFromAvg(avg: number | null): string {
  if (avg === null) return '—'
  if (avg <= 25) return 'Normal'
  if (avg <= 40) return 'Leve'
  if (avg <= 55) return 'Moderado'
  if (avg <= 70) return 'Moderadamente Severo'
  if (avg <= 90) return 'Severo'
  return 'Profundo'
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

  const setPoint = (
    target: 'air_od' | 'air_oe' | 'bone_od' | 'bone_oe' | 'ldl_od' | 'ldl_oe',
    freq: string,
    patch: Partial<{ db: number | null; symbol: AudiogramSymbol }>,
  ) => {
    setExam((prev) => {
      const map = { ...(prev[target] || {}) }
      const cur = map[freq] || { db: null, symbol: 'normal' }
      map[freq] = { ...cur, ...patch }
      return { ...prev, [target]: map }
    })
  }

  const setIprfRow = (side: 'od' | 'oe', field: keyof IprfRow, value: string) => {
    setExam((prev) => ({
      ...prev,
      iprf: { ...prev.iprf, [side]: { ...prev.iprf[side], [field]: value } },
    }))
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
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handlePrint}
            className="rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold h-10"
          >
            <Printer className="w-4 h-4 mr-1.5" />
            Imprimir
          </Button>
          {!isSecretaria && (
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-xs font-semibold h-10 shadow-sm"
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
          <Field label="Repouso Auditivo de 14h">
            <div className="flex items-center gap-3 h-10">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="radio"
                  name="hearing_rest"
                  checked={exam.hearing_rest_14h === true}
                  onChange={() => setField('hearing_rest_14h', true)}
                  disabled={isSecretaria}
                  className="accent-teal-600"
                />
                Sim
              </label>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="radio"
                  name="hearing_rest"
                  checked={exam.hearing_rest_14h === false}
                  onChange={() => setField('hearing_rest_14h', false)}
                  disabled={isSecretaria}
                  className="accent-teal-600"
                />
                Não
              </label>
            </div>
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

      {/* Meatoscopia / Otoscopia */}
      <Section
        title="Meatoscopia / Otoscopia"
        icon={<Stethoscope className="w-4 h-4 text-teal-600" />}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {(['OD', 'OE'] as const).map((side) => {
            const key = side === 'OD' ? 'otoscopy_od' : 'otoscopy_oe'
            const obsKey = side === 'OD' ? 'otoscopy_od_obs' : 'otoscopy_oe_obs'
            const color = side === 'OD' ? 'text-red-600' : 'text-blue-600'
            const value = exam[key] as 'Normal' | 'Alterada' | ''
            return (
              <div
                key={side}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3"
              >
                <h4 className={`text-xs font-bold uppercase tracking-wider ${color}`}>
                  Orelha {side === 'OD' ? 'Direita (OD)' : 'Esquerda (OE)'}
                </h4>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name={`otoscopy-${side}`}
                      checked={value === 'Normal'}
                      onChange={() => setField(key, 'Normal' as any)}
                      disabled={isSecretaria}
                      className="accent-teal-600"
                    />
                    Normal
                  </label>
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name={`otoscopy-${side}`}
                      checked={value === 'Alterada'}
                      onChange={() => setField(key, 'Alterada' as any)}
                      disabled={isSecretaria}
                      className="accent-teal-600"
                    />
                    Alterada
                  </label>
                </div>
                {value === 'Alterada' && (
                  <Textarea
                    value={exam[obsKey] as string}
                    onChange={(e) => setField(obsKey as any, e.target.value)}
                    disabled={isSecretaria}
                    placeholder="Observações da meatoscopia..."
                    rows={2}
                    className="rounded-xl text-xs border-slate-300 resize-none"
                  />
                )}
              </div>
            )
          })}
        </div>
      </Section>

      {/* Tabelas de Dados Editáveis do Audiograma (Grid Horizontal em Formato Clínico) */}
      <Section
        title="Entrada de Dados do Audiograma Tonal"
        icon={<Ear className="w-4 h-4 text-teal-600" />}
      >
        <div className="space-y-8">
          {/* Orelha Direita (OD) */}
          <HorizontalAudiogramGrid
            title="Audiometria Orelha Direita (OD)"
            side="OD"
            colorClass="text-red-600"
            headerColorClass="text-red-500"
            airMap={exam.air_od}
            boneMap={exam.bone_od}
            ldlMap={exam.ldl_od || emptyAudiogramMap(AIR_FREQS)}
            onAirDb={(f, val) => setPoint('air_od', f, { db: handleDbInput(val) })}
            onAirSymbol={(f, sym) => setPoint('air_od', f, { symbol: sym })}
            onBoneDb={(f, val) => setPoint('bone_od', f, { db: handleDbInput(val) })}
            onBoneSymbol={(f, sym) => setPoint('bone_od', f, { symbol: sym })}
            onLdlDb={(f, val) => setPoint('ldl_od', f, { db: handleDbInput(val) })}
            disabled={isSecretaria}
          />

          {/* Orelha Esquerda (OE) */}
          <HorizontalAudiogramGrid
            title="Audiometria Orelha Esquerda (OE)"
            side="OE"
            colorClass="text-blue-600"
            headerColorClass="text-blue-500"
            airMap={exam.air_oe}
            boneMap={exam.bone_oe}
            ldlMap={exam.ldl_oe || emptyAudiogramMap(AIR_FREQS)}
            onAirDb={(f, val) => setPoint('air_oe', f, { db: handleDbInput(val) })}
            onAirSymbol={(f, sym) => setPoint('air_oe', f, { symbol: sym })}
            onBoneDb={(f, val) => setPoint('bone_oe', f, { db: handleDbInput(val) })}
            onBoneSymbol={(f, sym) => setPoint('bone_oe', f, { symbol: sym })}
            onLdlDb={(f, val) => setPoint('ldl_oe', f, { db: handleDbInput(val) })}
            disabled={isSecretaria}
          />
        </div>
      </Section>

      {/* Lado a lado: Os dois Gráficos do Audiograma */}
      <Section
        title="Audiograma Tonal (Lado a Lado)"
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
      </Section>

      {/* Audiometria Vocal */}
      <Section title="Audiometria Vocal" icon={<Activity className="w-4 h-4 text-teal-600" />}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {(['OD', 'OE'] as const).map((side) => {
            const color = side === 'OD' ? 'text-red-600' : 'text-blue-600'
            const mtKey = side === 'OD' ? 'mt_od' : 'mt_oe'
            const lrfKey = side === 'OD' ? 'lrf_od' : 'lrf_oe'
            const ldvKey = side === 'OD' ? 'ldv_od' : 'ldv_oe'
            return (
              <div
                key={side}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3"
              >
                <h4 className={`text-xs font-bold uppercase tracking-wider ${color}`}>
                  Orelha {side === 'OD' ? 'Direita (OD)' : 'Esquerda (OE)'}
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="MT — Limiar Tonal Médio (dB)">
                    <Input
                      type="number"
                      value={exam[mtKey] ?? ''}
                      onChange={(e) =>
                        setField(
                          mtKey as any,
                          e.target.value === '' ? null : Number(e.target.value),
                        )
                      }
                      disabled={isSecretaria}
                      className="h-10 rounded-xl text-xs border-slate-300"
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
                      className="h-10 rounded-xl text-xs border-slate-300"
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
                      className="h-10 rounded-xl text-xs border-slate-300"
                    />
                  </Field>
                </div>
              </div>
            )
          })}
        </div>

        {/* IPRF */}
        <div className="mt-5 p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            IPRF — Índice de Reconhecimento de Fala
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-slate-100 text-slate-600 font-bold">
                  <th className="py-2 px-3 text-left">Orelha</th>
                  <th className="py-2 px-3 text-center">Intensidade (dB)</th>
                  <th className="py-2 px-3 text-center">Monossílabos (%)</th>
                  <th className="py-2 px-3 text-center">Dissílabos (%)</th>
                  <th className="py-2 px-3 text-center">Mascaramento (dB)</th>
                  <th className="py-2 px-3 text-center">Palavras Faladas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {(['od', 'oe'] as const).map((side) => {
                  const label = side === 'od' ? 'OD' : 'OE'
                  const color = side === 'od' ? 'text-red-600' : 'text-blue-600'
                  const row = exam.iprf[side]
                  return (
                    <tr key={side}>
                      <td className={`py-2 px-3 font-bold ${color}`}>{label}</td>
                      <td className="p-1">
                        <Input
                          value={row.intensidade}
                          onChange={(e) => setIprfRow(side, 'intensidade', e.target.value)}
                          disabled={isSecretaria}
                          className="h-8 text-center text-xs rounded-lg border-slate-300"
                        />
                      </td>
                      <td className="p-1">
                        <Input
                          value={row.monossilabos}
                          onChange={(e) => setIprfRow(side, 'monossilabos', e.target.value)}
                          disabled={isSecretaria}
                          className="h-8 text-center text-xs rounded-lg border-slate-300"
                        />
                      </td>
                      <td className="p-1">
                        <Input
                          value={row.dissilabos}
                          onChange={(e) => setIprfRow(side, 'dissilabos', e.target.value)}
                          disabled={isSecretaria}
                          className="h-8 text-center text-xs rounded-lg border-slate-300"
                        />
                      </td>
                      <td className="p-1">
                        <Input
                          value={row.mascaramento}
                          onChange={(e) => setIprfRow(side, 'mascaramento', e.target.value)}
                          disabled={isSecretaria}
                          className="h-8 text-center text-xs rounded-lg border-slate-300"
                        />
                      </td>
                      <td className="p-1">
                        <Input
                          value={row.palavras}
                          onChange={(e) => setIprfRow(side, 'palavras', e.target.value)}
                          disabled={isSecretaria}
                          className="h-8 text-center text-xs rounded-lg border-slate-300"
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      {/* Parecer Audiológico */}
      <Section title="Parecer Audiológico" icon={<FileText className="w-4 h-4 text-teal-600" />}>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-slate-700">Laudo / Parecer</Label>
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
          OD (Vermelho): {degreeFromAvg(avgAir(exam.air_od))} •{' '}
          {determineType(exam.air_od, exam.bone_od)}
        </Badge>
        <Badge className="bg-blue-50 text-blue-700 border-blue-200">
          OE (Azul): {degreeFromAvg(avgAir(exam.air_oe))} •{' '}
          {determineType(exam.air_oe, exam.bone_oe)}
        </Badge>
      </div>
    </div>
  )
}

/* ---------- Componente Tabela Grid Horizontal estilo Referência ---------- */

interface HorizontalAudiogramGridProps {
  title: string
  side: 'OD' | 'OE'
  colorClass: string
  headerColorClass: string
  airMap: AudiogramMap
  boneMap: AudiogramMap
  ldlMap: AudiogramMap
  onAirDb: (freq: string, raw: string) => void
  onAirSymbol: (freq: string, sym: AudiogramSymbol) => void
  onBoneDb: (freq: string, raw: string) => void
  onBoneSymbol: (freq: string, sym: AudiogramSymbol) => void
  onLdlDb: (freq: string, raw: string) => void
  disabled?: boolean
}

function HorizontalAudiogramGrid({
  title,
  side,
  colorClass,
  headerColorClass,
  airMap,
  boneMap,
  ldlMap,
  onAirDb,
  onAirSymbol,
  onBoneDb,
  onBoneSymbol,
  onLdlDb,
  disabled,
}: HorizontalAudiogramGridProps) {
  const freqs = AIR_FREQS
  const isOD = side === 'OD'

  // Símbolos
  const airNormalSym = isOD ? '○' : '×'
  const airNoRespSym = isOD ? '○↓' : '×↓'
  const airMaskedSym = isOD ? 'Δ' : '□'

  const boneNormalSym = isOD ? '<' : '>'
  const boneNoRespSym = isOD ? '<↓' : '>↓'
  const boneMaskedSym = isOD ? '[' : ']'

  const absenceSym = isOD ? '⤓' : '⤓'

  const formatFreqHeader = (f: string) => {
    const n = Number(f)
    if (n >= 1000) return `${n / 1000}k`
    return f
  }

  return (
    <div className="space-y-2">
      <h3 className={`text-sm font-bold ${colorClass}`}>{title}</h3>
      <div className="overflow-x-auto border border-slate-300 rounded-lg bg-white shadow-sm">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-300 bg-slate-50">
              <th className="py-2 px-3 text-left font-bold text-slate-700 w-44 border-r border-slate-200">
                .
              </th>
              {freqs.map((f) => (
                <th
                  key={f}
                  className={`py-2 px-1 text-center font-semibold border-r border-slate-200 ${headerColorClass}`}
                  style={{ minWidth: '58px' }}
                >
                  {formatFreqHeader(f)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {/* Linha 1: Aérea (Input dB) */}
            <tr>
              <td className="py-2 px-3 font-bold text-slate-700 bg-slate-50/80 border-r border-slate-200">
                Aérea
              </td>
              {freqs.map((f) => {
                const dbVal = airMap[f]?.db
                return (
                  <td key={f} className="p-1 border-r border-slate-200 text-center">
                    <input
                      type="number"
                      value={dbVal ?? ''}
                      onChange={(e) => onAirDb(f, e.target.value)}
                      disabled={disabled}
                      placeholder=""
                      className="w-12 h-8 text-center text-xs font-semibold rounded bg-slate-100 border border-slate-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </td>
                )
              })}
            </tr>

            {/* Linha 2: Masc / Ausências (Via Aérea Símbolos) */}
            <tr>
              <td className="py-2 px-3 font-semibold text-slate-600 bg-slate-50/80 border-r border-slate-200">
                Masc / Ausências
              </td>
              {freqs.map((f) => {
                const sym = airMap[f]?.symbol || 'normal'
                return (
                  <td key={f} className="p-1 border-r border-slate-200 text-center">
                    <div className="flex items-center justify-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => onAirSymbol(f, 'masked')}
                        disabled={disabled}
                        title="Mascarado"
                        className={`w-4 h-6 text-xs font-bold rounded ${
                          sym === 'masked'
                            ? 'bg-teal-600 text-white'
                            : 'text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {airMaskedSym}
                      </button>
                      <button
                        type="button"
                        onClick={() => onAirSymbol(f, 'normal')}
                        disabled={disabled}
                        title="Normal"
                        className={`w-4 h-6 text-xs font-bold rounded ${
                          sym === 'normal'
                            ? 'bg-teal-600 text-white'
                            : 'text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {airNormalSym}
                      </button>
                      <button
                        type="button"
                        onClick={() => onAirSymbol(f, 'no_response')}
                        disabled={disabled}
                        title="Sem Resposta"
                        className={`w-4 h-6 text-xs font-bold rounded ${
                          sym === 'no_response' || sym === 'masked_no_response'
                            ? 'bg-teal-600 text-white'
                            : 'text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {airNoRespSym}
                      </button>
                    </div>
                  </td>
                )
              })}
            </tr>

            {/* Linha 3: Óssea (Input dB para frequências 500, 1k, 1.5k, 2k, 3k, 4k) */}
            <tr>
              <td className="py-2 px-3 font-bold text-slate-700 bg-slate-50/80 border-r border-slate-200">
                Óssea
              </td>
              {freqs.map((f) => {
                const isBoneFreq = (BONE_FREQS as readonly string[]).includes(f)
                const dbVal = boneMap[f]?.db
                return (
                  <td key={f} className="p-1 border-r border-slate-200 text-center">
                    {isBoneFreq ? (
                      <input
                        type="number"
                        value={dbVal ?? ''}
                        onChange={(e) => onBoneDb(f, e.target.value)}
                        disabled={disabled}
                        placeholder=""
                        className="w-12 h-8 text-center text-xs font-semibold rounded bg-slate-100 border border-slate-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                      />
                    ) : (
                      <div className="w-12 h-8 mx-auto bg-slate-50/50 rounded" />
                    )}
                  </td>
                )
              })}
            </tr>

            {/* Linha 4: Masc / Ausências (Via Óssea Símbolos) */}
            <tr>
              <td className="py-2 px-3 font-semibold text-slate-600 bg-slate-50/80 border-r border-slate-200">
                Masc / Ausências
              </td>
              {freqs.map((f) => {
                const isBoneFreq = (BONE_FREQS as readonly string[]).includes(f)
                const sym = boneMap[f]?.symbol || 'normal'
                if (!isBoneFreq) {
                  return <td key={f} className="p-1 border-r border-slate-200 text-center" />
                }
                return (
                  <td key={f} className="p-1 border-r border-slate-200 text-center">
                    <div className="flex items-center justify-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => onBoneSymbol(f, 'masked')}
                        disabled={disabled}
                        title="Mascarado"
                        className={`w-4 h-6 text-xs font-bold rounded ${
                          sym === 'masked'
                            ? 'bg-teal-600 text-white'
                            : 'text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {boneMaskedSym}
                      </button>
                      <button
                        type="button"
                        onClick={() => onBoneSymbol(f, 'normal')}
                        disabled={disabled}
                        title="Normal"
                        className={`w-4 h-6 text-xs font-bold rounded ${
                          sym === 'normal'
                            ? 'bg-teal-600 text-white'
                            : 'text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {boneNormalSym}
                      </button>
                      <button
                        type="button"
                        onClick={() => onBoneSymbol(f, 'no_response')}
                        disabled={disabled}
                        title="Sem Resposta"
                        className={`w-4 h-6 text-xs font-bold rounded ${
                          sym === 'no_response' || sym === 'masked_no_response'
                            ? 'bg-teal-600 text-white'
                            : 'text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {boneNoRespSym}
                      </button>
                    </div>
                  </td>
                )
              })}
            </tr>

            {/* Linha 5: Limiar de Desconforto (LDL) */}
            <tr>
              <td className="py-2 px-3 font-bold text-slate-700 bg-slate-50/80 border-r border-slate-200">
                Limiar de Desconforto (LDL)
              </td>
              {freqs.map((f) => {
                const ldlVal = ldlMap[f]?.db
                return (
                  <td key={f} className="p-1 border-r border-slate-200 text-center">
                    <input
                      type="number"
                      value={ldlVal ?? ''}
                      onChange={(e) => onLdlDb(f, e.target.value)}
                      disabled={disabled}
                      placeholder=""
                      className="w-12 h-8 text-center text-xs font-semibold rounded bg-slate-100 border border-slate-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </td>
                )
              })}
            </tr>

            {/* Linha 6: Ausências */}
            <tr>
              <td className="py-2 px-3 font-semibold text-slate-600 bg-slate-50/80 border-r border-slate-200">
                Ausências
              </td>
              {freqs.map((f) => {
                const airSym = airMap[f]?.symbol
                const isNoResp = airSym === 'no_response' || airSym === 'masked_no_response'
                return (
                  <td key={f} className="p-1 border-r border-slate-200 text-center">
                    <button
                      type="button"
                      onClick={() => onAirSymbol(f, isNoResp ? 'normal' : 'no_response')}
                      disabled={disabled}
                      title="Alternar ausência de resposta"
                      className={`w-6 h-6 text-sm font-bold rounded mx-auto ${
                        isNoResp ? 'bg-red-600 text-white' : 'text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      {absenceSym}
                    </button>
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
