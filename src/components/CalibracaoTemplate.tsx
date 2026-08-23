import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Crosshair, Save, RotateCcw, Loader2, Info, Undo2, Redo2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useApp } from '@/context/AppContext'
import pb from '@/lib/pocketbase/client'
import type {
  AudiometriaCoordinates,
  ImitanciometriaCoordinates,
  PdfIprfRow,
  PdfReflexosRow,
  PdfTimpanometriaCoords,
} from '@/lib/pdfTemplateFiller'

// ─────────────────────────────────────────────────────────────
// Worker setup — pdfjs-dist v4.
// Vite trata `?url` como asset e devolve a URL final do bundle.
// ─────────────────────────────────────────────────────────────
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

export type TipoExameCalibracao = 'audiometria' | 'imitanciometria'

export interface CalibracaoTemplateProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tipo: TipoExameCalibracao
  /** URL do PDF template a exibir como fundo (blob: ou http). */
  templateUrl: string
}

// ─────────────────────────────────────────────────────────────
// Definição dos campos arrastáveis
// ─────────────────────────────────────────────────────────────

type FieldKind = 'point' | 'chart' | 'iprf' | 'reflexos' | 'timpano'

interface FieldDef {
  id: string
  label: string
  /** Rótulo curto para o badge dentro do retângulo. */
  short?: string
  kind: FieldKind
  /** Path dentro das coordenadas serializadas. */
  path: string
  /** Posição inicial (canto superior esquerdo, em pt, origem superior do PDF A4). */
  defaultX: number
  defaultY: number
  /** Largura/altura do retângulo em pt (escala nominal do PDF). */
  width: number
  height: number
  /** Cor do retângulo. */
  color?: string
}

/**
 * Resolução nominal do PDF (pt). Padrão A4 = 595 x 842 pt.
 * Usada apenas como fallback para os defaults; a altura real da página
 * renderizada é detectada em runtime.
 */
const PDF_NOMINAL_WIDTH = 595
const PDF_NOMINAL_HEIGHT = 842

// ─────────────────────────────────────────────────────────────
// Helpers de conversão.
// Internamente, positions[f.id] = { x, y } = canto superior esquerdo do
// retângulo em PT, com origem no TOPO do PDF (convenção CSS-like).
// Na serialização para o pdfTemplateFiller, convertemos Y para a origem
// inferior (canto inferior esquerdo), que é o padrão do pdf-lib.
// ─────────────────────────────────────────────────────────────

type FieldPositions = Record<string, { x: number; y: number }>

function isFiniteNum(v: unknown): v is number {
  return typeof v === 'number' && isFinite(v)
}

function toPtCoord(value: unknown): { x: number; y: number } | null {
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>
    if (isFiniteNum(o.x) && isFiniteNum(o.y)) {
      return { x: o.x as number, y: o.y as number }
    }
  }
  return null
}

function toChartBox(
  value: unknown,
): { left: number; top: number; width: number; height: number } | null {
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>
    if (
      isFiniteNum(o.left) &&
      isFiniteNum(o.top) &&
      isFiniteNum(o.width) &&
      isFiniteNum(o.height)
    ) {
      return {
        left: o.left as number,
        top: o.top as number,
        width: o.width as number,
        height: o.height as number,
      }
    }
  }
  return null
}

function toIprfRow(value: unknown): PdfIprfRow | null {
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>
    if (
      isFiniteNum(o.intensidadeX) &&
      isFiniteNum(o.dissilabosX) &&
      isFiniteNum(o.monossilabosX) &&
      isFiniteNum(o.mascaramentoX) &&
      isFiniteNum(o.y)
    ) {
      return o as unknown as PdfIprfRow
    }
  }
  return null
}

function toReflexosRow(value: unknown): PdfReflexosRow | null {
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>
    if (isFiniteNum(o.ipsiX) && isFiniteNum(o.contraX) && isFiniteNum(o.y)) {
      return o as unknown as PdfReflexosRow
    }
  }
  return null
}

