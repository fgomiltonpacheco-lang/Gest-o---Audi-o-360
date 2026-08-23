import React from 'react'
import type {
  AudiometryExamFull,
  Patient,
  ClinicSettings,
  AudiogramMap,
  AudiogramSymbol,
} from '@/types'
import { formatDate, maskCPF } from '@/lib/formatters'
import { mediaTritonal } from '@/lib/audiogram'
import logoImg from '@/assets/audicao-360-logo-para-papel-timbrado-da364.png'

export interface ProfessionalInfo {
  name: string
  crmCrfa?: string
  role?: string
}

export interface LaudoAudiometricoHTMLProps {
  exam: AudiometryExamFull
  patient?: Patient | null
  clinicSettings?: ClinicSettings | null
  professional?: ProfessionalInfo | null
  /** Se deve renderizar controles em tela (botão Imprimir, etc) ou se é apenas o documento para impressão */
  hideControls?: boolean
  onPrint?: () => void
}

const FREQUENCIES = ['250', '500', '1000', '2000', '3000', '4000', '6000', '8000'] as const
const BONE_FREQUENCIES = ['500', '1000', '2000', '3000', '4000'] as const
const BONE_FREQ_SET = new Set<string>(BONE_FREQUENCIES)

const DEFAULT_SPECIALIST = 'Dr. Milton Cesar de Oliveira'
const DEFAULT_CRFA = '19.294'

function formatVal(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '—'
  // Se for número inteiro, mostra inteiro; se tiver decimal, mostra 1 casa decimal
  if (Number.isInteger(val)) return `${val}`
  return val.toFixed(1)
}

function formatDbCell(
  map: AudiogramMap | undefined,
  freq: string,
): { text: string; symbol?: AudiogramSymbol } {
  if (!map || !map[freq]) return { text: '—' }
  const pt = map[freq]
  if (pt.db === null || pt.db === undefined) return { text: '—' }
  const formatted = Number.isInteger(pt.db) ? `${pt.db}` : pt.db.toFixed(1)
  return { text: formatted, symbol: pt.symbol }
}

function formatMascCell(map: AudiogramMap | undefined, freq: string): string {
  if (!map || !map[freq]) return '—'
  const pt = map[freq]
  if (pt.symbol === 'masked' || pt.symbol === 'masked_no_response') {
    return pt.db !== null && pt.db !== undefined ? `${pt.db}` : 'Sim'
  }
  return '—'
}

