import React, { useEffect, useMemo, useState } from 'react'
import {
  Plus,
  Search,
  Pencil,
  Power,
  PowerOff,
  CreditCard,
  Building2,
  AlertTriangle,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import {
  SaasPageHeader,
  SaasBreadcrumbs,
  SaasLoading,
  SaasEmptyState,
} from '@/pages/saas/SaasShared'
import {
  fetchClinicas,
  fetchPlanos,
  mapClinica,
  clinicaStatusLabel,
  clinicaStatusClass,
  maskCNPJ,
  slugify,
} from '@/pages/saas/shared'
import { Clinica, ClinicaStatus, Plano } from '@/types'
import { formatCurrency } from '@/lib/formatters'
import pb from '@/lib/pocketbase/client'

const fmtDate = (s?: string) => {
  if (!s) return '—'
  const [y, m, d] = s.split('-')
  if (!y || !m || !d) return s
  return `${d}/${m}/${y}`
}

interface ClinicaForm {
  nome: string
  cnpj: string
  email_admin: string
  telefone: string
  endereco: string
  plano_id: string
  status: ClinicaStatus
  trial_dias: number
}

const EMPTY_FORM: ClinicaForm = {
  nome: '',
  cnpj: '',
  email_admin: '',
  telefone: '',
  endereco: '',
  plano_id: '',
  status: 'trial',
  trial_dias: 14,
}

export default function SaasClinicas() {
  const { toast } = useToast()
  const [clinicas, setClinicas] = useState<Clinica[]>([])
  const [planos, setPlanos] = useState<Plano[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')

  // Filtros
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [filtroPlano, setFiltroPlano] = useState<string>('todos')

  // Modal nova clínica
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<ClinicaForm>(EMPTY_FORM)
  const [salvando, setSalvando] = useState(false)

  // Modal editar clínica
  const [editClinica, setEditClinica] = useState<Clinica | null>(null)
  const [editForm, setEditForm] = useState<ClinicaForm>(EMPTY_FORM)
  const [editSalvando, setEditSalvando] = useState(false)

  // Modal alterar plano
  const [planoClinica, setPlanoClinica] = useState<Clinica | null>(null)
  const [novoPlanoId, setNovoPlanoId] = useState('')
  const [planoSalvando, setPlanoSalvando] = useState(false)

  const carregar = async () => {
    try {
      setLoading(true)
      setErro('')
      const [c, p] = await Promise.all([fetchClinicas(), fetchPlanos()])
      setClinicas(c)
      setPlanos(p)
    } catch (e: any) {
      setErro(e?.message || 'Erro ao carregar clínicas.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  const filtradas = useMemo(() => {
    return clinicas.filter((c) => {
      if (filtroStatus !== 'todos' && c.status !== filtroStatus) return false
      if (filtroPlano !== 'todos' && c.plano_id !== filtroPlano) return false
      if (busca.trim()) {
        const q = busca.trim().toLowerCase()
        const haystack = `${c.nome} ${c.cnpj || ''} ${c.email || ''}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [clinicas, busca, filtroStatus, filtroPlano])

  const planoNome = (id?: string) => planos.find((p) => p.id === id)?.nome || '—'
  const planoPreco = (id?: string) => planos.find((p) => p.id === id)?.preco_mensal || undefined

  // ---------- Criar clínica ----------
  const abrirModalNova = () => {
    setForm({ ...EMPTY_FORM, plano_id: planos[0]?.id || '' })
    setModalOpen(true)
  }

  const salvarNova = async () => {
    if (!form.nome.trim()) {
      toast({ title: 'Informe o nome da clínica.', variant: 'destructive' })
      return
    }
    if (!form.plano_id) {
      toast({ title: 'Selecione um plano inicial.', variant: 'destructive' })
      return
    }
    try {
      setSalvando(true)
      const data: Record<string, unknown> = {
        nome: form.nome.trim(),
        slug: slugify(form.nome) || `clinica-${Date.now()}`,
        cnpj: form.cnpj.trim(),
        email: form.email_admin.trim(),
        telefone: form.telefone.trim(),
        endereco: form.endereco.trim(),
        plano_id: form.plano_id,
        status: form.status,
      }
      if (form.status === 'trial') {
        const fim = new Date()
        fim.setDate(fim.getDate() + (Number(form.trial_dias) || 14))
        data.trial_ends = fim.toISOString().split('T')[0]
      }
      const rec = await pb.collection('clinicas').create(data)
      setClinicas((prev) => [mapClinica(rec), ...prev])
      setModalOpen(false)
      toast({
        title: 'Clínica criada!',
        description: `${form.nome.trim()} foi cadastrada com sucesso.`,
      })
    } catch (e: any) {
      toast({
        title: 'Erro ao criar clínica',
        description: e?.message || 'Verifique os dados e tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  // ---------- Editar clínica ----------
  const abrirEditar = (c: Clinica) => {
    setEditClinica(c)
    setEditForm({
      nome: c.nome,
      cnpj: c.cnpj || '',
      email_admin: c.email || '',
      telefone: c.telefone || '',
      endereco: c.endereco || '',
      plano_id: c.plano_id || '',
      status: c.status,
      trial_dias: 14,
    })
  }

  const salvarEdicao = async () => {
    if (!editClinica) return
    try {
      setEditSalvando(true)
      const data: Record<string, unknown> = {
        nome: editForm.nome.trim(),
        cnpj: editForm.cnpj.trim(),
        email: editForm.email_admin.trim(),
        telefone: editForm.telefone.trim(),
        endereco: editForm.endereco.trim(),
        status: editForm.status,
      }
      const rec = await pb.collection('clinicas').update(editClinica.id, data)
      setClinicas((prev) => prev.map((c) => (c.id === editClinica.id ? mapClinica(rec) : c)))
      setEditClinica(null)
      toast({ title: 'Clínica atualizada!', description: editForm.nome })
    } catch (e: any) {
      toast({
        title: 'Erro ao atualizar',
        description: e?.message,
        variant: 'destructive',
      })
    } finally {
      setEditSalvando(false)
    }
  }

  // ---------- Ativar/Desativar ----------
  const toggleAtivo = async (c: Clinica) => {
    const novoStatus: ClinicaStatus = c.status === 'cancelado' ? 'ativo' : 'cancelado'
    try {
      const rec = await pb.collection('clinicas').update(c.id, { status: novoStatus })
      setClinicas((prev) => prev.map((x) => (x.id === c.id ? mapClinica(rec) : x)))
      toast({
        title: novoStatus === 'ativo' ? 'Clínica reativada' : 'Clínica cancelada',
        description: c.nome,
      })
    } catch (e: any) {
      toast({ title: 'Erro', description: e?.message, variant: 'destructive' })
    }
  }

  // ---------- Alterar plano ----------
  const abrirAlterarPlano = (c: Clinica) => {
    setPlanoClinica(c)
    setNovoPlanoId(c.plano_id || planos[0]?.id || '')
  }

  const salvarPlano = async () => {
    if (!planoClinica || !novoPlanoId) return
    try {
      setPlanoSalvando(true)
      const rec = await pb.collection('clinicas').update(planoClinica.id, { plano_id: novoPlanoId })
      setClinicas((prev) => prev.map((x) => (x.id === planoClinica.id ? mapClinica(rec) : x)))
      setPlanoClinica(null)
      toast({
        title: 'Plano alterado!',
        description: `${planoClinica.nome} → ${planoNome(novoPlanoId)}`,
      })
    } catch (e: any) {
      toast({ title: 'Erro', description: e?.message, variant: 'destructive' })
    } finally {
      setPlanoSalvando(false)
    }
  }

  return (
    <div className="space-y-6">
      <SaasBreadcrumbs items={[{ label: 'Gestão SaaS', to: '/saas' }, { label: 'Clínicas' }]} />
      <SaasPageHeader
        title="Gestão de Clínicas"
        description="Cadastre, edite e acompanhe todas as clínicas da plataforma."
        actions={
          <Button className="bg-amber-600 hover:bg-amber-700" onClick={abrirModalNova}>
            <Plus className="w-4 h-4" />
            Nova Clínica
          </Button>
        }
      />

      {/* Filtros */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Buscar por nome, CNPJ ou e-mail…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="trial">Em Trial</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="inadimplente">Inadimplente</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtroPlano} onValueChange={setFiltroPlano}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Plano" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os planos</SelectItem>
              {planos.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <SaasLoading message="Carregando clínicas…" />
          ) : erro ? (
            <div className="py-10 text-center text-red-600">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
              {erro}
            </div>
          ) : filtradas.length === 0 ? (
            <SaasEmptyState
              icon={Building2}
              title="Nenhuma clínica encontrada"
              description="Ajuste os filtros ou cadastre uma nova clínica."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Clínica</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead className="pr-6 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="pl-6">
                      <div className="font-medium text-slate-800">{c.nome}</div>
                      <div className="text-xs text-slate-400">{c.email || '—'}</div>
                    </TableCell>
                    <TableCell className="text-slate-600 text-sm">
                      {c.cnpj ? maskCNPJ(c.cnpj) : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-slate-700">{planoNome(c.plano_id)}</div>
                      {planoPreco(c.plano_id) !== undefined && (
                        <div className="text-xs text-slate-400">
                          {formatCurrency(planoPreco(c.plano_id))}/mês
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`border ${clinicaStatusClass(c.status)}`}>
                        {clinicaStatusLabel(c.status)}
                      </Badge>
                      {c.status === 'trial' && c.trial_ends && (
                        <div className="text-[10px] text-slate-400 mt-1">
                          até {fmtDate(c.trial_ends)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-500 text-sm">{fmtDate(c.created)}</TableCell>
                    <TableCell className="pr-6 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-slate-500 hover:text-amber-600"
                          title="Editar"
                          onClick={() => abrirEditar(c)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-slate-500 hover:text-blue-600"
                          title="Alterar plano"
                          onClick={() => abrirAlterarPlano(c)}
                        >
                          <CreditCard className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className={`h-8 w-8 ${
                            c.status === 'cancelado'
                              ? 'text-slate-400 hover:text-emerald-600'
                              : 'text-slate-500 hover:text-red-600'
                          }`}
                          title={c.status === 'cancelado' ? 'Reativar' : 'Cancelar'}
                          onClick={() => toggleAtivo(c)}
                        >
                          {c.status === 'cancelado' ? (
                            <Power className="w-4 h-4" />
                          ) : (
                            <PowerOff className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal Nova Clínica */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova Clínica</DialogTitle>
            <DialogDescription>
              Cadastre uma nova clínica na plataforma Audição360.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="nome">Nome da Clínica *</Label>
              <Input
                id="nome"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex.: Centro Auditivo Norte"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input
                  id="cnpj"
                  value={form.cnpj}
                  onChange={(e) => setForm({ ...form, cnpj: maskCNPJ(e.target.value) })}
                  placeholder="00.000.000/0000-00"
                />
              </div>
              <div>
                <Label htmlFor="email">E-mail do Admin</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email_admin}
                  onChange={(e) => setForm({ ...form, email_admin: e.target.value })}
                  placeholder="admin@clinica.com.br"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  value={form.telefone}
                  onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                  placeholder="(00) 0000-0000"
                />
              </div>
              <div>
                <Label htmlFor="endereco">Endereço</Label>
                <Input
                  id="endereco"
                  value={form.endereco}
                  onChange={(e) => setForm({ ...form, endereco: e.target.value })}
                  placeholder="Cidade / UF"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="plano">Plano Inicial *</Label>
                <Select
                  value={form.plano_id}
                  onValueChange={(v) => setForm({ ...form, plano_id: v })}
                >
                  <SelectTrigger id="plano">
                    <SelectValue placeholder="Selecione…" />
                  </SelectTrigger>
                  <SelectContent>
                    {planos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome} — {formatCurrency(p.preco_mensal)}/mês
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="status">Status Inicial</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v as ClinicaStatus })}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trial">Em Trial</SelectItem>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inadimplente">Inadimplente</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.status === 'trial' && (
              <div>
                <Label htmlFor="trial">Duração do Trial (dias)</Label>
                <Input
                  id="trial"
                  type="number"
                  min={1}
                  value={form.trial_dias}
                  onChange={(e) => setForm({ ...form, trial_dias: Number(e.target.value) || 14 })}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={salvando}>
              Cancelar
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700"
              onClick={salvarNova}
              disabled={salvando}
            >
              {salvando ? 'Salvando…' : 'Criar Clínica'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Editar Clínica */}
      <Dialog open={!!editClinica} onOpenChange={(o) => !o && setEditClinica(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Clínica</DialogTitle>
            <DialogDescription>{editClinica?.nome}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Nome</Label>
              <Input
                value={editForm.nome}
                onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>CNPJ</Label>
                <Input
                  value={editForm.cnpj}
                  onChange={(e) => setEditForm({ ...editForm, cnpj: maskCNPJ(e.target.value) })}
                />
              </div>
              <div>
                <Label>E-mail do Admin</Label>
                <Input
                  type="email"
                  value={editForm.email_admin}
                  onChange={(e) => setEditForm({ ...editForm, email_admin: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Telefone</Label>
                <Input
                  value={editForm.telefone}
                  onChange={(e) => setEditForm({ ...editForm, telefone: e.target.value })}
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(v) => setEditForm({ ...editForm, status: v as ClinicaStatus })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trial">Em Trial</SelectItem>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inadimplente">Inadimplente</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Endereço</Label>
              <Input
                value={editForm.endereco}
                onChange={(e) => setEditForm({ ...editForm, endereco: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditClinica(null)} disabled={editSalvando}>
              Cancelar
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700"
              onClick={salvarEdicao}
              disabled={editSalvando}
            >
              {editSalvando ? 'Salvando…' : 'Salvar Alterações'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Alterar Plano */}
      <Dialog open={!!planoClinica} onOpenChange={(o) => !o && setPlanoClinica(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Alterar Plano</DialogTitle>
            <DialogDescription>{planoClinica?.nome}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {planos.map((p) => (
              <button
                key={p.id}
                onClick={() => setNovoPlanoId(p.id)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  novoPlanoId === p.id
                    ? 'border-amber-400 bg-amber-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-800">{p.nome}</span>
                  <span className="text-sm font-bold text-amber-600">
                    {formatCurrency(p.preco_mensal)}/mês
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {p.max_profissionais} profissionais · {p.max_pacientes} pacientes
                </p>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPlanoClinica(null)}
              disabled={planoSalvando}
            >
              Cancelar
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700"
              onClick={salvarPlano}
              disabled={planoSalvando}
            >
              {planoSalvando ? 'Salvando…' : 'Confirmar Alteração'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
