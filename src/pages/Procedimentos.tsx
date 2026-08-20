import React, { useEffect, useState, useCallback } from 'react'
import { useApp } from '@/context/AppContext'
import { useToast } from '@/hooks/use-toast'
import pb from '@/lib/pocketbase/client'
import { ClientResponseError } from 'pocketbase'
import { extractFieldErrors } from '@/lib/pocketbase/errors'
import { formatCurrency } from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, Pencil, Trash2, ListChecks, Search, DollarSign, Tag, RefreshCw } from 'lucide-react'

export interface ProcedureRow {
  id: string
  name: string
  code?: string
  value: number
  valueParticular?: number
  valueSUS?: number
  valueConvenio?: number
  duration?: number
  category?: string
  active?: boolean
  created?: string
  updated?: string
}

interface ProcedureFormData {
  name: string
  value: number
  code: string
  duration: number
  category: string
  active: boolean
}

const EMPTY_FORM: ProcedureFormData = {
  name: '',
  value: 0,
  code: '',
  duration: 30,
  category: 'Geral',
  active: true,
}

function describeError(error: unknown): string {
  if (error instanceof ClientResponseError) {
    const fieldErrors = extractFieldErrors(error)
    const parts = Object.entries(fieldErrors).map(([field, msg]) => `${field}: ${msg}`)
    if (parts.length > 0) return parts.join(' • ')
    if (error.response?.message) return String(error.response.message)
  }
  return error instanceof Error ? error.message : 'Erro desconhecido.'
}

