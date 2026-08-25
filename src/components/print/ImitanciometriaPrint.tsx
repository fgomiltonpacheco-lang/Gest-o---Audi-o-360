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

export interface FuncaoTubariaStore {
  deg1?: string
  deg2?: string
  deg3?: string
  deg4?: string
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
  funcaoTubaria?: FuncaoTubariaStore
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
  // 1. Logo da clínica (puxada do sistema)
  const logoSrc = clinicSettings?.logo_url || clinicSettings?.logo || logoImg

  // 2. Endereço da clínica cadastrado no sistema
  const clinicAddress =
    clinicSettings?.endereco?.trim() ||
    [clinicSettings?.endereco, clinicSettings?.telefone, clinicSettings?.email]
      .filter(Boolean)
      .join(' • ') ||
    CLINIC_ADDRESS

  // 3. Equipamento e calibração
  const audiometer = data.equipment_nome?.trim() || clinicSettings?.audiometro?.trim() || ''
  const calibration = data.equipment_calibracao?.trim()
    ? formatDate(data.equipment_calibracao)
    : clinicSettings?.calibracao?.trim()
      ? formatDate(clinicSettings.calibracao)
      : ''

  // 4. Especialista, Especialidade e CRFa (puxar do cadastro do profissional)
  const specialistName =
    professional?.name?.trim() ||
    clinicSettings?.especialista_nome?.trim() ||
    data.especialista_nome ||
    SPECIALIST_PRINT

  const rawCrfa =
    professional?.crmCrfa?.trim() ||
    clinicSettings?.especialista_crfa?.trim() ||
    data.especialista_crm?.trim() ||
    SPECIALIST_CRFA

  const specialistCrfa = rawCrfa.replace(/^crfa\s*/i, '').trim()

  // 5. Dados do paciente
  const patientName = patient?.name || data.paciente_nome || ''
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
          : patient?.planType || data.paciente_convenio || ''

  // Timpanometria
  const odTimp = data.timpanometria.OD
  const oeTimp = data.timpanometria.OE

  const fmtNum = (v: unknown) => {
    if (v === null || v === undefined || v === '') return ''
    const str = String(v).trim().replace(',', '.')
    if (str === '' || str === '—' || str === '-') return ''
    const num = Number(str)
    if (isNaN(num)) return str
    return String(num)
  }

  // Reflexos: helper para pegar valor da reflexGrid ou da estrutura clássica
  const getReflexRow = (side: 'od' | 'oe', freq: 500 | 1000 | 2000 | 4000) => {
    const fromGrid = data.reflexGrid?.[side]?.[freq]
    if (fromGrid) {
      return {
        limiar: fromGrid.limiar || '',
        contra: fromGrid.refl_contra || '',
        ipsi: fromGrid.ipsi || '',
        dif: fromGrid.diferenca || '',
      }
    }

    const sideKey = side === 'od' ? 'OD' : 'OE'
    const freqKey = `frequencia_${freq}` as keyof FreqVals
    const contraVal = data.reflexos?.[sideKey]?.contra_lateral?.[freqKey]
    const ipsiVal = data.reflexos?.[sideKey]?.ipsi_lateral?.[freqKey]

    return {
      limiar: '',
      contra: contraVal !== null && contraVal !== undefined ? String(contraVal) : '',
      ipsi: ipsiVal !== null && ipsiVal !== undefined ? String(ipsiVal) : '',
      dif: '',
    }
  }

  const freqs = [500, 1000, 2000, 4000] as const

  const tableHeaderStyle: React.CSSProperties = {
    border: '1px solid #000000',
    padding: '2px 3px',
    fontSize: '8pt',
    fontWeight: 700,
    textAlign: 'center',
    background: '#ffffff',
    color: '#000000',
    lineHeight: 1.15,
  }

  const tableCellStyle: React.CSSProperties = {
    border: '1px solid #000000',
    padding: '2px 3px',
    fontSize: '8pt',
    textAlign: 'center',
    color: '#000000',
    lineHeight: 1.15,
    height: '18px',
  }

