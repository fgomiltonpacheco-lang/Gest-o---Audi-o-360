import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '@/context/AppContext'
import { useToast } from '@/hooks/use-toast'
import pb from '@/lib/pocketbase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
import { ShieldCheck, Search, Download, ChevronDown, ChevronRight, Filter, X } from 'lucide-react'
import {
  AUDIT_ACAO_LABELS,
  AUDIT_MODULO_LABELS,
  type AuditAcaoTrail,
  type AuditModulo,
  type AuditTrail,
} from '@/types'
import { exportToCSV } from '@/lib/formatters'

// ---------- Helpers visuais ----------

const ACAO_BADGE: Record<AuditAcaoTrail, string> = {
  criar: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  editar: 'bg-blue-100 text-blue-700 border-blue-200',
  deletar: 'bg-red-100 text-red-700 border-red-200',
  cancelar: 'bg-red-100 text-red-700 border-red-200',
  estornar: 'bg-orange-100 text-orange-700 border-orange-200',
  emitir_nf: 'bg-purple-100 text-purple-700 border-purple-200',
  abrir_caixa: 'bg-teal-100 text-teal-700 border-teal-200',
  fechar_caixa: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  acessar: 'bg-slate-100 text-slate-700 border-slate-200',
  exportar: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  imprimir: 'bg-amber-100 text-amber-700 border-amber-200',
  baixar_estoque_venda: 'bg-teal-100 text-teal-700 border-teal-200',
  devolver_estoque_venda: 'bg-orange-100 text-orange-700 border-orange-200',
  cancelar_venda_paga: 'bg-red-100 text-red-700 border-red-200',
}

const PERFIL_LABELS: Record<string, string> = {
  admin: 'Administrador',
  profissional: 'Profissional',
  secretaria: 'Secretária',
}

function formatDateTime(iso: string | undefined): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

// Renderiza um valor do diff de forma legível.
function renderValue(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v)
    } catch {
      return String(v)
    }
  }
  return String(v)
}

