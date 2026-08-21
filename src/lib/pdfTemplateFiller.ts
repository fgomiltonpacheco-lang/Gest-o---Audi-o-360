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

  // Coordenadas calibradas baseadas no template padrão A4 (595 x 842 pt)
  // 1. Dados do Cabeçalho
  drawText(page, patientName, 80, height - 128, helveticaBold, 9)
  drawText(page, examDate, 480, height - 128, helvetica, 9)
  drawText(page, patientCpf, 75, height - 146, helvetica, 9)
  drawText(page, patientDob, 235, height - 146, helvetica, 9)

  // Sexo (marcação F / M)
  if (isFemale) drawText(page, 'X', 370, height - 146, helveticaBold, 9)
  if (isMale) drawText(page, 'X', 403, height - 146, helveticaBold, 9)

  drawText(page, patientConvenio, 495, height - 146, helvetica, 9)

  // Audiômetro e Calibração
  drawText(page, audiometer, 105, height - 165, helvetica, 8.5)
  drawText(page, calibration, 470, height - 165, helvetica, 8.5)

  // 2. Gráficos de Audiometria (OD e OE)
  // Gráfico OD: X aprox 52 a 280, Y topo aprox height - 205 a height - 370 (altura ~165 pt, largura ~230 pt)
  const chartWidth = 220
  const chartHeight = 155
  const chartODLeft = 58
  const chartODTop = height - 208

  drawAudiogramCurve(
    page,
    helvetica,
    exam.air_od,
    exam.bone_od,
    chartODLeft,
    chartODTop,
    chartWidth,
    chartHeight,
    'OD',
  )

  // Gráfico OE: X aprox 325 a 555
  const chartOELeft = 328
  const chartOETop = height - 208
  drawAudiogramCurve(
    page,
    helvetica,
    exam.air_oe,
    exam.bone_oe,
    chartOELeft,
    chartOETop,
    chartWidth,
    chartHeight,
    'OE',
  )

  // 3. Indicadores MT, LRF, LDV abaixo dos gráficos
  drawText(page, formatDb(mtOD), 78, height - 390, helveticaBold, 8.5, COLOR_RED)
  drawText(page, formatDb(lrfOD), 153, height - 390, helveticaBold, 8.5, COLOR_RED)
  drawText(page, formatDb(exam.ldv_od), 232, height - 390, helveticaBold, 8.5, COLOR_RED)

  drawText(page, formatDb(mtOE), 348, height - 390, helveticaBold, 8.5, COLOR_BLUE)
  drawText(page, formatDb(lrfOE), 423, height - 390, helveticaBold, 8.5, COLOR_BLUE)
  drawText(page, formatDb(exam.ldv_oe), 502, height - 390, helveticaBold, 8.5, COLOR_BLUE)

  // 4. Tabela IPRF (Índice de Reconhecimento de Fala)
  // Linha OD
  drawText(
    page,
    odVocal.intensidade ? `${odVocal.intensidade} dB` : '',
    98,
    height - 440,
    helveticaBold,
    8,
    COLOR_RED,
  )
  drawText(
    page,
    odVocal.dissilabos ? `${odVocal.dissilabos} %` : '',
    148,
    height - 440,
    helveticaBold,
    8,
    COLOR_RED,
  )
  drawText(
    page,
    odVocal.monossilabos ? `${odVocal.monossilabos} %` : '',
    198,
    height - 440,
    helveticaBold,
    8,
    COLOR_RED,
  )
  drawText(
    page,
    odVocal.mascaramento ? `${odVocal.mascaramento} dB` : '',
    248,
    height - 440,
    helveticaBold,
    8,
    COLOR_BLUE,
  )

  // Linha OE
  drawText(
    page,
    oeVocal.intensidade ? `${oeVocal.intensidade} dB` : '',
    98,
    height - 456,
    helveticaBold,
    8,
    COLOR_BLUE,
  )
  drawText(
    page,
    oeVocal.dissilabos ? `${oeVocal.dissilabos} %` : '',
    148,
    height - 456,
    helveticaBold,
    8,
    COLOR_BLUE,
  )
  drawText(
    page,
    oeVocal.monossilabos ? `${oeVocal.monossilabos} %` : '',
    198,
    height - 456,
    helveticaBold,
    8,
    COLOR_BLUE,
  )
  drawText(
    page,
    oeVocal.mascaramento ? `${oeVocal.mascaramento} dB` : '',
    248,
    height - 456,
    helveticaBold,
    8,
    COLOR_RED,
  )

  // 5. Parecer Audiológico
  if (exam.report) {
    const lines = exam.report.split('\n')
    let currentY = height - 520
    for (const line of lines) {
      if (currentY < height - 600) break
      drawText(page, line, 50, currentY, helvetica, 8)
      currentY -= 11
    }
  }

  // 6. Assinatura do Especialista
  if (specialistName) {
    const nameWidth = helveticaBold.widthOfTextAtSize(specialistName, 9)
    drawText(page, specialistName, (width - nameWidth) / 2, height - 690, helveticaBold, 9)
    if (specialistCrfa) {
      const crfaText = `(CRFa ${specialistCrfa})`
      const crfaWidth = helvetica.widthOfTextAtSize(crfaText, 8)
      drawText(page, crfaText, (width - crfaWidth) / 2, height - 716, helvetica, 8)
    }
  }

  // 7. Endereço e Dados da Clínica no Rodapé
  const clinicAddress = clinic?.endereco || ''
  if (clinicAddress) {
    const addrWidth = helvetica.widthOfTextAtSize(clinicAddress, 7.5)
    drawText(page, clinicAddress, (width - addrWidth) / 2, 35, helvetica, 7.5, COLOR_SLATE)
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

  // Cabeçalho
  drawText(page, patientName, 80, height - 128, helveticaBold, 9)
  drawText(page, examDate, 480, height - 128, helvetica, 9)
  drawText(page, patientCpf, 75, height - 146, helvetica, 9)
  drawText(page, patientDob, 235, height - 146, helvetica, 9)
  drawText(page, equipment, 105, height - 165, helvetica, 8.5)

  // Resumos de Timpanometria
  const timpOD = d.timpanometria?.od
  const timpOE = d.timpanometria?.oe

  drawText(
    page,
    d.tipo_curva_od || timpOD?.tipo_curva || 'A',
    140,
    height - 220,
    helveticaBold,
    11,
    COLOR_RED,
  )
  drawText(
    page,
    d.tipo_curva_oe || timpOE?.tipo_curva || 'A',
    410,
    height - 220,
    helveticaBold,
    11,
    COLOR_BLUE,
  )

  if (timpOD) {
    drawText(
      page,
      timpOD.volume_meato ? `${timpOD.volume_meato} ml` : '—',
      140,
      height - 245,
      helvetica,
      8.5,
    )
    drawText(
      page,
      timpOD.complacencia ? `${timpOD.complacencia} ml` : '—',
      140,
      height - 262,
      helvetica,
      8.5,
    )
    drawText(
      page,
      timpOD.pressao_pico ? `${timpOD.pressao_pico} daPa` : '—',
      140,
      height - 279,
      helvetica,
      8.5,
    )
  }

  if (timpOE) {
    drawText(
      page,
      timpOE.volume_meato ? `${timpOE.volume_meato} ml` : '—',
      410,
      height - 245,
      helvetica,
      8.5,
    )
    drawText(
      page,
      timpOE.complacencia ? `${timpOE.complacencia} ml` : '—',
      410,
      height - 262,
      helvetica,
      8.5,
    )
    drawText(
      page,
      timpOE.pressao_pico ? `${timpOE.pressao_pico} daPa` : '—',
      410,
      height - 279,
      helvetica,
      8.5,
    )
  }

  // Reflexos Estapédicos
  const reflOD = d.reflexos?.od
  const reflOE = d.reflexos?.oe
  if (reflOD) {
    drawText(page, reflOD.ipsi_1000 ? `${reflOD.ipsi_1000}` : '—', 130, height - 340, helvetica, 8)
    drawText(
      page,
      reflOD.contra_1000 ? `${reflOD.contra_1000}` : '—',
      190,
      height - 340,
      helvetica,
      8,
    )
  }
  if (reflOE) {
    drawText(page, reflOE.ipsi_1000 ? `${reflOE.ipsi_1000}` : '—', 400, height - 340, helvetica, 8)
    drawText(
      page,
      reflOE.contra_1000 ? `${reflOE.contra_1000}` : '—',
      460,
      height - 340,
      helvetica,
      8,
    )
  }

  // Conclusão / Laudo
  const laudo = d.laudo || d.observacoes || ''
  if (laudo) {
    const lines = laudo.split('\n')
    let currentY = height - 440
    for (const line of lines) {
      if (currentY < height - 550) break
      drawText(page, line, 50, currentY, helvetica, 8)
      currentY -= 11
    }
  }

  // Assinatura
  if (specialistName) {
    const nameWidth = helveticaBold.widthOfTextAtSize(specialistName, 9)
    drawText(page, specialistName, (width - nameWidth) / 2, height - 690, helveticaBold, 9)
    if (specialistCrfa) {
      const crfaText = `(CRFa ${specialistCrfa})`
      const crfaWidth = helvetica.widthOfTextAtSize(crfaText, 8)
      drawText(page, crfaText, (width - crfaWidth) / 2, height - 716, helvetica, 8)
    }
  }

  // Rodapé
  const clinicAddress = clinic?.endereco || ''
  if (clinicAddress) {
    const addrWidth = helvetica.widthOfTextAtSize(clinicAddress, 7.5)
    drawText(page, clinicAddress, (width - addrWidth) / 2, 35, helvetica, 7.5, COLOR_SLATE)
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
