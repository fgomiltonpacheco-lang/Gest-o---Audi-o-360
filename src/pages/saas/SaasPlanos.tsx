import React, { useEffect, useState } from 'react'
import { Plus, Check, Pencil, Package } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
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
import { fetchPlanos, mapPlano, planoFuncionalidadeLabel } from '@/pages/saas/shared'
import { Plano, PLANO_FUNCIONALIDADE_LABELS } from '@/types'
import { formatCurrency } from '@/lib/formatters'
import pb from '@/lib/pocketbase/client'

const TODAS_FUNCS = Object.keys(PLANO_FUNCIONALIDADE_LABELS)

interface PlanoForm {
  nome: string
  preco_mensal: number
  max_profissionais: number
  max_pacientes: number
  ativo: boolean
  funcionalidades: string[]
}

function toForm(p: Plano): PlanoForm {
  return {
    nome: p.nome,
    preco_mensal: p.preco_mensal,
    max_profissionais: p.max_profissionais,
    max_pacientes: p.max_pacientes,
    ativo: p.ativo,
    funcionalidades: Array.isArray(p.funcionalidades) ? [...p.funcionalidades] : [],
  }
}

const EMPTY_FORM: PlanoForm = {
  nome: '',
  preco_mensal: 0,
  max_profissionais: 0,
  max_pacientes: 0,
  ativo: true,
  funcionalidades: [],
}

