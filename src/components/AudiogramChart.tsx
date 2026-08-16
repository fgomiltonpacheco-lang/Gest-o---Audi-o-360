import React from 'react'
import { AudiogramMap } from '@/types'

/**
 * Componente de Audiograma Tonal em SVG (padrão clínico).
 *
 * Cores:
 *  - OD (Orelha Direita): VERMELHO (#dc2626)
 *  - OE (Orelha Esquerda): AZUL (#2563eb)
 *
 * Símbolos:
 *  - Via Aérea OD: ○ (normal) / △ (mascarado)
 *  - Via Aérea OE: ✕ (normal) / □ (mascarado)
 *  - Via Óssea OD: < (normal) / [ (mascarado)
 *  - Via Óssea OE: > (normal) / ] (mascarado)
 *  - Ausente: símbolo + seta para baixo
 *
 * Linhas: sólidas para via aérea, tracejadas para via óssea.
 * Zona verde clara de 0 a 25 dB (faixa de normalidade).
 */

export const COLOR_OD = '#dc2626' // Vermelho para OD
export const COLOR_OE = '#2563eb' // Azul para OE

/** Frequências exibidas no eixo X (escala logarítmica). */
const CHART_FREQS = [
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

// Dimensões do SVG
const W = 440
const H = 400
const PAD_L = 46
const PAD_R = 18
const PAD_T = 22
const PAD_B = 38

const DB_MIN = -10
const DB_MAX = 120
const DB_STEP = 10
const DB_VALUES: number[] = []
for (let v = DB_MIN; v <= DB_MAX; v += DB_STEP) DB_VALUES.push(v)

const freqLog = (f: string) => Math.log2(Number(f))

const xForFreq = (freq: string): number => {
  const logs = CHART_FREQS.map((f) => freqLog(f))
  const minF = logs[0]
  const maxF = logs[logs.length - 1]
  const span = maxF - minF || 1
  const fl = freqLog(freq)
  const norm = (fl - minF) / span
  return PAD_L + norm * (W - PAD_L - PAD_R)
}

const yForDb = (db: number): number => {
  const innerH = H - PAD_T - PAD_B
  const norm = (db - DB_MIN) / (DB_MAX - DB_MIN)
  return PAD_T + norm * innerH
}

/* ---------- Símbolos ---------- */
const arrowDown = (cx: number, cy: number, color: string) => (
  <g key={`arr-${cx}-${cy}-${color}`}>
    <line x1={cx} y1={cy + 6} x2={cx} y2={cy + 17} stroke={color} strokeWidth={1.8} />
    <polyline
      points={`${cx - 3.5},${cy + 12} ${cx},${cy + 18} ${cx + 3.5},${cy + 12}`}
      fill="none"
      stroke={color}
      strokeWidth={1.8}
    />
  </g>
)

/* Via Aérea OD (Vermelho) — ○ / △ */
const symbolAirOdNormal = (cx: number, cy: number, color: string, noResp: boolean, key: string) => (
  <g key={key}>
    <circle cx={cx} cy={cy} r={5.5} fill="none" stroke={color} strokeWidth={2} />
    {noResp && arrowDown(cx, cy, color)}
  </g>
)
const symbolAirOdMasked = (cx: number, cy: number, color: string, noResp: boolean, key: string) => (
  <g key={key}>
    <polygon
      points={`${cx},${cy - 6} ${cx - 6},${cy + 5} ${cx + 6},${cy + 5}`}
      fill="none"
      stroke={color}
      strokeWidth={2}
    />
    {noResp && arrowDown(cx, cy, color)}
  </g>
)

/* Via Aérea OE (Azul) — ✕ / □ */
const symbolAirOeNormal = (cx: number, cy: number, color: string, noResp: boolean, key: string) => (
  <g key={key}>
    <line x1={cx - 5} y1={cy - 5} x2={cx + 5} y2={cy + 5} stroke={color} strokeWidth={2} />
    <line x1={cx - 5} y1={cy + 5} x2={cx + 5} y2={cy - 5} stroke={color} strokeWidth={2} />
    {noResp && arrowDown(cx, cy, color)}
  </g>
)
const symbolAirOeMasked = (cx: number, cy: number, color: string, noResp: boolean, key: string) => (
  <g key={key}>
    <rect
      x={cx - 5.5}
      y={cy - 5.5}
      width={11}
      height={11}
      fill="none"
      stroke={color}
      strokeWidth={2}
    />
    {noResp && arrowDown(cx, cy, color)}
  </g>
)

/* Via Óssea OD (Vermelho) — < / [ */
const symbolBoneOdNormal = (
  cx: number,
  cy: number,
  color: string,
  noResp: boolean,
  key: string,
) => (
  <g key={key}>
    <path
      d={`M ${cx + 4} ${cy - 6} L ${cx - 4} ${cy} L ${cx + 4} ${cy + 6}`}
      fill="none"
      stroke={color}
      strokeWidth={2}
    />
    {noResp && arrowDown(cx, cy, color)}
  </g>
)
const symbolBoneOdMasked = (
  cx: number,
  cy: number,
  color: string,
  noResp: boolean,
  key: string,
) => (
  <g key={key}>
    <path
      d={`M ${cx + 4} ${cy - 5} L ${cx - 4} ${cy - 5} L ${cx - 4} ${cy + 5} L ${cx + 4} ${cy + 5}`}
      fill="none"
      stroke={color}
      strokeWidth={2}
    />
    {noResp && arrowDown(cx, cy, color)}
  </g>
)

/* Via Óssea OE (Azul) — > / ] */
const symbolBoneOeNormal = (
  cx: number,
  cy: number,
  color: string,
  noResp: boolean,
  key: string,
) => (
  <g key={key}>
    <path
      d={`M ${cx - 4} ${cy - 6} L ${cx + 4} ${cy} L ${cx - 4} ${cy + 6}`}
      fill="none"
      stroke={color}
      strokeWidth={2}
    />
    {noResp && arrowDown(cx, cy, color)}
  </g>
)
const symbolBoneOeMasked = (
  cx: number,
  cy: number,
  color: string,
  noResp: boolean,
  key: string,
) => (
  <g key={key}>
    <path
      d={`M ${cx - 4} ${cy - 5} L ${cx + 4} ${cy - 5} L ${cx + 4} ${cy + 5} L ${cx - 4} ${cy + 5}`}
      fill="none"
      stroke={color}
      strokeWidth={2}
    />
    {noResp && arrowDown(cx, cy, color)}
  </g>
)

/* Símbolo LDL: U (limiar de desconforto) */
const symbolLdl = (cx: number, cy: number, color: string, key: string) => (
  <g key={key}>
    <path
      d={`M ${cx - 4} ${cy - 4} L ${cx - 4} ${cy + 3} L ${cx + 4} ${cy + 3} L ${cx + 4} ${cy - 4}`}
      fill="none"
      stroke={color}
      strokeWidth={2}
    />
  </g>
)

interface SingleEarChartProps {
  side: 'OD' | 'OE'
  air: AudiogramMap
  bone: AudiogramMap
  ldl?: AudiogramMap
  title?: string
  width?: number | string
}

export const SingleEarAudiogramChart: React.FC<SingleEarChartProps> = ({
  side,
  air,
  bone,
  ldl,
  title,
  width = '100%',
}) => {
  const color = side === 'OD' ? COLOR_OD : COLOR_OE

  const buildPoints = (map: AudiogramMap, freqs: readonly string[]) =>
    freqs
      .map((f) => ({ freq: f, point: map[f] }))
      .filter((p) => p.point && p.point.db !== null && p.point.db !== undefined)

  const airPts = buildPoints(air, CHART_FREQS)
  const boneFreqs = CHART_FREQS.filter((f) => ['500', '1000', '2000', '3000', '4000'].includes(f))
  const bonePts = buildPoints(bone, boneFreqs)
  const ldlPts = ldl ? buildPoints(ldl, CHART_FREQS) : []

  const isNoResp = (sym: string) => sym === 'no_response' || sym === 'masked_no_response'
  const isMasked = (sym: string) => sym === 'masked' || sym === 'masked_no_response'

  // Linha contínua (aérea) / tracejada (óssea) conectando pontos não-ausentes
  const buildPath = (pts: typeof airPts): string => {
    const valid = pts.filter((p) => !isNoResp(p.point.symbol))
    if (valid.length < 2) return ''
    return valid
      .map((p, i) => {
        const x = xForFreq(p.freq)
        const y = yForDb(p.point.db as number)
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
      })
      .join(' ')
  }

  const airPath = buildPath(airPts)
  const bonePath = buildPath(bonePts)

  return (
    <div className="w-full flex flex-col items-center">
      {title && (
        <div
          className={`text-xs font-extrabold uppercase tracking-wider mb-1.5 ${
            side === 'OD' ? 'text-red-600' : 'text-blue-600'
          }`}
        >
          {title}
        </div>
      )}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={width}
        style={{ maxWidth: '100%', height: 'auto', display: 'block' }}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label={`Audiograma Orelha ${side === 'OD' ? 'Direita' : 'Esquerda'}`}
      >
        <rect x={0} y={0} width={W} height={H} fill="#ffffff" />

        {/* Faixa de normalidade (0 a 25 dB) */}
        <rect
          x={PAD_L}
          y={yForDb(0)}
          width={W - PAD_L - PAD_R}
          height={yForDb(25) - yForDb(0)}
          fill="#dcfce7"
          opacity={0.7}
        />

        {/* Grade horizontal (dB) */}
        {DB_VALUES.map((db) => {
          const y = yForDb(db)
          const isMajor = db % 20 === 0
          return (
            <g key={`h-${side}-${db}`}>
              <line
                x1={PAD_L}
                y1={y}
                x2={W - PAD_R}
                y2={y}
                stroke={isMajor ? '#cbd5e1' : '#f1f5f9'}
                strokeWidth={isMajor ? 1 : 0.6}
              />
              <text x={PAD_L - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#64748b">
                {db}
              </text>
            </g>
          )
        })}

        {/* Grade vertical (Hz) + labels eixo X */}
        {CHART_FREQS.map((f) => {
          const x = xForFreq(f)
          return (
            <g key={`v-${side}-${f}`}>
              <line x1={x} y1={PAD_T} x2={x} y2={H - PAD_B} stroke="#e2e8f0" strokeWidth={0.6} />
              <text x={x} y={H - PAD_B + 14} textAnchor="middle" fontSize="9" fill="#64748b">
                {Number(f) >= 1000 ? `${Number(f) / 1000}k` : f}
              </text>
            </g>
          )
        })}

        {/* Borda do gráfico */}
        <rect
          x={PAD_L}
          y={PAD_T}
          width={W - PAD_L - PAD_R}
          height={H - PAD_T - PAD_B}
          fill="none"
          stroke="#64748b"
          strokeWidth={1.2}
        />

        {/* Linha Aérea (sólida) */}
        {airPath && <path d={airPath} fill="none" stroke={color} strokeWidth={1.8} />}

        {/* Linha Óssea (tracejada) */}
        {bonePath && (
          <path d={bonePath} fill="none" stroke={color} strokeWidth={1.8} strokeDasharray="4 3" />
        )}

        {/* Símbolos Aéreos */}
        {airPts.map((p, i) => {
          const cx = xForFreq(p.freq)
          const cy = yForDb(p.point.db as number)
          const nr = isNoResp(p.point.symbol)
          const mk = isMasked(p.point.symbol)
          const key = `air-${side}-${i}`
          if (side === 'OD') {
            return mk
              ? symbolAirOdMasked(cx, cy, color, nr, key)
              : symbolAirOdNormal(cx, cy, color, nr, key)
          }
          return mk
            ? symbolAirOeMasked(cx, cy, color, nr, key)
            : symbolAirOeNormal(cx, cy, color, nr, key)
        })}

        {/* Símbolos Ósseos */}
        {bonePts.map((p, i) => {
          const cx = xForFreq(p.freq)
          const cy = yForDb(p.point.db as number)
          const nr = isNoResp(p.point.symbol)
          const mk = isMasked(p.point.symbol)
          const key = `bone-${side}-${i}`
          if (side === 'OD') {
            return mk
              ? symbolBoneOdMasked(cx, cy, color, nr, key)
              : symbolBoneOdNormal(cx, cy, color, nr, key)
          }
          return mk
            ? symbolBoneOeMasked(cx, cy, color, nr, key)
            : symbolBoneOeNormal(cx, cy, color, nr, key)
        })}

        {/* Símbolos LDL */}
        {ldlPts.map((p, i) => {
          const cx = xForFreq(p.freq)
          const cy = yForDb(p.point.db as number)
          return symbolLdl(cx, cy, color, `ldl-${side}-${i}`)
        })}

        {/* Legenda interna */}
        <g transform={`translate(${PAD_L + 6}, ${PAD_T + 4})`}>
          <rect x={0} y={0} width={120} height={40} fill="#ffffff" opacity={0.88} rx={3} />
          {side === 'OD' ? (
            <>
              <circle cx={10} cy={11} r={4} fill="none" stroke={COLOR_OD} strokeWidth={1.5} />
              <text x={20} y={14} fontSize="8" fill="#1e293b" fontWeight="600">
                Aérea (○)
              </text>
              <path d="M 12 21 L 8 25 L 12 29" fill="none" stroke={COLOR_OD} strokeWidth={1.5} />
              <text x={20} y={28} fontSize="8" fill="#1e293b" fontWeight="600">
                Óssea (&lt;)
              </text>
            </>
          ) : (
            <>
              <line x1={6} y1={7} x2={14} y2={15} stroke={COLOR_OE} strokeWidth={1.5} />
              <line x1={6} y1={15} x2={14} y2={7} stroke={COLOR_OE} strokeWidth={1.5} />
              <text x={20} y={14} fontSize="8" fill="#1e293b" fontWeight="600">
                Aérea (✕)
              </text>
              <path d="M 8 21 L 12 25 L 8 29" fill="none" stroke={COLOR_OE} strokeWidth={1.5} />
              <text x={20} y={28} fontSize="8" fill="#1e293b" fontWeight="600">
                Óssea (&gt;)
              </text>
            </>
          )}
        </g>
      </svg>
    </div>
  )
}

interface DualAudiogramChartProps {
  airOD: AudiogramMap
  airOE: AudiogramMap
  boneOD: AudiogramMap
  boneOE: AudiogramMap
  ldlOD?: AudiogramMap
  ldlOE?: AudiogramMap
  width?: number | string
}

export const AudiogramChart: React.FC<DualAudiogramChartProps> = ({
  airOD,
  airOE,
  boneOD,
  boneOE,
  ldlOD,
  ldlOE,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
      <div className="border border-red-100 bg-red-50/20 p-2 rounded-xl">
        <SingleEarAudiogramChart
          side="OD"
          title="Orelha Direita (OD) — Vermelho"
          air={airOD}
          bone={boneOD}
          ldl={ldlOD}
        />
      </div>
      <div className="border border-blue-100 bg-blue-50/20 p-2 rounded-xl">
        <SingleEarAudiogramChart
          side="OE"
          title="Orelha Esquerda (OE) — Azul"
          air={airOE}
          bone={boneOE}
          ldl={ldlOE}
        />
      </div>
    </div>
  )
}

export default AudiogramChart