export const LaudoAudiometricoHTML: React.FC<LaudoAudiometricoHTMLProps> = ({
  exam,
  patient,
  clinicSettings,
  professional,
}) => {
  // Logo e dados da clínica
  const clinicLogo = clinicSettings?.logo_url || logoImg
  const clinicName =
    clinicSettings?.nome?.trim() || clinicSettings?.nome_clinica?.trim() || 'Audição360'

  // Dados do paciente
  const patientName = patient?.name || exam.patientName || '—'
  const patientCpf = exam.cpf || patient?.cpf ? maskCPF(exam.cpf || patient?.cpf || '') : '—'
  const patientSex = exam.sex || patient?.gender || '—'
  const patientDob =
    exam.dob || patient?.birthDate ? formatDate(exam.dob || patient?.birthDate) : '—'
  const patientDate = exam.date
    ? formatDate(exam.date)
    : formatDate(new Date().toISOString().split('T')[0])
  const patientConvenio =
    patient?.planType === 'Convênio'
      ? patient.planName || 'Convênio'
      : patient?.planType === 'SUS'
        ? 'SUS'
        : patient?.planType === 'Particular'
          ? 'Particular'
          : patient?.planType ||
            ((exam as unknown as Record<string, unknown>).convenio as string) ||
            'Particular'

  // Médias e Limiares OD
  const mtOD = exam.mt_od ?? mediaTritonal(exam.air_od)
  const lrfOD = exam.lrf_od ?? exam.srt_od
  const ldvOD = exam.ldv_od

  // Médias e Limiares OE
  const mtOE = exam.mt_oe ?? mediaTritonal(exam.air_oe)
  const lrfOE = exam.lrf_oe ?? exam.srt_oe
  const ldvOE = exam.ldv_oe

  // IPRF
  const vocalOD = exam.iprf_vocal?.od || {
    intensidade: '',
    monossilabos: '',
    dissilabos: '',
    mascaramento: '',
  }
  const vocalOE = exam.iprf_vocal?.oe || {
    intensidade: '',
    monossilabos: '',
    dissilabos: '',
    mascaramento: '',
  }

  // Equipamento
  const audiometro =
    exam.audiometer?.trim() || clinicSettings?.audiometro?.trim() || 'R27a Resonance'
  const calibracao = exam.calibration?.trim()
    ? formatDate(exam.calibration)
    : clinicSettings?.calibracao?.trim() || 'Vigente'

  // Profissional
  const profName =
    professional?.name?.trim() || clinicSettings?.especialista_nome?.trim() || DEFAULT_SPECIALIST
  const profCrfa =
    professional?.crmCrfa?.trim() || clinicSettings?.especialista_crfa?.trim() || DEFAULT_CRFA
  const formattedCrfa = profCrfa.replace(/^crfa\s*/i, '').trim()

  return (
    <div className="laudo-html-container bg-white text-black p-4 sm:p-8 max-w-[210mm] mx-auto min-h-[297mm] shadow-none print:shadow-none print:p-0 print:m-0 font-serif leading-tight">
      {/* Estilo embutido para controle exato de impressão e tipografia A4 */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm 15mm 12mm 15mm;
          }
          body {
            font-family: "Times New Roman", Times, Georgia, serif !important;
            color: #000 !important;
            background: #fff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .laudo-html-container {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
          }
          .no-print, header, nav, aside {
            display: none !important;
          }
        }
        .laudo-serif {
          font-family: "Times New Roman", Times, Georgia, serif;
        }
      `}</style>

      {/* ==================== 1. CABEÇALHO ==================== */}
      <header className="border-b-2 border-black pb-3 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {clinicLogo ? (
              <img
                src={clinicLogo}
                alt={clinicName}
                className="max-h-14 max-w-[180px] object-contain"
              />
            ) : (
              <span className="text-xl font-bold tracking-tight uppercase text-black">
                {clinicName}
              </span>
            )}
          </div>
          <div className="flex-1 text-center pr-12">
            <h1 className="text-xl sm:text-2xl font-bold uppercase tracking-wider text-black">
              LAUDO AUDIOLÓGICO
            </h1>
            <p className="text-xs text-neutral-600 uppercase tracking-widest mt-0.5">
              Exame Audiométrico Tonal &amp; Vocal
            </p>
          </div>
        </div>
      </header>

      {/* ==================== 2. DADOS DO PACIENTE ==================== */}
      <section className="border border-black rounded-none p-2.5 mb-4 text-[12px] bg-neutral-50/30">
        <div className="grid grid-cols-12 gap-y-1.5 gap-x-2">
          {/* Linha 1: Nome (col-8) e Data (col-4) */}
          <div className="col-span-8 flex items-baseline">
            <span className="font-bold min-w-[55px]">Nome:</span>
            <span className="border-b border-dotted border-black flex-1 font-semibold pl-1">
              {patientName}
            </span>
          </div>
          <div className="col-span-4 flex items-baseline">
            <span className="font-bold min-w-[40px]">Data:</span>
            <span className="border-b border-dotted border-black flex-1 text-center font-semibold">
              {patientDate}
            </span>
          </div>

          {/* Linha 2: Convênio (col-6) e CPF (col-6) */}
          <div className="col-span-6 flex items-baseline">
            <span className="font-bold min-w-[70px]">Convênio:</span>
            <span className="border-b border-dotted border-black flex-1 pl-1">
              {patientConvenio}
            </span>
          </div>
          <div className="col-span-6 flex items-baseline">
            <span className="font-bold min-w-[40px]">CPF:</span>
            <span className="border-b border-dotted border-black flex-1 pl-1">{patientCpf}</span>
          </div>

          {/* Linha 3: Sexo (col-6) e D.N. (col-6) */}
          <div className="col-span-6 flex items-baseline">
            <span className="font-bold min-w-[45px]">Sexo:</span>
            <span className="border-b border-dotted border-black flex-1 pl-1">{patientSex}</span>
          </div>
          <div className="col-span-6 flex items-baseline">
            <span className="font-bold min-w-[40px]">D.N.:</span>
            <span className="border-b border-dotted border-black flex-1 pl-1">{patientDob}</span>
          </div>
        </div>
      </section>

      {/* ==================== 3. TABELA DE AUDIOMETRIA TONAL ==================== */}
      <section className="mb-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-black border-b border-black pb-0.5 mb-1 text-center">
          Audiometria Tonal Liminar (dB NA)
        </h2>
        <table className="w-full border-collapse border border-black text-[11px] text-center">
          <thead>
            {/* Linha Superior: Orelhas */}
            <tr className="bg-neutral-100 border-b border-black">
              <th className="border border-black p-1 font-bold w-16" rowSpan={2}>
                Hz
              </th>
              <th className="border border-black p-1 font-bold text-red-700 uppercase" colSpan={3}>
                Orelha Direita (OD)
              </th>
              <th className="border border-black p-1 font-bold text-blue-700 uppercase" colSpan={3}>
                Orelha Esquerda (OE)
              </th>
            </tr>
            {/* Linha Subtítulos: VA / VO / Masc */}
            <tr className="bg-neutral-50 border-b border-black text-[10px]">
              <th className="border border-black p-0.5 font-bold">Via Aérea</th>
              <th className="border border-black p-0.5 font-bold">Via Óssea</th>
              <th className="border border-black p-0.5 font-bold">Masc.</th>
              <th className="border border-black p-0.5 font-bold">Via Aérea</th>
              <th className="border border-black p-0.5 font-bold">Via Óssea</th>
              <th className="border border-black p-0.5 font-bold">Masc.</th>
            </tr>
          </thead>
          <tbody>
            {FREQUENCIES.map((freq) => {
              const vaOD = formatDbCell(exam.air_od, freq)
              const voOD = BONE_FREQ_SET.has(freq)
                ? formatDbCell(exam.bone_od, freq)
                : { text: '—' }
              const mascOD = formatMascCell(exam.air_od, freq)

              const vaOE = formatDbCell(exam.air_oe, freq)
              const voOE = BONE_FREQ_SET.has(freq)
                ? formatDbCell(exam.bone_oe, freq)
                : { text: '—' }
              const mascOE = formatMascCell(exam.air_oe, freq)

              return (
                <tr key={freq} className="hover:bg-neutral-50/50">
                  <td className="border border-black p-1 font-bold bg-neutral-50">{freq} Hz</td>
                  <td className="border border-black p-1 font-semibold text-red-900">
                    {vaOD.text}
                  </td>
                  <td className="border border-black p-1 font-semibold text-red-900">
                    {voOD.text}
                  </td>
                  <td className="border border-black p-1 text-neutral-600 text-[10px]">{mascOD}</td>
                  <td className="border border-black p-1 font-semibold text-blue-900">
                    {vaOE.text}
                  </td>
                  <td className="border border-black p-1 font-semibold text-blue-900">
                    {voOE.text}
                  </td>
                  <td className="border border-black p-1 text-neutral-600 text-[10px]">{mascOE}</td>
                </tr>
              )
            })}
          </tbody>
          {/* Linhas de Médias e Limiares Vocais */}
          <tfoot>
            <tr className="bg-neutral-100 border-t-2 border-black font-bold">
              <td className="border border-black p-1 text-left font-bold pl-2">MT (dB)</td>
              <td className="border border-black p-1 text-red-900" colSpan={3}>
                {formatVal(mtOD)} dB
              </td>
              <td className="border border-black p-1 text-blue-900" colSpan={3}>
                {formatVal(mtOE)} dB
              </td>
            </tr>
            <tr className="bg-neutral-50 font-bold">
              <td className="border border-black p-1 text-left font-bold pl-2">LRF (dB)</td>
              <td className="border border-black p-1 text-red-900" colSpan={3}>
                {formatVal(lrfOD)} dB
              </td>
              <td className="border border-black p-1 text-blue-900" colSpan={3}>
                {formatVal(lrfOE)} dB
              </td>
            </tr>
            <tr className="bg-neutral-100 font-bold">
              <td className="border border-black p-1 text-left font-bold pl-2">LDV (dB)</td>
              <td className="border border-black p-1 text-red-900" colSpan={3}>
                {formatVal(ldvOD)} dB
              </td>
              <td className="border border-black p-1 text-blue-900" colSpan={3}>
                {formatVal(ldvOE)} dB
              </td>
            </tr>
          </tfoot>
        </table>
        <p className="text-[9px] text-neutral-500 italic mt-0.5">
          * MT: Média Tritonal (500, 1000 e 2000 Hz) | LRF: Limiar de Recepção de Fala | LDV: Limiar
          de Detecção de Voz
        </p>
      </section>

      {/* ==================== 4. TABELA IRF (Índice de Reconhecimento de Fala) ==================== */}
      <section className="mb-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-black border-b border-black pb-0.5 mb-1 text-center">
          Índice de Reconhecimento de Fala (IRF / IPRF)
        </h2>
        <table className="w-full border-collapse border border-black text-[11px] text-center">
          <thead>
            <tr className="bg-neutral-100 border-b border-black">
              <th className="border border-black p-1 font-bold text-left pl-2 w-1/3">Parâmetro</th>
              <th className="border border-black p-1 font-bold text-red-700 w-1/3 uppercase">
                Orelha Direita (OD)
              </th>
              <th className="border border-black p-1 font-bold text-blue-700 w-1/3 uppercase">
                Orelha Esquerda (OE)
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-black p-1 text-left font-semibold pl-2">
                Intensidade (dB)
              </td>
              <td className="border border-black p-1 text-red-900 font-semibold">
                {vocalOD.intensidade ? `${vocalOD.intensidade} dB` : '—'}
              </td>
              <td className="border border-black p-1 text-blue-900 font-semibold">
                {vocalOE.intensidade ? `${vocalOE.intensidade} dB` : '—'}
              </td>
            </tr>
            <tr className="bg-neutral-50/50">
              <td className="border border-black p-1 text-left font-semibold pl-2">
                Monossílabos (%)
              </td>
              <td className="border border-black p-1 text-red-900 font-semibold">
                {vocalOD.monossilabos ? `${vocalOD.monossilabos}%` : '—'}
              </td>
              <td className="border border-black p-1 text-blue-900 font-semibold">
                {vocalOE.monossilabos ? `${vocalOE.monossilabos}%` : '—'}
              </td>
            </tr>
            <tr>
              <td className="border border-black p-1 text-left font-semibold pl-2">
                Dissílabos (%)
              </td>
              <td className="border border-black p-1 text-red-900 font-semibold">
                {vocalOD.dissilabos ? `${vocalOD.dissilabos}%` : '—'}
              </td>
              <td className="border border-black p-1 text-blue-900 font-semibold">
                {vocalOE.dissilabos ? `${vocalOE.dissilabos}%` : '—'}
              </td>
            </tr>
            <tr className="bg-neutral-50/50">
              <td className="border border-black p-1 text-left font-semibold pl-2">
                Mascaramento (%)
              </td>
              <td className="border border-black p-1 text-red-900 font-semibold">
                {vocalOD.mascaramento ? `${vocalOD.mascaramento} dB` : '—'}
              </td>
              <td className="border border-black p-1 text-blue-900 font-semibold">
                {vocalOE.mascaramento ? `${vocalOE.mascaramento} dB` : '—'}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* ==================== 5. PARECER AUDIOLÓGICO ==================== */}
      <section className="mb-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-black border-b border-black pb-0.5 mb-1">
          Parecer Audiológico
        </h2>
        <div className="border border-black p-2.5 min-h-[75px] text-[11px] leading-relaxed text-justify whitespace-pre-wrap bg-neutral-50/20">
          {exam.report && exam.report.trim() ? (
            exam.report
          ) : (
            <span className="italic text-neutral-500">
              Limiares auditivos dentro dos padrões de normalidade bilateralmente.
            </span>
          )}
        </div>
        <div className="mt-1 text-[9px] text-neutral-700 leading-tight space-y-0.5">
          <p>• Classificação do grau da perda auditiva segundo Lloyd e Kaplan (1978).</p>
          <p>
            • Classificação do tipo de perda auditiva quanto ao reconhecimento de fala, segundo
            Jerger e Jerger.
          </p>
        </div>
      </section>

      {/* ==================== 6. EQUIPAMENTO (RODAPÉ TÉCNICO) ==================== */}
      <section className="border-t border-black pt-1.5 mb-6 text-[10px] text-neutral-800">
        <div className="flex items-center justify-between">
          <div>
            <span className="font-bold">Audiômetro:</span> {audiometro}
          </div>
          <div>
            <span className="font-bold">Calibração:</span> {calibracao}
          </div>
        </div>
      </section>

      {/* ==================== 7. RODAPÉ E ASSINATURA ==================== */}
      <footer className="pt-2">
        <div className="max-w-[280px] mx-auto text-center">
          <div className="border-t border-black pt-1">
            <p className="text-[12px] font-bold text-black uppercase">{profName}</p>
            <p className="text-[10px] text-neutral-700">Fonoaudiólogo(a)</p>
            <p className="text-[10px] text-neutral-700 font-semibold">CRFa: {formattedCrfa}</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default LaudoAudiometricoHTML
