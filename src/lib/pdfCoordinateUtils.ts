/**
 * Utilitários para calibração de coordenadas dos templates PDF de laudo.
 *
 * - DEFAULT_AUDIOMETRIA / DEFAULT_IMITANCIOMETRIA: coordenadas padrão em pt
 *   (origem no canto inferior esquerdo do PDF, convenção pdf-lib) calibradas
 *   para um template A4 (595 x 842 pt). Devem estar em sincronia com os
 *   fallbacks usados em `pdfTemplateFiller.ts`.
 * - mergeAudiometria / mergeImitanciometria: mescla coordenadas salvas no
 *   PocketBase sobre os defaults, preenchendo campos ausentes.
 * - Conversões tela <-> PDF: o preview renderiza o PDF com origem no canto
 *   superior esquerdo (CSS); o PDF usa origem no canto inferior esquerdo.
 *   A conversão precisa de `pdfHeight` e do `zoom` (ou dimensões do canvas).
 */

import type {
  AudiometriaCoordinates,
  ImitanciometriaCoordinates,
  PdfCoordPoint,
  PdfChartBox,
  PdfIprfRow,
  PdfReflexosRow,
  PdfTimpanometriaCoords,
} from '@/lib/pdfTemplateFiller'

/** Altura padrão A4 em pontos (595 x 842 pt). */
export const PDF_A4_HEIGHT = 842
export const PDF_A4_WIDTH = 595

// ============================================================
// DEFAULTS — Audiometria (sincronizar com pdfTemplateFiller.ts)
// ============================================================
export const DEFAULT_AUDIOMETRIA: AudiometriaCoordinates = {
  nome: { x: 80, y: 714 },
  data: { x: 480, y: 714 },
  cpf: { x: 75, y: 696 },
  nascimento: { x: 235, y: 696 },
  sexoF: { x: 370, y: 696 },
  sexoM: { x: 403, y: 696 },
  convenio: { x: 495, y: 696 },
  audiometro: { x: 105, y: 677 },
  calibracao: { x: 470, y: 677 },
  graficoOD: { left: 58, top: 634, width: 220, height: 155 },
  graficoOE: { left: 328, top: 634, width: 220, height: 155 },
  mtOD: { x: 78, y: 452 },
  lrfOD: { x: 153, y: 452 },
  ldvOD: { x: 232, y: 452 },
  mtOE: { x: 348, y: 452 },
  lrfOE: { x: 423, y: 452 },
  ldvOE: { x: 502, y: 452 },
  iprfOD: { intensidadeX: 98, dissilabosX: 148, monossilabosX: 198, mascaramentoX: 248, y: 402 },
  iprfOE: { intensidadeX: 98, dissilabosX: 148, monossilabosX: 198, mascaramentoX: 248, y: 386 },
  parecer: { x: 50, y: 322 },
  assinaturaNome: { x: 247, y: 152 },
  assinaturaCrfa: { x: 247, y: 126 },
  rodape: { x: 247, y: 35 },
}

// ============================================================
// DEFAULTS — Imitanciometria (sincronizar com pdfTemplateFiller.ts)
// ============================================================
export const DEFAULT_IMITANCIOMETRIA: ImitanciometriaCoordinates = {
  nome: { x: 80, y: 714 },
  data: { x: 480, y: 714 },
  cpf: { x: 75, y: 696 },
  nascimento: { x: 235, y: 696 },
  equipamento: { x: 105, y: 677 },
  timpanometriaOD: {
    tipoCurva: { x: 140, y: 622 },
    volumeMeato: { x: 140, y: 597 },
    complacencia: { x: 140, y: 580 },
    pressaoPico: { x: 140, y: 563 },
  },
  timpanometriaOE: {
    tipoCurva: { x: 410, y: 622 },
    volumeMeato: { x: 410, y: 597 },
    complacencia: { x: 410, y: 580 },
    pressaoPico: { x: 410, y: 563 },
  },
  reflexosOD: { ipsiX: 130, contraX: 190, y: 502 },
  reflexosOE: { ipsiX: 400, contraX: 460, y: 502 },
  parecer: { x: 50, y: 402 },
  assinaturaNome: { x: 247, y: 152 },
  assinaturaCrfa: { x: 247, y: 126 },
  rodape: { x: 247, y: 35 },
}

