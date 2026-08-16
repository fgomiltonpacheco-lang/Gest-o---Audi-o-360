import React from 'react'
import { AudiogramMap, AIR_FREQS, BONE_FREQS } from '@/types'

/**
 * Componente de Audiograma Tonal em SVG.
 * Padrão clínico nacional/internacional:
 *  - Orelha Direita (OD): Vermelho (#dc2626) -> Símbolo Aéreo: ○ (normal) / Δ (mascarado)
 *  - Orelha Esquerda (OE): Azul (#2563eb) -> Símbolo Aéreo: × (normal) / □ (mascarado)
 *  - Via Óssea OD: < (normal) / [ (mascarado)
 *  - Via Óssea OE: > (normal) / ] (mascarado)
 *  - Ausência de resposta: Seta para baixo no símbolo
 *  - LDL (Limiar de Desconforto): Símbolo L (ou L invertido) ou *
 */

export const COLOR_OD = '#dc2626' // Vermelho para OD
export const COLOR_OE = '#2563eb' // Azul para OE

// Dimensões padrão do SVG para um gráfico de orelha única ou combinada
const W = 420
const H = 380
const PAD_L = 44
const PAD_R = 16
const PAD_T = 24
const PAD_B = 36

const DB_MIN = -10
const DB_MAX = 120
const DB_STEP = 10
const DB_VALUES: number[] = []
for (let v = DB_MIN; v <= DB_MAX; v += DB_STEP) DB_VALUES.push(v)

const ALL_FREQS: string[] = [...AIR_FREQS]

const xForIndex = (idx: number): number => {
  const freqs = ALL_FREQS.map((f) => Math.log2(Number(f)))
  const minF = freqs[0]
  const maxF = freqs[freqs.length - 1]
  const span = maxF - minF || 1
  const norm = (freqs[idx] - minF) / span
  return PAD_L + norm * (W - PAD_L - PAD_R)
}

const xForFreq = (freq: string): number => {
  const idx = ALL_FREQS.indexOf(freq)
  if (idx < 0) return PAD_L
  return xForIndex(idx)
}

const yForDb = (db: number): number => {
  const innerH = H - PAD_T - PAD_B
  const norm = (db - DB_MIN) / (DB_MAX - DB_MIN)
  return PAD_T + norm * innerH
}

/* Símbolos */
const arrowDown = (cx: number, cy: number, color: string) => (
  <path
    d={`M ${cx} ${cy + 6} L ${cx} ${cy + 18} M ${cx - 3} ${cy + 13} L ${cx} ${cy + 19} L ${cx + 3} ${cy + 13}`}
    stroke={color}
    strokeWidth={2}
    fill="none"
  />
)

/* Símbolos Via Aérea OD (Vermelho) */
const symbolAirOdNormal = (cx: number, cy: number, color: string, noResponse: boolean) => (
  <g key={`sym-air-od-norm-${cx}-${cy}`}>
    <circle cx={cx} cy={cy} r={5.5} fill="none" stroke={color} strokeWidth={2} />
    {noResponse && arrowDown(cx, cy, color)}
  </g>
)

const symbolAirOdMasked = (cx: number, cy: number, color: string, noResponse: boolean) => (
  // Triângulo Δ para OD mascarada
  <g key={`sym-air-od-mask-${cx}-${cy}`}>
    <polygon
      points={`${cx},${cy - 6} ${cx - 5.5},${cy + 4.5} ${cx + 5.5},${cy + 4.5}`}
      fill="none"
      stroke={color}
      strokeWidth={2}
    />
    {noResponse && arrowDown(cx, cy, color)}
  </g>
)

