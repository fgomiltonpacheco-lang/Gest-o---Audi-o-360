import React, { useMemo, useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Activity, ArrowUpDown, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { formatDate } from '@/lib/formatters'

const AIR_FREQUENCIES = ['250', '500', '1000', '2000', '3000', '4000', '6000', '8000']
const BONE_FREQUENCIES = ['500', '1000', '2000', '4000']

/**
 * Forma normalizada usada internamente pelo comparativo.
 * Aceita tanto exames legados (AudiometryExam, com airOD/airOE em dB)
 * quanto exames completos (audiometry_exams, com air_od/air_oe como AudiogramMap).
 */
type FreqMap = Record<string, number | null | 'NR'>

interface NormExam {
  id: string
  date: string
  lossDegree: string
  lossType: string
  airOD: FreqMap
  airOE: FreqMap
  boneOD: FreqMap
  boneOE: FreqMap
  srtOD?: number
  srtOE?: number
  iprfOD?: number
  iprfOE?: number
}

/** Converte um mapa de frequências (AudiogramMap ou Record de dB) para FreqMap. */
function toFreqMap(raw: any): FreqMap {
  if (!raw || typeof raw !== 'object') return {}
  const out: FreqMap = {}
  Object.keys(raw).forEach((k) => {
    const v = raw[k]
    if (v === null || v === undefined) {
      out[k] = null
    } else if (typeof v === 'number' || v === 'NR') {
      out[k] = v
    } else if (typeof v === 'object' && 'db' in v) {
      // AudiogramPoint { db, symbol }
      const db = (v as any).db
      out[k] = db === null || db === undefined ? null : db
    } else {
      out[k] = null
    }
  })
  return out
}

function numOrUndef(v: any): number | undefined {
  if (v === null || v === undefined || v === '') return undefined
  const n = Number(v)
  return isNaN(n) ? undefined : n
}

function avgAir(map: FreqMap): number | null {
  const freqs = ['500', '1000', '2000', '4000']
  const vals = freqs.map((f) => map[f]).filter((v): v is number => typeof v === 'number')
  if (vals.length === 0) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

function degreeFromAvg(avg: number | null): string {
  if (avg === null) return '—'
  if (avg <= 25) return 'Normal'
  if (avg <= 40) return 'Leve'
  if (avg <= 55) return 'Moderada'
  if (avg <= 70) return 'Moderadamente Severa'
  if (avg <= 90) return 'Severa'
  return 'Profunda'
}

function determineType(air: FreqMap, bone: FreqMap): string {
  const freqs = ['500', '1000', '2000', '4000']
  let hasGap = false
  let airAbnormal = false
  let boneAbnormal = false
  freqs.forEach((f) => {
    const a = air[f]
    const b = bone[f]
    if (typeof a === 'number') {
      if (a > 25) airAbnormal = true
      if (typeof b === 'number') {
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

/** Normaliza qualquer formato de audiometria (legado ou completo) para NormExam. */
function normalizeExam(rec: any): NormExam {
  const fallback: NormExam = {
    id: '',
    date: '',
    lossDegree: '—',
    lossType: '—',
    airOD: {},
    airOE: {},
    boneOD: {},
    boneOE: {},
  }
  if (!rec) return fallback
  // Exame completo (audiometry_exams) — mapas como AudiogramPoint { db, symbol }
  if (rec.air_od || rec.air_oe || rec.bone_od || rec.bone_oe) {
    const airOD = toFreqMap(rec.air_od)
    const airOE = toFreqMap(rec.air_oe)
    const boneOD = toFreqMap(rec.bone_od)
    const boneOE = toFreqMap(rec.bone_oe)
    return {
      id: rec.id || '',
      date: rec.date || '',
      lossDegree: degreeFromAvg(avgAir(airOD)),
      lossType: determineType(airOD, boneOD),
      airOD,
      airOE,
      boneOD,
      boneOE,
      srtOD: numOrUndef(rec.mt_od),
      srtOE: numOrUndef(rec.mt_oe),
      iprfOD: numOrUndef(rec.iprf?.od?.monossilabos),
      iprfOE: numOrUndef(rec.iprf?.oe?.monossilabos),
    }
  }
  // Exame legado (AudiometryExam) — airOD/airOE/boneOD/boneOE em dB direto
  return {
    id: rec.id || '',
    date: rec.date || '',
    lossDegree: rec.lossDegree || '—',
    lossType: rec.lossType || '—',
    airOD: toFreqMap(rec.airOD),
    airOE: toFreqMap(rec.airOE),
    boneOD: toFreqMap(rec.boneOD),
    boneOE: toFreqMap(rec.boneOE),
    srtOD: numOrUndef(rec.srtOD),
    srtOE: numOrUndef(rec.srtOE),
    iprfOD: numOrUndef(rec.iprfOD),
    iprfOE: numOrUndef(rec.iprfOE),
  }
}

/** Valor numérico de um limiar (trata null/'NR' como não-numérico). */
function toNum(v: number | null | 'NR' | undefined): number | null {
  if (v === null || v === undefined || v === 'NR') return null
  const n = typeof v === 'number' ? v : Number(v)
  return isNaN(n) ? null : n
}

function fmtThreshold(v: number | null | 'NR' | undefined): string {
  if (v === null || v === undefined) return '—'
  if (v === 'NR') return 'NR'
  return String(v)
}

type DeltaKind = 'worse' | 'better' | 'stable' | 'na'

function deltaKind(a: number | null, b: number | null): DeltaKind {
  if (a === null || b === null) return 'na'
  const diff = b - a
  if (diff >= 10) return 'worse'
  if (diff <= -10) return 'better'
  return 'stable'
}

function DeltaBadge({ a, b }: { a: number | null; b: number | null }) {
  const kind = deltaKind(a, b)
  if (kind === 'na') {
    return (
      <span className="inline-flex items-center justify-center gap-0.5 text-[11px] text-slate-400 font-medium">
        <Minus className="w-3 h-3" />—
      </span>
    )
  }
  const diff = (b ?? 0) - (a ?? 0)
  if (kind === 'worse') {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-red-50 text-red-700 border border-red-200 text-[11px] font-bold">
        <TrendingUp className="w-3 h-3" />↑ {diff > 0 ? `+${diff}` : diff} dB
      </span>
    )
  }
  if (kind === 'better') {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
        <TrendingDown className="w-3 h-3" />↓ {diff} dB
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-slate-50 text-slate-500 border border-slate-200 text-[11px] font-medium">
      <Minus className="w-3 h-3" />—
    </span>
  )
}

interface CompareAudiometriesModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  audiometries: any[]
}

export const CompareAudiometriesModal: React.FC<CompareAudiometriesModalProps> = ({
  open,
  onOpenChange,
  audiometries,
}) => {
  // Normaliza qualquer formato de exame e ordena por data (mais antigo primeiro)
  const normalized = useMemo(() => audiometries.map(normalizeExam), [audiometries])
  const sorted = useMemo(
    () => [...normalized].sort((a, b) => (a.date || '').localeCompare(b.date || '')),
    [normalized],
  )

  const [idA, setIdA] = useState<string>('')
  const [idB, setIdB] = useState<string>('')

  // Seleção padrão: primeiro e último exame
  useEffect(() => {
    if (sorted.length >= 2) {
      setIdA(sorted[0].id)
      setIdB(sorted[sorted.length - 1].id)
    }
  }, [sorted])

  const examA = sorted.find((e) => e.id === idA)
  const examB = sorted.find((e) => e.id === idB)

  // Contagem de evolução para o resumo textual
  const summary = useMemo(() => {
    if (!examA || !examB) return { worse: 0, better: 0, stable: 0 }
    let worse = 0
    let better = 0
    let stable = 0
    const count = (
      aVal: number | null | 'NR' | undefined,
      bVal: number | null | 'NR' | undefined,
    ) => {
      const kind = deltaKind(toNum(aVal), toNum(bVal))
      if (kind === 'worse') worse++
      else if (kind === 'better') better++
      else if (kind === 'stable') stable++
    }
    AIR_FREQUENCIES.forEach((f) => {
      count(examA.airOD[f], examB.airOD[f])
      count(examA.airOE[f], examB.airOE[f])
    })
    BONE_FREQUENCIES.forEach((f) => {
      count(examA.boneOD[f], examB.boneOD[f])
      count(examA.boneOE[f], examB.boneOE[f])
    })
    return { worse, better, stable }
  }, [examA, examB])

  const handleSelectA = (val: string) => {
    if (val === idB) setIdB(idA)
    setIdA(val)
  }
  const handleSelectB = (val: string) => {
    if (val === idA) setIdA(idB)
    setIdB(val)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[92vh] overflow-y-auto rounded-2xl bg-white p-5 sm:p-6 shadow-2xl border border-slate-200">
        <DialogHeader className="border-b border-slate-100 pb-3">
          <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <ArrowUpDown className="w-5 h-5 text-teal-600" />
            Comparativo de Audiometrias
          </DialogTitle>
          <p className="text-xs text-slate-500">
            Selecione dois exames para visualizar a evolução dos limiares auditivos lado a lado.
          </p>
        </DialogHeader>

        {/* Seleção de exames */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Exame A (mais antigo)
            </label>
            <Select value={idA} onValueChange={handleSelectA}>
              <SelectTrigger className="h-10 rounded-xl mt-1 text-xs">
                <SelectValue placeholder="Selecione o exame A" />
              </SelectTrigger>
              <SelectContent>
                {sorted.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {formatDate(e.date)} • {e.lossDegree}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Exame B (mais recente)
            </label>
            <Select value={idB} onValueChange={handleSelectB}>
              <SelectTrigger className="h-10 rounded-xl mt-1 text-xs">
                <SelectValue placeholder="Selecione o exame B" />
              </SelectTrigger>
              <SelectContent>
                {sorted.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {formatDate(e.date)} • {e.lossDegree}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {!examA || !examB ? (
          <div className="text-center py-10 text-slate-400 text-xs bg-slate-50 rounded-xl">
            Selecione dois exames para visualizar o comparativo.
          </div>
        ) : (
          <div className="space-y-5 pt-1">
            {/* Cabeçalho com datas e laudo */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-teal-600">
                  Exame A
                </p>
                <p className="text-sm font-extrabold text-slate-900">{formatDate(examA.date)}</p>
                <Badge className="mt-1 bg-white text-navy-700 border-teal-200 text-[10px]">
                  {examA.lossDegree} • {examA.lossType}
                </Badge>
              </div>
              <div className="text-center px-2">
                <ArrowUpDown className="w-5 h-5 text-slate-400 mx-auto" />
                <span className="text-[10px] text-slate-400 font-medium block mt-0.5">vs</span>
              </div>
              <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                  Exame B
                </p>
                <p className="text-sm font-extrabold text-slate-900">{formatDate(examB.date)}</p>
                <Badge className="mt-1 bg-white text-indigo-700 border-indigo-200 text-[10px]">
                  {examB.lossDegree} • {examB.lossType}
                </Badge>
              </div>
            </div>

            {/* Resumo de evolução */}
            <div className="flex flex-wrap items-center justify-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-xs font-semibold text-slate-700">Resumo da evolução:</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 text-red-700 border border-red-200 text-[11px] font-bold">
                <TrendingUp className="w-3 h-3" /> Piora em {summary.worse} frequência(s)
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
                <TrendingDown className="w-3 h-3" /> Melhora em {summary.better} frequência(s)
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 border border-slate-200 text-[11px] font-medium">
                <Minus className="w-3 h-3" /> {summary.stable} estável(is)
              </span>
            </div>

            {/* VIA AÉREA */}
            <ComparisonSection
              title="Via Aérea (dB NA)"
              icon={<Activity className="w-4 h-4 text-teal-600" />}
              frequencies={AIR_FREQUENCIES}
              examA={examA}
              examB={examB}
              kind="air"
            />

            {/* VIA ÓSSEA */}
            <ComparisonSection
              title="Via Óssea (dB NA)"
              icon={<Activity className="w-4 h-4 text-emerald-600" />}
              frequencies={BONE_FREQUENCIES}
              examA={examA}
              examB={examB}
              kind="bone"
            />

            {/* LOGOAUDIOMETRIA + LAUDO */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Activity className="w-4 h-4 text-purple-600" />
                Logoaudiometria & Laudo
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-center text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                      <th className="py-2 px-3 text-left">Métrica</th>
                      <th className="py-2 px-3">Exame A</th>
                      <th className="py-2 px-3">Evolução</th>
                      <th className="py-2 px-3">Exame B</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    <LogoRow label="SRT OD (dB)" a={examA.srtOD} b={examB.srtOD} unit="dB" />
                    <LogoRow label="SRT OE (dB)" a={examA.srtOE} b={examB.srtOE} unit="dB" />
                    <LogoRow
                      label="IPRF OD (%)"
                      a={examA.iprfOD}
                      b={examB.iprfOD}
                      unit="%"
                      invert
                    />
                    <LogoRow
                      label="IPRF OE (%)"
                      a={examA.iprfOE}
                      b={examB.iprfOE}
                      unit="%"
                      invert
                    />
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/* ---------- Subcomponente: tabela de via aérea/óssea ---------- */
function ComparisonSection({
  title,
  icon,
  frequencies,
  examA,
  examB,
  kind,
}: {
  title: string
  icon: React.ReactNode
  frequencies: string[]
  examA: NormExam
  examB: NormExam
  kind: 'air' | 'bone'
}) {
  const mapA =
    kind === 'air' ? { OD: examA.airOD, OE: examA.airOE } : { OD: examA.boneOD, OE: examA.boneOE }
  const mapB =
    kind === 'air' ? { OD: examB.airOD, OE: examB.airOE } : { OD: examB.boneOD, OE: examB.boneOE }

  return (
    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
        {icon}
        {title}
      </h4>

      {(['OD', 'OE'] as const).map((ear) => (
        <div key={ear} className="overflow-x-auto">
          <p className="text-[11px] font-bold mb-1.5 text-slate-500">
            Orelha {ear === 'OD' ? 'Direita (OD)' : 'Esquerda (OE)'}
          </p>
          <table className="w-full text-center text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                <th className="py-2 px-2 text-left">Exame \ Freq</th>
                {frequencies.map((f) => (
                  <th key={f} className="py-2 px-2">
                    {f}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {/* Linha Exame A */}
              <tr className="bg-teal-50/40">
                <td className="py-2 px-2 text-left font-bold text-navy-700">
                  A — {formatDate(examA.date)}
                </td>
                {frequencies.map((f) => (
                  <td key={f} className="py-2 px-2 font-semibold text-slate-800">
                    {fmtThreshold(mapA[ear]?.[f])}
                  </td>
                ))}
              </tr>
              {/* Linha Evolução */}
              <tr>
                <td className="py-2 px-2 text-left font-medium text-slate-500">Evolução</td>
                {frequencies.map((f) => (
                  <td key={f} className="py-1.5 px-1">
                    <DeltaBadge a={toNum(mapA[ear]?.[f])} b={toNum(mapB[ear]?.[f])} />
                  </td>
                ))}
              </tr>
              {/* Linha Exame B */}
              <tr className="bg-indigo-50/40">
                <td className="py-2 px-2 text-left font-bold text-indigo-700">
                  B — {formatDate(examB.date)}
                </td>
                {frequencies.map((f) => (
                  <td key={f} className="py-2 px-2 font-semibold text-slate-800">
                    {fmtThreshold(mapB[ear]?.[f])}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

/* ---------- Subcomponente: linha de logoaudiometria ---------- */
function LogoRow({
  label,
  a,
  b,
  unit,
  invert = false,
}: {
  label: string
  a?: number
  b?: number
  unit: string
  invert?: boolean
}) {
  const aN = a === undefined ? null : a
  const bN = b === undefined ? null : b
  // Para IPRF, aumento é melhora (invert). Para SRT, aumento é piora.
  const diff = aN !== null && bN !== null ? bN - aN : null
  let kind: DeltaKind = 'na'
  if (diff !== null) {
    const eff = invert ? -diff : diff
    if (eff >= 10) kind = 'worse'
    else if (eff <= -10) kind = 'better'
    else kind = 'stable'
  }

  const cellA = aN === null ? '—' : `${aN} ${unit}`
  const cellB = bN === null ? '—' : `${bN} ${unit}`

  return (
    <tr>
      <td className="py-2 px-3 text-left font-semibold text-slate-700">{label}</td>
      <td className="py-2 px-3 font-bold text-slate-800">{cellA}</td>
      <td className="py-2 px-3">
        {kind === 'na' ? (
          <span className="inline-flex items-center gap-0.5 text-[11px] text-slate-400 font-medium">
            <Minus className="w-3 h-3" />—
          </span>
        ) : kind === 'worse' ? (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-red-50 text-red-700 border border-red-200 text-[11px] font-bold">
            <TrendingUp className="w-3 h-3" />↑ {diff! > 0 ? `+${diff}` : diff}
          </span>
        ) : kind === 'better' ? (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
            <TrendingDown className="w-3 h-3" />↓ {diff}
          </span>
        ) : (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-slate-50 text-slate-500 border border-slate-200 text-[11px] font-medium">
            <Minus className="w-3 h-3" />—
          </span>
        )}
      </td>
      <td className="py-2 px-3 font-bold text-slate-800">{cellB}</td>
    </tr>
  )
}
