import React from 'react'
import {
  Patient,
  ClinicalRecord,
  ClinicalEvolution,
  AudiometryExam,
  TympanometryExam,
  BeraExam,
  AudiometryExamFull,
  AudiogramMap,
  IprfVocalRow,
  AIR_FREQS,
  BONE_FREQS,
  ClinicSettings,
} from '@/types'
import logoImg from '@/assets/audicao-360-logo-para-papel-timbrado-da364.png'
import { formatDate, maskCPF, calculateAge } from '@/lib/formatters'
import { AudiogramaSVG } from '@/components/print/AudiogramaSVG'
import { SingleEarAudiogramChart } from '@/components/AudiogramChart'
import { mediaTritonal, mediaQuadritonal } from '@/lib/audiogram'
import { TemplateRenderer, type TemplateDataContext } from '@/components/print/TemplateRenderer'
import { getPublishedTemplate } from '@/lib/examReportTemplates'
import type { ExamReportTemplate, ExamReportTipoExame } from '@/types'

const FREQUENCIES_AIR = [
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
]
const FREQUENCIES_BONE = ['500', '1000', '2000', '3000', '4000']
const REFLEX_FREQS = ['500', '1000', '2000', '4000']

/** Frequências exibidas nas tabelas impressas. */
const PRINT_AIR_FREQS = [
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
]

const sectionTitle = (text: string) => (
  <h3
    style={{
      fontSize: '11pt',
      fontWeight: 700,
      color: '#0F2B5C',
      borderBottom: '1.5px solid #cbd5e1',
      paddingBottom: '3px',
      marginTop: '14px',
      marginBottom: '6px',
    }}
  >
    {text}
  </h3>
)

const row = (label: string, value: React.ReactNode) => (
  <div style={{ display: 'flex', padding: '2px 0', fontSize: '9pt' }}>
    <span style={{ width: '38%', color: '#64748b', fontWeight: 600 }}>{label}:</span>
    <span style={{ flex: 1, color: '#1e293b', fontWeight: 500 }}>{value || '—'}</span>
  </div>
)

const grid2 = (children: React.ReactNode) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px' }}>{children}</div>
)

