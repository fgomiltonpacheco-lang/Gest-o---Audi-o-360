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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
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
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { getTemplate, saveDraft, publishTemplate } from '@/lib/examReportTemplates'
import {
  ELEMENT_DEFS,
  PACIENTE_FIELDS,
  EXAME_FIELDS,
  createElement,
  createElementByType,
} from '@/lib/examReportElements'
import { mmToPx } from '@/components/print/TemplateRenderer'
import type { ExamReportTemplate, LayoutElement, LayoutElementType } from '@/types'

const MM_PX = 3.7795275591

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

export default function ExamReportTemplateEditor() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [template, setTemplate] = useState<ExamReportTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const [elementos, setElementos] = useState<LayoutElement[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(0.38)
  const [salvando, setSalvando] = useState(false)

  // ---- Undo/Redo (histórico de snapshots) ----
  const [history, setHistory] = useState<LayoutElement[][]>([])
  const [histIdx, setHistIdx] = useState(-1)
  const [dirty, setDirty] = useState(false)
  const skipHistory = useRef(false)

  // Empurra o estado atual para o histórico (quando há mudança real)
  const pushHistory = useCallback(
    (next: LayoutElement[]) => {
      setHistory((prev) => {
        const trimmed = prev.slice(0, histIdx + 1)
        trimmed.push(next)
        // Limita a 50 estados
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
  }, [undo, redo, selectedId])

  // ---- Adicionar elemento ----
  const adicionarElemento = (defIdx: number) => {
    const def = ELEMENT_DEFS[defIdx]
    const el = createElement(def, 60, 60)
    setElementosTracked((prev) => [...prev, el])
    setSelectedId(el.id)
  }

  const adicionarCampoPaciente = (token: string, label: string) => {
    const el = createElementByType('text', 'Campo automático', 60, 60)
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
    const el = createElementByType('field', 'Campo do exame', 60, 60)
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

  const updateElemento = (elId: string, patch: Partial<LayoutElement>) => {
    setElementosTracked((prev) => prev.map((e) => (e.id === elId ? { ...e, ...patch } : e)))
  }

  const updateElementoStyle = (elId: string, stylePatch: Partial<LayoutElement['style']>) => {
    setElementosTracked((prev) =>
      prev.map((e) => (e.id === elId ? { ...e, style: { ...e.style, ...stylePatch } } : e)),
    )
  }

  const updateElementoProps = (elId: string, propsPatch: Partial<LayoutElement['props']>) => {
    setElementosTracked((prev) =>
      prev.map((e) => (e.id === elId ? { ...e, props: { ...e.props, ...propsPatch } } : e)),
    )
  }

  const excluirElemento = (elId: string) => {
    setElementosTracked((prev) => prev.filter((e) => e.id !== elId))
    if (selectedId === elId) setSelectedId(null)
  }

  const duplicarElemento = (elId: string) => {
    const el = elementos.find((e) => e.id === elId)
    if (!el) return
    const copia: LayoutElement = {
      ...JSON.parse(JSON.stringify(el)),
      id: `el_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      x: el.x + 10,
      y: el.y + 10,
      zIndex: (el.zIndex || 1) + 1,
    }
    setElementosTracked((prev) => [...prev, copia])
    setSelectedId(copia.id)
  }

  const trazerFrente = (elId: string) => {
    setElementosTracked((prev) =>
      prev.map((e) => (e.id === elId ? { ...e, zIndex: (e.zIndex || 1) + 1 } : e)),
    )
  }
  const enviarTras = (elId: string) => {
    setElementosTracked((prev) =>
      prev.map((e) => (e.id === elId ? { ...e, zIndex: Math.max(0, (e.zIndex || 1) - 1) } : e)),
    )
  }

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

      if (ds.mode === 'move') {
        const nx = Math.round(ds.origX + dxMm)
        const ny = Math.round(ds.origY + dyMm)
        setElementos((prev) => prev.map((el) => (el.id === ds.elId ? { ...el, x: nx, y: ny } : el)))
      } else if (ds.mode === 'resize') {
        let { origX: nx, origY: ny, origW: nw, origH: nh } = ds
        const h = ds.handle!
        if (h.includes('e')) nw = Math.max(5, ds.origW + dxMm)
        if (h.includes('s')) nh = Math.max(5, ds.origH + dyMm)
        if (h.includes('w')) {
          nw = Math.max(5, ds.origW - dxMm)
          nx = ds.origX + dxMm
        }
        if (h.includes('n')) {
          nh = Math.max(5, ds.origH - dyMm)
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
      if (dragState.current) {
        // commit histórico no fim do drag
        const finalState = elementos
        // Como setElementos durante o drag não foi tracked, empurramos agora
        pushHistory(finalState)
      }
      dragState.current = null
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [zoom, elementos, pushHistory])

  // ---- Context menu (botão direito) ----
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; elId: string } | null>(null)
  const onContextMenu = (e: React.MouseEvent, el: LayoutElement) => {
    e.preventDefault()
    e.stopPropagation()
    setSelectedId(el.id)
    setCtxMenu({ x: e.clientX, y: e.clientY, elId: el.id })
  }
  useEffect(() => {
    const close = () => setCtxMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [])

  // ---- Salvar / Publicar ----
  const handleSalvarRascunho = async () => {
    if (!template) return
    setSalvando(true)
    try {
      await saveDraft(template.id, elementos)
      setDirty(false)
      toast({ title: 'Rascunho salvo' })
    } catch (err) {
      toast({ title: 'Erro ao salvar', description: String(err), variant: 'destructive' })
    } finally {
      setSalvando(false)
    }
  }

  const handlePublicar = async () => {
    if (!template) return
    if (dirty) {
      if (!confirm('Você tem alterações não salvas. Salvar e publicar agora?')) return
      await handleSalvarRascunho()
    }
    if (
      !confirm(
        `Publicar o modelo "${template.nome_modelo}"? Ele se tornará o padrão para ${template.tipo_exame}.`,
      )
    )
      return
    try {
      await publishTemplate(template.id)
      toast({ title: 'Modelo publicado', description: 'Nova versão criada.' })
      setDirty(false)
      carregar()
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
      <div className="flex min-h-screen items-center justify-center text-red-500">
        Modelo não encontrado.
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
      {/* ===== Header ===== */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-white px-4 py-2 shadow-sm">
        <div className="flex items-center gap-3">
          <Link to="/configuracoes/laudos">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-base font-semibold text-slate-800">{template.nome_modelo}</h1>
            <p className="text-xs text-slate-500">
              {template.tipo_exame} • v{template.versao} • {template.status}
              {dirty && <span className="ml-2 text-amber-600">● não salvo</span>}
            </p>
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
            onClick={() => setZoom((z) => Math.max(0.2, z - 0.05))}
            title="Diminuir zoom"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="w-12 text-center text-xs text-slate-600">{Math.round(zoom * 100)}%</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setZoom((z) => Math.min(1, z + 0.05))}
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
          <Button size="sm" className="bg-[#00897B] hover:bg-[#0a8a7a]" onClick={handlePublicar}>
            <Send className="mr-1 h-4 w-4" /> Publicar
          </Button>
        </div>
      </div>

      {/* ===== Corpo: 3 painéis ===== */}
      <div className="flex flex-1 overflow-hidden">
        {/* Painel esquerdo — Elementos */}
        <div className="w-64 shrink-0 overflow-y-auto border-r bg-white">
          <Tabs defaultValue="elementos" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="elementos" className="text-xs">
                Elementos
              </TabsTrigger>
              <TabsTrigger value="paciente" className="text-xs">
                Paciente
              </TabsTrigger>
              <TabsTrigger value="exame" className="text-xs">
                Exame
              </TabsTrigger>
            </TabsList>

            <TabsContent value="elementos" className="p-3">
              <p className="mb-2 text-xs text-slate-500">Clique para adicionar ao canvas:</p>
              <div className="space-y-1">
                {ELEMENT_DEFS.map((def, i) => (
                  <button
                    key={`${def.type}-${i}`}
                    onClick={() => adicionarElemento(i)}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100"
                  >
                    <Plus className="h-3 w-3 text-[#1E3A8A]" />
                    {def.label}
                  </button>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="paciente" className="p-3">
              <p className="mb-2 text-xs text-slate-500">Campos dinâmicos do paciente:</p>
              <div className="space-y-1">
                {PACIENTE_FIELDS.map((f) => (
                  <button
                    key={f.token}
                    onClick={() => adicionarCampoPaciente(f.token, f.label)}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100"
                  >
                    <Plus className="h-3 w-3 text-[#1E3A8A]" />
                    {f.label}
                    <code className="ml-auto text-[10px] text-slate-400">{`{{${f.token}}}`}</code>
                  </button>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="exame" className="p-3">
              <p className="mb-2 text-xs text-slate-500">
                Campos do exame ({template.tipo_exame}):
              </p>
              <div className="space-y-1">
                {exameFields.map((f) => (
                  <button
                    key={f.field}
                    onClick={() => adicionarCampoExame(f.field, f.label)}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100"
                  >
                    <Plus className="h-3 w-3 text-[#00897B]" />
                    {f.label}
                  </button>
                ))}
              </div>
            </TabsContent>
          </Tabs>
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
                  onContextMenu={(e) => onContextMenu(e, el)}
                />
              ))}
            </div>
          </div>

          {/* Menu de contexto */}
          {ctxMenu && (
            <div
              className="fixed z-50 min-w-[160px] rounded-md border bg-white py-1 text-sm shadow-lg"
              style={{ left: ctxMenu.x, top: ctxMenu.y }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-slate-100"
                onClick={() => {
                  duplicarElemento(ctxMenu.elId)
                  setCtxMenu(null)
                }}
              >
                <Copy className="h-3 w-3" /> Duplicar
              </button>
              <button
                className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-slate-100"
                onClick={() => {
                  trazerFrente(ctxMenu.elId)
                  setCtxMenu(null)
                }}
              >
                <BringToFront className="h-3 w-3" /> Trazer frente
              </button>
              <button
                className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-slate-100"
                onClick={() => {
                  enviarTras(ctxMenu.elId)
                  setCtxMenu(null)
                }}
              >
                <SendToBack className="h-3 w-3" /> Enviar trás
              </button>
              <button
                className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-slate-100"
                onClick={() => {
                  const el = elementos.find((e) => e.id === ctxMenu.elId)
                  if (el) updateElemento(ctxMenu.elId, { locked: !el.locked })
                  setCtxMenu(null)
                }}
              >
                {elementos.find((e) => e.id === ctxMenu.elId)?.locked ? (
                  <Unlock className="h-3 w-3" />
                ) : (
                  <Lock className="h-3 w-3" />
                )}
                {elementos.find((e) => e.id === ctxMenu.elId)?.locked ? 'Desbloquear' : 'Bloquear'}
              </button>
              <Separator className="my-1" />
              <button
                className="flex w-full items-center gap-2 px-3 py-1.5 text-red-600 hover:bg-red-50"
                onClick={() => {
                  excluirElemento(ctxMenu.elId)
                  setCtxMenu(null)
                }}
              >
                <Trash2 className="h-3 w-3" /> Excluir
              </button>
            </div>
          )}
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
          Tamanho: {template.largura_pagina}×{template.altura_pagina} mm • {template.orientacao}
        </span>
      </div>
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
  onContextMenu: (e: React.MouseEvent) => void
}> = ({ el, zoom, selected, onSelect, onMouseDown, onHandleMouseDown, onContextMenu }) => {
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
      onContextMenu={onContextMenu}
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
          [imagem]
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
          [audiograma]
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
          <div className="text-[6pt] text-slate-400 p-1">[agrupador]</div>
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
  onUpdateStyle: (patch: Partial<LayoutElement['style']>) => void
  onUpdateProps: (patch: Partial<LayoutElement['props']>) => void
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
          <h3 className="text-sm font-semibold text-slate-800">Propriedades</h3>
          <BadgeTipo tipo={el.type} />
        </div>
        <p className="text-[10px] text-slate-400">ID: {el.id}</p>
      </div>

      <Separator />

      {/* Posição e tamanho */}
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

      <div className="flex items-center justify-between">
        <Label className="text-xs">Bloqueado</Label>
        <Switch checked={!!el.locked} onCheckedChange={(v) => onUpdate({ locked: v })} />
      </div>
      <div className="flex items-center justify-between">
        <Label className="text-xs">Visível</Label>
        <Switch checked={el.visible !== false} onCheckedChange={(v) => onUpdate({ visible: v })} />
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
          >
            N
          </Button>
          <Button
            size="sm"
            variant={s.italic ? 'default' : 'outline'}
            onClick={() => onUpdateStyle({ italic: !s.italic })}
          >
            I
          </Button>
          <Button
            size="sm"
            variant={s.underline ? 'default' : 'outline'}
            onClick={() => onUpdateStyle({ underline: !s.underline })}
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
                onUpdateStyle({
                  align: v as LayoutElement['style'] extends { align?: infer A } ? A : never,
                })
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
            <Label className="text-xs">Cor</Label>
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
            <Label className="text-xs">Borda cor</Label>
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
          <div>
            <Label className="text-xs">Linha altura</Label>
            <Input
              type="number"
              step="0.1"
              value={s.lineHeight || 1.2}
              onChange={(e) => onUpdateStyle({ lineHeight: Number(e.target.value) })}
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
  onUpdateProps: (patch: Partial<LayoutElement['props']>) => void
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
              <Label className="text-xs">URL (ou logo_clinica, assinatura, carimbo)</Label>
              <Input value={p.src || ''} onChange={(e) => onUpdateProps({ src: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Opacidade</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="1"
                value={p.opacity ?? 1}
                onChange={(e) => onUpdateProps({ opacity: Number(e.target.value) })}
              />
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
                        : (v as LayoutElement['props'] extends { dynamicSource?: infer D }
                            ? D
                            : never),
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma (manual)</SelectItem>
                  <SelectItem value="iprf_od">IPRF OD</SelectItem>
                  <SelectItem value="iprf_oe">IPRF OE</SelectItem>
                  <SelectItem value="timpanometria">Timpanometria</SelectItem>
                  <SelectItem value="reflexos">Reflexos</SelectItem>
                  <SelectItem value="identificacao">Identificação</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Tamanho fonte</Label>
              <Input
                type="number"
                value={p.fontSize || 8}
                onChange={(e) => onUpdateProps({ fontSize: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label className="text-xs">Cor cabeçalho</Label>
              <Input
                type="color"
                value={p.headerBgColor || '#F2F4F7'}
                onChange={(e) => onUpdateProps({ headerBgColor: e.target.value })}
                className="h-9 p-1"
              />
            </div>
            <div>
              <Label className="text-xs">Cor linha alternada</Label>
              <Input
                type="color"
                value={p.alternateRowColor || '#FAFBFC'}
                onChange={(e) => onUpdateProps({ alternateRowColor: e.target.value })}
                className="h-9 p-1"
              />
            </div>
            <div>
              <Label className="text-xs">Cor borda</Label>
              <Input
                type="color"
                value={p.borderColor || '#E2E8F0'}
                onChange={(e) => onUpdateProps({ borderColor: e.target.value })}
                className="h-9 p-1"
              />
            </div>
            <p className="text-[10px] text-slate-400">
              Colunas e linhas editáveis via JSON no banco.
            </p>
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
            <div className="flex items-center justify-between">
              <Label className="text-xs">Pontos ausentes</Label>
              <Switch
                checked={p.showAbsentPoints !== false}
                onCheckedChange={(v) => onUpdateProps({ showAbsentPoints: v })}
              />
            </div>
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
              <Label className="text-xs">Cor fundo título</Label>
              <Input
                type="color"
                value={p.titleBgColor || '#F2F4F7'}
                onChange={(e) => onUpdateProps({ titleBgColor: e.target.value })}
                className="h-9 p-1"
              />
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
