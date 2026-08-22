import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Building2,
  Plus,
  Trash2,
  Save,
  TrendingUp,
  Wallet,
  ShoppingCart,
} from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency } from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { cn } from '@/lib/utils'

interface ItemForm {
  key: string
  produto_id: string
  produto_nome: string
  quantidade: number
  valor_unitario: number
  valor_subtotal: number
}

let itemKeySeq = 1

export default function NovaVendaB2B() {
  const navigate = useNavigate()
  const { empresasParceiras, fetchEmpresasParceiras, stockItems, addVendaB2B, currentUser } =
    useApp()
  const { toast } = useToast()

  const [empresaId, setEmpresaId] = useState('')
  const [dataVenda, setDataVenda] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate(),
    ).padStart(2, '0')}`
  })
  const [percentual, setPercentual] = useState(30)
  const [observacoes, setObservacoes] = useState('')
  const [itens, setItens] = useState<ItemForm[]>([
    {
      key: `i${itemKeySeq++}`,
      produto_id: '',
      produto_nome: '',
      quantidade: 1,
      valor_unitario: 0,
      valor_subtotal: 0,
    },
  ])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchEmpresasParceiras()
  }, [fetchEmpresasParceiras])

  const empresasAtivas = useMemo(
    () => empresasParceiras.filter((e) => (e.status as any) === 'ativo'),
    [empresasParceiras],
  )

  // Vendas B2B são SOMENTE de aparelhos auditivos: filtra o estoque para
  // exibir apenas produtos da categoria "Aparelhos auditivos", evitando
  // incluir serviços, exames, pilhas ou outros itens.
  const aparelhosAuditivos = useMemo(
    () =>
      stockItems.filter(
        (p) => (p.category || '').toLowerCase().replace(/ó/g, 'o') === 'aparelhos auditivos',
      ),
    [stockItems],
  )

  const valorTotal = useMemo(
    () => itens.reduce((acc, it) => acc + (Number(it.valor_subtotal) || 0), 0),
    [itens],
  )
  const valorComissao = (valorTotal * Number(percentual || 0)) / 100
  const valorRepasse = valorTotal - valorComissao

  const updateItem = (key: string, patch: Partial<ItemForm>) => {
    setItens((prev) =>
      prev.map((it) => {
        if (it.key !== key) return it
        const next = { ...it, ...patch }
        const qtd = Number(next.quantidade) || 0
        const vu = Number(next.valor_unitario) || 0
        next.valor_subtotal = qtd * vu
        return next
      }),
    )
  }

  const onSelectProduto = (key: string, produtoId: string) => {
    const prod = stockItems.find((p) => p.id === produtoId)
    updateItem(key, {
      produto_id: produtoId,
      produto_nome: prod?.name || '',
      valor_unitario: prod?.salePrice || 0,
    })
  }

  const addItem = () => {
    setItens((prev) => [
      ...prev,
      {
        key: `i${itemKeySeq++}`,
        produto_id: '',
        produto_nome: '',
        quantidade: 1,
        valor_unitario: 0,
        valor_subtotal: 0,
      },
    ])
  }

  const removeItem = (key: string) => {
    setItens((prev) => prev.filter((it) => it.key !== key))
  }

  const handleSave = async () => {
    if (!empresaId) {
      toast({ title: 'Selecione a empresa parceira', variant: 'destructive' })
      return
    }
    const itensValidos = itens.filter((it) => it.produto_id && it.quantidade > 0)
    if (itensValidos.length === 0) {
      toast({ title: 'Adicione ao menos um item válido', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const result = await addVendaB2B({
        cliente_empresa_id: empresaId,
        cliente_empresa_nome: empresasParceiras.find((e) => e.id === empresaId)?.razao_social || '',
        data_venda: dataVenda,
        valor_total: valorTotal,
        percentual_comissao: percentual,
        valor_comissao: valorComissao,
        valor_repasse: valorRepasse,
        status: 'pendente',
        especialista_id: currentUser?.id || '',
        especialista_nome: currentUser?.name || '',
        observacoes,
        itens: itensValidos.map((it) => ({
          produto_id: it.produto_id,
          produto_nome: it.produto_nome,
          quantidade: it.quantidade,
          valor_unitario: it.valor_unitario,
          valor_subtotal: it.valor_subtotal,
        })),
      })
      if (result) {
        navigate('/vendas-b2b')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5 animate-in fade-in-50 duration-200">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/vendas-b2b')}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Nova Venda B2B</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Venda de aparelhos auditivos para empresa parceira
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Coluna principal */}
        <div className="lg:col-span-2 space-y-5">
          {/* Dados gerais */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-700" /> Dados da Venda
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-600 mb-1 block">
                  Empresa Parceira *
                </Label>
                <Select value={empresaId} onValueChange={setEmpresaId}>
                  <SelectTrigger className="h-9 rounded-lg text-sm">
                    <SelectValue placeholder="Selecione a empresa..." />
                  </SelectTrigger>
                  <SelectContent>
                    {empresasAtivas.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.razao_social}
                        {e.cnpj ? ` — ${e.cnpj}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {empresasAtivas.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    Nenhuma empresa ativa. Cadastre em “Parceiros”.
                  </p>
                )}
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-600 mb-1 block">
                  Data da Venda
                </Label>
                <Input
                  type="date"
                  value={dataVenda}
                  onChange={(e) => setDataVenda(e.target.value)}
                  className="h-9 rounded-lg text-sm"
                />
              </div>
            </div>
          </div>

          {/* Itens */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-blue-700" /> Aparelhos Auditivos
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Vendas B2B incluem apenas aparelhos auditivos.
                </p>
              </div>
              <Button
                size="sm"
                onClick={addItem}
                className="rounded-lg text-xs bg-blue-700 hover:bg-blue-800 text-white"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar Item
              </Button>
            </div>

            <div className="overflow-x-auto -mx-1">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="text-xs uppercase tracking-wider">Produto</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider w-20">Qtd.</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider w-32">
                      Valor Unit.
                    </TableHead>
                    <TableHead className="text-xs uppercase tracking-wider w-32 text-right">
                      Subtotal
                    </TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itens.map((it) => (
                    <TableRow key={it.key}>
                      <TableCell>
                        <Select
                          value={it.produto_id}
                          onValueChange={(v) => onSelectProduto(it.key, v)}
                        >
                          <SelectTrigger className="h-9 rounded-lg text-sm">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {aparelhosAuditivos.length === 0 ? (
                              <SelectItem value="_empty" disabled>
                                Nenhum aparelho auditivo em estoque
                              </SelectItem>
                            ) : (
                              aparelhosAuditivos.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name}
                                  {p.brand ? ` — ${p.brand}` : ''}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={1}
                          value={it.quantidade}
                          onChange={(e) =>
                            updateItem(it.key, {
                              quantidade: Number(e.target.value),
                            })
                          }
                          className="h-9 rounded-lg text-sm text-center"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={it.valor_unitario}
                          onChange={(e) =>
                            updateItem(it.key, {
                              valor_unitario: Number(e.target.value),
                            })
                          }
                          className="h-9 rounded-lg text-sm text-right"
                        />
                      </TableCell>
                      <TableCell className="text-right font-bold text-slate-900">
                        {formatCurrency(it.valor_subtotal)}
                      </TableCell>
                      <TableCell>
                        {itens.length > 1 && (
                          <button
                            onClick={() => removeItem(it.key)}
                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Observações */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <Label className="text-xs font-semibold text-slate-600 mb-1 block">Observações</Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Observações sobre a venda..."
              className="rounded-xl text-sm min-h-[80px]"
            />
          </div>
        </div>

        {/* Resumo lateral */}
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm sticky top-4">
            <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-700" /> Resumo da Venda
            </h2>

            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Valor Total
                </span>
                <span className="text-lg font-extrabold text-slate-900">
                  {formatCurrency(valorTotal)}
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs font-semibold text-slate-600">Comissão (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={percentual}
                    onChange={(e) => setPercentual(Number(e.target.value))}
                    className="h-7 w-20 rounded-md text-xs text-right"
                  />
                </div>
                <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-emerald-50 border border-emerald-200">
                  <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
                    Comissão ({Number(percentual || 0).toFixed(2)}%)
                  </span>
                  <span className="text-lg font-extrabold text-emerald-700">
                    {formatCurrency(valorComissao)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Wallet className="w-3.5 h-3.5" /> Repassar ao Fornecedor
                </span>
                <span className="text-base font-bold text-slate-700">
                  {formatCurrency(valorRepasse)}
                </span>
              </div>
            </div>

            <Button
              onClick={handleSave}
              disabled={saving}
              className={cn(
                'w-full mt-5 rounded-xl text-sm bg-blue-700 hover:bg-blue-800 text-white',
              )}
            >
              <Save className="w-4 h-4 mr-1.5" />
              {saving ? 'Salvando...' : 'Salvar Venda B2B'}
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/vendas-b2b')}
              className="w-full mt-2 rounded-xl text-sm"
              disabled={saving}
            >
              Cancelar
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