/* ============ FICHA COMPLETA DO PACIENTE ============ */
export function PatientFichaPrint({
  patient,
  record,
  evolutions,
}: {
  patient: Patient
  record: ClinicalRecord | null
  evolutions: ClinicalEvolution[]
}) {
  const age = calculateAge(patient.birthDate)
  return (
    <div>
      {/* Identificação resumida */}
      <div
        style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '6px',
          padding: '10px 12px',
          marginBottom: '14px',
        }}
      >
        <div style={{ fontSize: '13pt', fontWeight: 800, color: '#0f172a' }}>{patient.name}</div>
        <div style={{ fontSize: '9pt', color: '#64748b' }}>
          ID: {patient.id} • {age ? `${age} anos` : 'Idade N/I'} • {patient.gender} •{' '}
          {patient.status}
        </div>
      </div>

      {sectionTitle('Dados Cadastrais')}
      {grid2(
        <>
          {row('CPF', maskCPF(patient.cpf))}
          {row('Nascimento', formatDate(patient.birthDate))}
          {row('Sexo', patient.gender)}
          {row('Celular', patient.mobile)}
          {row('Telefone', patient.phone)}
          {row('E-mail', patient.email)}
          {row(
            'Endereço',
            [
              patient.street ? `${patient.street}, ${patient.number}` : '',
              patient.complement,
              patient.neighborhood,
              patient.city && patient.state ? `${patient.city}/${patient.state}` : '',
              patient.cep,
            ]
              .filter(Boolean)
              .join(' — '),
          )}
          {row(
            'Convênio',
            patient.planType === 'Convênio'
              ? patient.planName || 'Convênio'
              : patient.planType === 'SUS'
                ? 'SUS'
                : 'Particular',
          )}
          {row('Cadastrado em', formatDate(patient.createdAt))}
          {row('Última visita', formatDate(patient.lastVisit))}
        </>,
      )}

      {patient.hasResponsible && patient.responsible && (
        <>
          {sectionTitle('Responsável Financeiro')}
          {grid2(
            <>
              {row('Nome', patient.responsible.name)}
              {row('Parentesco', patient.responsible.relationship)}
              {row('CPF', maskCPF(patient.responsible.cpf))}
              {row('Telefone', patient.responsible.phone)}
            </>,
          )}
        </>
      )}

      {sectionTitle('Histórico Auditivo')}
      {grid2(
        <>
          {row('Tipo de perda', patient.hearingLossType)}
          {row('Aparelho anterior', patient.previousHearingAid ? 'Sim' : 'Não')}
          {row('Marca anterior', patient.previousAidBrand)}
          {row('Modelo anterior', patient.previousAidModel)}
        </>,
      )}
      {patient.generalNotes && (
        <div style={{ fontSize: '9pt', marginTop: '6px', color: '#334155' }}>
          <strong style={{ color: '#64748b' }}>Observações: </strong>
          {patient.generalNotes}
        </div>
      )}

      {sectionTitle('Prontuário Clínico')}
      {record ? (
        <div
          style={{
            fontSize: '9pt',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '4px 24px',
          }}
        >
          {row('Queixa principal', record.mainComplaint)}
          {row('Anamnese', record.anamnesis)}
          {row('Histórico auditivo', record.hearingHistory)}
          {row('Medicações em uso', record.currentMedications)}
          {row('Antecedentes familiares', record.familyHistory)}
          {row('Diagnóstico', record.diagnosis)}
          {row('Conduta', record.conduct)}
          {row('Próximo retorno', formatDate(record.nextReturn))}
        </div>
      ) : (
        <p style={{ fontSize: '9pt', color: '#94a3b8', fontStyle: 'italic' }}>
          Nenhum prontuário clínico registrado.
        </p>
      )}

      {sectionTitle('Evoluções Clínicas')}
      {evolutions.length === 0 ? (
        <p style={{ fontSize: '9pt', color: '#94a3b8', fontStyle: 'italic' }}>
          Nenhuma evolução registrada.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {evolutions.map((evo, i) => (
            <div
              key={evo.id}
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                padding: '8px 10px',
                breakInside: 'avoid',
              }}
            >
              <div style={{ fontSize: '9pt', fontWeight: 700, color: '#0F2B5C' }}>
                {i + 1}. {formatDate(evo.date)} — {evo.professionalName}
              </div>
              <div style={{ fontSize: '9pt', color: '#334155', marginTop: '2px' }}>
                {evo.description}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ============ AUDIOMETRIA LEGADA ============ */
export function AudiometryPrint({ exam }: { exam: AudiometryExam }) {
  const mapAirMap = (raw?: Record<string, number | null | 'NR'>): AudiogramMap => {
    const res: AudiogramMap = {}
    FREQUENCIES_AIR.forEach((f) => {
      const v = raw?.[f]
      if (v === 'NR') res[f] = { db: 120, symbol: 'no_response' }
      else if (typeof v === 'number') res[f] = { db: v, symbol: 'normal' }
      else res[f] = { db: null, symbol: 'normal' }
    })
    return res
  }

  const mapBoneMap = (raw?: Record<string, number | null | 'NR'>): AudiogramMap => {
    const res: AudiogramMap = {}
    FREQUENCIES_BONE.forEach((f) => {
      const v = raw?.[f]
      if (v === 'NR') res[f] = { db: 120, symbol: 'no_response' }
      else if (typeof v === 'number') res[f] = { db: v, symbol: 'normal' }
      else res[f] = { db: null, symbol: 'normal' }
    })
    return res
  }

  const fullExam: AudiometryExamFull = {
    id: exam.id,
    patientId: exam.patientId,
    patientName: exam.patientName,
    created_by: '',
    date: exam.date,
    cpf: '',
    dob: '',
    age: '',
    sex: '',
    referred_by: '',
    hearing_rest_14h: false,
    audiometer: '',
    calibration: '',
    otoscopy_od: '',
    otoscopy_od_obs: '',
    otoscopy_oe: '',
    otoscopy_oe_obs: '',
    air_od: mapAirMap(exam.airOD),
    air_oe: mapAirMap(exam.airOE),
    bone_od: mapBoneMap(exam.boneOD),
    bone_oe: mapBoneMap(exam.boneOE),
    ldl_od: {},
    ldl_oe: {},
    mt_od: null,
    mt_oe: null,
    lrf_od: exam.srtOD ?? null,
    lrf_oe: exam.srtOE ?? null,
    ldv_od: null,
    ldv_oe: null,
    iprf: {
      od: {
        intensidade: '',
        monossilabos: String(exam.iprfOD ?? ''),
        dissilabos: '',
        mascaramento: '',
        palavras: '',
      },
      oe: {
        intensidade: '',
        monossilabos: String(exam.iprfOE ?? ''),
        dissilabos: '',
        mascaramento: '',
        palavras: '',
      },
    },
    iprf_od: exam.iprfOD ?? null,
    iprf_oe: exam.iprfOE ?? null,
    iprf_vocal: {
      od: {
        intensidade: '',
        monossilabos: String(exam.iprfOD ?? ''),
        dissilabos: '',
        mascaramento: '',
        palavras_faladas: '',
        niveis: '',
      },
      oe: {
        intensidade: '',
        monossilabos: String(exam.iprfOE ?? ''),
        dissilabos: '',
        mascaramento: '',
        palavras_faladas: '',
        niveis: '',
      },
    },
    iprf_levels_od: '',
    iprf_levels_oe: '',
    srt_od: exam.srtOD ?? null,
    srt_oe: exam.srtOE ?? null,
    masking_air_od: null,
    masking_air_oe: null,
    masking_bone_od: null,
    masking_bone_oe: null,
    meatoscopy_od: '',
    meatoscopy_oe: '',
    marital_status: '',
    loss_degree: exam.lossDegree || '',
    loss_type: exam.lossType || '',
    loss_configuration: '',
    report: exam.notes || '',
    created: '',
    updated: '',
  }

  return <AudiometriaFullPrint exam={fullExam} />
}

export const AudiometriaPrint = AudiometryPrint

/* ============ AUDIOMETRIA COMPLETA (audiometry_exams) ============ */
/* Layout compacto para caber em 1 página A4 — segue o modelo clínico de referência. */
const SPECIALIST_PRINT = 'MILTON SOARES PACHECO'
const SPECIALIST_CRFA = '3-11981-5'
const CLINIC_NAME = 'Audição360'
const CLINIC_ADDRESS = 'R. Sadoc Correa, 373 - St. Central, Araguaína - TO, 77803-060'
const CLINIC_PHONE = '(63) 3421-2611'
const REPORT_REFERENCE =
  'Lloyd e Kaplan (1978); Silman e Silverman (1997) adaptada de Carhart (1945) e Lloyd e Kaplan (1978); Jerger, Speaks, e Trammell (1968).'

const emptyIprfVocalRow = (): IprfVocalRow => ({
  intensidade: '',
  monossilabos: '',
  dissilabos: '',
  mascaramento: '',
  palavras_faladas: '',
  niveis: '',
})

export function AudiometriaFullPrint({
  exam,
  clinicSettings,
  professional,
}: {
  exam: AudiometryExamFull
  clinicSettings?: ClinicSettings | null
  professional?: { name: string; crmCrfa?: string } | null
}) {
  const clinicAddress = clinicSettings?.endereco?.trim() || CLINIC_ADDRESS

  const thStyle: React.CSSProperties = {
    border: '1px solid #000',
    padding: '2px 4px',
    fontSize: '7.5pt',
    fontWeight: 700,
    textAlign: 'center',
    background: '#ffffff',
  }

  const tdStyle: React.CSSProperties = {
    border: '1px solid #000',
    padding: '2px 4px',
    fontSize: '7.5pt',
    textAlign: 'center',
  }

  const odVocal = exam.iprf_vocal?.od ?? emptyIprfVocalRow()
  const oeVocal = exam.iprf_vocal?.oe ?? emptyIprfVocalRow()

  const formatDbVal = (val: number | null | undefined, fallbackStr?: string) => {
    if (val === -1) {
      return 'AUS'
    }
    if (val === 0) {
      return '0 dB'
    }
    if (val !== null && val !== undefined && val !== ('' as any)) {
      return `${val} dB`
    }
    if (fallbackStr && fallbackStr.trim() !== '') {
      return fallbackStr.includes('dB') ? fallbackStr : `${fallbackStr} dB`
    }
    return '___ dB'
  }

  // MT (Média Tritonal) é calculada automaticamente a partir do mapa aéreo
  // quando não estiver explicitamente preenchida no exame.
  const mtOD = exam.mt_od || mediaTritonal(exam.air_od)
  const mtOE = exam.mt_oe || mediaTritonal(exam.air_oe)

  const mtODStr = formatDbVal(mtOD)
  const lrfODStr = formatDbVal(exam.lrf_od || exam.srt_od)
  const ldvODStr = formatDbVal(exam.ldv_od)

  const mtOEStr = formatDbVal(mtOE)
  const lrfOEStr = formatDbVal(exam.lrf_oe || exam.srt_oe)
  const ldvOEStr = formatDbVal(exam.ldv_oe)

  const formatIprfIntens = (val?: string) => (val && val.trim() ? `${val} dB` : '-')
  const formatIprfPct = (val?: string) => (val && val.trim() ? `${val} %` : '%')
  const formatIprfMasc = (val?: string) => (val && val.trim() ? `${val} dB` : 'dB')
  const formatIprfPal = (val?: string) => (val && val.trim() ? val : '-')

  const isFemale = exam.sex === 'F' || exam.sex === 'Feminino' || exam.sex === 'f'
  const isMale = exam.sex === 'M' || exam.sex === 'Masculino' || exam.sex === 'm'

  return (
    <div
      className="audiometry-print audiometry-print-dr-adriano"
      style={{
        color: '#000000',
        fontSize: '8.5pt',
        fontFamily: 'Arial, sans-serif',
        lineHeight: 1.3,
        maxWidth: '190mm',
        margin: '0 auto',
        padding: '2mm',
      }}
    >
      {/* 1. Logo "Audição 360" centralizada no topo */}
      <div style={{ textAlign: 'center', marginBottom: '8px' }}>
        <img
          src={logoImg}
          alt="Audição 360 Centro Auditivo"
          style={{ maxHeight: '60px', width: 'auto', display: 'inline-block' }}
        />
      </div>

      {/* 2. Cabeçalho com Nome, Data, CPF, DN, Sexo, Audiômetro e Calibração */}
      <div style={{ fontSize: '8.5pt', marginBottom: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <div style={{ flex: 1, borderBottom: '1px solid #000', marginRight: '16px' }}>
            <strong>Nome:</strong> {exam.patientName || ''}
          </div>
          <div style={{ width: '150px' }}>
            <strong>Data</strong> {formatDate(exam.date) || '___/___/______'}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <div style={{ flex: 1, display: 'flex', gap: '20px' }}>
            <div>
              <strong>CPF:</strong> {maskCPF(exam.cpf) || '___________________'}
            </div>
            <div>
              <strong>DN:</strong> {formatDate(exam.dob) || '___/___/______'}
            </div>
          </div>
          <div style={{ width: '150px' }}>
            <strong>Sexo:</strong> F ({isFemale ? 'X' : ' '}) &nbsp; M ({isMale ? 'X' : ' '})
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ flex: 1 }}>
            <strong>Audiômetro:</strong> {exam.audiometer || 'do sistema'}
          </div>
          <div style={{ width: '150px' }}>
            <strong>Calibração:</strong> {formatDate(exam.calibration) || 'do sistema'}
          </div>
        </div>
      </div>

      {/* Linha dupla superior separadora do cabeçalho */}
      <div style={{ borderTop: '2.5px solid #000', marginBottom: '10px' }} />

      {/* 3. Título AUDIOMETRIA centralizado */}
      <h2
        style={{
          textAlign: 'center',
          fontSize: '11pt',
          fontWeight: 800,
          margin: '0 0 10px 0',
          letterSpacing: '0.05em',
        }}
      >
        AUDIOMETRIA
      </h2>

      {/* 4. Dois audiogramas gráficos LADO A LADO: Orelha Direita (vermelho) e Orelha Esquerda (azul) */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '6px',
        }}
      >
        {/* OD */}
        <div style={{ flex: 1, textAlign: 'center' }}>
          <SingleEarAudiogramChart
            side="OD"
            title="Orelha Direita"
            air={exam.air_od}
            bone={exam.bone_od}
            ldl={exam.ldl_od}
            compact
            hideLegend
          />
          {/* 5. Abaixo de cada gráfico: MT, LRF, LDV em vermelho */}
          <div style={{ fontSize: '8.5pt', fontWeight: 700, marginTop: '4px', color: '#dc2626' }}>
            MT: <span style={{ textDecoration: 'underline' }}>{mtODStr}</span> &nbsp;&nbsp;&nbsp;
            LRF: <span style={{ textDecoration: 'underline' }}>{lrfODStr}</span> &nbsp;&nbsp;&nbsp;
            LDV: <span style={{ textDecoration: 'underline' }}>{ldvODStr}</span>
          </div>
        </div>

        {/* OE */}
        <div style={{ flex: 1, textAlign: 'center' }}>
          <SingleEarAudiogramChart
            side="OE"
            title="Orelha Esquerda"
            air={exam.air_oe}
            bone={exam.bone_oe}
            ldl={exam.ldl_oe}
            compact
            hideLegend
          />
          {/* 5. Abaixo de cada gráfico: MT, LRF, LDV em azul */}
          <div style={{ fontSize: '8.5pt', fontWeight: 700, marginTop: '4px', color: '#2563eb' }}>
            MT: <span style={{ textDecoration: 'underline' }}>{mtOEStr}</span> &nbsp;&nbsp;&nbsp;
            LRF: <span style={{ textDecoration: 'underline' }}>{lrfOEStr}</span> &nbsp;&nbsp;&nbsp;
            LDV: <span style={{ textDecoration: 'underline' }}>{ldvOEStr}</span>
          </div>
        </div>
      </div>

      {/* 6. Tabela IPRF (Índice de Reconhecimento de Fala) */}
      <div style={{ marginTop: '12px', marginBottom: '14px' }}>
        <div
          style={{ textAlign: 'center', fontSize: '8.5pt', fontWeight: 700, marginBottom: '2px' }}
        >
          Índice de Reconhecimento de Fala
        </div>
        <table
          style={{
            borderCollapse: 'collapse',
            width: '62%',
            margin: '0 auto',
            border: '1.5px solid #000',
          }}
        >
          <thead>
            <tr>
              <th style={{ ...thStyle, width: '22%' }}>-</th>
              <th style={{ ...thStyle, width: '18%' }}>Intensid.</th>
              <th style={{ ...thStyle, width: '20%' }}>Monossíl.</th>
              <th style={{ ...thStyle, width: '20%' }}>Dissíl.</th>
              <th style={{ ...thStyle, width: '20%' }}>Masc.</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ ...tdStyle, fontWeight: 600 }}>Pal. Faladas</td>
              <td style={tdStyle}>{formatIprfPal(odVocal.palavras_faladas)}</td>
              <td style={tdStyle}>{formatIprfPal(odVocal.palavras_faladas)}</td>
              <td style={tdStyle}>{formatIprfPal(odVocal.palavras_faladas)}</td>
              <td style={tdStyle}>-</td>
            </tr>
            <tr>
              <td style={{ ...tdStyle, color: '#dc2626', fontWeight: 700 }}>OD</td>
              <td style={{ ...tdStyle, color: '#dc2626', fontWeight: 700 }}>
                {formatIprfIntens(odVocal.intensidade)}
              </td>
              <td style={{ ...tdStyle, color: '#dc2626', fontWeight: 700 }}>
                {formatIprfPct(odVocal.monossilabos)}
              </td>
              <td style={{ ...tdStyle, color: '#dc2626', fontWeight: 700 }}>
                {formatIprfPct(odVocal.dissilabos)}
              </td>
              <td style={{ ...tdStyle, color: '#2563eb', fontWeight: 700 }}>
                {formatIprfMasc(odVocal.mascaramento)}
              </td>
            </tr>
            <tr>
              <td style={{ ...tdStyle, color: '#2563eb', fontWeight: 700 }}>OE</td>
              <td style={{ ...tdStyle, color: '#2563eb', fontWeight: 700 }}>
                {formatIprfIntens(oeVocal.intensidade)}
              </td>
              <td style={{ ...tdStyle, color: '#2563eb', fontWeight: 700 }}>
                {formatIprfPct(oeVocal.monossilabos)}
              </td>
              <td style={{ ...tdStyle, color: '#2563eb', fontWeight: 700 }}>
                {formatIprfPct(oeVocal.dissilabos)}
              </td>
              <td style={{ ...tdStyle, color: '#dc2626', fontWeight: 700 }}>
                {formatIprfMasc(oeVocal.mascaramento)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 7. Seção Parecer Audiológico com linhas horizontais e texto de referência padrão */}
      <div style={{ marginTop: '10px', marginBottom: '20px' }}>
        <div style={{ textAlign: 'center', fontSize: '9pt', fontWeight: 700, marginBottom: '6px' }}>
          Parecer Audiológico
        </div>

        {/* Texto do laudo renderizado sobre/com linhas horizontais */}
        <div style={{ position: 'relative', minHeight: '80px', marginBottom: '4px' }}>
          {/* Linhas de caderno de fundo */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundImage: 'linear-gradient(to bottom, #000 1px, transparent 1px)',
              backgroundSize: '100% 20px',
              zIndex: 1,
            }}
          />
          <div
            style={{
              position: 'relative',
              zIndex: 2,
              lineHeight: '20px',
              fontSize: '8.5pt',
              paddingTop: '2px',
              whiteSpace: 'pre-wrap',
            }}
          >
            {exam.report || ''}
          </div>
        </div>

        {/* Texto de referência padrão no rodapé da seção */}
        <div
          style={{
            fontSize: '5.5pt',
            color: '#000000',
            textAlign: 'justify',
            fontStyle: 'italic',
            marginTop: '4px',
          }}
        >
          {REPORT_REFERENCE}
        </div>
      </div>

      {/* 8. Assinaturas no rodapé: "Fonoaudiólogo" e "Cliente" */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '35px',
          marginBottom: '20px',
          padding: '0 20px',
        }}
      >
        <div style={{ width: '220px', textAlign: 'center' }}>
          <div style={{ borderTop: '1px solid #000', paddingTop: '3px', fontSize: '8pt' }}>
            Fonoaudiólogo
          </div>
        </div>
        <div style={{ width: '220px', textAlign: 'center' }}>
          <div style={{ borderTop: '1px solid #000', paddingTop: '3px', fontSize: '8pt' }}>
            Cliente
          </div>
        </div>
      </div>

      {/* 9. Rodapé final com o endereço da clínica cadastrado */}
      <div
        style={{
          fontSize: '7.5pt',
          color: '#000000',
          textAlign: 'center',
          marginTop: '15px',
        }}
      >
        {clinicAddress}
      </div>
    </div>
  )
}

