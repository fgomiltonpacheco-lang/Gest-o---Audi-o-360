import React from 'react'
import { formatDate, maskCPF } from '@/lib/formatters'
import logoImg from '@/assets/audicao-360-logo-para-papel-timbrado-da364.png'

const SPECIALIST_PRINT = 'MILTON SOARES PACHECO'
const SPECIALIST_CRFA = '3-11981-5'
const CLINIC_NAME = 'Audição360'
const CLINIC_ADDRESS = 'R. Sadoc Correa, 373 - St. Central, Araguaína - TO, 77803-060'
const CLINIC_PHONE = '(63) 3421-2611'

export interface ImitPrintData {
  paciente_nome: string
  paciente_cpf: string
  paciente_nascimento: string
  paciente_idade: string
  paciente_sexo: string
  data_exame: string
  especialista_nome: string
  equipment_nome: string
  observacoes?: string
  tipo_curva_od: string
  tipo_curva_oe: string
  reflexos_status: string
  laudo: string
  referencias: string
  timpanometria: {
    OD?: {
      volume_meato: number | null
      complacencia: number | null
      pressao_maxima: number | null
      tipo_curva: string
      pressao_pico: number | null
    }
    OE?: {
      volume_meato: number | null
      complacencia: number | null
      pressao_maxima: number | null
      tipo_curva: string
      pressao_pico: number | null
    }
  }
  reflexos: {
    OD?: {
      contra_lateral: FreqVals
      ipsi_lateral: FreqVals
    }
    OE?: {
      contra_lateral: FreqVals
      ipsi_lateral: FreqVals
    }
  }
}

export type FreqVals = {
  frequencia_500: number | null
  frequencia_1000: number | null
  frequencia_2000: number | null
  frequencia_4000: number | null
  status: string
}

