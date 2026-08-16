import React from 'react'
import { AudiogramMap, AIR_FREQS, BONE_FREQS } from '@/types'

/**
 * Componente de Audiograma Tonal em SVG, renderizado como nós React (não canvas).
 * Segue a convenção audiológica: azul = OD (orelha direita), vermelho = OE (esquerda).
 *
 * Os símbolos são:
 *  - Via Aérea:
 *      OD (azul): O / O↓ / ▢ / ▢↓
 *      OE (vermelho): X / X↓ / □ / □↓
 *  - Via Óssea:
 *      OD (azul): < / <↓ / [ / [↓
 *      OE (vermelho): > / >↓ / ] / ]↓
 */

const COLOR_OD = '#2563eb' // azul
const COLOR_OE = '#dc2626' // vermelho

// Dimensões do SVG
const W = 760
const H = 460
const PAD_L = 52
const PAD_R = 24
const PAD_T = 24
const PAD_B = 44

const DB_MIN = -10
const DB_MAX = 120
const DB_STEP = 10
const DB_VALUES: number[] = []
for (let v = DB_MIN; v <= DB_MAX; v += DB_STEP) DB_VALUES.push(v)

// X: log-ish spacing. Mapeamos índices de frequência para posições.
const ALL_FREQS: string[] = [...AIR_FREQS] // 10 frequências
const xForFreq = (freq: string): number => {
  const idx = ALL_FREQS.indexOf(freq)
  if (idx < 0) {
    // fallback: se for frequência óssea que existe em ALL_FREQS, usa o mesmo índice
    const boneIdx = (BONE_FREQS as readonly string[]).indexOf(freq)
    if (boneIdx >= 0) {
      const inAll = ALL_FREQS.indexOf((BONE_FREQS as readonly string[])[boneIdx])
      if (inAll >= 0) return xForIndex(inAll)
    }
    return PAD_L
  }
  return xForIndex(idx)
}

const xForIndex = (idx: number): number => {
  const n = ALL_FREQS.length
  const innerW = W - PAD_L - PAD_R
  // espaçamento log-ish: usamos posições baseadas em log2 da frequência para parecer natural
  const freqs = ALL_FREQS.map((f) => Math.log2(Number(f)))
  const minF = freqs[0]
  const maxF = freqs[freqs.length - 1]
  const span = maxF - minF || 1
  const norm = (freqs[idx] - minF) / span
  void n
  void innerW
  return PAD_L + norm * (W - PAD_L - PAD_R)
}

const yForDb = (db: number): number => {
  const innerH = H - PAD_T - PAD_B
  const norm = (db - DB_MIN) / (DB_MAX - DB_MIN)
  return PAD_T + norm * innerH
}

interface SymbolRender {
  // desenha o símbolo centrado em (cx, cy)
  shape: (cx: number, cy: number, color: string, noResponse: boolean) => React.ReactNode
}

const airOdsymbol: SymbolRender = {
  shape: (cx, cy, color, noResponse) => (
    <>
      <circle cx={cx} cy={cy} r={6} fill="none" stroke={color} strokeWidth={2} />
      {noResponse && (
        <line
          x1={cx}
          y1={cy + 6}
          x2={cx}
          y2={cy + 18}
          stroke={color}
          strokeWidth={2}
          markerEnd="url(#arrow-down)"
        />
      )}
    </>
  ),
}

const airOeSymbol: SymbolRender = {
  shape: (cx, cy, color, noResponse) => (
    <>
      {/* X */}
      <line x1={cx - 5} y1={cy - 5} x2={cx + 5} y2={cy + 5} stroke={color} strokeWidth={2} />
      <line x1={cx - 5} y1={cy + 5} x2={cx + 5} y2={cy - 5} stroke={color} strokeWidth={2} />
      {noResponse && (
        <line
          x1={cx}
          y1={cy + 6}
          x2={cx}
          y2={cy + 18}
          stroke={color}
          strokeWidth={2}
          markerEnd="url(#arrow-down)"
        />
      )}
    </>
  ),
}

