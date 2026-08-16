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
import { Plus, Pencil, Trash2, ListChecks, Search, Clock, DollarSign } from 'lucide-react'

// Categorias aceitas pelo select
export const PROCEDURE_CATEGORIES = [
  'Avaliação',
  'Exames',
  'Adaptação',
  'Terapia',
  'Manutenção',
  'Outros',
] as const

type ProcedureCategory = (typeof PROCEDURE_CATEGORIES)[number]

interface ProcedureRow {
  id: string
  name: string
  duration: number
  value: number
  category: string
  active: boolean
  created: string
  updated: string
}

interface ProcedureFormData {
  name: string
  category: string
  duration: number
  value: number
  active: boolean
}

const EMPTY_FORM: ProcedureFormData = {
  name: '',
  category: 'Avaliação',
  duration: 30,
  value: 0,
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
      const rows: ProcedureRow[] = records.map((r: any) => ({
        id: r.id,
        name: r.name || '',
        duration: Number(r.duration) || 0,
        value: Number(r.value) || 0,
        category: r.category || '',
        active: r.active !== false,
        created: r.created || '',
        updated: r.updated || '',
      }))
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
    if (currentUser?.role === 'admin') {
      loadProcedures()
    }
  }, [currentUser?.id, currentUser?.role, loadProcedures])

  const filtered = procedures.filter((p) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return p.name.toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q)
  })

  // ---------- Criar procedimento ----------
  const handleCreate = async (data: ProcedureFormData) => {
    try {
      await pb.collection('procedures').create({
        name: data.name.trim(),
        duration: data.duration,
        value: data.value,
        category: data.category,
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
        duration: data.duration,
        value: data.value,
        category: data.category,
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
        description: 'O procedimento foi removido do sistema.',
        variant: 'destructive',
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

  if (currentUser?.role !== 'admin') {
    return null
  }

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-navy-700 text-white flex items-center justify-center shadow-sm">
            <ListChecks className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Procedimentos
            </h1>
            <p className="text-sm text-slate-500">
              Cadastre e gerencie os procedimentos da clínica
            </p>
          </div>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-xl shadow-sm flex items-center gap-2 h-11 px-5"
        >
          <Plus className="w-4 h-4" />
          Novo Procedimento
        </Button>
      </div>

      {/* Resumo rápido */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="rounded-2xl border-slate-200 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <ListChecks className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Total de procedimentos</p>
              <p className="text-xl font-bold text-slate-900">{procedures.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-slate-200 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Ativos</p>
              <p className="text-xl font-bold text-slate-900">
                {procedures.filter((p) => p.active).length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-slate-200 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Valor médio</p>
              <p className="text-xl font-bold text-slate-900">
                {formatCurrency(
                  procedures.length
                    ? procedures.reduce((sum, p) => sum + p.value, 0) / procedures.length
                    : 0,
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de procedimentos */}
      <Card className="rounded-2xl border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-bold text-slate-900">
                Procedimentos cadastrados
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                {procedures.length} procedimento(s) cadastrado(s)
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome ou categoria..."
                className="h-9 pl-9 rounded-lg border-slate-300 text-sm"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                  <TableHead className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Nome
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Categoria
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Duração (min)
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Valor (R$)
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Status
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-600 uppercase tracking-wider text-right">
                    Ações
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-slate-400 py-10">
                      Carregando procedimentos...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-slate-400 py-10">
                      Nenhum procedimento encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((p) => (
                    <TableRow key={p.id} className="group">
                      <TableCell>
                        <p className="text-sm font-semibold text-slate-800">{p.name}</p>
                      </TableCell>
                      <TableCell>
                        {p.category ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                            {p.category}
                          </span>
                        ) : (
                          <span className="text-sm text-slate-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">{p.duration}</TableCell>
                      <TableCell className="text-sm font-semibold text-slate-700">
                        {formatCurrency(p.value)}
                      </TableCell>
                      <TableCell>
                        {p.active ? (
                          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-[11px] font-semibold">
                            Ativo
                          </Badge>
                        ) : (
                          <Badge className="bg-slate-100 text-slate-500 hover:bg-slate-100 text-[11px] font-semibold">
                            Inativo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setEditTarget(p)}
                            title="Editar procedimento"
                            className="p-2 rounded-lg text-slate-500 hover:text-teal-600 hover:bg-teal-50 transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(p)}
                            title="Excluir procedimento"
                            className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

      {/* Modal: Confirmar exclusão */}
      <DeleteProcedureModal
        procedure={deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  )
}

// ============================================================
// Modal: Criar / Editar procedimento
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
          name: procedure.name,
          category: procedure.category || 'Avaliação',
          duration: procedure.duration,
          value: procedure.value,
          active: procedure.active,
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
    if (!form.duration || form.duration <= 0) {
      setError('A duração deve ser maior que zero.')
      return
    }
    if (form.value < 0 || isNaN(form.value)) {
      setError('O valor deve ser maior ou igual a zero.')
      return
    }

    setSaving(true)
    await onSubmit({
      name: form.name.trim(),
      category: form.category,
      duration: Number(form.duration),
      value: Number(form.value),
      active: form.active,
    })
    setSaving(false)
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
      <DialogContent className="max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900">
            {isEdit ? 'Editar Procedimento' : 'Novo Procedimento'}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            {isEdit
              ? 'Altere os dados do procedimento selecionado.'
              : 'Cadastre um novo procedimento na clínica.'}
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
            <Label className="text-xs font-semibold text-slate-700">
              Nome <span className="text-red-500">*</span>
            </Label>
            <Input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex.: Audiometria Tonal Liminar"
              required
              className="h-11 rounded-xl border-slate-300 text-sm"
            />
          </div>

          {/* Categoria */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Categoria</Label>
            <Select
              value={form.category}
              onValueChange={(v) => setForm({ ...form, category: v as ProcedureCategory })}
            >
              <SelectTrigger className="h-11 rounded-xl border-slate-300 text-sm">
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {PROCEDURE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Duração + Valor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Duração (min) <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Clock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={form.duration}
                  onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}
                  required
                  className="h-11 pl-10 rounded-xl border-slate-300 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Valor (R$) <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <DollarSign className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: Number(e.target.value) })}
                  required
                  className="h-11 pl-10 rounded-xl border-slate-300 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Ativo (toggle) */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <Label className="text-xs font-semibold text-slate-700 cursor-pointer">
                Procedimento ativo
              </Label>
              <p className="text-[11px] text-slate-500">
                Procedimentos inativos não aparecem para novo agendamento.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={form.active}
              onClick={() => setForm({ ...form, active: !form.active })}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                form.active ? 'bg-teal-500' : 'bg-slate-300'
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
              className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-sm font-semibold"
            >
              {saving ? 'Salvando...' : isEdit ? 'Salvar Alterações' : 'Criar Procedimento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// Modal: Confirmar exclusão
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
            Tem certeza que deseja excluir{' '}
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
