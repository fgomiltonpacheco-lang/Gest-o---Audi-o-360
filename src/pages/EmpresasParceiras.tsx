import React, { useEffect, useMemo, useState } from 'react'
import {
  Building2,
  Plus,
  Search,
  Pencil,
  Power,
  X,
  CheckCircle2,
  MapPin,
  Phone,
  Mail,
} from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { EmpresaParceira } from '@/types'
import { maskCEP, maskPhone } from '@/lib/formatters'

function maskCNPJ(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 14)
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`
}

const emptyForm: any = {
  razao_social: '',
  nome_fantasia: '',
  cnpj: '',
  inscricao_estadual: '',
  email: '',
  telefone: '',
  endereco: '',
  cidade: '',
  estado: '',
  cep: '',
  status: 'ativo',
}

export default function EmpresasParceiras() {
  const { empresasParceiras, fetchEmpresasParceiras, addEmpresaParceira, updateEmpresaParceira } =
    useApp()
  const { toast } = useToast()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'ativo' | 'inativo'>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<EmpresaParceira | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchEmpresasParceiras()
  }, [fetchEmpresasParceiras])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return empresasParceiras.filter((e) => {
      if (statusFilter !== 'all' && e.status !== statusFilter) return false
      if (!q) return true
      return (
        e.razao_social.toLowerCase().includes(q) ||
        e.nome_fantasia.toLowerCase().includes(q) ||
        e.cnpj.includes(q) ||
        e.cidade.toLowerCase().includes(q)
      )
    })
  }, [empresasParceiras, search, statusFilter])

  const openNew = () => {
    setEditing(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  const openEdit = (e: EmpresaParceira) => {
    setEditing(e)
    setForm({
      razao_social: e.razao_social,
      nome_fantasia: e.nome_fantasia,
      cnpj: e.cnpj,
      inscricao_estadual: e.inscricao_estadual,
      email: e.email,
      telefone: e.telefone,
      endereco: e.endereco,
      cidade: e.cidade,
      estado: e.estado,
      cep: e.cep,
      status: e.status,
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.razao_social.trim()) {
      toast({ title: 'Informe a razão social', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        estado: form.estado.toUpperCase().slice(0, 2),
      }
      let result
      if (editing) {
        result = await updateEmpresaParceira(editing.id, payload)
      } else {
        result = await addEmpresaParceira(payload)
      }
      if (result.success) {
        setModalOpen(false)
      } else if (result.message) {
        toast({ title: 'Erro ao salvar', description: result.message, variant: 'destructive' })
      }
    } finally {
      setSaving(false)
    }
  }

  const toggleStatus = async (e: EmpresaParceira) => {
    const novo = e.status === 'ativo' ? 'inativo' : 'ativo'
    const res = await updateEmpresaParceira(e.id, { status: novo } as any)
    if (res.success) {
      toast({
        title: novo === 'ativo' ? 'Empresa reativada' : 'Empresa inativada',
        description: e.razao_social,
      })
    }
  }

  return (
    <div className="space-y-5 animate-in fade-in-50 duration-200">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center">
            <Building2 className="w-6 h-6 text-blue-700" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Empresas Parceiras
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Cadastro de empresas revendedoras parceiras (B2B)
            </p>
          </div>
        </div>
        <Button
          onClick={openNew}
          className="bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-sm shadow-sm"
        >
          <Plus className="w-4 h-4 mr-1.5" /> Nova Empresa
        </Button>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por razão social, CNPJ, cidade..."
            className="h-9 rounded-lg text-sm pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as 'all' | 'ativo' | 'inativo')}
        >
          <SelectTrigger className="h-9 rounded-lg text-sm w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="ativo">Ativos</SelectItem>
            <SelectItem value="inativo">Inativos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="text-xs uppercase tracking-wider">Razão Social</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Nome Fantasia</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">CNPJ</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Cidade/UF</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Contato</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Status</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-slate-400">
                    <Building2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    Nenhuma empresa parceira cadastrada.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((e) => (
                  <TableRow key={e.id} className="hover:bg-slate-50/60">
                    <TableCell className="font-semibold text-slate-900">{e.razao_social}</TableCell>
                    <TableCell className="text-slate-600">{e.nome_fantasia || '—'}</TableCell>
                    <TableCell className="text-slate-600 whitespace-nowrap">
                      {e.cnpj || '—'}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {e.cidade ? `${e.cidade}/${e.estado}` : '—'}
                    </TableCell>
                    <TableCell className="text-slate-600 text-xs">
                      <div className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" /> {e.telefone || '—'}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Mail className="w-3 h-3 text-slate-400" /> {e.email || '—'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          e.status === 'ativo'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }
                      >
                        {e.status === 'ativo' ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(e)}
                          title="Editar"
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => toggleStatus(e)}
                          title={e.status === 'ativo' ? 'Inativar' : 'Reativar'}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-amber-50 hover:text-amber-700"
                        >
                          <Power className="w-4 h-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Modal de criação/edição */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
          <DialogHeader className="border-b border-slate-100 pb-3">
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-700" />
              {editing ? 'Editar Empresa Parceira' : 'Nova Empresa Parceira'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
            <div className="sm:col-span-2">
              <Label className="text-xs font-semibold text-slate-600 mb-1 block">
                Razão Social *
              </Label>
              <Input
                value={form.razao_social}
                onChange={(e) => setForm({ ...form, razao_social: e.target.value })}
                className="h-9 rounded-lg text-sm"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-600 mb-1 block">
                Nome Fantasia
              </Label>
              <Input
                value={form.nome_fantasia}
                onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })}
                className="h-9 rounded-lg text-sm"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-600 mb-1 block">CNPJ</Label>
              <Input
                value={form.cnpj}
                onChange={(e) => setForm({ ...form, cnpj: maskCNPJ(e.target.value) })}
                className="h-9 rounded-lg text-sm"
                placeholder="00.000.000/0000-00"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-600 mb-1 block">
                Inscrição Estadual
              </Label>
              <Input
                value={form.inscricao_estadual}
                onChange={(e) => setForm({ ...form, inscricao_estadual: e.target.value })}
                className="h-9 rounded-lg text-sm"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-600 mb-1 block">Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v as 'ativo' | 'inativo' })}
              >
                <SelectTrigger className="h-9 rounded-lg text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-600 mb-1 block">Telefone</Label>
              <Input
                value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: maskPhone(e.target.value) })}
                className="h-9 rounded-lg text-sm"
                placeholder="(00) 00000-0000"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-600 mb-1 block">E-mail</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="h-9 rounded-lg text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs font-semibold text-slate-600 mb-1 block">Endereço</Label>
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-slate-400 mt-2 shrink-0" />
                <Textarea
                  value={form.endereco}
                  onChange={(e) => setForm({ ...form, endereco: e.target.value })}
                  className="rounded-lg text-sm min-h-[48px]"
                  placeholder="Rua, número, bairro..."
                />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-600 mb-1 block">Cidade</Label>
              <Input
                value={form.cidade}
                onChange={(e) => setForm({ ...form, cidade: e.target.value })}
                className="h-9 rounded-lg text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold text-slate-600 mb-1 block">UF</Label>
                <Input
                  value={form.estado}
                  onChange={(e) =>
                    setForm({ ...form, estado: e.target.value.toUpperCase().slice(0, 2) })
                  }
                  className="h-9 rounded-lg text-sm uppercase"
                  maxLength={2}
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-600 mb-1 block">CEP</Label>
                <Input
                  value={form.cep}
                  onChange={(e) => setForm({ ...form, cep: maskCEP(e.target.value) })}
                  className="h-9 rounded-lg text-sm"
                  placeholder="00000-000"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="pt-3 border-t border-slate-100">
            <Button
              variant="outline"
              onClick={() => setModalOpen(false)}
              className="rounded-xl text-sm"
              disabled={saving}
            >
              <X className="w-4 h-4 mr-1.5" /> Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl text-sm bg-blue-700 hover:bg-blue-800 text-white"
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
