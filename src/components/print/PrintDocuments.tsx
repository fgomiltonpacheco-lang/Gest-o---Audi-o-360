import React from 'react'
import {
  Patient,
  ClinicalRecord,
  ClinicalEvolution,
  AudiometryExam,
  TympanometryExam,
  BeraExam,
  AudiometryExamFull,
  AIR_FREQS,
  BONE_FREQS,
} from '@/types'
import { formatDate, maskCPF, calculateAge } from '@/lib/formatters'
import { AudiogramChart } from '@/components/AudiogramChart'

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
    border: '1px solid #cbd5e1',
    padding: '3px 4px',
    background: '#f8fafc',
    fontSize: '8pt',
    fontWeight: 700,
    textAlign: 'center',
  }
  const tdStyle: React.CSSProperties = {
    border: '1px solid #cbd5e1',
    padding: '3px 4px',
    fontSize: '8pt',
    textAlign: 'center',
  }

  const fmtFreq = (f: string) => (Number(f) >= 1000 ? `${Number(f) / 1000}k` : f)

  const cellPoint = (freq: string, map: any) => {
    const p = map?.[freq]
    if (!p || p.db === null || p.db === undefined) return '—'
    const symMap: Record<string, string> = {
      normal: '',
      no_response: '↓',
      masked: 'm',
      masked_no_response: 'm↓',
    }
    const suffix = symMap[p.symbol] || ''
    return `${p.db}${suffix}`
  }

  return (
    <div style={{ color: '#1e293b', fontSize: '9pt' }}>
      {/* Cabeçalho de Identificação do Paciente detalhado */}
      <div
        style={{
          border: '1px solid #cbd5e1',
          borderRadius: '6px',
          padding: '8px 12px',
          background: '#f8fafc',
          marginBottom: '10px',
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '6px' }}>
          <div>
            <span style={{ color: '#64748b', fontSize: '8pt' }}>Nome: </span>
            <strong style={{ fontSize: '10pt', color: '#0f172a' }}>
              {exam.patientName || '—'}
            </strong>
          </div>
          <div>
            <span style={{ color: '#64748b', fontSize: '8pt' }}>CPF: </span>
            <strong>{maskCPF(exam.cpf) || '—'}</strong>
          </div>
          <div>
            <span style={{ color: '#64748b', fontSize: '8pt' }}>DN: </span>
            <strong>{formatDate(exam.dob) || '—'}</strong>
          </div>
          <div>
            <span style={{ color: '#64748b', fontSize: '8pt' }}>Idade / Sexo: </span>
            <strong>
              {exam.age ? `${exam.age} anos` : '—'} / {exam.sex || '—'}
            </strong>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1.5fr 1fr',
            gap: '6px',
            marginTop: '4px',
            paddingTop: '4px',
            borderTop: '1px solid #e2e8f0',
          }}
        >
          <div>
            <span style={{ color: '#64748b', fontSize: '8pt' }}>Encaminhado por: </span>
            <strong>{exam.referred_by || '—'}</strong>
          </div>
          <div>
            <span style={{ color: '#64748b', fontSize: '8pt' }}>Repouso 14h: </span>
            <strong>{exam.hearing_rest_14h ? 'Sim' : 'Não'}</strong>
          </div>
          <div>
            <span style={{ color: '#64748b', fontSize: '8pt' }}>Audiômetro: </span>
            <strong>{exam.audiometer || '—'}</strong>
          </div>
          <div>
            <span style={{ color: '#64748b', fontSize: '8pt' }}>Calibração: </span>
            <strong>{formatDate(exam.calibration) || '—'}</strong>
          </div>
        </div>
      </div>

      {/* Meatoscopia */}
      {sectionTitle('Meatoscopia / Otoscopia')}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '4px 20px',
          marginBottom: '8px',
        }}
      >
        <div>
          <span style={{ color: '#dc2626', fontWeight: 700 }}>Orelha Direita (OD): </span>
          <span>
            {exam.otoscopy_od || 'Normal'} {exam.otoscopy_od_obs ? `(${exam.otoscopy_od_obs})` : ''}
          </span>
        </div>
        <div>
          <span style={{ color: '#2563eb', fontWeight: 700 }}>Orelha Esquerda (OE): </span>
          <span>
            {exam.otoscopy_oe || 'Normal'} {exam.otoscopy_oe_obs ? `(${exam.otoscopy_oe_obs})` : ''}
          </span>
        </div>
      </div>

      {/* Gráficos de Audiograma Lado a Lado (OD Vermelho, OE Azul) */}
      {sectionTitle('Audiograma Tonal')}
      <div style={{ breakInside: 'avoid', marginBottom: '10px' }}>
        <AudiogramChart
          airOD={exam.air_od}
          airOE={exam.air_oe}
          boneOD={exam.bone_od}
          boneOE={exam.bone_oe}
          ldlOD={exam.ldl_od}
          ldlOE={exam.ldl_oe}
        />
      </div>

      {/* Tabelas de Limiares por Via Aérea, Óssea e LDL */}
      {sectionTitle('Limiares Auditivos e Desconforto (dB HL)')}
      <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: '10px' }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, width: '120px' }}>Via / Orelha</th>
            {AIR_FREQS.map((f) => (
              <th key={f} style={thStyle}>
                {fmtFreq(f)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ ...tdStyle, fontWeight: 700, color: '#dc2626', textAlign: 'left' }}>
              OD - Aérea
            </td>
            {AIR_FREQS.map((f) => (
              <td key={f} style={tdStyle}>
                {cellPoint(f, exam.air_od)}
              </td>
            ))}
          </tr>
          <tr>
            <td style={{ ...tdStyle, fontWeight: 700, color: '#2563eb', textAlign: 'left' }}>
              OE - Aérea
            </td>
            {AIR_FREQS.map((f) => (
              <td key={f} style={tdStyle}>
                {cellPoint(f, exam.air_oe)}
              </td>
            ))}
          </tr>
          <tr>
            <td style={{ ...tdStyle, fontWeight: 700, color: '#dc2626', textAlign: 'left' }}>
              OD - Óssea
            </td>
            {AIR_FREQS.map((f) => {
              const isBone = (BONE_FREQS as readonly string[]).includes(f)
              return (
                <td key={f} style={tdStyle}>
                  {isBone ? cellPoint(f, exam.bone_od) : '—'}
                </td>
              )
            })}
          </tr>
          <tr>
            <td style={{ ...tdStyle, fontWeight: 700, color: '#2563eb', textAlign: 'left' }}>
              OE - Óssea
            </td>
            {AIR_FREQS.map((f) => {
              const isBone = (BONE_FREQS as readonly string[]).includes(f)
              return (
                <td key={f} style={tdStyle}>
                  {isBone ? cellPoint(f, exam.bone_oe) : '—'}
                </td>
              )
            })}
          </tr>
          <tr>
            <td style={{ ...tdStyle, fontWeight: 700, color: '#dc2626', textAlign: 'left' }}>
              OD - LDL
            </td>
            {AIR_FREQS.map((f) => (
              <td key={f} style={tdStyle}>
                {cellPoint(f, exam.ldl_od)}
              </td>
            ))}
          </tr>
          <tr>
            <td style={{ ...tdStyle, fontWeight: 700, color: '#2563eb', textAlign: 'left' }}>
              OE - LDL
            </td>
            {AIR_FREQS.map((f) => (
              <td key={f} style={tdStyle}>
                {cellPoint(f, exam.ldl_oe)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      {/* Logoaudiometria e IPRF em um bloco compacto */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 2fr',
          gap: '12px',
          marginBottom: '10px',
        }}
      >
        <div>
          {sectionTitle('Limiares Vocais')}
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={thStyle}>Orelha</th>
                <th style={thStyle}>MT</th>
                <th style={thStyle}>LRF</th>
                <th style={thStyle}>LDV</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ ...tdStyle, fontWeight: 700, color: '#dc2626' }}>OD</td>
                <td style={tdStyle}>{exam.mt_od ?? '—'}</td>
                <td style={tdStyle}>{exam.lrf_od ?? '—'}</td>
                <td style={tdStyle}>{exam.ldv_od ?? '—'}</td>
              </tr>
              <tr>
                <td style={{ ...tdStyle, fontWeight: 700, color: '#2563eb' }}>OE</td>
                <td style={tdStyle}>{exam.mt_oe ?? '—'}</td>
                <td style={tdStyle}>{exam.lrf_oe ?? '—'}</td>
                <td style={tdStyle}>{exam.ldv_oe ?? '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div>
          {sectionTitle('IPRF — Reconhecimento de Fala')}
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={thStyle}>Orelha</th>
                <th style={thStyle}>Intens.</th>
                <th style={thStyle}>Monos.</th>
                <th style={thStyle}>Diss.</th>
                <th style={thStyle}>Masc.</th>
                <th style={thStyle}>Palavras</th>
              </tr>
            </thead>
            <tbody>
              {(['od', 'oe'] as const).map((side) => {
                const r: any = exam.iprf?.[side] || {}
                const label = side === 'od' ? 'OD' : 'OE'
                const color = side === 'od' ? '#dc2626' : '#2563eb'
                return (
                  <tr key={side}>
                    <td style={{ ...tdStyle, fontWeight: 700, color }}>{label}</td>
                    <td style={tdStyle}>{r.intensidade || '—'}</td>
                    <td style={tdStyle}>{r.monossilabos || '—'}</td>
                    <td style={tdStyle}>{r.dissilabos || '—'}</td>
                    <td style={tdStyle}>{r.mascaramento || '—'}</td>
                    <td style={tdStyle}>{r.palavras || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Parecer */}
      {sectionTitle('Parecer Audiológico')}
      <div
        style={{
          fontSize: '8.5pt',
          color: '#334155',
          whiteSpace: 'pre-wrap',
          minHeight: '36px',
          border: '1px solid #e2e8f0',
          padding: '6px 8px',
          borderRadius: '4px',
          background: '#fdfdfe',
        }}
      >
        {exam.report || 'Sem parecer cadastrado.'}
      </div>

      {/* Assinaturas */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '40px',
          gap: '40px',
          breakInside: 'avoid',
        }}
      >
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div
            style={{
              borderTop: '1px solid #475569',
              paddingTop: '4px',
              fontSize: '9pt',
              fontWeight: 600,
            }}
          >
            Fonoaudiólogo(a) Responsável
          </div>
        </div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div
            style={{
              borderTop: '1px solid #475569',
              paddingTop: '4px',
              fontSize: '9pt',
              fontWeight: 600,
            }}
          >
            Assinatura do Paciente / Responsável
          </div>
        </div>
      </div>

      {/* Rodapé clínica */}
      <div
        style={{
          marginTop: '16px',
          paddingTop: '6px',
          borderTop: '1px solid #cbd5e1',
          fontSize: '8pt',
          color: '#64748b',
          textAlign: 'center',
        }}
      >
        Audição360 — R. Sadoc Correa, 373 - St. Central, Araguaína - TO, 77803-060 • Telefone: (63)
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
