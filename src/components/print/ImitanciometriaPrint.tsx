import React from 'react'
import { formatDate, maskCPF } from '@/lib/formatters'
import logoImg from '@/assets/audicao-360-logo-para-papel-timbrado-da364.png'
import { TimpanogramChart, type TimpanogramPoint } from './TimpanogramChart'
import type { ClinicSettings, Patient } from '@/types'

const SPECIALIST_PRINT = 'MILTON SOARES PACHECO'
const SPECIALIST_CRFA = '3-11981-5'
const CLINIC_NAME = 'Audição360'
const CLINIC_ADDRESS = 'R. Sadoc Correa, 373 - St. Central, Araguaína - TO, 77803-060'
const CLINIC_PHONE = '(63) 3421-2611'

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
  pressao_maxima?: number | null
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

export interface ReflexGridSide {
  limiar?: string
  refl_contra?: string
  diferenca?: string
  ipsi?: string
}

export interface ImitPrintData {
  paciente_nome: string
  paciente_cpf: string
  paciente_nascimento: string
  paciente_idade: string
  paciente_sexo: string
  paciente_convenio?: string
  data_exame: string
  especialista_nome: string
  especialista_crm?: string
  equipment_nome: string
  equipment_calibracao?: string
  encaminhado_por?: string
  observacoes?: string
  meatoscopia?: ImitMeatoscopia
  tipo_curva_od: string
  tipo_curva_oe: string
  reflexos_status?: string
  laudo: string
  referencias: string
  timpanometria: {
    OD?: ImitTimpData
    OE?: ImitTimpData
  }
  reflexos?: {
    OD?: {
      contra_lateral: FreqVals
      ipsi_lateral: FreqVals
    }
    OE?: {
      contra_lateral: FreqVals
      ipsi_lateral: FreqVals
    }
  }
  reflexGrid?: {
    od?: Record<number, ReflexGridSide>
    oe?: Record<number, ReflexGridSide>
  }
}

export interface ImitanciometriaPrintProps {
  data: ImitPrintData
  patient?: Patient | null
  clinicSettings?: ClinicSettings | null
  professional?: { name: string; crmCrfa?: string } | null
}