/* ============ INTEGRAÇÃO: MODELOS DE LAUDO CONFIGURÁVEIS ============ */

/**
 * Busca o modelo publicado para o tipo de exame. Retorna null se não houver
 * modelo publicado — nesse caso o chamador deve usar o layout padrão (fallback).
 *
 * Uso:
 *   const tpl = await getActiveTemplate('audiometria')
 *   if (tpl) { usar TemplateRenderer } else { usar AudiometriaFullPrint }
 */
export async function getActiveTemplate(
  tipoExame: ExamReportTipoExame,
): Promise<ExamReportTemplate | null> {
  try {
    return await getPublishedTemplate(tipoExame)
  } catch {
    return null
  }
}

/**
 * Constrói um TemplateDataContext a partir de dados de audiometria.
 * Permite usar o TemplateRenderer com exames reais do banco.
 */
export function buildAudiometryContext(args: {
  patientName?: string
  patientCpf?: string
  patientBirthDate?: string
  patientSex?: string
  patientPhone?: string
  examDate?: string
  professionalName?: string
  professionalCrfa?: string
  exam: Record<string, unknown>
  clinicName?: string
  clinicAddress?: string
  clinicPhone?: string
  clinicEmail?: string
}): TemplateDataContext {
  return {
    paciente: {
      nome: args.patientName,
      cpf: args.patientCpf,
      data_nascimento: args.patientBirthDate,
      sexo: args.patientSex,
      telefone: args.patientPhone,
    },
    exame: {
      ...args.exam,
      data: args.examDate,
    },
    profissional: {
      nome: args.professionalName,
      crfa: args.professionalCrfa,
    },
    clinica: {
      nome: args.clinicName,
      endereco: args.clinicAddress,
      telefone: args.clinicPhone,
      email: args.clinicEmail,
    },
  }
}

