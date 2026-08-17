// ExamReportTemplateEditor.tsx — Editor visual de layout de laudo (canvas A4).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Undo2,
  Redo2,
  Save,
  Eye,
  Send,
  Trash2,
  Lock,
  Unlock,
  Copy,
  BringToFront,
  SendToBack,
  Plus,
  ZoomIn,
  ZoomOut,
  MousePointer2,
  Type,
  Image as ImageIcon,
  Square,
  Table as TableIcon,
  Activity,
  PenLine,
  Layers,
  Sticker,
  Minus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { getTemplate, saveDraft, publishTemplate, updateTemplate } from '@/lib/examReportTemplates'
import {
  ELEMENT_DEFS,
  PACIENTE_FIELDS,
  EXAME_FIELDS,
  createElement,
  createElementByType,
  uid,
} from '@/lib/examReportElements'
import { mmToPx } from '@/components/print/TemplateRenderer'
import { RealDataPreviewModal } from '@/pages/laudos/RealDataPreviewModal'
import type {
  ExamReportTemplate,
  LayoutElement,
  LayoutElementType,
  LayoutElementStyle,
  LayoutElementProps,
  ExamReportStatus,
} from '@/types'
import { EXAM_REPORT_TIPO_LABELS, EXAM_REPORT_STATUS_LABELS } from '@/types'
import { FileSearch } from 'lucide-react'

const MM_PX = 3.7795275591

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

const STATUS_CLASS: Record<ExamReportStatus, string> = {
  rascunho: 'bg-amber-100 text-amber-700 border-amber-200',
  publicado: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  arquivado: 'bg-slate-200 text-slate-600 border-slate-300',
}

// Agrupamento dos ELEMENT_DEFS para a sidebar
const CATEGORIAS: {
  nome: string
  icon: React.ReactNode
  indices: number[]
}[] = [
  {
    nome: 'Texto',
    icon: <Type className="h-3.5 w-3.5" />,
    indices: [0, 1, 2, 3],
  },
  {
    nome: 'Imagens',
    icon: <ImageIcon className="h-3.5 w-3.5" />,
    indices: [4],
  },
  {
    nome: 'Formas',
    icon: <Square className="h-3.5 w-3.5" />,
    indices: [5, 6, 7, 14],
  },
  {
    nome: 'Dados',
    icon: <TableIcon className="h-3.5 w-3.5" />,
    indices: [8],
  },
  {
    nome: 'Exames',
    icon: <Activity className="h-3.5 w-3.5" />,
    indices: [9, 10],
  },
  {
    nome: 'Finalização',
    icon: <PenLine className="h-3.5 w-3.5" />,
    indices: [11, 13],
  },
  {
    nome: 'Estrutura',
    icon: <Layers className="h-3.5 w-3.5" />,
    indices: [12],
  },
]