// ============================================================
// Merge: coordenadas salvas sobre defaults (deep merge por campo)
// ============================================================
function mergePoint(base: PdfCoordPoint, saved?: Partial<PdfCoordPoint>): PdfCoordPoint {
  if (!saved) return base
  return {
    x: typeof saved.x === 'number' ? saved.x : base.x,
    y: typeof saved.y === 'number' ? saved.y : base.y,
  }
}

function mergeBox(base: PdfChartBox, saved?: Partial<PdfChartBox>): PdfChartBox {
  if (!saved) return base
  return {
    left: typeof saved.left === 'number' ? saved.left : base.left,
    top: typeof saved.top === 'number' ? saved.top : base.top,
    width: typeof saved.width === 'number' ? saved.width : base.width,
    height: typeof saved.height === 'number' ? saved.height : base.height,
  }
}

function mergeIprf(base: PdfIprfRow, saved?: Partial<PdfIprfRow>): PdfIprfRow {
  if (!saved) return base
  return {
    intensidadeX: typeof saved.intensidadeX === 'number' ? saved.intensidadeX : base.intensidadeX,
    dissilabosX: typeof saved.dissilabosX === 'number' ? saved.dissilabosX : base.dissilabosX,
    monossilabosX:
      typeof saved.monossilabosX === 'number' ? saved.monossilabosX : base.monossilabosX,
    mascaramentoX:
      typeof saved.mascaramentoX === 'number' ? saved.mascaramentoX : base.mascaramentoX,
    y: typeof saved.y === 'number' ? saved.y : base.y,
  }
}

function mergeReflexos(base: PdfReflexosRow, saved?: Partial<PdfReflexosRow>): PdfReflexosRow {
  if (!saved) return base
  return {
    ipsiX: typeof saved.ipsiX === 'number' ? saved.ipsiX : base.ipsiX,
    contraX: typeof saved.contraX === 'number' ? saved.contraX : base.contraX,
    y: typeof saved.y === 'number' ? saved.y : base.y,
  }
}

function mergeTimpan(
  base: PdfTimpanometriaCoords,
  saved?: Partial<PdfTimpanometriaCoords>,
): PdfTimpanometriaCoords {
  if (!saved) return base
  return {
    tipoCurva: mergePoint(base.tipoCurva, saved.tipoCurva),
    volumeMeato: mergePoint(base.volumeMeato, saved.volumeMeato),
    complacencia: mergePoint(base.complacencia, saved.complacencia),
    pressaoPico: mergePoint(base.pressaoPico, saved.pressaoPico),
  }
}

export function mergeAudiometria(saved?: Record<string, unknown> | null): AudiometriaCoordinates {
  if (!saved) return structuredClone(DEFAULT_AUDIOMETRIA)
  const d = DEFAULT_AUDIOMETRIA
  const s = saved as Partial<AudiometriaCoordinates>
  return {
    nome: mergePoint(d.nome, s.nome),
    data: mergePoint(d.data, s.data),
    cpf: mergePoint(d.cpf, s.cpf),
    nascimento: mergePoint(d.nascimento, s.nascimento),
    sexoF: mergePoint(d.sexoF, s.sexoF),
    sexoM: mergePoint(d.sexoM, s.sexoM),
    convenio: mergePoint(d.convenio, s.convenio),
    audiometro: mergePoint(d.audiometro, s.audiometro),
    calibracao: mergePoint(d.calibracao, s.calibracao),
    graficoOD: mergeBox(d.graficoOD, s.graficoOD),
    graficoOE: mergeBox(d.graficoOE, s.graficoOE),
    mtOD: mergePoint(d.mtOD, s.mtOD),
    lrfOD: mergePoint(d.lrfOD, s.lrfOD),
    ldvOD: mergePoint(d.ldvOD, s.ldvOD),
    mtOE: mergePoint(d.mtOE, s.mtOE),
    lrfOE: mergePoint(d.lrfOE, s.lrfOE),
    ldvOE: mergePoint(d.ldvOE, s.ldvOE),
    iprfOD: mergeIprf(d.iprfOD, s.iprfOD),
    iprfOE: mergeIprf(d.iprfOE, s.iprfOE),
    parecer: mergePoint(d.parecer, s.parecer),
    assinaturaNome: mergePoint(d.assinaturaNome, s.assinaturaNome),
    assinaturaCrfa: mergePoint(d.assinaturaCrfa, s.assinaturaCrfa),
    rodape: mergePoint(d.rodape, s.rodape),
  }
}

