import React from 'react'
import { formatDate, maskCPF } from '@/lib/formatters'
import logoImg from '@/assets/audicao-360-logo-para-papel-timbrado-da364.png'
import { TimpanogramChart, type TimpanogramPoint } from './TimpanogramChart'

const SPECIALIST_PRINT = 'MILTON SOARES PACHECO'
const SPECIALIST_CRFA = '3-11981-5'
const CLINIC_NAME = 'Audição 360 – Soluções Auditivas Ltda'
const CLINIC_ADDRESS = 'R. Sadoc Correa, 373 - St. Central, Araguaína - TO, 77803-060'
const CLINIC_PHONE = '(63) 3421-2611'
const CLINIC_EMAIL = 'contato@audicao360.com.br'

const NAVY = '#1E3A8A'
const BORDER = '#94a3b8'
const HEAD_BG = '#F2F4F7'

export type FreqVals = {
  frequencia_500: number | null
  frequencia_1000: number | null
  frequencia_2000: number | null
  frequencia_4000: number | null
  status: string
}

export interface ImitTimpData {
  volume_meato: number | null
  complacencia: number | null
  pressao_maxima: number | null
  tipo_curva: string
  pressao_pico: number | null
  gradiente_curva?: number | null
  curva_descricao?: string
  observacoes?: string
  curva_timpanometrica?: TimpanogramPoint[] | null
}

export interface ImitMeatoscopia {
  od_normal: boolean
  od_alterada: boolean
  od_obs: string
  oe_normal: boolean
  oe_alterada: boolean
  oe_obs: string
}

