import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Plus,
  Edit,
  Copy,
  Eye,
  Send,
  Archive,
  Trash2,
  FileText,
  ArrowLeft,
  LayoutTemplate,
  CheckCircle2,
  FileEdit,
  Archive as ArchiveIcon,
  History,
  Download,
  Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { useApp } from '@/context/AppContext'
import {
  listTemplates,
  deleteTemplate,
  duplicateTemplate,
  publishTemplate,
  archiveTemplate,
  createTemplate,
  updateTemplate,
} from '@/lib/examReportTemplates'
import type {
  ExamReportTemplate,
  ExamReportStatus,
  ExamReportTipoExame,
  LayoutElement,
  ExamReportOrientacao,
} from '@/types'
import { EXAM_REPORT_TIPO_LABELS, EXAM_REPORT_STATUS_LABELS } from '@/types'

// ===== Exportar / Importar templates (JSON) =====
type ExportedTemplate = {
  nome_modelo: string
  tipo_exame: ExamReportTipoExame
  orientacao?: ExamReportOrientacao
  largura_pagina?: number
  altura_pagina?: number
  margem_superior?: number
  margem_inferior?: number
  margem_esquerda?: number
  margem_direita?: number
  descricao?: string
  estrutura_layout: LayoutElement[]
  logo_url?: string
  fonte_padrao?: string
  tamanho_fonte_padrao?: number
  cor_primaria?: string
  cor_secundaria?: string
  observacoes?: string
  cabecalho_configuracao?: Record<string, unknown>
  rodape_configuracao?: Record<string, unknown>
}

const EXPORT_BLOCKLIST = new Set([
  'id',
  'created',
  'updated',
  'criado_por',
  'atualizado_por',
  'publicado_por',
  'publicado_em',
  'versao',
  'status',
])

function exportTemplateToJSON(t: ExamReportTemplate): string {
  const raw: Record<string, unknown> = { ...t }
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (!EXPORT_BLOCKLIST.has(k)) out[k] = v
  }
  return JSON.stringify(out, null, 2)
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'modelo'
  )
}

function downloadJSON(filename: string, content: string) {
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 500)
}

function validateImportedTemplate(obj: unknown): obj is ExportedTemplate {
  if (!obj || typeof obj !== 'object') return false
  const o = obj as Record<string, unknown>
  if (typeof o.nome_modelo !== 'string' || !o.nome_modelo.trim()) return false
  if (typeof o.tipo_exame !== 'string') return false
  if (!Array.isArray(o.estrutura_layout)) return false
  return true
}
// ===== Fim Exportar / Importar =====

const STATUS_CLASS: Record<ExamReportStatus, string> = {
  rascunho: 'bg-amber-100 text-amber-700 border-amber-200',
  publicado: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  arquivado: 'bg-slate-200 text-slate-600 border-slate-300',
  finalizado: 'bg-blue-100 text-blue-700 border-blue-200',
  assinado: 'bg-indigo-100 text-indigo-700 border-indigo-200',
}