  const tableLabelCellStyle: React.CSSProperties = {
    border: '1px solid #000000',
    padding: '2px 4px',
    fontSize: '8pt',
    fontWeight: 500,
    textAlign: 'left',
    color: '#000000',
    lineHeight: 1.15,
    background: '#ffffff',
  }

  return (
    <div
      className="imitanciometria-print clinic-imitanciometria"
      style={{
        color: '#000000',
        fontSize: '8.5pt',
        fontFamily: 'Arial, sans-serif',
        lineHeight: 1.2,
        width: '170mm',
        maxWidth: '170mm',
        margin: '0 auto',
        padding: '0',
        boxSizing: 'border-box',
        backgroundColor: '#ffffff',
      }}
    >
      {/* 1. Cabeçalho com Logo da Clínica */}
      <div style={{ textAlign: 'center', marginBottom: '2.5mm' }}>
        <img
          src={logoSrc}
          alt="Logo da Clínica"
          style={{
            maxHeight: '52px',
            maxWidth: '220px',
            width: 'auto',
            display: 'inline-block',
            objectFit: 'contain',
          }}
        />
      </div>

      {/* 2. Dados do Paciente e Equipamento */}
      <div style={{ fontSize: '8pt', marginBottom: '2.5mm' }}>
        {/* Linha 1: Nome + Data + CPF */}
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            marginBottom: '1.5mm',
            gap: '8px',
          }}
        >
          <div style={{ flex: '1 1 50%', display: 'flex', alignItems: 'baseline' }}>
            <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>Nome:</span>
            <span
              style={{
                marginLeft: '4px',
                borderBottom: '1px solid #000000',
                flex: 1,
                paddingBottom: '1px',
                minHeight: '13px',
              }}
            >
              {patientName}
            </span>
          </div>

          <div style={{ width: '120px', display: 'flex', alignItems: 'baseline' }}>
            <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>Data</span>
            <span
              style={{
                marginLeft: '4px',
                borderBottom: '1px solid #000000',
                flex: 1,
                textAlign: 'center',
                paddingBottom: '1px',
                minHeight: '13px',
              }}
            >
              {formatDate(data.data_exame) || ''}
            </span>
          </div>

          <div style={{ width: '140px', display: 'flex', alignItems: 'baseline' }}>
            <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>CPF:</span>
            <span
              style={{
                marginLeft: '4px',
                borderBottom: '1px solid #000000',
                flex: 1,
                paddingBottom: '1px',
                minHeight: '13px',
              }}
            >
              {patientCpf ? maskCPF(patientCpf) : ''}
            </span>
          </div>
        </div>

        {/* Linha 2: DN + Sexo + Convênio */}
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            marginBottom: '1.5mm',
            gap: '8px',
          }}
        >
          <div style={{ width: '150px', display: 'flex', alignItems: 'baseline' }}>
            <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>DN:</span>
            <span
              style={{
                marginLeft: '4px',
                borderBottom: '1px solid #000000',
                flex: 1,
                textAlign: 'center',
                paddingBottom: '1px',
                minHeight: '13px',
              }}
            >
              {formatDate(patientDob) || ''}
            </span>
          </div>

          <div style={{ width: '150px', display: 'flex', alignItems: 'baseline' }}>
            <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>Sexo:</span>
            <span
              style={{
                marginLeft: '4px',
                borderBottom: '1px solid #000000',
                flex: 1,
                paddingBottom: '1px',
                minHeight: '13px',
              }}
            >
              {patientSex || ''}
            </span>
          </div>

          <div style={{ flex: 1, display: 'flex', alignItems: 'baseline' }}>
            <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>Convênio:</span>
            <span
              style={{
                marginLeft: '4px',
                borderBottom: '1px solid #000000',
                flex: 1,
                paddingBottom: '1px',
                minHeight: '13px',
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
            alignItems: 'baseline',
            gap: '8px',
          }}
        >
          <div style={{ flex: 1, display: 'flex', alignItems: 'baseline' }}>
            <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>Imitanciômetro:</span>
            <span
              style={{
                marginLeft: '4px',
                borderBottom: '1px solid #000000',
                flex: 1,
                paddingBottom: '1px',
                minHeight: '13px',
              }}
            >
              {audiometer}
            </span>
          </div>

          <div style={{ width: '220px', display: 'flex', alignItems: 'baseline' }}>
            <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>Calibração:</span>
            <span
              style={{
                marginLeft: '4px',
                borderBottom: '1px solid #000000',
                flex: 1,
                textAlign: 'center',
                paddingBottom: '1px',
                minHeight: '13px',
              }}
            >
              {calibration}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Título TIMPANOMETRIA */}
      <div
        style={{
          textAlign: 'left',
          fontSize: '9pt',
          fontWeight: 700,
          margin: '1mm 0 0.8mm 0',
          letterSpacing: '0.02em',
          textTransform: 'uppercase',
        }}
      >
        Timpanometria
      </div>

      {/* 4. Dois Gráficos de Timpanometria Lado a Lado (OD Vermelho / OE Azul) conforme referência */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          gap: '8px',
          marginBottom: '2mm',
        }}
      >
        {/* OD Box (Vermelho) */}
        <div
          style={{
            flex: '1 1 50%',
            border: '1.5px solid #dc2626',
            borderRadius: '5px',
            padding: '3px 4px 2px 4px',
            backgroundColor: '#ffffff',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ width: '100%', height: '110px' }}>
            <TimpanogramChart
              width={320}
              height={110}
              svgWidth="100%"
              svgHeight={110}
              pMin={-400}
              pMax={200}
              odPoints={odTimp?.curva_timpanometrica ?? null}
              oePoints={null}
              showLegend={false}
              showTitle={false}
            />
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '7pt',
              fontWeight: 700,
              color: '#dc2626',
              marginTop: '1px',
              padding: '0 2px',
            }}
          >
            <span>DIREITA</span>
            <span>CURVA TIPO</span>
          </div>
        </div>

        {/* OE Box (Azul) */}
        <div
          style={{
            flex: '1 1 50%',
            border: '1.5px solid #2563eb',
            borderRadius: '5px',
            padding: '3px 4px 2px 4px',
            backgroundColor: '#ffffff',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ width: '100%', height: '110px' }}>
            <TimpanogramChart
              width={320}
              height={110}
              svgWidth="100%"
              svgHeight={110}
              pMin={-400}
              pMax={200}
              odPoints={null}
              oePoints={oeTimp?.curva_timpanometrica ?? null}
              showLegend={false}
              showTitle={false}
            />
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '7pt',
              fontWeight: 700,
              color: '#2563eb',
              marginTop: '1px',
              padding: '0 2px',
            }}
          >
            <span>ESQUERDA</span>
            <span>CURVA TIPO</span>
          </div>
        </div>
      </div>

      {/* 5. Tabelas Timpanometria e Pesquisa da Função Tubária lado a lado */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'flex-start',
          marginBottom: '2mm',
        }}
      >
        {/* Tabela de Timpanometria */}
        <div style={{ flex: '1 1 62%' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              border: '1px solid #000000',
            }}
          >
            <thead>
              <tr>
                <th
                  style={{ ...tableHeaderStyle, width: '48%', borderBottom: '1px solid #000000' }}
                ></th>
                <th
                  style={{
                    ...tableHeaderStyle,
                    width: '26%',
                    color: '#dc2626',
                    fontWeight: 600,
                  }}
                >
                  Orelha Direita
                </th>
                <th
                  style={{
                    ...tableHeaderStyle,
                    width: '26%',
                    color: '#2563eb',
                    fontWeight: 600,
                  }}
                >
                  Orelha Esquerda
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tableLabelCellStyle}>Pressão</td>
                <td style={{ ...tableCellStyle, color: '#dc2626' }}>
                  {fmtNum(odTimp?.pressao_pico) ? `${fmtNum(odTimp?.pressao_pico)} daPa` : 'daPa'}
                </td>
                <td style={{ ...tableCellStyle, color: '#2563eb' }}>
                  {fmtNum(oeTimp?.pressao_pico) ? `${fmtNum(oeTimp?.pressao_pico)} daPa` : 'daPa'}
                </td>
              </tr>
              <tr>
                <td style={tableLabelCellStyle}>Máximo de Relaxamento</td>
                <td style={{ ...tableCellStyle, color: '#dc2626' }}>
                  {fmtNum(odTimp?.complacencia) ? `${fmtNum(odTimp?.complacencia)} ml` : 'ml'}
                </td>
                <td style={{ ...tableCellStyle, color: '#2563eb' }}>
                  {fmtNum(oeTimp?.complacencia) ? `${fmtNum(oeTimp?.complacencia)} ml` : 'ml'}
                </td>
              </tr>
              <tr>
                <td style={tableLabelCellStyle}>Compliância +200 daPA</td>
                <td style={{ ...tableCellStyle, color: '#dc2626' }}>
                  {fmtNum(odTimp?.volume_meato) ? `${fmtNum(odTimp?.volume_meato)} ml` : 'ml'}
                </td>
                <td style={{ ...tableCellStyle, color: '#2563eb' }}>
                  {fmtNum(oeTimp?.volume_meato) ? `${fmtNum(oeTimp?.volume_meato)} ml` : 'ml'}
                </td>
              </tr>
              <tr>
                <td style={tableLabelCellStyle}>Compliância Estática</td>
                <td style={{ ...tableCellStyle, color: '#dc2626' }}>
                  {fmtNum(odTimp?.gradiente_curva) ? `${fmtNum(odTimp?.gradiente_curva)} ml` : 'ml'}
                </td>
                <td style={{ ...tableCellStyle, color: '#2563eb' }}>
                  {fmtNum(oeTimp?.gradiente_curva) ? `${fmtNum(oeTimp?.gradiente_curva)} ml` : 'ml'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Tabela de Pesquisa da Função Tubária */}
        <div style={{ flex: '1 1 38%' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              border: '1px solid #000000',
            }}
          >
            <thead>
              <tr>
                <th
                  colSpan={2}
                  style={{
                    ...tableHeaderStyle,
                    fontWeight: 700,
                    fontSize: '8pt',
                  }}
                >
                  Pesquisa da Função Tubária
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ ...tableLabelCellStyle, width: '55%' }}>1ª deglutição</td>
                <td style={{ ...tableCellStyle, width: '45%' }}>
                  {data.funcaoTubaria?.deg1 || ''}
                </td>
              </tr>
              <tr>
                <td style={tableLabelCellStyle}>2ª deglutição</td>
                <td style={tableCellStyle}>{data.funcaoTubaria?.deg2 || ''}</td>
              </tr>
              <tr>
                <td style={tableLabelCellStyle}>3ª deglutição</td>
                <td style={tableCellStyle}>{data.funcaoTubaria?.deg3 || ''}</td>
              </tr>
              <tr>
                <td style={tableLabelCellStyle}>4ª deglutição</td>
                <td style={tableCellStyle}>{data.funcaoTubaria?.deg4 || ''}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Título Reflexos Acústico Estapedianos */}
      <h3
        style={{
          textAlign: 'center',
          fontSize: '9.5pt',
          fontWeight: 700,
          margin: '1.5mm 0 1mm 0',
          letterSpacing: '0.02em',
        }}
      >
        Reflexos Acústico Estapedianos
      </h3>

      {/* Tabela de Reflexos Acústico Estapedianos */}
      <div style={{ marginBottom: '2mm' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            border: '1px solid #000000',
          }}
        >
          <thead>
            <tr>
              <th style={{ ...tableHeaderStyle, width: '12%' }}>Freq.</th>
              <th style={{ ...tableHeaderStyle, width: '11%' }}>Limiar OD</th>
              <th style={{ ...tableHeaderStyle, width: '11%' }}>Contra</th>
              <th style={{ ...tableHeaderStyle, width: '11%' }}>Ipsi</th>
              <th style={{ ...tableHeaderStyle, width: '11%' }}>Diferença</th>
              <th style={{ ...tableHeaderStyle, width: '11%' }}>Limiar OE</th>
              <th style={{ ...tableHeaderStyle, width: '11%' }}>Contra</th>
              <th style={{ ...tableHeaderStyle, width: '11%' }}>Ipsi</th>
              <th style={{ ...tableHeaderStyle, width: '11%' }}>Diferença</th>
            </tr>
          </thead>
          <tbody>
            {freqs.map((f) => {
              const rod = getReflexRow('od', f)
              const roe = getReflexRow('oe', f)
              return (
                <tr key={`reflex-${f}`}>
                  <td style={{ ...tableCellStyle, fontWeight: 500 }}>{f}Hz</td>
                  <td style={tableCellStyle}>{rod.limiar}</td>
                  <td style={tableCellStyle}>{rod.contra}</td>
                  <td style={tableCellStyle}>{rod.ipsi}</td>
                  <td style={tableCellStyle}>{rod.dif}</td>
                  <td style={tableCellStyle}>{roe.limiar}</td>
                  <td style={tableCellStyle}>{roe.contra}</td>
                  <td style={tableCellStyle}>{roe.ipsi}</td>
                  <td style={tableCellStyle}>{roe.dif}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {/* Legendas de Sonda na OE / Sonda na OD */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '6.5pt',
            color: '#666666',
            marginTop: '1px',
            padding: '0 8%',
          }}
        >
          <span>Sonda na OE</span>
          <span>Sonda na OD</span>
        </div>
      </div>

      {/* 7. Seção de Laudo */}
      <div style={{ marginBottom: '0mm' }}>
        <div
          style={{
            fontSize: '9pt',
            fontWeight: 700,
            marginBottom: '0.8mm',
            textAlign: 'left',
          }}
        >
          Laudo
        </div>
        <div
          style={{
            border: '1px solid #000000',
            minHeight: '40px',
            padding: '1.5mm 2.5mm',
            fontSize: '8pt',
            lineHeight: 1.25,
            whiteSpace: 'pre-wrap',
            marginBottom: '1mm',
          }}
        >
          {data.laudo ||
            data.observacoes ||
            [
              data.tipo_curva_od ? `Curva OD Tipo ${data.tipo_curva_od}` : '',
              data.tipo_curva_oe ? `Curva OE Tipo ${data.tipo_curva_oe}` : '',
            ]
              .filter(Boolean)
              .join('. ')}
        </div>
        {/* Texto de referência bibliográfica */}
        <div
          style={{
            fontSize: '6.5pt',
            color: '#000000',
            textAlign: 'left',
            lineHeight: 1.2,
          }}
        >
          Laudo audiológico baseado em Lloyd e Kaplan (1978); Silman e Silverman (1997) adaptada de
          Carhart (1945) e Lloyd e Kaplan (1978); Jerger, Speaks, e Trammell (1968).
        </div>
      </div>

      {/* 8. Espaçador exato de 5 espaços de 1,5 entrelinhas (~25mm) entre a referência e a assinatura */}
      <div
        style={{
          height: '25mm',
          minHeight: '25mm',
        }}
        aria-hidden="true"
      />

      {/* 9. Assinatura do Profissional */}
      <div
        style={{
          textAlign: 'center',
          marginBottom: '2mm',
        }}
      >
        <div style={{ display: 'inline-block', minWidth: '260px' }}>
          <div style={{ borderTop: '1px solid #000000', marginBottom: '3px' }} />
          <div style={{ fontSize: '9pt', fontWeight: 700, color: '#000000' }}>
            Dr. {specialistName.replace(/^dr\.?\s*/i, '')}
          </div>
          <div style={{ fontSize: '8pt', color: '#000000' }}>Fonoaudiólogo</div>
          <div style={{ fontSize: '8pt', color: '#000000' }}>Especialista em Audiologia</div>
          <div style={{ fontSize: '8pt', color: '#000000' }}>
            (CRFa {specialistCrfa || '3-11981-5'})
          </div>
        </div>
      </div>

      {/* 10. Rodapé com Endereço da Clínica */}
      {clinicAddress && (
        <div
          style={{
            fontSize: '7.5pt',
            color: '#000000',
            textAlign: 'center',
            marginTop: '1.5mm',
          }}
        >
          {clinicAddress}
        </div>
      )}
    </div>
  )
}
export default ImitanciometriaPrint
