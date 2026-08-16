import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '@/context/AppContext'
import { useToast } from '@/hooks/use-toast'
import pb from '@/lib/pocketbase/client'
import { ClientResponseError } from 'pocketbase'
import { extractFieldErrors } from '@/lib/pocketbase/errors'
import { getInitials, getAvatarColor, formatDate } from '@/lib/formatters'
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
import {
  UserPlus,
  Pencil,
  Trash2,
  Users as UsersIcon,
  Mail,
  IdCard,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  Search,
} from 'lucide-react'
import type { UserRole } from '@/types'

// Papéis aceitos pela coleção `users`
type DbRole = 'admin' | 'profissional' | 'secretaria'

interface UserRow {
  id: string
  name: string
  email: string
  role: string
  crmCrfa: string
  created: string
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  profissional: 'Profissional',
  secretaria: 'Secretária',
}

const ROLE_BADGE: Record<string, string> = {
  admin: 'bg-navy-700 text-white',
  profissional: 'bg-teal-500 text-white',
  secretaria: 'bg-amber-500 text-white',
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

export default function Users() {
  const { currentUser } = useApp()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Modais
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<UserRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null)

  // ---------- Proteção de acesso ----------
  useEffect(() => {
    if (currentUser && currentUser.role !== 'admin') {
      toast({
        title: 'Acesso restrito',
        description: 'Acesso restrito ao administrador.',
        variant: 'destructive',
      })
      navigate('/', { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, currentUser?.role])

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const records = await pb.collection('users').getFullList({
        sort: '-created',
      })
      const rows: UserRow[] = records.map((r: any) => ({
        id: r.id,
        name: r.name || r.email || 'Usuário',
        email: r.email || '',
        role: r.role || 'profissional',
        crmCrfa: r.crmCrfa || '',
        created: r.created || '',
      }))
      setUsers(rows)
    } catch (err) {
      console.error('Erro ao carregar usuários:', err)
      toast({
        title: 'Erro ao carregar',
        description: 'Não foi possível carregar a lista de usuários.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (currentUser?.role === 'admin') {
      loadUsers()
    }
  }, [currentUser?.id, currentUser?.role, loadUsers])

  const filtered = users.filter((u) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (ROLE_LABELS[u.role] || '').toLowerCase().includes(q) ||
      u.crmCrfa.toLowerCase().includes(q)
    )
  })

  // ---------- Criar usuário ----------
  const handleCreate = async (data: {
    name: string
    email: string
    role: DbRole
    crmCrfa: string
    password: string
    passwordConfirm: string
  }) => {
    try {
      const payload: Record<string, any> = {
        name: data.name.trim(),
        email: data.email.trim(),
        role: data.role,
        password: data.password,
        passwordConfirm: data.passwordConfirm,
      }
      if (data.role === 'profissional' && data.crmCrfa.trim()) {
        payload.crmCrfa = data.crmCrfa.trim()
      } else {
        payload.crmCrfa = ''
      }
      await pb.collection('users').create(payload)
      toast({
        title: 'Usuário criado',
        description: `${data.name.trim()} foi cadastrado com sucesso.`,
      })
      setCreateOpen(false)
      await loadUsers()
    } catch (err) {
      toast({
        title: 'Erro ao criar usuário',
        description: describeError(err),
        variant: 'destructive',
      })
    }
  }

  // ---------- Editar usuário ----------
  const handleUpdate = async (
    id: string,
    data: { name: string; role: DbRole; crmCrfa: string },
  ) => {
    try {
      const payload: Record<string, any> = {
        name: data.name.trim(),
        role: data.role,
        crmCrfa: data.role === 'profissional' ? data.crmCrfa.trim() : '',
      }
      await pb.collection('users').update(id, payload)
      toast({
        title: 'Usuário atualizado',
        description: 'As alterações foram salvas com sucesso.',
      })
      setEditTarget(null)
      await loadUsers()
    } catch (err) {
      toast({
        title: 'Erro ao atualizar',
        description: describeError(err),
        variant: 'destructive',
      })
    }
  }

  // ---------- Excluir usuário ----------
  const handleDelete = async (id: string) => {
    try {
      await pb.collection('users').delete(id)
      toast({
        title: 'Usuário excluído',
        description: 'O usuário foi removido do sistema.',
        variant: 'destructive',
      })
      setDeleteTarget(null)
      await loadUsers()
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
            <UsersIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Gestão de Usuários
            </h1>
            <p className="text-sm text-slate-500">
              Crie e gerencie acessos de administradores, profissionais e secretárias
            </p>
          </div>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-xl shadow-sm flex items-center gap-2 h-11 px-5"
        >
          <UserPlus className="w-4 h-4" />
          Novo Usuário
        </Button>
      </div>

      {/* Card de aviso */}
      <div className="flex items-start gap-3 p-3 rounded-xl bg-navy-50 border border-navy-100">
        <ShieldCheck className="w-5 h-5 text-navy-700 shrink-0 mt-0.5" />
        <p className="text-xs text-navy-700">
          Apenas o administrador pode criar, editar e excluir usuários. A troca de senha é feita
          pelo próprio usuário na página de Perfil.
        </p>
      </div>

      {/* Lista de usuários */}
      <Card className="rounded-2xl border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-bold text-slate-900">
                Usuários do sistema
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                {users.length} usuário(s) cadastrado(s)
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome, e-mail, função..."
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
                    E-mail
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Função
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    CRFa
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Criado em
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
                      Carregando usuários...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-slate-400 py-10">
                      Nenhum usuário encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((u) => {
                    const isSelf = u.id === currentUser?.id
                    return (
                      <TableRow key={u.id} className="group">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded-full ${getAvatarColor(
                                u.name,
                              )} text-white flex items-center justify-center font-bold text-xs shrink-0`}
                            >
                              {getInitials(u.name)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-800 truncate">
                                {u.name}
                                {isSelf && (
                                  <span className="ml-2 text-[10px] font-bold text-teal-600 uppercase">
                                    Você
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">{u.email}</TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                              ROLE_BADGE[u.role] || 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {ROLE_LABELS[u.role] || u.role}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">{u.crmCrfa || '—'}</TableCell>
                        <TableCell className="text-sm text-slate-500">
                          {formatDate(u.created)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setEditTarget(u)}
                              title="Editar usuário"
                              className="p-2 rounded-lg text-slate-500 hover:text-teal-600 hover:bg-teal-50 transition-colors"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(u)}
                              disabled={isSelf}
                              title={
                                isSelf
                                  ? 'Não é possível excluir o próprio usuário'
                                  : 'Excluir usuário'
                              }
                              className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-500"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Modal: Novo Usuário */}
      <CreateUserModal open={createOpen} onOpenChange={setCreateOpen} onSubmit={handleCreate} />

      {/* Modal: Editar Usuário */}
      <EditUserModal
        user={editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
        onSubmit={handleUpdate}
      />

      {/* Modal: Confirmar exclusão */}
      <DeleteUserModal
        user={deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  )
}

// ============================================================
// Modal: Criar usuário
// ============================================================
interface CreateUserModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: {
    name: string
    email: string
    role: DbRole
    crmCrfa: string
    password: string
    passwordConfirm: string
  }) => Promise<void>
}

const CreateUserModal: React.FC<CreateUserModalProps> = ({ open, onOpenChange, onSubmit }) => {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<DbRole>('profissional')
  const [crmCrfa, setCrmCrfa] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const reset = () => {
    setName('')
    setEmail('')
    setRole('profissional')
    setCrmCrfa('')
    setPassword('')
    setPasswordConfirm('')
    setShowPassword(false)
    setShowConfirm(false)
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('O nome completo é obrigatório.')
      return
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Informe um endereço de e-mail válido.')
      return
    }
    if (!password || password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    if (password !== passwordConfirm) {
      setError('As senhas não conferem.')
      return
    }

    setSaving(true)
    await onSubmit({
      name: name.trim(),
      email: email.trim(),
      role,
      crmCrfa,
      password,
      passwordConfirm,
    })
    setSaving(false)
    reset()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset()
        onOpenChange(v)
      }}
    >
      <DialogContent className="max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900">Novo Usuário</DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Crie um novo acesso ao sistema. O usuário poderá fazer login imediatamente.
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
              Nome completo <span className="text-red-500">*</span>
            </Label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome completo do usuário"
              required
              className="h-11 rounded-xl border-slate-300 text-sm"
            />
          </div>

          {/* E-mail */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">
              E-mail <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@audicao360.com.br"
                required
                className="h-11 pl-10 rounded-xl border-slate-300 text-sm"
              />
            </div>
          </div>

          {/* Função */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">
              Função <span className="text-red-500">*</span>
            </Label>
            <Select value={role} onValueChange={(v) => setRole(v as DbRole)}>
              <SelectTrigger className="h-11 rounded-xl border-slate-300 text-sm">
                <SelectValue placeholder="Selecione a função" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Administrador</SelectItem>
                <SelectItem value="profissional">Profissional</SelectItem>
                <SelectItem value="secretaria">Secretária</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* CRFa (somente profissional) */}
          {role === 'profissional' && (
            <div className="space-y-1.5 animate-in fade-in-50 duration-200">
              <Label className="text-xs font-semibold text-slate-700">
                CRFa{' '}
                <span className="font-normal text-slate-400">
                  (opcional — registro no conselho)
                </span>
              </Label>
              <div className="relative">
                <IdCard className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  type="text"
                  value={crmCrfa}
                  onChange={(e) => setCrmCrfa(e.target.value)}
                  placeholder="Ex.: 2-12345"
                  className="h-11 pl-10 rounded-xl border-slate-300 text-sm"
                />
              </div>
            </div>
          )}

          {/* Senha */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Senha <span className="text-red-500">*</span>
                <span className="ml-1 font-normal text-slate-400">(mín. 6)</span>
              </Label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  required
                  className="h-11 pl-10 pr-10 rounded-xl border-slate-300 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  aria-label="Alternar visualização da senha"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Confirmar senha <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  type={showConfirm ? 'text' : 'password'}
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  placeholder="••••••"
                  required
                  className="h-11 pl-10 pr-10 rounded-xl border-slate-300 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  aria-label="Alternar visualização da senha"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
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
              {saving ? 'Salvando...' : 'Criar Usuário'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// Modal: Editar usuário
// ============================================================
interface EditUserModalProps {
  user: UserRow | null
  onOpenChange: (open: boolean) => void
  onSubmit: (id: string, data: { name: string; role: DbRole; crmCrfa: string }) => Promise<void>
}

const EditUserModal: React.FC<EditUserModalProps> = ({ user, onOpenChange, onSubmit }) => {
  const [name, setName] = useState('')
  const [role, setRole] = useState<DbRole>('profissional')
  const [crmCrfa, setCrmCrfa] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (user) {
      setName(user.name)
      setRole((user.role as DbRole) || 'profissional')
      setCrmCrfa(user.crmCrfa || '')
      setError('')
    }
  }, [user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setError('')

    if (!name.trim()) {
      setError('O nome completo é obrigatório.')
      return
    }

    setSaving(true)
    await onSubmit(user.id, { name: name.trim(), role, crmCrfa })
    setSaving(false)
  }

  return (
    <Dialog open={!!user} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900">Editar Usuário</DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Altere o nome, a função e o CRFa. Para trocar a senha, use a página de Perfil.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600 font-medium">
              {error}
            </div>
          )}

          {/* E-mail (somente leitura) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">
              E-mail <span className="font-normal text-slate-400">(somente leitura)</span>
            </Label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                type="email"
                value={user?.email || ''}
                readOnly
                disabled
                className="h-11 pl-10 rounded-xl border-slate-200 bg-slate-50 text-slate-500 text-sm cursor-not-allowed"
              />
            </div>
          </div>

          {/* Nome */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">
              Nome completo <span className="text-red-500">*</span>
            </Label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome completo do usuário"
              required
              className="h-11 rounded-xl border-slate-300 text-sm"
            />
          </div>

          {/* Função */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">
              Função <span className="text-red-500">*</span>
            </Label>
            <Select value={role} onValueChange={(v) => setRole(v as DbRole)}>
              <SelectTrigger className="h-11 rounded-xl border-slate-300 text-sm">
                <SelectValue placeholder="Selecione a função" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Administrador</SelectItem>
                <SelectItem value="profissional">Profissional</SelectItem>
                <SelectItem value="secretaria">Secretária</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* CRFa (somente profissional) */}
          {role === 'profissional' && (
            <div className="space-y-1.5 animate-in fade-in-50 duration-200">
              <Label className="text-xs font-semibold text-slate-700">
                CRFa{' '}
                <span className="font-normal text-slate-400">
                  (opcional — registro no conselho)
                </span>
              </Label>
              <div className="relative">
                <IdCard className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  type="text"
                  value={crmCrfa}
                  onChange={(e) => setCrmCrfa(e.target.value)}
                  placeholder="Ex.: 2-12345"
                  className="h-11 pl-10 rounded-xl border-slate-300 text-sm"
                />
              </div>
            </div>
          )}

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
              {saving ? 'Salvando...' : 'Salvar Alterações'}
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
interface DeleteUserModalProps {
  user: UserRow | null
  onOpenChange: (open: boolean) => void
  onConfirm: (id: string) => Promise<void>
}

const DeleteUserModal: React.FC<DeleteUserModalProps> = ({ user, onOpenChange, onConfirm }) => {
  const [deleting, setDeleting] = useState(false)

  const handleConfirm = async () => {
    if (!user) return
    setDeleting(true)
    await onConfirm(user.id)
    setDeleting(false)
  }

  return (
    <Dialog open={!!user} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900">Excluir Usuário</DialogTitle>
          <DialogDescription className="text-sm text-slate-600 mt-2">
            Tem certeza que deseja excluir{' '}
            <span className="font-bold text-slate-900">{user?.name}</span>? Esta ação não pode ser
            desfeita e o usuário perderá o acesso imediatamente.
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
