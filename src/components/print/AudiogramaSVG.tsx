import React from 'react'
import { AudiogramMap, AudiogramSymbol } from '@/types'

/**
 * AudiogramaSVG — audiograma gráfico único (ambas as orelhas sobrepostas)
 * para o PDF de impressão, seguindo o padrão clínico internacional (ASHA).
 *
 * Eixo Y: intensidade em dB (-10 a 120, escala linear, incrementos de 10).
 * Eixo X: frequências em Hz (escala logarítmica).
 *
 * Símbolos:
 *  - Via Aérea OD: ○ vermelho (linha contínua vermelha)
 *  - Via Aérea OE: ✕ azul (linha tracejada azul)
 *  - Via Óssea OD: < vermelho (sem linha)
 *  - Via Óssea OE: > azul (sem linha)
 *  - Ausente: símbolo + seta ↓
 *  - Mascarado: △ (OD) / □ (OE) aérea; [ / ] óssea
 *
 * Linhas conectam apenas pontos PRESENTES, quebrando em pontos ausentes.
 * Via Óssea não tem linhas de ligação (símbolos isolados).
 */

const COLOR_OD = '#dc2626' // Vermelho
const COLOR_OE = '#2563eb' // Azul

/** Frequências do eixo X (escala logarítmica). Inclui 125 mesmo sem dado. */
const FREQS = [
  '125',
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

/** Frequências principais (linhas verticais mais escuras). */
const MAJOR_FREQS = new Set(['250', '500', '1000', '2000', '4000', '8000'])

/** Frequências com dado de via óssea. */
const BONE_FREQS = ['500', '1000', '2000', '3000', '4000']

const DB_MIN = -10
const DB_MAX = 120
const DB_STEP = 10
const DB_VALUES: number[] = []
for (let v = DB_MIN; v <= DB_MAX; v += DB_STEP) DB_VALUES.push(v)

const freqLog = (f: string) => Math.log2(Number(f))

// Dimensões em unidades SVG (viewBox). ~18cm x 14cm quando renderizado.
const W = 720
const H = 560
const PAD_L = 46
const PAD_R = 26
const PAD_T = 22
const PAD_B = 44

const xForFreq = (freq: string): number => {
  const logs = FREQS.map((f) => freqLog(f))
  const minF = logs[0]
  const maxF = logs[logs.length - 1]
  const span = maxF - minF || 1
  const norm = (freqLog(freq) - minF) / span
  return PAD_L + norm * (W - PAD_L - PAD_R)
}

const yForDb = (db: number): number => {
  const innerH = H - PAD_T - PAD_B
  const norm = (db - DB_MIN) / (DB_MAX - DB_MIN)
  return PAD_T + norm * innerH
}

const isNoResp = (sym: AudiogramSymbol | undefined) =>
  sym === 'no_response' || sym === 'masked_no_response'
const isMasked = (sym: AudiogramSymbol | undefined) =>
  sym === 'masked' || sym === 'masked_no_response'

/* ---------- Símbolos SVG ---------- */
const arrowDown = (cx: number, cy: number, color: string) => (
  <g key={`arr-${cx}-${cy}-${color}`}>
    <line x1={cx} y1={cy + 7} x2={cx} y2={cy + 19} stroke={color} strokeWidth={1.8} />
    <polyline
      points={`${cx - 4},${cy + 13} ${cx},${cy + 20} ${cx + 4},${cy + 13}`}
      fill="none"
      stroke={color}
      strokeWidth={1.8}
    />
  </g>
)

/* Via Aérea OD — ○ / △ */
const symAirOd = (
  cx: number,
  cy: number,
  color: string,
  masked: boolean,
  noResp: boolean,
  key: string,
) => (
  <g key={key}>
    {masked ? (
      <polygon
        points={`${cx},${cy - 7} ${cx - 7},${cy + 6} ${cx + 7},${cy + 6}`}
        fill="none"
        stroke={color}
        strokeWidth={2.2}
      />
    ) : (
      <circle cx={cx} cy={cy} r={6.5} fill="none" stroke={color} strokeWidth={2.2} />
    )}
    {noResp && arrowDown(cx, cy, color)}
  </g>
)

/* Via Aérea OE — ✕ / □ */
const symAirOe = (
  cx: number,
  cy: number,
  color: string,
  masked: boolean,
  noResp: boolean,
  key: string,
) => (
  <g key={key}>
    {masked ? (
      <rect
        x={cx - 6.5}
        y={cy - 6.5}
        width={13}
        height={13}
        fill="none"
        stroke={color}
        strokeWidth={2.2}
      />
    ) : (
      <>
        <line x1={cx - 6} y1={cy - 6} x2={cx + 6} y2={cy + 6} stroke={color} strokeWidth={2.2} />
        <line x1={cx - 6} y1={cy + 6} x2={cx + 6} y2={cy - 6} stroke={color} strokeWidth={2.2} />
      </>
    )}
    {noResp && arrowDown(cx, cy, color)}
  </g>
)

/* Via Óssea OD — < / [ */
const symBoneOd = (
  cx: number,
  cy: number,
  color: string,
  masked: boolean,
  noResp: boolean,
  key: string,
) => (
  <g key={key}>
    {masked ? (
      <path
        d={`M ${cx + 5} ${cy - 6} L ${cx - 5} ${cy - 6} L ${cx - 5} ${cy + 6} L ${cx + 5} ${cy + 6}`}
        fill="none"
        stroke={color}
        strokeWidth={2.2}
      />
    ) : (
      <path
        d={`M ${cx + 5} ${cy - 7} L ${cx - 5} ${cy} L ${cx + 5} ${cy + 7}`}
        fill="none"
        stroke={color}
        strokeWidth={2.2}
      />
    )}
    {noResp && arrowDown(cx, cy, color)}
  </g>
)

/* Via Óssea OE — > / ] */
const symBoneOe = (
  cx: number,
  cy: number,
  color: string,
  masked: boolean,
  noResp: boolean,
  key: string,
) => (
  <g key={key}>
    {masked ? (
      <path
        d={`M ${cx - 5} ${cy - 6} L ${cx + 5} ${cy - 6} L ${cx + 5} ${cy + 6} L ${cx - 5} ${cy + 6}`}
        fill="none"
        stroke={color}
        strokeWidth={2.2}
      />
    ) : (
      <path
        d={`M ${cx - 5} ${cy - 7} L ${cx + 5} ${cy} L ${cx - 5} ${cy + 7}`}
        fill="none"
        stroke={color}
        strokeWidth={2.2}
      />
    )}
    {noResp && arrowDown(cx, cy, color)}
  </g>
)

const buildPoints = (map: AudiogramMap, freqs: readonly string[]) =>
  freqs
    .map((f) => ({ freq: f, point: map[f] }))
    .filter((p) => p.point && p.point.db !== null && p.point.db !== undefined)

/**
 * Gera múltiplos paths SVG — um por segmento contíguo de pontos presentes.
 * Quebra em pontos ausentes (no_response / masked_no_response): não conecta
 * presente→presente pulando um ausente no meio.
 */
const buildPaths = (
  pts: { freq: string; point: { db: number | null; symbol: AudiogramSymbol } }[],
): string[] => {
  const segments: string[] = []
  let current: string[] = []
  for (const p of pts) {
    if (isNoResp(p.point.symbol)) {
      if (current.length >= 2) segments.push(current.join(' '))
      current = []
      continue
    }
    const x = xForFreq(p.freq)
    const y = yForDb(p.point.db as number)
    current.push(`${current.length === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`)
  }
  if (current.length >= 2) segments.push(current.join(' '))
  return segments
}

interface AudiogramaSVGProps {
  airOD: AudiogramMap
  airOE: AudiogramMap
  boneOD: AudiogramMap
  boneOE: AudiogramMap
}

export const AudiogramaSVG: React.FC<AudiogramaSVGProps> = ({ airOD, airOE, boneOD, boneOE }) => {
  const airOdPts = buildPoints(airOD, FREQS)
  const airOePts = buildPoints(airOE, FREQS)
  const boneOdPts = buildPoints(boneOD, BONE_FREQS)
  const boneOePts = buildPoints(boneOE, BONE_FREQS)

  const airOdPaths = buildPaths(airOdPts)
  const airOePaths = buildPaths(airOePts)

  const fmtFreq = (f: string) => {
    const n = Number(f)
    return n >= 1000 ? `${n / 1000}k` : f
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="18cm"
      height="14cm"
      style={{ maxWidth: '100%', height: 'auto', display: 'block', margin: '0 auto' }}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Audiograma tonal — orelhas direita e esquerda sobrepostas"
    >
      <rect x={0} y={0} width={W} height={H} fill="#ffffff" />

      {/* Faixa de normalidade (0 a 25 dB) */}
      <rect
        x={PAD_L}
        y={yForDb(0)}
        width={W - PAD_L - PAD_R}
        height={yForDb(25) - yForDb(0)}
        fill="#dcfce7"
        opacity={0.6}
      />

      {/* Grade horizontal (dB) — linhas mais escuras a cada 20 dB */}
      {DB_VALUES.map((db) => {
        const y = yForDb(db)
        const isMajor = db % 20 === 0
        return (
          <g key={`h-${db}`}>
            <line
              x1={PAD_L}
              y1={y}
              x2={W - PAD_R}
              y2={y}
              stroke={isMajor ? '#94a3b8' : '#e2e8f0'}
              strokeWidth={isMajor ? 1 : 0.6}
            />
            <text x={PAD_L - 6} y={y + 4} textAnchor="end" fontSize="11" fill="#475569">
              {db}
            </text>
          </g>
        )
      })}

      {/* Label eixo Y */}
      <text
        x={14}
        y={H / 2}
        textAnchor="middle"
        fontSize="12"
        fill="#334155"
        fontWeight={700}
        transform={`rotate(-90 14 ${H / 2})`}
      >
        Intensidade (dB NA)
      </text>

      {/* Grade vertical (Hz) — linhas mais escuras nas frequências principais */}
      {FREQS.map((f) => {
        const x = xForFreq(f)
        const isMajor = MAJOR_FREQS.has(f)
        return (
          <g key={`v-${f}`}>
            <line
              x1={x}
              y1={PAD_T}
              x2={x}
              y2={H - PAD_B}
              stroke={isMajor ? '#94a3b8' : '#e2e8f0'}
              strokeWidth={isMajor ? 1 : 0.6}
            />
            <text
              x={x}
              y={H - PAD_B + 16}
              textAnchor="middle"
              fontSize="11"
              fill="#475569"
              fontWeight={isMajor ? 700 : 400}
            >
              {fmtFreq(f)}
            </text>
          </g>
        )
      })}

      {/* Label eixo X */}
      <text
        x={(PAD_L + W - PAD_R) / 2}
        y={H - 6}
        textAnchor="middle"
        fontSize="12"
        fill="#334155"
        fontWeight={700}
      >
        Frequência (Hz)
      </text>

      {/* Borda */}
      <rect
        x={PAD_L}
        y={PAD_T}
        width={W - PAD_L - PAD_R}
        height={H - PAD_T - PAD_B}
        fill="none"
        stroke="#475569"
        strokeWidth={1.4}
      />

      {/* Linha Via Aérea OD — contínua vermelha (segmentos quebram nos ausentes) */}
      {airOdPaths.map((d, i) => (
        <path key={`air-od-line-${i}`} d={d} fill="none" stroke={COLOR_OD} strokeWidth={2} />
      ))}

      {/* Linha Via Aérea OE — tracejada azul (segmentos quebram nos ausentes) */}
      {airOePaths.map((d, i) => (
        <path
          key={`air-oe-line-${i}`}
          d={d}
          fill="none"
          stroke={COLOR_OE}
          strokeWidth={2}
          strokeDasharray="6 4"
        />
      ))}

      {/* Símbolos Via Aérea OD */}
      {airOdPts.map((p, i) => {
        const cx = xForFreq(p.freq)
        const cy = yForDb(p.point.db as number)
        return symAirOd(
          cx,
          cy,
          COLOR_OD,
          isMasked(p.point.symbol),
          isNoResp(p.point.symbol),
          `air-od-${i}`,
        )
      })}

      {/* Símbolos Via Aérea OE */}
      {airOePts.map((p, i) => {
        const cx = xForFreq(p.freq)
        const cy = yForDb(p.point.db as number)
        return symAirOe(
          cx,
          cy,
          COLOR_OE,
          isMasked(p.point.symbol),
          isNoResp(p.point.symbol),
          `air-oe-${i}`,
        )
      })}

      {/* Símbolos Via Óssea OD (sem linha de ligação) */}
      {boneOdPts.map((p, i) => {
        const cx = xForFreq(p.freq)
        const cy = yForDb(p.point.db as number)
        return symBoneOd(
          cx,
          cy,
          COLOR_OD,
          isMasked(p.point.symbol),
          isNoResp(p.point.symbol),
          `bone-od-${i}`,
        )
      })}

      {/* Símbolos Via Óssea OE (sem linha de ligação) */}
      {boneOePts.map((p, i) => {
        const cx = xForFreq(p.freq)
        const cy = yForDb(p.point.db as number)
        return symBoneOe(
          cx,
          cy,
          COLOR_OE,
          isMasked(p.point.symbol),
          isNoResp(p.point.symbol),
          `bone-oe-${i}`,
        )
      })}
    </svg>
  )
}

export default AudiogramaSVG
