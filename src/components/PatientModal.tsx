import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { maskCPF, validateCPF, maskPhone, maskCEP, calculateAge } from '@/lib/formatters'
import { Patient, Gender, PatientStatus, HearingLossType } from '@/types'
import { Search, MapPin, UserCheck, Stethoscope, Shield } from 'lucide-react'

const BRAZIL_STATES = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
]

interface PatientModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  patientToEdit?: Patient | null
  onSave: (patientData: any) => void
}

export const PatientModal: React.FC<PatientModalProps> = ({
  open,
  onOpenChange,
  patientToEdit,
  onSave,
}) => {
  const [activeTab, setActiveTab] = useState('pessoais')

  // Form State
  const [name, setName] = useState('')
  const [cpf, setCpf] = useState('')
  const [cpfError, setCpfError] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [gender, setGender] = useState<Gender>('Feminino')
  const [phone, setPhone] = useState('')
  const [mobile, setMobile] = useState('')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<PatientStatus>('Ativo')

  // Endereço
  const [cep, setCep] = useState('')
  const [street, setStreet] = useState('')
  const [number, setNumber] = useState('')
  const [complement, setComplement] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('SP')
  const [loadingCep, setLoadingCep] = useState(false)

  // Convênio
  const [planType, setPlanType] = useState<'Particular' | 'Convênio'>('Particular')
  const [planName, setPlanName] = useState('')
  const [cardNumber, setCardNumber] = useState('')

  // Responsável Financeiro
  const [hasResponsible, setHasResponsible] = useState(false)
  const [respName, setRespName] = useState('')
  const [respRelationship, setRespRelationship] = useState('')
  const [respCpf, setRespCpf] = useState('')
  const [respCpfError, setRespCpfError] = useState('')
  const [respPhone, setRespPhone] = useState('')
  const [respEmail, setRespEmail] = useState('')

  // Histórico Auditivo
  const [hearingLossType, setHearingLossType] = useState<HearingLossType>('Normal')
  const [previousHearingAid, setPreviousHearingAid] = useState(false)
  const [previousAidBrand, setPreviousAidBrand] = useState('')
  const [previousAidModel, setPreviousAidModel] = useState('')
  const [generalNotes, setGeneralNotes] = useState('')

  // Erros gerais de validação obrigatória
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  // Preencher quando for edição
  useEffect(() => {
    if (patientToEdit) {
      setName(patientToEdit.name || '')
      setCpf(patientToEdit.cpf || '')
      setBirthDate(patientToEdit.birthDate || '')
      setGender(patientToEdit.gender || 'Feminino')
      setPhone(patientToEdit.phone || '')
      setMobile(patientToEdit.mobile || '')
      setEmail(patientToEdit.email || '')
      setStatus(patientToEdit.status || 'Ativo')

      setCep(patientToEdit.cep || '')
      setStreet(patientToEdit.street || '')
      setNumber(patientToEdit.number || '')
      setComplement(patientToEdit.complement || '')
      setNeighborhood(patientToEdit.neighborhood || '')
      setCity(patientToEdit.city || '')
      setState(patientToEdit.state || 'SP')

      setPlanType(patientToEdit.planType || 'Particular')
      setPlanName(patientToEdit.planName || '')
      setCardNumber(patientToEdit.cardNumber || '')

      setHasResponsible(!!patientToEdit.hasResponsible)
      if (patientToEdit.responsible) {
        setRespName(patientToEdit.responsible.name || '')
        setRespRelationship(patientToEdit.responsible.relationship || '')
        setRespCpf(patientToEdit.responsible.cpf || '')
        setRespPhone(patientToEdit.responsible.phone || '')
        setRespEmail(patientToEdit.responsible.email || '')
      } else {
        setRespName('')
        setRespRelationship('')
        setRespCpf('')
        setRespPhone('')
        setRespEmail('')
      }

      setHearingLossType(patientToEdit.hearingLossType || 'Normal')
      setPreviousHearingAid(!!patientToEdit.previousHearingAid)
      setPreviousAidBrand(patientToEdit.previousAidBrand || '')
      setPreviousAidModel(patientToEdit.previousAidModel || '')
      setGeneralNotes(patientToEdit.generalNotes || '')
    } else {
      // Reset para novo
      setName('')
      setCpf('')
      setBirthDate('')
      setGender('Feminino')
      setPhone('')
      setMobile('')
      setEmail('')
      setStatus('Ativo')

      setCep('')
      setStreet('')
      setNumber('')
      setComplement('')
      setNeighborhood('')
      setCity('São Paulo')
      setState('SP')

      setPlanType('Particular')
      setPlanName('')
      setCardNumber('')

      setHasResponsible(false)
      setRespName('')
      setRespRelationship('')
      setRespCpf('')
      setRespPhone('')
      setRespEmail('')

      setHearingLossType('Normal')
      setPreviousHearingAid(false)
      setPreviousAidBrand('')
      setPreviousAidModel('')
      setGeneralNotes('')
    }
    setCpfError('')
    setRespCpfError('')
    setFormErrors({})
    setActiveTab('pessoais')
  }, [patientToEdit, open])

  // Busca de CEP automática via ViaCEP
  const handleCepChange = async (val: string) => {
    const masked = maskCEP(val)
    setCep(masked)
    const cleanDigits = masked.replace(/\D/g, '')
    if (cleanDigits.length === 8) {
      setLoadingCep(true)
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanDigits}/json/`)
        const data = await res.json()
        if (!data.erro) {
          setStreet(data.logradouro || '')
          setNeighborhood(data.bairro || '')
          setCity(data.localidade || '')
          if (data.uf && BRAZIL_STATES.includes(data.uf)) {
            setState(data.uf)
          }
        }
      } catch (err) {
        console.error('Erro na busca de CEP:', err)
      } finally {
        setLoadingCep(false)
      }
    }
  }

  const handleCpfBlur = () => {
    if (cpf && !validateCPF(cpf)) {
      setCpfError('CPF inválido. Verifique os dígitos verificadores.')
    } else {
      setCpfError('')
    }
  }

  const handleRespCpfBlur = () => {
    if (respCpf && !validateCPF(respCpf)) {
      setRespCpfError('CPF do responsável inválido.')
    } else {
      setRespCpfError('')
    }
  }

  const calculatedAge = calculateAge(birthDate)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const errors: Record<string, string> = {}

    if (!name.trim()) errors.name = 'Nome completo é obrigatório'
    if (!cpf.trim()) {
      errors.cpf = 'CPF é obrigatório'
    } else if (!validateCPF(cpf)) {
      errors.cpf = 'CPF inválido'
    }
    if (!birthDate) errors.birthDate = 'Data de nascimento é obrigatória'
    if (!mobile.trim()) errors.mobile = 'Celular para contato é obrigatório'
    if (!street.trim()) errors.street = 'Logradouro / Rua é obrigatório'
    if (!number.trim()) errors.number = 'Número é obrigatório'
    if (!neighborhood.trim()) errors.neighborhood = 'Bairro é obrigatório'
    if (!city.trim()) errors.city = 'Cidade é obrigatória'

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      // Se houver erro na primeira aba, foca nela
      if (errors.name || errors.cpf || errors.birthDate || errors.mobile) {
        setActiveTab('pessoais')
      } else {
        setActiveTab('endereco')
      }
      return
    }

    const patientPayload: Omit<Patient, 'id' | 'createdAt'> = {
      name: name.trim(),
      cpf: maskCPF(cpf),
      birthDate,
      gender,
      phone: phone ? maskPhone(phone) : '',
      mobile: maskPhone(mobile),
      email: email.trim(),
      status,
      cep,
      street,
      number,
      complement,
      neighborhood,
      city,
      state,
      planType,
      planName: planType === 'Convênio' ? planName : undefined,
      cardNumber: planType === 'Convênio' ? cardNumber : undefined,
      hasResponsible,
      responsible: hasResponsible
        ? {
            name: respName,
            relationship: respRelationship,
            cpf: respCpf ? maskCPF(respCpf) : '',
            phone: respPhone ? maskPhone(respPhone) : '',
            email: respEmail,
          }
        : undefined,
      hearingLossType,
      previousHearingAid,
      previousAidBrand: previousHearingAid ? previousAidBrand : undefined,
      previousAidModel: previousHearingAid ? previousAidModel : undefined,
      generalNotes,
      lastVisit: patientToEdit?.lastVisit || new Date().toISOString().split('T')[0],
    }

    onSave(patientPayload)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-full max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
        <DialogHeader className="border-b border-slate-100 pb-4">
          <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-blue-600" />
            <span>{patientToEdit ? 'Editar Cadastro do Paciente' : 'Novo Paciente'}</span>
          </DialogTitle>
          <p className="text-xs text-slate-500 mt-0.5">
            Preencha as informações cadastrais, clínicas e de contato do paciente.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-2">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-2 sm:grid-cols-5 bg-slate-100 p-1 rounded-xl h-auto gap-1">
              <TabsTrigger value="pessoais" className="text-xs font-semibold py-2 rounded-lg">
                Pessoais
              </TabsTrigger>
              <TabsTrigger value="endereco" className="text-xs font-semibold py-2 rounded-lg">
                Endereço
              </TabsTrigger>
              <TabsTrigger value="convenio" className="text-xs font-semibold py-2 rounded-lg">
                Convênio
              </TabsTrigger>
              <TabsTrigger value="responsavel" className="text-xs font-semibold py-2 rounded-lg">
                Responsável
              </TabsTrigger>
              <TabsTrigger
                value="auditivo"
                className="text-xs font-semibold py-2 rounded-lg col-span-2 sm:col-span-1"
              >
                Hist. Auditivo
              </TabsTrigger>
            </TabsList>

            {/* ABA 1: DADOS PESSOAIS */}
            <TabsContent value="pessoais" className="space-y-4 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Nome */}
                <div className="sm:col-span-2">
                  <Label className="text-xs font-semibold text-slate-700">
                    Nome Completo <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Carlos Eduardo de Souza"
                    className="h-10 rounded-xl mt-1 text-sm border-slate-300"
                  />
                  {formErrors.name && (
                    <span className="text-[11px] text-red-500 mt-1 block font-medium">
                      {formErrors.name}
                    </span>
                  )}
                </div>

                {/* CPF */}
                <div>
                  <Label className="text-xs font-semibold text-slate-700">
                    CPF <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={cpf}
                    onChange={(e) => setCpf(maskCPF(e.target.value))}
                    onBlur={handleCpfBlur}
                    placeholder="000.000.000-00"
                    className={`h-10 rounded-xl mt-1 text-sm ${
                      cpfError || formErrors.cpf
                        ? 'border-red-500 bg-red-50/30'
                        : 'border-slate-300'
                    }`}
                  />
                  {(cpfError || formErrors.cpf) && (
                    <span className="text-[11px] text-red-500 mt-1 block font-medium">
                      {cpfError || formErrors.cpf}
                    </span>
                  )}
                </div>

                {/* Data de Nascimento + Idade */}
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-700">
                      Data de Nascimento <span className="text-red-500">*</span>
                    </Label>
                    {calculatedAge !== null && (
                      <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                        Idade: {calculatedAge} anos
                      </span>
                    )}
                  </div>
                  <Input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="h-10 rounded-xl mt-1 text-sm border-slate-300"
                  />
                  {formErrors.birthDate && (
                    <span className="text-[11px] text-red-500 mt-1 block font-medium">
                      {formErrors.birthDate}
                    </span>
                  )}
                </div>

                {/* Sexo */}
                <div>
                  <Label className="text-xs font-semibold text-slate-700">
                    Sexo <span className="text-red-500">*</span>
                  </Label>
                  <Select value={gender} onValueChange={(val: Gender) => setGender(val)}>
                    <SelectTrigger className="h-10 rounded-xl mt-1 border-slate-300 text-sm">
                      <SelectValue placeholder="Selecione o sexo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Feminino">Feminino</SelectItem>
                      <SelectItem value="Masculino">Masculino</SelectItem>
                      <SelectItem value="Outro">Outro</SelectItem>
                      <SelectItem value="Não informar">Não informar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Status */}
                <div>
                  <Label className="text-xs font-semibold text-slate-700">
                    Status do Paciente <span className="text-red-500">*</span>
                  </Label>
                  <Select value={status} onValueChange={(val: PatientStatus) => setStatus(val)}>
                    <SelectTrigger className="h-10 rounded-xl mt-1 border-slate-300 text-sm">
                      <SelectValue placeholder="Selecione o status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Ativo">Ativo</SelectItem>
                      <SelectItem value="Em tratamento">Em tratamento</SelectItem>
                      <SelectItem value="Inativo">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Celular */}
                <div>
                  <Label className="text-xs font-semibold text-slate-700">
                    Celular (WhatsApp) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={mobile}
                    onChange={(e) => setMobile(maskPhone(e.target.value))}
                    placeholder="(11) 90000-0000"
                    className="h-10 rounded-xl mt-1 text-sm border-slate-300"
                  />
                  {formErrors.mobile && (
                    <span className="text-[11px] text-red-500 mt-1 block font-medium">
                      {formErrors.mobile}
                    </span>
                  )}
                </div>

                {/* Telefone Fixo */}
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Telefone Fixo</Label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(maskPhone(e.target.value))}
                    placeholder="(11) 3000-0000"
                    className="h-10 rounded-xl mt-1 text-sm border-slate-300"
                  />
                </div>

                {/* E-mail */}
                <div className="sm:col-span-2">
                  <Label className="text-xs font-semibold text-slate-700">E-mail de Contato</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="paciente@exemplo.com.br"
                    className="h-10 rounded-xl mt-1 text-sm border-slate-300"
                  />
                </div>
              </div>
            </TabsContent>

            {/* ABA 2: ENDEREÇO */}
            <TabsContent value="endereco" className="space-y-4 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* CEP com busca automática */}
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-700">CEP</Label>
                    {loadingCep && (
                      <span className="text-[10px] text-blue-600 font-semibold animate-pulse">
                        Buscando endereço...
                      </span>
                    )}
                  </div>
                  <Input
                    value={cep}
                    onChange={(e) => handleCepChange(e.target.value)}
                    placeholder="00000-000"
                    className="h-10 rounded-xl mt-1 text-sm border-slate-300"
                  />
                </div>

                {/* Rua */}
                <div className="sm:col-span-2">
                  <Label className="text-xs font-semibold text-slate-700">
                    Logradouro (Rua / Av) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    placeholder="Ex: Avenida Paulista"
                    className="h-10 rounded-xl mt-1 text-sm border-slate-300"
                  />
                  {formErrors.street && (
                    <span className="text-[11px] text-red-500 mt-1 block font-medium">
                      {formErrors.street}
                    </span>
                  )}
                </div>

                {/* Número */}
                <div>
                  <Label className="text-xs font-semibold text-slate-700">
                    Número <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    placeholder="123"
                    className="h-10 rounded-xl mt-1 text-sm border-slate-300"
                  />
                  {formErrors.number && (
                    <span className="text-[11px] text-red-500 mt-1 block font-medium">
                      {formErrors.number}
                    </span>
                  )}
                </div>

                {/* Complemento */}
                <div className="sm:col-span-2">
                  <Label className="text-xs font-semibold text-slate-700">Complemento</Label>
                  <Input
                    value={complement}
                    onChange={(e) => setComplement(e.target.value)}
                    placeholder="Apto 42, Bloco B"
                    className="h-10 rounded-xl mt-1 text-sm border-slate-300"
                  />
                </div>

                {/* Bairro */}
                <div>
                  <Label className="text-xs font-semibold text-slate-700">
                    Bairro <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={neighborhood}
                    onChange={(e) => setNeighborhood(e.target.value)}
                    placeholder="Bairro"
                    className="h-10 rounded-xl mt-1 text-sm border-slate-300"
                  />
                  {formErrors.neighborhood && (
                    <span className="text-[11px] text-red-500 mt-1 block font-medium">
                      {formErrors.neighborhood}
                    </span>
                  )}
                </div>

                {/* Cidade */}
                <div>
                  <Label className="text-xs font-semibold text-slate-700">
                    Cidade <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="São Paulo"
                    className="h-10 rounded-xl mt-1 text-sm border-slate-300"
                  />
                  {formErrors.city && (
                    <span className="text-[11px] text-red-500 mt-1 block font-medium">
                      {formErrors.city}
                    </span>
                  )}
                </div>

                {/* Estado UF */}
                <div>
                  <Label className="text-xs font-semibold text-slate-700">
                    UF <span className="text-red-500">*</span>
                  </Label>
                  <Select value={state} onValueChange={setState}>
                    <SelectTrigger className="h-10 rounded-xl mt-1 border-slate-300 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BRAZIL_STATES.map((uf) => (
                        <SelectItem key={uf} value={uf}>
                          {uf}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            {/* ABA 3: CONVÊNIO */}
            <TabsContent value="convenio" className="space-y-4 pt-4">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-4">
                <div>
                  <Label className="text-xs font-semibold text-slate-700 mb-2 block">
                    Tipo de Cobertura
                  </Label>
                  <RadioGroup
                    value={planType}
                    onValueChange={(val: any) => setPlanType(val)}
                    className="flex items-center gap-6"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Particular" id="plan-part" />
                      <Label htmlFor="plan-part" className="text-sm font-medium cursor-pointer">
                        Particular
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Convênio" id="plan-conv" />
                      <Label htmlFor="plan-conv" className="text-sm font-medium cursor-pointer">
                        Convênio / Plano de Saúde
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {planType === 'Convênio' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
                    <div>
                      <Label className="text-xs font-semibold text-slate-700">
                        Nome da Operadora / Convênio
                      </Label>
                      <Input
                        value={planName}
                        onChange={(e) => setPlanName(e.target.value)}
                        placeholder="Ex: Bradesco Saúde, SulAmérica, Unimed"
                        className="h-10 rounded-xl mt-1 text-sm border-slate-300 bg-white"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-slate-700">
                        Número da Carteirinha / Matrícula
                      </Label>
                      <Input
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        placeholder="Ex: 9840192849012"
                        className="h-10 rounded-xl mt-1 text-sm border-slate-300 bg-white"
                      />
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ABA 4: RESPONSÁVEL FINANCEIRO */}
            <TabsContent value="responsavel" className="space-y-4 pt-4">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      Possui Responsável Financeiro / Acompanhante?
                    </h4>
                    <p className="text-xs text-slate-500">
                      Obrigatório caso o paciente seja menor de idade ou dependente legal
                    </p>
                  </div>
                  <Switch
                    checked={hasResponsible}
                    onCheckedChange={setHasResponsible}
                    className="data-[state=checked]:bg-blue-600"
                  />
                </div>

                {hasResponsible && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-200">
                    <div>
                      <Label className="text-xs font-semibold text-slate-700">
                        Nome do Responsável
                      </Label>
                      <Input
                        value={respName}
                        onChange={(e) => setRespName(e.target.value)}
                        placeholder="Nome completo do responsável"
                        className="h-10 rounded-xl mt-1 text-sm border-slate-300 bg-white"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-slate-700">
                        Grau de Parentesco
                      </Label>
                      <Input
                        value={respRelationship}
                        onChange={(e) => setRespRelationship(e.target.value)}
                        placeholder="Ex: Filho(a), Cônjuge, Pai/Mãe"
                        className="h-10 rounded-xl mt-1 text-sm border-slate-300 bg-white"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-slate-700">
                        CPF do Responsável
                      </Label>
                      <Input
                        value={respCpf}
                        onChange={(e) => setRespCpf(maskCPF(e.target.value))}
                        onBlur={handleRespCpfBlur}
                        placeholder="000.000.000-00"
                        className={`h-10 rounded-xl mt-1 text-sm bg-white ${
                          respCpfError ? 'border-red-500' : 'border-slate-300'
                        }`}
                      />
                      {respCpfError && (
                        <span className="text-[11px] text-red-500 mt-1 block font-medium">
                          {respCpfError}
                        </span>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-slate-700">
                        Telefone do Responsável
                      </Label>
                      <Input
                        value={respPhone}
                        onChange={(e) => setRespPhone(maskPhone(e.target.value))}
                        placeholder="(11) 90000-0000"
                        className="h-10 rounded-xl mt-1 text-sm border-slate-300 bg-white"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-xs font-semibold text-slate-700">
                        E-mail do Responsável
                      </Label>
                      <Input
                        type="email"
                        value={respEmail}
                        onChange={(e) => setRespEmail(e.target.value)}
                        placeholder="responsavel@exemplo.com.br"
                        className="h-10 rounded-xl mt-1 text-sm border-slate-300 bg-white"
                      />
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ABA 5: HISTÓRICO AUDITIVO */}
            <TabsContent value="auditivo" className="space-y-4 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Tipo de Perda */}
                <div>
                  <Label className="text-xs font-semibold text-slate-700">
                    Tipo de Perda Auditiva Declarada
                  </Label>
                  <Select
                    value={hearingLossType}
                    onValueChange={(val: HearingLossType) => setHearingLossType(val)}
                  >
                    <SelectTrigger className="h-10 rounded-xl mt-1 border-slate-300 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Normal">Audição Normal</SelectItem>
                      <SelectItem value="Condutiva">Condutiva</SelectItem>
                      <SelectItem value="Neurossensorial">Neurossensorial</SelectItem>
                      <SelectItem value="Mista">Mista</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Uso anterior de Aparelho */}
                <div>
                  <Label className="text-xs font-semibold text-slate-700 mb-2 block">
                    Já fez uso anterior de aparelho auditivo?
                  </Label>
                  <RadioGroup
                    value={previousHearingAid ? 'sim' : 'nao'}
                    onValueChange={(val) => setPreviousHearingAid(val === 'sim')}
                    className="flex items-center gap-6 mt-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="nao" id="aid-no" />
                      <Label htmlFor="aid-no" className="text-sm font-medium cursor-pointer">
                        Não
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="sim" id="aid-yes" />
                      <Label htmlFor="aid-yes" className="text-sm font-medium cursor-pointer">
                        Sim
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {previousHearingAid && (
                  <>
                    <div>
                      <Label className="text-xs font-semibold text-slate-700">
                        Marca do Aparelho Anterior
                      </Label>
                      <Input
                        value={previousAidBrand}
                        onChange={(e) => setPreviousAidBrand(e.target.value)}
                        placeholder="Ex: Phonak, Oticon, Widex, Signia"
                        className="h-10 rounded-xl mt-1 text-sm border-slate-300"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-slate-700">
                        Modelo do Aparelho Anterior
                      </Label>
                      <Input
                        value={previousAidModel}
                        onChange={(e) => setPreviousAidModel(e.target.value)}
                        placeholder="Ex: Pure Charge&Go, Moment 440"
                        className="h-10 rounded-xl mt-1 text-sm border-slate-300"
                      />
                    </div>
                  </>
                )}

                {/* Observações Gerais */}
                <div className="sm:col-span-2">
                  <Label className="text-xs font-semibold text-slate-700">
                    Observações Gerais e Queixas Iniciais
                  </Label>
                  <Textarea
                    value={generalNotes}
                    onChange={(e) => setGeneralNotes(e.target.value)}
                    placeholder="Histórico prévio, queixa de zumbido, hábitos auditivos..."
                    rows={3}
                    className="rounded-xl mt-1 text-sm border-slate-300 resize-none"
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
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
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm"
            >
              Salvar Paciente
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
