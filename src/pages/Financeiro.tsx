import React, { useState, useMemo } from 'react'
import { useApp } from '@/context/AppContext'
import {
  DollarSign,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  FileText,
  ShoppingBag,
  Percent,
  Wallet,
  CheckCircle,
  AlertTriangle,
  Clock,
  Trash2,
  Check,
  Send,
  Calendar,
  Layers,
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/formatters'
import {
  Budget,
  Sale,
  Installment,
  Commission,
  CashFlowMovement,
  BudgetItem,
  PaymentMethod,
  BudgetStatus,
  CashFlowType,
  CashFlowCategory,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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

export default function Financeiro() {
  const {
    currentUser,
    patients,
    budgets,
    addBudget,
    updateBudget,
    deleteBudget,
    convertBudgetToSale,
    sales,
    addSale,
    installments,
    payInstallment,
    commissions,
    addCommission,
    cashMovements,
    addCashMovement,
  } = useApp()

  const [activeTab, setActiveTab] = useState('orcamentos')

  // Modais
  const [budgetModalOpen, setBudgetModalOpen] = useState(false)
  const [saleModalOpen, setSaleModalOpen] = useState(false)
  const [cashModalOpen, setCashModalOpen] = useState(false)
  const [commissionModalOpen, setCommissionModalOpen] = useState(false)

  // Conversão Orçamento -> Venda
  const [convertModalOpen, setConvertModalOpen] = useState(false)
  const [selectedBudgetToConvert, setSelectedBudgetToConvert] = useState<Budget | null>(null)
  const [convertPaymentMethod, setConvertPaymentMethod] = useState<PaymentMethod>('Parcelado')
  const [convertInstallmentsCount, setConvertInstallmentsCount] = useState<number>(10)
  const [convertFirstDueDate, setConvertFirstDueDate] = useState(
    new Date().toISOString().split('T')[0],
  )

  // Filtros de Parcelas
  const [instStatusFilter, setInstStatusFilter] = useState('todos')
  const [instPatientFilter, setInstPatientFilter] = useState('todos')

  // Confirmação de Exclusão
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [budgetToDelete, setBudgetToDelete] = useState<Budget | null>(null)

  // State: Novo Orçamento
  const [bPatientId, setBPatientId] = useState('')
  const [bDate, setBDate] = useState(new Date().toISOString().split('T')[0])
  const [bDiscount, setBDiscount] = useState<number>(0)
  const [bNotes, setBNotes] = useState('')
  const [bStatus, setBStatus] = useState<BudgetStatus>('Rascunho')
  const [bItems, setBItems] = useState<BudgetItem[]>([
    {
      id: '1',
      type: 'Aparelho',
      description: 'Par de Aparelhos Auditivos Phonak Lumity L90',
      quantity: 1,
      unitPrice: 16000,
      total: 16000,
    },
  ])

  // State: Nova Venda Direta
  const [sPatientId, setSPatientId] = useState('')
  const [sDate, setSDate] = useState(new Date().toISOString().split('T')[0])
  const [sItemsDesc, setSItemsDesc] = useState('')
  const [sTotalValue, setSTotalValue] = useState<number>(0)
  const [sPaymentMethod, setSPaymentMethod] = useState<PaymentMethod>('Parcelado')
  const [sInstallmentsCount, setSInstallmentsCount] = useState<number>(10)
  const [sInterestPercent, setSInterestPercent] = useState<number>(0)
  const [sFirstDueDate, setSFirstDueDate] = useState(new Date().toISOString().split('T')[0])

  // State: Nova Movimentação de Caixa
  const [cDate, setCDate] = useState(new Date().toISOString().split('T')[0])
  const [cDesc, setCDesc] = useState('')
  const [cType, setCType] = useState<CashFlowType>('Entrada')
  const [cCategory, setCCategory] = useState<CashFlowCategory>('Consulta')
  const [cValue, setCValue] = useState<number>(0)

  // State: Nova Comissão
  const [comProf, setComProf] = useState('Milton Soares Pacheco')
  const [comPeriod, setComPeriod] = useState('02/2025')
  const [comSalesCount, setComSalesCount] = useState<number>(3)
  const [comTotalSales, setComTotalSales] = useState<number>(25000)
  const [comPercent, setComPercent] = useState<number>(8)

  // Cálculos do Caixa Diário
  const todayStr = new Date().toISOString().split('T')[0]
  const todayCashMovements = cashMovements.filter((m) => m.date === todayStr)
  const totalEntriesToday = todayCashMovements
    .filter((m) => m.type === 'Entrada')
    .reduce((acc, curr) => acc + curr.value, 0)
  const totalExitsToday = todayCashMovements
    .filter((m) => m.type === 'Saída')
    .reduce((acc, curr) => acc + curr.value, 0)
  const todayBalance = totalEntriesToday - totalExitsToday

  // Cálculo do total do orçamento
  const rawBudgetTotal = bItems.reduce((acc, it) => acc + it.quantity * it.unitPrice, 0)
  const finalBudgetTotal = rawBudgetTotal * (1 - (bDiscount || 0) / 100)

  // Adicionar item ao orçamento
  const handleAddBudgetItem = () => {
    setBItems((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        type: 'Serviço',
        description: '',
        quantity: 1,
        unitPrice: 0,
        total: 0,
      },
    ])
  }

  const handleUpdateBudgetItem = (index: number, field: keyof BudgetItem, value: any) => {
    setBItems((prev) => {
      const copy = [...prev]
      const current = { ...copy[index], [field]: value }
      if (field === 'quantity' || field === 'unitPrice') {
        current.total = (Number(current.quantity) || 0) * (Number(current.unitPrice) || 0)
      }
      copy[index] = current
      return copy
    })
  }

  const handleRemoveBudgetItem = (index: number) => {
    setBItems((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSaveBudget = (e: React.FormEvent) => {
    e.preventDefault()
    const pat = patients.find((p) => p.id === bPatientId)
    if (!pat) return

    addBudget({
      patientId: pat.id,
      patientName: pat.name,
      date: bDate,
      items: bItems,
      discountPercent: bDiscount,
      totalValue: finalBudgetTotal,
      status: bStatus,
      notes: bNotes,
    })

    setBudgetModalOpen(false)
  }

  const handleSaveSale = (e: React.FormEvent) => {
    e.preventDefault()
    const pat = patients.find((p) => p.id === sPatientId)
    if (!pat) return

    addSale({
      patientId: pat.id,
      patientName: pat.name,
      date: sDate,
      itemsDescription: sItemsDesc,
      totalValue: Number(sTotalValue),
      paymentMethod: sPaymentMethod,
      installmentsCount: sPaymentMethod === 'Parcelado' ? Number(sInstallmentsCount) : 1,
      interestPercent: Number(sInterestPercent),
      firstDueDate: sFirstDueDate,
      status: 'Concluída',
    })

    setSaleModalOpen(false)
  }

  const handleConvertBudget = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBudgetToConvert) return
    convertBudgetToSale(
      selectedBudgetToConvert.id,
      convertPaymentMethod,
      convertInstallmentsCount,
      convertFirstDueDate,
    )
    setConvertModalOpen(false)
    setSelectedBudgetToConvert(null)
  }

  const handleSaveCash = (e: React.FormEvent) => {
    e.preventDefault()
    if (!cDesc.trim() || cValue <= 0) return
    addCashMovement({
      date: cDate,
      description: cDesc.trim(),
      type: cType,
      category: cCategory,
      value: Number(cValue),
      responsible: currentUser?.name || 'Recepção',
    })
    setCDesc('')
    setCValue(0)
    setCashModalOpen(false)
  }

  const handleSaveCommission = (e: React.FormEvent) => {
    e.preventDefault()
    const val = (comTotalSales * comPercent) / 100
    addCommission({
      professionalName: comProf,
      period: comPeriod,
      salesCount: Number(comSalesCount),
      totalSalesValue: Number(comTotalSales),
      commissionPercent: Number(comPercent),
      commissionValue: val,
    })
    setCommissionModalOpen(false)
  }

  // Filtragem de Parcelas
  const filteredInstallments = useMemo(() => {
    return installments.filter((inst) => {
      const matchesStatus =
        instStatusFilter === 'todos' || inst.status.toLowerCase() === instStatusFilter.toLowerCase()
      const matchesPat = instPatientFilter === 'todos' || inst.patientId === instPatientFilter
      return matchesStatus && matchesPat
    })
  }, [installments, instStatusFilter, instPatientFilter])

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Financeiro</h1>
            <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 font-bold text-xs">
              Controle Geral
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Gestão de orçamentos, vendas parceladas, quitação de parcelas, comissões e caixa diário
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => setBudgetModalOpen(true)}
            variant="outline"
            className="rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold h-10"
          >
            <Plus className="w-4 h-4 mr-1 text-teal-600" />
            Novo Orçamento
          </Button>
          <Button
            onClick={() => setSaleModalOpen(true)}
            className="rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-xs font-semibold h-10 shadow-sm flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Nova Venda
          </Button>
        </div>
      </div>

      {/* ABAS DO FINANCEIRO */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-2 sm:grid-cols-5 bg-slate-100 p-1 rounded-xl h-auto gap-1">
            <TabsTrigger value="orcamentos" className="text-xs font-semibold py-2 rounded-lg">
              Orçamentos ({budgets.length})
            </TabsTrigger>
            <TabsTrigger value="vendas" className="text-xs font-semibold py-2 rounded-lg">
              Vendas ({sales.length})
            </TabsTrigger>
            <TabsTrigger value="parcelas" className="text-xs font-semibold py-2 rounded-lg">
              Parcelas ({installments.length})
            </TabsTrigger>
            <TabsTrigger value="comissoes" className="text-xs font-semibold py-2 rounded-lg">
              Comissões
            </TabsTrigger>
            <TabsTrigger
              value="caixa"
              className="text-xs font-semibold py-2 rounded-lg col-span-2 sm:col-span-1"
            >
              Caixa Diário
            </TabsTrigger>
          </TabsList>

          {/* 1. ABA ORÇAMENTOS */}
          <TabsContent value="orcamentos" className="space-y-4 pt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Lista de Orçamentos Clínicos</h3>
              <Button
                size="sm"
                onClick={() => setBudgetModalOpen(true)}
                className="bg-teal-500 hover:bg-teal-600 text-white text-xs font-semibold rounded-xl h-9"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Criar Orçamento
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider text-[11px] font-bold">
                  <tr>
                    <th className="py-3 px-4">Nº</th>
                    <th className="py-3 px-4">Paciente</th>
                    <th className="py-3 px-4">Data</th>
                    <th className="py-3 px-4">Itens</th>
                    <th className="py-3 px-4">Desconto</th>
                    <th className="py-3 px-4">Total</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {budgets.map((b) => (
                    <tr key={b.id} className="hover:bg-teal-50/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                        #{b.number}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">{b.patientName}</td>
                      <td className="py-3.5 px-4 text-slate-600">{formatDate(b.date)}</td>
                      <td className="py-3.5 px-4 text-slate-600 truncate max-w-[200px]">
                        {b.items.map((it) => `${it.quantity}x ${it.description}`).join(', ')}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">{b.discountPercent}%</td>
                      <td className="py-3.5 px-4 font-bold text-navy-700">
                        {formatCurrency(b.totalValue)}
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge
                          variant="outline"
                          className={
                            b.status === 'Aprovado'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : b.status === 'Convertido'
                                ? 'bg-teal-50 text-navy-700 border-teal-200'
                                : b.status === 'Enviado'
                                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                                  : 'bg-slate-100 text-slate-600'
                          }
                        >
                          {b.status}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {b.status !== 'Convertido' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedBudgetToConvert(b)
                                setConvertModalOpen(true)
                              }}
                              className="h-8 px-2 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50 font-semibold rounded-lg"
                              title="Converter em Venda e gerar parcelas"
                            >
                              <Check className="w-3.5 h-3.5 mr-1" />
                              Converter
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setBudgetToDelete(b)
                              setDeleteConfirmOpen(true)
                            }}
                            className="h-8 w-8 p-0 text-red-500 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* 2. ABA VENDAS */}
          <TabsContent value="vendas" className="space-y-4 pt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Vendas Registradas</h3>
              <Button
                size="sm"
                onClick={() => setSaleModalOpen(true)}
                className="bg-teal-500 hover:bg-teal-600 text-white text-xs font-semibold rounded-xl h-9"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Registrar Venda
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider text-[11px] font-bold">
                  <tr>
                    <th className="py-3 px-4">Nº Venda</th>
                    <th className="py-3 px-4">Paciente</th>
                    <th className="py-3 px-4">Data</th>
                    <th className="py-3 px-4">Itens</th>
                    <th className="py-3 px-4">Valor Total</th>
                    <th className="py-3 px-4">Forma Pagto</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sales.map((s) => (
                    <tr key={s.id} className="hover:bg-teal-50/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                        #{s.number}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">{s.patientName}</td>
                      <td className="py-3.5 px-4 text-slate-600">{formatDate(s.date)}</td>
                      <td className="py-3.5 px-4 text-slate-700 truncate max-w-[220px]">
                        {s.itemsDescription}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-emerald-700">
                        {formatCurrency(s.totalValue)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-xs font-semibold text-slate-700">
                          {s.paymentMethod}{' '}
                          {s.installmentsCount > 1 ? `(${s.installmentsCount}x)` : ''}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
                          {s.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* 3. ABA PARCELAS */}
          <TabsContent value="parcelas" className="space-y-4 pt-4">
            {/* Filtros de Parcelas */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Select value={instStatusFilter} onValueChange={setInstStatusFilter}>
                  <SelectTrigger className="h-9 rounded-xl border-slate-300 text-xs bg-white w-40">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Status</SelectItem>
                    <SelectItem value="Pendente">Pendentes</SelectItem>
                    <SelectItem value="Pago">Pagas</SelectItem>
                    <SelectItem value="Atrasado">Em Atraso</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={instPatientFilter} onValueChange={setInstPatientFilter}>
                  <SelectTrigger className="h-9 rounded-xl border-slate-300 text-xs bg-white w-52">
                    <SelectValue placeholder="Filtrar por Paciente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Pacientes</SelectItem>
                    {patients.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <span className="text-xs text-slate-500 font-medium">
                Exibindo <strong>{filteredInstallments.length}</strong> parcelas
              </span>
            </div>

            {/* Tabela de Parcelas com Destaque Vermelho em Atrasadas */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider text-[11px] font-bold">
                  <tr>
                    <th className="py-3 px-4">Parcela</th>
                    <th className="py-3 px-4">Venda Ref</th>
                    <th className="py-3 px-4">Paciente</th>
                    <th className="py-3 px-4">Vencimento</th>
                    <th className="py-3 px-4">Valor</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Data Pagto</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredInstallments.map((inst) => {
                    const isOverdue =
                      inst.status === 'Atrasado' ||
                      (inst.status === 'Pendente' &&
                        inst.dueDate < new Date().toISOString().split('T')[0])
                    return (
                      <tr
                        key={inst.id}
                        className={`transition-colors ${
                          isOverdue
                            ? 'bg-red-50/60 hover:bg-red-50 text-red-950 font-medium'
                            : 'hover:bg-teal-50/40'
                        }`}
                      >
                        <td className="py-3.5 px-4 font-bold">
                          {inst.installmentNumber}/{inst.totalInstallments}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-600">#{inst.saleNumber}</td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">{inst.patientName}</td>
                        <td className="py-3.5 px-4 font-mono font-semibold">
                          {formatDate(inst.dueDate)}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {formatCurrency(inst.value)}
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge
                            variant="outline"
                            className={
                              inst.status === 'Pago'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : isOverdue
                                  ? 'bg-red-100 text-red-700 border-red-300 font-bold animate-pulse'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                            }
                          >
                            {isOverdue && inst.status !== 'Pago' ? 'Atrasado' : inst.status}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 text-xs">
                          {formatDate(inst.paidDate)}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {inst.status !== 'Pago' && (
                            <Button
                              size="sm"
                              onClick={() => payInstallment(inst.id)}
                              className="h-8 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                              title="Registrar Pagamento"
                            >
                              <Check className="w-3.5 h-3.5 mr-1" />
                              Receber
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* 4. ABA COMISSÕES */}
          <TabsContent value="comissoes" className="space-y-4 pt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Comissões de Vendas por Profissional
              </h3>
              <Button
                size="sm"
                onClick={() => setCommissionModalOpen(true)}
                className="bg-teal-500 hover:bg-teal-600 text-white text-xs font-semibold rounded-xl h-9"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Nova Comissão
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider text-[11px] font-bold">
                  <tr>
                    <th className="py-3 px-4">Profissional</th>
                    <th className="py-3 px-4">Período (Mês/Ano)</th>
                    <th className="py-3 px-4">Nº Vendas</th>
                    <th className="py-3 px-4">Total Vendido</th>
                    <th className="py-3 px-4">% Comissão</th>
                    <th className="py-3 px-4 text-right">Valor a Pagar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {commissions.map((c) => (
                    <tr key={c.id} className="hover:bg-teal-50/40 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">{c.professionalName}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">{c.period}</td>
                      <td className="py-3.5 px-4 text-slate-700">{c.salesCount} vendas</td>
                      <td className="py-3.5 px-4 font-semibold text-slate-800">
                        {formatCurrency(c.totalSalesValue)}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-teal-600">
                        {c.commissionPercent}%
                      </td>
                      <td className="py-3.5 px-4 text-right font-extrabold text-emerald-700">
                        {formatCurrency(c.commissionValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* 5. ABA CAIXA DIÁRIO */}
          <TabsContent value="caixa" className="space-y-5 pt-4">
            {/* Cards de Resumo do Dia */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-emerald-700">
                    Entradas de Hoje
                  </span>
                  <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-extrabold text-emerald-700 mt-2">
                  {formatCurrency(totalEntriesToday)}
                </div>
              </div>

              <div className="p-4 rounded-xl border border-red-200 bg-red-50/40">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-red-700">Saídas de Hoje</span>
                  <ArrowDownRight className="w-4 h-4 text-red-600" />
                </div>
                <div className="text-2xl font-extrabold text-red-700 mt-2">
                  {formatCurrency(totalExitsToday)}
                </div>
              </div>

              <div className="p-4 rounded-xl border border-teal-200 bg-teal-50/40">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-navy-700">Saldo do Dia</span>
                  <Wallet className="w-4 h-4 text-teal-600" />
                </div>
                <div
                  className={`text-2xl font-extrabold mt-2 ${
                    todayBalance >= 0 ? 'text-navy-700' : 'text-red-600'
                  }`}
                >
                  {formatCurrency(todayBalance)}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <h3 className="text-sm font-bold text-slate-900">Movimentações de Caixa Recentes</h3>
              <Button
                size="sm"
                onClick={() => setCashModalOpen(true)}
                className="bg-teal-500 hover:bg-teal-600 text-white text-xs font-semibold rounded-xl h-9"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Nova Movimentação
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider text-[11px] font-bold">
                  <tr>
                    <th className="py-3 px-4">Data</th>
                    <th className="py-3 px-4">Descrição</th>
                    <th className="py-3 px-4">Tipo</th>
                    <th className="py-3 px-4">Categoria</th>
                    <th className="py-3 px-4">Responsável</th>
                    <th className="py-3 px-4 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cashMovements.map((mov) => (
                    <tr key={mov.id} className="hover:bg-teal-50/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-slate-600">
                        {formatDate(mov.date)}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-900">{mov.description}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
                            mov.type === 'Entrada'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}
                        >
                          {mov.type === 'Entrada' ? '↑ Entrada' : '↓ Saída'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">{mov.category}</td>
                      <td className="py-3.5 px-4 text-slate-500">{mov.responsible}</td>
                      <td
                        className={`py-3.5 px-4 text-right font-bold ${
                          mov.type === 'Entrada' ? 'text-emerald-700' : 'text-red-600'
                        }`}
                      >
                        {mov.type === 'Entrada' ? '+' : '-'} {formatCurrency(mov.value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* MODAL NOVO ORÇAMENTO */}
      <Dialog open={budgetModalOpen} onOpenChange={setBudgetModalOpen}>
        <DialogContent className="max-w-3xl w-full max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
          <DialogHeader className="border-b border-slate-100 pb-3">
            <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-teal-600" />
              <span>Novo Orçamento de Atendimento / Aparelhos</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveBudget} className="space-y-5 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Paciente <span className="text-red-500">*</span>
                </Label>
                <Select value={bPatientId} onValueChange={setBPatientId}>
                  <SelectTrigger className="h-10 rounded-xl mt-1 text-xs">
                    <SelectValue placeholder="Selecione o paciente" />
                  </SelectTrigger>
                  <SelectContent>
                    {patients.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Data do Orçamento</Label>
                <Input
                  type="date"
                  value={bDate}
                  onChange={(e) => setBDate(e.target.value)}
                  className="h-10 rounded-xl mt-1 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Status</Label>
                <Select value={bStatus} onValueChange={(v: BudgetStatus) => setBStatus(v)}>
                  <SelectTrigger className="h-10 rounded-xl mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Rascunho">Rascunho</SelectItem>
                    <SelectItem value="Enviado">Enviado</SelectItem>
                    <SelectItem value="Aprovado">Aprovado</SelectItem>
                    <SelectItem value="Recusado">Recusado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Itens Dinâmicos */}
            <div className="space-y-3 p-4 rounded-xl border border-slate-200 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Itens do Orçamento
                </h4>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAddBudgetItem}
                  className="h-8 text-xs font-semibold border-slate-300"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Adicionar Item
                </Button>
              </div>

              <div className="space-y-2">
                {bItems.map((item, index) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-12 gap-2 items-center bg-white p-2 rounded-lg border border-slate-200"
                  >
                    <div className="col-span-3 sm:col-span-2">
                      <Select
                        value={item.type}
                        onValueChange={(v: any) => handleUpdateBudgetItem(index, 'type', v)}
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Aparelho">Aparelho</SelectItem>
                          <SelectItem value="Serviço">Serviço</SelectItem>
                          <SelectItem value="Exame">Exame</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="col-span-5 sm:col-span-5">
                      <Input
                        value={item.description}
                        onChange={(e) =>
                          handleUpdateBudgetItem(index, 'description', e.target.value)
                        }
                        placeholder="Descrição do item ou serviço"
                        className="h-9 text-xs"
                      />
                    </div>

                    <div className="col-span-2 sm:col-span-2">
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) =>
                          handleUpdateBudgetItem(index, 'quantity', Number(e.target.value))
                        }
                        className="h-9 text-xs text-center"
                      />
                    </div>

                    <div className="col-span-2 sm:col-span-2">
                      <Input
                        type="number"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) =>
                          handleUpdateBudgetItem(index, 'unitPrice', Number(e.target.value))
                        }
                        placeholder="R$"
                        className="h-9 text-xs"
                      />
                    </div>

                    <div className="col-span-12 sm:col-span-1 flex justify-end">
                      {bItems.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveBudgetItem(index)}
                          className="h-8 w-8 p-0 text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-end sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Label className="text-xs font-semibold text-slate-700">Desconto (%):</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={bDiscount}
                    onChange={(e) => setBDiscount(Number(e.target.value))}
                    className="h-9 w-20 text-xs text-center"
                  />
                </div>

                <div className="text-right">
                  <span className="text-xs text-slate-500 block">Total Final com Desconto:</span>
                  <span className="text-xl font-extrabold text-navy-700">
                    {formatCurrency(finalBudgetTotal)}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">
                Observações da Proposta
              </Label>
              <Textarea
                value={bNotes}
                onChange={(e) => setBNotes(e.target.value)}
                placeholder="Condições de pagamento, validade da proposta comercial..."
                rows={2}
                className="rounded-xl mt-1 text-xs border-slate-300 resize-none"
              />
            </div>

            <DialogFooter className="pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setBudgetModalOpen(false)}
                className="rounded-xl text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-xs font-semibold"
              >
                Salvar Orçamento
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL CONVERSÃO ORÇAMENTO EM VENDA */}
      {selectedBudgetToConvert && (
        <Dialog open={convertModalOpen} onOpenChange={setConvertModalOpen}>
          <DialogContent className="max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <DialogHeader className="border-b border-slate-100 pb-3">
              <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-emerald-600" />
                <span>Converter Orçamento #{selectedBudgetToConvert.number} em Venda</span>
              </DialogTitle>
              <p className="text-xs text-slate-500">
                Paciente: <strong>{selectedBudgetToConvert.patientName}</strong> • Total:{' '}
                <strong>{formatCurrency(selectedBudgetToConvert.totalValue)}</strong>
              </p>
            </DialogHeader>

            <form onSubmit={handleConvertBudget} className="space-y-4 pt-2">
              <div>
                <Label className="text-xs font-semibold text-slate-700">Forma de Pagamento</Label>
                <Select
                  value={convertPaymentMethod}
                  onValueChange={(v: PaymentMethod) => setConvertPaymentMethod(v)}
                >
                  <SelectTrigger className="h-10 rounded-xl mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="À vista">À vista (PIX / Dinheiro)</SelectItem>
                    <SelectItem value="Parcelado">Parcelado (Carnê da Clínica)</SelectItem>
                    <SelectItem value="Cartão">Cartão de Crédito</SelectItem>
                    <SelectItem value="Boleto">Boleto Bancário</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {convertPaymentMethod !== 'À vista' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold text-slate-700">Nº de Parcelas</Label>
                    <Input
                      type="number"
                      min="1"
                      max="36"
                      value={convertInstallmentsCount}
                      onChange={(e) => setConvertInstallmentsCount(Number(e.target.value))}
                      className="h-10 rounded-xl mt-1 text-xs"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-slate-700">1º Vencimento</Label>
                    <Input
                      type="date"
                      value={convertFirstDueDate}
                      onChange={(e) => setConvertFirstDueDate(e.target.value)}
                      className="h-10 rounded-xl mt-1 text-xs"
                    />
                  </div>
                </div>
              )}

              <DialogFooter className="pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setConvertModalOpen(false)}
                  className="rounded-xl text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold"
                >
                  Gerar Venda & Parcelas
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* MODAL NOVA VENDA DIRETA */}
      <Dialog open={saleModalOpen} onOpenChange={setSaleModalOpen}>
        <DialogContent className="max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
          <DialogHeader className="border-b border-slate-100 pb-3">
            <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-teal-600" />
              <span>Registrar Venda Direta</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveSale} className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-semibold text-slate-700">Paciente</Label>
              <Select value={sPatientId} onValueChange={setSPatientId}>
                <SelectTrigger className="h-10 rounded-xl mt-1 text-xs">
                  <SelectValue placeholder="Selecione o paciente" />
                </SelectTrigger>
                <SelectContent>
                  {patients.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">Descrição dos Itens</Label>
              <Input
                value={sItemsDesc}
                onChange={(e) => setSItemsDesc(e.target.value)}
                placeholder="Ex: Par de Aparelhos Widex Sheer 440 + Acessórios"
                required
                className="h-10 rounded-xl mt-1 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-700">Valor Total (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={sTotalValue}
                  onChange={(e) => setSTotalValue(Number(e.target.value))}
                  required
                  className="h-10 rounded-xl mt-1 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Forma de Pagamento</Label>
                <Select
                  value={sPaymentMethod}
                  onValueChange={(v: PaymentMethod) => setSPaymentMethod(v)}
                >
                  <SelectTrigger className="h-10 rounded-xl mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="À vista">À vista</SelectItem>
                    <SelectItem value="Parcelado">Parcelado</SelectItem>
                    <SelectItem value="Cartão">Cartão</SelectItem>
                    <SelectItem value="Boleto">Boleto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {sPaymentMethod !== 'À vista' && (
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Nº de Parcelas</Label>
                  <Input
                    type="number"
                    min="1"
                    max="24"
                    value={sInstallmentsCount}
                    onChange={(e) => setSInstallmentsCount(Number(e.target.value))}
                    className="h-9 rounded-lg mt-1 text-xs bg-white"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700">1º Vencimento</Label>
                  <Input
                    type="date"
                    value={sFirstDueDate}
                    onChange={(e) => setSFirstDueDate(e.target.value)}
                    className="h-9 rounded-lg mt-1 text-xs bg-white"
                  />
                </div>
              </div>
            )}

            <DialogFooter className="pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSaleModalOpen(false)}
                className="rounded-xl text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-xs font-semibold"
              >
                Concluir Venda
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL NOVA MOVIMENTAÇÃO DE CAIXA */}
      <Dialog open={cashModalOpen} onOpenChange={setCashModalOpen}>
        <DialogContent className="max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
          <DialogHeader className="border-b border-slate-100 pb-3">
            <DialogTitle className="text-lg font-bold text-slate-900">
              Registrar Movimentação de Caixa
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveCash} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-700">Tipo de Fluxo</Label>
                <Select value={cType} onValueChange={(v: CashFlowType) => setCType(v)}>
                  <SelectTrigger className="h-10 rounded-xl mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Entrada">↑ Entrada</SelectItem>
                    <SelectItem value="Saída">↓ Saída</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Categoria</Label>
                <Select value={cCategory} onValueChange={(v: CashFlowCategory) => setCCategory(v)}>
                  <SelectTrigger className="h-10 rounded-xl mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Consulta">Consulta</SelectItem>
                    <SelectItem value="Venda de aparelho">Venda de aparelho</SelectItem>
                    <SelectItem value="Serviço">Serviço</SelectItem>
                    <SelectItem value="Pagamento de parcela">Pagamento de parcela</SelectItem>
                    <SelectItem value="Despesa operacional">Despesa operacional</SelectItem>
                    <SelectItem value="Fornecedores">Fornecedores</SelectItem>
                    <SelectItem value="Outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">Descrição</Label>
              <Input
                value={cDesc}
                onChange={(e) => setCDesc(e.target.value)}
                placeholder="Ex: Recebimento consulta particular, compra de suprimentos..."
                required
                className="h-10 rounded-xl mt-1 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-700">Valor (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={cValue}
                  onChange={(e) => setCValue(Number(e.target.value))}
                  required
                  className="h-10 rounded-xl mt-1 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Data</Label>
                <Input
                  type="date"
                  value={cDate}
                  onChange={(e) => setCDate(e.target.value)}
                  className="h-10 rounded-xl mt-1 text-xs"
                />
              </div>
            </div>

            <DialogFooter className="pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCashModalOpen(false)}
                className="rounded-xl text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-xs font-semibold"
              >
                Lançar no Caixa
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL NOVA COMISSÃO */}
      <Dialog open={commissionModalOpen} onOpenChange={setCommissionModalOpen}>
        <DialogContent className="max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
          <DialogHeader className="border-b border-slate-100 pb-3">
            <DialogTitle className="text-lg font-bold text-slate-900">
              Registrar Comissão de Profissional
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveCommission} className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-semibold text-slate-700">Profissional</Label>
              <Select value={comProf} onValueChange={setComProf}>
                <SelectTrigger className="h-10 rounded-xl mt-1 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Milton Soares Pacheco">Milton Soares Pacheco</SelectItem>
                  <SelectItem value="Dr. Lucas Ferreira Santos">
                    Dr. Lucas Ferreira Santos
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-700">Período (MM/AAAA)</Label>
                <Input
                  value={comPeriod}
                  onChange={(e) => setComPeriod(e.target.value)}
                  placeholder="02/2025"
                  className="h-10 rounded-xl mt-1 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Nº de Vendas</Label>
                <Input
                  type="number"
                  value={comSalesCount}
                  onChange={(e) => setComSalesCount(Number(e.target.value))}
                  className="h-10 rounded-xl mt-1 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-700">Total Vendido (R$)</Label>
                <Input
                  type="number"
                  value={comTotalSales}
                  onChange={(e) => setComTotalSales(Number(e.target.value))}
                  className="h-10 rounded-xl mt-1 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">% Comissão</Label>
                <Input
                  type="number"
                  value={comPercent}
                  onChange={(e) => setComPercent(Number(e.target.value))}
                  className="h-10 rounded-xl mt-1 text-xs"
                />
              </div>
            </div>

            <div className="p-3 bg-teal-50 rounded-xl border border-teal-100 flex items-center justify-between">
              <span className="text-xs text-teal-700 font-medium">Valor Calculado:</span>
              <span className="text-sm font-extrabold text-navy-700">
                {formatCurrency((comTotalSales * comPercent) / 100)}
              </span>
            </div>

            <DialogFooter className="pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCommissionModalOpen(false)}
                className="rounded-xl text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-xs font-semibold"
              >
                Salvar Comissão
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmação de Exclusão de Orçamento */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Excluir orçamento?"
        description={`Deseja realmente remover o orçamento #${budgetToDelete?.number}?`}
        confirmText="Excluir"
        cancelText="Cancelar"
        variant="danger"
        onConfirm={() => {
          if (budgetToDelete) {
            deleteBudget(budgetToDelete.id)
            setBudgetToDelete(null)
          }
        }}
      />
    </div>
  )
}