/**
 * Renderiza o laudo usando o template ativo (se houver) ou um fallback.
 * Retorna o nó React a ser impresso.
 */
export async function renderExamReport(args: {
  tipoExame: ExamReportTipoExame
  context: TemplateDataContext
  fallback: React.ReactNode
}): Promise<React.ReactNode> {
  const tpl = await getActiveTemplate(args.tipoExame)
  if (tpl) {
    return <TemplateRenderer template={tpl} data={args.context} scale={1} />
  }
  return args.fallback
}

/**
 * Constrói um TemplateDataContext a partir de dados de imitanciometria.
 * Permite usar o TemplateRenderer com exames reais do banco, mantendo
 * compatibilidade com a estrutura de dados usada pelo ImitanciometriaPrint.
 */
export function buildImitanciometriaContext(args: {
  patientName?: string
  patientCpf?: string
  patientBirthDate?: string
  patientAge?: string
  patientSex?: string
  examDate?: string
  professionalName?: string
  professionalCrfa?: string
  exam: Record<string, unknown>
  clinicName?: string
  clinicAddress?: string
  clinicPhone?: string
  clinicEmail?: string
}): TemplateDataContext {
  return {
    paciente: {
      nome: args.patientName,
      cpf: args.patientCpf,
      data_nascimento: args.patientBirthDate,
      idade: args.patientAge,
      sexo: args.patientSex,
    },
    exame: {
      ...args.exam,
      data: args.examDate,
    },
    profissional: {
      nome: args.professionalName,
      crfa: args.professionalCrfa,
    },
    clinica: {
      nome: args.clinicName,
      endereco: args.clinicAddress,
      telefone: args.clinicPhone,
      email: args.clinicEmail,
    },
  }
}