function toTimpanoCoords(value: unknown): PdfTimpanometriaCoords | null {
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>
    const tipo = toPtCoord(o.tipoCurva)
    const vol = toPtCoord(o.volumeMeato)
    const compl = toPtCoord(o.complacencia)
    const pressao = toPtCoord(o.pressaoPico)
    if (tipo && vol && compl && pressao) {
      return {
        tipoCurva: tipo,
        volumeMeato: vol,
        complacencia: compl,
        pressaoPico: pressao,
      }
    }
  }
  return null
}

/**
 * Converte um objeto de coordenadas (origem inferior-esq, padrão pdf-lib)
 * para o estado interno de retângulos (canto sup-esq, origem superior, em pt).
 */
function coordsToPositions(
  coords:
    | AudiometriaCoordinates
    | ImitanciometriaCoordinates
    | Record<string, unknown>
    | null
    | undefined,
  fields: FieldDef[],
  pageHeightPt: number,
): FieldPositions {
  const out: FieldPositions = {}
  if (!coords) return out
  const c = coords as Record<string, unknown>

  for (const f of fields) {
    const raw = c[f.path]
    if (!raw) continue

    if (f.kind === 'point') {
      const p = toPtCoord(raw)
      if (p) {
        // ponto (x,y) origem inferior -> sup-esq do retângulo: (x - w/2, h - y - h/2)
        out[f.id] = {
          x: p.x - f.width / 2,
          y: pageHeightPt - p.y - f.height / 2,
        }
      }
    } else if (f.kind === 'chart') {
      const b = toChartBox(raw)
      if (b) {
        // chart.top já é origem superior; left também.
        out[f.id] = { x: b.left, y: b.top }
      }
    } else if (f.kind === 'iprf') {
      const r = toIprfRow(raw)
      if (r) {
        out[f.id] = {
          x: r.intensidadeX - f.width * 0.1,
          y: pageHeightPt - r.y - f.height / 2,
        }
      }
    } else if (f.kind === 'reflexos') {
      const r = toReflexosRow(raw)
      if (r) {
        out[f.id] = {
          x: r.ipsiX - f.width * 0.25,
          y: pageHeightPt - r.y - f.height / 2,
        }
      }
    } else if (f.kind === 'timpano') {
      const t = toTimpanoCoords(raw)
      if (t) {
        out[f.id] = {
          x: t.tipoCurva.x - f.width / 2,
          y: pageHeightPt - t.tipoCurva.y - f.height / 2,
        }
      }
    }
  }

  return out
}

/**
 * Converte o estado interno (canto sup-esq, origem superior, pt) de volta
 * para a convenção do pdfTemplateFiller (origem inferior-esq).
 */
function positionsToCoords(
  positions: FieldPositions,
  fields: FieldDef[],
  pageHeightPt: number,
): AudiometriaCoordinates | ImitanciometriaCoordinates {
  const out: Record<string, unknown> = {}

  for (const f of fields) {
    const pos = positions[f.id]
    if (!pos) continue

    const cx = pos.x + f.width / 2
    const cyTopCenter = pos.y + f.height / 2
    const cyBottomOrigin = pageHeightPt - cyTopCenter // y com origem inferior

    if (f.kind === 'point') {
      out[f.path] = { x: cx, y: cyBottomOrigin }
    } else if (f.kind === 'chart') {
      out[f.path] = {
        left: pos.x,
        top: pos.y,
        width: f.width,
        height: f.height,
      }
    } else if (f.kind === 'iprf') {
      const r: PdfIprfRow = {
        intensidadeX: pos.x + f.width * 0.1,
        dissilabosX: pos.x + f.width * 0.37,
        monossilabosX: pos.x + f.width * 0.63,
        mascaramentoX: pos.x + f.width * 0.9,
        y: cyBottomOrigin,
      }
      out[f.path] = r
    } else if (f.kind === 'reflexos') {
      const r: PdfReflexosRow = {
        ipsiX: pos.x + f.width * 0.25,
        contraX: pos.x + f.width * 0.75,
        y: cyBottomOrigin,
      }
      out[f.path] = r
    } else if (f.kind === 'timpano') {
      const subSpacing = f.height / 4
      const t: PdfTimpanometriaCoords = {
        tipoCurva: { x: cx, y: cyBottomOrigin },
        volumeMeato: { x: cx, y: cyBottomOrigin - subSpacing },
        complacencia: { x: cx, y: cyBottomOrigin - subSpacing * 2 },
        pressaoPico: { x: cx, y: cyBottomOrigin - subSpacing * 3 },
      }
      out[f.path] = t
    }
  }

  return out as unknown as AudiometriaCoordinates | ImitanciometriaCoordinates
}

