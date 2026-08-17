import { useEffect, useState, useMemo, useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  History,
  RotateCcw,
  GitCompareArrows,
  Loader2,
  Eye,
  CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { getTemplate, listVersions, restoreVersion } from '@/lib/examReportTemplates'
import type { ExamReportTemplate, ExamReportTemplateVersion, LayoutElement } from '@/types'
import {
  TemplateRenderer,
  type ElementHighlight,
  type TemplateDataContext,
} from '@/components/print/TemplateRenderer'

// Contexto de exemplo para a pré-visualização das versões (canvas A4)
const PREVIEW_CTX: TemplateDataContext = {
  paciente: {
    nome: 'Paciente Exemplo',
    cpf: '000.000.000-00',
    data_nascimento: '01/01/1980',
    idade: '45 anos',
    sexo: 'Feminino',
  },
  exame: {
    data: '01/01/2024',
    air_od: { '500': { db: 10 }, '1000': { db: 15 }, '2000': { db: 20 }, '4000': { db: 25 } },
    air_oe: { '500': { db: 10 }, '1000': { db: 15 }, '2000': { db: 20 }, '4000': { db: 25 } },
    bone_od: {},
    bone_oe: {},
    srt_od: 10,
    srt_oe: 10,
    ldv_od: 90,
    ldv_oe: 90,
    mt_od: 15,
    mt_oe: 15,
    iprf_vocal: {
      od: {
        intensidade: 40,
        monossilabos: 96,
        dissilabos: 98,
        mascaramento: 0,
        palavras_faladas: 'OK',
      },
      oe: {
        intensidade: 40,
        monossilabos: 96,
        dissilabos: 98,
        mascaramento: 0,
        palavras_faladas: 'OK',
      },
    },
    meatoscopia: {
      od_normal: true,
      oe_normal: true,
      od_alterada: false,
      oe_alterada: false,
      od_obs: '',
      oe_obs: '',
    },
    timpanometria: {
      OD: {
        tipo_curva: 'A',
        volume_meato: 1.0,
        complacencia: 0.5,
        pressao_pico: 0,
        gradiente_curva: 0.6,
        curva_descricao: 'Curva tipo A',
        observacoes: '',
      },
      OE: {
        tipo_curva: 'A',
        volume_meato: 1.0,
        complacencia: 0.5,
        pressao_pico: 0,
        gradiente_curva: 0.6,
        curva_descricao: 'Curva tipo A',
        observacoes: '',
      },
    },
    reflexos: {
      OD: {
        ipsi_lateral: {
          frequencia_500: 80,
          frequencia_1000: 85,
          frequencia_2000: 90,
          frequencia_4000: 85,
          status: 'presente',
        },
        contra_lateral: {
          frequencia_500: 85,
          frequencia_1000: 90,
          frequencia_2000: 95,
          frequencia_4000: 90,
          status: 'presente',
        },
      },
      OE: {
        ipsi_lateral: {
          frequencia_500: 80,
          frequencia_1000: 85,
          frequencia_2000: 90,
          frequencia_4000: 85,
          status: 'presente',
        },
        contra_lateral: {
          frequencia_500: 85,
          frequencia_1000: 90,
          frequencia_2000: 95,
          frequencia_4000: 90,
          status: 'presente',
        },
      },
    },
  },
  profissional: { nome: 'Profissional Exemplo', crfa: 'CRFa 00-00000' },
  clinica: { nome: 'Clínica Exemplo', endereco: '', telefone: '', email: '' },
}

/** Assinatura estável de um elemento para comparação entre versões. */
function elementSignature(el: {
  type?: string
  label?: string
  x?: number
  y?: number
  width?: number
  height?: number
  props?: Record<string, unknown>
}): string {
  // Ignora id (que pode variar) e zIndex; compara tipo, posição, tamanho e props.
  const { type = '', label = '', x = 0, y = 0, width = 0, height = 0 } = el
  let propsSig = ''
  try {
    propsSig = JSON.stringify(el.props || {})
  } catch {
    propsSig = ''
  }
  return `${type}|${label}|${x},${y},${width}x${height}|${propsSig}`
}

type DiffEl = {
  id: string
  type?: string
  label?: string
  x?: number
  y?: number
  width?: number
  height?: number
  props?: Record<string, unknown>
}

function toDiffEl(el: LayoutElement): DiffEl {
  return {
    id: el.id,
    type: el.type,
    label: el.label,
    x: el.x,
    y: el.y,
    width: el.width,
    height: el.height,
    props: (el.props as Record<string, unknown> | undefined) || undefined,
  }
}

function buildDiff(
  baseEls: DiffEl[],
  compEls: DiffEl[],
): {
  baseHighlights: Record<string, ElementHighlight>
  compHighlights: Record<string, ElementHighlight>
  added: number
  removed: number
  changed: number
} {
  // Emparelha elementos por assinatura (primeira ocorrência) — tolerante a ids diferentes.
  const compBySig = new Map<string, string[]>()
  for (const e of compEls) {
    const sig = elementSignature(e)
    const arr = compBySig.get(sig) || []
    arr.push(e.id)
    compBySig.set(sig, arr)
  }
  const baseHighlights: Record<string, ElementHighlight> = {}
  const compHighlights: Record<string, ElementHighlight> = {}
  const matchedCompIds = new Set<string>()
  let added = 0
  let removed = 0
  let changed = 0

  for (const be of baseEls) {
    const sig = elementSignature(be)
    const candidates = compBySig.get(sig)
    if (candidates && candidates.length) {
      const cid = candidates.shift()!
      matchedCompIds.add(cid)
      // Propriedades idênticas (por assinatura) → sem destaque
      if (candidates.length === 0) compBySig.delete(sig)
    } else {
      // Pode ter mudado props mas mantido posição/tipo: tentamos casar por tipo+posição
      const looseSig = `${be.type}|${be.label}|${be.x},${be.y},${be.width}x${be.height}`
      let looseMatch: string | null = null
      for (const [csig, ids] of compBySig) {
        if (csig.startsWith(looseSig)) {
          looseMatch = ids.shift()!
          if (ids.length === 0) compBySig.delete(csig)
          break
        }
      }
      if (looseMatch) {
        matchedCompIds.add(looseMatch)
        baseHighlights[be.id] = 'changed'
        compHighlights[looseMatch] = 'changed'
        changed++
      } else {
        baseHighlights[be.id] = 'removed'
        removed++
      }
    }
  }
  for (const e of compEls) {
    if (!matchedCompIds.has(e.id)) {
      compHighlights[e.id] = 'added'
      added++
    }
  }
  return { baseHighlights, compHighlights, added, removed, changed }
}

export default function ExamReportTemplateVersions() {
  const { id } = useParams<{ id: string }>()
  const { toast } = useToast()
  const [template, setTemplate] = useState<ExamReportTemplate | null>(null)
  const [versions, setVersions] = useState<ExamReportTemplateVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [compararAberto, setCompararAberto] = useState(false)

  const carregar = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [tpl, vers] = await Promise.all([getTemplate(id), listVersions(id)])
      setTemplate(tpl)
      // listVersions vem em ordem decrescente; invertemos para cronológica (mais antiga → mais nova)
      setVersions([...vers].sort((a, b) => a.numero_versao - b.numero_versao))
    } catch (err) {
      toast({
        title: 'Erro ao carregar versões',
        description: String(err),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [id, toast])

  useEffect(() => {
    carregar()
  }, [carregar])

  const toggleSelect = (vId: string) => {
    setSelected((cur) => {
      if (cur.includes(vId)) return cur.filter((x) => x !== vId)
      if (cur.length >= 2) return [cur[1], vId]
      return [...cur, vId]
    })
  }

  const handleRestaurar = async (v: ExamReportTemplateVersion) => {
    if (
      !confirm(
        `Restaurar a versão v${v.numero_versao}? O layout atual será substituído pelo da versão selecionada e o modelo voltará ao status de rascunho (uma nova publicação será necessária).`,
      )
    ) {
      return
    }
    setRestoring(v.id)
    try {
      await restoreVersion(id!, v.id)
      toast({
        title: 'Versão restaurada',
        description: `Layout da versão v${v.numero_versao} aplicado como rascunho. A restauração foi registrada na trilha de auditoria.`,
      })
      await carregar()
    } catch (err) {
      toast({
        title: 'Erro ao restaurar versão',
        description: String(err),
        variant: 'destructive',
      })
    } finally {
      setRestoring(null)
    }
  }

  const versaoAtual = template?.versao

  const selecionadas = useMemo(
    () =>
      selected
        .map((sid) => versions.find((v) => v.id === sid))
        .filter(Boolean) as ExamReportTemplateVersion[],
    [selected, versions],
  )

  const diff = useMemo(() => {
    if (selecionadas.length !== 2) return null
    const [v1, v2] = selecionadas
    const d = buildDiff(
      (v1.estrutura_layout || []).map(toDiffEl),
      (v2.estrutura_layout || []).map(toDiffEl),
    )
    return { v1, v2, ...d }
  }, [selecionadas])

  const templateForVersion = (v: ExamReportTemplateVersion): ExamReportTemplate => ({
    ...(template as ExamReportTemplate),
    estrutura_layout: v.estrutura_layout || [],
    versao: v.numero_versao,
    status: 'publicado',
  })

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando histórico...
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

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-6xl">
        {/* Breadcrumb */}
        <div className="mb-4 flex flex-wrap items-center gap-1 text-sm text-slate-500">
          <Link to="/configuracoes/laudos" className="hover:text-slate-700">
            Modelos
          </Link>
          <span>/</span>
          <Link to="/configuracoes/laudos" className="hover:text-slate-700">
            {template.nome_modelo}
          </Link>
          <span>/</span>
          <span className="font-semibold text-slate-700">Histórico de Versões</span>
        </div>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link to="/configuracoes/laudos">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <History className="h-6 w-6 text-[#1E3A8A]" />
              <div>
                <h1 className="text-2xl font-bold text-slate-800">Histórico de Versões</h1>
                <p className="text-xs text-slate-500">{template.nome_modelo}</p>
              </div>
            </div>
          </div>
          <Button
            disabled={selected.length !== 2}
            onClick={() => setCompararAberto(true)}
            className="bg-[#1E3A8A] hover:bg-[#1e40af] disabled:opacity-50"
          >
            <GitCompareArrows className="mr-2 h-4 w-4" />
            Comparar selecionadas ({selected.length}/2)
          </Button>
        </div>

        <Card className="mb-4 border-blue-100 bg-blue-50/50">
          <CardContent className="p-4 text-sm text-slate-600">
            <p>
              Selecione <strong>duas versões</strong> usando as caixas de seleção para compará-las
              lado a lado. Versões com layout idêntico aparecem sem destaque; elementos{' '}
              <span className="font-semibold text-emerald-700">novos</span> aparecem em verde,{' '}
              <span className="font-semibold text-red-700">removidos</span> em vermelho e{' '}
              <span className="font-semibold text-amber-700">alterados</span> em amarelo.
            </p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-100">
                  <TableHead className="w-10 text-center font-semibold">Sel.</TableHead>
                  <TableHead className="font-semibold">Versão</TableHead>
                  <TableHead className="font-semibold">Data</TableHead>
                  <TableHead className="font-semibold">Usuário</TableHead>
                  <TableHead className="font-semibold">Motivo</TableHead>
                  <TableHead className="text-right font-semibold">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...versions].reverse().map((v) => {
                  const isAtual = versaoAtual !== undefined && v.numero_versao === versaoAtual
                  const isSelected = selected.includes(v.id)
                  return (
                    <TableRow
                      key={v.id}
                      className={isAtual ? 'bg-emerald-50/60' : 'hover:bg-slate-50'}
                    >
                      <TableCell className="text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(v.id)}
                          className="h-4 w-4 rounded border-slate-300"
                          aria-label={`Selecionar versão ${v.numero_versao}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800">v{v.numero_versao}</span>
                          {isAtual && (
                            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                              <CheckCircle2 className="mr-1 h-3 w-3" /> Atual
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {v.created ? new Date(v.created).toLocaleString('pt-BR') : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {v.alterado_por || '—'}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {v.motivo_alteracao || '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Visualizar layout"
                            onClick={() => {
                              setSelected([v.id])
                              setCompararAberto(true)
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {!isAtual && (
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Restaurar esta versão"
                              className="text-amber-600 hover:text-amber-700"
                              disabled={restoring === v.id}
                              onClick={() => handleRestaurar(v)}
                            >
                              {restoring === v.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <RotateCcw className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {versions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-slate-400">
                      Nenhuma versão publicada ainda. Publique o modelo para gerar o primeiro
                      snapshot de versão.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {/* Modal de comparação lado a lado */}
      <Dialog open={compararAberto} onOpenChange={setCompararAberto}>
        <DialogContent className="max-w-[95vw] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selecionadas.length === 2
                ? `Comparação — v${diff?.v1.numero_versao} × v${diff?.v2.numero_versao}`
                : selecionadas.length === 1
                  ? `Visualização — v${selecionadas[0].numero_versao}`
                  : 'Comparação de versões'}
            </DialogTitle>
          </DialogHeader>

          {selecionadas.length === 2 && diff && (
            <div className="mb-3 flex flex-wrap items-center gap-3 text-xs">
              <span className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded-sm border-2 border-emerald-600" />
                {diff.added} novo(s)
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded-sm border-2 border-red-600" />
                {diff.removed} removido(s)
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded-sm border-2 border-amber-600" />
                {diff.changed} alterado(s)
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {selecionadas.length >= 1 && (
              <div>
                <div className="mb-2 text-center text-sm font-semibold text-slate-700">
                  Versão v{selecionadas[0].numero_versao}
                  {selecionadas.length === 2 && diff && (
                    <span className="ml-2 text-xs text-slate-400">
                      ({diff.removed} removido(s) · {diff.changed} alterado(s))
                    </span>
                  )}
                </div>
                <div className="overflow-auto rounded-lg border border-slate-200 bg-slate-100 p-2">
                  <div
                    style={{ transform: 'scale(0.55)', transformOrigin: 'top left' }}
                    className="shadow-md"
                  >
                    <TemplateRenderer
                      template={templateForVersion(selecionadas[0])}
                      data={PREVIEW_CTX}
                      scale={1}
                      highlightMap={selecionadas.length === 2 ? diff?.baseHighlights : undefined}
                    />
                  </div>
                </div>
              </div>
            )}
            {selecionadas.length === 2 && diff && (
              <div>
                <div className="mb-2 text-center text-sm font-semibold text-slate-700">
                  Versão v{selecionadas[1].numero_versao}
                  <span className="ml-2 text-xs text-slate-400">
                    ({diff.added} novo(s) · {diff.changed} alterado(s))
                  </span>
                </div>
                <div className="overflow-auto rounded-lg border border-slate-200 bg-slate-100 p-2">
                  <div
                    style={{ transform: 'scale(0.55)', transformOrigin: 'top left' }}
                    className="shadow-md"
                  >
                    <TemplateRenderer
                      template={templateForVersion(selecionadas[1])}
                      data={PREVIEW_CTX}
                      scale={1}
                      highlightMap={diff.compHighlights}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCompararAberto(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