export function mergeImitanciometria(
  saved?: Record<string, unknown> | null,
): ImitanciometriaCoordinates {
  if (!saved) return structuredClone(DEFAULT_IMITANCIOMETRIA)
  const d = DEFAULT_IMITANCIOMETRIA
  const s = saved as Partial<ImitanciometriaCoordinates>
  return {
    nome: mergePoint(d.nome, s.nome),
    data: mergePoint(d.data, s.data),
    cpf: mergePoint(d.cpf, s.cpf),
    nascimento: mergePoint(d.nascimento, s.nascimento),
    equipamento: mergePoint(d.equipamento, s.equipamento),
    timpanometriaOD: mergeTimpan(d.timpanometriaOD, s.timpanometriaOD),
    timpanometriaOE: mergeTimpan(d.timpanometriaOE, s.timpanometriaOE),
    reflexosOD: mergeReflexos(d.reflexosOD, s.reflexosOD),
    reflexosOE: mergeReflexos(d.reflexosOE, s.reflexosOE),
    parecer: mergePoint(d.parecer, s.parecer),
    assinaturaNome: mergePoint(d.assinaturaNome, s.assinaturaNome),
    assinaturaCrfa: mergePoint(d.assinaturaCrfa, s.assinaturaCrfa),
    rodape: mergePoint(d.rodape, s.rodape),
  }
}

// ============================================================
// Conversões tela (CSS, origem topo-esquerda) <-> PDF (origem rodapé-esquerda)
// ============================================================

/**
 * Converte uma posição em pixels do canvas (origem topo-esquerda) para
 * coordenada em pontos do PDF (origem rodapé-esquerdo).
 *
 * @param screenX Posição X em px no canvas
 * @param screenY Posição Y em px no canvas
 * @param canvasWidth Largura renderizada do canvas em px
 * @param canvasHeight Altura renderizada do canvas em px
 * @param pdfWidth Largura do PDF em pt (ex.: 595 para A4)
 * @param pdfHeight Altura do PDF em pt (ex.: 842 para A4)
 */
export function screenToPdfPoint(
  screenX: number,
  screenY: number,
  canvasWidth: number,
  canvasHeight: number,
  pdfWidth: number,
  pdfHeight: number,
): PdfCoordPoint {
  const x = (screenX / canvasWidth) * pdfWidth
  // Y do PDF = distância a partir do rodapé. No canvas, Y=0 é o topo,
  // que corresponde a pdfHeight no PDF. Invertemos.
  const y = pdfHeight - (screenY / canvasHeight) * pdfHeight
  return { x, y }
}

/**
 * Converte coordenada em pontos do PDF (origem rodapé-esquerdo) para
 * posição em pixels do canvas (origem topo-esquerda).
 */
export function pdfToScreenPoint(
  pt: PdfCoordPoint,
  canvasWidth: number,
  canvasHeight: number,
  pdfWidth: number,
  pdfHeight: number,
): { left: number; top: number } {
  const left = (pt.x / pdfWidth) * canvasWidth
  const top = pdfHeight - pt.y // distância do topo em pt
  const topPx = (top / pdfHeight) * canvasHeight
  return { left, top: topPx }
}

/**
 * Converte uma caixa (graficoOD/OE) do PDF para retângulo no canvas.
 */
export function pdfBoxToScreen(
  box: PdfChartBox,
  canvasWidth: number,
  canvasHeight: number,
  pdfWidth: number,
  pdfHeight: number,
): { left: number; top: number; width: number; height: number } {
  const left = (box.left / pdfWidth) * canvasWidth
  const width = (box.width / pdfWidth) * canvasWidth
  // top no PDF = distância do topo até o topo da caixa (origem rodapé).
  // O "top" do PdfChartBox é a coordenada Y do topo da caixa (em pt, origem rodapé).
  const topInScreenFromTop = pdfHeight - box.top
  const topPx = (topInScreenFromTop / pdfHeight) * canvasHeight
  const heightPx = (box.height / pdfHeight) * canvasHeight
  return { left, top: topPx, width, height: heightPx }
}

/** Arredonda para 1 casa decimal (pt). */
export function round1(n: number): number {
  return Math.round(n * 10) / 10
}
