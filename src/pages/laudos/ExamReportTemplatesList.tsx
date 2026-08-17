import { useEffect, useState, useCallback, useMemo } from 'react'
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
} from '@/lib/examReportTemplates'
import type { ExamReportTemplate, ExamReportStatus, ExamReportTipoExame } from '@/types'
import { EXAM_REPORT_TIPO_LABELS, EXAM_REPORT_STATUS_LABELS } from '@/types'

const STATUS_CLASS: Record<ExamReportStatus, string> = {
  rascunho: 'bg-amber-100 text-amber-700 border-amber-200',
  publicado: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  arquivado: 'bg-slate-200 text-slate-600 border-slate-300',
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
          <Button
            onClick={() => navigate('/configuracoes/laudos/novo')}
            className="bg-[#1E3A8A] hover:bg-[#1e40af]"
          >
            <Plus className="mr-2 h-4 w-4" /> Novo Modelo
          </Button>
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
                        <div className="font-medium text-slate-800">{t.nome_modelo}</div>
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