export function ImitanciometriaPrint({
  data,
  clinicSettings,
}: {
  data: ImitPrintData
  clinicSettings?: { nome?: string; endereco?: string; telefone?: string } | null
}) {
  const clinicName = clinicSettings?.nome?.trim() || CLINIC_NAME
  const clinicAddress = clinicSettings?.endereco?.trim() || CLINIC_ADDRESS
  const clinicPhone = clinicSettings?.telefone?.trim() || CLINIC_PHONE

  const thStyle: React.CSSProperties = {
    border: '1px solid #94a3b8',
    padding: '2px 3px',
    background: '#f1f5f9',
    fontSize: '7.5pt',
    fontWeight: 700,
    textAlign: 'center',
  }
  const tdStyle: React.CSSProperties = {
    border: '1px solid #94a3b8',
    padding: '2px 3px',
    fontSize: '7.5pt',
    textAlign: 'center',
  }

  const fmt = (v: number | null | undefined) => (v === null || v === undefined ? '—' : v)

  const odTimp = data.timpanometria.OD
  const oeTimp = data.timpanometria.OE
  const odReflex = data.reflexos.OD
  const oeReflex = data.reflexos.OE

  const fmtReflexCell = (vals: FreqVals | undefined, freq: keyof FreqVals) => {
    if (!vals) return '—'
    const v = vals[freq]
    if (v === null || v === undefined) return '—'
    return String(v)
  }

  // ---- Gráfico da curva de complacência timpanométrica ----
  // Eixo X: pressão em daPa (range -400 a +200). Eixo Y: complacência em ml
  // (range 0 a 5). Desenha uma curva suave (tipo tenda/gaussiana) baseada no
  // tipo_curva (A, Ad, As, B, C), pressao_pico e complacencia de cada orelha.
  const TimpCurveGraph: React.FC<{ ear: 'OD' | 'OE' }> = ({ ear }) => {
    const W = 150
    const H = 80
    const padL = 26
    const padR = 6
    const padT = 6
    const padB = 16
    const plotW = W - padL - padR
    const plotH = H - padT - padB

    const P_MIN = -400
    const P_MAX = 200
    const C_MIN = 0
    const C_MAX = 5

    const xOf = (p: number) =>
      padL + ((Math.max(P_MIN, Math.min(P_MAX, p)) - P_MIN) / (P_MAX - P_MIN)) * plotW
    const yOf = (c: number) =>
      padT + plotH - ((Math.max(C_MIN, Math.min(C_MAX, c)) - C_MIN) / (C_MAX - C_MIN)) * plotH

    const timp = ear === 'OD' ? odTimp : oeTimp
    const color = ear === 'OD' ? '#dc2626' : '#2563eb'
    const zeroX = xOf(0)

    const ticksX = [-400, -200, 0, 200]
    const ticksY = [0, 1, 2, 3, 4, 5]

    // Normaliza o tipo de curva em uma das categorias canônicas.
    const tipoRaw = String(timp?.tipo_curva || '')
      .toUpperCase()
      .trim()
    const normTipo: 'A' | 'Ad' | 'As' | 'B' | 'C' = (() => {
      if (tipoRaw.startsWith('AD')) return 'Ad'
      if (tipoRaw.startsWith('AS')) return 'As'
      if (tipoRaw.startsWith('B')) return 'B'
      if (tipoRaw.startsWith('C')) return 'C'
      if (tipoRaw.startsWith('A')) return 'A'
      return 'A'
    })()

    // Pressão de pico e complacência (defaults clínicos por tipo quando ausentes).
    const peakP = (() => {
      const v = timp?.pressao_pico
      const n = v != null && !isNaN(Number(v)) ? Number(v) : NaN
      if (!isNaN(n)) return n
      return normTipo === 'C' ? -180 : 0
    })()
    const peakC = (() => {
      const v = timp?.complacencia
      const n = v != null && !isNaN(Number(v)) ? Number(v) : NaN
      if (!isNaN(n)) return n
      switch (normTipo) {
        case 'Ad':
          return 2.2
        case 'As':
          return 0.25
        case 'B':
          return 0.15
        case 'C':
          return 0.9
        default:
          return 1.0
      }
    })()

    // Largura (sigma) da curva por tipo — Ad alargada, As estreita, B achatada.
    const sigma = (() => {
      switch (normTipo) {
        case 'Ad':
          return 130
        case 'As':
          return 38
        case 'B':
          return 600 // praticamente flat
        case 'C':
          return 75
        default:
          return 75
      }
    })()

    // Amplitude base: B é sempre baixa; demais usam a complacência informada.
    const amp = normTipo === 'B' ? Math.min(0.25, peakC) : peakC

    // Gera pontos da curva (gaussiana) para o path.
    const N = 48
    const pts: { x: number; y: number }[] = []
    for (let i = 0; i <= N; i++) {
      const p = P_MIN + ((P_MAX - P_MIN) * i) / N
      const c = amp * Math.exp(-((p - peakP) ** 2) / (2 * sigma * sigma))
      pts.push({ x: xOf(p), y: yOf(c) })
    }
    const linePath = pts
      .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`)
      .join(' ')
    const fillPath = `${linePath} L ${xOf(P_MAX).toFixed(2)} ${yOf(0).toFixed(2)} L ${xOf(
      P_MIN,
    ).toFixed(2)} ${yOf(0).toFixed(2)} Z`

    const px = xOf(peakP)
    const py = yOf(amp)

    return (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
        {/* grade horizontal pontilhada */}
        {ticksY.map((c) => (
          <g key={`y-${c}`}>
            <line
              x1={padL}
              x2={W - padR}
              y1={yOf(c)}
              y2={yOf(c)}
              stroke="#cbd5e1"
              strokeWidth={0.5}
              strokeDasharray="1.5 1.5"
            />
            <text
              x={padL - 2}
              y={yOf(c) + 2.5}
              textAnchor="end"
              style={{ fontSize: 6 }}
              fill="#64748b"
            >
              {c}
            </text>
          </g>
        ))}
        {/* grade vertical pontilhada nos ticks X */}
        {ticksX.map((p) => (
          <line
            key={`gx-${p}`}
            x1={xOf(p)}
            x2={xOf(p)}
            y1={padT}
            y2={padT + plotH}
            stroke="#e2e8f0"
            strokeWidth={0.4}
            strokeDasharray="1.5 1.5"
          />
        ))}
        {/* linha de pressão zero (destaque) */}
        <line
          x1={zeroX}
          x2={zeroX}
          y1={padT}
          y2={padT + plotH}
          stroke="#94a3b8"
          strokeWidth={0.6}
        />
        {/* eixos */}
        <line
          x1={padL}
          x2={W - padR}
          y1={padT + plotH}
          y2={padT + plotH}
          stroke="#475569"
          strokeWidth={0.7}
        />
        <line x1={padL} x2={padL} y1={padT} y2={padT + plotH} stroke="#475569" strokeWidth={0.7} />
        {/* ticks X */}
        {ticksX.map((p) => (
          <text
            key={`x-${p}`}
            x={xOf(p)}
            y={H - 5}
            textAnchor="middle"
            style={{ fontSize: 6 }}
            fill="#64748b"
          >
            {p}
          </text>
        ))}
        {/* rótulos dos eixos */}
        <text
          x={padL + plotW / 2}
          y={H - 1}
          textAnchor="middle"
          style={{ fontSize: 6 }}
          fill="#475569"
        >
          Pressão (daPa)
        </text>
        <text
          x={6}
          y={padT + plotH / 2}
          textAnchor="middle"
          style={{ fontSize: 6, fill: '#475569' }}
          transform={`rotate(-90 6 ${padT + plotH / 2})`}
        >
          Compl. (ml)
        </text>
        {/* área sob a curva (preenchimento suave) */}
        <path d={fillPath} fill={color} opacity={0.1} />
        {/* curva de complacência */}
        <path d={linePath} fill="none" stroke={color} strokeWidth={1.4} strokeLinejoin="round" />
        {/* marcador do pico */}
        <line
          x1={px}
          y1={padT + plotH}
          x2={px}
          y2={py}
          stroke={color}
          strokeWidth={0.5}
          strokeDasharray="2 2"
        />
        <line
          x1={padL}
          y1={py}
          x2={px}
          y2={py}
          stroke={color}
          strokeWidth={0.5}
          strokeDasharray="2 2"
        />
        <circle cx={px} cy={py} r={2.2} fill={color} />
        {/* rótulo da orelha + tipo */}
        <text
          x={W - padR}
          y={padT + 5}
          textAnchor="end"
          style={{ fontSize: 7, fontWeight: 700 }}
          fill={color}
        >
          {ear} · {normTipo}
        </text>
      </svg>
    )
  }

  return (
    <div
      className="imitanciometria-print"
      style={{ color: '#1e293b', fontSize: '7.5pt', lineHeight: 1.3 }}
    >
      {/* Cabeçalho da clínica com logo */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          borderBottom: '2px solid #0F2B5C',
          paddingBottom: '3px',
          marginBottom: '4px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img
            src={logoImg}
            alt={clinicName}
            style={{ maxHeight: '40px', maxWidth: '130px', objectFit: 'contain' }}
          />
          <div>
            <div style={{ fontSize: '11pt', fontWeight: 800, color: '#0F2B5C' }}>{clinicName}</div>
            <div style={{ fontSize: '7pt', color: '#64748b', lineHeight: 1.25 }}>
              {clinicAddress}
              <br />
              Telefone: {clinicPhone}
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: '7.5pt' }}>
          <div style={{ fontWeight: 700 }}>DATA DO EXAME</div>
          <div>{formatDate(data.data_exame)}</div>
        </div>
      </div>

      {/* Bloco de identificação do paciente */}
      <div
        style={{
          border: '1px solid #94a3b8',
          padding: '3px 4px',
          marginBottom: '5px',
          fontSize: '7.5pt',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr 1fr',
          gap: '1px 8px',
        }}
      >
        <div style={{ gridColumn: 'span 4' }}>
          <strong>NOME COMPLETO:</strong> {data.paciente_nome || '—'}
        </div>
        <div>
          <strong>CPF:</strong> {maskCPF(data.paciente_cpf)}
        </div>
        <div>
          <strong>GÊNERO:</strong> {data.paciente_sexo || '—'}
        </div>
        <div>
          <strong>DATA DE NASC.:</strong> {formatDate(data.paciente_nascimento)}
        </div>
        <div>
          <strong>IDADE:</strong> {data.paciente_idade || '—'}
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <strong>ESPECIALISTA:</strong> {data.especialista_nome || SPECIALIST_PRINT}
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <strong>EQUIPAMENTO:</strong> {data.equipment_nome || '—'}
        </div>
      </div>

      {/* Título IMITANCIOMETRIA */}
      <h2
        style={{
          textAlign: 'center',
          fontSize: '10pt',
          fontWeight: 800,
          margin: '0 0 4px 0',
          color: '#1e293b',
          letterSpacing: '0.04em',
        }}
      >
        IMITANCIOMETRIA
      </h2>

      {/* Timpanometria */}
      <div style={{ marginBottom: '4px', breakInside: 'avoid' }}>
        <div
          style={{
            fontSize: '8pt',
            fontWeight: 700,
            color: '#0F2B5C',
            borderBottom: '1px solid #0F2B5C',
            paddingBottom: '1px',
            marginBottom: '2px',
          }}
        >
          TIMPANOMETRIA
        </div>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={thStyle}>Orelha</th>
              <th style={thStyle}>Volume do Meato (ml)</th>
              <th style={thStyle}>Complacência (ml)</th>
              <th style={thStyle}>Pressão de Pico (daPa)</th>
              <th style={thStyle}>Tipo de Curva</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ ...tdStyle, color: '#dc2626', fontWeight: 700 }}>OD</td>
              <td style={tdStyle}>{fmt(odTimp?.volume_meato)}</td>
              <td style={tdStyle}>{fmt(odTimp?.complacencia)}</td>
              <td style={tdStyle}>{fmt(odTimp?.pressao_pico)}</td>
              <td style={tdStyle}>{odTimp?.tipo_curva || '—'}</td>
            </tr>
            <tr>
              <td style={{ ...tdStyle, color: '#2563eb', fontWeight: 700 }}>OE</td>
              <td style={tdStyle}>{fmt(oeTimp?.volume_meato)}</td>
              <td style={tdStyle}>{fmt(oeTimp?.complacencia)}</td>
              <td style={tdStyle}>{fmt(oeTimp?.pressao_pico)}</td>
              <td style={tdStyle}>{oeTimp?.tipo_curva || '—'}</td>
            </tr>
          </tbody>
        </table>

        {/* Gráfico da curva de complacência (timpanometria) — um por orelha */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '3px', alignItems: 'center' }}>
          <TimpCurveGraph ear="OD" />
          <TimpCurveGraph ear="OE" />
        </div>
      </div>

      {/* Reflexo Acústico */}
      <div style={{ marginBottom: '4px', breakInside: 'avoid' }}>
        <div
          style={{
            fontSize: '8pt',
            fontWeight: 700,
            color: '#0F2B5C',
            borderBottom: '1px solid #0F2B5C',
            paddingBottom: '1px',
            marginBottom: '2px',
          }}
        >
          REFLEXO ACÚSTICO
        </div>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={thStyle}>Orelha</th>
              <th style={thStyle}>Via</th>
              <th style={thStyle}>500 Hz</th>
              <th style={thStyle}>1000 Hz</th>
              <th style={thStyle}>2000 Hz</th>
              <th style={thStyle}>4000 Hz</th>
              <th style={thStyle}>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ ...tdStyle, color: '#dc2626', fontWeight: 700 }} rowSpan={2}>
                OD
              </td>
              <td style={tdStyle}>Contra-lateral</td>
              <td style={tdStyle}>{fmtReflexCell(odReflex?.contra_lateral, 'frequencia_500')}</td>
              <td style={tdStyle}>{fmtReflexCell(odReflex?.contra_lateral, 'frequencia_1000')}</td>
              <td style={tdStyle}>{fmtReflexCell(odReflex?.contra_lateral, 'frequencia_2000')}</td>
              <td style={tdStyle}>{fmtReflexCell(odReflex?.contra_lateral, 'frequencia_4000')}</td>
              <td style={tdStyle}>{odReflex?.contra_lateral?.status || '—'}</td>
            </tr>
            <tr>
              <td style={tdStyle}>Ipsi-lateral</td>
              <td style={tdStyle}>{fmtReflexCell(odReflex?.ipsi_lateral, 'frequencia_500')}</td>
              <td style={tdStyle}>{fmtReflexCell(odReflex?.ipsi_lateral, 'frequencia_1000')}</td>
              <td style={tdStyle}>{fmtReflexCell(odReflex?.ipsi_lateral, 'frequencia_2000')}</td>
              <td style={tdStyle}>{fmtReflexCell(odReflex?.ipsi_lateral, 'frequencia_4000')}</td>
              <td style={tdStyle}>{odReflex?.ipsi_lateral?.status || '—'}</td>
            </tr>
            <tr>
              <td style={{ ...tdStyle, color: '#2563eb', fontWeight: 700 }} rowSpan={2}>
                OE
              </td>
              <td style={tdStyle}>Contra-lateral</td>
              <td style={tdStyle}>{fmtReflexCell(oeReflex?.contra_lateral, 'frequencia_500')}</td>
              <td style={tdStyle}>{fmtReflexCell(oeReflex?.contra_lateral, 'frequencia_1000')}</td>
              <td style={tdStyle}>{fmtReflexCell(oeReflex?.contra_lateral, 'frequencia_2000')}</td>
              <td style={tdStyle}>{fmtReflexCell(oeReflex?.contra_lateral, 'frequencia_4000')}</td>
              <td style={tdStyle}>{oeReflex?.contra_lateral?.status || '—'}</td>
            </tr>
            <tr>
              <td style={tdStyle}>Ipsi-lateral</td>
              <td style={tdStyle}>{fmtReflexCell(oeReflex?.ipsi_lateral, 'frequencia_500')}</td>
              <td style={tdStyle}>{fmtReflexCell(oeReflex?.ipsi_lateral, 'frequencia_1000')}</td>
              <td style={tdStyle}>{fmtReflexCell(oeReflex?.ipsi_lateral, 'frequencia_2000')}</td>
              <td style={tdStyle}>{fmtReflexCell(oeReflex?.ipsi_lateral, 'frequencia_4000')}</td>
              <td style={tdStyle}>{oeReflex?.ipsi_lateral?.status || '—'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Parecer */}
      <div style={{ marginTop: '3px', breakInside: 'avoid' }}>
        <div
          style={{
            fontSize: '8pt',
            fontWeight: 700,
            color: '#0F2B5C',
            borderBottom: '1px solid #0F2B5C',
            paddingBottom: '1px',
            marginBottom: '2px',
          }}
        >
          PARECER
        </div>
        <div
          style={{
            fontSize: '7.5pt',
            color: '#1e293b',
            lineHeight: 1.35,
            whiteSpace: 'pre-wrap',
            border: '1px solid #cbd5e1',
            padding: '3px 5px',
            background: '#fafafa',
          }}
        >
          {data.laudo || '—'}
        </div>
        {data.referencias && (
          <p
            style={{
              fontSize: '6.5pt',
              color: '#64748b',
              marginTop: '2px',
              marginBottom: '0',
              textAlign: 'justify',
              fontStyle: 'italic',
            }}
          >
            {data.referencias}
          </p>
        )}
      </div>

      {/* Assinatura */}
      <div style={{ marginTop: '10px', textAlign: 'center' }}>
        <div
          style={{
            borderTop: '1px solid #475569',
            width: '55%',
            margin: '0 auto',
            paddingTop: '2px',
            fontSize: '7.5pt',
            fontWeight: 700,
            color: '#1e293b',
          }}
        >
          {SPECIALIST_PRINT}
        </div>
        <div style={{ fontSize: '6.5pt', color: '#475569', marginTop: '1px' }}>
          Fonoaudiólogo — CRFa {SPECIALIST_CRFA}
        </div>
      </div>

      {/* Rodapé */}
      <div
        style={{
          marginTop: '4px',
          fontSize: '6.5pt',
          color: '#64748b',
          textAlign: 'center',
          borderTop: '1px solid #cbd5e1',
          paddingTop: '2px',
        }}
      >
        {clinicAddress} &nbsp;•&nbsp; {clinicPhone}
      </div>
    </div>
  )
}
