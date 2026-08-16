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
  AIR_FREQS,
  BONE_FREQS,
} from '@/types'
import { formatDate, maskCPF, calculateAge } from '@/lib/formatters'
import { AudiogramChart } from '@/components/AudiogramChart'
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
export function AudiometriaFullPrint({ exam }: { exam: AudiometryExamFull }) {
  const thStyle: React.CSSProperties = {
    border: '1px solid #94a3b8',
    padding: '3px 4px',
    background: '#f1f5f9',
    fontSize: '8pt',
    fontWeight: 700,
    textAlign: 'center',
  }
  const tdStyle: React.CSSProperties = {
    border: '1px solid #94a3b8',
    padding: '3px 4px',
    fontSize: '8pt',
    textAlign: 'center',
  }

  const fmtMedia = (v: number | null) => (v === null ? '—' : `${v} dB`)
  const odTrito = mediaTritonal(exam.air_od)
  const odQuadri = mediaQuadritonal(exam.air_od)
  const oeTrito = mediaTritonal(exam.air_oe)
  const oeQuadri = mediaQuadritonal(exam.air_oe)

  const checkBox = (checked: boolean) => (
    <span style={{ display: 'inline-block', fontWeight: 700 }}>{checked ? '☒' : '☐'}</span>
  )

  return (
    <div style={{ color: '#000', fontSize: '9pt' }}>
      {/* Cabeçalho do Exame */}
      <h2
        style={{
          textAlign: 'center',
          fontSize: '13pt',
          fontWeight: 700,
          margin: '0 0 8px 0',
          color: '#000',
        }}
      >
        Avaliação Audiológica
      </h2>

      <div
        style={{
          border: '1px solid #000',
          padding: '6px 8px',
          marginBottom: '8px',
          lineHeight: 1.5,
        }}
      >
        <div style={{ display: 'flex', gap: '24px', fontSize: '9pt' }}>
          <span>
            <strong>Nome:</strong> {exam.patientName || '—'}
          </span>
          <span>
            <strong>Data:</strong> {formatDate(exam.date) || '—'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '24px', fontSize: '9pt' }}>
          <span>
            <strong>CPF:</strong> {maskCPF(exam.cpf) || '—'}
          </span>
          <span>
            <strong>DN:</strong> {formatDate(exam.dob) || '—'}
          </span>
          <span>
            <strong>Sexo:</strong> F({checkBox(exam.sex === 'F')}) M({checkBox(exam.sex === 'M')})
          </span>
        </div>
        <div style={{ display: 'flex', gap: '24px', fontSize: '9pt' }}>
          <span>
            <strong>Encaminhado por:</strong> {exam.referred_by || '—'}
          </span>
          <span>
            <strong>Repouso Auditivo de 14hs:</strong> Sim(
            {checkBox(exam.hearing_rest_14h === true)}) Não(
            {checkBox(exam.hearing_rest_14h === false)})
          </span>
        </div>
        <div style={{ display: 'flex', gap: '24px', fontSize: '9pt' }}>
          <span>
            <strong>Audiômetro:</strong> {exam.audiometer || '—'}
          </span>
          <span>
            <strong>Calibração:</strong> {formatDate(exam.calibration) || '—'}
          </span>
        </div>
      </div>

      {/* Audiogramas Lado a Lado */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          marginBottom: '8px',
          breakInside: 'avoid',
        }}
      >
        <div>
          <div style={{ textAlign: 'center', fontWeight: 700, color: '#dc2626', fontSize: '10pt' }}>
            Orelha Direita
          </div>
          <AudiogramChart
            airOD={exam.air_od}
            airOE={{} as AudiogramMap}
            boneOD={exam.bone_od}
            boneOE={{} as AudiogramMap}
            ldlOD={exam.ldl_od}
          />
          <div style={{ textAlign: 'center', marginTop: '4px', fontSize: '8.5pt' }}>
            <strong>Média Tritonal:</strong> {fmtMedia(odTrito)} &nbsp;|&nbsp;{' '}
            <strong>Média Quadritonal:</strong> {fmtMedia(odQuadri)}
          </div>
        </div>
        <div>
          <div style={{ textAlign: 'center', fontWeight: 700, color: '#2563eb', fontSize: '10pt' }}>
            Orelha Esquerda
          </div>
          <AudiogramChart
            airOD={{} as AudiogramMap}
            airOE={exam.air_oe}
            boneOD={{} as AudiogramMap}
            boneOE={exam.bone_oe}
            ldlOE={exam.ldl_oe}
          />
          <div style={{ textAlign: 'center', marginTop: '4px', fontSize: '8.5pt' }}>
            <strong>Média Tritonal:</strong> {fmtMedia(oeTrito)} &nbsp;|&nbsp;{' '}
            <strong>Média Quadritonal:</strong> {fmtMedia(oeQuadri)}
          </div>
        </div>
      </div>

      {/* Meatoscopia */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          marginBottom: '8px',
          marginTop: '8px',
        }}
      >
        <div style={{ border: '1px solid #000', padding: '6px 8px', fontSize: '9pt' }}>
          <div style={{ fontWeight: 700, color: '#dc2626' }}>Orelha Direita (OD)</div>
          <div>
            Meatoscopia: Normal ({checkBox(exam.otoscopy_od === 'Normal')}) Alterada (
            {checkBox(exam.otoscopy_od === 'Alterada')})
          </div>
          {exam.otoscopy_od_obs ? (
            <div style={{ marginTop: '2px' }}>
              <strong>Obs.:</strong> {exam.otoscopy_od_obs}
            </div>
          ) : null}
        </div>
        <div style={{ border: '1px solid #000', padding: '6px 8px', fontSize: '9pt' }}>
          <div style={{ fontWeight: 700, color: '#2563eb' }}>Orelha Esquerda (OE)</div>
          <div>
            Meatoscopia: Normal ({checkBox(exam.otoscopy_oe === 'Normal')}) Alterada (
            {checkBox(exam.otoscopy_oe === 'Alterada')})
          </div>
          {exam.otoscopy_oe_obs ? (
            <div style={{ marginTop: '2px' }}>
              <strong>Obs.:</strong> {exam.otoscopy_oe_obs}
            </div>
          ) : null}
        </div>
      </div>

      {/* Limiares Vocais */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          marginBottom: '8px',
        }}
      >
        <div style={{ border: '1px solid #000', padding: '6px 8px', fontSize: '9pt' }}>
          <div style={{ fontWeight: 700, color: '#dc2626' }}>OD</div>
          <div>
            MT: {exam.mt_od ?? '—'} dB &nbsp;|&nbsp; LRF: {exam.lrf_od ?? '—'} dB &nbsp;|&nbsp; LDV:{' '}
            {exam.ldv_od ?? '—'} dB
          </div>
        </div>
        <div style={{ border: '1px solid #000', padding: '6px 8px', fontSize: '9pt' }}>
          <div style={{ fontWeight: 700, color: '#2563eb' }}>OE</div>
          <div>
            MT: {exam.mt_oe ?? '—'} dB &nbsp;|&nbsp; LRF: {exam.lrf_oe ?? '—'} dB &nbsp;|&nbsp; LDV:{' '}
            {exam.ldv_oe ?? '—'} dB
          </div>
        </div>
      </div>

      {/* IPRF — Índice de Reconhecimento de Fala */}
      <div style={{ fontWeight: 700, fontSize: '10pt', margin: '8px 0 4px 0' }}>
        IPRF — Índice de Reconhecimento de Fala
      </div>
      <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: '8px' }}>
        <thead>
          <tr>
            <th style={thStyle}>Orelha</th>
            <th style={thStyle}>Intensidade (dB)</th>
            <th style={thStyle}>Monossílabos (%)</th>
            <th style={thStyle}>Dissílabos (%)</th>
            <th style={thStyle}>Mascaramento (dB)</th>
            <th style={thStyle}>Palavras Faladas</th>
          </tr>
        </thead>
        <tbody>
          {(['od', 'oe'] as const).map((side) => {
            const r = exam.iprf?.[side]
            const label = side === 'od' ? 'OD' : 'OE'
            const color = side === 'od' ? '#dc2626' : '#2563eb'
            return (
              <tr key={side}>
                <td style={{ ...tdStyle, fontWeight: 700, color }}>{label}</td>
                <td style={tdStyle}>{r?.intensidade || '—'}</td>
                <td style={tdStyle}>{r?.monossilabos || '—'}</td>
                <td style={tdStyle}>{r?.dissilabos || '—'}</td>
                <td style={tdStyle}>{r?.mascaramento || '—'}</td>
                <td style={tdStyle}>{r?.palavras || '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Parecer Audiológico */}
      <div style={{ fontWeight: 700, fontSize: '10pt', margin: '8px 0 4px 0' }}>
        Parecer Audiológico
      </div>
      <div
        style={{
          fontSize: '9pt',
          color: '#000',
          whiteSpace: 'pre-wrap',
          minHeight: '48px',
          border: '1px solid #000',
          padding: '6px 8px',
        }}
      >
        {exam.report || '—'}
      </div>
      <p
        style={{
          fontSize: '7.5pt',
          color: '#64748b',
          marginTop: '4px',
          marginBottom: '0',
          textAlign: 'justify',
        }}
      >
        Laudo audiológico baseado em Lloyd e Kaplan (1978); Silman e Silverman (1997) adaptada de
        Carhart (1945) e Lloyd e Kaplan (1978); Jerger, Speaks, e Trammell (1968)
      </p>

      {/* Linhas de Assinatura */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '36px',
          gap: '40px',
          breakInside: 'avoid',
        }}
      >
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ borderTop: '1px solid #000', paddingTop: '4px', fontSize: '9pt' }}>
            Fonoaudiólogo
          </div>
          <div style={{ fontSize: '8.5pt', marginTop: '2px' }}>
            Dr. Milton Soares Pacheco — CRFa 3-11981-5
          </div>
        </div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ borderTop: '1px solid #000', paddingTop: '4px', fontSize: '9pt' }}>
            Cliente
          </div>
        </div>
      </div>

      {/* Rodapé */}
      <div
        style={{
          marginTop: '14px',
          paddingTop: '6px',
          borderTop: '1px solid #94a3b8',
          fontSize: '8pt',
          color: '#475569',
          textAlign: 'center',
        }}
      >
        Endereço: R. Sadoc Correa, 373 - St. Central, Araguaína - TO, 77803-060 &nbsp;Telefone: (63)
        3421-2611
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
