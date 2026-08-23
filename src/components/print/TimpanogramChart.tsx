import React from 'react'

/**
 * TimpanogramChart — gráfico timpanométrico reutilizável (pressão × complacência).
 *
 * Eixo X: pressão em daPa (faixa -400 a +200).
 * Eixo Y: complacência em ml (faixa 0 a 2.5).
 *
 * Plota a curva da OD em vermelho (#DC2626) e da OE em azul (#2563EB),
 * sobrepostas no mesmo gráfico. Quando não há pontos reais (array
 * `curva_timpanometrica_od/oe`), sintetiza uma curva gaussiana a partir dos
 * parâmetros da timpanometria (tipo de curva, pressão de pico e complacência),
 * de forma a sempre renderizar algo coerente com os dados do exame.
 *
 * Usado tanto no PDF de Imitanciometria quanto no editor de templates
 * (elemento `timpanogram`) — por isso não depende de hooks nem de estado.
 */

export interface TimpanogramPoint {
  pressao: number
  complacencia: number
}

export interface TimpanogramTimpHint {
  tipo_curva?: string | null
  pressao_pico?: number | null
  complacencia?: number | null
}

export interface TimpanogramChartProps {
  /** Pontos reais da curva OD (pressão × complacência). */
  odPoints?: TimpanogramPoint[] | null
  /** Pontos reais da curva OE (pressão × complacência). */
  oePoints?: TimpanogramPoint[] | null
  /** Parâmetros da timpanometria OD — usado quando não há pontos reais. */
  odTimp?: TimpanogramTimpHint | null
  /** Parâmetros da timpanometria OE — usado quando não há pontos reais. */
  oeTimp?: TimpanogramTimpHint | null
  /** Largura do viewBox (px). Padrão 320. */
  width?: number
  /** Altura do viewBox (px). Padrão 180. */
  height?: number
  /** Exibir título "Curva Timpanométrica". Padrão true. */
  showTitle?: boolean
  /** Exibir legenda OD/OE. Padrão true. */
  showLegend?: boolean
  /** Classe CSS extra para o <svg>. */
  className?: string
  /** Style inline extra para o <svg>. */
  style?: React.CSSProperties
}

const COLOR_OD = '#DC2626'
const COLOR_OE = '#2563EB'

const P_MIN = -400
const P_MAX = 200
const C_MIN = 0
const C_MAX = 2.5

/** Normaliza o tipo de curva para um dos canônicos. */
function normalizeTipo(tipo: string | null | undefined): 'A' | 'Ad' | 'As' | 'B' | 'C' {
  const t = String(tipo || '')
    .toUpperCase()
    .trim()
  if (t.startsWith('AD')) return 'Ad'
  if (t.startsWith('AS')) return 'As'
  if (t.startsWith('B')) return 'B'
  if (t.startsWith('C')) return 'C'
  if (t.startsWith('A')) return 'A'
  return 'A'
}

/**
 * Sintetiza uma curva gaussiana a partir dos parâmetros da timpanometria.
 * Retorna pontos {pressao, complacencia} de -400 a +200 daPa.
 */
function synthCurve(timp: TimpanogramTimpHint | null | undefined): TimpanogramPoint[] | null {
  if (!timp) return null

  const num = (v: unknown): number | null => {
    if (v === null || v === undefined || v === '') return null
    const n = Number(v)
    return isNaN(n) ? null : n
  }

  const pVal = num(timp.pressao_pico)
  const cVal = num(timp.complacencia)

  // Se não foi informada complacência e nem pressão de pico, não renderiza curva (gráfico inicia limpo)
  if (pVal === null && cVal === null) {
    return null
  }

  const normTipo = normalizeTipo(timp.tipo_curva)
  const isTypeB = normTipo === 'B' || (cVal !== null && cVal <= 0.1 && pVal === null)
  const peakP = pVal !== null ? pVal : normTipo === 'C' ? -180 : 0
  const peakC = cVal !== null ? cVal : 0.8

  if (isTypeB) {
    const flatC = Math.max(0.05, Math.min(0.2, peakC))
    const pts: TimpanogramPoint[] = []
    const N = 60
    for (let i = 0; i <= N; i++) {
      const p = P_MIN + ((P_MAX - P_MIN) * i) / N
      pts.push({ pressao: Math.round(p), complacencia: Number(flatC.toFixed(3)) })
    }
    return pts
  }

  let sigma = 50
  if (normTipo.startsWith('Ad')) {
    sigma = 65
  } else if (normTipo.startsWith('As')) {
    sigma = 35
  } else if (normTipo.startsWith('C')) {
    sigma = 50
  }

  const amp = Math.max(0, Math.min(C_MAX, peakC))
  const N = 120
  const pts: TimpanogramPoint[] = []
  for (let i = 0; i <= N; i++) {
    const p = P_MIN + ((P_MAX - P_MIN) * i) / N
    const c = amp * Math.exp(-((p - peakP) ** 2) / (2 * sigma * sigma))
    pts.push({ pressao: Math.round(p), complacencia: Number(Math.max(0, c).toFixed(3)) })
  }
  return pts
}

function hasRealPoints(pts: TimpanogramPoint[] | null | undefined): pts is TimpanogramPoint[] {
  return !!pts && pts.length >= 2
}