const squareSymbol = (color: string, fill: boolean, cx: number, cy: number): React.ReactNode => (
  <rect
    x={cx - 5}
    y={cy - 5}
    width={10}
    height={10}
    fill={fill ? color : 'none'}
    stroke={color}
    strokeWidth={2}
  />
)

const airOdsymbolMasked: SymbolRender = {
  shape: (cx, cy, color, noResponse) => (
    <>
      {squareSymbol(color, true, cx, cy)}
      {noResponse && (
        <line
          x1={cx}
          y1={cy + 6}
          x2={cx}
          y2={cy + 18}
          stroke={color}
          strokeWidth={2}
          markerEnd="url(#arrow-down)"
        />
      )}
    </>
  ),
}

const airOeSymbolMasked: SymbolRender = {
  shape: (cx, cy, color, noResponse) => (
    <>
      {squareSymbol(color, false, cx, cy)}
      {noResponse && (
        <line
          x1={cx}
          y1={cy + 6}
          x2={cx}
          y2={cy + 18}
          stroke={color}
          strokeWidth={2}
          markerEnd="url(#arrow-down)"
        />
      )}
    </>
  ),
}

const bracketLeft = (cx: number, cy: number, color: string): React.ReactNode => (
  <path
    d={`M ${cx + 4} ${cy - 6} L ${cx - 4} ${cy - 6} L ${cx - 4} ${cy + 6} L ${cx + 4} ${cy + 6}`}
    fill="none"
    stroke={color}
    strokeWidth={2}
  />
)

const bracketRight = (cx: number, cy: number, color: string): React.ReactNode => (
  <path
    d={`M ${cx - 4} ${cy - 6} L ${cx + 4} ${cy - 6} L ${cx + 4} ${cy + 6} L ${cx - 4} ${cy + 6}`}
    fill="none"
    stroke={color}
    strokeWidth={2}
  />
)

const boneOdsymbol: SymbolRender = {
  shape: (cx, cy, color, noResponse) => (
    <>
      {bracketLeft(cx, cy, color)}
      {noResponse && (
        <line
          x1={cx}
          y1={cy + 6}
          x2={cx}
          y2={cy + 18}
          stroke={color}
          strokeWidth={2}
          markerEnd="url(#arrow-down)"
        />
      )}
    </>
  ),
}

const boneOeSymbol: SymbolRender = {
  shape: (cx, cy, color, noResponse) => (
    <>
      {bracketRight(cx, cy, color)}
      {noResponse && (
        <line
          x1={cx}
          y1={cy + 6}
          x2={cx}
          y2={cy + 18}
          stroke={color}
          strokeWidth={2}
          markerEnd="url(#arrow-down)"
        />
      )}
    </>
  ),
}

const boneOdsymbolMasked: SymbolRender = {
  shape: (cx, cy, color, noResponse) => (
    <>
      {/* [ para OD com mascaramento: usamos colchete quadrado esquerdo preenchido? Convenção: [ */}
      {bracketLeft(cx, cy, color)}
      {noResponse && (
        <line
          x1={cx}
          y1={cy + 6}
          x2={cx}
          y2={cy + 18}
          stroke={color}
          strokeWidth={2}
          markerEnd="url(#arrow-down)"
        />
      )}
    </>
  ),
}

const boneOeSymbolMasked: SymbolRender = {
  shape: (cx, cy, color, noResponse) => (
    <>
      {bracketRight(cx, cy, color)}
      {noResponse && (
        <line
          x1={cx}
          y1={cy + 6}
          x2={cx}
          y2={cy + 18}
          stroke={color}
          strokeWidth={2}
          markerEnd="url(#arrow-down)"
        />
      )}
    </>
  ),
}

function getAirRenderer(side: 'OD' | 'OE', symbol: string): SymbolRender {
  if (side === 'OD') {
    if (symbol === 'masked' || symbol === 'masked_no_response') return airOdsymbolMasked
    return airOdsymbol
  } else {
    if (symbol === 'masked' || symbol === 'masked_no_response') return airOeSymbolMasked
    return airOeSymbol
  }
}

