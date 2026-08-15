import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  HearingAid,
  HearingAidType,
  HearingAidSide,
  HearingAidStatus,
  PaymentMethod,
} from '@/types'
import { useApp } from '@/context/AppContext'
import { Ear } from 'lucide-react'

const BRANDS = ['Phonak', 'Signia', 'Widex', 'Oticon', 'Starkey', 'Resound', 'Unitron']
const TYPES: HearingAidType[] = ['BTE', 'RIC', 'ITE', 'CIC', 'IIC']
const SIDES: HearingAidSide[] = ['Direito', 'Esquerdo', 'Bilateral']
const STATUSES: HearingAidStatus[] = ['Em uso', 'Estoque', 'Vendido', 'Em manutenção']
const PAYMENT_METHODS: PaymentMethod[] = ['À vista', 'Parcelado', 'Boleto', 'Cartão']

interface HearingAidModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  aidToEdit?: HearingAid | null
  initialPatientId?: string
  onSave: (data: any) => void
}

export const HearingAidModal: React.FC<HearingAidModalProps> = ({
  open,
  onOpenChange,
  aidToEdit,
  initialPatientId,
  onSave,
}) => {
  const { patients } = useApp()

  const [brand, setBrand] = useState('Phonak')
  const [model, setModel] = useState('')
  const [type, setType] = useState<HearingAidType>('RIC')
  const [side, setSide] = useState<HearingAidSide>('Bilateral')
  const [serialNumber, setSerialNumber] = useState('')
  const [patientId, setPatientId] = useState<string>('none')
  const [saleDate, setSaleDate] = useState('')
  const [saleValue, setSaleValue] = useState<number>(0)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Parcelado')
  const [warrantyMonths, setWarrantyMonths] = useState<number>(24)
  const [powerSource, setPowerSource] = useState<'Pilha' | 'Recarregável'>('Recarregável')
  const [earMold, setEarMold] = useState(false)
  const [earMoldType, setEarMoldType] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<HearingAidStatus>('Estoque')

  useEffect(() => {
    if (aidToEdit) {
      setBrand(aidToEdit.brand)
      setModel(aidToEdit.model)
      setType(aidToEdit.type)
      setSide(aidToEdit.side)
      setSerialNumber(aidToEdit.serialNumber)
      setPatientId(aidToEdit.patientId || 'none')
      setSaleDate(aidToEdit.saleDate || '')
      setSaleValue(aidToEdit.saleValue || 0)
      setPaymentMethod(aidToEdit.paymentMethod || 'Parcelado')
      setWarrantyMonths(aidToEdit.warrantyMonths || 24)
      setPowerSource(aidToEdit.powerSource || 'Recarregável')
      setEarMold(!!aidToEdit.earMold)
      setEarMoldType(aidToEdit.earMoldType || '')
      setNotes(aidToEdit.notes || '')
      setStatus(aidToEdit.status)
    } else {
      setBrand('Phonak')
      setModel('')
      setType('RIC')
      setSide('Bilateral')
      setSerialNumber('')
      setPatientId(initialPatientId || 'none')
      setSaleDate(new Date().toISOString().split('T')[0])
      setSaleValue(0)
      setPaymentMethod('Parcelado')
      setWarrantyMonths(24)
      setPowerSource('Recarregável')
      setEarMold(false)
      setEarMoldType('')
      setNotes('')
      setStatus(initialPatientId ? 'Em uso' : 'Estoque')
    }
  }, [aidToEdit, open, initialPatientId])

  // Cálculo da data de término da garantia
  const calculatedWarrantyEndDate = React.useMemo(() => {
    if (!saleDate) return ''
    const d = new Date(saleDate)
    d.setMonth(d.getMonth() + Number(warrantyMonths))
    return d.toISOString().split('T')[0]
  }, [saleDate, warrantyMonths])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const patientObj = patients.find((p) => p.id === patientId)

    const payload = {
      brand,
      model: model.trim(),
      type,
      side,
      serialNumber: serialNumber.trim(),
      patientId: patientId !== 'none' ? patientId : undefined,
      patientName: patientObj ? patientObj.name : undefined,
      saleDate: saleDate || undefined,
      saleValue: Number(saleValue) || undefined,
      paymentMethod,
      warrantyMonths: Number(warrantyMonths),
      warrantyEndDate: calculatedWarrantyEndDate,
      powerSource,
      earMold,
      earMoldType: earMold ? earMoldType : undefined,
      notes,
      status: patientId !== 'none' && status === 'Estoque' ? 'Em uso' : status,
    }

    onSave(payload)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
        <DialogHeader className="border-b border-slate-100 pb-3">
          <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Ear className="w-5 h-5 text-teal-600" />
            <span>{aidToEdit ? 'Editar Aparelho Auditivo' : 'Novo Aparelho Auditivo'}</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-semibold text-slate-700">
                Marca / Fabricante <span className="text-red-500">*</span>
              </Label>
              <Select value={brand} onValueChange={setBrand}>
                <SelectTrigger className="h-10 rounded-xl mt-1 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BRANDS.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">
                Modelo do Aparelho <span className="text-red-500">*</span>
              </Label>
              <Input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="Ex: Audéo Lumity L90-R"
                required
                className="h-10 rounded-xl mt-1 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs font-semibold text-slate-700">Tipo / Formato</Label>
              <Select value={type} onValueChange={(v: HearingAidType) => setType(v)}>
                <SelectTrigger className="h-10 rounded-xl mt-1 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">Lado / Adaptação</Label>
              <Select value={side} onValueChange={(v: HearingAidSide) => setSide(v)}>
                <SelectTrigger className="h-10 rounded-xl mt-1 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SIDES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">
                Nº de Série <span className="text-red-500">*</span>
              </Label>
              <Input
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                placeholder="Ex: PH-2024-9910"
                required
                className="h-10 rounded-xl mt-1 text-xs font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-semibold text-slate-700">Paciente Vinculado</Label>
              <Select value={patientId} onValueChange={setPatientId}>
                <SelectTrigger className="h-10 rounded-xl mt-1 text-xs">
                  <SelectValue placeholder="Selecione ou deixe em Estoque" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Em Estoque (Sem paciente)</SelectItem>
                  {patients.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">Status</Label>
              <Select value={status} onValueChange={(v: HearingAidStatus) => setStatus(v)}>
                <SelectTrigger className="h-10 rounded-xl mt-1 text-xs font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((st) => (
                    <SelectItem key={st} value={st}>
                      {st}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Venda e Garantia */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Dados de Venda e Garantia Contratual
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-[11px] text-slate-700">Data de Venda</Label>
                <Input
                  type="date"
                  value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)}
                  className="h-9 rounded-lg text-xs bg-white mt-1"
                />
              </div>

              <div>
                <Label className="text-[11px] text-slate-700">Valor de Venda (R$)</Label>
                <Input
                  type="number"
                  value={saleValue}
                  onChange={(e) => setSaleValue(Number(e.target.value))}
                  className="h-9 rounded-lg text-xs bg-white mt-1"
                />
              </div>

              <div>
                <Label className="text-[11px] text-slate-700">Forma de Pagamento</Label>
                <Select
                  value={paymentMethod}
                  onValueChange={(v: PaymentMethod) => setPaymentMethod(v)}
                >
                  <SelectTrigger className="h-9 rounded-lg text-xs bg-white mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((pm) => (
                      <SelectItem key={pm} value={pm}>
                        {pm}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-[11px] text-slate-700">Garantia (Meses)</Label>
                <Input
                  type="number"
                  value={warrantyMonths}
                  onChange={(e) => setWarrantyMonths(Number(e.target.value))}
                  className="h-9 rounded-lg text-xs bg-white mt-1"
                />
              </div>

              <div className="sm:col-span-2">
                <Label className="text-[11px] text-slate-700">
                  Término da Garantia (Automático)
                </Label>
                <Input
                  type="date"
                  disabled
                  value={calculatedWarrantyEndDate}
                  className="h-9 rounded-lg text-xs bg-slate-100 font-bold text-navy-700 mt-1"
                />
              </div>
            </div>
          </div>

          {/* Alimentação e Molde */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-semibold text-slate-700 mb-2 block">
                Fonte de Energia
              </Label>
              <RadioGroup
                value={powerSource}
                onValueChange={(v: any) => setPowerSource(v)}
                className="flex items-center gap-6 mt-1"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Recarregável" id="p-rec" />
                  <Label htmlFor="p-rec" className="text-xs font-medium cursor-pointer">
                    Recarregável (Li-ion)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Pilha" id="p-pil" />
                  <Label htmlFor="p-pil" className="text-xs font-medium cursor-pointer">
                    Pilha Auditiva
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700 mb-2 block">
                Molde Auricular Customizado?
              </Label>
              <RadioGroup
                value={earMold ? 'sim' : 'nao'}
                onValueChange={(v) => setEarMold(v === 'sim')}
                className="flex items-center gap-6 mt-1"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="nao" id="em-no" />
                  <Label htmlFor="em-no" className="text-xs font-medium cursor-pointer">
                    Não (Oliva padrão)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="sim" id="em-yes" />
                  <Label htmlFor="em-yes" className="text-xs font-medium cursor-pointer">
                    Sim (Molde anatômico)
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {earMold && (
              <div className="sm:col-span-2">
                <Label className="text-xs font-semibold text-slate-700">
                  Tipo do Molde Auricular
                </Label>
                <Input
                  value={earMoldType}
                  onChange={(e) => setEarMoldType(e.target.value)}
                  placeholder="Ex: Molde Acrílico com Ventilação 1.5mm, CShell Silicone"
                  className="h-10 rounded-xl mt-1 text-xs"
                />
              </div>
            )}
          </div>

          <div>
            <Label className="text-xs font-semibold text-slate-700">Observações Gerais</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Número de canais, acessórios emparelhados, particularidades..."
              rows={2}
              className="rounded-xl mt-1 text-xs border-slate-300 resize-none"
            />
          </div>

          <DialogFooter className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl border-slate-300 text-xs font-semibold"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-xs font-semibold shadow-sm"
            >
              Salvar Aparelho
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
