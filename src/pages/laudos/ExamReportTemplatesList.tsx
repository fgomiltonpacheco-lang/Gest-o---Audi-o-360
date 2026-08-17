import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Edit, Copy, Eye, Send, Archive, Trash2, FileText, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { useApp } from '@/context/AppContext'
import {
  listTemplates,
  deleteTemplate,
  duplicateTemplate,
  publishTemplate,
  archiveTemplate,
} from '@/lib/examReportTemplates'
import type { ExamReportTemplate } from '@/types'
import { EXAM_REPORT_TIPO_LABELS, EXAM_REPORT_STATUS_LABELS } from '@/types'

const STATUS_CLASS: Record<string, string> = {
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

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link to="/configuracoes">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Modelos de Laudo</h1>
              <p className="text-sm text-slate-500">Configure o layout de impressão dos exames</p>
            </div>
          </div>
          <Button
            onClick={() => navigate('/configuracoes/laudos/novo')}
            className="bg-[#1E3A8A] hover:bg-[#1e40af]"
          >
            <Plus className="mr-2 h-4 w-4" /> Novo Modelo
          </Button>
        </div>

        {loading ? (
          <Card className="p-8 text-center text-slate-500">Carregando modelos...</Card>
        ) : templates.length === 0 ? (
          <Card className="p-12 text-center">
            <FileText className="mx-auto mb-4 h-12 w-12 text-slate-300" />
            <h3 className="mb-2 text-lg font-semibold text-slate-700">Nenhum modelo cadastrado</h3>
            <p className="mb-4 text-sm text-slate-500">
              Crie o primeiro modelo de laudo para configurar a impressão dos exames.
            </p>
            <Button
              onClick={() => navigate('/configuracoes/laudos/novo')}
              className="bg-[#1E3A8A] hover:bg-[#1e40af]"
            >
              <Plus className="mr-2 h-4 w-4" /> Criar Modelo
            </Button>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Nome do modelo</th>
                    <th className="px-4 py-3 font-semibold">Tipo de exame</th>
                    <th className="px-4 py-3 font-semibold">Versão</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Última alteração</th>
                    <th className="px-4 py-3 text-right font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {templates.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{t.nome_modelo}</div>
                        {t.descricao && <div className="text-xs text-slate-400">{t.descricao}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">{EXAM_REPORT_TIPO_LABELS[t.tipo_exame]}</Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-600">v{t.versao}</td>
                      <td className="px-4 py-3">
                        <Badge className={STATUS_CLASS[t.status]} variant="outline">
                          {EXAM_REPORT_STATUS_LABELS[t.status]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {t.updated ? new Date(t.updated).toLocaleString('pt-BR') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Editar"
                            onClick={() => navigate(`/configuracoes/laudos/${t.id}/editor`)}
                          >
                            <Edit className="h-4 w-4" />
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
                          {t.status !== 'publicado' && (
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Publicar"
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
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Excluir"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => handleExcluir(t.id, t.nome_modelo)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
