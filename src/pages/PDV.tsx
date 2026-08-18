import React, { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  X,
  Printer,
  CheckCircle2,
  Package,
  Stethoscope,
  User,
  Percent,
  DollarSign,
  ArrowLeft,
  AlertCircle,
  FileText,
} from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { useToast } from '@/hooks/use-toast'
import { usePrint } from '@/components/print/PrintProvider'
import { formatCurrency } from '@/lib/formatters'
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
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import NfseEmitirModal from '@/components/NfseEmitirModal'
import pb from '@/lib/pocketbase/client'
import { getProcedureValueByPlan, type SaleItem, type PDVPaymentMethod, type Sale } from '@/types'

interface CatalogEntry {
  id: string
  name: string
  type: 'procedure' | 'inventory'
  price: number
  stock: number | null
  stockItemId?: string
}

export default function PDV() {
  const navigate = useNavigate()
  const { currentUser, addSale, addStockExit, patients } = useApp()
  const { toast } = useToast()
  const { print } = usePrint()

  // ---- Catálogo (procedures + inventory) ----
  const [catalog, setCatalog] = useState<CatalogEntry[]>([])
  const [loadingCatalog, setLoadingCatalog] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showResults, setShowResults] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoadingCatalog(true)
      try {
        const [procRes, invRes] = await Promise.all([
          pb.collection('procedures').getFullList({ filter: 'active = true', sort: 'name' }),
          pb.collection('inventory').getFullList({ sort: 'name' }),
        ])
        if (!mounted) return
        const procs: CatalogEntry[] = procRes.map((p: any) => ({
          id: p.id,
          name: p.name,
          type: 'procedure' as const,
          price: Number(p.valueParticular ?? p.value ?? 0),
          stock: null,
        }))
        const invs: CatalogEntry[] = invRes.map((i: any) => ({
          id: i.id,
          name: `${i.name}${i.brand ? ` (${i.brand})` : ''}`,
          type: 'inventory' as const,
          price: Number(i.salePrice) || 0,
          stock: Number(i.currentQuantity) || 0,
          stockItemId: i.id,
        }))
        setCatalog([...procs, ...invs])
      } catch (err) {
        console.error('Erro ao carregar catálogo PDV:', err)
      } finally {
        if (mounted) setLoadingCatalog(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [])

  const filteredCatalog = useMemo(() => {
    if (!searchTerm.trim()) return []
    const q = searchTerm.toLowerCase()
    return catalog.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8)
  }, [catalog, searchTerm])

  // ---- Carrinho ----
  const [cart, setCart] = useState<SaleItem[]>([])
  const [patientQuery, setPatientQuery] = useState('')
  const [selectedPatient, setSelectedPatient] = useState<{ id: string; name: string } | null>(null)
  const [showPatientResults, setShowPatientResults] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<PDVPaymentMethod>('Dinheiro')
  const [discountMode, setDiscountMode] = useState<'percent' | 'value'>('percent')
  const [discountInput, setDiscountInput] = useState<string>('0')
  const [submitting, setSubmitting] = useState(false)
  const [receiptSale, setReceiptSale] = useState<any | null>(null)
  const [nfEmitirSale, setNfEmitirSale] = useState<Sale | null>(null)

  // ---- Pacientes (autocomplete) ----
  const filteredPatients = useMemo(() => {
    if (!patientQuery.trim()) return []
    const q = patientQuery.toLowerCase()
    return patients
      .filter((p) => p.name.toLowerCase().includes(q) || (p.cpf || '').includes(q))
      .slice(0, 6)
  }, [patients, patientQuery])

  const addItemToCart = (entry: CatalogEntry, qty = 1) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === entry.id)
      if (existing) {
        return prev.map((i) =>
          i.id === entry.id
            ? { ...i, quantity: i.quantity + qty, subtotal: (i.quantity + qty) * i.unitPrice }
            : i,
        )
      }
      const newItem: SaleItem = {
        id: entry.id,
        name: entry.name,
        type: entry.type,
        quantity: qty,
        unitPrice: entry.price,
        subtotal: entry.price * qty,
        stockItemId: entry.stockItemId,
      }
      return [...prev, newItem]
    })
    setSearchTerm('')
    setShowResults(false)
    toast({
      title: 'Item adicionado',
      description: `${entry.name} (${formatCurrency(entry.price)})`,
    })
  }

  const updateQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.id !== id) return i
          const nextQty = Math.max(1, i.quantity + delta)
          return { ...i, quantity: nextQty, subtotal: nextQty * i.unitPrice }
        })
        .filter(Boolean),
    )
  }

  const setQty = (id: string, qty: number) => {
    const q = Math.max(1, Math.floor(qty) || 1)
    setCart((prev) =>
      prev.map((i) => (i.id === id ? { ...i, quantity: q, subtotal: q * i.unitPrice } : i)),
    )
  }

  const removeItem = (id: string) => {
    setCart((prev) => prev.filter((i) => i.id !== id))
    toast({ title: 'Item removido', variant: 'destructive' })
  }

  // ---- Cálculos ----
  const subtotal = useMemo(() => cart.reduce((acc, i) => acc + i.subtotal, 0), [cart])
  const discount = useMemo(() => {
    const n = Number(discountInput) || 0
    if (discountMode === 'percent') {
      return Math.min(subtotal, (subtotal * n) / 100)
    }
    return Math.min(subtotal, n)
  }, [discountInput, discountMode, subtotal])
  const total = Math.max(0, subtotal - discount)
  const totalItems = useMemo(() => cart.reduce((acc, i) => acc + i.quantity, 0), [cart])

  // ---- Finalizar venda ----
  const handleFinish = async () => {
    if (cart.length === 0) {
      toast({
        title: 'Carrinho vazio',
        description: 'Adicione itens antes de finalizar.',
        variant: 'destructive',
      })
      return
    }
    // valida estoque
    for (const item of cart) {
      if (item.type === 'inventory' && item.stockItemId) {
        const entry = catalog.find((c) => c.id === item.id)
        if (entry && entry.stock != null && item.quantity > entry.stock) {
          toast({
            title: 'Estoque insuficiente',
            description: `${item.name}: apenas ${entry.stock} un. disponíveis.`,
            variant: 'destructive',
          })
          return
        }
      }
    }

    setSubmitting(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      const itemsDescription = cart.map((i) => `${i.quantity}x ${i.name}`).join(', ')

      // baixa estoque (produtos)
      cart.forEach((item) => {
        if (item.type === 'inventory' && item.stockItemId) {
          addStockExit(
            item.stockItemId,
            item.quantity,
            `Venda PDV`,
            currentUser?.name || 'PDV',
            selectedPatient?.name,
            today,
          )
        }
      })

      const discountPercent = discountMode === 'percent' ? Number(discountInput) || 0 : 0
      const discountValue = discountMode === 'value' ? Number(discountInput) || 0 : discount

      const created = addSale({
        patientId: selectedPatient?.id || '',
        patientName: selectedPatient?.name || 'Venda avulsa',
        date: today,
        itemsDescription,
        totalValue: total,
        paymentMethod,
        installmentsCount: 1,
        interestPercent: 0,
        firstDueDate: today,
        status: 'Pago',
        type: 'PDV',
        items: cart,
        subtotal,
        discountValue,
        discountPercent,
        cancelReason: '',
        appointmentId: '',
      })

      // registro de caixa automático (via addSale, à vista)

      setReceiptSale({
        ...created,
        paymentMethod,
        subtotal,
        discount,
        total,
        cart,
        patientName: selectedPatient?.name || 'Venda avulsa',
      })
      setCart([])
      setDiscountInput('0')
      setSelectedPatient(null)
      setPatientQuery('')
      toast({ title: 'Venda finalizada!', description: `Total ${formatCurrency(total)}` })
    } catch (err) {
      console.error(err)
      toast({ title: 'Erro ao finalizar venda', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  // ---- Impressão de comprovante ----
  const handlePrintReceipt = (sale: any) => {
    print({
      title: `Comprovante de Venda #${sale.number}`,
      subtitle: `Data: ${new Date(sale.createdAt || sale.date || Date.now()).toLocaleDateString('pt-BR')}`,
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
              <strong>Tipo:</strong> {sale.type === 'PDV' ? 'PDV' : 'Atendimento'}
            </div>
          </div>
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
              {(sale.cart || sale.items || []).map((it: SaleItem, idx: number) => (
                <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td className="py-1.5">{it.name}</td>
                  <td className="py-1.5 text-center">{it.quantity}</td>
                  <td className="py-1.5 text-right">{formatCurrency(it.unitPrice)}</td>
                  <td className="py-1.5 text-right">{formatCurrency(it.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-end">
            <div className="w-64 space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatCurrency(sale.subtotal ?? sale.total)}</span>
              </div>
              {sale.discount > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Desconto:</span>
                  <span>- {formatCurrency(sale.discount)}</span>
                </div>
              )}
              <div
                className="flex justify-between font-extrabold text-base border-t pt-1"
                style={{ borderTop: '1px solid #0F2B5C' }}
              >
                <span>Total:</span>
                <span>{formatCurrency(sale.total)}</span>
              </div>
            </div>
          </div>
          <p className="text-center text-xs text-slate-500 pt-4">
            Obrigado pela preferência! • Audição360 — Centro Auditivo
          </p>
        </div>
      ),
    })
  }

  return (
    <div className="space-y-5 animate-in fade-in-50 duration-200">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/vendas')}
            className="rounded-lg"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                PDV — Ponto de Venda
              </h1>
              <Badge className="bg-teal-50 text-teal-700 border-teal-200">Terminal de Caixa</Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Registre vendas avulsas de produtos e serviços
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="rounded-xl text-xs"
            onClick={() => navigate('/vendas')}
          >
            Histórico de Vendas
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* COLUNA ESQUERDA — Busca + catálogo + paciente */}
        <div className="lg:col-span-3 space-y-4">
          {/* Busca de produtos/serviços */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <Search className="w-3.5 h-3.5 text-teal-600" /> Buscar Produto / Serviço
            </Label>
            <div className="relative">
              <Input
                ref={searchRef}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setShowResults(true)
                }}
                onFocus={() => setShowResults(true)}
                placeholder={
                  loadingCatalog
                    ? 'Carregando catálogo...'
                    : 'Digite para buscar (ex.: pilha, audiometria...)'
                }
                className="h-11 rounded-xl text-sm pr-9"
              />
              {searchTerm && (
                <button
                  onClick={() => {
                    setSearchTerm('')
                    setShowResults(false)
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              {showResults && searchTerm.trim() && (
                <div className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl max-h-80 overflow-y-auto">
                  {filteredCatalog.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      Nenhum item encontrado.
                    </div>
                  ) : (
                    filteredCatalog.map((entry) => (
                      <button
                        key={`${entry.type}-${entry.id}`}
                        onClick={() => addItemToCart(entry)}
                        className="w-full flex items-center justify-between gap-3 p-3 hover:bg-teal-50/60 border-b border-slate-100 last:border-0 text-left transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`p-1.5 rounded-lg shrink-0 ${
                              entry.type === 'inventory'
                                ? 'bg-blue-50 text-blue-600'
                                : 'bg-teal-50 text-teal-600'
                            }`}
                          >
                            {entry.type === 'inventory' ? (
                              <Package className="w-4 h-4" />
                            ) : (
                              <Stethoscope className="w-4 h-4" />
                            )}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">
                              {entry.name}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {entry.type === 'inventory' ? 'Produto' : 'Serviço/Exame'}
                              {entry.stock != null && ` • Estoque: ${entry.stock}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm font-bold text-teal-700">
                            {formatCurrency(entry.price)}
                          </span>
                          <Plus className="w-4 h-4 text-teal-600" />
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Busca de paciente */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <User className="w-3.5 h-3.5 text-teal-600" /> Paciente / Cliente{' '}
              <span className="text-slate-400 normal-case font-normal">
                (opcional — vendas avulsas)
              </span>
            </Label>
            <div className="relative">
              <Input
                value={selectedPatient ? selectedPatient.name : patientQuery}
                onChange={(e) => {
                  setPatientQuery(e.target.value)
                  setSelectedPatient(null)
                  setShowPatientResults(true)
                }}
                onFocus={() => setShowPatientResults(true)}
                placeholder="Buscar paciente por nome ou CPF..."
                className="h-11 rounded-xl text-sm pr-9"
              />
              {(selectedPatient || patientQuery) && (
                <button
                  onClick={() => {
                    setSelectedPatient(null)
                    setPatientQuery('')
                    setShowPatientResults(false)
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              {showPatientResults && !selectedPatient && patientQuery.trim() && (
                <div className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl max-h-72 overflow-y-auto">
                  {filteredPatients.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      Nenhum paciente encontrado.
                    </div>
                  ) : (
                    filteredPatients.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setSelectedPatient({ id: p.id, name: p.name })
                          setPatientQuery('')
                          setShowPatientResults(false)
                        }}
                        className="w-full flex items-center gap-3 p-3 hover:bg-teal-50/60 border-b border-slate-100 last:border-0 text-left"
                      >
                        <div className="p-1.5 rounded-lg bg-slate-100 text-slate-600 shrink-0">
                          <User className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{p.name}</p>
                          <p className="text-[11px] text-slate-500">
                            {p.cpf || 'Sem CPF'} • {p.mobile || p.phone || 'Sem telefone'}
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            {selectedPatient && (
              <div className="mt-2 text-xs text-teal-700 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Venda vinculada a {selectedPatient.name}
              </div>
            )}
          </div>

          {/* Atalhos do catálogo (itens recentes / populares) */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 block">
              Acesso rápido
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
              {catalog.slice(0, 12).map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => addItemToCart(entry)}
                  className="p-2.5 rounded-xl border border-slate-200 hover:border-teal-300 hover:bg-teal-50/40 text-left transition-colors"
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    {entry.type === 'inventory' ? (
                      <Package className="w-3 h-3 text-blue-500" />
                    ) : (
                      <Stethoscope className="w-3 h-3 text-teal-500" />
                    )}
                    <span className="text-[11px] font-semibold text-slate-700 truncate">
                      {entry.name}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-teal-700">
                      {formatCurrency(entry.price)}
                    </span>
                    {entry.stock != null && (
                      <span className="text-[10px] text-slate-400">{entry.stock} un</span>
                    )}
                  </div>
                </button>
              ))}
              {catalog.length === 0 && (
                <div className="col-span-full text-center text-xs text-slate-400 py-4">
                  {loadingCatalog ? 'Carregando catálogo...' : 'Nenhum item cadastrado.'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA — Carrinho + checkout */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm sticky top-4 flex flex-col max-h-[calc(100vh-2rem)]">
            {/* Header do carrinho */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <ShoppingCart className="w-5 h-5 text-teal-600" />
                  {totalItems > 0 && (
                    <span className="absolute -top-2 -right-2 bg-teal-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                      {totalItems}
                    </span>
                  )}
                </div>
                <h2 className="text-sm font-bold text-slate-900">Carrinho</h2>
              </div>
              {cart.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCart([])}
                  className="h-7 text-xs text-red-500 hover:bg-red-50"
                >
                  Limpar
                </Button>
              )}
            </div>

            {/* Itens */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[120px]">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-10 text-slate-400">
                  <ShoppingCart className="w-10 h-10 mb-2 opacity-40" />
                  <p className="text-xs">Carrinho vazio</p>
                  <p className="text-[11px] mt-0.5">Busque e adicione itens à esquerda</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 animate-in fade-in-50 duration-150"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {item.type === 'inventory' ? (
                          <Package className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        ) : (
                          <Stethoscope className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                        )}
                        <span className="text-xs font-semibold text-slate-800 truncate">
                          {item.name}
                        </span>
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="p-0.5 text-red-400 hover:text-red-600 shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateQty(item.id, -1)}
                          className="w-6 h-6 rounded-md border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-100"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => setQty(item.id, Number(e.target.value))}
                          className="w-10 h-6 text-center text-xs border border-slate-200 rounded-md"
                        />
                        <button
                          onClick={() => updateQty(item.id, 1)}
                          className="w-6 h-6 rounded-md border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-100"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-slate-400">
                          {formatCurrency(item.unitPrice)} cada
                        </div>
                        <div className="text-sm font-bold text-slate-900">
                          {formatCurrency(item.subtotal)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer / checkout */}
            <div className="border-t border-slate-100 p-4 space-y-3">
              {/* Pagamento + desconto */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                    Pagamento
                  </Label>
                  <Select
                    value={paymentMethod}
                    onValueChange={(v) => setPaymentMethod(v as PDVPaymentMethod)}
                  >
                    <SelectTrigger className="h-9 rounded-lg text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="Cartão de Débito">Cartão de Débito</SelectItem>
                      <SelectItem value="Cartão de Crédito">Cartão de Crédito</SelectItem>
                      <SelectItem value="PIX">PIX</SelectItem>
                      <SelectItem value="Convênio">Convênio</SelectItem>
                      <SelectItem value="Boleto">Boleto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                    Desconto
                  </Label>
                  <div className="flex gap-1">
                    <Select
                      value={discountMode}
                      onValueChange={(v) => setDiscountMode(v as 'percent' | 'value')}
                    >
                      <SelectTrigger className="h-9 rounded-lg text-xs w-16">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percent">%</SelectItem>
                        <SelectItem value="value">R$</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min={0}
                      value={discountInput}
                      onChange={(e) => setDiscountInput(e.target.value)}
                      className="h-9 rounded-lg text-xs flex-1"
                    />
                  </div>
                </div>
              </div>

              {/* Totais */}
              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-xs text-red-600">
                    <span className="flex items-center gap-1">
                      <Percent className="w-3 h-3" /> Desconto
                    </span>
                    <span>- {formatCurrency(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-1.5 border-t border-dashed border-slate-200">
                  <span className="text-sm font-bold text-slate-700">Total</span>
                  <span className="text-xl font-extrabold text-teal-700">
                    {formatCurrency(total)}
                  </span>
                </div>
              </div>

              <Button
                onClick={handleFinish}
                disabled={cart.length === 0 || submitting}
                className="w-full h-11 bg-teal-500 hover:bg-teal-600 text-white rounded-xl font-semibold text-sm shadow-sm disabled:opacity-50"
              >
                <DollarSign className="w-4 h-4 mr-1.5" />
                {submitting ? 'Processando...' : 'Finalizar Venda'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de comprovante / resumo da venda */}
      <Dialog open={!!receiptSale} onOpenChange={(o) => !o && setReceiptSale(null)}>
        <DialogContent className="max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
          <DialogHeader className="border-b border-slate-100 pb-3">
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Venda Finalizada!
            </DialogTitle>
          </DialogHeader>
          {receiptSale && (
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500">Venda Nº:</span>{' '}
                  <strong className="text-slate-900">#{receiptSale.number}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Cliente:</span>{' '}
                  <strong className="text-slate-900">{receiptSale.patientName}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Pagamento:</span>{' '}
                  <strong className="text-slate-900">{receiptSale.paymentMethod}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Itens:</span>{' '}
                  <strong className="text-slate-900">{receiptSale.cart?.length || 0}</strong>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-teal-50 border border-teal-100 space-y-1">
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Subtotal</span>
                  <span>{formatCurrency(receiptSale.subtotal)}</span>
                </div>
                {receiptSale.discount > 0 && (
                  <div className="flex justify-between text-xs text-red-600">
                    <span>Desconto</span>
                    <span>- {formatCurrency(receiptSale.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-extrabold text-base text-teal-700 pt-1 border-t border-teal-200">
                  <span>Total</span>
                  <span>{formatCurrency(receiptSale.total)}</span>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-50 border border-amber-100 text-[11px] text-amber-800">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>O estoque dos produtos foi atualizado automaticamente.</span>
              </div>
            </div>
          )}
          <DialogFooter className="pt-2 border-t border-slate-100 flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => setReceiptSale(null)}
              className="rounded-xl text-xs"
            >
              Nova Venda
            </Button>
            <Button
              onClick={() => handlePrintReceipt(receiptSale)}
              className="rounded-xl text-xs bg-teal-500 hover:bg-teal-600 text-white"
            >
              <Printer className="w-3.5 h-3.5 mr-1.5" />
              Imprimir Comprovante
            </Button>
            {receiptSale && (
              <Button
                onClick={() => {
                  setNfEmitirSale(receiptSale as Sale)
                }}
                className="rounded-xl text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                <FileText className="w-3.5 h-3.5 mr-1.5" /> Emitir NF
              </Button>
            )}
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