function getBoneRenderer(side: 'OD' | 'OE', symbol: string): SymbolRender {
  if (side === 'OD') {
    if (symbol === 'masked' || symbol === 'masked_no_response') return boneOdsymbolMasked
    return boneOdsymbol
  } else {
    if (symbol === 'masked' || symbol === 'masked_no_response') return boneOeSymbolMasked
    return boneOeSymbol
  }
}

interface AudiogramChartProps {
  airOD: AudiogramMap
  airOE: AudiogramMap
  boneOD: AudiogramMap
  boneOE: AudiogramMap
  /** Largura opcional para o SVG (default 100%). */
  width?: number | string
}

export const AudiogramChart: React.FC<AudiogramChartProps> = ({
  airOD,
  airOE,
  boneOD,
  boneOE,
  width = '100%',
}) => {
  // Pontos com valor (db !== null)
  const buildPoints = (map: AudiogramMap, freqs: readonly string[]) =>
    freqs
      .map((f) => ({ freq: f, point: map[f] }))
      .filter((p) => p.point && p.point.db !== null && p.point.db !== undefined)

  const airOdPts = buildPoints(airOD, AIR_FREQS)
  const airOePts = buildPoints(airOE, AIR_FREQS)
  const boneOdPts = buildPoints(boneOD, BONE_FREQS)
  const boneOePts = buildPoints(boneOE, BONE_FREQS)

  const renderSymbol = (
    side: 'OD' | 'OE',
    kind: 'air' | 'bone',
    freq: string,
    db: number | null,
    symbol: string,
  ): React.ReactNode => {
    if (db === null || db === undefined) return null
    const cx = xForFreq(freq)
    // no_response: o símbolo é desenhado na linha de 120 dB com seta para baixo
    const isNoResponse = symbol === 'no_response' || symbol === 'masked_no_response'
    const cy = isNoResponse ? yForDb(120) : yForDb(db)
    const color = side === 'OD' ? COLOR_OD : COLOR_OE
    const renderer = kind === 'air' ? getAirRenderer(side, symbol) : getBoneRenderer(side, symbol)
    return <g key={`${kind}-${side}-${freq}`}>{renderer.shape(cx, cy, color, isNoResponse)}</g>
  }

  // Linhas conectando símbolos (somente pontos com resposta, ignorando no_response para a linha)
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

  const airOdPath = buildPath(airOdPts as any)
  const airOePath = buildPath(airOePts as any)
  const boneOdPath = buildPath(boneOdPts as any)
  const boneOePath = buildPath(boneOePts as any)

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={width}
      style={{ maxWidth: '100%', height: 'auto', display: 'block' }}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Audiograma tonal"
    >
      <defs>
        <marker id="arrow-down" markerWidth="8" markerHeight="8" refX="4" refY="7" orient="auto">
          <path d="M 0 0 L 4 7 L 8 0 Z" fill="currentColor" />
        </marker>
      </defs>

      {/* Fundo branco */}
      <rect x={0} y={0} width={W} height={H} fill="#ffffff" />

      {/* Zona de audição normal (0 a 25 dB) — verde claro */}
      <rect
        x={PAD_L}
        y={yForDb(0)}
        width={W - PAD_L - PAD_R}
        height={yForDb(25) - yForDb(0)}
        fill="#dcfce7"
        opacity={0.7}
      />

      {/* Linhas horizontais (grade dB) */}
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
            <text x={PAD_L - 8} y={y + 3} textAnchor="end" fontSize="9" fill="#64748b">
              {db}
            </text>
          </g>
        )
      })}

      {/* Linhas verticais (grade frequências) */}
      {ALL_FREQS.map((f, i) => {
        const x = xForIndex(i)
        return (
          <g key={`v-${f}`}>
            <line x1={x} y1={PAD_T} x2={x} y2={H - PAD_B} stroke="#e2e8f0" strokeWidth={0.6} />
            <text x={x} y={H - PAD_B + 14} textAnchor="middle" fontSize="9" fill="#64748b">
              {Number(f) >= 1000 ? `${Number(f) / 1000}k` : f}
            </text>
          </g>
        )
      })}

      {/* Bordas */}
      <rect
        x={PAD_L}
        y={PAD_T}
        width={W - PAD_L - PAD_R}
        height={H - PAD_T - PAD_B}
        fill="none"
        stroke="#475569"
        strokeWidth={1.2}
      />

      {/* Rótulo eixo Y (dB) */}
      <text
        x={14}
        y={H / 2}
        textAnchor="middle"
        fontSize="11"
        fill="#334155"
        fontWeight={600}
        transform={`rotate(-90, 14, ${H / 2})`}
      >
        dB HL
      </text>
      {/* Rótulo eixo X (Hz) */}
      <text
        x={(PAD_L + W - PAD_R) / 2}
        y={H - 6}
        textAnchor="middle"
        fontSize="11"
        fill="#334155"
        fontWeight={600}
      >
        Frequência (Hz)
      </text>

      {/* Linhas conectando via aérea */}
      {airOdPath && <path d={airOdPath} fill="none" stroke={COLOR_OD} strokeWidth={1.4} />}
      {airOePath && <path d={airOePath} fill="none" stroke={COLOR_OE} strokeWidth={1.4} />}
      {/* Linhas conectando via óssea (tracejada) */}
      {boneOdPath && (
        <path
          d={boneOdPath}
          fill="none"
          stroke={COLOR_OD}
          strokeWidth={1.4}
          strokeDasharray="5 3"
        />
      )}
      {boneOePath && (
        <path
          d={boneOePath}
          fill="none"
          stroke={COLOR_OE}
          strokeWidth={1.4}
          strokeDasharray="5 3"
        />
      )}

      {/* Símbolos via aérea */}
      {airOdPts.map((p) => renderSymbol('OD', 'air', p.freq, p.point.db, p.point.symbol))}
      {airOePts.map((p) => renderSymbol('OE', 'air', p.freq, p.point.db, p.point.symbol))}
      {/* Símbolos via óssea */}
      {boneOdPts.map((p) => renderSymbol('OD', 'bone', p.freq, p.point.db, p.point.symbol))}
      {boneOePts.map((p) => renderSymbol('OE', 'bone', p.freq, p.point.db, p.point.symbol))}

      {/* Legenda */}
      <g transform={`translate(${PAD_L + 8}, ${PAD_T + 4})`}>
        <rect
          x={-4}
          y={-2}
          width={250}
          height={54}
          fill="#ffffff"
          opacity={0.92}
          stroke="#e2e8f0"
          rx={4}
        />
        {/* OD air */}
        <circle cx={8} cy={12} r={5} fill="none" stroke={COLOR_OD} strokeWidth={2} />
        <text x={20} y={15} fontSize="9" fill="#334155">
          OD Aérea (○)
        </text>
        {/* OE air */}
        <g transform="translate(120, 12)">
          <line x1={-5} y1={-5} x2={5} y2={5} stroke={COLOR_OE} strokeWidth={2} />
          <line x1={-5} y1={5} x2={5} y2={-5} stroke={COLOR_OE} strokeWidth={2} />
        </g>
        <text x={132} y={15} fontSize="9" fill="#334155">
          OE Aérea (×)
        </text>
        {/* OD bone */}
        <g transform="translate(8, 34)">{bracketLeft(0, 0, COLOR_OD)}</g>
        <text x={20} y={37} fontSize="9" fill="#334155">
          OD Óssea (&lt;)
        </text>
        {/* OE bone */}
        <g transform="translate(128, 34)">{bracketRight(0, 0, COLOR_OE)}</g>
        <text x={140} y={37} fontSize="9" fill="#334155">
          OE Óssea (&gt;)
        </text>
      </g>
    </svg>
  )
}

export default AudiogramChart