// ─────────────────────────────────────────────────────────────
// Definições dos campos por tipo de exame.
// Default em PT (origem superior do PDF nominal A4 595x842).
// ─────────────────────────────────────────────────────────────

const AUDIO_FIELDS: FieldDef[] = [
  {
    id: 'nome',
    label: 'Nome do Paciente',
    short: 'Nome',
    kind: 'point',
    path: 'nome',
    defaultX: 70,
    defaultY: 120,
    width: 220,
    height: 14,
  },
  {
    id: 'cpf',
    label: 'CPF',
    short: 'CPF',
    kind: 'point',
    path: 'cpf',
    defaultX: 65,
    defaultY: 140,
    width: 110,
    height: 14,
  },
  {
    id: 'nascimento',
    label: 'Data Nascimento',
    short: 'Nasc.',
    kind: 'point',
    path: 'nascimento',
    defaultX: 225,
    defaultY: 140,
    width: 100,
    height: 14,
  },
  {
    id: 'sexo',
    label: 'Sexo (F/M)',
    short: 'Sexo',
    kind: 'point',
    path: 'sexoF',
    defaultX: 360,
    defaultY: 140,
    width: 50,
    height: 14,
  },
  {
    id: 'data',
    label: 'Data do Exame',
    short: 'Data Exame',
    kind: 'point',
    path: 'data',
    defaultX: 470,
    defaultY: 120,
    width: 100,
    height: 14,
  },
  {
    id: 'graficoOD',
    label: 'Gráfico OD (Via Aérea + Via Óssea)',
    short: 'OD Via Aérea/Óssea',
    kind: 'chart',
    path: 'graficoOD',
    defaultX: 48,
    defaultY: 195,
    width: 220,
    height: 155,
  },
  {
    id: 'graficoOE',
    label: 'Gráfico OE (Via Aérea + Via Óssea)',
    short: 'OE Via Aérea/Óssea',
    kind: 'chart',
    path: 'graficoOE',
    defaultX: 318,
    defaultY: 195,
    width: 220,
    height: 155,
  },
  {
    id: 'iprfOD',
    label: 'Tabela IPRF OD',
    short: 'IPRF OD',
    kind: 'iprf',
    path: 'iprfOD',
    defaultX: 78,
    defaultY: 430,
    width: 200,
    height: 14,
  },
  {
    id: 'iprfOE',
    label: 'Tabela IPRF OE',
    short: 'IPRF OE',
    kind: 'iprf',
    path: 'iprfOE',
    defaultX: 78,
    defaultY: 446,
    width: 200,
    height: 14,
  },
  {
    id: 'assinaturaNome',
    label: 'Assinatura (Nome)',
    short: 'Assinatura',
    kind: 'point',
    path: 'assinaturaNome',
    defaultX: 200,
    defaultY: 680,
    width: 200,
    height: 14,
  },
  {
    id: 'dataAssinatura',
    label: 'Data da Assinatura',
    short: 'Data Assin.',
    kind: 'point',
    path: 'assinaturaCrfa',
    defaultX: 400,
    defaultY: 700,
    width: 120,
    height: 14,
  },
]