export function ImitanciometriaPrint({
  data,
  patient,
  clinicSettings,
  professional,
}: ImitanciometriaPrintProps) {
  // 1. Logo da clínica (com fallback para logo padrão)
  const logoSrc = clinicSettings?.logo_url || clinicSettings?.logo || logoImg

  // 2. Endereço e dados da clínica
  const clinicName =
    clinicSettings?.nome_clinica?.trim() || clinicSettings?.nome?.trim() || CLINIC_NAME
  const clinicAddress =
    clinicSettings?.endereco?.trim() ||
    [clinicSettings?.endereco, clinicSettings?.telefone, clinicSettings?.email]
      .filter(Boolean)
      .join(' • ') ||
    CLINIC_ADDRESS
  const clinicPhone = clinicSettings?.telefone?.trim() || CLINIC_PHONE

  // 3. Equipamento e calibração
  const audiometer =
    data.equipment_nome?.trim() || clinicSettings?.audiometro?.trim() || 'Não informado'
  const calibration = data.equipment_calibracao?.trim()
    ? formatDate(data.equipment_calibracao)
    : clinicSettings?.calibracao?.trim() || 'Não informada'

  // 4. Especialista e CRFa
  const specialistName = (
    professional?.name?.trim() ||
    clinicSettings?.especialista_nome?.trim() ||
    data.especialista_nome ||
    SPECIALIST_PRINT
  ).toUpperCase()

  const specialistCrfa = (
    professional?.crmCrfa?.trim() ||
    clinicSettings?.especialista_crfa?.trim() ||
    data.especialista_crm?.trim() ||
    SPECIALIST_CRFA
  )
    .replace(/^crfa\s*/i, '')
    .trim()

  // 5. Dados do paciente
  const patientName = patient?.name || data.paciente_nome || '—'
  const patientCpf = patient?.cpf || data.paciente_cpf || ''
  const patientDob = patient?.birthDate || data.paciente_nascimento || ''
  const patientSex = patient?.gender || data.paciente_sexo || ''
  const patientConvenio =
    patient?.planType === 'Convênio'
      ? patient.planName || 'Convênio'
      : patient?.planType === 'SUS'
        ? 'SUS'
        : patient?.planType === 'Particular'
          ? 'Particular'
          : patient?.planType || data.paciente_convenio || 'Particular'

  const isFemale =
    patientSex === 'F' ||
    patientSex === 'Feminino' ||
    patientSex === 'f' ||
    patientSex?.toLowerCase().startsWith('f')
  const isMale =
    patientSex === 'M' ||
    patientSex === 'Masculino' ||
    patientSex === 'm' ||
    patientSex?.toLowerCase().startsWith('m')

  // Timpanometria
  const odTimp = data.timpanometria.OD
  const oeTimp = data.timpanometria.OE

  const fmtNum = (v: unknown) => {
    if (v === null || v === undefined || v === '') return '—'
    const str = String(v).trim().replace(',', '.')
    if (str === '' || str === '—' || str === '-') return '—'
    const num = Number(str)
    if (isNaN(num)) return str
    return String(num)
  }

  // Reflexos: helper para pegar valor da reflexGrid ou da estrutura clássica
  const getReflexRow = (side: 'od' | 'oe', freq: 500 | 1000 | 2000 | 4000) => {
    const fromGrid = data.reflexGrid?.[side]?.[freq]
    if (fromGrid) {
      return {
        limiar: fromGrid.limiar || '—',
        contra: fromGrid.refl_contra || '—',
        dif: fromGrid.diferenca || '—',
        ipsi: fromGrid.ipsi || '—',
      }
    }

    const sideKey = side === 'od' ? 'OD' : 'OE'
    const freqKey = `frequencia_${freq}` as keyof FreqVals
    const contraVal = data.reflexos?.[sideKey]?.contra_lateral?.[freqKey]
    const ipsiVal = data.reflexos?.[sideKey]?.ipsi_lateral?.[freqKey]

    return {
      limiar: '—',
      contra: contraVal !== null && contraVal !== undefined ? String(contraVal) : '—',
      dif: '—',
      ipsi: ipsiVal !== null && ipsiVal !== undefined ? String(ipsiVal) : '—',
    }
  }

  // Estilos bem definidos e legíveis para impressão A4 de 1 página
  const thStyle: React.CSSProperties = {
    border: '1px solid #000',
    padding: '2px 4px',
    fontSize: '7.5pt',
    fontWeight: 700,
    textAlign: 'center',
    background: '#ffffff',
    lineHeight: 1.2,
  }

  const tdStyle: React.CSSProperties = {
    border: '1px solid #000',
    padding: '2px 4px',
    fontSize: '7.5pt',
    textAlign: 'center',
    lineHeight: 1.2,
  }

  const tdHeaderStyle: React.CSSProperties = {
    border: '1px solid #000',
    padding: '2px 4px',
    fontSize: '7.5pt',
    fontWeight: 700,
    textAlign: 'left',
    background: '#ffffff',
    lineHeight: 1.2,
  }

  const thReflexStyle: React.CSSProperties = {
    border: '1px solid #000',
    padding: '1px 3px',
    fontSize: '7pt',
    fontWeight: 700,
    textAlign: 'center',
    background: '#ffffff',
    lineHeight: 1.2,
  }

  const tdReflexStyle: React.CSSProperties = {
    border: '1px solid #000',
    padding: '1px 3px',
    fontSize: '7pt',
    textAlign: 'center',
    lineHeight: 1.2,
  }

  const freqs = [500, 1000, 2000, 4000] as const

  return (
    <div
      className="imitanciometria-print audiometry-print"
      style={{
        color: '#000000',
        fontSize: '8pt',
        fontFamily: 'Arial, sans-serif',
        lineHeight: 1.3,
        maxWidth: '190mm',
        margin: '0 auto',
        padding: '0 8mm',
        boxSizing: 'border-box',
      }}
    >
      {/* 1. Logo centralizada no topo */}
      <div style={{ textAlign: 'center', marginBottom: '3mm' }}>
        <img
          src={logoSrc}
          alt={clinicName}
          style={{
            maxHeight: '45px',
            maxWidth: '180px',
            width: 'auto',
            display: 'inline-block',
            objectFit: 'contain',
          }}
        />
      </div>

      {/* 2. Cabeçalho com dados do paciente e equipamento */}
      <div style={{ fontSize: '8pt', marginBottom: '4mm' }}>
        {/* Linha 1: Nome + Data */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: '1.5mm',
          }}
        >
          <div style={{ flex: 1, marginRight: '16px', display: 'flex', alignItems: 'baseline' }}>
            <strong style={{ whiteSpace: 'nowrap' }}>Nome:</strong>
            <span
              style={{
                marginLeft: '6px',
                borderBottom: '1px solid #000',
                flex: 1,
                paddingBottom: '1px',
              }}
            >
              {patientName}
            </span>
          </div>
          <div style={{ width: '140px', display: 'flex', alignItems: 'baseline' }}>
            <strong style={{ whiteSpace: 'nowrap' }}>Data:</strong>
            <span
              style={{
                marginLeft: '6px',
                borderBottom: '1px solid #000',
                flex: 1,
                textAlign: 'center',
                paddingBottom: '1px',
              }}
            >
              {formatDate(data.data_exame) || '___/___/______'}
            </span>
          </div>
        </div>

        {/* Linha 2: CPF + DN + Sexo + Convênio */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: '1.5mm',
            flexWrap: 'wrap',
            gap: '4px 12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', minWidth: '140px' }}>
            <strong style={{ whiteSpace: 'nowrap' }}>CPF:</strong>
            <span
              style={{
                marginLeft: '6px',
                borderBottom: '1px solid #000',
                minWidth: '95px',
                paddingBottom: '1px',
              }}
            >
              {maskCPF(patientCpf) || '________________'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', minWidth: '120px' }}>
            <strong style={{ whiteSpace: 'nowrap' }}>DN:</strong>
            <span
              style={{
                marginLeft: '6px',
                borderBottom: '1px solid #000',
                minWidth: '75px',
                textAlign: 'center',
                paddingBottom: '1px',
              }}
            >
              {formatDate(patientDob) || '___/___/______'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline' }}>
            <strong>Sexo:</strong>
            <span style={{ marginLeft: '6px' }}>
              F ({isFemale ? 'X' : ' '}) &nbsp; M ({isMale ? 'X' : ' '})
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', minWidth: '130px' }}>
            <strong style={{ whiteSpace: 'nowrap' }}>Convênio:</strong>
            <span
              style={{
                marginLeft: '6px',
                borderBottom: '1px solid #000',
                minWidth: '75px',
                paddingBottom: '1px',
              }}
            >
              {patientConvenio}
            </span>
          </div>
        </div>

        {/* Linha 3: Audiômetro + Calibração */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
          }}
        >
          <div style={{ flex: 1, marginRight: '16px' }}>
            <strong>Audiômetro:</strong> <span style={{ marginLeft: '6px' }}>{audiometer}</span>
          </div>
          <div style={{ minWidth: '180px', textAlign: 'right' }}>
            <strong>Calibração:</strong> <span style={{ marginLeft: '6px' }}>{calibration}</span>
          </div>
        </div>
      </div>

      {/* Linha divisória */}
      <div style={{ borderTop: '2px solid #000', marginBottom: '2.5mm' }} />

      {/* 3. Título IMITANCIOMETRIA */}
      <h2
        style={{
          textAlign: 'center',
          fontSize: '11pt',
          fontWeight: 800,
          margin: '0 0 3mm 0',
          letterSpacing: '0.04em',
        }}
      >
        IMITANCIOMETRIA
      </h2>

      {/* 4. Gráficos Timpanométricos OD e OE lado a lado */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '3mm',
          marginBottom: '3mm',
        }}
      >
        {/* OD Box (Vermelho) */}
        <div
          style={{
            width: '48%',
            border: '1.2px solid #dc2626',
            borderRadius: '3px',
            padding: '2px 4px',
            backgroundColor: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            boxSizing: 'border-box',
          }}
        >
          <div
            className="timp-chart-wrapper"
            style={{
              width: '100%',
              height: '75px',
              overflow: 'hidden',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <TimpanogramChart
              width={260}
              height={100}
              svgWidth={260}
              svgHeight={100}
              preserveAspectRatio="none"
              odPoints={odTimp?.curva_timpanometrica ?? null}
              showLegend={false}
              showTitle={false}
            />
          </div>
          <div
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '7.5pt',
              fontWeight: 800,
              color: '#dc2626',
              marginTop: '2px',
              padding: '0 2px',
            }}
          >
            <span>DIREITA</span>
            <span>CURVA TIPO: {data.tipo_curva_od || odTimp?.tipo_curva || '—'}</span>
          </div>
        </div>

        {/* OE Box (Azul) */}
        <div
          style={{
            width: '48%',
            border: '1.2px solid #2563eb',
            borderRadius: '3px',
            padding: '2px 4px',
            backgroundColor: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            boxSizing: 'border-box',
          }}
        >
          <div
            className="timp-chart-wrapper"
            style={{
              width: '100%',
              height: '75px',
              overflow: 'hidden',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <TimpanogramChart
              width={260}
              height={100}
              svgWidth={260}
              svgHeight={100}
              preserveAspectRatio="none"
              oePoints={oeTimp?.curva_timpanometrica ?? null}
              showLegend={false}
              showTitle={false}
            />
          </div>
          <div
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '7.5pt',
              fontWeight: 800,
              color: '#2563eb',
              marginTop: '2px',
              padding: '0 2px',
            }}
          >
            <span>ESQUERDA</span>
            <span>CURVA TIPO: {data.tipo_curva_oe || oeTimp?.tipo_curva || '—'}</span>
          </div>
        </div>
      </div>

      {/* 5. Tabela de Resumo Timpanométrico (Pressão Ouvido Médio, Compliância, Volume, Gradiente) */}
      <div style={{ marginBottom: '3mm', breakInside: 'avoid', pageBreakInside: 'avoid' }}>
        <table
          style={{
            borderCollapse: 'collapse',
            width: '100%',
            border: '1.2px solid #000',
          }}
        >
          <thead>
            <tr>
              <th style={{ ...thStyle, width: '40%', textAlign: 'left', paddingLeft: '6px' }}>
                PARÂMETROS DA TIMPANOMETRIA
              </th>
              <th style={{ ...thStyle, width: '30%', color: '#dc2626' }}>DIREITA (OD)</th>
              <th style={{ ...thStyle, width: '30%', color: '#2563eb' }}>ESQUERDA (OE)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ ...tdHeaderStyle, paddingLeft: '6px' }}>PRESSÃO OUVIDO MÉDIO (daPa)</td>
              <td style={{ ...tdStyle, color: '#dc2626', fontWeight: 700 }}>
                {fmtNum(odTimp?.pressao_pico)}
              </td>
              <td style={{ ...tdStyle, color: '#2563eb', fontWeight: 700 }}>
                {fmtNum(oeTimp?.pressao_pico)}
              </td>
            </tr>
            <tr>
              <td style={{ ...tdHeaderStyle, paddingLeft: '6px' }}>COMPLIÂNCIA (ml)</td>
              <td style={{ ...tdStyle, color: '#dc2626', fontWeight: 700 }}>
                {fmtNum(odTimp?.complacencia)}
              </td>
              <td style={{ ...tdStyle, color: '#2563eb', fontWeight: 700 }}>
                {fmtNum(oeTimp?.complacencia)}
              </td>
            </tr>
            <tr>
              <td style={{ ...tdHeaderStyle, paddingLeft: '6px' }}>VOLUME (ml)</td>
              <td style={{ ...tdStyle, color: '#dc2626', fontWeight: 700 }}>
                {fmtNum(odTimp?.volume_meato)}
              </td>
              <td style={{ ...tdStyle, color: '#2563eb', fontWeight: 700 }}>
                {fmtNum(oeTimp?.volume_meato)}
              </td>
            </tr>
            <tr>
              <td style={{ ...tdHeaderStyle, paddingLeft: '6px' }}>
                GRADIENTE / COMPLIÂNCIA ESTÁTICA (ml)
              </td>
              <td style={{ ...tdStyle, color: '#dc2626', fontWeight: 700 }}>
                {fmtNum(
                  odTimp?.gradiente_curva !== null && odTimp?.gradiente_curva !== undefined
                    ? odTimp.gradiente_curva
                    : odTimp?.complacencia,
                )}
              </td>
              <td style={{ ...tdStyle, color: '#2563eb', fontWeight: 700 }}>
                {fmtNum(
                  oeTimp?.gradiente_curva !== null && oeTimp?.gradiente_curva !== undefined
                    ? oeTimp.gradiente_curva
                    : oeTimp?.complacencia,
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 6. Reflexos Acústicos (OD | Freq | OE) */}
      <div style={{ marginBottom: '3mm', breakInside: 'avoid', pageBreakInside: 'avoid' }}>
        <div
          style={{
            textAlign: 'center',
            fontSize: '8pt',
            fontWeight: 800,
            marginBottom: '1.5mm',
            marginTop: '0',
            letterSpacing: '0.03em',
          }}
        >
          REFLEXOS ACÚSTICOS
        </div>
        <div style={{ display: 'flex', gap: '2px', alignItems: 'stretch' }}>
          {/* Tabela OD (Vermelha) */}
          <div style={{ flex: 1 }}>
            <table
              style={{
                borderCollapse: 'collapse',
                width: '100%',
                border: '1.2px solid #dc2626',
              }}
            >
              <thead>
                <tr>
                  <th
                    colSpan={4}
                    style={{
                      ...thReflexStyle,
                      color: '#dc2626',
                      borderColor: '#dc2626',
                      fontSize: '7.5pt',
                    }}
                  >
                    ORELHA DIREITA (OD)
                  </th>
                </tr>
                <tr>
                  <th style={{ ...thReflexStyle, borderColor: '#dc2626', width: '25%' }}>Limiar</th>
                  <th style={{ ...thReflexStyle, borderColor: '#dc2626', width: '25%' }}>
                    Refl. Contra D
                  </th>
                  <th style={{ ...thReflexStyle, borderColor: '#dc2626', width: '25%' }}>
                    Diferença
                  </th>
                  <th style={{ ...thReflexStyle, borderColor: '#dc2626', width: '25%' }}>IPSI</th>
                </tr>
              </thead>
              <tbody>
                {freqs.map((f) => {
                  const r = getReflexRow('od', f)
                  return (
                    <tr key={`od-${f}`}>
                      <td style={{ ...tdReflexStyle, borderColor: '#dc2626' }}>{r.limiar}</td>
                      <td
                        style={{
                          ...tdReflexStyle,
                          borderColor: '#dc2626',
                          fontWeight: 700,
                          color: '#dc2626',
                        }}
                      >
                        {r.contra}
                      </td>
                      <td style={{ ...tdReflexStyle, borderColor: '#dc2626' }}>{r.dif}</td>
                      <td
                        style={{
                          ...tdReflexStyle,
                          borderColor: '#dc2626',
                          fontWeight: 700,
                          color: '#dc2626',
                        }}
                      >
                        {r.ipsi}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Coluna Central de Frequências (Hz) */}
          <div
            style={{
              width: '45px',
              border: '1.2px solid #000',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              backgroundColor: '#ffffff',
            }}
          >
            <div
              style={{
                borderBottom: '1px solid #000',
                padding: '1px 0',
                fontSize: '6.5pt',
                fontWeight: 700,
                textAlign: 'center',
                background: '#f8fafc',
              }}
            >
              Freq (Hz)
            </div>
            {freqs.map((f) => (
              <div
                key={`freq-${f}`}
                style={{
                  textAlign: 'center',
                  fontSize: '7pt',
                  fontWeight: 800,
                  padding: '1px 0',
                  color: '#1e293b',
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {f}
              </div>
            ))}
          </div>

          {/* Tabela OE (Azul) */}
          <div style={{ flex: 1 }}>
            <table
              style={{
                borderCollapse: 'collapse',
                width: '100%',
                border: '1.2px solid #2563eb',
              }}
            >
              <thead>
                <tr>
                  <th
                    colSpan={4}
                    style={{
                      ...thReflexStyle,
                      color: '#2563eb',
                      borderColor: '#2563eb',
                      fontSize: '7.5pt',
                    }}
                  >
                    ORELHA ESQUERDA (OE)
                  </th>
                </tr>
                <tr>
                  <th style={{ ...thReflexStyle, borderColor: '#2563eb', width: '25%' }}>Limiar</th>
                  <th style={{ ...thReflexStyle, borderColor: '#2563eb', width: '25%' }}>
                    Refl. Contra E
                  </th>
                  <th style={{ ...thReflexStyle, borderColor: '#2563eb', width: '25%' }}>
                    Diferença
                  </th>
                  <th style={{ ...thReflexStyle, borderColor: '#2563eb', width: '25%' }}>IPSI</th>
                </tr>
              </thead>
              <tbody>
                {freqs.map((f) => {
                  const r = getReflexRow('oe', f)
                  return (
                    <tr key={`oe-${f}`}>
                      <td style={{ ...tdReflexStyle, borderColor: '#2563eb' }}>{r.limiar}</td>
                      <td
                        style={{
                          ...tdReflexStyle,
                          borderColor: '#2563eb',
                          fontWeight: 700,
                          color: '#2563eb',
                        }}
                      >
                        {r.contra}
                      </td>
                      <td style={{ ...tdReflexStyle, borderColor: '#2563eb' }}>{r.dif}</td>
                      <td
                        style={{
                          ...tdReflexStyle,
                          borderColor: '#2563eb',
                          fontWeight: 700,
                          color: '#2563eb',
                        }}
                      >
                        {r.ipsi}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 7. Parecer Imitanciométrico / Observações */}
      <div style={{ marginBottom: '3mm' }}>
        <div
          style={{
            textAlign: 'left',
            fontSize: '8pt',
            fontWeight: 700,
            marginBottom: '1mm',
          }}
        >
          Parecer / Observação
        </div>
        <div
          style={{
            border: '1.2px solid #000',
            minHeight: '35px',
            padding: '3mm 4mm',
            fontSize: '7.5pt',
            lineHeight: 1.3,
            whiteSpace: 'pre-wrap',
            marginBottom: '1mm',
          }}
        >
          {data.observacoes ||
            data.laudo ||
            [
              data.tipo_curva_od ? `Curva OD Tipo ${data.tipo_curva_od}` : '',
              data.tipo_curva_oe ? `Curva OE Tipo ${data.tipo_curva_oe}` : '',
            ]
              .filter(Boolean)
              .join('. ') ||
            'Exame dentro dos padrões da normalidade.'}
        </div>
        {/* Referência teórica no rodapé da caixa de laudo */}
        <div
          style={{
            fontSize: '6.5pt',
            color: '#334155',
            textAlign: 'left',
            fontStyle: 'normal',
          }}
        >
          {data.referencias ||
            'Avaliação imitanciométrica baseada em Jerger (1970); Margolis e Heller (1987); Stach (1998).'}
        </div>
      </div>

      {/* 8. Assinatura do Especialista Centralizada */}
      <div
        style={{
          textAlign: 'center',
          marginTop: '5mm',
          marginBottom: '2mm',
          breakInside: 'avoid',
          pageBreakInside: 'avoid',
        }}
      >
        <div style={{ display: 'inline-block', minWidth: '220px' }}>
          <div style={{ borderTop: '1px solid #000', marginBottom: '4px' }} />
          <div style={{ fontSize: '9pt', fontWeight: 700 }}>{specialistName}</div>
          <div style={{ fontSize: '7.5pt', fontWeight: 600 }}>Fonoaudiólogo</div>
          <div style={{ fontSize: '7.5pt' }}>Especialista em Audiologia</div>
          <div style={{ fontSize: '7.5pt' }}>(CRFa {specialistCrfa || '—'})</div>
        </div>
      </div>

      {/* 9. Rodapé com Endereço da Clínica */}
      <div
        style={{
          fontSize: '7pt',
          color: '#334155',
          textAlign: 'center',
          marginTop: '4mm',
        }}
      >
        {clinicAddress}
      </div>
    </div>
  )
}

export default ImitanciometriaPrint