export default function ExamReportTemplateEditor() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [template, setTemplate] = useState<ExamReportTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const [elementos, setElementos] = useState<LayoutElement[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(0.5)
  const [salvando, setSalvando] = useState(false)
  const [editandoNome, setEditandoNome] = useState(false)
  const [nomeModelo, setNomeModelo] = useState('')
  const [modalPublicar, setModalPublicar] = useState(false)
  const [motivoPublicacao, setMotivoPublicacao] = useState('')
  const [modalPreviaReal, setModalPreviaReal] = useState(false)

  // ---- Undo/Redo (histórico de snapshots) ----
  const [history, setHistory] = useState<LayoutElement[][]>([])
  const [histIdx, setHistIdx] = useState(-1)
  const [dirty, setDirty] = useState(false)
  const skipHistory = useRef(false)

  const pushHistory = useCallback(
    (next: LayoutElement[]) => {
      setHistory((prev) => {
        const trimmed = prev.slice(0, histIdx + 1)
        trimmed.push(next)
        if (trimmed.length > 50) trimmed.shift()
        return trimmed
      })
      setHistIdx((i) => Math.min(i + 1, 49))
      setDirty(true)
    },
    [histIdx],
  )

  const setElementosTracked = useCallback(
    (updater: (prev: LayoutElement[]) => LayoutElement[]) => {
      setElementos((prev) => {
        const next = updater(prev)
        if (!skipHistory.current) pushHistory(next)
        return next
      })
    },
    [pushHistory],
  )

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const tpl = await getTemplate(id)
      setTemplate(tpl)
      setNomeModelo(tpl.nome_modelo)
      const els = tpl.estrutura_layout || []
      setElementos(els)
      setHistory([els])
      setHistIdx(0)
      setDirty(false)
    } catch (err) {
      toast({ title: 'Erro ao carregar modelo', description: String(err), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [id, toast])

  useEffect(() => {
    carregar()
  }, [carregar])

  // ---- Undo / Redo ----
  const undo = useCallback(() => {
    if (histIdx <= 0) return
    const newIdx = histIdx - 1
    skipHistory.current = true
    setElementos(history[newIdx])
    setHistIdx(newIdx)
    setDirty(true)
    skipHistory.current = false
  }, [histIdx, history])

  const redo = useCallback(() => {
    if (histIdx >= history.length - 1) return
    const newIdx = histIdx + 1
    skipHistory.current = true
    setElementos(history[newIdx])
    setHistIdx(newIdx)
    setDirty(true)
    skipHistory.current = false
  }, [histIdx, history])

  // ---- Atalhos de teclado ----
  const excluirElemento = useCallback(
    (elId: string) => {
      setElementosTracked((prev) => prev.filter((e) => e.id !== elId))
      setSelectedId((cur) => (cur === elId ? null : cur))
    },
    [setElementosTracked],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
        return
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo()
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId) {
          e.preventDefault()
          excluirElemento(selectedId)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo, selectedId, excluirElemento])

  // ---- Adicionar elemento ----
  const adicionarElemento = (defIdx: number) => {
    const def = ELEMENT_DEFS[defIdx]
    const el = createElement(def, 10, 10)
    setElementosTracked((prev) => [...prev, el])
    setSelectedId(el.id)
  }

  const adicionarCampoPaciente = (token: string, label: string) => {
    const el = createElementByType('text', 'Campo automático', 10, 10)
    el.label = label
    el.props = {
      content: `{{${token}}}`,
      contentType: 'dynamic',
      dynamicField: token,
      fallback: '—',
    }
    setElementosTracked((prev) => [...prev, el])
    setSelectedId(el.id)
  }

  const adicionarCampoExame = (field: string, label: string) => {
    const el = createElementByType('field', 'Campo do exame', 10, 10)
    el.label = label
    el.props = { fieldPath: field, label, showLabel: true, fallback: '—' }
    setElementosTracked((prev) => [...prev, el])
    setSelectedId(el.id)
  }

  // ---- Seleção / edição ----
  const selected = useMemo(
    () => elementos.find((e) => e.id === selectedId) || null,
    [elementos, selectedId],
  )

  const updateElemento = useCallback(
    (elId: string, patch: Partial<LayoutElement>) => {
      setElementosTracked((prev) => prev.map((e) => (e.id === elId ? { ...e, ...patch } : e)))
    },
    [setElementosTracked],
  )

  const updateElementoStyle = useCallback(
    (elId: string, stylePatch: Partial<LayoutElementStyle>) => {
      setElementosTracked((prev) =>
        prev.map((e) => (e.id === elId ? { ...e, style: { ...e.style, ...stylePatch } } : e)),
      )
    },
    [setElementosTracked],
  )

  const updateElementoProps = useCallback(
    (elId: string, propsPatch: Partial<LayoutElementProps>) => {
      setElementosTracked((prev) =>
        prev.map((e) => (e.id === elId ? { ...e, props: { ...e.props, ...propsPatch } } : e)),
      )
    },
    [setElementosTracked],
  )

  const duplicarElemento = useCallback(
    (elId: string) => {
      const el = elementos.find((e) => e.id === elId)
      if (!el) return
      const copia: LayoutElement = {
        ...JSON.parse(JSON.stringify(el)),
        id: uid(),
        x: el.x + 10,
        y: el.y + 10,
        zIndex: (el.zIndex || 1) + 1,
      }
      setElementosTracked((prev) => [...prev, copia])
      setSelectedId(copia.id)
    },
    [elementos, setElementosTracked],
  )

  const trazerFrente = useCallback(
    (elId: string) => {
      setElementosTracked((prev) =>
        prev.map((e) => (e.id === elId ? { ...e, zIndex: (e.zIndex || 1) + 1 } : e)),
      )
    },
    [setElementosTracked],
  )
  const enviarTras = useCallback(
    (elId: string) => {
      setElementosTracked((prev) =>
        prev.map((e) => (e.id === elId ? { ...e, zIndex: Math.max(0, (e.zIndex || 1) - 1) } : e)),
      )
    },
    [setElementosTracked],
  )

  // ---- Drag & resize no canvas ----
  const dragState = useRef<{
    mode: 'move' | 'resize'
    handle?: Handle
    startX: number
    startY: number
    origX: number
    origY: number
    origW: number
    origH: number
    elId: string
    moved: boolean
  } | null>(null)

  const onElementMouseDown = (e: React.MouseEvent, el: LayoutElement) => {
    if (el.locked) return
    e.stopPropagation()
    setSelectedId(el.id)
    dragState.current = {
      mode: 'move',
      startX: e.clientX,
      startY: e.clientY,
      origX: el.x,
      origY: el.y,
      origW: el.width,
      origH: el.height,
      elId: el.id,
      moved: false,
    }
  }

  const onHandleMouseDown = (e: React.MouseEvent, el: LayoutElement, handle: Handle) => {
    e.stopPropagation()
    e.preventDefault()
    dragState.current = {
      mode: 'resize',
      handle,
      startX: e.clientX,
      startY: e.clientY,
      origX: el.x,
      origY: el.y,
      origW: el.width,
      origH: el.height,
      elId: el.id,
      moved: false,
    }
  }

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const ds = dragState.current
      if (!ds) return
      const dxPx = e.clientX - ds.startX
      const dyPx = e.clientY - ds.startY
      const dxMm = dxPx / (MM_PX * zoom)
      const dyMm = dyPx / (MM_PX * zoom)
      if (Math.abs(dxPx) > 2 || Math.abs(dyPx) > 2) ds.moved = true

      if (ds.mode === 'move') {
        let nx = ds.origX + dxMm
        let ny = ds.origY + dyMm
        // Limita à área útil
        if (template) {
          const areaW = template.largura_pagina - template.margem_esquerda - template.margem_direita
          const areaH = template.altura_pagina - template.margem_superior - template.margem_inferior
          nx = Math.max(0, Math.min(nx, areaW))
          ny = Math.max(0, Math.min(ny, areaH))
        }
        setElementos((prev) =>
          prev.map((el) =>
            el.id === ds.elId ? { ...el, x: Math.round(nx), y: Math.round(ny) } : el,
          ),
        )
      } else if (ds.mode === 'resize') {
        let { origX: nx, origY: ny, origW: nw, origH: nh } = ds
        const h = ds.handle!
        if (h.includes('e')) nw = Math.max(20, ds.origW + dxMm)
        if (h.includes('s')) nh = Math.max(10, ds.origH + dyMm)
        if (h.includes('w')) {
          nw = Math.max(20, ds.origW - dxMm)
          nx = ds.origX + dxMm
        }
        if (h.includes('n')) {
          nh = Math.max(10, ds.origH - dyMm)
          ny = ds.origY + dyMm
        }
        setElementos((prev) =>
          prev.map((el) =>
            el.id === ds.elId
              ? {
                  ...el,
                  x: Math.round(nx),
                  y: Math.round(ny),
                  width: Math.round(nw),
                  height: Math.round(nh),
                }
              : el,
          ),
        )
      }
    }
    const onUp = () => {
      if (dragState.current?.moved) {
        // commit histórico no fim do drag usando o estado final
        setElementos((cur) => {
          pushHistory(cur)
          return cur
        })
      }
      dragState.current = null
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [zoom, template, pushHistory])

  // ---- Salvar nome inline ----
  const salvarNome = async () => {
    if (!template) return
    if (nomeModelo.trim() && nomeModelo !== template.nome_modelo) {
      try {
        const updated = await updateTemplate(template.id, { nome_modelo: nomeModelo.trim() })
        setTemplate(updated)
        toast({ title: 'Nome atualizado' })
      } catch (err) {
        toast({ title: 'Erro ao atualizar nome', description: String(err), variant: 'destructive' })
      }
    }
    setEditandoNome(false)
  }

  // ---- Salvar / Publicar ----
  const handleSalvarRascunho = async () => {
    if (!template) return
    setSalvando(true)
    try {
      const updated = await saveDraft(template.id, elementos, {
        nome_modelo: nomeModelo.trim() || template.nome_modelo,
      })
      setTemplate(updated)
      setDirty(false)
      toast({ title: 'Rascunho salvo' })
    } catch (err) {
      toast({ title: 'Erro ao salvar', description: String(err), variant: 'destructive' })
    } finally {
      setSalvando(false)
    }
  }

  const confirmarPublicar = async () => {
    if (!template) return
    if (dirty) {
      await handleSalvarRascunho()
    }
    try {
      const updated = await publishTemplate(template.id, motivoPublicacao.trim() || undefined)
      setTemplate(updated)
      setDirty(false)
      setModalPublicar(false)
      setMotivoPublicacao('')
      toast({
        title: 'Modelo publicado',
        description: `Versão ${updated.versao} criada com sucesso.`,
      })
    } catch (err) {
      toast({ title: 'Erro ao publicar', description: String(err), variant: 'destructive' })
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        Carregando editor...
      </div>
    )
  }
  if (!template) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-slate-500">
        <p className="text-red-500">Modelo não encontrado.</p>
        <Link to="/configuracoes/laudos">
          <Button variant="outline">Voltar para a lista</Button>
        </Link>
      </div>
    )
  }

  const larguraPx = mmToPx(template.largura_pagina) * zoom
  const alturaPx = mmToPx(template.altura_pagina) * zoom
  const margemSup = mmToPx(template.margem_superior) * zoom
  const margemEsq = mmToPx(template.margem_esquerda) * zoom
  const margemDir = mmToPx(template.margem_direita) * zoom
  const margemInf = mmToPx(template.margem_inferior) * zoom

  const elementosOrdenados = [...elementos].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
  const exameFields = EXAME_FIELDS[template.tipo_exame] || EXAME_FIELDS.personalizado

  return (
    <div className="flex h-screen flex-col bg-slate-100">
      {/* ===== Toolbar ===== */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-white px-4 py-2 shadow-sm">
        <div className="flex items-center gap-3">
          <Link to="/configuracoes/laudos">
            <Button variant="ghost" size="icon" title="Voltar">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            {editandoNome ? (
              <div className="flex items-center gap-1">
                <Input
                  value={nomeModelo}
                  onChange={(e) => setNomeModelo(e.target.value)}
                  className="h-8 w-56"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') salvarNome()
                    if (e.key === 'Escape') {
                      setNomeModelo(template.nome_modelo)
                      setEditandoNome(false)
                    }
                  }}
                />
                <Button size="sm" onClick={salvarNome}>
                  OK
                </Button>
              </div>
            ) : (
              <button
                className="text-base font-semibold text-slate-800 hover:text-[#1E3A8A]"
                onClick={() => setEditandoNome(true)}
                title="Clique para editar o nome"
              >
                {nomeModelo}
              </button>
            )}
            <Badge className={STATUS_CLASS[template.status]} variant="outline">
              {EXAM_REPORT_STATUS_LABELS[template.status]}
            </Badge>
            {dirty && <span className="text-xs text-amber-600">● não salvo</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={undo}
            disabled={histIdx <= 0}
            title="Desfazer (Ctrl+Z)"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={redo}
            disabled={histIdx >= history.length - 1}
            title="Refazer (Ctrl+Y)"
          >
            <Redo2 className="h-4 w-4" />
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.05))}
            title="Diminuir zoom"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="w-12 text-center text-xs text-slate-600">{Math.round(zoom * 100)}%</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setZoom((z) => Math.min(1.5, z + 0.05))}
            title="Aumentar zoom"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <Button size="sm" variant="outline" onClick={handleSalvarRascunho} disabled={salvando}>
            <Save className="mr-1 h-4 w-4" /> Salvar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate(`/configuracoes/laudos/${template.id}/preview`)}
          >
            <Eye className="mr-1 h-4 w-4" /> Visualizar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setModalPreviaReal(true)}
            title="Prévia com dados de um exame real"
          >
            <FileSearch className="mr-1 h-4 w-4" /> Prévia com dados reais
          </Button>
          <Button
            size="sm"
            className="bg-[#00897B] hover:bg-[#0a8a7a]"
            onClick={() => setModalPublicar(true)}
          >
            <Send className="mr-1 h-4 w-4" /> Publicar
          </Button>
        </div>
      </div>

      {/* ===== Corpo: 3 painéis ===== */}
      <div className="flex flex-1 overflow-hidden">
        {/* Painel esquerdo — Elementos */}
        <div className="w-56 shrink-0 overflow-y-auto border-r bg-white">
          <div className="border-b px-3 py-2">
            <h2 className="text-xs font-semibold uppercase text-slate-500">Elementos</h2>
          </div>
          <div className="p-3">
            <p className="mb-2 text-[11px] text-slate-400">Clique para adicionar ao canvas:</p>
            <div className="space-y-3">
              {CATEGORIAS.map((cat) => (
                <div key={cat.nome}>
                  <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase text-slate-400">
                    {cat.icon}
                    {cat.nome}
                  </div>
                  <div className="space-y-0.5">
                    {cat.indices.map((i) => (
                      <button
                        key={`${ELEMENT_DEFS[i].type}-${i}`}
                        onClick={() => adicionarElemento(i)}
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100"
                      >
                        <Plus className="h-3 w-3 shrink-0 text-[#1E3A8A]" />
                        <span className="truncate">{ELEMENT_DEFS[i].label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <Separator className="my-3" />
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase text-slate-400">
              <PenLine className="h-3.5 w-3.5" />
              Campos do Paciente
            </div>
            <div className="space-y-0.5">
              {PACIENTE_FIELDS.map((f) => (
                <button
                  key={f.token}
                  onClick={() => adicionarCampoPaciente(f.token, f.label)}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100"
                >
                  <Plus className="h-3 w-3 shrink-0 text-[#1E3A8A]" />
                  <span className="truncate">{f.label}</span>
                </button>
              ))}
            </div>

            <Separator className="my-3" />
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase text-slate-400">
              <Activity className="h-3.5 w-3.5" />
              Campos do Exame ({EXAM_REPORT_TIPO_LABELS[template.tipo_exame]})
            </div>
            <div className="space-y-0.5">
              {exameFields.map((f) => (
                <button
                  key={f.field}
                  onClick={() => adicionarCampoExame(f.field, f.label)}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100"
                >
                  <Plus className="h-3 w-3 shrink-0 text-[#00897B]" />
                  <span className="truncate">{f.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Canvas central */}
        <div
          className="relative flex-1 overflow-auto bg-slate-200 p-8"
          onClick={() => setSelectedId(null)}
          onContextMenu={(e) => {
            e.preventDefault()
            setSelectedId(null)
          }}
        >
          <div
            className="relative bg-white shadow-lg"
            style={{ width: larguraPx, height: alturaPx, margin: '0 auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Linhas de margem */}
            <div
              className="pointer-events-none absolute border-dashed border-slate-300"
              style={{ top: margemSup, left: margemEsq, right: margemDir, bottom: margemInf }}
            />

            {/* Área útil */}
            <div className="absolute" style={{ top: margemSup, left: margemEsq }}>
              {elementosOrdenados.map((el) => (
                <ElementoCanvas
                  key={el.id}
                  el={el}
                  zoom={zoom}
                  selected={el.id === selectedId}
                  onSelect={() => setSelectedId(el.id)}
                  onMouseDown={(e) => onElementMouseDown(e, el)}
                  onHandleMouseDown={(e, h) => onHandleMouseDown(e, el, h)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Painel direito — Propriedades */}
        <div className="w-72 shrink-0 overflow-y-auto border-l bg-white">
          {selected ? (
            <PainelPropriedades
              el={selected}
              onUpdate={(patch) => updateElemento(selected.id, patch)}
              onUpdateStyle={(patch) => updateElementoStyle(selected.id, patch)}
              onUpdateProps={(patch) => updateElementoProps(selected.id, patch)}
              onExcluir={() => excluirElemento(selected.id)}
              onDuplicar={() => duplicarElemento(selected.id)}
              onFrente={() => trazerFrente(selected.id)}
              onTras={() => enviarTras(selected.id)}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center p-6 text-center text-slate-400">
              <MousePointer2 className="mb-3 h-8 w-8" />
              <p className="text-sm">
                Selecione um elemento no canvas para editar suas propriedades.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Rodapé */}
      <div className="flex items-center justify-between border-t bg-white px-4 py-1.5 text-xs text-slate-500">
        <span>
          Margens: {template.margem_superior}/{template.margem_inferior}/{template.margem_esquerda}/
          {template.margem_direita} mm (S/I/E/D)
        </span>
        <span>
          Tamanho: {template.largura_pagina}×{template.altura_pagina} mm • {template.orientacao} •{' '}
          {elementos.length} elemento(s)
        </span>
      </div>

      {/* Modal Publicar */}
      <Dialog open={modalPublicar} onOpenChange={setModalPublicar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publicar modelo</DialogTitle>
            <DialogDescription>
              Ao publicar, o modelo se tornará o padrão para{' '}
              {EXAM_REPORT_TIPO_LABELS[template.tipo_exame]}. Se já existir outro modelo publicado
              do mesmo tipo, ele será arquivado automaticamente.
              {dirty && (
                <span className="mt-2 block text-amber-600">
                  Suas alterações não salvas serão salvas antes da publicação.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="motivo">Motivo da publicação (opcional)</Label>
            <Textarea
              id="motivo"
              rows={3}
              placeholder="Ex.: Ajuste de margens e adição do campo de CRM..."
              value={motivoPublicacao}
              onChange={(e) => setMotivoPublicacao(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalPublicar(false)}>
              Cancelar
            </Button>
            <Button className="bg-[#00897B] hover:bg-[#0a8a7a]" onClick={confirmarPublicar}>
              <Send className="mr-2 h-4 w-4" /> Publicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Prévia com dados reais */}
      {template && (
        <RealDataPreviewModal
          open={modalPreviaReal}
          onOpenChange={setModalPreviaReal}
          template={template}
        />
      )}
    </div>
  )
}

// ===== Elemento no canvas =====
const ElementoCanvas: React.FC<{
  el: LayoutElement
  zoom: number
  selected: boolean
  onSelect: () => void
  onMouseDown: (e: React.MouseEvent) => void
  onHandleMouseDown: (e: React.MouseEvent, h: Handle) => void
}> = ({ el, zoom, selected, onSelect, onMouseDown, onHandleMouseDown }) => {
  if (el.visible === false) return null
  const w = mmToPx(el.width) * zoom
  const h = mmToPx(el.height) * zoom
  const handles: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

  return (
    <div
      className="absolute select-none"
      style={{
        left: mmToPx(el.x) * zoom,
        top: mmToPx(el.y) * zoom,
        width: w,
        height: h,
        zIndex: el.zIndex,
        cursor: el.locked ? 'default' : 'grab',
        border: selected ? '1px dashed #3B82F6' : '1px solid transparent',
        background:
          el.type === 'rectangle' && el.style?.backgroundColor
            ? el.style.backgroundColor
            : 'transparent',
        opacity: el.type === 'watermark' ? 0.3 : 1,
      }}
      onMouseDown={onMouseDown}
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
    >
      <PreviewConteudo el={el} />
      {el.locked && (
        <div className="absolute right-0 top-0 -translate-y-full rounded bg-slate-700 px-1 text-[8px] text-white">
          <Lock className="inline h-2 w-2" />
        </div>
      )}
      {selected &&
        !el.locked &&
        handles.map((hd) => (
          <div
            key={hd}
            className="absolute h-2 w-2 rounded-full border border-white bg-[#3B82F6]"
            style={{
              ...handlePos(hd),
              cursor: handleCursor(hd),
            }}
            onMouseDown={(e) => onHandleMouseDown(e, hd)}
          />
        ))}
    </div>
  )
}

function handlePos(h: Handle): React.CSSProperties {
  const pos: React.CSSProperties = {}
  if (h.includes('n')) pos.top = -4
  if (h.includes('s')) pos.bottom = -4
  if (h.includes('w')) pos.left = -4
  if (h.includes('e')) pos.right = -4
  if (h === 'n' || h === 's') {
    pos.left = '50%'
    pos.transform = 'translateX(-50%)'
  }
  if (h === 'e' || h === 'w') {
    pos.top = '50%'
    pos.transform = 'translateY(-50%)'
  }
  return pos
}
function handleCursor(h: Handle): string {
  const map: Record<Handle, string> = {
    nw: 'nwse-resize',
    n: 'ns-resize',
    ne: 'nesw-resize',
    e: 'ew-resize',
    se: 'nwse-resize',
    s: 'ns-resize',
    sw: 'nesw-resize',
    w: 'ew-resize',
  }
  return map[h]
}

// Preview leve do conteúdo dentro do canvas do editor
const PreviewConteudo: React.FC<{ el: LayoutElement }> = ({ el }) => {
  const s = el.style || {}
  const style: React.CSSProperties = {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    fontFamily: s.fontFamily,
    fontSize: `${s.fontSize || 9}pt`,
    fontWeight: s.bold ? 'bold' : undefined,
    fontStyle: s.italic ? 'italic' : undefined,
    color: s.color,
    backgroundColor: s.backgroundColor,
    textAlign: s.align,
    padding: s.padding,
    border:
      s.borderColor && s.borderWidth ? `${s.borderWidth}px solid ${s.borderColor}` : undefined,
  }
  switch (el.type) {
    case 'text':
    case 'field': {
      const txt =
        el.type === 'field'
          ? `${el.props?.showLabel !== false ? (el.props?.label || el.label) + ': ' : ''}${el.props?.fallback || '—'}`
          : el.props?.content || ''
      return (
        <div style={style} className="whitespace-pre-wrap break-words">
          {txt}
        </div>
      )
    }
    case 'image':
      return (
        <div style={style} className="flex items-center justify-center text-[8px] text-slate-400">
          <ImageIcon className="h-4 w-4" />
        </div>
      )
    case 'line': {
      const dir = el.props?.direction || 'horizontal'
      return (
        <div style={style} className="flex items-center justify-center">
          <div
            style={{
              width: dir === 'horizontal' ? '100%' : '2px',
              height: dir === 'horizontal' ? '2px' : '100%',
              background: el.props?.color || '#1E3A8A',
            }}
          />
        </div>
      )
    }
    case 'rectangle':
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            border: `${s.borderWidth || 1}px solid ${s.borderColor || '#1E3A8A'}`,
            background: s.backgroundColor || 'transparent',
          }}
        />
      )
    case 'table':
      return (
        <div style={style} className="text-[7pt] text-slate-500">
          [tabela {el.props?.columns?.length || 0} col]
        </div>
      )
    case 'audiogram':
      return (
        <div style={style} className="flex items-center justify-center text-[7pt] text-slate-500">
          <Activity className="h-4 w-4" /> [audiograma]
        </div>
      )
    case 'timpanogram':
      return (
        <div style={style} className="flex items-center justify-center text-[7pt] text-slate-500">
          [timpanograma]
        </div>
      )
    case 'signature':
      return (
        <div style={style} className="flex flex-col items-center justify-end">
          <div style={{ width: '70%', borderTop: '1px solid #000' }} />
          <div className="text-[7pt]">{el.props?.label || 'Assinatura'}</div>
        </div>
      )
    case 'section':
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            border: `1px solid ${el.props?.borderColor || '#1E3A8A'}`,
          }}
        >
          <div
            style={{
              background: el.props?.titleBgColor || '#F2F4F7',
              padding: '1px 4px',
              fontWeight: 'bold',
              fontSize: '7pt',
            }}
          >
            {el.props?.title || 'SEÇÃO'}
          </div>
          <div className="p-1 text-[6pt] text-slate-400">[agrupador]</div>
        </div>
      )
    case 'watermark':
      return (
        <div
          style={{
            ...style,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: 'rotate(-30deg)',
            fontSize: '24pt',
            fontWeight: 'bold',
            color: s.color || '#1E3A8A',
            opacity: 0.15,
          }}
        >
          {el.props?.content || 'CONFIDENCIAL'}
        </div>
      )
    case 'divider':
      return (
        <div
          style={{
            width: '100%',
            borderTop: `1px solid ${s.borderColor || '#1E3A8A'}`,
            marginTop: '50%',
          }}
        />
      )
    default:
      return null
  }
}

// ===== Painel de propriedades =====
const PainelPropriedades: React.FC<{
  el: LayoutElement
  onUpdate: (patch: Partial<LayoutElement>) => void
  onUpdateStyle: (patch: Partial<LayoutElementStyle>) => void
  onUpdateProps: (patch: Partial<LayoutElementProps>) => void
  onExcluir: () => void
  onDuplicar: () => void
  onFrente: () => void
  onTras: () => void
}> = ({ el, onUpdate, onUpdateStyle, onUpdateProps, onExcluir, onDuplicar, onFrente, onTras }) => {
  const s = el.style || {}
  const p = el.props || {}
  return (
    <div className="space-y-4 p-4">
      <div>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">{el.label}</h3>
          <BadgeTipo tipo={el.type} />
        </div>
        <p className="truncate text-[10px] text-slate-400">ID: {el.id}</p>
      </div>

      <Separator />

      {/* Posição e tamanho */}
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase text-slate-500">Posição & Tamanho</h4>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">X (mm)</Label>
            <Input
              type="number"
              value={el.x}
              onChange={(e) => onUpdate({ x: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label className="text-xs">Y (mm)</Label>
            <Input
              type="number"
              value={el.y}
              onChange={(e) => onUpdate({ y: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label className="text-xs">Largura (mm)</Label>
            <Input
              type="number"
              value={el.width}
              onChange={(e) => onUpdate({ width: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label className="text-xs">Altura (mm)</Label>
            <Input
              type="number"
              value={el.height}
              onChange={(e) => onUpdate({ height: Number(e.target.value) })}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Label className="text-xs">Visível</Label>
        <Switch checked={el.visible !== false} onCheckedChange={(v) => onUpdate({ visible: v })} />
      </div>
      <div className="flex items-center justify-between">
        <Label className="text-xs">Bloqueado</Label>
        <Switch checked={!!el.locked} onCheckedChange={(v) => onUpdate({ locked: v })} />
      </div>

      <Separator />

      {/* Estilo */}
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase text-slate-500">Estilo</h4>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Fonte</Label>
            <Input
              value={s.fontFamily || ''}
              onChange={(e) => onUpdateStyle({ fontFamily: e.target.value })}
              placeholder="Arial"
            />
          </div>
          <div>
            <Label className="text-xs">Tamanho</Label>
            <Input
              type="number"
              value={s.fontSize || 9}
              onChange={(e) => onUpdateStyle({ fontSize: Number(e.target.value) })}
            />
          </div>
        </div>
        <div className="mt-2 flex gap-2">
          <Button
            size="sm"
            variant={s.bold ? 'default' : 'outline'}
            onClick={() => onUpdateStyle({ bold: !s.bold })}
            className="font-bold"
          >
            N
          </Button>
          <Button
            size="sm"
            variant={s.italic ? 'default' : 'outline'}
            onClick={() => onUpdateStyle({ italic: !s.italic })}
            className="italic"
          >
            I
          </Button>
          <Button
            size="sm"
            variant={s.underline ? 'default' : 'outline'}
            onClick={() => onUpdateStyle({ underline: !s.underline })}
            className="underline"
          >
            S
          </Button>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Alinhamento</Label>
            <Select
              value={s.align || 'left'}
              onValueChange={(v) =>
                onUpdateStyle({ align: v as 'left' | 'center' | 'right' | 'justify' })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="left">Esquerda</SelectItem>
                <SelectItem value="center">Centro</SelectItem>
                <SelectItem value="right">Direita</SelectItem>
                <SelectItem value="justify">Justificado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Cor do texto</Label>
            <Input
              type="color"
              value={s.color || '#000000'}
              onChange={(e) => onUpdateStyle({ color: e.target.value })}
              className="h-9 p-1"
            />
          </div>
          <div>
            <Label className="text-xs">Fundo</Label>
            <Input
              type="color"
              value={s.backgroundColor || '#ffffff'}
              onChange={(e) => onUpdateStyle({ backgroundColor: e.target.value })}
              className="h-9 p-1"
            />
          </div>
          <div>
            <Label className="text-xs">Cor borda</Label>
            <Input
              type="color"
              value={s.borderColor || '#1E3A8A'}
              onChange={(e) => onUpdateStyle({ borderColor: e.target.value })}
              className="h-9 p-1"
            />
          </div>
          <div>
            <Label className="text-xs">Borda px</Label>
            <Input
              type="number"
              value={s.borderWidth || 0}
              onChange={(e) => onUpdateStyle({ borderWidth: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label className="text-xs">Padding</Label>
            <Input
              type="number"
              value={s.padding || 0}
              onChange={(e) => onUpdateStyle({ padding: Number(e.target.value) })}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Props específicas */}
      <PropsEspecificas el={el} onUpdateProps={onUpdateProps} />

      <Separator />

      {/* Ações */}
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" variant="outline" onClick={onDuplicar}>
          <Copy className="mr-1 h-3 w-3" /> Duplicar
        </Button>
        <Button size="sm" variant="outline" onClick={onFrente}>
          <BringToFront className="mr-1 h-3 w-3" /> Frente
        </Button>
        <Button size="sm" variant="outline" onClick={onTras}>
          <SendToBack className="mr-1 h-3 w-3" /> Trás
        </Button>
        <Button size="sm" variant="destructive" onClick={onExcluir}>
          <Trash2 className="mr-1 h-3 w-3" /> Excluir
        </Button>
      </div>
    </div>
  )
}

const BadgeTipo: React.FC<{ tipo: LayoutElementType }> = ({ tipo }) => (
  <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
    {tipo}
  </span>
)

const PropsEspecificas: React.FC<{
  el: LayoutElement
  onUpdateProps: (patch: Partial<LayoutElementProps>) => void
}> = ({ el, onUpdateProps }) => {
  const p = el.props || {}
  switch (el.type) {
    case 'text':
      return (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase text-slate-500">Texto</h4>
          <div className="space-y-2">
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select
                value={p.contentType || 'static'}
                onValueChange={(v) => onUpdateProps({ contentType: v as 'static' | 'dynamic' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="static">Texto fixo</SelectItem>
                  <SelectItem value="dynamic">Campo dinâmico</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Conteúdo</Label>
              <Textarea
                rows={3}
                value={p.content || ''}
                onChange={(e) => onUpdateProps({ content: e.target.value })}
                placeholder="Texto ou {{campo}}"
              />
            </div>
            {p.contentType === 'dynamic' && (
              <div>
                <Label className="text-xs">Campo dinâmico</Label>
                <Input
                  value={p.dynamicField || ''}
                  onChange={(e) =>
                    onUpdateProps({
                      dynamicField: e.target.value,
                      content: `{{${e.target.value}}}`,
                    })
                  }
                  placeholder="paciente.nome"
                />
              </div>
            )}
            <div>
              <Label className="text-xs">Fallback (vazio)</Label>
              <Input
                value={p.fallback || ''}
                onChange={(e) => onUpdateProps({ fallback: e.target.value })}
              />
            </div>
          </div>
        </div>
      )
    case 'field':
      return (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase text-slate-500">Campo do exame</h4>
          <div className="space-y-2">
            <div>
              <Label className="text-xs">Caminho do campo</Label>
              <Input
                value={p.fieldPath || ''}
                onChange={(e) => onUpdateProps({ fieldPath: e.target.value })}
                placeholder="report"
              />
            </div>
            <div>
              <Label className="text-xs">Rótulo</Label>
              <Input
                value={p.label || ''}
                onChange={(e) => onUpdateProps({ label: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Mostrar rótulo</Label>
              <Switch
                checked={p.showLabel !== false}
                onCheckedChange={(v) => onUpdateProps({ showLabel: v })}
              />
            </div>
            <div>
              <Label className="text-xs">Fallback</Label>
              <Input
                value={p.fallback || ''}
                onChange={(e) => onUpdateProps({ fallback: e.target.value })}
              />
            </div>
          </div>
        </div>
      )
    case 'image':
      return (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase text-slate-500">Imagem</h4>
          <div className="space-y-2">
            <div>
              <Label className="text-xs">URL (ou logo_clinica)</Label>
              <Input value={p.src || ''} onChange={(e) => onUpdateProps({ src: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Opacidade (0 a 1)</Label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={p.opacity ?? 1}
                onChange={(e) => onUpdateProps({ opacity: Number(e.target.value) })}
                className="w-full accent-[#1E3A8A]"
              />
              <span className="text-[10px] text-slate-400">{p.opacity ?? 1}</span>
            </div>
            <div>
              <Label className="text-xs">Ajuste</Label>
              <Select
                value={p.fit || 'contain'}
                onValueChange={(v) => onUpdateProps({ fit: v as 'contain' | 'cover' | 'fill' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contain">Conter</SelectItem>
                  <SelectItem value="cover">Cobrir</SelectItem>
                  <SelectItem value="fill">Preencher</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )
    case 'line':
    case 'divider':
      return (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase text-slate-500">Linha</h4>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Direção</Label>
              <Select
                value={p.direction || 'horizontal'}
                onValueChange={(v) => onUpdateProps({ direction: v as 'horizontal' | 'vertical' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="horizontal">Horizontal</SelectItem>
                  <SelectItem value="vertical">Vertical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Espessura</Label>
              <Input
                type="number"
                value={p.thickness || 1}
                onChange={(e) => onUpdateProps({ thickness: Number(e.target.value) })}
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Cor</Label>
              <Input
                type="color"
                value={p.color || '#1E3A8A'}
                onChange={(e) => onUpdateProps({ color: e.target.value })}
                className="h-9 p-1"
              />
            </div>
          </div>
        </div>
      )
    case 'table':
      return (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase text-slate-500">Tabela</h4>
          <div className="space-y-2">
            <div>
              <Label className="text-xs">Fonte dinâmica</Label>
              <Select
                value={p.dynamicSource || 'none'}
                onValueChange={(v) =>
                  onUpdateProps({
                    dynamicSource:
                      v === 'none'
                        ? null
                        : (v as
                            | 'iprf'
                            | 'iprf_od'
                            | 'iprf_oe'
                            | 'srt_ldv'
                            | 'medias_tonais'
                            | 'timpanometria'
                            | 'reflexos'
                            | 'meatoscopia'
                            | 'identificacao'),
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma (manual)</SelectItem>
                  <SelectItem value="identificacao">Identificação (paciente/exame)</SelectItem>
                  <SelectItem value="iprf">IPRF (completa OD/OE)</SelectItem>
                  <SelectItem value="iprf_od">IPRF OD</SelectItem>
                  <SelectItem value="iprf_oe">IPRF OE</SelectItem>
                  <SelectItem value="srt_ldv">SRT / LDV</SelectItem>
                  <SelectItem value="medias_tonais">Médias tonais</SelectItem>
                  <SelectItem value="timpanometria">Timpanometria</SelectItem>
                  <SelectItem value="reflexos">Reflexos acústicos</SelectItem>
                  <SelectItem value="meatoscopia">Meatoscopia</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs shrink-0">Colunas: {p.columns?.length || 0}</Label>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const cols = [...(p.columns || [])]
                  cols.push({
                    label: `Coluna ${cols.length + 1}`,
                    field: `c${cols.length + 1}`,
                    width: 50,
                  })
                  onUpdateProps({ columns: cols })
                }}
              >
                + Coluna
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const cols = [...(p.columns || [])]
                  cols.pop()
                  onUpdateProps({ columns: cols })
                }}
              >
                − Coluna
              </Button>
            </div>
            {(p.columns || []).map((c, i) => (
              <div key={i} className="flex gap-1">
                <Input
                  value={c.label}
                  onChange={(e) => {
                    const cols = [...(p.columns || [])]
                    cols[i] = { ...cols[i], label: e.target.value }
                    onUpdateProps({ columns: cols })
                  }}
                  className="h-8"
                />
                <Input
                  type="number"
                  value={c.width || 50}
                  onChange={(e) => {
                    const cols = [...(p.columns || [])]
                    cols[i] = { ...cols[i], width: Number(e.target.value) }
                    onUpdateProps({ columns: cols })
                  }}
                  className="h-8 w-16"
                />
              </div>
            ))}
            <div className="flex items-center gap-2">
              <Label className="text-xs shrink-0">Linhas: {p.rows?.length || 0}</Label>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const rows = [...(p.rows || [])]
                  const cols = p.columns || []
                  const row: Record<string, string> = {}
                  cols.forEach((c) => (row[c.field] = '—'))
                  rows.push(row)
                  onUpdateProps({ rows })
                }}
              >
                + Linha
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const rows = [...(p.rows || [])]
                  rows.pop()
                  onUpdateProps({ rows })
                }}
              >
                − Linha
              </Button>
            </div>
            <div>
              <Label className="text-xs">Tamanho fonte</Label>
              <Input
                type="number"
                value={p.fontSize || 8}
                onChange={(e) => onUpdateProps({ fontSize: Number(e.target.value) })}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Cabeçalho</Label>
                <Input
                  type="color"
                  value={p.headerBgColor || '#F2F4F7'}
                  onChange={(e) => onUpdateProps({ headerBgColor: e.target.value })}
                  className="h-9 p-1"
                />
              </div>
              <div>
                <Label className="text-xs">Alt. linha</Label>
                <Input
                  type="color"
                  value={p.alternateRowColor || '#FAFBFC'}
                  onChange={(e) => onUpdateProps({ alternateRowColor: e.target.value })}
                  className="h-9 p-1"
                />
              </div>
              <div>
                <Label className="text-xs">Borda</Label>
                <Input
                  type="color"
                  value={p.borderColor || '#E2E8F0'}
                  onChange={(e) => onUpdateProps({ borderColor: e.target.value })}
                  className="h-9 p-1"
                />
              </div>
            </div>
          </div>
        </div>
      )
    case 'audiogram':
      return (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase text-slate-500">Audiograma</h4>
          <div className="space-y-2">
            <div>
              <Label className="text-xs">Modo</Label>
              <Select
                value={p.mode || 'combined'}
                onValueChange={(v) =>
                  onUpdateProps({ mode: v as 'combined' | 'od_only' | 'oe_only' | 'side_by_side' })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="combined">Combinado</SelectItem>
                  <SelectItem value="od_only">Apenas OD</SelectItem>
                  <SelectItem value="oe_only">Apenas OE</SelectItem>
                  <SelectItem value="side_by_side">Lado a lado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Via aérea</Label>
              <Switch
                checked={p.showAir !== false}
                onCheckedChange={(v) => onUpdateProps({ showAir: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Via óssea</Label>
              <Switch
                checked={p.showBone !== false}
                onCheckedChange={(v) => onUpdateProps({ showBone: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Legenda</Label>
              <Switch
                checked={p.showLegend !== false}
                onCheckedChange={(v) => onUpdateProps({ showLegend: v })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Cor OD</Label>
                <Input
                  type="color"
                  value={p.odColor || '#DC2626'}
                  onChange={(e) => onUpdateProps({ odColor: e.target.value })}
                  className="h-9 p-1"
                />
              </div>
              <div>
                <Label className="text-xs">Cor OE</Label>
                <Input
                  type="color"
                  value={p.oeColor || '#2563EB'}
                  onChange={(e) => onUpdateProps({ oeColor: e.target.value })}
                  className="h-9 p-1"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Espessura linha</Label>
              <Input
                type="number"
                step="0.1"
                value={p.lineThickness || 1.5}
                onChange={(e) => onUpdateProps({ lineThickness: Number(e.target.value) })}
              />
            </div>
          </div>
        </div>
      )
    case 'timpanogram':
      return (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase text-slate-500">Timpanograma</h4>
          <div className="space-y-2">
            <div>
              <Label className="text-xs">Modo</Label>
              <Select
                value={p.mode || 'combined'}
                onValueChange={(v) =>
                  onUpdateProps({ mode: v as 'combined' | 'od_only' | 'oe_only' | 'side_by_side' })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="combined">Combinado</SelectItem>
                  <SelectItem value="od_only">Apenas OD</SelectItem>
                  <SelectItem value="oe_only">Apenas OE</SelectItem>
                  <SelectItem value="side_by_side">Lado a lado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Cor OD</Label>
                <Input
                  type="color"
                  value={p.odColor || '#DC2626'}
                  onChange={(e) => onUpdateProps({ odColor: e.target.value })}
                  className="h-9 p-1"
                />
              </div>
              <div>
                <Label className="text-xs">Cor OE</Label>
                <Input
                  type="color"
                  value={p.oeColor || '#2563EB'}
                  onChange={(e) => onUpdateProps({ oeColor: e.target.value })}
                  className="h-9 p-1"
                />
              </div>
            </div>
          </div>
        </div>
      )
    case 'signature':
      return (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase text-slate-500">Assinatura</h4>
          <div className="space-y-2">
            <div>
              <Label className="text-xs">Quem assina</Label>
              <Select
                value={p.who || 'profissional'}
                onValueChange={(v) =>
                  onUpdateProps({ who: v as 'profissional' | 'paciente' | 'responsavel' })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="profissional">Profissional</SelectItem>
                  <SelectItem value="paciente">Paciente</SelectItem>
                  <SelectItem value="responsavel">Responsável</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Rótulo</Label>
              <Input
                value={p.label || ''}
                onChange={(e) => onUpdateProps({ label: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Mostrar nome</Label>
              <Switch
                checked={p.showName !== false}
                onCheckedChange={(v) => onUpdateProps({ showName: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Mostrar CRFa</Label>
              <Switch
                checked={p.showCrfa !== false}
                onCheckedChange={(v) => onUpdateProps({ showCrfa: v })}
              />
            </div>
            <div>
              <Label className="text-xs">Largura linha (%)</Label>
              <Input
                type="number"
                value={p.lineWidth || 80}
                onChange={(e) => onUpdateProps({ lineWidth: Number(e.target.value) })}
              />
            </div>
          </div>
        </div>
      )
    case 'section':
      return (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase text-slate-500">Seção</h4>
          <div className="space-y-2">
            <div>
              <Label className="text-xs">Título</Label>
              <Input
                value={p.title || ''}
                onChange={(e) => onUpdateProps({ title: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Cor borda</Label>
                <Input
                  type="color"
                  value={p.borderColor || '#1E3A8A'}
                  onChange={(e) => onUpdateProps({ borderColor: e.target.value })}
                  className="h-9 p-1"
                />
              </div>
              <div>
                <Label className="text-xs">Fundo título</Label>
                <Input
                  type="color"
                  value={p.titleBgColor || '#F2F4F7'}
                  onChange={(e) => onUpdateProps({ titleBgColor: e.target.value })}
                  className="h-9 p-1"
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Recolhível</Label>
              <Switch
                checked={!!p.collapsible}
                onCheckedChange={(v) => onUpdateProps({ collapsible: v })}
              />
            </div>
          </div>
        </div>
      )
    case 'watermark':
      return (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase text-slate-500">Marca d'água</h4>
          <div>
            <Label className="text-xs">Texto</Label>
            <Input
              value={p.content || ''}
              onChange={(e) => onUpdateProps({ content: e.target.value })}
            />
          </div>
        </div>
      )
    case 'rectangle':
      return (
        <div className="text-xs text-slate-400">
          Use a seção Estilo para configurar bordas e fundo.
        </div>
      )
    default:
      return null
  }
}