/* Símbolos Via Aérea OE (Azul) */
const symbolAirOeNormal = (cx: number, cy: number, color: string, noResponse: boolean) => (
  // X para OE normal
  <g key={`sym-air-oe-norm-${cx}-${cy}`}>
    <line x1={cx - 5} y1={cy - 5} x2={cx + 5} y2={cy + 5} stroke={color} strokeWidth={2} />
    <line x1={cx - 5} y1={cy + 5} x2={cx + 5} y2={cy - 5} stroke={color} strokeWidth={2} />
    {noResponse && arrowDown(cx, cy, color)}
  </g>
)

const symbolAirOeMasked = (cx: number, cy: number, color: string, noResponse: boolean) => (
  // Quadrado □ para OE mascarada
  <g key={`sym-air-oe-mask-${cx}-${cy}`}>
    <rect x={cx - 5} y={cy - 5} width={10} height={10} fill="none" stroke={color} strokeWidth={2} />
    {noResponse && arrowDown(cx, cy, color)}
  </g>
)

/* Símbolos Via Óssea OD (Vermelho): < e [ */
const symbolBoneOdNormal = (cx: number, cy: number, color: string, noResponse: boolean) => (
  <g key={`sym-bone-od-norm-${cx}-${cy}`}>
    <path
      d={`M ${cx + 4} ${cy - 5} L ${cx - 3} ${cy} L ${cx + 4} ${cy + 5}`}
      fill="none"
      stroke={color}
      strokeWidth={2}
    />
    {noResponse && arrowDown(cx, cy, color)}
  </g>
)

const symbolBoneOdMasked = (cx: number, cy: number, color: string, noResponse: boolean) => (
  <g key={`sym-bone-od-mask-${cx}-${cy}`}>
    <path
      d={`M ${cx + 4} ${cy - 5} L ${cx - 3} ${cy - 5} L ${cx - 3} ${cy + 5} L ${cx + 4} ${cy + 5}`}
      fill="none"
      stroke={color}
      strokeWidth={2}
    />
    {noResponse && arrowDown(cx, cy, color)}
  </g>
)

/* Símbolos Via Óssea OE (Azul): > e ] */
const symbolBoneOeNormal = (cx: number, cy: number, color: string, noResponse: boolean) => (
  <g key={`sym-bone-oe-norm-${cx}-${cy}`}>
    <path
      d={`M ${cx - 4} ${cy - 5} L ${cx + 3} ${cy} L ${cx - 4} ${cy + 5}`}
      fill="none"
      stroke={color}
      strokeWidth={2}
    />
    {noResponse && arrowDown(cx, cy, color)}
  </g>
)

const symbolBoneOeMasked = (cx: number, cy: number, color: string, noResponse: boolean) => (
  <g key={`sym-bone-oe-mask-${cx}-${cy}`}>
    <path
      d={`M ${cx - 4} ${cy - 5} L ${cx + 3} ${cy - 5} L ${cx + 3} ${cy + 5} L ${cx - 4} ${cy + 5}`}
      fill="none"
      stroke={color}
      strokeWidth={2}
    />
    {noResponse && arrowDown(cx, cy, color)}
  </g>
)