// ============================================================
// Página de Auditoria (Admin only)
// ============================================================
export default function Auditoria() {
  const { currentUser } = useApp()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [records, setRecords] = useState<AuditTrail[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [page, setPage] = useState(1)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const PER_PAGE = 50

  // Usuários (para o filtro)
  const [users, setUsers] = useState<{ id: string; name: string; email: string }[]>([])

  // Filtros
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [usuarioId, setUsuarioId] = useState('all')
  const [modulo, setModulo] = useState<'all' | AuditModulo>('all')
  const [acao, setAcao] = useState<'all' | AuditAcaoTrail>('all')
  const [search, setSearch] = useState('')

  // Filtros aplicados (para paginação estável)
  const [appliedFilters, setAppliedFilters] = useState({
    startDate: '',
    endDate: '',
    usuarioId: 'all',
    modulo: 'all' as 'all' | AuditModulo,
    acao: 'all' as 'all' | AuditAcaoTrail,
    search: '',
  })

  const buildFilter = useCallback((f: typeof appliedFilters): string => {
    const parts: string[] = []
    if (f.startDate) {
      // created >= início do dia
      parts.push(`created >= "${f.startDate}T00:00:00.000Z"`)
    }
    if (f.endDate) {
      parts.push(`created <= "${f.endDate}T23:59:59.999Z"`)
    }
    if (f.usuarioId !== 'all') {
      parts.push(`usuario_id = "${f.usuarioId}"`)
    }
    if (f.modulo !== 'all') {
      parts.push(`modulo = "${f.modulo}"`)
    }
    if (f.acao !== 'all') {
      parts.push(`acao = "${f.acao}"`)
    }
    if (f.search.trim()) {
      const q = f.search.trim().replace(/"/g, '\\"')
      parts.push(
        `(entidade_descricao ~ "${q}" || usuario_nome ~ "${q}" || entidade_tipo ~ "${q}" || entidade_id ~ "${q}")`,
      )
    }
    return parts.join(' && ')
  }, [])

  const loadUsers = useCallback(async () => {
    try {
      const recs = await pb.collection('users').getFullList({ sort: 'name' })
      setUsers(
        recs.map((r: any) => ({ id: r.id, name: r.name || r.email || 'Usuário', email: r.email })),
      )
    } catch (err) {
      console.error('Erro ao carregar usuários:', err)
    }
  }, [])

  const loadRecords = useCallback(async () => {
    setLoading(true)
    try {
      const filter = buildFilter(appliedFilters)
      const result = await pb.collection('audit_trail').getList(page, PER_PAGE, {
        sort: '-created',
        filter,
      })
      setRecords(result.items as unknown as AuditTrail[])
      setTotalItems(result.totalItems)
    } catch (err) {
      console.error('Erro ao carregar auditoria:', err)
      toast({
        title: 'Erro ao carregar',
        description: 'Não foi possível carregar a trilha de auditoria.',
        variant: 'destructive',
      })
      setRecords([])
      setTotalItems(0)
    } finally {
      setLoading(false)
    }
  }, [appliedFilters, page, buildFilter, toast])

  useEffect(() => {
    if (currentUser?.role === 'admin') {
      loadUsers()
    }
  }, [currentUser?.id, currentUser?.role, loadUsers])

  useEffect(() => {
    if (currentUser?.role === 'admin') {
      loadRecords()
    }
  }, [currentUser?.id, currentUser?.role, loadRecords])

  const totalPages = Math.max(1, Math.ceil(totalItems / PER_PAGE))

  const handleApplyFilters = () => {
    setAppliedFilters({ startDate, endDate, usuarioId, modulo, acao, search: search.trim() })
    setPage(1)
    setExpandedId(null)
  }

  const handleClearFilters = () => {
    setStartDate('')
    setEndDate('')
    setUsuarioId('all')
    setModulo('all')
    setAcao('all')
    setSearch('')
    setAppliedFilters({
      startDate: '',
      endDate: '',
      usuarioId: 'all',
      modulo: 'all',
      acao: 'all',
      search: '',
    })
    setPage(1)
    setExpandedId(null)
  }

  const hasActiveFilters =
    !!startDate ||
    !!endDate ||
    usuarioId !== 'all' ||
    modulo !== 'all' ||
    acao !== 'all' ||
    !!search.trim()

  // Exportar CSV (com filtros aplicados — busca até 1000 registros)
  const handleExportCSV = async () => {
    try {
      const filter = buildFilter(appliedFilters)
      const result = await pb.collection('audit_trail').getList(1, 1000, {
        sort: '-created',
        filter,
      })
      const rows = (result.items as unknown as AuditTrail[]).map((r) => ({
        DataHora: formatDateTime(r.created),
        Usuario: r.usuario_nome || '',
        Perfil: PERFIL_LABELS[r.usuario_perfil || ''] || r.usuario_perfil || '',
        Modulo: AUDIT_MODULO_LABELS[r.modulo] || r.modulo,
        Acao: AUDIT_ACAO_LABELS[r.acao] || r.acao,
        Entidade: r.entidade_tipo || '',
        EntidadeId: r.entidade_id || '',
        Descricao: r.entidade_descricao || '',
        Alteracoes: r.alteracoes ? JSON.stringify(r.alteracoes) : '',
        Contexto: r.contexto ? JSON.stringify(r.contexto) : '',
        IP: r.ip || '',
        UserAgent: r.user_agent || '',
      }))
      if (!rows.length) {
        toast({ title: 'Nada para exportar', description: 'Nenhum registro nos filtros atuais.' })
        return
      }
      exportToCSV(`auditoria-${new Date().toISOString().slice(0, 10)}`, rows)
      toast({ title: 'CSV gerado', description: `${rows.length} registro(s) exportado(s).` })
    } catch (err) {
      console.error('Erro ao exportar CSV:', err)
      toast({
        title: 'Erro ao exportar',
        description: 'Não foi possível gerar o CSV.',
        variant: 'destructive',
      })
    }
  }

  if (currentUser?.role !== 'admin') {
    return null
  }

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-navy-700 text-white flex items-center justify-center shadow-sm">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Trilha de Auditoria
            </h1>
            <p className="text-sm text-slate-500">
              Registro imutável de todas as ações críticas do sistema
            </p>
          </div>
        </div>
        <Button
          onClick={handleExportCSV}
          variant="outline"
          className="rounded-xl border-slate-300 text-sm font-semibold flex items-center gap-2 h-11 px-5"
        >
          <Download className="w-4 h-4" />
          Exportar CSV
        </Button>
      </div>

      {/* Aviso de imutabilidade */}
      <div className="flex items-start gap-3 p-3 rounded-xl bg-navy-50 border border-navy-100">
        <ShieldCheck className="w-5 h-5 text-navy-700 shrink-0 mt-0.5" />
        <p className="text-xs text-navy-700">
          A trilha de auditoria é <strong>somente leitura</strong>: nenhum usuário — nem o
          administrador — pode editar ou excluir registros. Retenção mínima de 5 anos.
        </p>
      </div>

      {/* Filtros */}
      <Card className="rounded-2xl border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <CardTitle className="text-base font-bold text-slate-900">Filtros</CardTitle>
          </div>
          <CardDescription className="text-xs text-slate-500">
            Aplique os filtros e clique em "Buscar" para atualizar os resultados.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            {/* Data inicial */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                Data inicial
              </Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 rounded-lg border-slate-300 text-sm"
              />
            </div>
            {/* Data final */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                Data final
              </Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 rounded-lg border-slate-300 text-sm"
              />
            </div>
            {/* Usuário */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                Usuário
              </Label>
              <Select value={usuarioId} onValueChange={setUsuarioId}>
                <SelectTrigger className="h-9 rounded-lg border-slate-300 text-sm">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Módulo */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                Módulo
              </Label>
              <Select value={modulo} onValueChange={(v) => setModulo(v as 'all' | AuditModulo)}>
                <SelectTrigger className="h-9 rounded-lg border-slate-300 text-sm">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {(Object.keys(AUDIT_MODULO_LABELS) as AuditModulo[]).map((m) => (
                    <SelectItem key={m} value={m}>
                      {AUDIT_MODULO_LABELS[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Ação */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                Ação
              </Label>
              <Select value={acao} onValueChange={(v) => setAcao(v as 'all' | AuditAcaoTrail)}>
                <SelectTrigger className="h-9 rounded-lg border-slate-300 text-sm">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {(Object.keys(AUDIT_ACAO_LABELS) as AuditAcaoTrail[]).map((a) => (
                    <SelectItem key={a} value={a}>
                      {AUDIT_ACAO_LABELS[a]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Busca textual */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                Busca
              </Label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleApplyFilters()
                  }}
                  placeholder="Descrição, entidade..."
                  className="h-9 pl-9 rounded-lg border-slate-300 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              onClick={handleApplyFilters}
              className="bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-semibold h-9 px-4"
            >
              <Search className="w-4 h-4 mr-1.5" />
              Buscar
            </Button>
            {hasActiveFilters && (
              <Button
                onClick={handleClearFilters}
                variant="outline"
                className="rounded-lg border-slate-300 text-sm h-9 px-4"
              >
                <X className="w-4 h-4 mr-1.5" />
                Limpar
              </Button>
            )}
            <span className="text-xs text-slate-500 ml-auto">
              {totalItems} registro(s) encontrados
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card className="rounded-2xl border-slate-200 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                  <TableHead className="w-8" />
                  <TableHead className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Data/Hora
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Usuário
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Perfil
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Módulo
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Ação
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Descrição
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-slate-400 py-10">
                      Carregando auditoria...
                    </TableCell>
                  </TableRow>
                ) : records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-slate-400 py-10">
                      Nenhum registro de auditoria encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  records.map((r) => {
                    const isExpanded = expandedId === r.id
                    const alteracoes = r.alteracoes || {}
                    const changedKeys = Object.keys(alteracoes)
                    return (
                      <React.Fragment key={r.id}>
                        <TableRow
                          className="cursor-pointer hover:bg-slate-50/70"
                          onClick={() => setExpandedId(isExpanded ? null : r.id)}
                        >
                          <TableCell className="text-slate-400">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                            {formatDateTime(r.created)}
                          </TableCell>
                          <TableCell className="text-sm font-medium text-slate-800">
                            {r.usuario_nome || 'Sistema'}
                          </TableCell>
                          <TableCell className="text-xs text-slate-600">
                            {PERFIL_LABELS[r.usuario_perfil || ''] || r.usuario_perfil || '—'}
                          </TableCell>
                          <TableCell className="text-xs text-slate-600">
                            {AUDIT_MODULO_LABELS[r.modulo] || r.modulo}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-[11px] font-semibold border ${
                                ACAO_BADGE[r.acao] || 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              {AUDIT_ACAO_LABELS[r.acao] || r.acao}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-slate-700">
                            {r.entidade_descricao || r.entidade_tipo}
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow className="bg-slate-50/60">
                            <TableCell />
                            <TableCell colSpan={6} className="py-4">
                              <div className="space-y-3">
                                {/* Metadados */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                                  <div>
                                    <span className="font-semibold text-slate-500">Entidade: </span>
                                    <span className="text-slate-700">{r.entidade_tipo || '—'}</span>
                                  </div>
                                  <div>
                                    <span className="font-semibold text-slate-500">ID: </span>
                                    <span className="text-slate-700 font-mono">
                                      {r.entidade_id || '—'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="font-semibold text-slate-500">IP: </span>
                                    <span className="text-slate-700">{r.ip || '—'}</span>
                                  </div>
                                  <div>
                                    <span className="font-semibold text-slate-500">
                                      User-Agent:{' '}
                                    </span>
                                    <span className="text-slate-700 truncate inline-block max-w-[280px] align-bottom">
                                      {r.user_agent || '—'}
                                    </span>
                                  </div>
                                </div>

                                {/* Contexto adicional */}
                                {r.contexto &&
                                  typeof r.contexto === 'object' &&
                                  Object.keys(r.contexto).length > 0 && (
                                    <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                                      <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wide mb-1">
                                        Contexto
                                      </p>
                                      <pre className="text-xs text-amber-900 whitespace-pre-wrap break-words">
                                        {JSON.stringify(r.contexto, null, 2)}
                                      </pre>
                                    </div>
                                  )}

                                {/* Alterações (antes/depois) */}
                                <div>
                                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">
                                    Alterações ({changedKeys.length} campo
                                    {changedKeys.length === 1 ? '' : 's'})
                                  </p>
                                  {changedKeys.length === 0 ? (
                                    <p className="text-xs text-slate-400">
                                      Nenhuma alteração detalhada registrada.
                                    </p>
                                  ) : (
                                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                                      <Table>
                                        <TableHeader>
                                          <TableRow className="bg-white">
                                            <TableHead className="text-[11px] font-bold text-slate-600 uppercase">
                                              Campo
                                            </TableHead>
                                            <TableHead className="text-[11px] font-bold text-slate-600 uppercase">
                                              Antes
                                            </TableHead>
                                            <TableHead className="text-[11px] font-bold text-slate-600 uppercase">
                                              Depois
                                            </TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {changedKeys.map((key) => {
                                            const alt = alteracoes[key]
                                            return (
                                              <TableRow key={key}>
                                                <TableCell className="text-xs font-semibold text-slate-700 align-top">
                                                  {key}
                                                </TableCell>
                                                <TableCell className="text-xs text-slate-500 align-top font-mono">
                                                  <span className="break-all">
                                                    {renderValue(alt?.before)}
                                                  </span>
                                                </TableCell>
                                                <TableCell className="text-xs text-slate-800 align-top font-mono">
                                                  <span className="break-all">
                                                    {renderValue(alt?.after)}
                                                  </span>
                                                </TableCell>
                                              </TableRow>
                                            )
                                          })}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Página {page} de {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => {
                setPage((p) => Math.max(1, p - 1))
                setExpandedId(null)
              }}
              className="rounded-lg border-slate-300 text-sm h-9"
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => {
                setPage((p) => Math.min(totalPages, p + 1))
                setExpandedId(null)
              }}
              className="rounded-lg border-slate-300 text-sm h-9"
            >
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