const IMIT_FIELDS: FieldDef[] = [
  {
    id: 'nome',
    label: 'Nome do Paciente',
    short: 'Nome',
    kind: 'point',
    path: 'nome',
    defaultX: 70,
    defaultY: 120,
    width: 220,
    height: 14,
  },
  {
    id: 'cpf',
    label: 'CPF',
    short: 'CPF',
    kind: 'point',
    path: 'cpf',
    defaultX: 65,
    defaultY: 140,
    width: 110,
    height: 14,
  },
  {
    id: 'nascimento',
    label: 'Data Nascimento',
    short: 'Nasc.',
    kind: 'point',
    path: 'nascimento',
    defaultX: 225,
    defaultY: 140,
    width: 100,
    height: 14,
  },
  {
    id: 'data',
    label: 'Data do Exame',
    short: 'Data Exame',
    kind: 'point',
    path: 'data',
    defaultX: 470,
    defaultY: 120,
    width: 100,
    height: 14,
  },
  {
    id: 'timpanometriaOD',
    label: 'Bloco Timpanometria OD',
    short: 'Timpano OD',
    kind: 'timpano',
    path: 'timpanometriaOD',
    defaultX: 120,
    defaultY: 200,
    width: 80,
    height: 80,
  },
  {
    id: 'timpanometriaOE',
    label: 'Bloco Timpanometria OE',
    short: 'Timpano OE',
    kind: 'timpano',
    path: 'timpanometriaOE',
    defaultX: 390,
    defaultY: 200,
    width: 80,
    height: 80,
  },
  {
    id: 'reflexosOD',
    label: 'Reflexos Estapédicos OD',
    short: 'Reflexos OD',
    kind: 'reflexos',
    path: 'reflexosOD',
    defaultX: 110,
    defaultY: 320,
    width: 120,
    height: 14,
  },
  {
    id: 'reflexosOE',
    label: 'Reflexos Estapédicos OE',
    short: 'Reflexos OE',
    kind: 'reflexos',
    path: 'reflexosOE',
    defaultX: 380,
    defaultY: 320,
    width: 120,
    height: 14,
  },
  {
    id: 'assinaturaNome',
    label: 'Assinatura (Nome)',
    short: 'Assinatura',
    kind: 'point',
    path: 'assinaturaNome',
    defaultX: 200,
    defaultY: 680,
    width: 200,
    height: 14,
  },
  {
    id: 'dataAssinatura',
    label: 'Data da Assinatura',
    short: 'Data Assin.',
    kind: 'point',
    path: 'assinaturaCrfa',
    defaultX: 400,
    defaultY: 700,
    width: 120,
    height: 14,
  },
]

// ─────────────────────────────────────────────────────────────
// Drag & drop via pointer events (mouse + touch).
// ─────────────────────────────────────────────────────────────

interface DragState {
  fieldId: string
  startPointerX: number
  startPointerY: number
  startRectPxX: number // px (escala imagem)
  startRectPxY: number // px (escala imagem)
}

