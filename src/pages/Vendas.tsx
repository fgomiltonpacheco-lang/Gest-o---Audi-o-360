import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShoppingCart,
  Plus,
  Search,
  Eye,
  Ban,
  Undo2,
  Printer,
  Calendar,
  TrendingUp,
  Receipt,
  CreditCard,
  Banknote,
  Wallet,
  Filter,
  X,
  CheckCircle,
  FileText,
  Loader2,
} from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { useToast } from '@/hooks/use-toast'
import { usePrint } from '@/components/print/PrintProvider'
import { formatCurrency, formatDate } from '@/lib/formatters'
import NfseEmitirModal from '@/components/NfseEmitirModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import type {
  Sale,
  SaleStatus,
  PDVPaymentMethod,
  SaleItem,
  Patient,
  StockItem,
  InventoryCategoria,
} from '@/types'
import { INVENTORY_CATEGORIA_LABELS } from '@/types'

const PAGE_SIZE = 10

const statusColors: Record<string, string> = {
  Pago: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Pendente: 'bg-amber-50 text-amber-700 border-amber-200',
  Cancelado: 'bg-red-50 text-red-700 border-red-200',
  Estornado: 'bg-slate-100 text-slate-600 border-slate-200',
  Concluída: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

const paymentIcon = (m: string) => {
  switch (m) {
    case 'Dinheiro':
      return <Banknote className="w-3.5 h-3.5" />
    case 'PIX':
      return <Wallet className="w-3.5 h-3.5" />
    case 'Cartão de Crédito':
    case 'Cartão de Débito':
    case 'Cartão':
      return <CreditCard className="w-3.5 h-3.5" />
    default:
      return <Receipt className="w-3.5 h-3.5" />
  }
}

export default function Vendas() {
  const navigate = useNavigate()
  const {
    sales,
    currentUser,
    cancelSale,
    addSale,
    updateSale,
    patients,
    stockItems,
    baixarEstoqueVenda,
    nfseEmitidas,
  } = useApp()
  const { toast } = useToast()
  const { print } = usePrint()

  const [page, setPage] = useState(1)
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [filterPatient, setFilterPatient] = useState('all')
  const [filterPayment, setFilterPayment] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [showFilters, setShowFilters] = useState(false)
  const [detailSale, setDetailSale] = useState<Sale | null>(null)
  const [cancelTarget, setCancelTarget] = useState<Sale | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelMode, setCancelMode] = useState<'Cancelado' | 'Estornado'>('Cancelado')
  const [nfEmitirSale, setNfEmitirSale] = useState<Sale | null>(null)

  const isAdmin = currentUser?.role === 'admin'

  // ---- Nova Venda (modal simplificado) ----
  interface NvSelectedItem {
    key: string
    stockItemId: string
    name: string
    categoria?: InventoryCategoria
    quantity: number
    unitPrice: number
    currentQuantity: number
    isService: boolean
  }

  const [newSaleOpen, setNewSaleOpen] = useState(false)
  const [savingNewSale, setSavingNewSale] = useState(false)
  const [nvPatientQuery, setNvPatientQuery] = useState('')
  const [nvPatient, setNvPatient] = useState<Patient | null>(null)
  const [nvSelectedItems, setNvSelectedItems] = useState<NvSelectedItem[]>([])
  const [nvItemQuery, setNvItemQuery] = useState('')
  const [nvItemSearchOpen, setNvItemSearchOpen] = useState(false)
  const [nvPayment, setNvPayment] = useState<PDVPaymentMethod>('Dinheiro')
  const [nvInstallments, setNvInstallments] = useState('1')
  const [nvNotes, setNvNotes] = useState('')
  const [nvShowSuggestions, setNvShowSuggestions] = useState(false)

  // ---- Finalizar como Paga (sub-modal) ----
  const [payOpen, setPayOpen] = useState(false)
  const [paySaving, setPaySaving] = useState(false)
  const [payForma, setPayForma] = useState('Dinheiro')
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0])
  const [payNotes, setPayNotes] = useState('')

  // ---- Resumo do dia ----
  const todayStr = new Date().toISOString().split('T')[0]
  const todaySales = useMemo(
    () =>
      sales.filter(
        (s) =>
          (s.date || s.createdAt || '').slice(0, 10) === todayStr &&
          s.status !== 'Cancelado' &&
          s.status !== 'Estornado',
      ),
    [sales, todayStr],
  )
  const todayTotal = todaySales.reduce((acc, s) => acc + (s.totalValue || 0), 0)
  const todayCount = todaySales.length
  const avgTicket = todayCount > 0 ? todayTotal / todayCount : 0

  const byPayment = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {}
    todaySales.forEach((s) => {
      const k = s.paymentMethod || 'Outro'
      if (!map[k]) map[k] = { count: 0, total: 0 }
      map[k].count += 1
      map[k].total += s.totalValue || 0
    })
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total)
  }, [todaySales])

  // ---- Filtros ----
  const filtered = useMemo(() => {
    return sales
      .filter((s) => {
        if (filterDateFrom && (s.date || s.createdAt || '').slice(0, 10) < filterDateFrom)
          return false
        if (filterDateTo && (s.date || s.createdAt || '').slice(0, 10) > filterDateTo) return false
        if (filterPatient !== 'all') {
          if (s.patientId !== filterPatient && s.patientName !== filterPatient) return false
        }
        if (filterPayment !== 'all' && s.paymentMethod !== filterPayment) return false
        if (filterStatus !== 'all' && s.status !== filterStatus) return false
        return true
      })
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  }, [sales, filterDateFrom, filterDateTo, filterPatient, filterPayment, filterStatus])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const effectivePage = Math.min(page, totalPages)

  const clearFilters = () => {
    setFilterDateFrom('')
    setFilterDateTo('')
    setFilterPatient('all')
    setFilterPayment('all')
    setFilterStatus('all')
    setPage(1)
  }
  const hasFilters =
    filterDateFrom ||
    filterDateTo ||
    filterPatient !== 'all' ||
    filterPayment !== 'all' ||
    filterStatus !== 'all'

  // ---- Detalhes / comprovante ----
  const handlePrint = (sale: Sale) => {
    const items: SaleItem[] =
      Array.isArray(sale.items) && sale.items.length > 0
        ? sale.items
        : sale.itemsDescription
          ? sale.itemsDescription.split(', ').map((desc, i) => {
              const m = desc.match(/^(\d+)x\s+(.*)$/)
              return {
                id: `desc-${i}`,
                name: m ? m[2] : desc,
                type: 'inventory' as const,
                quantity: m ? Number(m[1]) : 1,
                unitPrice: sale.totalValue,
                subtotal: sale.totalValue,
              }
            })
          : []
    print({
      title: `Comprovante de Venda #${sale.number}`,
      subtitle: `Data: ${formatDate(sale.date || sale.createdAt)}`,
      body: (
        <div className="space-y-4" style={{ fontSize: '11pt' }}>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <strong>Venda Nº:</strong> #{sale.number}
            </div>
            <div>
              <strong>Cliente:</strong> {sale.patientName || 'Venda avulsa'}
            </div>
            <div>
              <strong>Pagamento:</strong> {sale.paymentMethod}
            </div>
            <div>
              <strong>Status:</strong> {sale.status}
            </div>
          </div>
          {items.length > 0 && (
            <table className="w-full text-left border-collapse" style={{ fontSize: '10pt' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #cbd5e1' }}>
                  <th className="py-1.5">Item</th>
                  <th className="py-1.5 text-center">Qtd</th>
                  <th className="py-1.5 text-right">Unit.</th>
                  <th className="py-1.5 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td className="py-1.5">{it.name}</td>
                    <td className="py-1.5 text-center">{it.quantity}</td>
                    <td className="py-1.5 text-right">{formatCurrency(it.unitPrice)}</td>
                    <td className="py-1.5 text-right">{formatCurrency(it.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="flex justify-end">
            <div className="w-64 space-y-1 text-sm">
              {sale.subtotal != null && (
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(sale.subtotal)}</span>
                </div>
              )}
              {sale.discountValue != null && sale.discountValue > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Desconto:</span>
                  <span>- {formatCurrency(sale.discountValue)}</span>
                </div>
              )}
              <div
                className="flex justify-between font-extrabold text-base border-t pt-1"
                style={{ borderTop: '1px solid #0F2B5C' }}
              >
                <span>Total:</span>
                <span>{formatCurrency(sale.totalValue)}</span>
              </div>
            </div>
          </div>
        </div>
      ),
    })
  }

  const handleCancel = () => {
    if (!cancelTarget) return
    if (!cancelReason.trim()) {
      toast({ title: 'Justificativa obrigatória', variant: 'destructive' })
      return
    }
    cancelSale(cancelTarget.id, cancelReason.trim(), cancelMode)
    setCancelTarget(null)
    setCancelReason('')
    setDetailSale(null)
  }

  // ---- Autocomplete de paciente (Nova Venda) ----
  const patientSuggestions = useMemo(() => {
    const q = nvPatientQuery.trim().toLowerCase()
    if (!q) return []
    return patients.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 6)
  }, [patients, nvPatientQuery])

  // ---- Autocomplete de itens do estoque (Nova Venda) ----
  // Busca case-insensitive por correspondência parcial no nome,
  // no código (code) e no SKU do item de estoque.
  const itemSuggestions = useMemo(() => {
    const q = nvItemQuery.trim().toLowerCase()
    if (!q) return []
    return stockItems
      .filter((it) => {
        const name = (it.name || '').toLowerCase()
        const code = (it.code || '').toLowerCase()
        const sku = (it.sku || '').toLowerCase()
        return name.includes(q) || code.includes(q) || sku.includes(q)
      })
      .slice(0, 8)
  }, [stockItems, nvItemQuery])

  const nvTotal = useMemo(
    () => nvSelectedItems.reduce((acc, it) => acc + (it.quantity || 0) * (it.unitPrice || 0), 0),
    [nvSelectedItems],
  )

  const addNvItem = (item: StockItem) => {
    const isService = item.categoria === 'servico'
    // se já existe, soma 1 à quantidade
    setNvSelectedItems((prev) => {
      const existing = prev.find((p) => p.stockItemId === item.id)
      if (existing) {
        return prev.map((p) => (p.stockItemId === item.id ? { ...p, quantity: p.quantity + 1 } : p))
      }
      return [
        ...prev,
        {
          key: crypto.randomUUID(),
          stockItemId: item.id,
          name: item.name,
          categoria: item.categoria,
          quantity: 1,
          unitPrice: item.salePrice,
          currentQuantity: item.currentQuantity,
          isService,
        },
      ]
    })
    setNvItemQuery('')
    setNvItemSearchOpen(false)
  }

  const updateNvItem = (key: string, patch: Partial<NvSelectedItem>) => {
    setNvSelectedItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)))
  }

  const removeNvItem = (key: string) => {
    setNvSelectedItems((prev) => prev.filter((it) => it.key !== key))
  }

  const resetNewSaleForm = () => {
    setNvPatientQuery('')
    setNvPatient(null)
    setNvSelectedItems([])
    setNvItemQuery('')
    setNvItemSearchOpen(false)
    setNvPayment('Dinheiro')
    setNvInstallments('1')
    setNvNotes('')
    setNvShowSuggestions(false)
  }

  const openNewSale = () => {
    resetNewSaleForm()
    setNewSaleOpen(true)
  }

  const handleSaveNewSale = () => {
    if (nvSelectedItems.length === 0) {
      toast({ title: 'Adicione ao menos um item do estoque.', variant: 'destructive' })
      return
    }
    if (!nvTotal || nvTotal <= 0) {
      toast({ title: 'Valor total inválido. Verifique os itens.', variant: 'destructive' })
      return
    }
    const items: SaleItem[] = nvSelectedItems.map((it) => ({
      id: it.key,
      name: it.name,
      type: it.isService ? 'procedure' : 'inventory',
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      subtotal: it.quantity * it.unitPrice,
      stockItemId: it.stockItemId,
    }))
    const itemsDescription = nvSelectedItems.map((it) => `${it.quantity}x ${it.name}`).join(', ')
    const total = nvTotal
    const installments = nvPayment === 'Parcelado' ? Math.max(1, Number(nvInstallments) || 1) : 1
    setSavingNewSale(true)
    try {
      addSale({
        type: 'PDV',
        patientId: nvPatient?.id || '',
        patientName: nvPatient?.name || 'Venda avulsa',
        items,
        itemsDescription,
        totalValue: total,
        paymentMethod: nvPayment,
        installmentsCount: installments,
        interestPercent: 0,
        firstDueDate: new Date().toISOString().split('T')[0],
        status: 'Pendente',
        date: new Date().toISOString(),
        subtotal: total,
        discountValue: 0,
        discountPercent: 0,
        cancelReason: '',
      })
      toast({
        title: 'Venda registrada com sucesso!',
        description: nvPatient ? `Cliente: ${nvPatient.name}` : 'Venda avulsa.',
      })
      setSavingNewSale(false)
      setNewSaleOpen(false)
      resetNewSaleForm()
    } catch (err) {
      setSavingNewSale(false)
      toast({ title: 'Erro ao registrar venda.', variant: 'destructive' })
    }
  }

  // ---- Finalizar como Paga ----
  const openPayModal = (sale: Sale) => {
    // Default: mapeia a forma de pagamento da venda para uma forma de recebimento
    const mapDefault: Record<string, string> = {
      Dinheiro: 'Dinheiro',
      PIX: 'PIX',
      'Cartão de Crédito': 'Cartão',
      'Cartão de Débito': 'Cartão',
      Cartão: 'Cartão',
      Convênio: 'Transferência',
      Boleto: 'Transferência',
    }
    setPayForma(mapDefault[sale.paymentMethod] || 'Dinheiro')
    setPayDate(new Date().toISOString().split('T')[0])
    setPayNotes('')
    setPayOpen(true)
  }

  const handleConfirmPayment = () => {
    if (!detailSale) return
    setPaySaving(true)
    try {
      const notes = payNotes
        ? `Forma de recebimento: ${payForma}. ${payNotes}`
        : `Forma de recebimento: ${payForma}.`
      // Atualiza status para Pago e dispara a baixa de estoque
      // (idempotente: só baixa uma vez, controlado por estoqueBaixado).
      const updatedSale: Sale = {
        ...detailSale,
        status: 'Pago',
        paymentDate: payDate,
        paymentNotes: notes,
      }
      updateSale(detailSale.id, {
        status: 'Pago',
        paymentDate: payDate,
        paymentNotes: notes,
      })
      try {
        baixarEstoqueVenda(updatedSale)
      } catch (err) {
        console.error('Erro ao baixar estoque da venda:', err)
        toast({
          title: 'Aviso',
          description: 'Venda finalizada, mas houve erro na baixa de estoque. Verifique o estoque.',
          variant: 'destructive',
        })
      }
      toast({
        title: `Venda #${detailSale.number} finalizada como Paga!`,
        description: `Recebimento: ${payForma} em ${formatDate(payDate)}.`,
      })
      // atualiza o detailSale em tela
      setDetailSale(updatedSale)
      setPaySaving(false)
      setPayOpen(false)
    } catch (err) {
      setPaySaving(false)
      toast({ title: 'Erro ao finalizar venda.', variant: 'destructive' })
    }
  }

  // Mapa de status da NFS-e por saleId para exibir badge na tabela.
  // Prioridade: autorizada/enviada > cancelada > pendente/erro.
  const nfStatusPorSaleId = useMemo(() => {
    const m: Record<string, 'emitida' | 'pendente' | 'cancelada'> = {}
    const rank: Record<string, number> = {
      autorizada: 4,
      enviada: 3,
      pendente: 2,
      erro: 1,
      cancelada: 0,
    }
    nfseEmitidas.forEach((n) => {
      if (!n.sale) return
      const cur = m[n.sale]
      const novoStatus: 'emitida' | 'pendente' | 'cancelada' =
        n.status === 'autorizada' || n.status === 'enviada'
          ? 'emitida'
          : n.status === 'cancelada'
            ? 'cancelada'
            : 'pendente'
      const novoRank = rank[n.status] ?? 0
      const curRank = cur
        ? rank[cur === 'emitida' ? 'autorizada' : cur === 'cancelada' ? 'cancelada' : 'pendente']
        : -1
      if (curRank < novoRank) {
        m[n.sale] = novoStatus
      }
    })
    return m
  }, [nfseEmitidas])

  const nfBadgeConfig: Record<string, { label: string; className: string }> = {
    emitida: {
      label: 'NF Emitida',
      className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    pendente: {
      label: 'NF Pendente',
      className: 'bg-slate-100 text-slate-600 border-slate-200',
    },
    cancelada: {
      label: 'NF Cancelada',
      className: 'bg-red-50 text-red-700 border-red-200',
    },
  }

  return (
    <div className="space-y-5 animate-in fade-in-50 duration-200">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-teal-50 flex items-center justify-center">
            <ShoppingCart className="w-6 h-6 text-teal-600" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Vendas</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Histórico de vendas — PDV e atendimentos
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={openNewSale}
            variant="outline"
            className="rounded-xl text-sm border-teal-200 text-teal-700 hover:bg-teal-50"
          >
            <Plus className="w-4 h-4 mr-1.5" /> Nova Venda
          </Button>
          {isAdmin && (
            <Button
              onClick={() => navigate('/vendas/pdv')}
              className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-sm shadow-sm"
            >
              <Plus className="w-4 h-4 mr-1.5" /> Novo PDV
            </Button>
          )}
        </div>
      </div>

      {/* Resumo do dia */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Total Hoje
              </p>
              <p className="text-xl font-extrabold text-teal-700 mt-1">
                {formatCurrency(todayTotal)}
              </p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-teal-600" />
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Vendas Hoje
              </p>
              <p className="text-xl font-extrabold text-slate-900 mt-1">{todayCount}</p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
              <Receipt className="w-4 h-4 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Ticket Médio
              </p>
              <p className="text-xl font-extrabold text-slate-900 mt-1">
                {formatCurrency(avgTicket)}
              </p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-amber-600" />
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            Formas de Pagamento
          </p>
          {byPayment.length === 0 ? (
            <p className="text-xs text-slate-400">Sem vendas hoje</p>
          ) : (
            <div className="space-y-0.5">
              {byPayment.slice(0, 3).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1 text-slate-600">
                    {paymentIcon(k)} {k}
                  </span>
                  <span className="font-semibold text-slate-800">{formatCurrency(v.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setShowFilters((v) => !v)}
            className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 hover:text-teal-600"
          >
            <Filter className="w-4 h-4" /> Filtros
            {hasFilters && <Badge className="bg-teal-100 text-teal-700 ml-1">Ativos</Badge>}
          </button>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-7 text-xs text-slate-500"
            >
              <X className="w-3 h-3 mr-1" /> Limpar
            </Button>
          )}
        </div>
        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 pt-2 border-t border-slate-100">
            <div>
              <Label className="text-[11px] text-slate-500 mb-1 block">De</Label>
              <Input
                type="date"
                value={filterDateFrom}
                onChange={(e) => {
                  setFilterDateFrom(e.target.value)
                  setPage(1)
                }}
                className="h-9 rounded-lg text-sm"
              />
            </div>
            <div>
              <Label className="text-[11px] text-slate-500 mb-1 block">Até</Label>
              <Input
                type="date"
                value={filterDateTo}
                onChange={(e) => {
                  setFilterDateTo(e.target.value)
                  setPage(1)
                }}
                className="h-9 rounded-lg text-sm"
              />
            </div>
            <div>
              <Label className="text-[11px] text-slate-500 mb-1 block">Paciente</Label>
              <Input
                value={filterPatient === 'all' ? '' : filterPatient}
                onChange={(e) => {
                  setFilterPatient(e.target.value || 'all')
                  setPage(1)
                }}
                placeholder="Nome do paciente"
                className="h-9 rounded-lg text-sm"
              />
            </div>
            <div>
              <Label className="text-[11px] text-slate-500 mb-1 block">Pagamento</Label>
              <Select
                value={filterPayment}
                onValueChange={(v) => {
                  setFilterPayment(v)
                  setPage(1)
                }}
              >
                <SelectTrigger className="h-9 rounded-lg text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="Cartão de Débito">Cartão de Débito</SelectItem>
                  <SelectItem value="Cartão de Crédito">Cartão de Crédito</SelectItem>
                  <SelectItem value="PIX">PIX</SelectItem>
                  <SelectItem value="Convênio">Convênio</SelectItem>
                  <SelectItem value="Boleto">Boleto</SelectItem>
                  <SelectItem value="À vista">À vista</SelectItem>
                  <SelectItem value="Parcelado">Parcelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11px] text-slate-500 mb-1 block">Status</Label>
              <Select
                value={filterStatus}
                onValueChange={(v) => {
                  setFilterStatus(v)
                  setPage(1)
                }}
              >
                <SelectTrigger className="h-9 rounded-lg text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="Pago">Pago</SelectItem>
                  <SelectItem value="Pendente">Pendente</SelectItem>
                  <SelectItem value="Cancelado">Cancelado</SelectItem>
                  <SelectItem value="Estornado">Estornado</SelectItem>
                  <SelectItem value="Concluída">Concluída</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* Tabela de vendas */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr className="text-left">
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">Venda</th>
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">Data</th>
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">Itens</th>
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">
                  Pagamento
                </th>
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-right">
                  Total
                </th>
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-right">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                    <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    Nenhuma venda encontrada.
                  </td>
                </tr>
              ) : (
                paged.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900">#{s.number}</div>
                      {s.type === 'PDV' && (
                        <Badge className="bg-teal-50 text-teal-700 border-teal-200 mt-0.5 text-[10px]">
                          PDV
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {formatDate(s.date || s.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-slate-700 max-w-[180px] truncate">
                      {s.patientName || 'Venda avulsa'}
                    </td>
                    <td
                      className="px-4 py-3 text-slate-500 text-xs max-w-[200px] truncate"
                      title={s.itemsDescription}
                    >
                      {s.itemsDescription || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-slate-600 text-xs">
                        {paymentIcon(s.paymentMethod)} {s.paymentMethod}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900 whitespace-nowrap">
                      {formatCurrency(s.totalValue)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 flex-wrap">
                        <Badge
                          className={
                            statusColors[s.status] || 'bg-slate-100 text-slate-600 border-slate-200'
                          }
                          variant="outline"
                        >
                          {s.status}
                        </Badge>
                        {nfStatusPorSaleId[s.id] &&
                          (() => {
                            const cfg = nfBadgeConfig[nfStatusPorSaleId[s.id]]
                            return (
                              <Badge
                                className={`${cfg.className} text-[10px]`}
                                variant="outline"
                                title={`NFS-e ${cfg.label}`}
                              >
                                {cfg.label}
                              </Badge>
                            )
                          })()}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setDetailSale(s)}
                          title="Ver detalhes"
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handlePrint(s)}
                          title="Imprimir comprovante"
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        {isAdmin && s.status !== 'Cancelado' && s.status !== 'Estornado' && (
                          <button
                            onClick={() => {
                              setCancelTarget(s)
                              setCancelMode('Cancelado')
                              setCancelReason('')
                            }}
                            title="Cancelar / Estornar"
                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-xs text-slate-500">
            <span>
              Mostrando {(effectivePage - 1) * PAGE_SIZE + 1}–
              {Math.min(effectivePage * PAGE_SIZE, filtered.length)} de {filtered.length}
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={effectivePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-7 rounded-lg"
              >
                Anterior
              </Button>
              <span className="px-2 py-1 font-semibold text-slate-700">
                {effectivePage}/{totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={effectivePage >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="h-7 rounded-lg"
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Detalhe da venda */}
      <Dialog open={!!detailSale} onOpenChange={(o) => !o && setDetailSale(null)}>
        <DialogContent className="max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
          <DialogHeader className="border-b border-slate-100 pb-3">
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-teal-600" />
              Venda #{detailSale?.number}
            </DialogTitle>
          </DialogHeader>
          {detailSale && (
            <div className="space-y-3 pt-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-500">Data:</span>{' '}
                  <strong className="text-slate-800">
                    {formatDate(detailSale.date || detailSale.createdAt)}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500">Tipo:</span>{' '}
                  <strong className="text-slate-800">
                    {detailSale.type === 'PDV' ? 'PDV' : 'Atendimento'}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500">Cliente:</span>{' '}
                  <strong className="text-slate-800">
                    {detailSale.patientName || 'Venda avulsa'}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500">Pagamento:</span>{' '}
                  <strong className="text-slate-800">{detailSale.paymentMethod}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Status:</span>{' '}
                  <Badge className={statusColors[detailSale.status]} variant="outline">
                    {detailSale.status}
                  </Badge>
                </div>
                {detailSale.installmentsCount > 1 && (
                  <div>
                    <span className="text-slate-500">Parcelas:</span>{' '}
                    <strong className="text-slate-800">{detailSale.installmentsCount}x</strong>
                  </div>
                )}
              </div>

              {/* Itens */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Itens
                </div>
                {Array.isArray(detailSale.items) && detailSale.items.length > 0 ? (
                  <table className="w-full text-xs">
                    <thead className="text-slate-500">
                      <tr className="border-b border-slate-100">
                        <th className="px-3 py-1.5 text-left font-medium">Item</th>
                        <th className="px-3 py-1.5 text-center font-medium">Qtd</th>
                        <th className="px-3 py-1.5 text-right font-medium">Unit.</th>
                        <th className="px-3 py-1.5 text-right font-medium">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailSale.items.map((it, i) => (
                        <tr key={i} className="border-b border-slate-50 last:border-0">
                          <td className="px-3 py-1.5 text-slate-700">{it.name}</td>
                          <td className="px-3 py-1.5 text-center text-slate-600">{it.quantity}</td>
                          <td className="px-3 py-1.5 text-right text-slate-600">
                            {formatCurrency(it.unitPrice)}
                          </td>
                          <td className="px-3 py-1.5 text-right font-semibold text-slate-800">
                            {formatCurrency(it.subtotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-3 text-xs text-slate-600">
                    {detailSale.itemsDescription || 'Sem detalhamento de itens.'}
                  </div>
                )}
              </div>

              {/* Totais */}
              <div className="space-y-1">
                {detailSale.subtotal != null && (
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Subtotal</span>
                    <span>{formatCurrency(detailSale.subtotal)}</span>
                  </div>
                )}
                {detailSale.discountValue != null && detailSale.discountValue > 0 && (
                  <div className="flex justify-between text-xs text-red-600">
                    <span>
                      Desconto
                      {detailSale.discountPercent ? ` (${detailSale.discountPercent}%)` : ''}
                    </span>
                    <span>- {formatCurrency(detailSale.discountValue)}</span>
                  </div>
                )}
                <div className="flex justify-between font-extrabold text-base text-teal-700 pt-1 border-t border-dashed border-slate-200">
                  <span>Total</span>
                  <span>{formatCurrency(detailSale.totalValue)}</span>
                </div>
              </div>

              {detailSale.paymentDate && detailSale.status === 'Pago' && (
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-100 text-xs text-emerald-700">
                  <strong>Recebimento:</strong> {formatDate(detailSale.paymentDate)}
                  {detailSale.paymentNotes && (
                    <div className="mt-0.5 text-emerald-600">{detailSale.paymentNotes}</div>
                  )}
                </div>
              )}
              {detailSale.cancelReason && (
                <div className="p-2.5 rounded-lg bg-red-50 border border-red-100 text-xs text-red-700">
                  <strong>{detailSale.status}:</strong> {detailSale.cancelReason}
                </div>
              )}
            </div>
          )}
          <DialogFooter className="pt-2 border-t border-slate-100 flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => handlePrint(detailSale!)}
              className="rounded-xl text-xs"
            >
              <Printer className="w-3.5 h-3.5 mr-1.5" /> Imprimir
            </Button>

            {/* Finalizar como Paga — visível para todos quando Pendente */}
            {detailSale && detailSale.status === 'Pendente' && (
              <Button
                onClick={() => openPayModal(detailSale)}
                className="rounded-xl text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> Finalizar como Paga
              </Button>
            )}

            {/* Emitir NF — visível para todos quando Pago ou Concluída */}
            {detailSale && (detailSale.status === 'Pago' || detailSale.status === 'Concluída') && (
              <Button
                onClick={() => setNfEmitirSale(detailSale)}
                className="rounded-xl text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                <FileText className="w-3.5 h-3.5 mr-1.5" /> Emitir NF
              </Button>
            )}

            {/* Cancelar / Estornar — apenas Admin */}
            {isAdmin &&
              detailSale &&
              detailSale.status !== 'Cancelado' &&
              detailSale.status !== 'Estornado' && (
                <Button
                  onClick={() => {
                    setCancelTarget(detailSale)
                    setCancelMode('Cancelado')
                    setCancelReason('')
                  }}
                  className="rounded-xl text-xs bg-red-500 hover:bg-red-600 text-white"
                >
                  <Ban className="w-3.5 h-3.5 mr-1.5" /> Cancelar / Estornar
                </Button>
              )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nova Venda (modal simplificado) */}
      <Dialog open={newSaleOpen} onOpenChange={(o) => !o && setNewSaleOpen(false)}>
        <DialogContent className="max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
          <DialogHeader className="border-b border-slate-100 pb-3">
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-teal-600" />
              Nova Venda
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            {/* Paciente (autocomplete) */}
            <div className="relative">
              <Label className="text-xs font-semibold text-slate-600 mb-1 block">
                Paciente <span className="text-slate-400 font-normal">(opcional)</span>
              </Label>
              <Input
                value={nvPatient ? nvPatient.name : nvPatientQuery}
                onChange={(e) => {
                  setNvPatientQuery(e.target.value)
                  setNvPatient(null)
                  setNvShowSuggestions(true)
                }}
                onFocus={() => setNvShowSuggestions(true)}
                onBlur={() => setTimeout(() => setNvShowSuggestions(false), 150)}
                placeholder="Buscar paciente pelo nome..."
                className="h-9 rounded-lg text-sm"
              />
              {nvShowSuggestions && patientSuggestions.length > 0 && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                  {patientSuggestions.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        setNvPatient(p)
                        setNvPatientQuery(p.name)
                        setNvShowSuggestions(false)
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-teal-50 border-b border-slate-50 last:border-0"
                    >
                      <div className="font-medium">{p.name}</div>
                      <div className="text-[11px] text-slate-400">
                        {p.cpf ? `CPF: ${p.cpf}` : ''} {p.mobile ? `· ${p.mobile}` : ''}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {nvPatient && (
                <button
                  type="button"
                  onClick={() => {
                    setNvPatient(null)
                    setNvPatientQuery('')
                  }}
                  className="absolute right-2 top-7 text-slate-400 hover:text-red-500"
                  title="Limpar paciente"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              {!nvPatient && (
                <p className="text-[11px] text-slate-400 mt-1">
                  Deixe em branco para registrar como “Venda avulsa”.
                </p>
              )}
            </div>

            {/* Itens — busca no estoque */}
            <div>
              <Label className="text-xs font-semibold text-slate-600 mb-1 block">
                Itens <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
                <Input
                  value={nvItemQuery}
                  onChange={(e) => {
                    setNvItemQuery(e.target.value)
                    setNvItemSearchOpen(true)
                  }}
                  onFocus={() => setNvItemSearchOpen(true)}
                  onBlur={() => setTimeout(() => setNvItemSearchOpen(false), 150)}
                  placeholder="Buscar item por nome, código ou SKU..."
                  className="h-9 rounded-lg text-sm pl-8"
                />
                {nvItemSearchOpen && itemSuggestions.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {itemSuggestions.map((it) => {
                      const isService = it.categoria === 'servico'
                      const catLabel = it.categoria
                        ? INVENTORY_CATEGORIA_LABELS[it.categoria]
                        : it.category
                      return (
                        <button
                          key={it.id}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault()
                            addNvItem(it)
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-teal-50 border-b border-slate-50 last:border-0 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="font-medium truncate">
                              {it.name}
                              {(it.code || it.sku) && (
                                <span className="ml-1.5 text-[10px] font-normal text-slate-400">
                                  [{it.code || it.sku}]
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0 ${
                                  isService
                                    ? 'bg-violet-50 text-violet-700 border-violet-200'
                                    : 'bg-slate-50 text-slate-600 border-slate-200'
                                }`}
                              >
                                {catLabel}
                              </Badge>
                              {!isService && (
                                <span className="text-[11px] text-slate-400">
                                  Estoque: {it.currentQuantity}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="font-semibold text-teal-700 whitespace-nowrap">
                            {formatCurrency(it.salePrice)}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
                {nvItemSearchOpen && nvItemQuery.trim() && itemSuggestions.length === 0 && (
                  <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs text-slate-400">
                    Nenhum item encontrado no estoque.
                  </div>
                )}
              </div>
            </div>

            {/* Tabela de itens selecionados */}
            {nvSelectedItems.length > 0 && (
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Itens da Venda
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-slate-500 bg-white">
                      <tr className="border-b border-slate-100">
                        <th className="px-2 py-1.5 text-left font-medium">Item</th>
                        <th className="px-2 py-1.5 text-center font-medium w-16">Qtd</th>
                        <th className="px-2 py-1.5 text-right font-medium w-24">Unitário</th>
                        <th className="px-2 py-1.5 text-right font-medium w-24">Subtotal</th>
                        <th className="px-2 py-1.5 w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {nvSelectedItems.map((it) => {
                        const insufficient = !it.isService && it.quantity > it.currentQuantity
                        return (
                          <tr
                            key={it.key}
                            className="border-b border-slate-50 last:border-0 align-middle"
                          >
                            <td className="px-2 py-1.5 text-slate-700">
                              <div className="font-medium leading-tight">{it.name}</div>
                              <div className="flex items-center gap-1 mt-0.5">
                                <Badge
                                  variant="outline"
                                  className={`text-[9px] px-1 py-0 ${
                                    it.isService
                                      ? 'bg-violet-50 text-violet-700 border-violet-200'
                                      : 'bg-slate-50 text-slate-600 border-slate-200'
                                  }`}
                                >
                                  {it.categoria
                                    ? INVENTORY_CATEGORIA_LABELS[it.categoria]
                                    : it.name}
                                </Badge>
                                {insufficient && (
                                  <span className="text-[10px] text-red-600 font-medium">
                                    Estoque insuficiente ({it.currentQuantity})
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              <Input
                                type="number"
                                min="1"
                                step="1"
                                value={it.quantity}
                                onChange={(e) =>
                                  updateNvItem(it.key, {
                                    quantity: Math.max(1, Number(e.target.value) || 1),
                                  })
                                }
                                className="h-7 rounded-md text-xs text-center px-1 w-14"
                              />
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={it.unitPrice}
                                onChange={(e) =>
                                  updateNvItem(it.key, {
                                    unitPrice: Math.max(0, Number(e.target.value) || 0),
                                  })
                                }
                                className="h-7 rounded-md text-xs text-right px-1 w-22"
                              />
                            </td>
                            <td className="px-2 py-1.5 text-right font-semibold text-slate-800 whitespace-nowrap">
                              {formatCurrency(it.quantity * it.unitPrice)}
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              <button
                                type="button"
                                onClick={() => removeNvItem(it.key)}
                                className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50"
                                title="Remover item"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Valor Total + Forma de Pagamento */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-600 mb-1 block">
                  Valor Total (R$)
                </Label>
                <div className="h-9 rounded-lg text-sm border border-slate-200 bg-slate-50 flex items-center px-3 font-extrabold text-teal-700">
                  {formatCurrency(nvTotal)}
                </div>
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-600 mb-1 block">
                  Forma de Pagamento
                </Label>
                <Select
                  value={nvPayment}
                  onValueChange={(v) => setNvPayment(v as PDVPaymentMethod)}
                >
                  <SelectTrigger className="h-9 rounded-lg text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="Cartão de Débito">Cartão de Débito</SelectItem>
                    <SelectItem value="Cartão de Crédito">Cartão de Crédito</SelectItem>
                    <SelectItem value="PIX">PIX</SelectItem>
                    <SelectItem value="Convênio">Convênio</SelectItem>
                    <SelectItem value="Boleto">Boleto</SelectItem>
                    <SelectItem value="À vista">À vista</SelectItem>
                    <SelectItem value="Parcelado">Parcelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Número de Parcelas — só se Parcelado */}
            {nvPayment === 'Parcelado' && (
              <div>
                <Label className="text-xs font-semibold text-slate-600 mb-1 block">
                  Número de Parcelas
                </Label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={nvInstallments}
                  onChange={(e) => setNvInstallments(e.target.value)}
                  className="h-9 rounded-lg text-sm"
                />
              </div>
            )}

            {/* Observações */}
            <div>
              <Label className="text-xs font-semibold text-slate-600 mb-1 block">
                Observações <span className="text-slate-400 font-normal">(opcional)</span>
              </Label>
              <Textarea
                value={nvNotes}
                onChange={(e) => setNvNotes(e.target.value)}
                placeholder="Observações sobre a venda..."
                className="rounded-xl text-sm min-h-[60px]"
              />
            </div>
          </div>
          <DialogFooter className="pt-2 border-t border-slate-100">
            <Button
              variant="outline"
              onClick={() => setNewSaleOpen(false)}
              disabled={savingNewSale}
              className="rounded-xl text-xs"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveNewSale}
              disabled={savingNewSale}
              className="rounded-xl text-xs bg-teal-500 hover:bg-teal-600 text-white"
            >
              {savingNewSale ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Salvando...
                </>
              ) : (
                <>
                  <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> Registrar Venda
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar Pagamento (Finalizar como Paga) */}
      <Dialog open={payOpen} onOpenChange={(o) => !o && setPayOpen(false)}>
        <DialogContent className="max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
          <DialogHeader className="border-b border-slate-100 pb-3">
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              Confirmar Pagamento
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Valor Total
              </div>
              <div className="text-xl font-extrabold text-emerald-700">
                {detailSale ? formatCurrency(detailSale.totalValue) : '-'}
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-600 mb-1 block">
                Forma de Recebimento
              </Label>
              <Select value={payForma} onValueChange={setPayForma}>
                <SelectTrigger className="h-9 rounded-lg text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="Cartão">Cartão</SelectItem>
                  <SelectItem value="PIX">PIX</SelectItem>
                  <SelectItem value="Transferência">Transferência</SelectItem>
                  <SelectItem value="Cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-600 mb-1 block">
                Data do Recebimento
              </Label>
              <Input
                type="date"
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
                className="h-9 rounded-lg text-sm"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-600 mb-1 block">
                Observações <span className="text-slate-400 font-normal">(opcional)</span>
              </Label>
              <Textarea
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                placeholder="Observações sobre o recebimento..."
                className="rounded-xl text-sm min-h-[60px]"
              />
            </div>
          </div>
          <DialogFooter className="pt-2 border-t border-slate-100">
            <Button
              variant="outline"
              onClick={() => setPayOpen(false)}
              disabled={paySaving}
              className="rounded-xl text-xs"
            >
              Voltar
            </Button>
            <Button
              onClick={handleConfirmPayment}
              disabled={paySaving}
              className="rounded-xl text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {paySaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Confirmando...
                </>
              ) : (
                <>
                  <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> Confirmar Pagamento
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancelar / Estornar */}
      <Dialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <DialogContent className="max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
          <DialogHeader className="border-b border-slate-100 pb-3">
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Undo2 className="w-5 h-5 text-red-500" />
              Cancelar / Estornar Venda #{cancelTarget?.number}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="flex gap-2">
              <button
                onClick={() => setCancelMode('Cancelado')}
                className={`flex-1 p-2.5 rounded-xl border text-xs font-semibold ${cancelMode === 'Cancelado' ? 'border-red-300 bg-red-50 text-red-700' : 'border-slate-200 text-slate-600'}`}
              >
                Cancelar
              </button>
              <button
                onClick={() => setCancelMode('Estornado')}
                className={`flex-1 p-2.5 rounded-xl border text-xs font-semibold ${cancelMode === 'Estornado' ? 'border-slate-400 bg-slate-100 text-slate-800' : 'border-slate-200 text-slate-600'}`}
              >
                Estornar
              </button>
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-600 mb-1 block">
                Justificativa *
              </Label>
              <Textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Informe o motivo do cancelamento/estorno..."
                className="rounded-xl text-sm min-h-[80px]"
              />
            </div>
            <p className="text-[11px] text-slate-500 flex items-start gap-1.5">
              <Undo2 className="w-3 h-3 shrink-0 mt-0.5" />
              Os itens de estoque serão devolvidos automaticamente ao saldo.
            </p>
          </div>
          <DialogFooter className="pt-2 border-t border-slate-100">
            <Button
              variant="outline"
              onClick={() => setCancelTarget(null)}
              className="rounded-xl text-xs"
            >
              Voltar
            </Button>
            <Button
              onClick={handleCancel}
              className="rounded-xl text-xs bg-red-500 hover:bg-red-600 text-white"
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Emissão de NFS-e */}
      <NfseEmitirModal
        sale={nfEmitirSale}
        open={!!nfEmitirSale}
        onOpenChange={(o) => !o && setNfEmitirSale(null)}
      />
    </div>
  )
}