export const TimpanogramChart: React.FC<TimpanogramChartProps> = ({
  odPoints,
  oePoints,
  odTimp,
  oeTimp,
  width = 320,
  height = 180,
  showTitle = true,
  showLegend = true,
  className,
  style,
}) => {
  const W = width
  const H = height
  const padL = 34
  const padR = 12
  const padT = showTitle ? 22 : 10
  const padB = 26
  const plotW = W - padL - padR
  const plotH = H - padT - padB

  const xOf = (p: number) =>
    padL + ((Math.max(P_MIN, Math.min(P_MAX, p)) - P_MIN) / (P_MAX - P_MIN)) * plotW
  const yOf = (c: number) =>
    padT + plotH - ((Math.max(C_MIN, Math.min(C_MAX, c)) - C_MIN) / (C_MAX - C_MIN)) * plotH

  const ticksX = [-400, -300, -200, -100, 0, 100, 200]
  const ticksY = [0, 0.5, 1, 1.5, 2, 2.5]
  const zeroX = xOf(0)

  const odCurve = hasRealPoints(odPoints) ? odPoints : synthCurve(odTimp)
  const oeCurve = hasRealPoints(oePoints) ? oePoints : synthCurve(oeTimp)

  const pathFromPoints = (pts: TimpanogramPoint[] | null): string => {
    if (!pts || pts.length < 2) return ''
    return pts
      .map((pt, i) => {
        const x = xOf(pt.pressao)
        const y = yOf(pt.complacencia)
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
      })
      .join(' ')
  }

  const odPath = pathFromPoints(odCurve)
  const oePath = pathFromPoints(oeCurve)

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      className={className}
      style={{ display: 'block', ...style }}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Curva timpanométrica — orelhas direita e esquerda sobrepostas"
    >
      {/* Título */}
      {showTitle && (
        <text
          x={W / 2}
          y={13}
          textAnchor="middle"
          style={{ fontSize: 10, fontWeight: 700, fill: '#1e293b' }}
        >
          Curva Timpanométrica
        </text>
      )}

      {/* Grade horizontal (complacência) */}
      {ticksY.map((c) => (
        <g key={`y-${c}`}>
          <line
            x1={padL}
            x2={W - padR}
            y1={yOf(c)}
            y2={yOf(c)}
            stroke="#cbd5e1"
            strokeWidth={0.5}
            strokeDasharray="2 2"
          />
          <text
            x={padL - 3}
            y={yOf(c) + 3}
            textAnchor="end"
            style={{ fontSize: 7, fill: '#64748b' }}
          >
            {Number.isInteger(c) ? c.toFixed(0) : c.toFixed(1)}
          </text>
        </g>
      ))}

      {/* Grade vertical (pressão) */}
      {ticksX.map((p) => (
        <g key={`x-${p}`}>
          <line
            x1={xOf(p)}
            x2={xOf(p)}
            y1={padT}
            y2={padT + plotH}
            stroke={p === 0 ? '#94a3b8' : '#e2e8f0'}
            strokeWidth={p === 0 ? 0.7 : 0.4}
            strokeDasharray={p === 0 ? undefined : '2 2'}
          />
          <text
            x={xOf(p)}
            y={padT + plotH + 10}
            textAnchor="middle"
            style={{ fontSize: 7, fill: '#64748b' }}
          >
            {p}
          </text>
        </g>
      ))}

      {/* Eixos */}
      <line
        x1={padL}
        x2={W - padR}
        y1={padT + plotH}
        y2={padT + plotH}
        stroke="#475569"
        strokeWidth={0.8}
      />
      <line x1={padL} x2={padL} y1={padT} y2={padT + plotH} stroke="#475569" strokeWidth={0.8} />

      {/* Linha zero (pressão) destacada */}
      <line x1={zeroX} x2={zeroX} y1={padT} y2={padT + plotH} stroke="#94a3b8" strokeWidth={0.6} />

      {/* Labels dos eixos */}
      <text
        x={padL + plotW / 2}
        y={H - 4}
        textAnchor="middle"
        style={{ fontSize: 8, fontWeight: 600, fill: '#475569' }}
      >
        Pressão (daPa)
      </text>
      <text
        x={10}
        y={padT + plotH / 2}
        textAnchor="middle"
        style={{ fontSize: 8, fontWeight: 600, fill: '#475569' }}
        transform={`rotate(-90 10 ${padT + plotH / 2})`}
      >
        Complacência (ml)
      </text>

      {/* Curvas */}
      {oePath && (
        <path
          d={oePath}
          fill="none"
          stroke={COLOR_OE}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      {odPath && (
        <path
          d={odPath}
          fill="none"
          stroke={COLOR_OD}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}

      {/* Legenda */}
      {showLegend && (odPath || oePath) && (
        <g>
          <rect
            x={W - padR - 58}
            y={padT + 2}
            width={56}
            height={22}
            fill="#ffffff"
            opacity={0.85}
            rx={2}
          />
          {odPath && (
            <>
              <line
                x1={W - padR - 54}
                x2={W - padR - 42}
                y1={padT + 9}
                y2={padT + 9}
                stroke={COLOR_OD}
                strokeWidth={1.6}
              />
              <text
                x={W - padR - 39}
                y={padT + 12}
                style={{ fontSize: 8, fontWeight: 700, fill: COLOR_OD }}
              >
                OD
              </text>
            </>
          )}
          {oePath && (
            <>
              <line
                x1={W - padR - 54}
                x2={W - padR - 42}
                y1={padT + (odPath ? 19 : 9)}
                y2={padT + (odPath ? 19 : 9)}
                stroke={COLOR_OE}
                strokeWidth={1.6}
              />
              <text
                x={W - padR - 39}
                y={padT + (odPath ? 22 : 12)}
                style={{ fontSize: 8, fontWeight: 700, fill: COLOR_OE }}
              >
                OE
              </text>
            </>
          )}
        </g>
      )}
    </svg>
  )
}

export default TimpanogramChart
