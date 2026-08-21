import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  FileText,
  Search,
  Check,
  ChevronsUpDown,
  User,
  Calendar as CalendarIcon,
  ShoppingBag,
  Wrench,
  Hash,
  FileCheck2,
  AlertCircle,
  Plus,
  Trash2,
  RefreshCw,
  Info,
  CheckCircle2,
  Printer,
  Eye,
  X,
} from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import { formatCurrency, formatDate, maskCPF } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'
import { useApp } from '@/context/AppContext'
import { usePrint } from '@/components/print/PrintProvider'
import { NotaFiscalPrint } from '@/components/print/PrintDocuments'
import type { NotaFiscal, Patient } from '@/types'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

interface SaleRecord {
  id: string
  number: number
  date: string
  patientId: string
  patientName: string
  totalValue: number
  items?: any
  itemsDescription?: string
  status?: string
}

interface PatientRecord {
  id: string
  name: string
  cpf?: string
  birthDate?: string
  phone?: string
  mobile?: string
}

export interface NfItemRow {
  id: string
  nome: string
  tipo: 'produto' | 'servico'
  quantidade: number
  valor_unitario: number
  cfop: string
  ncm: string
  cnae: string
}

export const NotasFiscaisPage: React.FC = () => {
  const { toast } = useToast()
  const { clinicSettings, patients: appPatients } = useApp()
  const { print } = usePrint()

  // Lista de vendas
  const [sales, setSales] = useState<SaleRecord[]>([])
  const [loadingSales, setLoadingSales] = useState(true)
  const [salesComboboxOpen, setSalesComboboxOpen] = useState(false)
  const [selectedSaleId, setSelectedSaleId] = useState<string>('')

  // Dados do paciente
  const [patient, setPatient] = useState<PatientRecord | null>(null)
  const [fullPatient, setFullPatient] = useState<Patient | null>(null)
  const [loadingPatient, setLoadingPatient] = useState(false)

  // Itens da NF
  const [items, setItems] = useState<NfItemRow[]>([])

  // Campos da NF
  const [numeroNf, setNumeroNf] = useState<number>(1)
  const [loadingNumero, setLoadingNumero] = useState(false)
  const [serie, setSerie] = useState<string>('1')
  const [dataEmissao, setDataEmissao] = useState<string>(new Date().toISOString().split('T')[0])
  const [tipoNf, setTipoNf] = useState<'nfe' | 'nfse' | 'ambos'>('ambos')
  const [observacoes, setObservacoes] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Modal / Estado de Sucesso com opção de Visualizar / Imprimir PDF DANFE
  const [successModalOpen, setSuccessModalOpen] = useState(false)
  const [previewModalOpen, setPreviewModalOpen] = useState(false)
  const [emittedNf, setEmittedNf] = useState<NotaFiscal | null>(null)
  const [emittedPatient, setEmittedPatient] = useState<Patient | null>(null)

  // Carrega vendas e próximo número da NF
  const fetchProximoNumero = useCallback(async () => {
    setLoadingNumero(true)
    try {
      const records = await pb.collection('notas_fiscais').getList(1, 1, {
        sort: '-numero',
      })
      if (records.items.length > 0 && records.items[0].numero) {
        setNumeroNf(Number(records.items[0].numero) + 1)
      } else {
        setNumeroNf(1)
      }
    } catch {
      // Fallback seguro caso a coleção esteja vazia ou haja erro de rede
      setNumeroNf(1)
    } finally {
      setLoadingNumero(false)
    }
  }, [])

  const fetchSales = useCallback(async () => {
    setLoadingSales(true)
    try {
      const records = await pb.collection('sales').getFullList<SaleRecord>({
        sort: '-date,-created',
      })
      setSales(records)
    } catch (err: any) {
      console.error('Erro ao carregar vendas:', err)
      toast({
        title: 'Erro ao carregar vendas',
        description: 'Não foi possível buscar as vendas registradas.',
        variant: 'destructive',
      })
    } finally {
      setLoadingSales(false)
    }
  }, [toast])

  useEffect(() => {
    fetchSales()
    fetchProximoNumero()
  }, [fetchSales, fetchProximoNumero])

  // Trata a seleção da venda
  const handleSelectSale = async (saleId: string) => {
    setSelectedSaleId(saleId)
    setSalesComboboxOpen(false)

    const sale = sales.find((s) => s.id === saleId)
    if (!sale) {
      setPatient(null)
      setItems([])
      return
    }

    // Buscar paciente correspondente
    if (sale.patientId) {
      setLoadingPatient(true)
      try {
        const p = await pb.collection('patients').getOne<Patient>(sale.patientId)
        setPatient(p)
        setFullPatient(p)
      } catch {
        // Fallback local do AppContext ou objeto básico
        const fallbackP = appPatients.find((pt) => pt.id === sale.patientId)
        if (fallbackP) {
          setPatient(fallbackP)
          setFullPatient(fallbackP)
        } else {
          setPatient({
            id: sale.patientId,
            name: sale.patientName || 'Paciente não encontrado',
            cpf: '',
            birthDate: '',
          })
          setFullPatient(null)
        }
      } finally {
        setLoadingPatient(false)
      }
    } else {
      setPatient(
        sale.patientName
          ? {
              id: '',
              name: sale.patientName,
              cpf: '',
              birthDate: '',
            }
          : null,
      )
      setFullPatient(null)
    }

    // Processar itens da venda
    let parsedItems: NfItemRow[] = []

    let rawItems: any = sale.items
    if (typeof rawItems === 'string') {
      try {
        rawItems = JSON.parse(rawItems)
      } catch {
        rawItems = []
      }
    }

    if (Array.isArray(rawItems) && rawItems.length > 0) {
      parsedItems = rawItems.map((it: any, index: number) => {
        // Mapear tipos existentes no PDV / vendas:
        // 'inventory' | 'produto' | 'product' -> 'produto'
        // 'procedure' | 'servico' | 'service' | 'exame' -> 'servico'
        const rawType = String(it.type || it.tipo || '').toLowerCase()
        const isServico =
          rawType === 'servico' ||
          rawType === 'serviço' ||
          rawType === 'procedure' ||
          rawType === 'service' ||
          rawType === 'exame'

        const itemTipo: 'produto' | 'servico' = isServico ? 'servico' : 'produto'
        const qtd = Number(it.quantity || it.quantidade || 1)
        const unitVal = Number(
          it.unitPrice ??
            it.valor_unitario ??
            it.price ??
            (it.subtotal ? it.subtotal / (qtd || 1) : 0),
        )

        return {
          id: `item-${index}-${Date.now()}`,
          nome: it.name || it.nome || `Item ${index + 1}`,
          tipo: itemTipo,
          quantidade: qtd > 0 ? qtd : 1,
          valor_unitario: unitVal >= 0 ? unitVal : 0,
          cfop: itemTipo === 'produto' ? it.cfop || '5102' : '',
          ncm: itemTipo === 'produto' ? it.ncm || '' : '',
          cnae: itemTipo === 'servico' ? it.cnae || '8650-0/00' : '',
        }
      })
    } else if (sale.itemsDescription) {
      // Fallback para vendas que só possuem a descrição dos itens
      parsedItems = [
        {
          id: `item-fallback-${Date.now()}`,
          nome: sale.itemsDescription,
          tipo: 'servico',
          quantidade: 1,
          valor_unitario: Number(sale.totalValue || 0),
          cfop: '',
          ncm: '',
          cnae: '8650-0/00',
        },
      ]
    } else {
      parsedItems = [
        {
          id: `item-empty-${Date.now()}`,
          nome: `Venda #${sale.number || ''}`,
          tipo: 'produto',
          quantidade: 1,
          valor_unitario: Number(sale.totalValue || 0),
          cfop: '5102',
          ncm: '',
          cnae: '',
        },
      ]
    }

    setItems(parsedItems)

    // Ajustar sugestão do tipo de NF com base nos itens
    const hasProdutos = parsedItems.some((i) => i.tipo === 'produto')
    const hasServicos = parsedItems.some((i) => i.tipo === 'servico')
    if (hasProdutos && hasServicos) {
      setTipoNf('ambos')
    } else if (hasProdutos) {
      setTipoNf('nfe')
    } else if (hasServicos) {
      setTipoNf('nfse')
    } else {
      setTipoNf('ambos')
    }
  }

  // Manipulação de itens
  const handleItemChange = (id: string, field: keyof NfItemRow, value: any) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item
        return {
          ...item,
          [field]: value,
        }
      }),
    )
  }

  const handleAddItem = (tipo: 'produto' | 'servico') => {
    const newItem: NfItemRow = {
      id: `manual-${Date.now()}-${Math.random()}`,
      nome: tipo === 'produto' ? 'Novo Produto' : 'Novo Serviço',
      tipo,
      quantidade: 1,
      valor_unitario: 0,
      cfop: tipo === 'produto' ? '5102' : '',
      ncm: '',
      cnae: tipo === 'servico' ? '8650-0/00' : '',
    }
    setItems((prev) => [...prev, newItem])
  }

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  // Cálculos de resumo
  const produtos = useMemo(() => items.filter((i) => i.tipo === 'produto'), [items])
  const servicos = useMemo(() => items.filter((i) => i.tipo === 'servico'), [items])

  const totalProdutos = useMemo(() => {
    return produtos.reduce(
      (acc, curr) => acc + (Number(curr.quantidade) || 0) * (Number(curr.valor_unitario) || 0),
      0,
    )
  }, [produtos])

  const totalServicos = useMemo(() => {
    return servicos.reduce(
      (acc, curr) => acc + (Number(curr.quantidade) || 0) * (Number(curr.valor_unitario) || 0),
      0,
    )
  }, [servicos])

  const totalNF = useMemo(() => totalProdutos + totalServicos, [totalProdutos, totalServicos])

  // Limpar formulário após emissão
  const resetForm = () => {
    setSelectedSaleId('')
    setPatient(null)
    setFullPatient(null)
    setItems([])
    setSerie('1')
    setDataEmissao(new Date().toISOString().split('T')[0])
    setTipoNf('ambos')
    setObservacoes('')
    fetchProximoNumero()
  }

  // Função para imprimir PDF DANFE
  const handlePrintDanfe = (nfData: NotaFiscal, patData: Patient | null) => {
    print({
      title: `DANFE - NF-e Nº ${String(nfData.numero).padStart(9, '0')}`,
      subtitle: `Série ${nfData.serie || '1'} • Emissão: ${formatDate(nfData.data_emissao)}`,
      body: (
        <NotaFiscalPrint notaFiscal={nfData} patient={patData} clinicSettings={clinicSettings} />
      ),
    })
  }

  // Submissão / Emissão
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedSaleId) {
      toast({
        title: 'Selecione uma venda',
        description: 'É necessário selecionar uma venda para emitir a Nota Fiscal.',
        variant: 'destructive',
      })
      return
    }

    if (!patient?.id) {
      toast({
        title: 'Paciente não identificado',
        description: 'A venda selecionada precisa estar vinculada a um paciente cadastrado.',
        variant: 'destructive',
      })
      return
    }

    if (items.length === 0) {
      toast({
        title: 'Adicione itens',
        description: 'A nota fiscal precisa conter pelo menos um produto ou serviço.',
        variant: 'destructive',
      })
      return
    }

    // Validar se os itens têm nomes preenchidos
    const itemInvalido = items.find((i) => !i.nome.trim())
    if (itemInvalido) {
      toast({
        title: 'Item sem nome',
        description: 'Por favor, preencha o nome de todos os itens da nota fiscal.',
        variant: 'destructive',
      })
      return
    }

    setIsSubmitting(true)
    try {
      const itensFormatados = items.map((i) => {
        const qtd = Number(i.quantidade) || 0
        const vUnit = Number(i.valor_unitario) || 0
        return {
          nome: i.nome.trim(),
          tipo: i.tipo,
          quantidade: qtd,
          valor_unitario: vUnit,
          valor_total: qtd * vUnit,
          cfop: i.tipo === 'produto' ? i.cfop?.trim() || '' : '',
          ncm: i.tipo === 'produto' ? i.ncm?.trim() || '' : '',
          cnae: i.tipo === 'servico' ? i.cnae?.trim() || '' : '',
        }
      })

      // Gera chave de acesso formatada se não fornecida
      const rawNum = String(numeroNf).padStart(9, '0')
      const chaveGerada = `35${dataEmissao.replace(/-/g, '').slice(2, 6)}00000000000155001000${rawNum}100000001`

      const payload = {
        numero: Number(numeroNf),
        serie: serie.trim(),
        data_emissao: dataEmissao,
        paciente: patient.id,
        venda: selectedSaleId,
        tipo: tipoNf,
        itens: itensFormatados,
        valor_total: totalNF,
        chave_acesso: chaveGerada,
        status: 'emitida',
        observacoes: observacoes.trim(),
      }

      const createdRecord = await pb.collection('notas_fiscais').create<NotaFiscal>(payload)

      // Guardar referências para impressão / visualização
      const patientForDanfe =
        fullPatient ||
        (patient
          ? {
              id: patient.id,
              name: patient.name,
              cpf: patient.cpf || '',
              birthDate: patient.birthDate || '',
              gender: 'Não informar' as const,
              phone: patient.phone || '',
              mobile: patient.mobile || '',
              email: '',
              cep: '',
              street: '',
              number: '',
              neighborhood: '',
              city: '',
              state: '',
              planType: 'Particular' as const,
              hearingLossType: 'Normal' as const,
              previousHearingAid: false,
              status: 'Ativo' as const,
              createdAt: new Date().toISOString(),
            }
          : null)

      setEmittedNf(createdRecord)
      setEmittedPatient(patientForDanfe)
      setSuccessModalOpen(true)

      toast({
        title: 'Nota Fiscal emitida com sucesso!',
        description: `NF nº ${numeroNf} registrada com status emitida.`,
      })

      resetForm()
    } catch (err: any) {
      console.error('Erro ao emitir nota fiscal:', err)
      const errorMsg =
        err?.data?.message || err?.message || 'Ocorreu um erro ao salvar o registro da nota fiscal.'
      toast({
        title: 'Erro ao emitir Nota Fiscal',
        description: errorMsg,
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedSale = sales.find((s) => s.id === selectedSaleId)

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Título e cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <FileText className="w-7 h-7 text-teal-600" />
            Emitir Nota Fiscal
          </h1>
          <p className="text-sm text-slate-500">
            Selecione uma venda realizada para gerar a emissão de NF-e (produtos) e/ou NFS-e
            (serviços)
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            fetchSales()
            fetchProximoNumero()
          }}
          disabled={loadingSales || loadingNumero}
          className="self-start sm:self-auto text-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loadingSales ? 'animate-spin' : ''}`} />
          Atualizar Dados
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 2. Seletor de Venda */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Search className="w-4 h-4 text-teal-600" />
              1. Selecionar Venda
            </CardTitle>
            <CardDescription className="text-xs">
              Busque por nome do paciente, data ou valor total da venda
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {loadingSales ? (
              <div className="flex items-center justify-center py-6 text-sm text-slate-500 gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-teal-600" />
                Carregando vendas...
              </div>
            ) : sales.length === 0 ? (
              <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-center gap-2">
                <AlertCircle className="w-5 h-5 shrink-0 text-amber-600" />
                <span>Nenhuma venda encontrada no sistema para emitir nota fiscal.</span>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="venda-select" className="text-xs font-semibold text-slate-700">
                  Venda de Origem <span className="text-red-500">*</span>
                </Label>
                <Popover open={salesComboboxOpen} onOpenChange={setSalesComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id="venda-select"
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={salesComboboxOpen}
                      className="w-full justify-between h-11 bg-white hover:bg-slate-50 border-slate-300 text-left font-normal"
                    >
                      {selectedSale ? (
                        <div className="flex items-center justify-between w-full min-w-0 pr-2">
                          <span className="truncate font-medium text-slate-900">
                            {selectedSale.patientName || 'Venda sem paciente'}
                          </span>
                          <div className="flex items-center gap-3 shrink-0 text-xs text-slate-500">
                            <span className="hidden sm:inline bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                              #{selectedSale.number}
                            </span>
                            <span>{formatDate(selectedSale.date)}</span>
                            <span className="font-bold text-teal-700">
                              {formatCurrency(selectedSale.totalValue)}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-500">
                          Selecione uma venda pelo paciente, data ou valor...
                        </span>
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[var(--radix-popover-trigger-width)] p-0"
                    align="start"
                  >
                    <Command
                      filter={(value, search) => {
                        if (!search) return 1
                        return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
                      }}
                    >
                      <CommandInput placeholder="Digite para buscar paciente, número ou valor..." />
                      <CommandList className="max-h-64">
                        <CommandEmpty className="py-6 text-center text-xs text-slate-500">
                          Nenhuma venda encontrada.
                        </CommandEmpty>
                        <CommandGroup heading="Vendas Recentes">
                          {sales.map((sale) => (
                            <CommandItem
                              key={sale.id}
                              value={`${sale.patientName || ''} ${sale.number || ''} ${formatDate(sale.date)} ${sale.totalValue || ''}`}
                              onSelect={() => handleSelectSale(sale.id)}
                              className="flex items-center justify-between cursor-pointer py-2.5 px-3"
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <Check
                                  className={`h-4 w-4 shrink-0 text-teal-600 ${
                                    selectedSaleId === sale.id ? 'opacity-100' : 'opacity-0'
                                  }`}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-slate-900 truncate">
                                    {sale.patientName || 'Paciente avulso'}
                                  </div>
                                  <div className="text-[11px] text-slate-500 truncate flex items-center gap-2">
                                    <span>Venda #{sale.number}</span>
                                    <span>•</span>
                                    <span>{formatDate(sale.date)}</span>
                                    {sale.status && (
                                      <span className="text-[10px] uppercase font-semibold text-slate-400">
                                        ({sale.status})
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <span className="font-bold text-teal-700 shrink-0 ml-3">
                                {formatCurrency(sale.totalValue)}
                              </span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 3. Dados do Paciente (somente leitura) */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <User className="w-4 h-4 text-teal-600" />
              2. Dados do Paciente / Tomador
            </CardTitle>
            <CardDescription className="text-xs">
              Preenchido automaticamente a partir da venda selecionada (somente leitura)
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {loadingPatient ? (
              <div className="flex items-center justify-center py-4 text-xs text-slate-500 gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-teal-600" />
                Buscando dados do paciente...
              </div>
            ) : !selectedSale ? (
              <div className="text-center py-6 text-xs text-slate-400">
                Selecione uma venda acima para carregar as informações do paciente.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs font-semibold text-slate-600 mb-1 block">
                    Nome Completo
                  </Label>
                  <Input
                    value={patient?.name || selectedSale.patientName || '—'}
                    readOnly
                    disabled
                    className="h-9 bg-slate-50 text-slate-800 font-medium cursor-not-allowed"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-600 mb-1 block">CPF</Label>
                  <Input
                    value={patient?.cpf ? maskCPF(patient.cpf) : 'Não informado'}
                    readOnly
                    disabled
                    className="h-9 bg-slate-50 text-slate-800 cursor-not-allowed"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-600 mb-1 block">
                    Data de Nascimento
                  </Label>
                  <Input
                    value={patient?.birthDate ? formatDate(patient.birthDate) : 'Não informada'}
                    readOnly
                    disabled
                    className="h-9 bg-slate-50 text-slate-800 cursor-not-allowed"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 5. Campos da Nota Fiscal */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Hash className="w-4 h-4 text-teal-600" />
              3. Dados da Nota Fiscal
            </CardTitle>
            <CardDescription className="text-xs">
              Configure a numeração, data de emissão e tipo de documento
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label
                  htmlFor="numero-nf"
                  className="text-xs font-semibold text-slate-700 mb-1 block"
                >
                  Número da NF <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="numero-nf"
                    type="number"
                    min="1"
                    value={numeroNf}
                    onChange={(e) => setNumeroNf(Number(e.target.value) || 1)}
                    required
                    className="h-9 bg-white font-mono font-semibold"
                  />
                  {loadingNumero && (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-400 absolute right-3 top-2.5" />
                  )}
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Autoincremento com base na última NF
                </span>
              </div>

              <div>
                <Label
                  htmlFor="serie-nf"
                  className="text-xs font-semibold text-slate-700 mb-1 block"
                >
                  Série <span className="text-slate-400 font-normal">(opcional)</span>
                </Label>
                <Input
                  id="serie-nf"
                  type="text"
                  value={serie}
                  onChange={(e) => setSerie(e.target.value)}
                  placeholder="Ex: 1"
                  className="h-9 bg-white"
                />
              </div>

              <div>
                <Label
                  htmlFor="data-emissao"
                  className="text-xs font-semibold text-slate-700 mb-1 block"
                >
                  Data de Emissão <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="data-emissao"
                    type="date"
                    value={dataEmissao}
                    onChange={(e) => setDataEmissao(e.target.value)}
                    required
                    className="h-9 bg-white"
                  />
                </div>
              </div>

              <div>
                <Label
                  htmlFor="tipo-nf"
                  className="text-xs font-semibold text-slate-700 mb-1 block"
                >
                  Tipo de NF <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={tipoNf}
                  onValueChange={(val: 'nfe' | 'nfse' | 'ambos') => setTipoNf(val)}
                >
                  <SelectTrigger id="tipo-nf" className="h-9 bg-white">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nfe">NF-e (Produtos)</SelectItem>
                    <SelectItem value="nfse">NFS-e (Serviços)</SelectItem>
                    <SelectItem value="ambos">Ambos (Produtos + Serviços)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label
                htmlFor="observacoes"
                className="text-xs font-semibold text-slate-700 mb-1 block"
              >
                Observações <span className="text-slate-400 font-normal">(opcional)</span>
              </Label>
              <Textarea
                id="observacoes"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Informações complementares de interesse do contribuinte ou fisco..."
                className="text-sm min-h-[70px] bg-white resize-y"
              />
            </div>
          </CardContent>
        </Card>

        {/* 4. Lista de Itens (Produtos e Serviços) */}
        <div className="space-y-6">
          {/* Seção de Produtos (NF-e) */}
          {(tipoNf === 'nfe' || tipoNf === 'ambos') && (
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-teal-600" />
                    Itens de Produtos (NF-e)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Itens do tipo produto com CFOP e NCM editáveis
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddItem('produto')}
                  className="h-8 text-xs rounded-lg"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Adicionar Produto
                </Button>
              </CardHeader>
              <CardContent className="pt-4 p-0 sm:p-4">
                {produtos.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-400 border border-dashed rounded-lg m-4">
                    Nenhum produto incluído nesta emissão.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50/70">
                          <TableHead className="w-[35%] min-w-[200px]">Nome do Produto</TableHead>
                          <TableHead className="w-[12%] min-w-[90px]">Qtd</TableHead>
                          <TableHead className="w-[15%] min-w-[120px]">Valor Unit. (R$)</TableHead>
                          <TableHead className="w-[12%] min-w-[100px]">CFOP</TableHead>
                          <TableHead className="w-[12%] min-w-[100px]">NCM</TableHead>
                          <TableHead className="w-[14%] text-right min-w-[100px]">
                            Subtotal
                          </TableHead>
                          <TableHead className="w-[40px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {produtos.map((item) => {
                          const subtotal =
                            (Number(item.quantidade) || 0) * (Number(item.valor_unitario) || 0)
                          return (
                            <TableRow key={item.id}>
                              <TableCell className="py-2">
                                <Input
                                  value={item.nome}
                                  onChange={(e) =>
                                    handleItemChange(item.id, 'nome', e.target.value)
                                  }
                                  placeholder="Nome do produto"
                                  className="h-8 text-xs bg-white"
                                />
                              </TableCell>
                              <TableCell className="py-2">
                                <Input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={item.quantidade}
                                  onChange={(e) =>
                                    handleItemChange(
                                      item.id,
                                      'quantidade',
                                      Number(e.target.value) || 0,
                                    )
                                  }
                                  className="h-8 text-xs bg-white"
                                />
                              </TableCell>
                              <TableCell className="py-2">
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.valor_unitario}
                                  onChange={(e) =>
                                    handleItemChange(
                                      item.id,
                                      'valor_unitario',
                                      Number(e.target.value) || 0,
                                    )
                                  }
                                  className="h-8 text-xs bg-white font-medium"
                                />
                              </TableCell>
                              <TableCell className="py-2">
                                <Input
                                  value={item.cfop}
                                  onChange={(e) =>
                                    handleItemChange(item.id, 'cfop', e.target.value)
                                  }
                                  placeholder="5102"
                                  className="h-8 text-xs bg-white font-mono"
                                />
                              </TableCell>
                              <TableCell className="py-2">
                                <Input
                                  value={item.ncm}
                                  onChange={(e) => handleItemChange(item.id, 'ncm', e.target.value)}
                                  placeholder="Ex: 9021.40.00"
                                  className="h-8 text-xs bg-white font-mono"
                                />
                              </TableCell>
                              <TableCell className="py-2 text-right font-bold text-slate-800 text-xs">
                                {formatCurrency(subtotal)}
                              </TableCell>
                              <TableCell className="py-2 text-center">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRemoveItem(item.id)}
                                  className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                                  title="Remover item"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Seção de Serviços (NFS-e) */}
          {(tipoNf === 'nfse' || tipoNf === 'ambos') && (
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-teal-600" />
                    Itens de Serviços (NFS-e)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Itens do tipo serviço com código CNAE editável
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddItem('servico')}
                  className="h-8 text-xs rounded-lg"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Adicionar Serviço
                </Button>
              </CardHeader>
              <CardContent className="pt-4 p-0 sm:p-4">
                {servicos.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-400 border border-dashed rounded-lg m-4">
                    Nenhum serviço incluído nesta emissão.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50/70">
                          <TableHead className="w-[45%] min-w-[220px]">Nome do Serviço</TableHead>
                          <TableHead className="w-[12%] min-w-[90px]">Qtd</TableHead>
                          <TableHead className="w-[15%] min-w-[120px]">Valor Unit. (R$)</TableHead>
                          <TableHead className="w-[15%] min-w-[130px]">CNAE</TableHead>
                          <TableHead className="w-[13%] text-right min-w-[100px]">
                            Subtotal
                          </TableHead>
                          <TableHead className="w-[40px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {servicos.map((item) => {
                          const subtotal =
                            (Number(item.quantidade) || 0) * (Number(item.valor_unitario) || 0)
                          return (
                            <TableRow key={item.id}>
                              <TableCell className="py-2">
                                <Input
                                  value={item.nome}
                                  onChange={(e) =>
                                    handleItemChange(item.id, 'nome', e.target.value)
                                  }
                                  placeholder="Nome do serviço"
                                  className="h-8 text-xs bg-white"
                                />
                              </TableCell>
                              <TableCell className="py-2">
                                <Input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={item.quantidade}
                                  onChange={(e) =>
                                    handleItemChange(
                                      item.id,
                                      'quantidade',
                                      Number(e.target.value) || 0,
                                    )
                                  }
                                  className="h-8 text-xs bg-white"
                                />
                              </TableCell>
                              <TableCell className="py-2">
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.valor_unitario}
                                  onChange={(e) =>
                                    handleItemChange(
                                      item.id,
                                      'valor_unitario',
                                      Number(e.target.value) || 0,
                                    )
                                  }
                                  className="h-8 text-xs bg-white font-medium"
                                />
                              </TableCell>
                              <TableCell className="py-2">
                                <Input
                                  value={item.cnae}
                                  onChange={(e) =>
                                    handleItemChange(item.id, 'cnae', e.target.value)
                                  }
                                  placeholder="8650-0/00"
                                  className="h-8 text-xs bg-white font-mono"
                                />
                              </TableCell>
                              <TableCell className="py-2 text-right font-bold text-slate-800 text-xs">
                                {formatCurrency(subtotal)}
                              </TableCell>
                              <TableCell className="py-2 text-center">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRemoveItem(item.id)}
                                  className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                                  title="Remover item"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* 6. Resumo e 7. Botão Gerar */}
        <Card className="border-teal-200 bg-gradient-to-br from-teal-50/50 to-white shadow-sm">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              {/* Valores de Resumo */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1">
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                  <span className="text-xs font-semibold text-slate-500 block uppercase tracking-wider">
                    Total Produtos (NF-e)
                  </span>
                  <div className="text-lg font-bold text-slate-800 mt-1">
                    {formatCurrency(totalProdutos)}
                  </div>
                  <span className="text-[11px] text-slate-400">{produtos.length} item(ns)</span>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                  <span className="text-xs font-semibold text-slate-500 block uppercase tracking-wider">
                    Total Serviços (NFS-e)
                  </span>
                  <div className="text-lg font-bold text-slate-800 mt-1">
                    {formatCurrency(totalServicos)}
                  </div>
                  <span className="text-[11px] text-slate-400">{servicos.length} item(ns)</span>
                </div>

                <div className="bg-teal-600 text-white p-3.5 rounded-xl shadow-xs">
                  <span className="text-xs font-semibold text-teal-100 block uppercase tracking-wider">
                    Valor Total da NF
                  </span>
                  <div className="text-xl font-extrabold mt-1">{formatCurrency(totalNF)}</div>
                  <span className="text-[11px] text-teal-100">{items.length} total de itens</span>
                </div>
              </div>

              {/* Botão de Ação */}
              <div className="flex flex-col sm:flex-row gap-3 items-stretch lg:items-center">
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                  disabled={isSubmitting}
                  className="rounded-xl h-11 text-xs"
                >
                  Limpar Formulário
                </Button>

                <Button
                  type="submit"
                  disabled={isSubmitting || !selectedSaleId || items.length === 0}
                  className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl h-11 px-6 font-semibold shadow-md gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Emitindo Nota Fiscal...
                    </>
                  ) : (
                    <>
                      <FileCheck2 className="w-4 h-4" />
                      Gerar Nota Fiscal
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </form>

      {/* Modal de Sucesso com Ações de DANFE */}
      <Dialog open={successModalOpen} onOpenChange={setSuccessModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-center sm:text-left">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3 mx-auto sm:mx-0">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <DialogTitle className="text-lg font-bold text-slate-900">
              Nota Fiscal Emitida com Sucesso!
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-600">
              A Nota Fiscal <strong>nº {emittedNf?.numero}</strong> (Série {emittedNf?.serie || '1'}
              ) foi gerada e registrada no sistema com status <strong>Emitida</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 my-2 text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Destinatário:</span>
              <strong className="text-slate-800">{emittedPatient?.name || 'Cliente'}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Valor Total:</span>
              <strong className="text-teal-700 font-bold">
                {formatCurrency(emittedNf?.valor_total || 0)}
              </strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Data de Emissão:</span>
              <span className="text-slate-700 font-medium">
                {emittedNf?.data_emissao ? formatDate(emittedNf.data_emissao) : '—'}
              </span>
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSuccessModalOpen(false)}
              className="w-full sm:w-auto"
            >
              Fechar
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setPreviewModalOpen(true)
              }}
              className="w-full sm:w-auto gap-1.5"
            >
              <Eye className="w-4 h-4" />
              Visualizar DANFE
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (emittedNf) {
                  handlePrintDanfe(emittedNf, emittedPatient)
                }
              }}
              className="w-full sm:w-auto bg-blue-900 hover:bg-blue-950 text-white gap-1.5"
            >
              <Printer className="w-4 h-4" />
              Imprimir PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Pré-visualização do PDF DANFE */}
      <Dialog open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-900" />
                Visualização do DANFE
              </DialogTitle>
              <DialogDescription className="text-xs">
                NF-e / Documento Auxiliar da Nota Fiscal Eletrônica
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  if (emittedNf) {
                    handlePrintDanfe(emittedNf, emittedPatient)
                  }
                }}
                className="bg-blue-900 hover:bg-blue-950 text-white text-xs gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                Imprimir / Salvar PDF
              </Button>
            </div>
          </DialogHeader>

          {emittedNf && (
            <div className="py-4 bg-slate-100 rounded-lg p-2 sm:p-4 overflow-x-auto">
              <div className="bg-white p-4 sm:p-6 rounded-md shadow-md mx-auto max-w-[210mm]">
                <NotaFiscalPrint
                  notaFiscal={emittedNf}
                  patient={emittedPatient}
                  clinicSettings={clinicSettings}
                />
              </div>
            </div>
          )}

          <DialogFooter className="pt-2 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPreviewModalOpen(false)}
            >
              Fechar Pré-visualização
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default NotasFiscaisPage