export default function ExamReportTemplatesList() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { currentUser } = useApp()
  const [templates, setTemplates] = useState<ExamReportTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroTipo, setFiltroTipo] = useState<'todos' | ExamReportTipoExame>('todos')
  const [filtroStatus, setFiltroStatus] = useState<'todos' | ExamReportStatus>('todos')
  const [busca, setBusca] = useState('')

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const lista = await listTemplates()
      setTemplates(lista)
    } catch (err) {
      toast({ title: 'Erro ao carregar modelos', description: String(err), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    carregar()
  }, [carregar])

  const handleDuplicar = async (id: string) => {
    try {
      await duplicateTemplate(id)
      toast({ title: 'Modelo duplicado', description: 'Uma cópia em rascunho foi criada.' })
      carregar()
    } catch (err) {
      toast({ title: 'Erro ao duplicar', description: String(err), variant: 'destructive' })
    }
  }

  const handlePublicar = async (id: string, nome: string) => {
    if (
      !confirm(
        `Publicar o modelo "${nome}"? Ele se tornará o modelo padrão para o tipo de exame. Se já existir outro publicado do mesmo tipo, ele será arquivado.`,
      )
    ) {
      return
    }
    try {
      await publishTemplate(id)
      toast({
        title: 'Modelo publicado',
        description: 'O modelo agora é o padrão para este tipo de exame.',
      })
      carregar()
    } catch (err) {
      toast({ title: 'Erro ao publicar', description: String(err), variant: 'destructive' })
    }
  }

  const handleArquivar = async (id: string, nome: string) => {
    if (!confirm(`Arquivar o modelo "${nome}"? Ele não será mais usado como padrão.`)) return
    try {
      await archiveTemplate(id)
      toast({ title: 'Modelo arquivado' })
      carregar()
    } catch (err) {
      toast({ title: 'Erro ao arquivar', description: String(err), variant: 'destructive' })
    }
  }

  const handleExcluir = async (id: string, nome: string) => {
    if (!confirm(`Excluir definitivamente o modelo "${nome}"? Esta ação não pode ser desfeita.`))
      return
    try {
      await deleteTemplate(id)
      toast({ title: 'Modelo excluído' })
      carregar()
    } catch (err) {
      toast({ title: 'Erro ao excluir', description: String(err), variant: 'destructive' })
    }
  }

  const handleExportar = (t: ExamReportTemplate) => {
    try {
      const json = exportTemplateToJSON(t)
      const slug = slugify(t.nome_modelo)
      const tipoSlug = slugify(EXAM_REPORT_TIPO_LABELS[t.tipo_exame] || t.tipo_exame)
      downloadJSON(`template-${tipoSlug}-${slug}.json`, json)
      toast({ title: 'Modelo exportado', description: `Arquivo template-${tipoSlug}-${slug}.json` })
    } catch (err) {
      toast({ title: 'Erro ao exportar', description: String(err), variant: 'destructive' })
    }
  }

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [importando, setImportando] = useState(false)

  const handleImportarClick = () => {
    fileInputRef.current?.click()
  }

  const handleArquivoSelecionado = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // limpa o input para permitir re-selecionar o mesmo arquivo
    if (e.target) e.target.value = ''
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.json')) {
      toast({
        title: 'Arquivo inválido',
        description: 'Selecione um arquivo .json exportado pelo sistema.',
        variant: 'destructive',
      })
      return
    }
    setImportando(true)
    try {
      const texto = await file.text()
      let obj: unknown
      try {
        obj = JSON.parse(texto)
      } catch {
        throw new Error('O arquivo não é um JSON válido.')
      }
      if (!validateImportedTemplate(obj)) {
        throw new Error(
          'Estrutura inválida. Campos obrigatórios: nome_modelo, tipo_exame, estrutura_layout.',
        )
      }
      const dados = obj as ExportedTemplate
      const tiposValidos: ExamReportTipoExame[] = [
        'audiometria',
        'imitanciometria',
        'teste_aparelho',
        'personalizado',
      ]
      if (!tiposValidos.includes(dados.tipo_exame)) {
        throw new Error(`tipo_exame inválido: "${dados.tipo_exame}".`)
      }
      // Cria rascunho via serviço existente e depois aplica layout/estilos extras
      const novo = await createTemplate({
        nome_modelo: dados.nome_modelo,
        tipo_exame: dados.tipo_exame,
        descricao: dados.descricao || '',
        orientacao: (dados.orientacao as ExamReportOrientacao) || 'retrato',
        largura_pagina: dados.largura_pagina ?? 210,
        altura_pagina: dados.altura_pagina ?? 297,
        margem_superior: dados.margem_superior ?? 12,
        margem_inferior: dados.margem_inferior ?? 12,
        margem_esquerda: dados.margem_esquerda ?? 15,
        margem_direita: dados.margem_direita ?? 15,
      })
      await updateTemplate(novo.id, {
        estrutura_layout: dados.estrutura_layout,
        logo_url: dados.logo_url,
        fonte_padrao: dados.fonte_padrao,
        tamanho_fonte_padrao: dados.tamanho_fonte_padrao,
        cor_primaria: dados.cor_primaria,
        cor_secundaria: dados.cor_secundaria,
        observacoes: dados.observacoes,
        cabecalho_configuracao: dados.cabecalho_configuracao,
        rodape_configuracao: dados.rodape_configuracao,
      })
      toast({
        title: 'Modelo importado',
        description: `Rascunho "${novo.nome_modelo}" criado. Redirecionando para o editor...`,
      })
      navigate(`/configuracoes/laudos/${novo.id}/editor`)
    } catch (err) {
      toast({
        title: 'Falha ao importar modelo',
        description: String(err instanceof Error ? err.message : err),
        variant: 'destructive',
      })
    } finally {
      setImportando(false)
    }
  }

  const filtrados = useMemo(() => {
    return templates.filter((t) => {
      if (filtroTipo !== 'todos' && t.tipo_exame !== filtroTipo) return false
      if (filtroStatus !== 'todos' && t.status !== filtroStatus) return false
      if (busca.trim() && !t.nome_modelo.toLowerCase().includes(busca.trim().toLowerCase()))
        return false
      return true
    })
  }, [templates, filtroTipo, filtroStatus, busca])

  const resumo = useMemo(() => {
    const total = templates.length
    const publicados = templates.filter((t) => t.status === 'publicado').length
    const rascunhos = templates.filter((t) => t.status === 'rascunho').length
    const arquivados = templates.filter((t) => t.status === 'arquivado').length
    return { total, publicados, rascunhos, arquivados }
  }, [templates])

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link to="/configuracoes">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-800">Modelos de Impressão</h1>
              <Badge variant="secondary" className="bg-[#1E3A8A]/10 text-[#1E3A8A]">
                {resumo.total}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleImportarClick}
              disabled={importando}
              title="Importar modelo a partir de um arquivo JSON"
            >
              <Upload className="mr-2 h-4 w-4" /> Importar Modelo
            </Button>
            <Button
              onClick={() => navigate('/configuracoes/laudos/novo')}
              className="bg-[#1E3A8A] hover:bg-[#1e40af]"
            >
              <Plus className="mr-2 h-4 w-4" /> Novo Modelo
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleArquivoSelecionado}
          />
        </div>

        {/* Card de resumo */}
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-lg bg-slate-100 p-2">
                <LayoutTemplate className="h-5 w-5 text-slate-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Total de modelos</p>
                <p className="text-xl font-bold text-slate-800">{resumo.total}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-lg bg-emerald-100 p-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Publicados</p>
                <p className="text-xl font-bold text-emerald-700">{resumo.publicados}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-lg bg-amber-100 p-2">
                <FileEdit className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Rascunhos</p>
                <p className="text-xl font-bold text-amber-700">{resumo.rascunhos}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-lg bg-slate-200 p-2">
                <ArchiveIcon className="h-5 w-5 text-slate-500" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Arquivados</p>
                <p className="text-xl font-bold text-slate-600">{resumo.arquivados}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card className="mb-4">
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-[200px] flex-1">
              <Input
                placeholder="Buscar por nome do modelo..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <div className="w-full sm:w-52">
              <Select
                value={filtroTipo}
                onValueChange={(v) => setFiltroTipo(v as 'todos' | ExamReportTipoExame)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tipo de exame" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os tipos</SelectItem>
                  {(Object.keys(EXAM_REPORT_TIPO_LABELS) as ExamReportTipoExame[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {EXAM_REPORT_TIPO_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-44">
              <Select
                value={filtroStatus}
                onValueChange={(v) => setFiltroStatus(v as 'todos' | ExamReportStatus)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os status</SelectItem>
                  <SelectItem value="rascunho">Rascunho</SelectItem>
                  <SelectItem value="publicado">Publicado</SelectItem>
                  <SelectItem value="arquivado">Arquivado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <Card className="p-8 text-center text-slate-500">Carregando modelos...</Card>
        ) : filtrados.length === 0 ? (
          <Card className="p-12 text-center">
            <FileText className="mx-auto mb-4 h-12 w-12 text-slate-300" />
            <h3 className="mb-2 text-lg font-semibold text-slate-700">Nenhum modelo encontrado</h3>
            <p className="mb-4 text-sm text-slate-500">
              {templates.length === 0
                ? 'Crie o primeiro modelo de laudo para configurar a impressão dos exames.'
                : 'Ajuste os filtros para visualizar outros modelos.'}
            </p>
            {templates.length === 0 && (
              <Button
                onClick={() => navigate('/configuracoes/laudos/novo')}
                className="bg-[#1E3A8A] hover:bg-[#1e40af]"
              >
                <Plus className="mr-2 h-4 w-4" /> Criar Modelo
              </Button>
            )}
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-100">
                    <TableHead className="font-semibold">Nome</TableHead>
                    <TableHead className="font-semibold">Tipo de Exame</TableHead>
                    <TableHead className="font-semibold">Versão</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Última Alteração</TableHead>
                    <TableHead className="font-semibold">Alterado por</TableHead>
                    <TableHead className="text-right font-semibold">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map((t) => (
                    <TableRow key={t.id} className="hover:bg-slate-50">
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => navigate(`/configuracoes/laudos/${t.id}/versoes`)}
                          className="font-medium text-slate-800 hover:text-[#1E3A8A] hover:underline text-left"
                          title="Ver histórico de versões"
                        >
                          {t.nome_modelo}
                        </button>
                        {t.descricao && <div className="text-xs text-slate-400">{t.descricao}</div>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{EXAM_REPORT_TIPO_LABELS[t.tipo_exame]}</Badge>
                      </TableCell>
                      <TableCell className="text-slate-600">v{t.versao}</TableCell>
                      <TableCell>
                        <Badge className={STATUS_CLASS[t.status]} variant="outline">
                          {EXAM_REPORT_STATUS_LABELS[t.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {t.updated ? new Date(t.updated).toLocaleString('pt-BR') : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {t.atualizado_por || t.criado_por || '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {(t.status === 'rascunho' || t.status === 'arquivado') && (
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Editar"
                              onClick={() => navigate(`/configuracoes/laudos/${t.id}/editor`)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Histórico de versões"
                            onClick={() => navigate(`/configuracoes/laudos/${t.id}/versoes`)}
                          >
                            <History className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Visualizar prévia"
                            onClick={() => navigate(`/configuracoes/laudos/${t.id}/preview`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Duplicar"
                            onClick={() => handleDuplicar(t.id)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Exportar (JSON)"
                            onClick={() => handleExportar(t)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          {t.status === 'rascunho' && (
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Publicar"
                              className="text-emerald-600 hover:text-emerald-700"
                              onClick={() => handlePublicar(t.id, t.nome_modelo)}
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                          )}
                          {t.status === 'publicado' && (
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Arquivar"
                              onClick={() => handleArquivar(t.id, t.nome_modelo)}
                            >
                              <Archive className="h-4 w-4" />
                            </Button>
                          )}
                          {(t.status === 'rascunho' || t.status === 'arquivado') && (
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Excluir"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => handleExcluir(t.id, t.nome_modelo)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}
        <p className="mt-4 text-xs text-slate-400">
          Usuário: {currentUser?.name || '—'} ({currentUser?.role || '—'})
        </p>
      </div>
    </div>
  )
}