export function CalibracaoTemplate({
  open,
  onOpenChange,
  tipo,
  templateUrl,
}: CalibracaoTemplateProps) {
  const { toast } = useToast()
  const { clinicSettings, saveClinicSettings } = useApp()

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const dragStateRef = useRef<DragState | null>(null)

  const fields = useMemo<FieldDef[]>(
    () => (tipo === 'audiometria' ? AUDIO_FIELDS : IMIT_FIELDS),
    [tipo],
  )

  // Dimensões da imagem renderizada (px no DOM) e dimensões do PDF em pt.
  const [imgSize, setImgSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 })
  const [pdfDims, setPdfDims] = useState<{ w: number; h: number }>({
    w: PDF_NOMINAL_WIDTH,
    h: PDF_NOMINAL_HEIGHT,
  })
  // Escala: px por pt
  const scale = imgSize.w > 0 ? imgSize.w / pdfDims.w : 1

  // Posições dos retângulos, em PT (origem superior do PDF).
  const [positions, setPositions] = useState<FieldPositions>({})
  const [loading, setLoading] = useState(true)
  const [rendering, setRendering] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedField, setSelectedField] = useState<string | null>(null)

  // Histórico para undo/redo
  const [history, setHistory] = useState<FieldPositions[]>([])
  const [historyIdx, setHistoryIdx] = useState(-1)
  const pushHistory = useCallback(
    (pos: FieldPositions) => {
      setHistory((prev) => {
        const next = prev.slice(0, historyIdx + 1)
        next.push({ ...pos })
        setHistoryIdx(next.length - 1)
        return next
      })
    },
    [historyIdx],
  )
  const canUndo = historyIdx > 0
  const canRedo = historyIdx < history.length - 1
  const undo = () => {
    if (!canUndo) return
    const idx = historyIdx - 1
    setHistoryIdx(idx)
    setPositions({ ...history[idx] })
  }
  const redo = () => {
    if (!canRedo) return
    const idx = historyIdx + 1
    setHistoryIdx(idx)
    setPositions({ ...history[idx] })
  }

  // Carrega coordenadas existentes do clinicSettings quando abre.
  useEffect(() => {
    if (!open) return
    const stored =
      tipo === 'audiometria'
        ? clinicSettings?.coordenadas_audiometria
        : clinicSettings?.coordenadas_imitanciometria
    const loaded = coordsToPositions(stored, fields, pdfDims.h)
    const complete: FieldPositions = {}
    for (const f of fields) {
      complete[f.id] = loaded[f.id] ?? { x: f.defaultX, y: f.defaultY }
    }
    setPositions(complete)
    setHistory([{ ...complete }])
    setHistoryIdx(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tipo, clinicSettings, fields])

  // Referência para controlar cancelamento de renderização e cleanup do blob URL
  const activeBlobUrlRef = useRef<string | null>(null)

  // Limpa Object URL anterior se existir
  const cleanupBlobUrl = useCallback(() => {
    if (activeBlobUrlRef.current) {
      URL.revokeObjectURL(activeBlobUrlRef.current)
      activeBlobUrlRef.current = null
    }
  }, [])

  // Cleanup no unmount
  useEffect(() => {
    return () => {
      cleanupBlobUrl()
    }
  }, [cleanupBlobUrl])

  // Renderiza o PDF como imagem de fundo.
  const renderPdf = useCallback(
    async (url: string) => {
      if (!url) {
        setLoading(false)
        return
      }
      setRendering(true)
      try {
        let arrayBuffer: ArrayBuffer

        // Se já for uma URL data: ou blob: local criada no navegador, podemos buscar diretamente ou usar fetch simples
        if (url.startsWith('data:') || url.startsWith('blob:')) {
          const res = await fetch(url)
          if (!res.ok) {
            throw new Error(`Falha ao obter dados locais do PDF (HTTP ${res.status})`)
          }
          arrayBuffer = await res.arrayBuffer()
        } else {
          // Download autenticado usando o token do PocketBase
          const headers: HeadersInit = {}
          if (pb.authStore.token) {
            headers['Authorization'] = pb.authStore.token
          }

          const cleanUrl = url.replace(/[?&]token=[^&]*/g, '')
          let res = await fetch(cleanUrl, {
            headers,
          })

          // Se der 404, faz fallback buscando o registro atualizado de clinic_settings
          if (res.status === 404) {
            try {
              const authUser = (pb.authStore as any).model || (pb.authStore as any).record
              const filter =
                pb.authStore.isValid && authUser?.clinica_id
                  ? `clinica_id = "${authUser.clinica_id}"`
                  : ''
              const freshSettings = await pb
                .collection('clinic_settings')
                .getFirstListItem(filter, { sort: '-created' })

              const fileName =
                tipo === 'audiometria'
                  ? freshSettings.template_audiometria
                  : freshSettings.template_imitanciometria

              if (fileName) {
                const freshUrl = pb.files.getUrl(freshSettings, fileName)
                const freshCleanUrl = freshUrl.replace(/[?&]token=[^&]*/g, '')
                res = await fetch(freshCleanUrl, {
                  headers,
                })
              }
            } catch (fallbackErr) {
              console.warn('Falha no fallback de busca do template atualizado:', fallbackErr)
            }
          }

          if (!res.ok) {
            throw new Error(
              `Falha ao baixar o PDF do servidor (HTTP ${res.status}: ${res.statusText})`,
            )
          }

          const blob = await res.blob()
          cleanupBlobUrl()
          const objectUrl = URL.createObjectURL(blob)
          activeBlobUrlRef.current = objectUrl

          arrayBuffer = await blob.arrayBuffer()
        }

        // Passamos os dados binários (ArrayBuffer / Uint8Array) diretamente para o pdfjsLib
        const loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(arrayBuffer),
        })
        const pdf = await loadingTask.promise
        const page = await pdf.getPage(1)

        const baseViewport = page.getViewport({ scale: 1 })
        const targetWidth = 820
        const renderScale = targetWidth / baseViewport.width
        const viewport = page.getViewport({ scale: renderScale })

        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        canvas.width = viewport.width
        canvas.height = viewport.height
        canvas.style.width = `${viewport.width}px`
        canvas.style.height = `${viewport.height}px`

        await page.render({ canvasContext: ctx, viewport }).promise

        setPdfDims({ w: baseViewport.width, h: baseViewport.height })
        setImgSize({ w: viewport.width, h: viewport.height })
      } catch (err) {
        console.error('Erro ao renderizar PDF:', err)
        toast({
          title: 'Erro ao carregar o template PDF',
          description: 'Não foi possível renderizar o arquivo. Verifique se é um PDF válido.',
          variant: 'destructive',
        })
      } finally {
        setLoading(false)
        setRendering(false)
      }
    },
    [toast, cleanupBlobUrl, tipo],
  )

  useEffect(() => {
    if (open && templateUrl) {
      setLoading(true)
      renderPdf(templateUrl)
    } else if (!open) {
      cleanupBlobUrl()
      setImgSize({ w: 0, h: 0 })
      setPositions({})
      setHistory([])
      setHistoryIdx(-1)
      setSelectedField(null)
      dragStateRef.current = null
    }
  }, [open, templateUrl, renderPdf, cleanupBlobUrl])

  // ── Drag handlers (pointer events) ──
  const onPointerDown = (e: React.PointerEvent, fieldId: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (imgSize.w === 0) return
    const field = fields.find((f) => f.id === fieldId)
    if (!field) return
    const pos = positions[fieldId]
    if (!pos) return
    // Posição atual do retângulo em px (origem sup-esq da imagem)
    const pxX = pos.x * scale
    const pxY = pos.y * scale

    dragStateRef.current = {
      fieldId,
      startPointerX: e.clientX,
      startPointerY: e.clientY,
      startRectPxX: pxX,
      startRectPxY: pxY,
    }
    setSelectedField(fieldId)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const ds = dragStateRef.current
    if (!ds || imgSize.w === 0) return
    const dx = e.clientX - ds.startPointerX
    const dy = e.clientY - ds.startPointerY
    let newPxX = ds.startRectPxX + dx
    let newPxY = ds.startRectPxY + dy
    const field = fields.find((f) => f.id === ds.fieldId)
    if (!field) return
    const wPx = field.width * scale
    const hPx = Math.max(field.height * scale, 14)
    // Clamp dentro da imagem
    newPxX = Math.max(0, Math.min(newPxX, imgSize.w - wPx))
    newPxY = Math.max(0, Math.min(newPxY, imgSize.h - hPx))

    // Converte p/ pt (origem superior do PDF) e guarda
    const newPtX = newPxX / scale
    const newPtY = newPxY / scale
    setPositions((prev) => ({
      ...prev,
      [ds.fieldId]: { x: newPtX, y: newPtY },
    }))
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (dragStateRef.current) {
      pushHistory(positions)
      dragStateRef.current = null
      ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
    }
  }

  // Resetar posições para defaults
  const resetPositions = () => {
    const defaults: FieldPositions = {}
    for (const f of fields) {
      defaults[f.id] = { x: f.defaultX, y: f.defaultY }
    }
    setPositions(defaults)
    pushHistory(defaults)
    toast({
      title: 'Posições redefinidas',
      description: 'Os campos voltaram para a posição padrão. Lembre de salvar.',
    })
  }

  // Salvar coordenadas no clinic_settings
  const handleSave = async () => {
    setSaving(true)
    const coords = positionsToCoords(positions, fields, pdfDims.h)
    const field = tipo === 'audiometria' ? 'coordenadas_audiometria' : 'coordenadas_imitanciometria'
    const payload = { [field]: coords } as Record<string, unknown>
    const res = await saveClinicSettings(payload as any)
    setSaving(false)
    if (res.success) {
      toast({
        title: 'Coordenadas salvas',
        description:
          tipo === 'audiometria'
            ? 'As posições calibradas da audiometria foram gravadas.'
            : 'As posições calibradas da imitanciometria foram gravadas.',
      })
      onOpenChange(false)
    } else {
      toast({
        title: 'Erro ao salvar coordenadas',
        description: res.message || 'Não foi possível gravar as coordenadas.',
        variant: 'destructive',
      })
    }
  }

  const selectedDef = useMemo(
    () => fields.find((f) => f.id === selectedField) ?? null,
    [fields, selectedField],
  )
  const selectedPos = selectedField ? positions[selectedField] : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[1400px] h-[92vh] rounded-2xl bg-white p-0 shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        <DialogHeader className="px-5 py-3 border-b border-slate-200 flex-shrink-0 bg-gradient-to-r from-blue-50 to-white">
          <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Crosshair className="w-5 h-5 text-blue-700" />
            Calibração de Coordenadas — {tipo === 'audiometria' ? 'Audiometria' : 'Imitanciometria'}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Arraste os retângulos azuis sobre o template PDF para posicionar cada campo. As
            coordenadas (em pontos) são salvas e usadas no preenchimento automático do laudo.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex min-h-0">
          {/* Painel esquerdo: lista de campos + ferramentas */}
          <aside className="w-72 flex-shrink-0 border-r border-slate-200 bg-slate-50/70 flex flex-col">
            <div className="p-3 border-b border-slate-200 bg-white space-y-2">
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={undo}
                  disabled={!canUndo || saving}
                  className="h-8 flex-1 rounded-lg text-xs"
                  title="Desfazer"
                >
                  <Undo2 className="w-3.5 h-3.5 mr-1" />
                  Desfazer
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={redo}
                  disabled={!canRedo || saving}
                  className="h-8 flex-1 rounded-lg text-xs"
                  title="Refazer"
                >
                  <Redo2 className="w-3.5 h-3.5 mr-1" />
                  Refazer
                </Button>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={resetPositions}
                disabled={saving}
                className="w-full h-8 rounded-lg text-xs text-amber-700 border-amber-200 hover:bg-amber-50"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                Redefinir Posições
              </Button>
            </div>

            <div className="p-3 border-b border-slate-200 bg-white">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                Campos
              </div>
              <div className="space-y-1 max-h-[40vh] overflow-y-auto pr-1">
                {fields.map((f) => {
                  const pos = positions[f.id]
                  const isSel = selectedField === f.id
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setSelectedField(f.id)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors border ${
                        isSel
                          ? 'bg-blue-50 border-blue-300 text-blue-800 font-semibold'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="truncate">{f.short || f.label}</span>
                        {pos && (
                          <span className="font-mono text-[10px] text-slate-400">
                            {Math.round(pos.x)},{Math.round(pos.y)}
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Coordenadas do campo selecionado (edição manual) */}
            {selectedDef && selectedPos && (
              <div className="p-3 bg-white flex-1 space-y-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Posição do campo
                </div>
                <div className="text-xs font-semibold text-slate-800">{selectedDef.label}</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] text-slate-500">X (pt)</Label>
                    <Input
                      type="number"
                      value={Math.round(selectedPos.x)}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value)
                        if (!isNaN(v)) {
                          setPositions((prev) => ({
                            ...prev,
                            [selectedDef.id]: { ...prev[selectedDef.id], x: v },
                          }))
                        }
                      }}
                      onBlur={() => pushHistory(positions)}
                      className="h-8 rounded-md text-xs font-mono border-slate-300"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-slate-500">Y topo (pt)</Label>
                    <Input
                      type="number"
                      value={Math.round(selectedPos.y)}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value)
                        if (!isNaN(v)) {
                          setPositions((prev) => ({
                            ...prev,
                            [selectedDef.id]: { ...prev[selectedDef.id], y: v },
                          }))
                        }
                      }}
                      onBlur={() => pushHistory(positions)}
                      className="h-8 rounded-md text-xs font-mono border-slate-300"
                    />
                  </div>
                </div>
                <div className="text-[10px] text-slate-400 flex items-start gap-1.5 leading-relaxed">
                  <Info className="w-3 h-3 mt-0.5 shrink-0" />
                  <span>
                    Origem no canto superior esquerdo do PDF. Arraste o retângulo sobre o template
                    ou ajuste os valores manualmente.
                  </span>
                </div>
              </div>
            )}
          </aside>

          {/* Área central: canvas + retângulos */}
          <div className="flex-1 overflow-auto bg-slate-200/60 p-6 flex items-start justify-center">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
                <span className="text-sm">Carregando template PDF...</span>
              </div>
            ) : imgSize.w === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <Info className="w-8 h-8 mb-2 text-slate-400" />
                <span className="text-sm">
                  Não foi possível carregar o template. Verifique o arquivo PDF cadastrado.
                </span>
              </div>
            ) : (
              <div
                className="relative shadow-xl border border-slate-300 bg-white"
                style={{ width: imgSize.w, height: imgSize.h }}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
              >
                <canvas
                  ref={canvasRef}
                  className="block"
                  style={{ width: imgSize.w, height: imgSize.h }}
                />
                {rendering && (
                  <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-20">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  </div>
                )}

                {/* Retângulos arrastáveis */}
                {fields.map((f) => {
                  const pos = positions[f.id]
                  if (!pos) return null
                  const pxX = pos.x * scale
                  const pxY = pos.y * scale
                  const wPx = f.width * scale
                  const hPx = Math.max(f.height * scale, 14)
                  const isSel = selectedField === f.id
                  return (
                    <div
                      key={f.id}
                      onPointerDown={(e) => onPointerDown(e, f.id)}
                      className={`absolute cursor-move select-none touch-none ${
                        isSel ? 'z-30 ring-2 ring-blue-500 ring-offset-1' : 'z-10'
                      }`}
                      style={{
                        left: pxX,
                        top: pxY,
                        width: wPx,
                        height: hPx,
                        background: isSel ? 'rgba(37, 99, 235, 0.35)' : 'rgba(37, 99, 235, 0.22)',
                        border: isSel
                          ? '2px solid rgb(37, 99, 235)'
                          : '1.5px solid rgba(37, 99, 235, 0.7)',
                        borderRadius: 4,
                      }}
                      title={f.label}
                    >
                      <span className="absolute -top-5 left-0 text-[10px] font-bold text-white bg-blue-700 px-1.5 py-0.5 rounded whitespace-nowrap pointer-events-none">
                        {f.short || f.label}
                      </span>
                      {isSel && (
                        <span className="absolute -bottom-5 left-0 text-[10px] font-mono text-blue-800 bg-white/90 px-1.5 py-0.5 rounded border border-blue-200 pointer-events-none">
                          x:{Math.round(pos.x)} y:{Math.round(pos.y)}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="px-5 py-3 border-t border-slate-200 flex-shrink-0 bg-white items-center justify-between">
          <div className="text-[11px] text-slate-500 flex items-center gap-2">
            <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">
              {tipo === 'audiometria' ? 'Audiometria' : 'Imitanciometria'}
            </Badge>
            <span className="hidden sm:inline">
              Escala renderizada:{' '}
              <span className="font-mono text-slate-700">{scale.toFixed(2)}</span> px/pt • Página{' '}
              {Math.round(pdfDims.w)}×{Math.round(pdfDims.h)} pt
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || loading || imgSize.w === 0}
              className="bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-xl flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Salvando...' : 'Salvar Coordenadas'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default CalibracaoTemplate
