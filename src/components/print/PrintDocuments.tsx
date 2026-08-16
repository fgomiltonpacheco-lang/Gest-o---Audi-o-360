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
/* Layout compacto para caber em 1 página A4. */
export function AudiometriaFullPrint({ exam }: { exam: AudiometryExamFull }) {
  const thStyle: React.CSSProperties = {
    border: '1px solid #94a3b8',
    padding: '1.5px 3px',
    background: '#f1f5f9',
    fontSize: '7pt',
    fontWeight: 700,
    textAlign: 'center',
  }
  const tdStyle: React.CSSProperties = {
    border: '1px solid #94a3b8',
    padding: '1.5px 3px',
    fontSize: '7pt',
    textAlign: 'center',
  }

  const fmtMedia = (v: number | null) => (v === null ? '—' : `${v} dB`)
  const odTrito = mediaTritonal(exam.air_od)
  const odQuadri = mediaQuadritonal(exam.air_od)
  const oeTrito = mediaTritonal(exam.air_oe)
  const oeQuadri = mediaQuadritonal(exam.air_oe)

  const fmtFreq = (f: string) => (Number(f) >= 1000 ? `${Number(f) / 1000}k` : f)

  // Texto do símbolo + valor para uma célula da tabela impressa
  const cellSymbol = (
    map: AudiogramMap,
    freq: string,
    side: 'OD' | 'OE',
    kind: 'air' | 'bone',
  ): string => {
    const p = map[freq]
    if (!p || p.db === null || p.db === undefined) return '—'
    const sym = p.symbol as AudiogramSymbol
    let glyph = ''
    if (kind === 'air') {
      if (side === 'OD') glyph = sym === 'masked' || sym === 'masked_no_response' ? '△' : '○'
      else glyph = sym === 'masked' || sym === 'masked_no_response' ? '□' : '✕'
    } else {
      if (side === 'OD') glyph = sym === 'masked' || sym === 'masked_no_response' ? '[' : '<'
      else glyph = sym === 'masked' || sym === 'masked_no_response' ? ']' : '>'
    }
    const arrow = sym === 'no_response' || sym === 'masked_no_response' ? '↓' : ''
    return `${p.db}${glyph}${arrow}`
  }

  const fmtVocal = (v: number | null | undefined, unit: string) =>
    v === null || v === undefined ? '—' : `${v} ${unit}`

  return (
    <div className="audiometry-print" style={{ color: '#000', fontSize: '7.5pt', lineHeight: 1.3 }}>
      {/* Cabeçalho do Exame */}
      <h2
        style={{
          textAlign: 'center',
          fontSize: '9pt',
          fontWeight: 800,
          margin: '0 0 2px 0',
          color: '#0F2B5C',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        Avaliação Audiológica
      </h2>
      <div style={{ marginBottom: '3px', lineHeight: 1.35 }}>
        <div style={{ fontSize: '7.5pt' }}>
          <strong>Nome:</strong> {exam.patientName || '—'} &nbsp;&nbsp;
          <strong>Data:</strong> {formatDate(exam.date)} &nbsp;&nbsp;
          <strong>CPF:</strong> {maskCPF(exam.cpf)} &nbsp;&nbsp;
          <strong>DN:</strong> {formatDate(exam.dob)} &nbsp;&nbsp;
          <strong>Sexo:</strong> {exam.sex || '—'}
        </div>
        <div style={{ fontSize: '7.5pt' }}>
          <strong>Encaminhado por:</strong> {exam.referred_by || '—'} &nbsp;&nbsp;
          <strong>Audiômetro:</strong> {exam.audiometer || '—'} &nbsp;&nbsp;
          <strong>Calibração:</strong> {formatDate(exam.calibration)}
        </div>
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
              fontSize: '8pt',
              fontWeight: 700,
              color: '#dc2626',
              textAlign: 'center',
              marginBottom: '1px',
            }}
          >
            Orelha Direita (OD)
          </div>
          <SingleEarAudiogramChart
            side="OD"
            air={exam.air_od}
            bone={exam.bone_od}
            ldl={exam.ldl_od}
            width="100%"
          />
          <div style={{ textAlign: 'center', color: '#dc2626', fontSize: '7pt', marginTop: '1px' }}>
            <strong>Tritonal:</strong> {fmtMedia(odTrito)} &nbsp;|&nbsp;{' '}
            <strong>Quadritonal:</strong> {fmtMedia(odQuadri)}
          </div>
        </div>
        <div style={{ width: '50%', breakInside: 'avoid' }}>
          <div
            style={{
              fontSize: '8pt',
              fontWeight: 700,
              color: '#2563eb',
              textAlign: 'center',
              marginBottom: '1px',
            }}
          >
            Orelha Esquerda (OE)
          </div>
          <SingleEarAudiogramChart
            side="OE"
            air={exam.air_oe}
            bone={exam.bone_oe}
            ldl={exam.ldl_oe}
            width="100%"
          />
          <div style={{ textAlign: 'center', color: '#2563eb', fontSize: '7pt', marginTop: '1px' }}>
            <strong>Tritonal:</strong> {fmtMedia(oeTrito)} &nbsp;|&nbsp;{' '}
            <strong>Quadritonal:</strong> {fmtMedia(oeQuadri)}
          </div>
        </div>
      </div>

      {/* Tabela Via Aérea (com símbolos) */}
      <div style={{ marginTop: '2px', marginBottom: '2px', breakInside: 'avoid' }}>
        <div
          style={{
            fontWeight: 700,
            fontSize: '8pt',
            color: '#0F2B5C',
            marginBottom: '1px',
            textTransform: 'uppercase',
          }}
        >
          Via Aérea (Fones)
        </div>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={thStyle}>Orelha</th>
              {PRINT_AIR_FREQS.map((f) => (
                <th key={f} style={thStyle}>
                  {fmtFreq(f)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ ...tdStyle, fontWeight: 800, color: '#dc2626' }}>OD</td>
              {PRINT_AIR_FREQS.map((f) => (
                <td key={f} style={tdStyle}>
                  {cellSymbol(exam.air_od, f, 'OD', 'air')}
                </td>
              ))}
            </tr>
            <tr>
              <td style={{ ...tdStyle, fontWeight: 800, color: '#2563eb' }}>OE</td>
              {PRINT_AIR_FREQS.map((f) => (
                <td key={f} style={tdStyle}>
                  {cellSymbol(exam.air_oe, f, 'OE', 'air')}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Tabela Via Óssea (com símbolos) */}
      <div style={{ marginTop: '2px', marginBottom: '2px', breakInside: 'avoid' }}>
        <div
          style={{
            fontWeight: 700,
            fontSize: '8pt',
            color: '#0F2B5C',
            marginBottom: '1px',
            textTransform: 'uppercase',
          }}
        >
          Via Óssea (Mastóide)
        </div>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={thStyle}>Orelha</th>
              {FREQUENCIES_BONE.map((f) => (
                <th key={f} style={thStyle}>
                  {fmtFreq(f)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ ...tdStyle, fontWeight: 800, color: '#dc2626' }}>OD</td>
              {FREQUENCIES_BONE.map((f) => (
                <td key={f} style={tdStyle}>
                  {cellSymbol(exam.bone_od, f, 'OD', 'bone')}
                </td>
              ))}
            </tr>
            <tr>
              <td style={{ ...tdStyle, fontWeight: 800, color: '#2563eb' }}>OE</td>
              {FREQUENCIES_BONE.map((f) => (
                <td key={f} style={tdStyle}>
                  {cellSymbol(exam.bone_oe, f, 'OE', 'bone')}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Audiometria Vocal — LRF, LDV, IPRF */}
      <div style={{ marginTop: '2px', marginBottom: '2px', breakInside: 'avoid' }}>
        <div
          style={{
            fontWeight: 700,
            fontSize: '8pt',
            color: '#0F2B5C',
            marginBottom: '1px',
            textTransform: 'uppercase',
          }}
        >
          Audiometria Vocal
        </div>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={thStyle}>Orelha</th>
              <th style={thStyle}>LRF (dB)</th>
              <th style={thStyle}>LDV (dB)</th>
              <th style={thStyle}>IPRF (%)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ ...tdStyle, fontWeight: 800, color: '#dc2626' }}>OD</td>
              <td style={tdStyle}>{fmtVocal(exam.lrf_od, '')}</td>
              <td style={tdStyle}>{fmtVocal(exam.ldv_od, '')}</td>
              <td style={tdStyle}>{fmtVocal(exam.iprf_od, '')}</td>
            </tr>
            <tr>
              <td style={{ ...tdStyle, fontWeight: 800, color: '#2563eb' }}>OE</td>
              <td style={tdStyle}>{fmtVocal(exam.lrf_oe, '')}</td>
              <td style={tdStyle}>{fmtVocal(exam.ldv_oe, '')}</td>
              <td style={tdStyle}>{fmtVocal(exam.iprf_oe, '')}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Grau e Tipo da perda */}
      <div style={{ fontSize: '7.5pt', marginTop: '3px', marginBottom: '2px' }}>
        <strong>Grau da perda:</strong> {exam.loss_degree || '—'} &nbsp;|&nbsp;{' '}
        <strong>Tipo:</strong> {exam.loss_type || '—'}
      </div>

      {/* Parecer Audiológico */}
      <div style={{ marginTop: '2px' }}>
        <div
          style={{
            fontSize: '8pt',
            fontWeight: 700,
            color: '#0F2B5C',
            borderBottom: '1px solid #0F2B5C',
            paddingBottom: '1px',
            marginBottom: '2px',
            textTransform: 'uppercase',
          }}
        >
          Parecer Audiológico
        </div>
        <div
          style={{
            fontSize: '7pt',
            color: '#0f172a',
            lineHeight: 1.3,
            whiteSpace: 'pre-wrap',
            maxHeight: '52px',
            overflow: 'hidden',
            border: '1px solid #cbd5e1',
            borderRadius: '3px',
            padding: '2px 4px',
            background: '#fafafa',
          }}
        >
          {exam.report || 'Sem observações/laudo laudado.'}
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
          Laudo audiológico baseado em Lloyd e Kaplan (1978); Silman e Silverman (1997) adaptada de
          Carhart (1945) e Lloyd e Kaplan (1978); Jerger, Speaks, e Trammell (1968)
        </p>
      </div>

      {/* Linhas de Assinatura */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '10px',
          gap: '40px',
        }}
      >
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div
            style={{
              borderTop: '1px solid #475569',
              paddingTop: '2px',
              fontSize: '7.5pt',
              fontWeight: 600,
              color: '#1e293b',
            }}
          >
            Dr. Milton Soares Pacheco — CRFa 3-11981-5
          </div>
          <div style={{ fontSize: '7pt', color: '#475569', marginTop: '1px' }}>Fonoaudiólogo</div>
        </div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div
            style={{
              borderTop: '1px solid #475569',
              paddingTop: '2px',
              fontSize: '7.5pt',
              fontWeight: 600,
              color: '#1e293b',
            }}
          >
            Cliente
          </div>
          <div style={{ fontSize: '7pt', color: '#475569', marginTop: '1px' }}>
            Paciente / Responsável
          </div>
        </div>
      </div>

      {/* Rodapé */}
      <div
        style={{
          marginTop: '4px',
          fontSize: '6.5pt',
          color: '#64748b',
          textAlign: 'center',
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
