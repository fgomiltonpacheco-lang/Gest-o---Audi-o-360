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