/* ============ IMITANCIOMETRIA ============ */
export function TympanometryPrint({ exam }: { exam: TympanometryExam }) {
  return (
    <div>
      <div style={{ fontSize: '9pt', color: '#475569', marginBottom: '10px' }}>
        <strong>Paciente:</strong> {exam.patientName} &nbsp;|&nbsp; <strong>Data:</strong>{' '}
        {formatDate(exam.date)} &nbsp;|&nbsp; <strong>Examinador:</strong> {exam.professionalName}
      </div>

      {sectionTitle('Curvas Timpanométricas')}
      <table>
        <thead>
          <tr>
            <th>Orelha</th>
            <th>Curva</th>
            <th>Compl. (ml)</th>
            <th>Pressão (daPa)</th>
            <th>Volume (ml)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ color: '#dc2626', fontWeight: 700 }}>OD</td>
            <td>Tipo {exam.tympanometryOD.curve}</td>
            <td>{exam.tympanometryOD.compliance}</td>
            <td>{exam.tympanometryOD.pressure}</td>
            <td>{exam.tympanometryOD.volume}</td>
          </tr>
          <tr>
            <td style={{ color: '#2563eb', fontWeight: 700 }}>OE</td>
            <td>Tipo {exam.tympanometryOE.curve}</td>
            <td>{exam.tympanometryOE.compliance}</td>
            <td>{exam.tympanometryOE.pressure}</td>
            <td>{exam.tympanometryOE.volume}</td>
          </tr>
        </tbody>
      </table>

      {sectionTitle('Reflexos Estapédicos')}
      <table>
        <thead>
          <tr>
            <th>Orelha</th>
            {REFLEX_FREQS.map((f) => (
              <th key={f} style={{ textAlign: 'center' }}>
                {Number(f) >= 1000 ? `${Number(f) / 1000}k` : f}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ color: '#dc2626', fontWeight: 700 }}>OD</td>
            {REFLEX_FREQS.map((f) => (
              <td key={f} style={{ textAlign: 'center' }}>
                {exam.reflexesOD?.[f] ?? '—'}
              </td>
            ))}
          </tr>
          <tr>
            <td style={{ color: '#2563eb', fontWeight: 700 }}>OE</td>
            {REFLEX_FREQS.map((f) => (
              <td key={f} style={{ textAlign: 'center' }}>
                {exam.reflexesOE?.[f] ?? '—'}
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      {sectionTitle('Conclusão')}
      <div style={{ fontSize: '9pt', color: '#334155' }}>{exam.conclusion}</div>
      {exam.notes && (
        <div style={{ fontSize: '9pt', marginTop: '6px', color: '#334155' }}>
          <strong style={{ color: '#64748b' }}>Observações: </strong>
          {exam.notes}
        </div>
      )}
    </div>
  )
}

/* ============ BERA / PEATE ============ */
export function BeraPrint({ exam }: { exam: BeraExam }) {
  const w = (waves: BeraExam['od']) => (
    <>
      <td style={{ textAlign: 'center' }}>{waves.waveI ?? '—'}</td>
      <td style={{ textAlign: 'center' }}>{waves.waveIII ?? '—'}</td>
      <td style={{ textAlign: 'center' }}>{waves.waveV ?? '—'}</td>
      <td style={{ textAlign: 'center' }}>{waves.interI_III ?? '—'}</td>
      <td style={{ textAlign: 'center' }}>{waves.interIII_V ?? '—'}</td>
      <td style={{ textAlign: 'center' }}>{waves.interI_V ?? '—'}</td>
      <td style={{ textAlign: 'center' }}>{waves.threshold ?? '—'}</td>
    </>
  )
  return (
    <div>
      <div style={{ fontSize: '9pt', color: '#475569', marginBottom: '10px' }}>
        <strong>Paciente:</strong> {exam.patientName} &nbsp;|&nbsp; <strong>Data:</strong>{' '}
        {formatDate(exam.date)} &nbsp;|&nbsp; <strong>Examinador:</strong> {exam.professionalName}
      </div>

      {sectionTitle('Latências das Ondas e Intervalos Interpicos')}
      <table>
        <thead>
          <tr>
            <th rowSpan={2}>Orelha</th>
            <th colSpan={3} style={{ textAlign: 'center' }}>
              Latências (ms)
            </th>
            <th colSpan={3} style={{ textAlign: 'center' }}>
              Intervalos (ms)
            </th>
            <th rowSpan={2} style={{ textAlign: 'center' }}>
              Limiar (dBnHL)
            </th>
          </tr>
          <tr>
            <th style={{ textAlign: 'center' }}>I</th>
            <th style={{ textAlign: 'center' }}>III</th>
            <th style={{ textAlign: 'center' }}>V</th>
            <th style={{ textAlign: 'center' }}>I-III</th>
            <th style={{ textAlign: 'center' }}>III-V</th>
            <th style={{ textAlign: 'center' }}>I-V</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ color: '#dc2626', fontWeight: 700 }}>OD</td>
            {w(exam.od)}
          </tr>
          <tr>
            <td style={{ color: '#2563eb', fontWeight: 700 }}>OE</td>
            {w(exam.oe)}
          </tr>
        </tbody>
      </table>

      {sectionTitle('Conclusão')}
      <div style={{ fontSize: '9pt' }}>
        <strong>Classificação:</strong>{' '}
        <span
          style={{
            color: exam.classification === 'Normal' ? '#10b981' : '#ef4444',
            fontWeight: 700,
          }}
        >
          {exam.classification}
        </span>
      </div>
      {exam.notes && (
        <div style={{ fontSize: '9pt', marginTop: '6px', color: '#334155' }}>
          <strong style={{ color: '#64748b' }}>Observações: </strong>
          {exam.notes}
        </div>
      )}
    </div>
  )
}