export interface ImitPrintData {
  paciente_nome: string
  paciente_cpf: string
  paciente_nascimento: string
  paciente_idade: string
  paciente_sexo: string
  data_exame: string
  especialista_nome: string
  especialista_crm?: string
  equipment_nome: string
  equipment_calibracao?: string
  encaminhado_por?: string
  observacoes?: string
  meatoscopia: ImitMeatoscopia
  tipo_curva_od: string
  tipo_curva_oe: string
  reflexos_status: string
  laudo: string
  referencias: string
  timpanometria: {
    OD?: ImitTimpData
    OE?: ImitTimpData
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

export function ImitanciometriaPrint({
  data,
  clinicSettings,
  professional,
}: {
  data: ImitPrintData
  clinicSettings?: {
    nome?: string
    endereco?: string
    telefone?: string
    email?: string
  } | null
  professional?: { name: string; crmCrfa?: string } | null
}) {
  const clinicName = clinicSettings?.nome?.trim() || CLINIC_NAME
  const clinicAddress = clinicSettings?.endereco?.trim() || CLINIC_ADDRESS
  const clinicPhone = clinicSettings?.telefone?.trim() || CLINIC_PHONE
  const clinicEmail = clinicSettings?.email?.trim() || CLINIC_EMAIL

  const profName = (
    professional?.name?.trim() ||
    data.especialista_nome ||
    SPECIALIST_PRINT
  ).toUpperCase()
  const profCrfaRaw =
    professional?.crmCrfa?.trim() || data.especialista_crm?.trim() || SPECIALIST_CRFA
  const profCrfa = profCrfaRaw.replace(/^crfa\s*/i, '')

  // ---------- estilos reutilizáveis ----------
  const sectionTitle: React.CSSProperties = {
    fontSize: '10pt',
    fontWeight: 700,
    color: NAVY,
    borderBottom: `1.2px solid ${NAVY}`,
    paddingBottom: '1px',
    marginBottom: '2px',
    marginTop: '4px',
    letterSpacing: '0.02em',
  }
  const thStyle: React.CSSProperties = {
    border: `0.6px solid ${BORDER}`,
    padding: '1.5px 3px',
    background: HEAD_BG,
    fontSize: '7.5pt',
    fontWeight: 700,
    textAlign: 'center',
    color: '#1e293b',
  }
  const tdStyle: React.CSSProperties = {
    border: `0.6px solid ${BORDER}`,
    padding: '1.5px 3px',
    fontSize: '7.5pt',
    textAlign: 'center',
    color: '#1e293b',
  }
  const tdLeft: React.CSSProperties = { ...tdStyle, textAlign: 'left' }
  const tdLabel: React.CSSProperties = {
    ...tdStyle,
    textAlign: 'left',
    fontWeight: 700,
    background: '#F8FAFC',
    width: '34%',
  }
  const fmt = (v: number | null | undefined) => (v === null || v === undefined ? '—' : String(v))

  const odTimp = data.timpanometria.OD
  const oeTimp = data.timpanometria.OE
  const odReflex = data.reflexos.OD
  const oeReflex = data.reflexos.OE

  const hasTimpData = !!(odTimp?.tipo_curva || oeTimp?.tipo_curva)

  // ---------- reflexos: valor ou status textual ----------
  const fmtReflexCell = (vals: FreqVals | undefined, freq: keyof FreqVals) => {
    if (!vals) return '—'
    const v = vals[freq]
    if (v === null || v === undefined) {
      if (vals.status === 'ausente') return 'Ausente'
      if (vals.status === 'elevado') return 'Elevado'
      if (vals.status === 'presente') return '—'
      return '—'
    }
    return String(v)
  }
  const reflexRowStatus = (vals: FreqVals | undefined) => {
    if (!vals) return '—'
    const allEmpty = [
      'frequencia_500',
      'frequencia_1000',
      'frequencia_2000',
      'frequencia_4000',
    ].every((f) => vals[f as keyof FreqVals] === null || vals[f as keyof FreqVals] === undefined)
    if (allEmpty) {
      if (vals.status === 'ausente') return 'Ausente'
      if (vals.status === 'elevado') return 'Elevado'
      if (vals.status === 'presente') return 'Não realizado'
      return 'Não realizado'
    }
    return '—'
  }

  // ---------- descrição do tipo de curva para o parecer ----------
  const describeCurva = (tipo: string, lado: string) => {
    const t = (tipo || '').trim()
    if (!t) return ''
    const base = `Curva timpanométrica à ${lado}: `
    switch (t) {
      case 'A':
        return base + 'Tipo A — mobilidade do sistema tímpano-ossicular dentro da normalidade.'
      case 'Ad':
        return (
          base +
          'Tipo Ad — hipermobilidade do sistema tímpano-ossicular, sugestiva de desarticulação ou flacidez da cadeia ossicular.'
        )
      case 'As':
        return (
          base +
          'Tipo As — redução da mobilidade do sistema tímpano-ossicular, sugestiva de otoesclerose ou fixação ossicular.'
        )
      case 'B':
        return (
          base +
          'Tipo B — curva plana, sugestiva de presença de líquido na orelha média (otite média secretora) ou perfuração timpânica.'
        )
      case 'C':
        return base + 'Tipo C — pressão negativa na orelha média, sugestiva de disfunção tubária.'
      case 'Ad/As':
        return (
          base + 'Tipo Ad/As — variabilidade de complacência, avaliar em conjunto com a clínica.'
        )
      default:
        return base + t + '.'
    }
  }

  const now = new Date()
  const emissao = now.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const encaminhado = (data.encaminhado_por || '').trim()

  return (
    <div
      className="imitanciometria-print"
      style={{
        color: '#1e293b',
        fontFamily: 'Arial, Calibri, sans-serif',
        fontSize: '7.5pt',
        lineHeight: 1.28,
      }}
    >
      {/* ===================== CABEÇALHO ===================== */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '6px',
        }}
      >
        <img
          src={logoImg}
          alt={clinicName}
          style={{ width: '5cm', maxWidth: '190px', maxHeight: '52px', objectFit: 'contain' }}
        />
        <div style={{ textAlign: 'right', fontSize: '7pt', color: '#475569', lineHeight: 1.3 }}>
          <div style={{ fontWeight: 800, color: NAVY, fontSize: '8.5pt' }}>{clinicName}</div>
          <div>{clinicAddress}</div>
          <div>
            Tel.: {clinicPhone} &nbsp;•&nbsp; {clinicEmail}
          </div>
        </div>
      </div>
      <div style={{ borderBottom: `1px solid ${NAVY}`, margin: '2px 0 4px 0' }} />

      {/* Título principal */}
      <div style={{ textAlign: 'center', marginBottom: '2px' }}>
        <div
          style={{
            fontSize: '14pt',
            fontWeight: 700,
            color: NAVY,
            letterSpacing: '0.04em',
            lineHeight: 1.1,
          }}
        >
          AVALIAÇÃO IMITANCIOMÉTRICA
        </div>
        <div style={{ fontSize: '8pt', color: '#475569', fontStyle: 'italic' }}>
          Timpanometria e Reflexos Acústicos
        </div>
      </div>

      {/* ===================== IDENTIFICAÇÃO DO PACIENTE ===================== */}
      <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: '2px' }}>
        <tbody>
          <tr>
            <td style={tdLabel}>Nome completo</td>
            <td style={tdLeft} colSpan={3}>
              {data.paciente_nome || '—'}
            </td>
            <td style={tdLabel}>Data do exame</td>
            <td style={tdLeft}>{formatDate(data.data_exame)}</td>
          </tr>
          <tr>
            <td style={tdLabel}>CPF</td>
            <td style={tdLeft}>{maskCPF(data.paciente_cpf)}</td>
            <td style={tdLabel}>Data de nascimento</td>
            <td style={tdLeft}>{formatDate(data.paciente_nascimento)}</td>
            <td style={tdLabel}>Idade</td>
            <td style={tdLeft}>{data.paciente_idade || '—'}</td>
          </tr>
          <tr>
            <td style={tdLabel}>Sexo</td>
            <td style={tdLeft}>{data.paciente_sexo || '—'}</td>
            <td style={tdLabel}>Profissional responsável</td>
            <td style={tdLeft}>{profName}</td>
            <td style={tdLabel}>CRFa</td>
            <td style={tdLeft}>{profCrfa || '—'}</td>
          </tr>
          <tr>
            <td style={tdLabel}>Equipamento</td>
            <td style={tdLeft}>{data.equipment_nome || '—'}</td>
            <td style={tdLabel}>Data da calibração</td>
            <td style={tdLeft}>{formatDate(data.equipment_calibracao)}</td>
            <td style={tdLabel}>Encaminhado por</td>
            <td style={tdLeft}>{encaminhado || '—'}</td>
          </tr>
        </tbody>
      </table>

