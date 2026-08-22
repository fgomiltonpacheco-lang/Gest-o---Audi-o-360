import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from 'pdf-lib'
import type {
  AudiometryExamFull,
  Patient,
  ClinicSettings,
  AudiogramMap,
  AudiogramSymbol,
} from '@/types'
import type { ImitPrintData } from '@/components/print/ImitanciometriaPrint'
import { formatDate, maskCPF } from '@/lib/formatters'
import { mediaTritonal } from '@/lib/audiogram'

/** Cores padrão para preenchimento */
const COLOR_BLACK = rgb(0, 0, 0)
const COLOR_RED = rgb(0.86, 0.15, 0.15) // #dc2626
const COLOR_BLUE = rgb(0.15, 0.39, 0.92) // #2563eb
const COLOR_SLATE = rgb(0.3, 0.35, 0.4)

export interface ProfessionalData {
  name: string
  crmCrfa?: string
}

/** Posição X,Y (em pontos) de um campo de preenchimento no template PDF. */
export interface PdfCoordPoint {
  x: number
  y: number
}

/** Caixa de um gráfico de audiometria no template PDF. */
export interface PdfChartBox {
  left: number
  top: number
  width: number
  height: number
}

/** Linha da tabela IPRF (Índice de Reconhecimento de Fala). */
export interface PdfIprfRow {
  intensidadeX: number
  dissilabosX: number
  monossilabosX: number
  mascaramentoX: number
  y: number
}

/** Linha de reflexos estapédicos (ipsi e contralateral). */
export interface PdfReflexosRow {
  ipsiX: number
  contraX: number
  y: number
}

/** Resumo de timpanometria: tipo da curva + medidas. */
export interface PdfTimpanometriaCoords {
  tipoCurva: PdfCoordPoint
  volumeMeato: PdfCoordPoint
  complacencia: PdfCoordPoint
  pressaoPico: PdfCoordPoint
}

/**
 * Coordenadas de preenchimento do template de AUDIOMETRIA.
 *
 * Todos os valores são em pontos (pt) com origem no canto inferior esquerdo
 * da página (padrão pdf-lib). Quando `coordinates` for omitido, a função
 * utiliza os valores padrão calibrados para um template A4 (595 x 842 pt).
 * Forneça `coordinates` para ajustar as posições a um template personalizado.
 */
export interface AudiometriaCoordinates {
  nome: PdfCoordPoint
  data: PdfCoordPoint
  cpf: PdfCoordPoint
  nascimento: PdfCoordPoint
  sexoF: PdfCoordPoint
  sexoM: PdfCoordPoint
  convenio: PdfCoordPoint
  audiometro: PdfCoordPoint
  calibracao: PdfCoordPoint
  graficoOD: PdfChartBox
  graficoOE: PdfChartBox
  mtOD: PdfCoordPoint
  lrfOD: PdfCoordPoint
  ldvOD: PdfCoordPoint
  mtOE: PdfCoordPoint
  lrfOE: PdfCoordPoint
  ldvOE: PdfCoordPoint
  iprfOD: PdfIprfRow
  iprfOE: PdfIprfRow
  parecer: PdfCoordPoint
  assinaturaNome: PdfCoordPoint
  assinaturaCrfa: PdfCoordPoint
  rodape: PdfCoordPoint
}

/**
 * Coordenadas de preenchimento do template de IMITANCIOMETRIA.
 *
 * Mesma convenção de `AudiometriaCoordinates`: valores em pontos (pt), origem
 * no canto inferior esquerdo. Quando omitido, utiliza os valores padrão
 * calibrados para um template A4 (595 x 842 pt).
 */
