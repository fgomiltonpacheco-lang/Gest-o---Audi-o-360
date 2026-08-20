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
  patient,
  clinicSettings,
  professional,
}: {
  exam: AudiometryExamFull
  patient?: Patient | null
  clinicSettings?: ClinicSettings | null
  professional?: { name: string; crmCrfa?: string } | null
}) {
  // 1. Logo
  const logoSrc = clinicSettings?.logo_url || logoImg

  // 2. Dados da clínica
  const clinicAddress =
    clinicSettings?.endereco?.trim() ||
    [clinicSettings?.endereco, clinicSettings?.telefone, clinicSettings?.email]
      .filter(Boolean)
      .join(' • ') ||
    CLINIC_ADDRESS

  // 3. Equipamento (Audiômetro e Calibração)
  const audiometer =
    exam.audiometer?.trim() || clinicSettings?.audiometro?.trim() || 'Não informado'
  const calibration = exam.calibration?.trim()
    ? formatDate(exam.calibration)
    : clinicSettings?.calibracao?.trim() || 'Não informada'

  // 4. Especialista
  const specialistName =
    professional?.name?.trim() || clinicSettings?.especialista_nome?.trim() || SPECIALIST_PRINT
  const specialistCrfa =
    professional?.crmCrfa?.trim() || clinicSettings?.especialista_crfa?.trim() || SPECIALIST_CRFA
  const formattedCrfa = specialistCrfa.replace(/^crfa\s*/i, '').trim()

  // 5. Dados do paciente
  const patientName = patient?.name || exam.patientName || ''
  const patientCpf = patient?.cpf || exam.cpf || ''
  const patientDob = patient?.birthDate || exam.dob || ''
  const patientSex = patient?.gender || exam.sex || ''
  const patientConvenio =
    patient?.planType === 'Convênio'
      ? patient.planName || 'Convênio'
      : patient?.planType === 'SUS'
        ? 'SUS'
        : patient?.planType === 'Particular'
          ? 'Particular'
          : patient?.planType || (exam as any).convenio || 'Particular'

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
      return '0'
    }
    if (val !== null && val !== undefined && val !== ('' as any)) {
      return `${val}`
    }
    if (fallbackStr && fallbackStr.trim() !== '') {
      return fallbackStr.replace(/\s*dB/gi, '').trim()
    }
    return '____'
  }

  // MT (Média Tritonal) calculada automaticamente
  const mtOD = exam.mt_od || mediaTritonal(exam.air_od)
  const mtOE = exam.mt_oe || mediaTritonal(exam.air_oe)

  const mtODStr = formatDbVal(mtOD)
  const lrfODStr = formatDbVal(exam.lrf_od || exam.srt_od)
  const ldvODStr = formatDbVal(exam.ldv_od)

  const mtOEStr = formatDbVal(mtOE)
  const lrfOEStr = formatDbVal(exam.lrf_oe || exam.srt_oe)
  const ldvOEStr = formatDbVal(exam.ldv_oe)

  const formatIprfIntens = (val?: string) => (val && val.trim() ? `${val}` : '')
  const formatIprfPct = (val?: string) => (val && val.trim() ? `${val}` : '')
  const formatIprfMasc = (val?: string) => (val && val.trim() ? `${val}` : '')

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
      {/* 1. Logo centralizada no topo */}
      <div style={{ textAlign: 'center', marginBottom: '8px' }}>
        <img
          src={logoSrc}
          alt="Logo da Clínica"
          style={{
            maxHeight: '65px',
            maxWidth: '240px',
            width: 'auto',
            display: 'inline-block',
            objectFit: 'contain',
          }}
        />
      </div>

      {/* 2. Cabeçalho com dados do paciente e equipamento */}
      <div style={{ fontSize: '8.5pt', marginBottom: '8px' }}>
        {/* Linha 1: Nome + Data */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: '3px',
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
          <div style={{ width: '150px', display: 'flex', alignItems: 'baseline' }}>
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
              {formatDate(exam.date) || '___/___/______'}
            </span>
          </div>
        </div>

        {/* Linha 2: CPF + DN + Sexo + Convênio */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: '3px',
            flexWrap: 'wrap',
            gap: '8px 12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', minWidth: '150px' }}>
            <strong style={{ whiteSpace: 'nowrap' }}>CPF:</strong>
            <span
              style={{
                marginLeft: '4px',
                borderBottom: '1px solid #000',
                minWidth: '100px',
                paddingBottom: '1px',
              }}
            >
              {maskCPF(patientCpf) || '________________'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', minWidth: '130px' }}>
            <strong style={{ whiteSpace: 'nowrap' }}>DN:</strong>
            <span
              style={{
                marginLeft: '4px',
                borderBottom: '1px solid #000',
                minWidth: '80px',
                textAlign: 'center',
                paddingBottom: '1px',
              }}
            >
              {formatDate(patientDob) || '___/___/______'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline' }}>
            <strong>Sexo:</strong>
            <span style={{ marginLeft: '4px' }}>
              F ({isFemale ? 'X' : ' '}) &nbsp; M ({isMale ? 'X' : ' '})
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', minWidth: '140px' }}>
            <strong style={{ whiteSpace: 'nowrap' }}>Convênio:</strong>
            <span
              style={{
                marginLeft: '4px',
                borderBottom: '1px solid #000',
                minWidth: '80px',
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
            marginTop: '2px',
          }}
        >
          <div style={{ flex: 1, marginRight: '16px' }}>
            <strong>Audiômetro:</strong> <span style={{ marginLeft: '4px' }}>{audiometer}</span>
          </div>
          <div style={{ minWidth: '180px', textAlign: 'right' }}>
            <strong>Calibração:</strong> <span style={{ marginLeft: '4px' }}>{calibration}</span>
          </div>
        </div>
      </div>

      {/* Linha divisória */}
      <div style={{ borderTop: '2.5px solid #000', marginBottom: '8px' }} />

      {/* 3. Título AUDIOMETRIA */}
      <h2
        style={{
          textAlign: 'center',
          fontSize: '11pt',
          fontWeight: 800,
          margin: '0 0 8px 0',
          letterSpacing: '0.05em',
        }}
      >
        AUDIOMETRIA
      </h2>

      {/* 4. Audiogramas Lado a Lado (OD / OE) */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '4px',
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
          {/* MT, LRF, LDV OD */}
          <div style={{ fontSize: '8pt', fontWeight: 700, marginTop: '4px', color: '#dc2626' }}>
            MT:{' '}
            <span style={{ borderBottom: '1px solid #dc2626', padding: '0 2px' }}>{mtODStr}</span>{' '}
            dB &nbsp;&nbsp;&nbsp; LRF:{' '}
            <span style={{ borderBottom: '1px solid #dc2626', padding: '0 2px' }}>{lrfODStr}</span>{' '}
            dB &nbsp;&nbsp;&nbsp; LDV:{' '}
            <span style={{ borderBottom: '1px solid #dc2626', padding: '0 2px' }}>{ldvODStr}</span>{' '}
            dB
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
          {/* MT, LRF, LDV OE */}
          <div style={{ fontSize: '8pt', fontWeight: 700, marginTop: '4px', color: '#2563eb' }}>
            MT:{' '}
            <span style={{ borderBottom: '1px solid #2563eb', padding: '0 2px' }}>{mtOEStr}</span>{' '}
            dB &nbsp;&nbsp;&nbsp; LRF:{' '}
            <span style={{ borderBottom: '1px solid #2563eb', padding: '0 2px' }}>{lrfOEStr}</span>{' '}
            dB &nbsp;&nbsp;&nbsp; LDV:{' '}
            <span style={{ borderBottom: '1px solid #2563eb', padding: '0 2px' }}>{ldvOEStr}</span>{' '}
            dB
          </div>
        </div>
      </div>

      {/* 5. Tabela IPRF + Tabela de Legenda Lado a Lado (conforme modelo visual) */}
      <div
        style={{
          marginTop: '8px',
          marginBottom: '8px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '12px',
        }}
      >
        {/* Tabela IPRF */}
        <div style={{ flex: 1.2 }}>
          <div
            style={{ textAlign: 'center', fontSize: '8pt', fontWeight: 700, marginBottom: '2px' }}
          >
            Índice de Reconhecimento de Fala
          </div>
          <table
            style={{
              borderCollapse: 'collapse',
              width: '100%',
              border: '1.5px solid #000',
            }}
          >
            <thead>
              <tr>
                <th style={{ ...thStyle, width: '20%' }}>-</th>
                <th style={{ ...thStyle, width: '20%' }}>Intensid.</th>
                <th style={{ ...thStyle, width: '20%' }}>Dissíl.</th>
                <th style={{ ...thStyle, width: '20%' }}>monos</th>
                <th style={{ ...thStyle, width: '20%' }}>Masc.</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ ...tdStyle, color: '#dc2626', fontWeight: 700 }}>OD</td>
                <td style={{ ...tdStyle, color: '#dc2626', fontWeight: 700 }}>
                  {formatIprfIntens(odVocal.intensidade)
                    ? `${formatIprfIntens(odVocal.intensidade)} dB`
                    : 'dB'}
                </td>
                <td style={{ ...tdStyle, color: '#dc2626', fontWeight: 700 }}>
                  {formatIprfPct(odVocal.dissilabos)
                    ? `${formatIprfPct(odVocal.dissilabos)} %`
                    : '%'}
                </td>
                <td style={{ ...tdStyle, color: '#dc2626', fontWeight: 700 }}>
                  {formatIprfPct(odVocal.monossilabos)
                    ? `${formatIprfPct(odVocal.monossilabos)} %`
                    : '%'}
                </td>
                <td style={{ ...tdStyle, color: '#2563eb', fontWeight: 700 }}>
                  {formatIprfMasc(odVocal.mascaramento)
                    ? `${formatIprfMasc(odVocal.mascaramento)} dB`
                    : 'dB'}
                </td>
              </tr>
              <tr>
                <td style={{ ...tdStyle, color: '#2563eb', fontWeight: 700 }}>OE</td>
                <td style={{ ...tdStyle, color: '#2563eb', fontWeight: 700 }}>
                  {formatIprfIntens(oeVocal.intensidade)
                    ? `${formatIprfIntens(oeVocal.intensidade)} dB`
                    : 'dB'}
                </td>
                <td style={{ ...tdStyle, color: '#2563eb', fontWeight: 700 }}>
                  {formatIprfPct(oeVocal.dissilabos)
                    ? `${formatIprfPct(oeVocal.dissilabos)} %`
                    : '%'}
                </td>
                <td style={{ ...tdStyle, color: '#2563eb', fontWeight: 700 }}>
                  {formatIprfPct(oeVocal.monossilabos)
                    ? `${formatIprfPct(oeVocal.monossilabos)} %`
                    : '%'}
                </td>
                <td style={{ ...tdStyle, color: '#dc2626', fontWeight: 700 }}>
                  {formatIprfMasc(oeVocal.mascaramento)
                    ? `${formatIprfMasc(oeVocal.mascaramento)} dB`
                    : 'dB'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Tabela de Legenda Compacta */}
        <div style={{ flex: 1 }}>
          <div
            style={{ textAlign: 'center', fontSize: '8pt', fontWeight: 700, marginBottom: '2px' }}
          >
            Legenda
          </div>
          <table
            style={{
              borderCollapse: 'collapse',
              width: '100%',
              border: '1.5px solid #000',
              fontSize: '6.5pt',
            }}
          >
            <thead>
              <tr>
                <th style={{ ...thStyle, fontSize: '6pt', padding: '1px 2px', width: '40%' }}>
                  PROCEDIMENTO DE TESTE
                </th>
                <th
                  style={{
                    ...thStyle,
                    fontSize: '6pt',
                    padding: '1px 2px',
                    color: '#dc2626',
                    width: '30%',
                  }}
                >
                  ORELHA DIREITA
                </th>
                <th
                  style={{
                    ...thStyle,
                    fontSize: '6pt',
                    padding: '1px 2px',
                    color: '#2563eb',
                    width: '30%',
                  }}
                >
                  ORELHA ESQUERDA
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ ...tdStyle, fontSize: '6pt', padding: '1px 2px', textAlign: 'left' }}>
                  Presença de resposta não mascarada (VA)
                </td>
                <td
                  style={{
                    ...tdStyle,
                    fontSize: '6.5pt',
                    padding: '1px 2px',
                    color: '#dc2626',
                    fontWeight: 700,
                  }}
                >
                  ○
                </td>
                <td
                  style={{
                    ...tdStyle,
                    fontSize: '6.5pt',
                    padding: '1px 2px',
                    color: '#2563eb',
                    fontWeight: 700,
                  }}
                >
                  ✕
                </td>
              </tr>
              <tr>
                <td style={{ ...tdStyle, fontSize: '6pt', padding: '1px 2px', textAlign: 'left' }}>
                  Presença de resposta mascarada (VA)
                </td>
                <td
                  style={{
                    ...tdStyle,
                    fontSize: '6.5pt',
                    padding: '1px 2px',
                    color: '#dc2626',
                    fontWeight: 700,
                  }}
                >
                  △
                </td>
                <td
                  style={{
                    ...tdStyle,
                    fontSize: '6.5pt',
                    padding: '1px 2px',
                    color: '#2563eb',
                    fontWeight: 700,
                  }}
                >
                  □
                </td>
              </tr>
              <tr>
                <td style={{ ...tdStyle, fontSize: '6pt', padding: '1px 2px', textAlign: 'left' }}>
                  Ausência de resposta não mascarada (VA)
                </td>
                <td
                  style={{
                    ...tdStyle,
                    fontSize: '6.5pt',
                    padding: '1px 2px',
                    color: '#dc2626',
                    fontWeight: 700,
                  }}
                >
                  ○↓
                </td>
                <td
                  style={{
                    ...tdStyle,
                    fontSize: '6.5pt',
                    padding: '1px 2px',
                    color: '#2563eb',
                    fontWeight: 700,
                  }}
                >
                  ✕↓
                </td>
              </tr>
              <tr>
                <td style={{ ...tdStyle, fontSize: '6pt', padding: '1px 2px', textAlign: 'left' }}>
                  Ausência de resposta mascarada (VA)
                </td>
                <td
                  style={{
                    ...tdStyle,
                    fontSize: '6.5pt',
                    padding: '1px 2px',
                    color: '#dc2626',
                    fontWeight: 700,
                  }}
                >
                  △↓
                </td>
                <td
                  style={{
                    ...tdStyle,
                    fontSize: '6.5pt',
                    padding: '1px 2px',
                    color: '#2563eb',
                    fontWeight: 700,
                  }}
                >
                  □↓
                </td>
              </tr>
              <tr>
                <td style={{ ...tdStyle, fontSize: '6pt', padding: '1px 2px', textAlign: 'left' }}>
                  Presença de resposta não mascarada (VO)
                </td>
                <td
                  style={{
                    ...tdStyle,
                    fontSize: '6.5pt',
                    padding: '1px 2px',
                    color: '#dc2626',
                    fontWeight: 700,
                  }}
                >
                  &lt;
                </td>
                <td
                  style={{
                    ...tdStyle,
                    fontSize: '6.5pt',
                    padding: '1px 2px',
                    color: '#2563eb',
                    fontWeight: 700,
                  }}
                >
                  &gt;
                </td>
              </tr>
              <tr>
                <td style={{ ...tdStyle, fontSize: '6pt', padding: '1px 2px', textAlign: 'left' }}>
                  Presença de resposta mascarada (VO)
                </td>
                <td
                  style={{
                    ...tdStyle,
                    fontSize: '6.5pt',
                    padding: '1px 2px',
                    color: '#dc2626',
                    fontWeight: 700,
                  }}
                >
                  [
                </td>
                <td
                  style={{
                    ...tdStyle,
                    fontSize: '6.5pt',
                    padding: '1px 2px',
                    color: '#2563eb',
                    fontWeight: 700,
                  }}
                >
                  ]
                </td>
              </tr>
              <tr>
                <td style={{ ...tdStyle, fontSize: '6pt', padding: '1px 2px', textAlign: 'left' }}>
                  Ausência de resposta não mascarada (VO)
                </td>
                <td
                  style={{
                    ...tdStyle,
                    fontSize: '6.5pt',
                    padding: '1px 2px',
                    color: '#dc2626',
                    fontWeight: 700,
                  }}
                >
                  &lt;↓
                </td>
                <td
                  style={{
                    ...tdStyle,
                    fontSize: '6.5pt',
                    padding: '1px 2px',
                    color: '#2563eb',
                    fontWeight: 700,
                  }}
                >
                  &gt;↓
                </td>
              </tr>
              <tr>
                <td style={{ ...tdStyle, fontSize: '6pt', padding: '1px 2px', textAlign: 'left' }}>
                  Ausência de resposta mascarada (VO)
                </td>
                <td
                  style={{
                    ...tdStyle,
                    fontSize: '6.5pt',
                    padding: '1px 2px',
                    color: '#dc2626',
                    fontWeight: 700,
                  }}
                >
                  [↓
                </td>
                <td
                  style={{
                    ...tdStyle,
                    fontSize: '6.5pt',
                    padding: '1px 2px',
                    color: '#2563eb',
                    fontWeight: 700,
                  }}
                >
                  ]↓
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Parecer Audiológico (Caixa Retangular) */}
      <div style={{ marginTop: '8px', marginBottom: '8px' }}>
        <div
          style={{ textAlign: 'center', fontSize: '8.5pt', fontWeight: 700, marginBottom: '4px' }}
        >
          Parecer Audiológico
        </div>
        <div
          style={{
            border: '1.5px solid #000',
            minHeight: '65px',
            padding: '6px 8px',
            fontSize: '8pt',
            lineHeight: 1.35,
            whiteSpace: 'pre-wrap',
          }}
        >
          {exam.report || ''}
        </div>
        {/* Rodapé da referência teórica */}
        <div
          style={{
            fontSize: '5.5pt',
            color: '#000000',
            textAlign: 'left',
            fontStyle: 'normal',
            marginTop: '3px',
          }}
        >
          Laudo audiológico baseado em {REPORT_REFERENCE}
        </div>
      </div>

      {/* 7. Assinatura do Especialista Centralizada */}
      <div
        style={{
          textAlign: 'center',
          marginTop: '24px',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'inline-block', minWidth: '260px' }}>
          <div style={{ borderTop: '1px solid #000', marginBottom: '4px' }} />
          <div style={{ fontSize: '9pt', fontWeight: 700 }}>{specialistName}</div>
          <div style={{ fontSize: '7.5pt', fontWeight: 600 }}>Fonoaudiólogo</div>
          <div style={{ fontSize: '7.5pt' }}>Especialista em Audiologia</div>
          <div style={{ fontSize: '7.5pt' }}>(CRFa {formattedCrfa || '—'})</div>
        </div>
      </div>

      {/* 8. Rodapé com Endereço da Clínica */}
      <div
        style={{
          fontSize: '7.5pt',
          color: '#000000',
          textAlign: 'center',
          marginTop: '10px',
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