      {/* ===================== SEÇÃO 1 — MEATOSCOPIA ===================== */}
      <div style={sectionTitle}>MEATOSCOPIA</div>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th style={thStyle}>&nbsp;</th>
            <th style={{ ...thStyle, color: '#dc2626' }}>Orelha Direita (OD)</th>
            <th style={{ ...thStyle, color: '#2563eb' }}>Orelha Esquerda (OE)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={tdLabel}>Normal</td>
            <td style={tdStyle}>
              ({data.meatoscopia.od_normal ? 'X' : ' '}) Sim &nbsp; (
              {!data.meatoscopia.od_normal ? 'X' : ' '}) Não
            </td>
            <td style={tdStyle}>
              ({data.meatoscopia.oe_normal ? 'X' : ' '}) Sim &nbsp; (
              {!data.meatoscopia.oe_normal ? 'X' : ' '}) Não
            </td>
          </tr>
          <tr>
            <td style={tdLabel}>Alterada</td>
            <td style={tdStyle}>
              ({data.meatoscopia.od_alterada ? 'X' : ' '}) Sim &nbsp; (
              {!data.meatoscopia.od_alterada ? 'X' : ' '}) Não
            </td>
            <td style={tdStyle}>
              ({data.meatoscopia.oe_alterada ? 'X' : ' '}) Sim &nbsp; (
              {!data.meatoscopia.oe_alterada ? 'X' : ' '}) Não
            </td>
          </tr>
          <tr>
            <td style={tdLabel}>Observação</td>
            <td style={tdLeft}>{data.meatoscopia.od_obs || '—'}</td>
            <td style={tdLeft}>{data.meatoscopia.oe_obs || '—'}</td>
          </tr>
        </tbody>
      </table>

      {/* ===================== SEÇÃO 2 — TIMPANOMETRIA ===================== */}
      <div style={sectionTitle}>TIMPANOMETRIA</div>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th style={thStyle}>Parâmetro</th>
            <th style={{ ...thStyle, color: '#dc2626' }}>Orelha Direita (OD)</th>
            <th style={{ ...thStyle, color: '#2563eb' }}>Orelha Esquerda (OE)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={tdLabel}>Tipo de curva</td>
            <td style={tdStyle}>{odTimp?.tipo_curva || '—'}</td>
            <td style={tdStyle}>{oeTimp?.tipo_curva || '—'}</td>
          </tr>
          <tr>
            <td style={tdLabel}>Volume do meato acústico externo (ml)</td>
            <td style={tdStyle}>{fmt(odTimp?.volume_meato)}</td>
            <td style={tdStyle}>{fmt(oeTimp?.volume_meato)}</td>
          </tr>
          <tr>
            <td style={tdLabel}>Complacência estática (ml)</td>
            <td style={tdStyle}>{fmt(odTimp?.complacencia)}</td>
            <td style={tdStyle}>{fmt(oeTimp?.complacencia)}</td>
          </tr>
          <tr>
            <td style={tdLabel}>Pressão de pico (daPa)</td>
            <td style={tdStyle}>{fmt(odTimp?.pressao_pico)}</td>
            <td style={tdStyle}>{fmt(oeTimp?.pressao_pico)}</td>
          </tr>
          <tr>
            <td style={tdLabel}>Gradiente da curva</td>
            <td style={tdStyle}>{fmt(odTimp?.gradiente_curva)}</td>
            <td style={tdStyle}>{fmt(oeTimp?.gradiente_curva)}</td>
          </tr>
          <tr>
            <td style={tdLabel}>Curva timpanométrica</td>
            <td style={tdStyle}>{odTimp?.curva_descricao || '—'}</td>
            <td style={tdStyle}>{oeTimp?.curva_descricao || '—'}</td>
          </tr>
          <tr>
            <td style={tdLabel}>Observações</td>
            <td style={tdLeft}>{odTimp?.observacoes || '—'}</td>
            <td style={tdLeft}>{oeTimp?.observacoes || '—'}</td>
          </tr>
        </tbody>
      </table>