/* ============ RELATÓRIO (dados tabulares) ============ */
export function RelatorioPrint({
  periodLabel,
  sections,
}: {
  periodLabel: string
  sections: { title: string; columns: string[]; rows: (string | number)[][] }[]
}) {
  return (
    <div>
      <div style={{ fontSize: '9pt', color: '#475569', marginBottom: '12px' }}>
        <strong>Período:</strong> {periodLabel}
      </div>
      {sections.map((sec, i) => (
        <div key={i} style={{ marginBottom: '16px', breakInside: 'avoid' }}>
          {sectionTitle(sec.title)}
          <table>
            <thead>
              <tr>
                {sec.columns.map((col) => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sec.rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={sec.columns.length}
                    style={{ textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}
                  >
                    Sem registros no período.
                  </td>
                </tr>
              ) : (
                sec.rows.map((r, ri) => (
                  <tr key={ri}>
                    {r.map((cell, ci) => (
                      <td key={ci}>{cell}</td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

/* ============ AGENDA ============ */
export function AgendaPrint({
  periodLabel,
  appointments,
}: {
  periodLabel: string
  appointments: {
    date: string
    time: string
    patientName: string
    type: string
    professionalName: string
    duration: number
    status: string
  }[]
}) {
  return (
    <div>
      <div style={{ fontSize: '9pt', color: '#475569', marginBottom: '12px' }}>
        <strong>Período:</strong> {periodLabel} &nbsp;|&nbsp; <strong>Total:</strong>{' '}
        {appointments.length} agendamento(s)
      </div>
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Horário</th>
            <th>Paciente</th>
            <th>Tipo de Atendimento</th>
            <th>Profissional</th>
            <th>Duração</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {appointments.length === 0 ? (
            <tr>
              <td
                colSpan={7}
                style={{ textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}
              >
                Nenhum agendamento no período.
              </td>
            </tr>
          ) : (
            appointments
              .slice()
              .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
              .map((a, i) => (
                <tr key={i}>
                  <td>{formatDate(a.date)}</td>
                  <td>{a.time}</td>
                  <td>{a.patientName}</td>
                  <td>{a.type}</td>
                  <td>{a.professionalName}</td>
                  <td>{a.duration} min</td>
                  <td>{a.status}</td>
                </tr>
              ))
          )}
        </tbody>
      </table>
    </div>
  )
}
