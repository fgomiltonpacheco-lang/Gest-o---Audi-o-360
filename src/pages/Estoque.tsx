import React, { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useApp } from '@/context/AppContext'
import {
  Package,
  Plus,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  Pencil,
  Trash2,
  History,
  CheckCircle,
  Layers,
  ChevronRight,
  Boxes,
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/formatters'
import {
  StockItem,
  StockCategory,
  BatterySize,
  AccessorySubcategory,
  InventoryCategoria,
  INVENTORY_CATEGORIAS,
  INVENTORY_CATEGORIA_LABELS,
} from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useToast } from '@/hooks/use-toast'

const CATEGORIES: StockCategory[] = ['Aparelhos auditivos', 'Pilhas', 'Moldes', 'Acessórios']
const BATTERY_SIZES: BatterySize[] = ['10', '13', '312', '675']
const ACCESSORY_SUBS: AccessorySubcategory[] = [
  'Tubos',
  'Filtros',
  'Cerúmen',
  'Cordões',
  'Carregadores',
  'Outros',
]

export default function Estoque() {
  const {
    currentUser,
    stockItems,
    addStockItem,
    updateStockItem,
    deleteStockItem,
    addStockEntry,
    addStockExit,
  } = useApp()
  const { toast } = useToast()

  // Filtros
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('todos')
  const [statusFilter, setStatusFilter] = useState('todos')
  // Toggles de alerta (baixo mínimo / validade vencendo-vencidos)
  const [onlyBelowMin, setOnlyBelowMin] = useState(false)
  const [onlyExpiring, setOnlyExpiring] = useState(false)

  // Permite que alertas do sino naveguem para /estoque?f=<filtro>
  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    const f = searchParams.get('f')
    if (!f) return
    if (f === 'baixo' || f === 'zerado') {
      setOnlyBelowMin(true)
      setStatusFilter('critico')
    } else if (f === 'vencendo' || f === 'vencido') {
      setOnlyExpiring(true)
    }
    // limpa o parâmetro para não recair em filtros ao recarregar
    setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams])

  // Modais
  const [itemModalOpen, setItemModalOpen] = useState(false)
  const [itemToEdit, setItemToEdit] = useState<StockItem | null>(null)

  const [entryModalOpen, setEntryModalOpen] = useState(false)
  const [exitModalOpen, setExitModalOpen] = useState(false)
  const [historyModalOpen, setHistoryModalOpen] = useState(false)
  const [selectedStockItem, setSelectedStockItem] = useState<StockItem | null>(null)

  // Submissão Entrada
  const [entryQty, setEntryQty] = useState<number>(10)
  const [entrySupplier, setEntrySupplier] = useState('')
  const [entryResp, setEntryResp] = useState(currentUser?.name || 'Administrador')
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0])

  // Submissão Saída
  const [exitQty, setExitQty] = useState<number>(1)
  const [exitReason, setExitReason] = useState('Venda balcão para paciente')
  const [exitPatient, setExitPatient] = useState('')
  const [exitResp, setExitResp] = useState(currentUser?.name || 'Recepção')
  const [exitDate, setExitDate] = useState(new Date().toISOString().split('T')[0])

  // Form State: Item
  const [name, setName] = useState('')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [color, setColor] = useState('')
  const [category, setCategory] = useState<StockCategory>('Pilhas')
  const [batterySize, setBatterySize] = useState<BatterySize>('312')
  const [accessorySub, setAccessorySub] = useState<AccessorySubcategory>('Cerúmen')
  const [minQty, setMinQty] = useState<number>(10)
  const [currentQty, setCurrentQty] = useState<number>(20)
  const [supplier, setSupplier] = useState('')
  const [costPrice, setCostPrice] = useState<number>(15)
  const [salePrice, setSalePrice] = useState<number>(30)
  const [notes, setNotes] = useState('')

  // Novos campos de controle de estoque/validade
  const [estoqueMinimo, setEstoqueMinimo] = useState<number>(0)
  const [dataValidade, setDataValidade] = useState('')
  const [lote, setLote] = useState('')
  const [fabricante, setFabricante] = useState('')
  const [diasAlertaValidade, setDiasAlertaValidade] = useState<number>(30)
  const [categoria, setCategoria] = useState<InventoryCategoria | ''>('')
  const [unidadeMedida, setUnidadeMedida] = useState('un')

  // Confirmação de Exclusão
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<StockItem | null>(null)

  // Helpers de status de validade
  const hoje0h = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  /** Dias até o vencimento (negativo = vencido). null se sem validade. */
  function diasParaVencer(item: StockItem): number | null {
    if (!item.dataValidade) return null
    const v = new Date(item.dataValidade + 'T00:00:00')
    if (isNaN(v.getTime())) return null
    return Math.ceil((v.getTime() - hoje0h.getTime()) / (1000 * 60 * 60 * 24))
  }

  function estoqueStatus(item: StockItem): 'zerado' | 'baixo' | 'ok' | 'na' {
    if (item.categoria === 'servico') return 'na'
    if (Number(item.currentQuantity) <= 0) return 'zerado'
    const min = item.estoqueMinimo ?? item.minQuantity ?? 0
    if (min > 0 && Number(item.currentQuantity) < min) return 'baixo'
    return 'ok'
  }

  function validadeStatus(item: StockItem): 'vencido' | 'vencendo' | 'valido' | 'na' {
    if (item.categoria === 'servico' || !item.dataValidade) return 'na'
    const d = diasParaVencer(item)
    if (d === null) return 'na'
    if (d < 0) return 'vencido'
    const diasAlerta = item.diasAlertaValidade ?? 30
    if (d <= diasAlerta) return 'vencendo'
    return 'valido'
  }

  // Itens em estado crítico (abaixo do mínimo)
  const criticalItems = useMemo(() => {
    return stockItems.filter(
      (it) =>
        it.categoria !== 'servico' &&
        Number(it.currentQuantity) < (it.estoqueMinimo ?? it.minQuantity ?? 0),
    )
  }, [stockItems])

  // Filtragem
  const filteredItems = useMemo(() => {
    return stockItems.filter((it) => {
      const q = search.toLowerCase().trim()
      const matchesSearch =
        !q ||
        it.name.toLowerCase().includes(q) ||
        (it.brand || '').toLowerCase().includes(q) ||
        (it.supplier || '').toLowerCase().includes(q) ||
        (it.fabricante || '').toLowerCase().includes(q) ||
        (it.lote || '').toLowerCase().includes(q)

      const matchesCat = categoryFilter === 'todos' || it.category === categoryFilter
      const min = it.estoqueMinimo ?? it.minQuantity ?? 0
      const isBelow = it.categoria !== 'servico' && Number(it.currentQuantity) < min
      const matchesStatus =
        statusFilter === 'todos' ? true : statusFilter === 'critico' ? isBelow : !isBelow

      // Toggle: apenas itens abaixo do mínimo
      const matchesBelowMin = !onlyBelowMin || isBelow
      // Toggle: apenas itens vencendo/vencidos
      const vStatus = validadeStatus(it)
      const matchesExpiring = !onlyExpiring || vStatus === 'vencendo' || vStatus === 'vencido'

      return matchesSearch && matchesCat && matchesStatus && matchesBelowMin && matchesExpiring
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stockItems, search, categoryFilter, statusFilter, onlyBelowMin, onlyExpiring, hoje0h])

  const openNewItem = () => {
    setItemToEdit(null)
    setName('')
    setBrand('')
    setModel('')
    setColor('')
    setCategory('Pilhas')
    setBatterySize('312')
    setAccessorySub('Cerúmen')
    setMinQty(10)
    setCurrentQty(20)
    setSupplier('Rayovac Brasil')
    setCostPrice(15)
    setSalePrice(30)
    setNotes('')
    setEstoqueMinimo(0)
    setDataValidade('')
    setLote('')
    setFabricante('')
    setDiasAlertaValidade(30)
    setCategoria('')
    setUnidadeMedida('un')
    setItemModalOpen(true)
  }

  const openEditItem = (item: StockItem) => {
    setItemToEdit(item)
    setName(item.name)
    setBrand(item.brand || '')
    setModel(item.model || '')
    setColor(item.color || '')
    setCategory(item.category)
    setBatterySize(item.batterySize || '312')
    setAccessorySub(item.accessorySubcategory || 'Outros')
    setMinQty(item.minQuantity)
    setCurrentQty(item.currentQuantity)
    setSupplier(item.supplier || '')
    setCostPrice(item.costPrice)
    setSalePrice(item.salePrice)
    setNotes(item.notes || '')
    setEstoqueMinimo(item.estoqueMinimo ?? 0)
    setDataValidade(item.dataValidade || '')
    setLote(item.lote || '')
    setFabricante(item.fabricante || '')
    setDiasAlertaValidade(item.diasAlertaValidade ?? 30)
    setCategoria(item.categoria || '')
    setUnidadeMedida(item.unidadeMedida || 'un')
    setItemModalOpen(true)
  }

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    // Regra 5: lote obrigatório para produtos com data_validade preenchida
    if (dataValidade && !lote.trim()) {
      toast({
        title: 'Lote obrigatório',
        description: 'Para produtos com data de validade, o número do lote é obrigatório.',
        variant: 'destructive',
      })
      return
    }

    const payload = {
      name: name.trim(),
      brand: brand.trim() || undefined,
      model: model.trim() || undefined,
      color: color.trim() || undefined,
      category,
      batterySize: category === 'Pilhas' ? batterySize : undefined,
      accessorySubcategory: category === 'Acessórios' ? accessorySub : undefined,
      minQuantity: Number(minQty),
      currentQuantity: Number(currentQty),
      supplier: supplier.trim() || undefined,
      costPrice: Number(costPrice),
      salePrice: Number(salePrice),
      notes: notes.trim() || undefined,
      // Novos campos
      estoqueMinimo: Number(estoqueMinimo) || 0,
      dataValidade: dataValidade || undefined,
      lote: lote.trim() || undefined,
      fabricante: fabricante.trim() || undefined,
      diasAlertaValidade: Number(diasAlertaValidade) || 30,
      categoria: categoria || undefined,
      unidadeMedida: unidadeMedida.trim() || undefined,
    }

    if (itemToEdit) {
      updateStockItem(itemToEdit.id, payload)
    } else {
      addStockItem(payload)
    }
    setItemModalOpen(false)
  }

  const handleSaveEntry = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedStockItem || entryQty <= 0) return
    addStockEntry(selectedStockItem.id, Number(entryQty), entrySupplier, entryResp, entryDate)
    setEntryModalOpen(false)
  }

  const handleSaveExit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedStockItem || exitQty <= 0) return
    const ok = addStockExit(
      selectedStockItem.id,
      Number(exitQty),
      exitReason,
      exitResp,
      exitPatient,
      exitDate,
    )
    if (ok) setExitModalOpen(false)
  }

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Estoque</h1>
            <Badge variant="secondary" className="bg-teal-50 text-navy-700 font-bold text-xs">
              {stockItems.length} itens cadastrados
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Controle de saldo, níveis mínimos, entradas e saídas de aparelhos, pilhas e insumos
          </p>
        </div>

        <Button
          onClick={openNewItem}
          className="rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-xs font-semibold h-10 shadow-sm flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Novo Item de Estoque
        </Button>
      </div>

      {/* Banner de Alerta para Itens Críticos */}
      {criticalItems.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-900">
                Atenção: {criticalItems.length} item(ns) abaixo do estoque mínimo!
              </h3>
              <p className="text-xs text-amber-700 mt-0.5">
                {criticalItems
                  .map((c) => `${c.name} (${c.currentQuantity}/${c.minQuantity} un)`)
                  .join(' • ')}
              </p>
            </div>
          </div>

          <Button
            size="sm"
            onClick={() => setStatusFilter('critico')}
            className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold h-9 shrink-0 shadow-xs"
          >
            Filtrar Críticos
          </Button>
        </div>
      )}

      {/* Barra de Filtros */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar item por nome, marca ou fornecedor..."
            className="h-10 pl-9 rounded-xl border-slate-300 text-xs sm:text-sm"
          />
        </div>

        <div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-10 rounded-xl border-slate-300 text-xs font-medium">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as Categorias</SelectItem>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-10 rounded-xl border-slate-300 text-xs font-medium">
              <SelectValue placeholder="Status do Saldo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Níveis</SelectItem>
              <SelectItem value="ok">Estoque Normal (OK)</SelectItem>
              <SelectItem value="critico">Abaixo do Mínimo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Toggles de alerta rápida */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setOnlyBelowMin((v) => !v)}
          className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-semibold border transition-colors ${
            onlyBelowMin
              ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
              : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          Abaixo do mínimo
        </button>
        <button
          type="button"
          onClick={() => setOnlyExpiring((v) => !v)}
          className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-semibold border transition-colors ${
            onlyExpiring
              ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
              : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          Vencendo / Vencidos
        </button>
        {(onlyBelowMin || onlyExpiring) && (
          <button
            type="button"
            onClick={() => {
              setOnlyBelowMin(false)
              setOnlyExpiring(false)
            }}
            className="inline-flex items-center gap-1 h-9 px-3 rounded-xl text-xs font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Tabela de Estoque */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider text-[11px] font-bold">
              <tr>
                <th className="py-3.5 px-4">Item & Especificação</th>
                <th className="py-3.5 px-4">Categoria</th>
                <th className="py-3.5 px-4 text-center">Qtd Atual</th>
                <th className="py-3.5 px-4 text-center">Estoque Mínimo</th>
                <th className="py-3.5 px-4 text-center">Status Estoque</th>
                <th className="py-3.5 px-4 text-center">Validade</th>
                <th className="py-3.5 px-4 text-center">Status Validade</th>
                <th className="py-3.5 px-4">Fornecedor</th>
                <th className="py-3.5 px-4">Custo / Venda</th>
                <th className="py-3.5 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 text-xs">
                    Nenhum item localizado no estoque com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const stStatus = estoqueStatus(item)
                  const vlStatus = validadeStatus(item)
                  const isBelowMin = stStatus === 'baixo' || stStatus === 'zerado'
                  const dVencer = diasParaVencer(item)
                  return (
                    <tr key={item.id} className="hover:bg-teal-50/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <span
                          onClick={() => {
                            setSelectedStockItem(item)
                            setHistoryModalOpen(true)
                          }}
                          className="font-bold text-slate-900 hover:text-teal-600 cursor-pointer block"
                        >
                          {item.name}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {item.brand && `${item.brand} • `}
                          {item.batterySize && `Tamanho ${item.batterySize}`}
                          {item.accessorySubcategory && `Sub: ${item.accessorySubcategory}`}
                          {item.color && ` • Cor: ${item.color}`}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 rounded-full bg-slate-100 font-semibold text-slate-700 text-xs">
                          {item.category}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`text-sm font-extrabold px-2.5 py-1 rounded-lg ${
                            isBelowMin
                              ? 'bg-red-100 text-red-700 font-black'
                              : 'bg-emerald-50 text-emerald-700 font-bold'
                          }`}
                        >
                          {item.currentQuantity} un
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center text-xs text-slate-500 font-medium">
                        {item.categoria === 'servico' ? (
                          <span className="text-slate-300">—</span>
                        ) : (
                          <span>{item.estoqueMinimo ?? item.minQuantity ?? 0} un</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        {stStatus === 'na' ? (
                          <span className="text-[11px] text-slate-400">Sem controle</span>
                        ) : stStatus === 'zerado' ? (
                          <Badge className="bg-red-100 text-red-700 border-red-200 font-bold">
                            Zerado
                          </Badge>
                        ) : stStatus === 'baixo' ? (
                          <Badge className="bg-amber-100 text-amber-700 border-amber-200 font-bold">
                            Abaixo do mínimo
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 font-bold">
                            OK
                          </Badge>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center text-xs text-slate-600">
                        {item.dataValidade ? formatDate(item.dataValidade) : '—'}
                        {item.lote ? (
                          <div className="text-[10px] text-slate-400">Lote: {item.lote}</div>
                        ) : null}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        {vlStatus === 'na' ? (
                          <Badge className="bg-slate-100 text-slate-500 border-slate-200 font-bold">
                            Sem validade
                          </Badge>
                        ) : vlStatus === 'vencido' ? (
                          <Badge className="bg-red-100 text-red-700 border-red-200 font-bold">
                            Vencido
                          </Badge>
                        ) : vlStatus === 'vencendo' ? (
                          <Badge className="bg-amber-100 text-amber-700 border-amber-200 font-bold">
                            Vence em {dVencer}d
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 font-bold">
                            Válido
                          </Badge>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-600">{item.supplier || '—'}</td>

                      <td className="py-3.5 px-4 text-xs">
                        <div className="text-slate-500">
                          Custo: {formatCurrency(item.costPrice)}
                        </div>
                        <div className="font-bold text-emerald-700">
                          Venda: {formatCurrency(item.salePrice)}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Entrada */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedStockItem(item)
                              setEntrySupplier(item.supplier || '')
                              setEntryModalOpen(true)
                            }}
                            className="h-8 px-2 text-xs font-semibold text-emerald-700 border-emerald-200 hover:bg-emerald-50 rounded-lg"
                            title="Dar Entrada de Mercadoria"
                          >
                            <ArrowUpRight className="w-3.5 h-3.5 mr-1" />
                            Entrada
                          </Button>

                          {/* Saída */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedStockItem(item)
                              setExitModalOpen(true)
                            }}
                            className="h-8 px-2 text-xs font-semibold text-orange-700 border-orange-200 hover:bg-orange-50 rounded-lg"
                            title="Dar Saída / Venda"
                          >
                            <ArrowDownRight className="w-3.5 h-3.5 mr-1" />
                            Saída
                          </Button>

                          {/* Histórico */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedStockItem(item)
                              setHistoryModalOpen(true)
                            }}
                            className="h-8 w-8 p-0 text-slate-600 hover:bg-slate-100 rounded-lg"
                            title="Histórico de Movimentações"
                          >
                            <History className="w-4 h-4" />
                          </Button>

                          {/* Editar */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditItem(item)}
                            className="h-8 w-8 p-0 text-slate-600 hover:bg-slate-100 rounded-lg"
                            title="Editar Item"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>

                          {/* Excluir */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setItemToDelete(item)
                              setDeleteConfirmOpen(true)
                            }}
                            className="h-8 w-8 p-0 text-red-500 hover:bg-red-50 rounded-lg"
                            title="Excluir do Estoque"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL CADASTRO / EDIÇÃO DE ITEM */}
      <Dialog open={itemModalOpen} onOpenChange={setItemModalOpen}>
        <DialogContent className="max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
          <DialogHeader className="border-b border-slate-100 pb-3">
            <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Package className="w-5 h-5 text-teal-600" />
              <span>{itemToEdit ? 'Editar Item de Estoque' : 'Novo Item no Estoque'}</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveItem} className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-semibold text-slate-700">
                Nome do Item <span className="text-red-500">*</span>
              </Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Pilha Auditiva Rayovac Extra 312, Filtro Cerumen Phonak"
                required
                className="h-10 rounded-xl mt-1 text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-700">Categoria</Label>
                <Select value={category} onValueChange={(v: StockCategory) => setCategory(v)}>
                  <SelectTrigger className="h-10 rounded-xl mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Marca / Fabricante</Label>
                <Input
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="Ex: Rayovac, Phonak, Signia"
                  className="h-10 rounded-xl mt-1 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Fornecedor</Label>
                <Input
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  placeholder="Ex: Distribuidora Nacional"
                  className="h-10 rounded-xl mt-1 text-xs"
                />
              </div>
            </div>

            {/* Campos Específicos por Categoria */}
            {category === 'Pilhas' && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <Label className="text-xs font-semibold text-slate-700">Tamanho da Pilha</Label>
                <Select value={batterySize} onValueChange={(v: BatterySize) => setBatterySize(v)}>
                  <SelectTrigger className="h-9 rounded-lg mt-1 text-xs bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BATTERY_SIZES.map((s) => (
                      <SelectItem key={s} value={s}>
                        Tamanho {s} (Cor padrão)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {category === 'Acessórios' && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <Label className="text-xs font-semibold text-slate-700">
                  Subcategoria de Acessório
                </Label>
                <Select
                  value={accessorySub}
                  onValueChange={(v: AccessorySubcategory) => setAccessorySub(v)}
                >
                  <SelectTrigger className="h-9 rounded-lg mt-1 text-xs bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCESSORY_SUBS.map((sub) => (
                      <SelectItem key={sub} value={sub}>
                        {sub}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {category === 'Aparelhos auditivos' && (
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Modelo</Label>
                  <Input
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="Ex: Lumity L70-R"
                    className="h-9 rounded-lg mt-1 text-xs bg-white"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Cor</Label>
                  <Input
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    placeholder="Ex: Prata Champanhe"
                    className="h-9 rounded-lg mt-1 text-xs bg-white"
                  />
                </div>
              </div>
            )}

            {/* Categoria operacional + unidade de medida */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-700">Categoria (controle)</Label>
                <Select
                  value={categoria || 'none'}
                  onValueChange={(v) => setCategoria(v === 'none' ? '' : (v as InventoryCategoria))}
                >
                  <SelectTrigger className="h-10 rounded-xl mt-1 text-xs">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Não definida —</SelectItem>
                    {INVENTORY_CATEGORIAS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {INVENTORY_CATEGORIA_LABELS[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {categoria === 'servico' && (
                  <p className="text-[10px] text-slate-400 mt-1">
                    Serviços não têm controle de estoque mínimo nem validade.
                  </p>
                )}
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-700">Unidade de Medida</Label>
                <Input
                  value={unidadeMedida}
                  onChange={(e) => setUnidadeMedida(e.target.value)}
                  placeholder="Ex: un, cx, par"
                  className="h-10 rounded-xl mt-1 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-700">Fabricante</Label>
                <Input
                  value={fabricante}
                  onChange={(e) => setFabricante(e.target.value)}
                  placeholder="Ex: Phonak, Widex"
                  className="h-10 rounded-xl mt-1 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-700">Qtd Mínima</Label>
                <Input
                  type="number"
                  min="0"
                  value={minQty}
                  onChange={(e) => setMinQty(Number(e.target.value))}
                  required
                  className="h-10 rounded-xl mt-1 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Qtd Atual</Label>
                <Input
                  type="number"
                  min="0"
                  value={currentQty}
                  onChange={(e) => setCurrentQty(Number(e.target.value))}
                  required
                  className="h-10 rounded-xl mt-1 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Custo (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={costPrice}
                  onChange={(e) => setCostPrice(Number(e.target.value))}
                  required
                  className="h-10 rounded-xl mt-1 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Preço Venda (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={salePrice}
                  onChange={(e) => setSalePrice(Number(e.target.value))}
                  required
                  className="h-10 rounded-xl mt-1 text-xs"
                />
              </div>
            </div>

            {/* Estoque mínimo + controle de validade */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <Label className="text-xs font-semibold text-slate-700">Estoque Mínimo</Label>
                <Input
                  type="number"
                  min="0"
                  value={estoqueMinimo}
                  onChange={(e) => setEstoqueMinimo(Number(e.target.value))}
                  className="h-9 rounded-lg mt-1 text-xs bg-white"
                  disabled={categoria === 'servico'}
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-700">Data de Validade</Label>
                <Input
                  type="date"
                  value={dataValidade}
                  onChange={(e) => setDataValidade(e.target.value)}
                  className="h-9 rounded-lg mt-1 text-xs bg-white"
                  disabled={categoria === 'servico'}
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Lote {dataValidade && <span className="text-red-500">*</span>}
                </Label>
                <Input
                  value={lote}
                  onChange={(e) => setLote(e.target.value)}
                  placeholder="Nº do lote"
                  className="h-9 rounded-lg mt-1 text-xs bg-white"
                  disabled={categoria === 'servico'}
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-700">Alerta antes (dias)</Label>
                <Input
                  type="number"
                  min="0"
                  value={diasAlertaValidade}
                  onChange={(e) => setDiasAlertaValidade(Number(e.target.value))}
                  className="h-9 rounded-lg mt-1 text-xs bg-white"
                  disabled={categoria === 'servico'}
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">Observações</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Particularidades do fornecedor, lote, compatibilidade..."
                rows={2}
                className="rounded-xl mt-1 text-xs border-slate-300 resize-none"
              />
            </div>

            <DialogFooter className="pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setItemModalOpen(false)}
                className="rounded-xl text-xs font-semibold"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-xs font-semibold shadow-sm"
              >
                Salvar Item
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL ENTRADA DE ESTOQUE */}
      {selectedStockItem && (
        <Dialog open={entryModalOpen} onOpenChange={setEntryModalOpen}>
          <DialogContent className="max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <DialogHeader className="border-b border-slate-100 pb-3">
              <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <ArrowUpRight className="w-5 h-5 text-emerald-600" />
                <span>Entrada de Estoque: {selectedStockItem.name}</span>
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSaveEntry} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Quantidade</Label>
                  <Input
                    type="number"
                    min="1"
                    value={entryQty}
                    onChange={(e) => setEntryQty(Number(e.target.value))}
                    required
                    className="h-10 rounded-xl mt-1 text-xs font-bold"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Data da Entrada</Label>
                  <Input
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="h-10 rounded-xl mt-1 text-xs"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Fornecedor / Origem</Label>
                <Input
                  value={entrySupplier}
                  onChange={(e) => setEntrySupplier(e.target.value)}
                  placeholder="Nome do fornecedor"
                  className="h-10 rounded-xl mt-1 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Responsável pelo Recebimento
                </Label>
                <Input
                  value={entryResp}
                  onChange={(e) => setEntryResp(e.target.value)}
                  className="h-10 rounded-xl mt-1 text-xs"
                />
              </div>

              <DialogFooter className="pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEntryModalOpen(false)}
                  className="rounded-xl text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm"
                >
                  Confirmar Entrada
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* MODAL SAÍDA DE ESTOQUE */}
      {selectedStockItem && (
        <Dialog open={exitModalOpen} onOpenChange={setExitModalOpen}>
          <DialogContent className="max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <DialogHeader className="border-b border-slate-100 pb-3">
              <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <ArrowDownRight className="w-5 h-5 text-orange-600" />
                <span>Saída de Estoque: {selectedStockItem.name}</span>
              </DialogTitle>
              <p className="text-xs text-slate-500">
                Saldo disponível: <strong>{selectedStockItem.currentQuantity} unidades</strong>
              </p>
            </DialogHeader>

            <form onSubmit={handleSaveExit} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Quantidade</Label>
                  <Input
                    type="number"
                    min="1"
                    max={selectedStockItem.currentQuantity}
                    value={exitQty}
                    onChange={(e) => setExitQty(Number(e.target.value))}
                    required
                    className="h-10 rounded-xl mt-1 text-xs font-bold"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Data da Saída</Label>
                  <Input
                    type="date"
                    value={exitDate}
                    onChange={(e) => setExitDate(e.target.value)}
                    className="h-10 rounded-xl mt-1 text-xs"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Motivo da Baixa</Label>
                <Input
                  value={exitReason}
                  onChange={(e) => setExitReason(e.target.value)}
                  placeholder="Ex: Venda direta balcão, perda/dano, adaptação clínica..."
                  required
                  className="h-10 rounded-xl mt-1 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Paciente Vinculado (Opcional)
                </Label>
                <Input
                  value={exitPatient}
                  onChange={(e) => setExitPatient(e.target.value)}
                  placeholder="Nome do paciente atendido"
                  className="h-10 rounded-xl mt-1 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Responsável pela Saída
                </Label>
                <Input
                  value={exitResp}
                  onChange={(e) => setExitResp(e.target.value)}
                  className="h-10 rounded-xl mt-1 text-xs"
                />
              </div>

              <DialogFooter className="pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setExitModalOpen(false)}
                  className="rounded-xl text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-semibold shadow-sm"
                >
                  Registrar Saída
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* MODAL HISTÓRICO DE MOVIMENTAÇÕES DO ITEM */}
      {selectedStockItem && (
        <Dialog open={historyModalOpen} onOpenChange={setHistoryModalOpen}>
          <DialogContent className="max-w-2xl w-full max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <DialogHeader className="border-b border-slate-100 pb-3">
              <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <History className="w-5 h-5 text-teal-600" />
                <span>Histórico de Movimentações: {selectedStockItem.name}</span>
              </DialogTitle>
              <p className="text-xs text-slate-500">
                Saldo atual: <strong>{selectedStockItem.currentQuantity} un</strong> (Mínimo:{' '}
                {selectedStockItem.minQuantity} un)
              </p>
            </DialogHeader>

            <div className="space-y-3 pt-2">
              {!selectedStockItem.movements || selectedStockItem.movements.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center bg-slate-50 rounded-xl">
                  Nenhuma movimentação registrada para este item.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {selectedStockItem.movements.map((mov) => (
                    <div
                      key={mov.id}
                      className="p-3.5 bg-white flex items-center justify-between gap-3 hover:bg-slate-50/70"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                            mov.type === 'Entrada'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}
                        >
                          {mov.type === 'Entrada' ? '+' : '-'}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900">
                            {mov.type === 'Entrada' ? 'Entrada no Estoque' : 'Saída / Baixa'}:{' '}
                            <span
                              className={
                                mov.type === 'Entrada' ? 'text-emerald-700' : 'text-red-600'
                              }
                            >
                              {mov.quantity} unidades
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {mov.reason || mov.supplier || 'Movimentação padrão'} • Resp:{' '}
                            {mov.responsible}
                          </div>
                        </div>
                      </div>

                      <span className="text-xs font-mono text-slate-500 shrink-0">
                        {formatDate(mov.date)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter className="pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                onClick={() => setHistoryModalOpen(false)}
                className="rounded-xl text-xs font-semibold"
              >
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Confirmação de Exclusão de Item */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Excluir item de estoque?"
        description={`Deseja realmente remover o item "${itemToDelete?.name}" do controle de estoque?`}
        confirmText="Excluir"
        cancelText="Cancelar"
        variant="danger"
        onConfirm={() => {
          if (itemToDelete) {
            deleteStockItem(itemToDelete.id)
            setItemToDelete(null)
          }
        }}
      />
    </div>
  )
}