/* Símbolo LDL: U ou meio quadrado invertido ⌴ */
const symbolLdl = (cx: number, cy: number, color: string) => (
  <g key={`sym-ldl-${cx}-${cy}`}>
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

  const airPts = buildPoints(air, AIR_FREQS)
  const bonePts = buildPoints(bone, BONE_FREQS)
  const ldlPts = ldl ? buildPoints(ldl, AIR_FREQS) : []

  // Conectar linha
  const buildPath = (
    pts: { freq: string; point: { db: number | null; symbol: string } }[],
  ): string => {
    const valid = pts.filter(
      (p) =>
        p.point.db !== null &&
        p.point.symbol !== 'no_response' &&
        p.point.symbol !== 'masked_no_response',
    )
    if (valid.length < 2) return ''
    return valid
      .map((p, i) => {
        const x = xForFreq(p.freq)
        const y = yForDb(p.point.db as number)
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
      })
      .join(' ')
  }

  const airPath = buildPath(airPts as any)
  const bonePath = buildPath(bonePts as any)

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

        {/* Faixa Normal (0-25 dB) */}
        <rect
          x={PAD_L}
          y={yForDb(0)}
          width={W - PAD_L - PAD_R}
          height={yForDb(25) - yForDb(0)}
          fill="#f0fdf4"
          opacity={0.8}
        />

        {/* Grade dB */}
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
              <text x={PAD_L - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#64748b font-mono">
                {db}
              </text>
            </g>
          )
        })}

        {/* Grade Hz */}
        {ALL_FREQS.map((f, i) => {
          const x = xForIndex(i)
          return (
            <g key={`v-${side}-${f}`}>
              <line x1={x} y1={PAD_T} x2={x} y2={H - PAD_B} stroke="#e2e8f0" strokeWidth={0.6} />
              <text x={x} y={H - PAD_B + 12} textAnchor="middle" fontSize="9" fill="#64748b">
                {Number(f) >= 1000 ? `${Number(f) / 1000}k` : f}
              </text>
            </g>
          )
        })}

        {/* Borda */}
        <rect
          x={PAD_L}
          y={PAD_T}
          width={W - PAD_L - PAD_R}
          height={H - PAD_T - PAD_B}
          fill="none"
          stroke="#64748b"
          strokeWidth={1.2}
        />

        {/* Linha Aérea (Contínua) */}
        {airPath && <path d={airPath} fill="none" stroke={color} strokeWidth={1.8} />}

        {/* Linha Óssea (Tracejada) */}
        {bonePath && (
          <path d={bonePath} fill="none" stroke={color} strokeWidth={1.8} strokeDasharray="4 3" />
        )}

        {/* Símbolos Aéreos */}
        {airPts.map((p) => {
          const cx = xForFreq(p.freq)
          const noResp = p.point.symbol === 'no_response' || p.point.symbol === 'masked_no_response'
          const cy = noResp ? yForDb(120) : yForDb(p.point.db as number)
          if (side === 'OD') {
            return p.point.symbol === 'masked' || p.point.symbol === 'masked_no_response'
              ? symbolAirOdMasked(cx, cy, color, noResp)
              : symbolAirOdNormal(cx, cy, color, noResp)
          } else {
            return p.point.symbol === 'masked' || p.point.symbol === 'masked_no_response'
              ? symbolAirOeMasked(cx, cy, color, noResp)
              : symbolAirOeNormal(cx, cy, color, noResp)
          }
        })}

        {/* Símbolos Ósseos */}
        {bonePts.map((p) => {
          const cx = xForFreq(p.freq)
          const noResp = p.point.symbol === 'no_response' || p.point.symbol === 'masked_no_response'
          const cy = noResp ? yForDb(120) : yForDb(p.point.db as number)
          if (side === 'OD') {
            return p.point.symbol === 'masked' || p.point.symbol === 'masked_no_response'
              ? symbolBoneOdMasked(cx, cy, color, noResp)
              : symbolBoneOdNormal(cx, cy, color, noResp)
          } else {
            return p.point.symbol === 'masked' || p.point.symbol === 'masked_no_response'
              ? symbolBoneOeMasked(cx, cy, color, noResp)
              : symbolBoneOeNormal(cx, cy, color, noResp)
          }
        })}

        {/* Símbolos LDL */}
        {ldlPts.map((p) => {
          const cx = xForFreq(p.freq)
          const cy = yForDb(p.point.db as number)
          return symbolLdl(cx, cy, color)
        })}

        {/* Legenda interna simplificada */}
        <g transform={`translate(${PAD_L + 6}, ${PAD_T + 4})`}>
          <rect
            x={0}
            y={0}
            width={120}
            height={side === 'OD' ? 38 : 38}
            fill="#ffffff"
            opacity={0.88}
            rx={3}
          />
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
                Aérea (×)
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