export default function SaasPlanos() {
  const { toast } = useToast()
  const [planos, setPlanos] = useState<Plano[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')

  // Modal novo plano
  const [modalNovoOpen, setModalNovoOpen] = useState(false)
  const [formNovo, setFormNovo] = useState<PlanoForm>(EMPTY_FORM)
  const [salvandoNovo, setSalvandoNovo] = useState(false)

  // Modal editar plano
  const [editPlano, setEditPlano] = useState<Plano | null>(null)
  const [formEdit, setFormEdit] = useState<PlanoForm>(EMPTY_FORM)
  const [salvandoEdit, setSalvandoEdit] = useState(false)

  const carregar = async () => {
    try {
      setLoading(true)
      setErro('')
      const list = await fetchPlanos()
      setPlanos(list)
    } catch (e: any) {
      setErro(e?.message || 'Erro ao carregar planos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  const toggleFunc = (arr: string[], key: string): string[] =>
    arr.includes(key) ? arr.filter((x) => x !== key) : [...arr, key]

  // ---------- Criar plano ----------
  const abrirNovo = () => {
    setFormNovo({ ...EMPTY_FORM })
    setModalNovoOpen(true)
  }

  const salvarNovo = async () => {
    if (!formNovo.nome.trim()) {
      toast({ title: 'Informe o nome do plano.', variant: 'destructive' })
      return
    }
    try {
      setSalvandoNovo(true)
      const rec = await pb.collection('planos').create({
        nome: formNovo.nome.trim(),
        preco_mensal: Number(formNovo.preco_mensal) || 0,
        max_profissionais: Number(formNovo.max_profissionais) || 0,
        max_pacientes: Number(formNovo.max_pacientes) || 0,
        ativo: formNovo.ativo,
        funcionalidades: formNovo.funcionalidades,
      })
      setPlanos((prev) => [...prev, mapPlano(rec)].sort((a, b) => a.preco_mensal - b.preco_mensal))
      setModalNovoOpen(false)
      toast({ title: 'Plano criado!', description: formNovo.nome })
    } catch (e: any) {
      toast({
        title: 'Erro ao criar plano',
        description: e?.message,
        variant: 'destructive',
      })
    } finally {
      setSalvandoNovo(false)
    }
  }

  // ---------- Editar plano ----------
  const abrirEditar = (p: Plano) => {
    setEditPlano(p)
    setFormEdit(toForm(p))
  }

  const salvarEditar = async () => {
    if (!editPlano) return
    try {
      setSalvandoEdit(true)
      const rec = await pb.collection('planos').update(editPlano.id, {
        nome: formEdit.nome.trim(),
        preco_mensal: Number(formEdit.preco_mensal) || 0,
        max_profissionais: Number(formEdit.max_profissionais) || 0,
        max_pacientes: Number(formEdit.max_pacientes) || 0,
        ativo: formEdit.ativo,
        funcionalidades: formEdit.funcionalidades,
      })
      setPlanos((prev) =>
        prev
          .map((p) => (p.id === editPlano.id ? mapPlano(rec) : p))
          .sort((a, b) => a.preco_mensal - b.preco_mensal),
      )
      setEditPlano(null)
      toast({ title: 'Plano atualizado!', description: formEdit.nome })
    } catch (e: any) {
      toast({ title: 'Erro ao atualizar', description: e?.message, variant: 'destructive' })
    } finally {
      setSalvandoEdit(false)
    }
  }

  return (
    <div className="space-y-6">
      <SaasBreadcrumbs items={[{ label: 'Gestão SaaS', to: '/saas' }, { label: 'Planos' }]} />
      <SaasPageHeader
        title="Gestão de Planos"
        description="Configure preços, funcionalidades e limites dos planos de assinatura."
        actions={
          <Button className="bg-amber-600 hover:bg-amber-700" onClick={abrirNovo}>
            <Plus className="w-4 h-4" />
            Novo Plano
          </Button>
        }
      />

      {loading ? (
        <SaasLoading message="Carregando planos…" />
      ) : erro ? (
        <Card>
          <CardContent className="py-10 text-center text-red-600">{erro}</CardContent>
        </Card>
      ) : planos.length === 0 ? (
        <SaasEmptyState
          icon={Package}
          title="Nenhum plano cadastrado"
          description="Crie o primeiro plano de assinatura."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {planos.map((p) => (
            <Card
              key={p.id}
              className={`border-slate-200 shadow-sm flex flex-col ${!p.ativo ? 'opacity-60' : ''}`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg font-bold text-slate-800">{p.nome}</CardTitle>
                  <Badge
                    variant="outline"
                    className={
                      p.ativo
                        ? 'border-emerald-300 text-emerald-700'
                        : 'border-slate-300 text-slate-500'
                    }
                  >
                    {p.ativo ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col gap-4">
                <div>
                  <span className="text-3xl font-bold text-amber-600">
                    {formatCurrency(p.preco_mensal)}
                  </span>
                  <span className="text-sm text-slate-400">/mês</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-slate-50 p-2.5">
                    <p className="text-[11px] uppercase text-slate-400">Profissionais</p>
                    <p className="font-semibold text-slate-700">
                      {p.max_profissionais || 'Ilimitado'}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2.5">
                    <p className="text-[11px] uppercase text-slate-400">Pacientes</p>
                    <p className="font-semibold text-slate-700">{p.max_pacientes || 'Ilimitado'}</p>
                  </div>
                </div>
                <div>
                  <p className="text-[11px] uppercase text-slate-400 mb-1.5">Funcionalidades</p>
                  <ul className="space-y-1">
                    {p.funcionalidades.length === 0 ? (
                      <li className="text-xs text-slate-400">Nenhuma funcionalidade definida.</li>
                    ) : (
                      p.funcionalidades.slice(0, 8).map((f) => (
                        <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                          <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          {planoFuncionalidadeLabel(f)}
                        </li>
                      ))
                    )}
                    {p.funcionalidades.length > 8 && (
                      <li className="text-xs text-slate-400 pl-5">
                        +{p.funcionalidades.length - 8} adicionais
                      </li>
                    )}
                  </ul>
                </div>
                <Button variant="outline" className="mt-auto w-full" onClick={() => abrirEditar(p)}>
                  <Pencil className="w-4 h-4" />
                  Editar Plano
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Novo Plano */}
      <Dialog open={modalNovoOpen} onOpenChange={setModalNovoOpen}>
        <PlanoFormDialog
          form={formNovo}
          setForm={setFormNovo}
          salvando={salvandoNovo}
          titulo="Novo Plano"
          descricao="Crie um plano de assinatura personalizado."
          onSalvar={salvarNovo}
          onCancelar={() => setModalNovoOpen(false)}
          toggleFunc={toggleFunc}
        />
      </Dialog>

      {/* Modal Editar Plano */}
      <Dialog open={!!editPlano} onOpenChange={(o) => !o && setEditPlano(null)}>
        <PlanoFormDialog
          form={formEdit}
          setForm={setFormEdit}
          salvando={salvandoEdit}
          titulo="Editar Plano"
          descricao={editPlano?.nome}
          onSalvar={salvarEditar}
          onCancelar={() => setEditPlano(null)}
          toggleFunc={toggleFunc}
        />
      </Dialog>
    </div>
  )
}

// ============================================================
// Sub-componente: formulário de plano (reutilizado em criar/editar)
// ============================================================
const PlanoFormDialog: React.FC<{
  form: PlanoForm
  setForm: React.Dispatch<React.SetStateAction<PlanoForm>>
  salvando: boolean
  titulo: string
  descricao?: string
  onSalvar: () => void
  onCancelar: () => void
  toggleFunc: (arr: string[], key: string) => string[]
}> = ({ form, setForm, salvando, titulo, descricao, onSalvar, onCancelar, toggleFunc }) => (
  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle>{titulo}</DialogTitle>
      {descricao && <DialogDescription>{descricao}</DialogDescription>}
    </DialogHeader>
    <div className="space-y-4 py-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="p-nome">Nome do Plano *</Label>
          <Input
            id="p-nome"
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            placeholder="Ex.: Profissional"
          />
        </div>
        <div>
          <Label htmlFor="p-preco">Preço Mensal (R$)</Label>
          <Input
            id="p-preco"
            type="number"
            min={0}
            step="0.01"
            value={form.preco_mensal}
            onChange={(e) => setForm({ ...form, preco_mensal: Number(e.target.value) })}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="p-prof">Máx. Profissionais</Label>
          <Input
            id="p-prof"
            type="number"
            min={0}
            value={form.max_profissionais}
            onChange={(e) => setForm({ ...form, max_profissionais: Number(e.target.value) })}
          />
        </div>
        <div>
          <Label htmlFor="p-pac">Máx. Pacientes</Label>
          <Input
            id="p-pac"
            type="number"
            min={0}
            value={form.max_pacientes}
            onChange={(e) => setForm({ ...form, max_pacientes: Number(e.target.value) })}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="p-ativo"
          checked={form.ativo}
          onCheckedChange={(v) => setForm({ ...form, ativo: !!v })}
        />
        <Label htmlFor="p-ativo">Plano ativo (disponível para novas clínicas)</Label>
      </div>
      <div>
        <Label>Funcionalidades inclusas</Label>
        <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2">
          {TODAS_FUNCS.map((key) => (
            <label
              key={key}
              className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer p-1.5 rounded hover:bg-slate-50"
            >
              <Checkbox
                checked={form.funcionalidades.includes(key)}
                onCheckedChange={() =>
                  setForm({ ...form, funcionalidades: toggleFunc(form.funcionalidades, key) })
                }
              />
              {planoFuncionalidadeLabel(key)}
            </label>
          ))}
        </div>
      </div>
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={onCancelar} disabled={salvando}>
        Cancelar
      </Button>
      <Button className="bg-amber-600 hover:bg-amber-700" onClick={onSalvar} disabled={salvando}>
        {salvando ? 'Salvando…' : 'Salvar'}
      </Button>
    </DialogFooter>
  </DialogContent>
)