export default function Procedimentos() {
  const { currentUser } = useApp()
  const { toast } = useToast()

  const [procedures, setProcedures] = useState<ProcedureRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Modais
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ProcedureRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ProcedureRow | null>(null)

  const loadProcedures = useCallback(async () => {
    setLoading(true)
    try {
      const records = await pb.collection('procedures').getFullList({
        sort: 'name',
      })
      const rows: ProcedureRow[] = records.map((r: any) => {
        const val = Number(r.value ?? r.valueParticular ?? 0) || 0
        return {
          id: r.id,
          name: r.name || '',
          code: r.code || '',
          value: val,
          valueParticular: Number(r.valueParticular) || val,
          valueSUS: Number(r.valueSUS) || 0,
          valueConvenio: Number(r.valueConvenio) || 0,
          duration: Number(r.duration) || 30,
          category: r.category || '',
          active: r.active !== false,
          created: r.created || '',
          updated: r.updated || '',
        }
      })
      setProcedures(rows)
    } catch (err) {
      console.error('Erro ao carregar procedimentos:', err)
      toast({
        title: 'Erro ao carregar',
        description: 'Não foi possível carregar a lista de procedimentos.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    loadProcedures()
  }, [loadProcedures])

  const filtered = procedures.filter((p) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      p.name.toLowerCase().includes(q) ||
      (p.code || '').toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q)
    )
  })

  // ---------- Criar procedimento ----------
  const handleCreate = async (data: ProcedureFormData) => {
    try {
      await pb.collection('procedures').create({
        name: data.name.trim(),
        value: data.value,
        valueParticular: data.value,
        code: data.code.trim(),
        duration: data.duration || 30,
        category: data.category || 'Geral',
        active: data.active,
      })
      toast({
        title: 'Procedimento criado',
        description: `${data.name.trim()} foi cadastrado com sucesso.`,
      })
      setCreateOpen(false)
      await loadProcedures()
    } catch (err) {
      toast({
        title: 'Erro ao criar procedimento',
        description: describeError(err),
        variant: 'destructive',
      })
    }
  }

  // ---------- Editar procedimento ----------
  const handleUpdate = async (id: string, data: ProcedureFormData) => {
    try {
      await pb.collection('procedures').update(id, {
        name: data.name.trim(),
        value: data.value,
        valueParticular: data.value,
        code: data.code.trim(),
        duration: data.duration || 30,
        category: data.category || 'Geral',
        active: data.active,
      })
      toast({
        title: 'Procedimento atualizado',
        description: 'As alterações foram salvas com sucesso.',
      })
      setEditTarget(null)
      await loadProcedures()
    } catch (err) {
      toast({
        title: 'Erro ao atualizar',
        description: describeError(err),
        variant: 'destructive',
      })
    }
  }

  // ---------- Excluir procedimento ----------
  const handleDelete = async (id: string) => {
    try {
      await pb.collection('procedures').delete(id)
      toast({
        title: 'Procedimento excluído',
        description: 'O procedimento foi removido com sucesso.',
      })
      setDeleteTarget(null)
      await loadProcedures()
    } catch (err) {
      toast({
        title: 'Erro ao excluir',
        description: describeError(err),
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shadow-sm">
            <ListChecks className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Biblioteca de Procedimentos
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Gerencie o catálogo de procedimentos padrão da clínica
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadProcedures}
            disabled={loading}
            className="rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold h-10 gap-1.5"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button
            onClick={() => setCreateOpen(true)}
            className="rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold h-10 shadow-sm gap-2"
          >
            <Plus className="w-4 h-4" />
            Novo Procedimento
          </Button>
        </div>
      </div>

      {/* Resumo rápido */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="rounded-2xl border-slate-200 shadow-sm bg-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                Total de Procedimentos
              </p>
              <p className="text-2xl font-extrabold text-slate-900 mt-1">{procedures.length}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
              <ListChecks className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 shadow-sm bg-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                Procedimentos Ativos
              </p>
              <p className="text-2xl font-extrabold text-emerald-600 mt-1">
                {procedures.filter((p) => p.active !== false).length}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Tag className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 shadow-sm bg-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                Valor Médio Padrão
              </p>
              <p className="text-2xl font-extrabold text-slate-900 mt-1">
                {formatCurrency(
                  procedures.length
                    ? procedures.reduce((sum, p) => sum + (p.value || 0), 0) / procedures.length
                    : 0,
                )}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <DollarSign className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de procedimentos cadastrados */}
      <Card className="rounded-2xl border-slate-200 shadow-sm bg-white overflow-hidden">
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-slate-900">
                Procedimentos Cadastrados
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                Lista de todos os procedimentos configurados no sistema
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome ou código..."
                className="h-10 pl-9 rounded-xl border-slate-200 bg-slate-50 text-xs sm:text-sm"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-bold text-slate-700 text-xs w-28">Código</TableHead>
                  <TableHead className="font-bold text-slate-700 text-xs">
                    Nome do Procedimento
                  </TableHead>
                  <TableHead className="font-bold text-slate-700 text-xs text-right">
                    Valor Padrão (R$)
                  </TableHead>
                  <TableHead className="font-bold text-slate-700 text-xs text-center w-28">
                    Status
                  </TableHead>
                  <TableHead className="font-bold text-slate-700 text-xs text-right w-28">
                    Ações
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-xs text-slate-500">
                      Carregando procedimentos...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-xs text-slate-500">
                      Nenhum procedimento encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((p) => (
                    <TableRow key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      <TableCell className="text-xs font-mono font-semibold text-slate-600 whitespace-nowrap">
                        {p.code ? (
                          <Badge
                            variant="outline"
                            className="bg-slate-100 text-slate-700 font-mono text-[11px]"
                          >
                            {p.code}
                          </Badge>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs font-bold text-slate-900">{p.name}</TableCell>
                      <TableCell className="text-xs font-bold text-emerald-600 text-right whitespace-nowrap">
                        {formatCurrency(p.value)}
                      </TableCell>
                      <TableCell className="text-center">
                        {p.active !== false ? (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-[11px] font-semibold border-emerald-200">
                            Ativo
                          </Badge>
                        ) : (
                          <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100 text-[11px] font-semibold">
                            Inativo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditTarget(p)}
                            title="Editar procedimento"
                            className="h-8 w-8 p-0 text-slate-600 hover:text-teal-600 hover:bg-teal-50 rounded-lg"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTarget(p)}
                            title="Excluir procedimento"
                            className="h-8 w-8 p-0 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Modal: Novo Procedimento */}
      <ProcedureFormModal open={createOpen} onOpenChange={setCreateOpen} onSubmit={handleCreate} />

      {/* Modal: Editar Procedimento */}
      <ProcedureFormModal
        open={!!editTarget}
        procedure={editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
        onSubmit={(data) => editTarget && handleUpdate(editTarget.id, data)}
      />

      {/* Modal: Confirmar Exclusão */}
      <DeleteProcedureModal
        procedure={deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  )
}

// ============================================================
// Modal: Criar / Editar procedimento (campos: Nome, Valor Padrão, Código opcional)
// ============================================================
interface ProcedureFormModalProps {
  open: boolean
  procedure?: ProcedureRow | null
  onOpenChange: (open: boolean) => void
  onSubmit: (data: ProcedureFormData) => Promise<void>
}

const ProcedureFormModal: React.FC<ProcedureFormModalProps> = ({
  open,
  procedure,
  onOpenChange,
  onSubmit,
}) => {
  const [form, setForm] = useState<ProcedureFormData>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isEdit = !!procedure

  useEffect(() => {
    if (open) {
      if (procedure) {
        setForm({
          name: procedure.name || '',
          value: procedure.value || 0,
          code: procedure.code || '',
          duration: procedure.duration || 30,
          category: procedure.category || 'Geral',
          active: procedure.active !== false,
        })
      } else {
        setForm(EMPTY_FORM)
      }
      setError('')
    }
  }, [open, procedure])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!form.name.trim()) {
      setError('O nome do procedimento é obrigatório.')
      return
    }

    if (form.value === null || form.value === undefined || isNaN(form.value) || form.value < 0) {
      setError('O valor padrão deve ser maior ou igual a zero (R$ 0,00).')
      return
    }

    setSaving(true)
    try {
      await onSubmit({
        name: form.name.trim(),
        value: Number(form.value) || 0,
        code: form.code.trim(),
        duration: Number(form.duration) || 30,
        category: form.category || 'Geral',
        active: form.active,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setForm(EMPTY_FORM)
          setError('')
        }
        onOpenChange(v)
      }}
    >
      <DialogContent className="max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900">
            {isEdit ? 'Editar Procedimento' : 'Novo Procedimento'}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            {isEdit
              ? 'Altere as informações do procedimento selecionado.'
              : 'Cadastre um novo procedimento na biblioteca da clínica.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600 font-medium">
              {error}
            </div>
          )}

          {/* Nome */}
          <div className="space-y-1.5">
            <Label htmlFor="proc-name" className="text-xs font-semibold text-slate-700">
              Nome do Procedimento <span className="text-red-500">*</span>
            </Label>
            <Input
              id="proc-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex.: Audiometria Tonal Liminar"
              required
              className="h-11 rounded-xl border-slate-300 text-sm"
            />
          </div>

          {/* Valor Padrão (R$) */}
          <div className="space-y-1.5">
            <Label htmlFor="proc-value" className="text-xs font-semibold text-slate-700">
              Valor Padrão (R$) <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <DollarSign className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                id="proc-value"
                type="number"
                min={0}
                step="0.01"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: Number(e.target.value) || 0 })}
                placeholder="0.00"
                required
                className="h-11 pl-10 rounded-xl border-slate-300 text-sm"
              />
            </div>
          </div>

          {/* Código (opcional) */}
          <div className="space-y-1.5">
            <Label htmlFor="proc-code" className="text-xs font-semibold text-slate-700">
              Código (opcional)
            </Label>
            <div className="relative">
              <Tag className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                id="proc-code"
                type="text"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="Ex.: PROC-001 ou código TUSS/SUS"
                className="h-11 pl-10 rounded-xl border-slate-300 text-sm font-mono"
              />
            </div>
          </div>

          {/* Ativo (toggle) */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <Label className="text-xs font-semibold text-slate-700 cursor-pointer">
                Procedimento Ativo
              </Label>
              <p className="text-[11px] text-slate-500">
                Procedimentos inativos ficam ocultos para novos agendamentos e atendimentos.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={form.active}
              onClick={() => setForm({ ...form, active: !form.active })}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                form.active ? 'bg-teal-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${
                  form.active ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <DialogFooter className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl border-slate-300 text-sm"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-semibold"
            >
              {saving ? 'Salvando...' : isEdit ? 'Salvar Alterações' : 'Cadastrar Procedimento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// Modal: Confirmar Exclusão
// ============================================================
interface DeleteProcedureModalProps {
  procedure: ProcedureRow | null
  onOpenChange: (open: boolean) => void
  onConfirm: (id: string) => Promise<void>
}

const DeleteProcedureModal: React.FC<DeleteProcedureModalProps> = ({
  procedure,
  onOpenChange,
  onConfirm,
}) => {
  const [deleting, setDeleting] = useState(false)

  const handleConfirm = async () => {
    if (!procedure) return
    setDeleting(true)
    await onConfirm(procedure.id)
    setDeleting(false)
  }

  return (
    <Dialog open={!!procedure} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900">
            Excluir Procedimento
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-600 mt-2">
            Tem certeza que deseja excluir o procedimento{' '}
            <span className="font-bold text-slate-900">{procedure?.name}</span>? Esta ação não pode
            ser desfeita.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex items-center justify-end gap-2 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl border-slate-300 text-sm"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={deleting}
            className="bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold"
          >
            {deleting ? 'Excluindo...' : 'Sim, Excluir'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