      {/* Gráfico da timpanometria — curva timpanométrica (OD + OE sobrepostas) */}
      {hasTimpData && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginTop: '3px',
            alignItems: 'center',
            width: '100%',
          }}
        >
          <div style={{ width: '100%', maxWidth: '360px' }}>
            <TimpanogramChart
              odPoints={odTimp?.curva_timpanometrica ?? null}
              oePoints={oeTimp?.curva_timpanometrica ?? null}
              odTimp={odTimp}
              oeTimp={oeTimp}
              width={360}
              height={150}
              showTitle
              showLegend
            />
          </div>
        </div>
      )}

      {/* ===================== SEÇÃO 3 — REFLEXOS ACÚSTICOS ===================== */}
      <div style={sectionTitle}>REFLEXOS ACÚSTICOS</div>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th style={thStyle}>Orelha</th>
            <th style={thStyle}>Via</th>
            <th style={thStyle}>500 Hz</th>
            <th style={thStyle}>1.000 Hz</th>
            <th style={thStyle}>2.000 Hz</th>
            <th style={thStyle}>4.000 Hz</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ ...tdStyle, color: '#dc2626', fontWeight: 700 }} rowSpan={2}>
              OD
            </td>
            <td style={tdStyle}>Ipsilateral</td>
            <td style={tdStyle}>{fmtReflexCell(odReflex?.ipsi_lateral, 'frequencia_500')}</td>
            <td style={tdStyle}>{fmtReflexCell(odReflex?.ipsi_lateral, 'frequencia_1000')}</td>
            <td style={tdStyle}>{fmtReflexCell(odReflex?.ipsi_lateral, 'frequencia_2000')}</td>
            <td style={tdStyle}>{fmtReflexCell(odReflex?.ipsi_lateral, 'frequencia_4000')}</td>
          </tr>
          <tr>
            <td style={tdStyle}>Contralateral</td>
            <td style={tdStyle}>{fmtReflexCell(odReflex?.contra_lateral, 'frequencia_500')}</td>
            <td style={tdStyle}>{fmtReflexCell(odReflex?.contra_lateral, 'frequencia_1000')}</td>
            <td style={tdStyle}>{fmtReflexCell(odReflex?.contra_lateral, 'frequencia_2000')}</td>
            <td style={tdStyle}>{fmtReflexCell(odReflex?.contra_lateral, 'frequencia_4000')}</td>
          </tr>
          <tr>
            <td style={{ ...tdStyle, color: '#2563eb', fontWeight: 700 }} rowSpan={2}>
              OE
            </td>
            <td style={tdStyle}>Ipsilateral</td>
            <td style={tdStyle}>{fmtReflexCell(oeReflex?.ipsi_lateral, 'frequencia_500')}</td>
            <td style={tdStyle}>{fmtReflexCell(oeReflex?.ipsi_lateral, 'frequencia_1000')}</td>
            <td style={tdStyle}>{fmtReflexCell(oeReflex?.ipsi_lateral, 'frequencia_2000')}</td>
            <td style={tdStyle}>{fmtReflexCell(oeReflex?.ipsi_lateral, 'frequencia_4000')}</td>
          </tr>
          <tr>
            <td style={tdStyle}>Contralateral</td>
            <td style={tdStyle}>{fmtReflexCell(oeReflex?.contra_lateral, 'frequencia_500')}</td>
            <td style={tdStyle}>{fmtReflexCell(oeReflex?.contra_lateral, 'frequencia_1000')}</td>
            <td style={tdStyle}>{fmtReflexCell(oeReflex?.contra_lateral, 'frequencia_2000')}</td>
            <td style={tdStyle}>{fmtReflexCell(oeReflex?.contra_lateral, 'frequencia_4000')}</td>
          </tr>
        </tbody>
      </table>
      <div
        style={{
          fontSize: '6.5pt',
          color: '#64748b',
          marginTop: '1px',
          textAlign: 'justify',
          lineHeight: 1.2,
        }}
      >
        <strong>Legenda:</strong> Presente: valor em dB &nbsp;|&nbsp; Ausente: ausência de resposta
        &nbsp;|&nbsp; Elevado: reflexo presente em intensidade elevada &nbsp;|&nbsp; Não realizado:
        teste não executado. Células vazias sem valor indicam{' '}
        {reflexRowStatus(odReflex?.ipsi_lateral).toLowerCase()}.
      </div>

      {/* ===================== SEÇÃO 4 — PARECER IMITANCIOMÉTRICO ===================== */}
      <div style={sectionTitle}>PARECER IMITANCIOMÉTRICO</div>
      <div
        style={{
          fontSize: '7pt',
          color: '#475569',
          marginBottom: '1px',
        }}
      >
        <strong style={{ color: '#dc2626' }}>OD:</strong>{' '}
        {data.tipo_curva_od || odTimp?.tipo_curva || '—'} &nbsp;&nbsp;
        <strong style={{ color: '#2563eb' }}>OE:</strong>{' '}
        {data.tipo_curva_oe || oeTimp?.tipo_curva || '—'} &nbsp;&nbsp;
        <strong>Reflexos:</strong> {data.reflexos_status || '—'}
      </div>
      <div
        style={{
          fontSize: '7.5pt',
          color: '#1e293b',
          lineHeight: 1.35,
          whiteSpace: 'pre-wrap',
          border: `0.6px solid ${BORDER}`,
          padding: '3px 5px',
          background: '#FAFBFC',
          minHeight: '34px',
        }}
      >
        {data.laudo ||
          [
            describeCurva(data.tipo_curva_od || odTimp?.tipo_curva || '', 'direita'),
            describeCurva(data.tipo_curva_oe || oeTimp?.tipo_curva || '', 'esquerda'),
          ]
            .filter(Boolean)
            .join(' ') ||
          '—'}
      </div>
      {data.referencias && (
        <p
          style={{
            fontSize: '6.5pt',
            color: '#64748b',
            marginTop: '1px',
            marginBottom: '0',
            textAlign: 'justify',
            fontStyle: 'italic',
          }}
        >
          {data.referencias}
        </p>
      )}

      {/* ===================== SEÇÃO 5 — OBSERVAÇÕES ===================== */}
      <div style={sectionTitle}>OBSERVAÇÕES</div>
      {data.observacoes && data.observacoes.trim() ? (
        <div
          style={{
            fontSize: '7.5pt',
            whiteSpace: 'pre-wrap',
            border: `0.6px solid ${BORDER}`,
            padding: '3px 5px',
            background: '#FAFBFC',
            minHeight: '18px',
          }}
        >
          {data.observacoes}
        </div>
      ) : (
        <div
          style={{
            fontSize: '7.5pt',
            color: '#94a3b8',
            lineHeight: 1.5,
            marginTop: '1px',
          }}
        >
          ___________________________________________________________
          <br />
          ___________________________________________________________
        </div>
      )}

      {/* ===================== ASSINATURA ===================== */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-around',
          marginTop: '10px',
          gap: '16px',
        }}
      >
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div
            style={{
              borderTop: '1px solid #475569',
              width: '80%',
              margin: '0 auto 2px auto',
              paddingTop: '2px',
              fontSize: '7.5pt',
              fontWeight: 700,
              color: '#1e293b',
            }}
          >
            {profName}
          </div>
          <div style={{ fontSize: '6.5pt', color: '#475569' }}>
            Fonoaudiólogo {profCrfa ? `— CRFa ${profCrfa}` : ''}
          </div>
        </div>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div
            style={{
              borderTop: '1px solid #475569',
              width: '80%',
              margin: '0 auto 2px auto',
              paddingTop: '2px',
              fontSize: '7pt',
              color: '#475569',
            }}
          >
            Paciente / Responsável
          </div>
        </div>
      </div>

      {/* ===================== RODAPÉ FINAL ===================== */}
      <div
        style={{
          marginTop: '8px',
          paddingTop: '2px',
          borderTop: `0.6px solid ${BORDER}`,
          fontSize: '6.5pt',
          color: '#64748b',
          textAlign: 'center',
          lineHeight: 1.3,
        }}
      >
        {clinicName} — {clinicAddress} — Tel.: {clinicPhone}
        <br />
        Emissão: {emissao} &nbsp;•&nbsp; Página 1/1
      </div>
    </div>
  )
}
