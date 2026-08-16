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
  AudiogramSymbol,
  AIR_FREQS,
  BONE_FREQS,
} from '@/types'
import { formatDate, maskCPF, calculateAge } from '@/lib/formatters'
import { SingleEarAudiogramChart } from '@/components/AudiogramChart'
import { mediaTritonal, mediaQuadritonal } from '@/lib/audiogram'

const FREQUENCIES_AIR = [
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
]
const FREQUENCIES_BONE = ['500', '1000', '2000', '3000', '4000']
const REFLEX_FREQS = ['500', '1000', '2000', '4000']

/** Frequências exibidas nas tabelas impressas (sem 125 Hz). */
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
  const cell = (v: number | null | 'NR' | undefined) => {
    if (v === null || v === undefined) return '—'
    if (v === 'NR') return 'NR'
    return String(v)
  }
  return (
    <div>
      <div style={{ fontSize: '9pt', color: '#475569', marginBottom: '10px' }}>
        <strong>Paciente:</strong> {exam.patientName} &nbsp;|&nbsp; <strong>Data:</strong>{' '}
        {formatDate(exam.date)} &nbsp;|&nbsp; <strong>Examinador:</strong> {exam.professionalName}
      </div>

      {sectionTitle('Limiares Tonais — Via Aérea (dB NA)')}
      <table>
        <thead>
          <tr>
            <th>Orelha</th>
            {FREQUENCIES_AIR.map((f) => (
              <th key={f} style={{ textAlign: 'center' }}>
                {Number(f) >= 1000 ? `${Number(f) / 1000}k` : f}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ color: '#dc2626', fontWeight: 700 }}>OD</td>
            {FREQUENCIES_AIR.map((f) => (
              <td key={f} style={{ textAlign: 'center' }}>
                {cell(exam.airOD?.[f])}
              </td>
            ))}
          </tr>
          <tr>
            <td style={{ color: '#2563eb', fontWeight: 700 }}>OE</td>
            {FREQUENCIES_AIR.map((f) => (
              <td key={f} style={{ textAlign: 'center' }}>
                {cell(exam.airOE?.[f])}
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      {sectionTitle('Limiares Tonais — Via Óssea (dB NA)')}
      <table>
        <thead>
          <tr>
            <th>Orelha</th>
            {FREQUENCIES_BONE.map((f) => (
              <th key={f} style={{ textAlign: 'center' }}>
                {Number(f) >= 1000 ? `${Number(f) / 1000}k` : f}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ color: '#dc2626', fontWeight: 700 }}>OD</td>
            {FREQUENCIES_BONE.map((f) => (
              <td key={f} style={{ textAlign: 'center' }}>
                {cell(exam.boneOD?.[f])}
              </td>
            ))}
          </tr>
          <tr>
            <td style={{ color: '#2563eb', fontWeight: 700 }}>OE</td>
            {FREQUENCIES_BONE.map((f) => (
              <td key={f} style={{ textAlign: 'center' }}>
                {cell(exam.boneOE?.[f])}
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      {sectionTitle('Índices Logoaudiométricos')}
      <table>
        <thead>
          <tr>
            <th>Orelha</th>
            <th style={{ textAlign: 'center' }}>SRT (dB)</th>
            <th style={{ textAlign: 'center' }}>IPRF (%)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ color: '#dc2626', fontWeight: 700 }}>OD</td>
            <td style={{ textAlign: 'center' }}>{exam.srtOD ?? '—'}</td>
            <td style={{ textAlign: 'center' }}>{exam.iprfOD ?? '—'}</td>
          </tr>
          <tr>
            <td style={{ color: '#2563eb', fontWeight: 700 }}>OE</td>
            <td style={{ textAlign: 'center' }}>{exam.srtOE ?? '—'}</td>
            <td style={{ textAlign: 'center' }}>{exam.iprfOE ?? '—'}</td>
          </tr>
        </tbody>
      </table>

      {sectionTitle('Conclusão')}
      <div style={{ fontSize: '9pt' }}>
        <strong>Grau da perda:</strong> {exam.lossDegree} &nbsp;|&nbsp; <strong>Tipo:</strong>{' '}
        {exam.lossType}
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

/* ============ AUDIOMETRIA COMPLETA (audiometry_exams) ============ */
/* Layout compacto para caber em 1 página A4 — segue o modelo do PDF de referência. */
const SPECIALIST_PRINT = 'MILTON SOARES PACHECO'

export function AudiometriaFullPrint({ exam }: { exam: AudiometryExamFull }) {
  const thStyle: React.CSSProperties = {
    border: '1px solid #94a3b8',
    padding: '1px 2px',
    background: '#f1f5f9',
    fontSize: '7pt',
    fontWeight: 700,
    textAlign: 'center',
  }
  const tdStyle: React.CSSProperties = {
    border: '1px solid #94a3b8',
    padding: '1px 2px',
    fontSize: '7pt',
    textAlign: 'center',
  }

  const fmtMedia = (v: number | null) => (v === null ? '-' : v)
  const odTrito = mediaTritonal(exam.air_od)
  const odQuadri = mediaQuadritonal(exam.air_od)
  const oeTrito = mediaTritonal(exam.air_oe)
  const oeQuadri = mediaQuadritonal(exam.air_oe)
  const odTritoBone = mediaTritonal(exam.bone_od)
  const oeTritoBone = mediaTritonal(exam.bone_oe)
  const odQuadriBone = mediaQuadritonal(exam.bone_od)
  const oeQuadriBone = mediaQuadritonal(exam.bone_oe)

  // Idade detalhada (anos, meses e dias) — relativa à data do exame
  const detailedAgePrint = (() => {
    if (!exam.dob) return ''
    const birth = new Date(exam.dob + 'T00:00:00')
    if (isNaN(birth.getTime())) return ''
    const ref = exam.date ? new Date(exam.date + 'T00:00:00') : new Date()
    if (isNaN(ref.getTime())) return ''
    let years = ref.getFullYear() - birth.getFullYear()
    let months = ref.getMonth() - birth.getMonth()
    let days = ref.getDate() - birth.getDate()
    if (days < 0) {
      months -= 1
      const prevMonth = new Date(ref.getFullYear(), ref.getMonth(), 0)
      days += prevMonth.getDate()
    }
    if (months < 0) {
      years -= 1
      months += 12
    }
    if (years < 0) return ''
    const parts: string[] = []
    if (years > 0) parts.push(`${years} ${years === 1 ? 'ano' : 'anos'}`)
    parts.push(`${months} ${months === 1 ? 'mês' : 'meses'}`)
    parts.push(`${days} ${days === 1 ? 'dia' : 'dias'}`)
    return parts.join(', ')
  })()

  const fmtDb = (v: number | null | undefined) =>
    v === null || v === undefined ? '- dB' : `${v} dB`

  const fmtIprfPrint = (r: { intensidade: string; monossilabos: string; dissilabos: string }) => {
    const intens = r.intensidade ? `${r.intensidade} dB` : '- dB'
    const monoPct = r.monossilabos ? `${r.monossilabos}%` : '100%'
    const monoDb = r.intensidade ? `${r.intensidade} dB` : '- dB'
    const dissiPct = r.dissilabos ? `${r.dissilabos}%` : '100%'
    const dissiDb = r.intensidade ? `${r.intensidade} dB` : '- dB'
    return `${intens} - ${monoPct} Monossílabos (${monoDb}) / ${dissiPct} Dissílabos (${dissiDb})`
  }

  const srtOd = exam.srt_od
  const srtOe = exam.srt_oe
  const ldvOd = exam.ldv_od
  const ldvOe = exam.ldv_oe

  return (
    <div
      className="audiometry-print audiometry-print-full"
      style={{ color: '#1e293b', fontSize: '7.5pt', lineHeight: 1.25 }}
    >
      {/* Cabeçalho da clínica */}
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
        <div>
          <div style={{ fontSize: '11pt', fontWeight: 800, color: '#0F2B5C' }}>Audição360</div>
          <div style={{ fontSize: '7pt', color: '#64748b', lineHeight: 1.25 }}>
            R. Sadoc Correa, 373 - St. Central, Araguaína - TO, 77803-060
            <br />
            Telefone: (63) 3421-2611
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: '7.5pt' }}>
          <div style={{ fontWeight: 700 }}>DATA DO EXAME</div>
          <div>{formatDate(exam.date)}</div>
        </div>
      </div>

      {/* Bloco de identificação do paciente */}
      <div
        style={{
          border: '1px solid #94a3b8',
          padding: '3px 4px',
          marginBottom: '4px',
          fontSize: '7.5pt',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr 1fr',
          gap: '1px 8px',
        }}
      >
        <div style={{ gridColumn: 'span 4' }}>
          <strong>NOME COMPLETO:</strong> {exam.patientName || '—'}
        </div>
        <div>
          <strong>CPF:</strong> {maskCPF(exam.cpf)}
        </div>
        <div>
          <strong>GÊNERO:</strong> {exam.sex || '—'}
        </div>
        <div>
          <strong>DATA DE NASC.:</strong> {formatDate(exam.dob)}
        </div>
        <div>
          <strong>IDADE:</strong> {detailedAgePrint || '—'}
        </div>
        <div>
          <strong>ESTADO CIVIL:</strong> {exam.marital_status || '—'}
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <strong>ESPECIALISTA:</strong> {SPECIALIST_PRINT}
        </div>
        <div>
          <strong>APARELHO AUDIÔMETRO:</strong> {exam.audiometer || 'AD229b'}
        </div>
        <div>
          <strong>DATA DA CALIBRAÇÃO:</strong> {formatDate(exam.calibration)}
        </div>
      </div>

      {/* Título AUDIOMETRIA */}
      <h2
        style={{
          textAlign: 'center',
          fontSize: '10pt',
          fontWeight: 800,
          margin: '0 0 3px 0',
          color: '#1e293b',
          letterSpacing: '0.04em',
        }}
      >
        AUDIOMETRIA
      </h2>

      {/* Legenda */}
      <div style={{ marginBottom: '4px' }}>
        <div
          style={{
            fontSize: '7.5pt',
            fontWeight: 700,
            color: '#0F2B5C',
            marginBottom: '1px',
          }}
        >
          LEGENDA
        </div>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '6.5pt' }}>
          <thead>
            <tr>
              <th style={thStyle}></th>
              <th colSpan={2} style={thStyle}>
                Normal
              </th>
              <th colSpan={2} style={thStyle}>
                Ausente
              </th>
            </tr>
            <tr>
              <th style={thStyle}></th>
              <th style={{ ...thStyle, color: '#dc2626' }}>OD</th>
              <th style={{ ...thStyle, color: '#2563eb' }}>OE</th>
              <th style={{ ...thStyle, color: '#dc2626' }}>OD</th>
              <th style={{ ...thStyle, color: '#2563eb' }}>OE</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 600 }}>Via Aérea s/ masc.</td>
              <td style={{ ...tdStyle, color: '#dc2626', fontWeight: 700 }}>○</td>
              <td style={{ ...tdStyle, color: '#2563eb', fontWeight: 700 }}>✕</td>
              <td style={{ ...tdStyle, color: '#dc2626', fontWeight: 700 }}>○↓</td>
              <td style={{ ...tdStyle, color: '#2563eb', fontWeight: 700 }}>✕↓</td>
            </tr>
            <tr>
              <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 600 }}>Via Aérea c/ masc.</td>
              <td style={{ ...tdStyle, color: '#dc2626', fontWeight: 700 }}>△</td>
              <td style={{ ...tdStyle, color: '#2563eb', fontWeight: 700 }}>□</td>
              <td style={{ ...tdStyle, color: '#dc2626', fontWeight: 700 }}>△↓</td>
              <td style={{ ...tdStyle, color: '#2563eb', fontWeight: 700 }}>□↓</td>
            </tr>
            <tr>
              <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 600 }}>Via Óssea s/ masc.</td>
              <td style={{ ...tdStyle, color: '#dc2626', fontWeight: 700 }}>&lt;</td>
              <td style={{ ...tdStyle, color: '#2563eb', fontWeight: 700 }}>&gt;</td>
              <td style={{ ...tdStyle, color: '#dc2626', fontWeight: 700 }}>&lt;↓</td>
              <td style={{ ...tdStyle, color: '#2563eb', fontWeight: 700 }}>&gt;↓</td>
            </tr>
            <tr>
              <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 600 }}>Via Óssea c/ masc.</td>
              <td style={{ ...tdStyle, color: '#dc2626', fontWeight: 700 }}>[</td>
              <td style={{ ...tdStyle, color: '#2563eb', fontWeight: 700 }}>]</td>
              <td style={{ ...tdStyle, color: '#dc2626', fontWeight: 700 }}>[↓</td>
              <td style={{ ...tdStyle, color: '#2563eb', fontWeight: 700 }}>]↓</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Audiogramas lado a lado (OD vermelho / OE azul) */}
      <div
        style={{
          display: 'flex',
          gap: '4px',
          marginBottom: '3px',
          breakInside: 'avoid',
          alignItems: 'flex-start',
        }}
      >
        <div style={{ width: '50%', breakInside: 'avoid' }}>
          <div
            style={{
              fontSize: '7.5pt',
              fontWeight: 700,
              color: '#dc2626',
              textAlign: 'center',
              marginBottom: '1px',
            }}
          >
            ORELHA DIREITA
          </div>
          <SingleEarAudiogramChart
            side="OD"
            air={exam.air_od}
            bone={exam.bone_od}
            ldl={exam.ldl_od}
            width="100%"
            compact
            hideLegend
          />
          <div
            style={{
              textAlign: 'center',
              color: '#dc2626',
              fontSize: '7pt',
              marginTop: '1px',
              fontWeight: 700,
            }}
          >
            SRT: {fmtDb(srtOd)} &nbsp;|&nbsp; LDV: {fmtDb(ldvOd)}
          </div>
        </div>
        <div style={{ width: '50%', breakInside: 'avoid' }}>
          <div
            style={{
              fontSize: '7.5pt',
              fontWeight: 700,
              color: '#2563eb',
              textAlign: 'center',
              marginBottom: '1px',
            }}
          >
            ORELHA ESQUERDA
          </div>
          <SingleEarAudiogramChart
            side="OE"
            air={exam.air_oe}
            bone={exam.bone_oe}
            ldl={exam.ldl_oe}
            width="100%"
            compact
            hideLegend
          />
          <div
            style={{
              textAlign: 'center',
              color: '#2563eb',
              fontSize: '7pt',
              marginTop: '1px',
              fontWeight: 700,
            }}
          >
            SRT: {fmtDb(srtOe)} &nbsp;|&nbsp; LDV: {fmtDb(ldvOe)}
          </div>
        </div>
      </div>

      {/* Médias Tritonal / Quadritonal */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '3px', breakInside: 'avoid' }}>
        <div style={{ flex: 1 }}>
          <div
            style={{ fontSize: '7.5pt', fontWeight: 700, color: '#0F2B5C', marginBottom: '1px' }}
          >
            MÉDIA TRITONAL
          </div>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={thStyle}></th>
                <th style={{ ...thStyle, color: '#dc2626' }}>OD</th>
                <th style={{ ...thStyle, color: '#2563eb' }}>OE</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 600 }}>Via Aérea</td>
                <td style={tdStyle}>{fmtMedia(odTrito)}</td>
                <td style={tdStyle}>{fmtMedia(oeTrito)}</td>
              </tr>
              <tr>
                <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 600 }}>Via Óssea</td>
                <td style={tdStyle}>{fmtMedia(odTritoBone)}</td>
                <td style={tdStyle}>{fmtMedia(oeTritoBone)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{ fontSize: '7.5pt', fontWeight: 700, color: '#0F2B5C', marginBottom: '1px' }}
          >
            MÉDIA QUADRITONAL
          </div>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={thStyle}></th>
                <th style={{ ...thStyle, color: '#dc2626' }}>OD</th>
                <th style={{ ...thStyle, color: '#2563eb' }}>OE</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 600 }}>Via Aérea</td>
                <td style={tdStyle}>{fmtMedia(odQuadri)}</td>
                <td style={tdStyle}>{fmtMedia(oeQuadri)}</td>
              </tr>
              <tr>
                <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 600 }}>Via Óssea</td>
                <td style={tdStyle}>{fmtMedia(odQuadriBone)}</td>
                <td style={tdStyle}>{fmtMedia(oeQuadriBone)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* I.P.R.F */}
      <div style={{ marginBottom: '3px', breakInside: 'avoid' }}>
        <div style={{ fontSize: '7.5pt', fontWeight: 700, color: '#0F2B5C', marginBottom: '1px' }}>
          I.P.R.F
        </div>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={thStyle}></th>
              <th style={{ ...thStyle, color: '#dc2626' }}>OD</th>
              <th style={{ ...thStyle, color: '#2563eb' }}>OE</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 600 }}>I.P.R.F</td>
              <td style={{ ...tdStyle, fontSize: '6.5pt' }}>
                {fmtIprfPrint(
                  exam.iprf_vocal?.od ?? { intensidade: '', monossilabos: '', dissilabos: '' },
                )}
              </td>
              <td style={{ ...tdStyle, fontSize: '6.5pt' }}>
                {fmtIprfPrint(
                  exam.iprf_vocal?.oe ?? { intensidade: '', monossilabos: '', dissilabos: '' },
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Mascaramento */}
      <div style={{ marginBottom: '3px', breakInside: 'avoid' }}>
        <div style={{ fontSize: '7.5pt', fontWeight: 700, color: '#0F2B5C', marginBottom: '1px' }}>
          MASCARAMENTO
        </div>
        <table style={{ borderCollapse: 'collapse', width: '60%' }}>
          <thead>
            <tr>
              <th style={thStyle}></th>
              <th style={{ ...thStyle, color: '#dc2626' }}>O.D.</th>
              <th style={{ ...thStyle, color: '#2563eb' }}>O.E.</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 600 }}>V.A.:</td>
              <td style={tdStyle}>{fmtDb(exam.masking_air_od)}</td>
              <td style={tdStyle}>{fmtDb(exam.masking_air_oe)}</td>
            </tr>
            <tr>
              <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 600 }}>V.O.:</td>
              <td style={tdStyle}>{fmtDb(exam.masking_bone_od)}</td>
              <td style={tdStyle}>{fmtDb(exam.masking_bone_oe)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Inspeção do Meato Acústico Externo */}
      <div style={{ marginBottom: '3px', breakInside: 'avoid' }}>
        <div style={{ fontSize: '7.5pt', fontWeight: 700, color: '#0F2B5C', marginBottom: '1px' }}>
          INSPEÇÃO DO MEATO ACÚSTICO EXTERNO
        </div>
        <div
          style={{
            border: '1px solid #94a3b8',
            padding: '2px 4px',
            fontSize: '7pt',
            display: 'flex',
            gap: '12px',
          }}
        >
          <div style={{ flex: 1 }}>
            <strong style={{ color: '#dc2626' }}>ORELHA DIREITA:</strong>{' '}
            {exam.meatoscopy_od || 'Em condições de exame'}
          </div>
          <div style={{ flex: 1 }}>
            <strong style={{ color: '#2563eb' }}>ORELHA ESQUERDA:</strong>{' '}
            {exam.meatoscopy_oe || 'Em condições de exame'}
          </div>
        </div>
      </div>

      {/* Grau e Tipo */}
      {(exam.loss_degree || exam.loss_type) && (
        <div style={{ fontSize: '7pt', marginBottom: '2px' }}>
          <strong>Grau:</strong> {exam.loss_degree || '—'} &nbsp;|&nbsp; <strong>Tipo:</strong>{' '}
          {exam.loss_type || '—'}
        </div>
      )}

      {/* Parecer Audiológico */}
      <div style={{ marginTop: '2px', breakInside: 'avoid' }}>
        <div
          style={{
            fontSize: '7.5pt',
            fontWeight: 700,
            color: '#0F2B5C',
            borderBottom: '1px solid #0F2B5C',
            paddingBottom: '1px',
            marginBottom: '2px',
          }}
        >
          PARECER AUDIOLÓGICO
        </div>
        <div
          style={{
            fontSize: '7pt',
            color: '#1e293b',
            lineHeight: 1.3,
            whiteSpace: 'pre-wrap',
            border: '1px solid #cbd5e1',
            padding: '2px 4px',
            background: '#fafafa',
          }}
        >
          {exam.report || '—'}
        </div>
        <p
          style={{
            fontSize: '6pt',
            color: '#64748b',
            marginTop: '2px',
            marginBottom: '0',
            textAlign: 'justify',
            fontStyle: 'italic',
          }}
        >
          (Silman e Silverman (1997) adaptada de Carhart (1945) e Lloyd e Kaplan (1978).) (Jerger,
          Speaks e Trammell, 1968).
        </p>
      </div>

      {/* Assinatura */}
      <div style={{ marginTop: '8px', textAlign: 'center' }}>
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
          Fonoaudiólogo — CRFa 3-11981-5
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
        R. Sadoc Correa, 373 - St. Central, Araguaína - TO, 77803-060 &nbsp;•&nbsp; (63) 3421-2611
      </div>
    </div>
  )
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