export interface ImitanciometriaCoordinates {
  nome: PdfCoordPoint
  data: PdfCoordPoint
  cpf: PdfCoordPoint
  nascimento: PdfCoordPoint
  equipamento: PdfCoordPoint
  timpanometriaOD: PdfTimpanometriaCoords
  timpanometriaOE: PdfTimpanometriaCoords
  reflexosOD: PdfReflexosRow
  reflexosOE: PdfReflexosRow
  parecer: PdfCoordPoint
  assinaturaNome: PdfCoordPoint
  assinaturaCrfa: PdfCoordPoint
  rodape: PdfCoordPoint
}

/**
 * Funções auxiliares de desenho em PDF para audiometria
 */
function drawText(
  page: PDFPage,
  text: string | number | undefined | null,
  x: number,
  y: number,
  font: PDFFont,
  size = 9,
  color = COLOR_BLACK,
) {
  if (text === undefined || text === null || text === '') return
  page.drawText(String(text), {
    x,
    y,
    size,
    font,
    color,
  })
}

/**
 * Converte frequência em coordenada X do gráfico do audiograma
 */
const AUDIOGRAM_FREQS = [
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
function getFreqX(freq: string, chartLeft: number, chartWidth: number): number {
  const minLog = Math.log2(250)
  const maxLog = Math.log2(8000)
  const norm = (Math.log2(Number(freq)) - minLog) / (maxLog - minLog)
  return chartLeft + norm * chartWidth
}

/**
 * Converte decibéis em coordenada Y do gráfico do audiograma (topo = -10 dB, fundo = 120 dB)
 */
function getDbY(db: number, chartTop: number, chartHeight: number): number {
  const norm = (db - -10) / (120 - -10)
  return chartTop - norm * chartHeight
}

/**
 * Desenha os pontos e linhas de audiometria (OD ou OE) sobre o template PDF
 */
function drawAudiogramCurve(
  page: PDFPage,
  font: PDFFont,
  air: AudiogramMap | undefined,
  bone: AudiogramMap | undefined,
  chartLeft: number,
  chartTop: number,
  chartWidth: number,
  chartHeight: number,
  side: 'OD' | 'OE',
) {
  const color = side === 'OD' ? COLOR_RED : COLOR_BLUE

  // 1. Linhas e pontos de via aérea
  if (air) {
    const validPoints: {
      freq: string
      db: number
      symbol?: AudiogramSymbol
      x: number
      y: number
    }[] = []
    for (const f of AUDIOGRAM_FREQS) {
      const pt = air[f]
      if (pt && pt.db !== null && pt.db !== undefined) {
        const x = getFreqX(f, chartLeft, chartWidth)
        const y = getDbY(pt.db, chartTop, chartHeight)
        validPoints.push({ freq: f, db: pt.db, symbol: pt.symbol, x, y })
      }
    }

    // Desenha linhas conectando pontos contíguos (quebra em ausentes)
    for (let i = 0; i < validPoints.length - 1; i++) {
      const p1 = validPoints[i]
      const p2 = validPoints[i + 1]
      const isNoResp =
        p1.symbol === 'no_response' ||
        p1.symbol === 'masked_no_response' ||
        p2.symbol === 'no_response' ||
        p2.symbol === 'masked_no_response'
      if (!isNoResp) {
        page.drawLine({
          start: { x: p1.x, y: p1.y },
          end: { x: p2.x, y: p2.y },
          thickness: 1.2,
          color,
          dashArray: side === 'OE' ? [3, 2] : undefined,
        })
      }
    }

    // Desenha símbolos nos pontos
    for (const p of validPoints) {
      const isNoResp = p.symbol === 'no_response' || p.symbol === 'masked_no_response'
      const isMasked = p.symbol === 'masked' || p.symbol === 'masked_no_response'

      if (side === 'OD') {
        if (isMasked) {
          // Triângulo △
          page.drawLine({
            start: { x: p.x, y: p.y + 4 },
            end: { x: p.x - 4, y: p.y - 3 },
            thickness: 1.2,
            color,
          })
          page.drawLine({
            start: { x: p.x - 4, y: p.y - 3 },
            end: { x: p.x + 4, y: p.y - 3 },
            thickness: 1.2,
            color,
          })
          page.drawLine({
            start: { x: p.x + 4, y: p.y - 3 },
            end: { x: p.x, y: p.y + 4 },
            thickness: 1.2,
            color,
          })
        } else {
          // Círculo ○
          page.drawCircle({
            x: p.x,
            y: p.y,
            size: 3.5,
            borderColor: color,
            borderWidth: 1.2,
          })
        }
      } else {
        // OE: ✕ ou □
        if (isMasked) {
          // Quadrado □
          page.drawRectangle({
            x: p.x - 3.5,
            y: p.y - 3.5,
            width: 7,
            height: 7,
            borderColor: color,
            borderWidth: 1.2,
          })
        } else {
          // X
          page.drawLine({
            start: { x: p.x - 3.5, y: p.y - 3.5 },
            end: { x: p.x + 3.5, y: p.y + 3.5 },
            thickness: 1.2,
            color,
          })
          page.drawLine({
            start: { x: p.x - 3.5, y: p.y + 3.5 },
            end: { x: p.x + 3.5, y: p.y - 3.5 },
            thickness: 1.2,
            color,
          })
        }
      }

      // Seta para baixo se ausente (no_response)
      if (isNoResp) {
        page.drawLine({
          start: { x: p.x, y: p.y - 4 },
          end: { x: p.x, y: p.y - 10 },
          thickness: 1.2,
          color,
        })
        page.drawLine({
          start: { x: p.x - 2.5, y: p.y - 7 },
          end: { x: p.x, y: p.y - 10 },
          thickness: 1.2,
          color,
        })
        page.drawLine({
          start: { x: p.x + 2.5, y: p.y - 7 },
          end: { x: p.x, y: p.y - 10 },
          thickness: 1.2,
          color,
        })
      }
    }
  }

  // 2. Pontos de via óssea (<, [, >, ])
  if (bone) {
    const boneFreqs = ['500', '1000', '2000', '3000', '4000']
    for (const f of boneFreqs) {
      const pt = bone[f]
      if (pt && pt.db !== null && pt.db !== undefined) {
        const x = getFreqX(f, chartLeft, chartWidth)
        const y = getDbY(pt.db, chartTop, chartHeight)
        const isMasked = pt.symbol === 'masked' || pt.symbol === 'masked_no_response'

        if (side === 'OD') {
          if (isMasked) {
            // [ (deslocado levemente à esquerda)
            drawText(page, '[', x - 7, y - 3.5, font, 9, color)
          } else {
            // <
            drawText(page, '<', x - 7, y - 3.5, font, 9, color)
          }
        } else {
          if (isMasked) {
            // ] (deslocado levemente à direita)
            drawText(page, ']', x + 3, y - 3.5, font, 9, color)
          } else {
            // >
            drawText(page, '>', x + 3, y - 3.5, font, 9, color)
          }
        }
      }
    }
  }
}

/**
 * Preenche o PDF template de AUDIOMETRIA com dados do exame e paciente
 */
export async function fillAudiometriaTemplatePdf(
  templatePdfBytes: ArrayBuffer | Uint8Array,
  data: {
    exam: AudiometryExamFull
    patient?: Patient | null
    clinicSettings?: ClinicSettings | null
    professional?: ProfessionalData | null
    /**
     * Coordenadas de preenchimento opcionais. Quando fornecidas, sobrescrevem
     * os valores padrão calibrados para um template A4 (595 x 842 pt),
     * permitindo ajustar as posições a um template personalizado.
     */
    coordinates?: AudiometriaCoordinates
  },
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(templatePdfBytes)
  const pages = pdfDoc.getPages()
  if (pages.length === 0) throw new Error('O PDF template não contém páginas.')

  const page = pages[0]
  const { width, height } = page.getSize()

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const exam = data.exam
  const patient = data.patient
  const clinic = data.clinicSettings
  const prof = data.professional

  // Normalização de dados
  const patientName = patient?.name || exam.patientName || ''
  const patientCpf = maskCPF(patient?.cpf || exam.cpf || '')
  const patientDob = formatDate(patient?.birthDate || exam.dob || '')
  const patientSex = (patient?.gender || exam.sex || '').toUpperCase()
  const isFemale = patientSex.startsWith('F')
  const isMale = patientSex.startsWith('M')
  const patientConvenio =
    patient?.planName || patient?.planType || (exam as any).convenio || 'Particular'
  const examDate = formatDate(exam.date) || formatDate(new Date().toISOString())

  const audiometer = exam.audiometer || clinic?.audiometro || 'Não informado'
  const calibration = exam.calibration
    ? formatDate(exam.calibration)
    : clinic?.calibracao || 'Não informada'
  const specialistName = prof?.name || clinic?.especialista_nome || ''
  const specialistCrfa = (prof?.crmCrfa || clinic?.especialista_crfa || '').replace(/^crfa\s*/i, '')

  // Cálculo da MT (Média Tritonal)
  const mtOD = exam.mt_od ?? mediaTritonal(exam.air_od)
  const mtOE = exam.mt_oe ?? mediaTritonal(exam.air_oe)
  const formatDb = (val: number | null | undefined) =>
    val !== null && val !== undefined ? `${val}` : '—'

  const lrfOD = exam.lrf_od ?? exam.srt_od
  const lrfOE = exam.lrf_oe ?? exam.srt_oe

  const odVocal = exam.iprf_vocal?.od ?? {
    intensidade: '',
    dissilabos: '',
    monossilabos: '',
    mascaramento: '',
  }
  const oeVocal = exam.iprf_vocal?.oe ?? {
    intensidade: '',
    dissilabos: '',
    monossilabos: '',
    mascaramento: '',
  }

  // Coordenadas de preenchimento — valores padrão calibrados para um template
  // A4 (595 x 842 pt). Podem ser sobrescritos via `data.coordinates` para
  // ajustar as posições a um template personalizado.
  const c = data.coordinates
  const cNome = c?.nome ?? { x: 80, y: height - 128 }
  const cData = c?.data ?? { x: 480, y: height - 128 }
  const cCpf = c?.cpf ?? { x: 75, y: height - 146 }
  const cNasc = c?.nascimento ?? { x: 235, y: height - 146 }
  const cSexoF = c?.sexoF ?? { x: 370, y: height - 146 }
  const cSexoM = c?.sexoM ?? { x: 403, y: height - 146 }
  const cConvenio = c?.convenio ?? { x: 495, y: height - 146 }
  const cAudiometro = c?.audiometro ?? { x: 105, y: height - 165 }
  const cCalibracao = c?.calibracao ?? { x: 470, y: height - 165 }
  const cGraficoOD = c?.graficoOD ?? { left: 58, top: height - 208, width: 220, height: 155 }
  const cGraficoOE = c?.graficoOE ?? { left: 328, top: height - 208, width: 220, height: 155 }
  const cMtOD = c?.mtOD ?? { x: 78, y: height - 390 }
  const cLrfOD = c?.lrfOD ?? { x: 153, y: height - 390 }
  const cLdvOD = c?.ldvOD ?? { x: 232, y: height - 390 }
  const cMtOE = c?.mtOE ?? { x: 348, y: height - 390 }
  const cLrfOE = c?.lrfOE ?? { x: 423, y: height - 390 }
  const cLdvOE = c?.ldvOE ?? { x: 502, y: height - 390 }
  const cIprfOD = c?.iprfOD ?? {
    intensidadeX: 98,
    dissilabosX: 148,
    monossilabosX: 198,
    mascaramentoX: 248,
    y: height - 440,
  }
  const cIprfOE = c?.iprfOE ?? {
    intensidadeX: 98,
    dissilabosX: 148,
    monossilabosX: 198,
    mascaramentoX: 248,
    y: height - 456,
  }
  const cParecer = c?.parecer ?? { x: 50, y: height - 520 }

  // 1. Dados do Cabeçalho
  drawText(page, patientName, cNome.x, cNome.y, helveticaBold, 9)
  drawText(page, examDate, cData.x, cData.y, helvetica, 9)
  drawText(page, patientCpf, cCpf.x, cCpf.y, helvetica, 9)
  drawText(page, patientDob, cNasc.x, cNasc.y, helvetica, 9)

  // Sexo (marcação F / M)
  if (isFemale) drawText(page, 'X', cSexoF.x, cSexoF.y, helveticaBold, 9)
  if (isMale) drawText(page, 'X', cSexoM.x, cSexoM.y, helveticaBold, 9)

  drawText(page, patientConvenio, cConvenio.x, cConvenio.y, helvetica, 9)

  // Audiômetro e Calibração
  drawText(page, audiometer, cAudiometro.x, cAudiometro.y, helvetica, 8.5)
  drawText(page, calibration, cCalibracao.x, cCalibracao.y, helvetica, 8.5)

  // 2. Gráficos de Audiometria (OD e OE)
  // Gráfico OD: X aprox 52 a 280, Y topo aprox height - 205 a height - 370 (altura ~165 pt, largura ~230 pt)
  drawAudiogramCurve(
    page,
    helvetica,
    exam.air_od,
    exam.bone_od,
    cGraficoOD.left,
    cGraficoOD.top,
    cGraficoOD.width,
    cGraficoOD.height,
    'OD',
  )

  // Gráfico OE: X aprox 325 a 555
  drawAudiogramCurve(
    page,
    helvetica,
    exam.air_oe,
    exam.bone_oe,
    cGraficoOE.left,
    cGraficoOE.top,
    cGraficoOE.width,
    cGraficoOE.height,
    'OE',
  )

  // 3. Indicadores MT, LRF, LDV abaixo dos gráficos
  drawText(page, formatDb(mtOD), cMtOD.x, cMtOD.y, helveticaBold, 8.5, COLOR_RED)
  drawText(page, formatDb(lrfOD), cLrfOD.x, cLrfOD.y, helveticaBold, 8.5, COLOR_RED)
  drawText(page, formatDb(exam.ldv_od), cLdvOD.x, cLdvOD.y, helveticaBold, 8.5, COLOR_RED)

  drawText(page, formatDb(mtOE), cMtOE.x, cMtOE.y, helveticaBold, 8.5, COLOR_BLUE)
  drawText(page, formatDb(lrfOE), cLrfOE.x, cLrfOE.y, helveticaBold, 8.5, COLOR_BLUE)
  drawText(page, formatDb(exam.ldv_oe), cLdvOE.x, cLdvOE.y, helveticaBold, 8.5, COLOR_BLUE)

  // 4. Tabela IPRF (Índice de Reconhecimento de Fala)
  // Linha OD
  drawText(
    page,
    odVocal.intensidade ? `${odVocal.intensidade} dB` : '',
    cIprfOD.intensidadeX,
    cIprfOD.y,
    helveticaBold,
    8,
    COLOR_RED,
  )
  drawText(
    page,
    odVocal.dissilabos ? `${odVocal.dissilabos} %` : '',
    cIprfOD.dissilabosX,
    cIprfOD.y,
    helveticaBold,
    8,
    COLOR_RED,
  )
  drawText(
    page,
    odVocal.monossilabos ? `${odVocal.monossilabos} %` : '',
    cIprfOD.monossilabosX,
    cIprfOD.y,
    helveticaBold,
    8,
    COLOR_RED,
  )
  drawText(
    page,
    odVocal.mascaramento ? `${odVocal.mascaramento} dB` : '',
    cIprfOD.mascaramentoX,
    cIprfOD.y,
    helveticaBold,
    8,
    COLOR_BLUE,
  )

  // Linha OE
  drawText(
    page,
    oeVocal.intensidade ? `${oeVocal.intensidade} dB` : '',
    cIprfOE.intensidadeX,
    cIprfOE.y,
    helveticaBold,
    8,
    COLOR_BLUE,
  )
  drawText(
    page,
    oeVocal.dissilabos ? `${oeVocal.dissilabos} %` : '',
    cIprfOE.dissilabosX,
    cIprfOE.y,
    helveticaBold,
    8,
    COLOR_BLUE,
  )
  drawText(
    page,
    oeVocal.monossilabos ? `${oeVocal.monossilabos} %` : '',
    cIprfOE.monossilabosX,
    cIprfOE.y,
    helveticaBold,
    8,
    COLOR_BLUE,
  )
  drawText(
    page,
    oeVocal.mascaramento ? `${oeVocal.mascaramento} dB` : '',
    cIprfOE.mascaramentoX,
    cIprfOE.y,
    helveticaBold,
    8,
    COLOR_RED,
  )

  // 5. Parecer Audiológico
  if (exam.report) {
    const lines = exam.report.split('\n')
    let currentY = cParecer.y
    for (const line of lines) {
      if (currentY < cParecer.y - 80) break
      drawText(page, line, cParecer.x, currentY, helvetica, 8)
      currentY -= 11
    }
  }

  // 6. Assinatura do Especialista
  if (specialistName) {
    const nameWidth = helveticaBold.widthOfTextAtSize(specialistName, 9)
    const sigNome = c?.assinaturaNome
    const nameX = sigNome ? sigNome.x : (width - nameWidth) / 2
    const nameY = sigNome ? sigNome.y : height - 690
    drawText(page, specialistName, nameX, nameY, helveticaBold, 9)
    if (specialistCrfa) {
      const crfaText = `(CRFa ${specialistCrfa})`
      const crfaWidth = helvetica.widthOfTextAtSize(crfaText, 8)
      const sigCrfa = c?.assinaturaCrfa
      const crfaX = sigCrfa ? sigCrfa.x : (width - crfaWidth) / 2
      const crfaY = sigCrfa ? sigCrfa.y : height - 716
      drawText(page, crfaText, crfaX, crfaY, helvetica, 8)
    }
  }

  // 7. Endereço e Dados da Clínica no Rodapé
  const clinicAddress = clinic?.endereco || ''
  if (clinicAddress) {
    const addrWidth = helvetica.widthOfTextAtSize(clinicAddress, 7.5)
    const rodape = c?.rodape
    const addrX = rodape ? rodape.x : (width - addrWidth) / 2
    const addrY = rodape ? rodape.y : 35
    drawText(page, clinicAddress, addrX, addrY, helvetica, 7.5, COLOR_SLATE)
  }

  return await pdfDoc.save()
}

/**
 * Preenche o PDF template de IMITANCIOMETRIA com dados do exame e paciente
 */
export async function fillImitanciometriaTemplatePdf(
  templatePdfBytes: ArrayBuffer | Uint8Array,
  data: {
    data: ImitPrintData
    patient?: Patient | null
    clinicSettings?: ClinicSettings | null
    professional?: ProfessionalData | null
    /**
     * Coordenadas de preenchimento opcionais. Quando fornecidas, sobrescrevem
     * os valores padrão calibrados para um template A4 (595 x 842 pt),
     * permitindo ajustar as posições a um template personalizado.
     */
    coordinates?: ImitanciometriaCoordinates
  },
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(templatePdfBytes)
  const pages = pdfDoc.getPages()
  if (pages.length === 0) throw new Error('O PDF template não contém páginas.')

  const page = pages[0]
  const { width, height } = page.getSize()

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const d = data.data
  const patient = data.patient
  const clinic = data.clinicSettings
  const prof = data.professional

  // Dados cadastrais
  const patientName = d.paciente_nome || patient?.name || ''
  const patientCpf = maskCPF(d.paciente_cpf || patient?.cpf || '')
  const patientDob = formatDate(d.paciente_nascimento || patient?.birthDate || '')
  const examDate = formatDate(d.data_exame) || formatDate(new Date().toISOString())
  const specialistName = d.especialista_nome || prof?.name || clinic?.especialista_nome || ''
  const specialistCrfa = (prof?.crmCrfa || clinic?.especialista_crfa || '').replace(/^crfa\s*/i, '')
  const equipment = d.equipment_nome || clinic?.audiometro || 'Não informado'

  // Coordenadas de preenchimento — valores padrão calibrados para um template
  // A4 (595 x 842 pt). Podem ser sobrescritos via `data.coordinates` para
  // ajustar as posições a um template personalizado.
  const c = data.coordinates
  const cNome = c?.nome ?? { x: 80, y: height - 128 }
  const cData = c?.data ?? { x: 480, y: height - 128 }
  const cCpf = c?.cpf ?? { x: 75, y: height - 146 }
  const cNasc = c?.nascimento ?? { x: 235, y: height - 146 }
  const cEquip = c?.equipamento ?? { x: 105, y: height - 165 }
  const cTimpOD = c?.timpanometriaOD ?? {
    tipoCurva: { x: 140, y: height - 220 },
    volumeMeato: { x: 140, y: height - 245 },
    complacencia: { x: 140, y: height - 262 },
    pressaoPico: { x: 140, y: height - 279 },
  }
  const cTimpOE = c?.timpanometriaOE ?? {
    tipoCurva: { x: 410, y: height - 220 },
    volumeMeato: { x: 410, y: height - 245 },
    complacencia: { x: 410, y: height - 262 },
    pressaoPico: { x: 410, y: height - 279 },
  }
  const cReflOD = c?.reflexosOD ?? { ipsiX: 130, contraX: 190, y: height - 340 }
  const cReflOE = c?.reflexosOE ?? { ipsiX: 400, contraX: 460, y: height - 340 }
  const cParecer = c?.parecer ?? { x: 50, y: height - 440 }

  // Cabeçalho
  drawText(page, patientName, cNome.x, cNome.y, helveticaBold, 9)
  drawText(page, examDate, cData.x, cData.y, helvetica, 9)
  drawText(page, patientCpf, cCpf.x, cCpf.y, helvetica, 9)
  drawText(page, patientDob, cNasc.x, cNasc.y, helvetica, 9)
  drawText(page, equipment, cEquip.x, cEquip.y, helvetica, 8.5)

  // Resumos de Timpanometria
  const timpOD = d.timpanometria?.od
  const timpOE = d.timpanometria?.oe

  drawText(
    page,
    d.tipo_curva_od || timpOD?.tipo_curva || 'A',
    cTimpOD.tipoCurva.x,
    cTimpOD.tipoCurva.y,
    helveticaBold,
    11,
    COLOR_RED,
  )
  drawText(
    page,
    d.tipo_curva_oe || timpOE?.tipo_curva || 'A',
    cTimpOE.tipoCurva.x,
    cTimpOE.tipoCurva.y,
    helveticaBold,
    11,
    COLOR_BLUE,
  )

  if (timpOD) {
    drawText(
      page,
      timpOD.volume_meato ? `${timpOD.volume_meato} ml` : '—',
      cTimpOD.volumeMeato.x,
      cTimpOD.volumeMeato.y,
      helvetica,
      8.5,
    )
    drawText(
      page,
      timpOD.complacencia ? `${timpOD.complacencia} ml` : '—',
      cTimpOD.complacencia.x,
      cTimpOD.complacencia.y,
      helvetica,
      8.5,
    )
    drawText(
      page,
      timpOD.pressao_pico ? `${timpOD.pressao_pico} daPa` : '—',
      cTimpOD.pressaoPico.x,
      cTimpOD.pressaoPico.y,
      helvetica,
      8.5,
    )
  }

  if (timpOE) {
    drawText(
      page,
      timpOE.volume_meato ? `${timpOE.volume_meato} ml` : '—',
      cTimpOE.volumeMeato.x,
      cTimpOE.volumeMeato.y,
      helvetica,
      8.5,
    )
    drawText(
      page,
      timpOE.complacencia ? `${timpOE.complacencia} ml` : '—',
      cTimpOE.complacencia.x,
      cTimpOE.complacencia.y,
      helvetica,
      8.5,
    )
    drawText(
      page,
      timpOE.pressao_pico ? `${timpOE.pressao_pico} daPa` : '—',
      cTimpOE.pressaoPico.x,
      cTimpOE.pressaoPico.y,
      helvetica,
      8.5,
    )
  }

  // Reflexos Estapédicos
  const reflOD = d.reflexos?.od
  const reflOE = d.reflexos?.oe
  if (reflOD) {
    drawText(
      page,
      reflOD.ipsi_1000 ? `${reflOD.ipsi_1000}` : '—',
      cReflOD.ipsiX,
      cReflOD.y,
      helvetica,
      8,
    )
    drawText(
      page,
      reflOD.contra_1000 ? `${reflOD.contra_1000}` : '—',
      cReflOD.contraX,
      cReflOD.y,
      helvetica,
      8,
    )
  }
  if (reflOE) {
    drawText(
      page,
      reflOE.ipsi_1000 ? `${reflOE.ipsi_1000}` : '—',
      cReflOE.ipsiX,
      cReflOE.y,
      helvetica,
      8,
    )
    drawText(
      page,
      reflOE.contra_1000 ? `${reflOE.contra_1000}` : '—',
      cReflOE.contraX,
      cReflOE.y,
      helvetica,
      8,
    )
  }

  // Conclusão / Laudo
  const laudo = d.laudo || d.observacoes || ''
  if (laudo) {
    const lines = laudo.split('\n')
    let currentY = cParecer.y
    for (const line of lines) {
      if (currentY < cParecer.y - 110) break
      drawText(page, line, cParecer.x, currentY, helvetica, 8)
      currentY -= 11
    }
  }

  // Assinatura
  if (specialistName) {
    const nameWidth = helveticaBold.widthOfTextAtSize(specialistName, 9)
    const sigNome = c?.assinaturaNome
    const nameX = sigNome ? sigNome.x : (width - nameWidth) / 2
    const nameY = sigNome ? sigNome.y : height - 690
    drawText(page, specialistName, nameX, nameY, helveticaBold, 9)
    if (specialistCrfa) {
      const crfaText = `(CRFa ${specialistCrfa})`
      const crfaWidth = helvetica.widthOfTextAtSize(crfaText, 8)
      const sigCrfa = c?.assinaturaCrfa
      const crfaX = sigCrfa ? sigCrfa.x : (width - crfaWidth) / 2
      const crfaY = sigCrfa ? sigCrfa.y : height - 716
      drawText(page, crfaText, crfaX, crfaY, helvetica, 8)
    }
  }

  // Rodapé
  const clinicAddress = clinic?.endereco || ''
  if (clinicAddress) {
    const addrWidth = helvetica.widthOfTextAtSize(clinicAddress, 7.5)
    const rodape = c?.rodape
    const addrX = rodape ? rodape.x : (width - addrWidth) / 2
    const addrY = rodape ? rodape.y : 35
    drawText(page, clinicAddress, addrX, addrY, helvetica, 7.5, COLOR_SLATE)
  }

  return await pdfDoc.save()
}

/**
 * Abre o buffer PDF gerado em uma nova aba para visualização e impressão direta
 */
export function openPdfInNewTab(pdfBytes: Uint8Array, filename = 'laudo.pdf') {
  const blob = new Blob([pdfBytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const win = window.open(url, '_blank')
  if (!win) {
    // Se popup foi bloqueado, cria link para download/abertura
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.target = '_blank'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }
}
