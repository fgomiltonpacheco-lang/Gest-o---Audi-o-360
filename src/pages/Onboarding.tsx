// src/pages/Onboarding.tsx
// ============================================================
// Wizard de Onboarding (Fase 4 do SaaS).
//
// Aparece SOMENTE no primeiro login do admin de uma clínica recém-criada
// (clinica.onboarding_completed === false). 3 etapas:
//   1. Logo e Identidade
//   2. Endereço e Contato (com busca CEP via ViaCEP)
//   3. Primeiro Profissional
//
// Ao concluir: salva logo + nome + endereço na clínica, cria o
// profissional (role 'profissional'), marca onboarding_completed = true
// e redireciona para o Dashboard.
// ============================================================

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2,
  MapPin,
  Users as UsersIcon,
  Upload,
  Check,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  Ear,
  Loader2,
  Search,
  Mail,
  Lock,
  Phone,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useApp } from '@/context/AppContext'
import { useToast } from '@/hooks/use-toast'
import { useIsMobile } from '@/hooks/use-mobile'
import pb from '@/lib/pocketbase/client'
import { maskPhone, maskCEP } from '@/lib/formatters'
import { validatePassword } from '@/lib/passwordPolicy'
import { PasswordChecklist } from '@/components/PasswordChecklist'
import { cn } from '@/lib/utils'

// ============================================================
// Tipos & constantes
// ============================================================

interface EnderecoData {
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  estado: string
}

const UFS = [
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

const FUNCOES = [
  'Fonoaudiólogo(a)',
  'Otorrinolaringologista',
  'Técnico(a) em Próteses Auditivas',
  'Auxiliar Administrativo',
]

const STEPS = [
  { id: 1, label: 'Identidade', icon: Building2 },
  { id: 2, label: 'Endereço', icon: MapPin },
  { id: 3, label: 'Equipe', icon: UsersIcon },
] as const

const MAX_LOGO_SIZE = 2 * 1024 * 1024 // 2MB

// ============================================================
// Componente principal
// ============================================================

export default function Onboarding() {
  const navigate = useNavigate()
  const { currentUser, markOnboardingCompleted } = useApp()
  const { toast } = useToast()
  const isMobile = useIsMobile()

  const [step, setStep] = useState(1)
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward')
  const [loading, setLoading] = useState(true)
  const [clinicaId, setClinicaId] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [erro, setErro] = useState('')

  // ---- Etapa 1: Logo & Identidade ----
  const [nomeClinica, setNomeClinica] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string>('')
  const [logoExisting, setLogoExisting] = useState<string>('')
  const [logoExistingRecord, setLogoExistingRecord] = useState<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ---- Etapa 2: Endereço & Contato ----
  const [cep, setCep] = useState('')
  const [logradouro, setLogradouro] = useState('')
  const [numero, setNumero] = useState('')
  const [complemento, setComplemento] = useState('')
  const [bairro, setBairro] = useState('')
  const [cidade, setCidade] = useState('')
  const [estado, setEstado] = useState('')
  const [telefone, setTelefone] = useState('')
  const [cepLoading, setCepLoading] = useState(false)
  const [cepErro, setCepErro] = useState('')

  // ---- Etapa 3: Primeiro Profissional ----
  const [profNome, setProfNome] = useState('')
  const [profEmail, setProfEmail] = useState('')
  const [profFuncao, setProfFuncao] = useState('')
  const [profSenha, setProfSenha] = useState('')
  const [profSenhaConfirm, setProfSenhaConfirm] = useState('')
  const [showSenha, setShowSenha] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [cadastrarOutro, setCadastrarOutro] = useState(false)

  // ---------- Carregar dados da clínica ----------
  const carregarClinica = useCallback(async () => {
    if (!currentUser?.clinicaId) {
      setLoading(false)
      return
    }
    try {
      const clinica: any = await pb.collection('clinicas').getOne(currentUser.clinicaId)
      setClinicaId(clinica.id)
      setNomeClinica(clinica.nome || '')

      // Logo existente (para preview)
      if (clinica.logo) {
        setLogoExisting(clinica.logo)
        setLogoExistingRecord(clinica)
      }

      // Telefone existente
      if (clinica.telefone) {
        setTelefone(clinica.telefone)
      }

      // Endereço existente (se já preenchido como JSON)
      if (clinica.endereco && typeof clinica.endereco === 'object') {
        const end = clinica.endereco as EnderecoData
        setCep(end.cep || '')
        setLogradouro(end.logradouro || '')
        setNumero(end.numero || '')
        setComplemento(end.complemento || '')
        setBairro(end.bairro || '')
        setCidade(end.cidade || '')
        setEstado(end.estado || '')
      }
    } catch (err) {
      console.error('Erro ao carregar clínica:', err)
    } finally {
      setLoading(false)
    }
  }, [currentUser?.clinicaId])

  useEffect(() => {
    carregarClinica()
  }, [carregarClinica])

  // ---------- Guarda: se onboarding já concluído, redireciona ----------
  useEffect(() => {
    if (currentUser && currentUser.onboardingCompleted === true) {
      navigate('/', { replace: true })
    }
  }, [currentUser, navigate])

  // ---------- Logo preview ----------
  const logoPreviewUrl =
    logoPreview ||
    (logoExisting && logoExistingRecord ? pb.files.getUrl(logoExistingRecord, logoExisting) : '')

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setErro('')

    // Validação: PNG ou JPG, máx 2MB
    const validTypes = ['image/png', 'image/jpeg']
    if (!validTypes.includes(file.type)) {
      setErro('Formato não suportado. Envie uma imagem PNG ou JPG.')
      return
    }
    if (file.size > MAX_LOGO_SIZE) {
      setErro('A imagem excede o limite de 2MB.')
      return
    }

    setLogoFile(file)
    // Preview em tempo real
    const reader = new FileReader()
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const handleRemoveLogo = () => {
    setLogoFile(null)
    setLogoPreview('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ---------- Buscar CEP via ViaCEP ----------
  const handleBuscarCep = async () => {
    const cepDigits = cep.replace(/\D/g, '')
    if (cepDigits.length !== 8) {
      setCepErro('Informe um CEP com 8 dígitos.')
      return
    }
    setCepLoading(true)
    setCepErro('')
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`)
      const data = await res.json()
      if (data.erro) {
        setCepErro('CEP não encontrado.')
      } else {
        setLogradouro(data.logradouro || '')
        setBairro(data.bairro || '')
        setCidade(data.localidade || '')
        setEstado(data.uf || '')
        // Foca no campo número após preencher
      }
    } catch (err) {
      setCepErro('Não foi possível buscar o CEP. Tente novamente.')
    } finally {
      setCepLoading(false)
    }
  }

  // ---------- Validações de etapa ----------
  const step1Valid = nomeClinica.trim().length >= 2
  const step2Valid =
    cep.trim().length > 0 &&
    logradouro.trim().length > 0 &&
    numero.trim().length > 0 &&
    cidade.trim().length > 0 &&
    estado.length > 0

  const { valid: senhaValida } = validatePassword(profSenha)
  const senhasIguais = profSenha.length > 0 && profSenha === profSenhaConfirm
  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profEmail.trim())
  const step3Valid =
    profNome.trim().length >= 3 && emailValido && !!profFuncao && senhaValida && senhasIguais

  // ---------- Navegação entre etapas ----------
  const goToStep = (newStep: number, dir: 'forward' | 'backward') => {
    setDirection(dir)
    setStep(newStep)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleNext = () => {
    if (step === 1) {
      if (!step1Valid) {
        setErro('Informe o nome da clínica (mín. 2 caracteres).')
        return
      }
      setErro('')
      goToStep(2, 'forward')
    } else if (step === 2) {
      if (!step2Valid) {
        setErro('Preencha CEP, logradouro, número, cidade e estado.')
        return
      }
      setErro('')
      goToStep(3, 'forward')
    }
  }

  const handleBack = () => {
    setErro('')
    if (step === 2) goToStep(1, 'backward')
    else if (step === 3) goToStep(2, 'backward')
  }

  // ---------- Concluir ----------
  const handleConcluir = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')

    if (!step3Valid) {
      setErro('Verifique os campos do profissional: nome, e-mail, função, senha e confirmação.')
      return
    }

    setSubmitting(true)
    try {
      // 1. Atualiza a clínica: nome + logo + telefone + endereco (JSON) + onboarding_completed
      const formData = new FormData()
      formData.append('nome', nomeClinica.trim())
      formData.append('telefone', telefone.trim() || '')
      formData.append('onboarding_completed', 'true')

      const enderecoJson: EnderecoData = {
        cep: cep.trim(),
        logradouro: logradouro.trim(),
        numero: numero.trim(),
        complemento: complemento.trim(),
        bairro: bairro.trim(),
        cidade: cidade.trim(),
        estado: estado.trim(),
      }
      formData.append('endereco', JSON.stringify(enderecoJson))

      if (logoFile) {
        formData.append('logo', logoFile)
      }

      await pb.collection('clinicas').update(clinicaId, formData)

      // 2. Cria o profissional na coleção users
      try {
        await pb.collection('users').create({
          name: profNome.trim(),
          email: profEmail.trim().toLowerCase(),
          role: 'profissional',
          clinica_id: clinicaId,
          crmCrfa: profFuncao, // armazena a função no campo de registro
          password: profSenha,
          passwordConfirm: profSenhaConfirm,
          force_password_change: false,
          is_super_admin: false,
        })
      } catch (err) {
        // Se o profissional falhar, NÃO bloqueia o onboarding — apenas avisa.
        console.warn('Erro ao criar profissional no onboarding:', err)
        toast({
          title: 'Profissional não cadastrado',
          description:
            'A clínica foi configurada, mas houve um erro ao criar o profissional. Você pode cadastrá-lo depois em Usuários.',
          variant: 'destructive',
        })
      }

      // 3. Marca onboarding concluído no estado local
      markOnboardingCompleted()

      // 4. Toast de boas-vindas + redireciona para o Dashboard
      toast({
        title: 'Bem-vindo ao Audição360!',
        description: 'Sua clínica está pronta para uso.',
      })
      navigate('/', { replace: true })
    } catch (err: any) {
      console.error('Erro ao concluir onboarding:', err)
      const msg =
        err?.response?.message ||
        err?.message ||
        'Não foi possível concluir o onboarding. Tente novamente.'
      setErro(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // ---------- Render ----------
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1e3a8a] via-[#1d4ed8] to-[#2563eb]">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    )
  }

  const containerBg = isMobile
    ? 'min-h-screen bg-white'
    : 'min-h-screen w-full bg-gradient-to-br from-[#1e3a8a] via-[#1d4ed8] to-[#2563eb] p-4 sm:p-8 relative overflow-hidden'

  return (
    <div className={containerBg}>
      {/* Decoração de fundo (desktop) */}
      {!isMobile && (
        <>
          <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px]" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-cyan-300/10 rounded-full blur-3xl pointer-events-none" />
        </>
      )}

      <div
        className={cn(
          'relative mx-auto',
          isMobile ? 'px-4 py-6 max-w-[600px]' : 'max-w-[600px] flex items-center min-h-screen',
        )}
      >
        <div
          className={cn(
            'w-full bg-white relative z-10',
            isMobile
              ? 'rounded-none shadow-none'
              : 'rounded-2xl shadow-2xl border border-white/20 p-6 sm:p-8',
          )}
        >
          {/* ---------- Header ---------- */}
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#1e3a8a] text-white font-bold text-base">
                A
              </div>
              <span className="text-lg font-bold text-slate-900">Audição360</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Configuração Inicial</h1>
            <p className="text-sm text-slate-500 mt-1">
              Vamos deixar sua clínica pronta em 3 passos rápidos.
            </p>
          </div>

          {/* ---------- Barra de progresso ---------- */}
          <ProgressBar currentStep={step} />

          {/* ---------- Mensagem de erro ---------- */}
          {erro && (
            <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600 font-medium flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{erro}</span>
            </div>
          )}

          {/* ---------- Conteúdo da etapa ---------- */}
          <div className="mt-6">
            {step === 1 && (
              <StepIdentity
                direction={direction}
                nomeClinica={nomeClinica}
                setNomeClinica={setNomeClinica}
                logoPreviewUrl={logoPreviewUrl}
                handleLogoChange={handleLogoChange}
                handleRemoveLogo={handleRemoveLogo}
                fileInputRef={fileInputRef}
              />
            )}
            {step === 2 && (
              <StepAddress
                direction={direction}
                cep={cep}
                setCep={setCep}
                logradouro={logradouro}
                setLogradouro={setLogradouro}
                numero={numero}
                setNumero={setNumero}
                complemento={complemento}
                setComplemento={setComplemento}
                bairro={bairro}
                setBairro={setBairro}
                cidade={cidade}
                setCidade={setCidade}
                estado={estado}
                setEstado={setEstado}
                telefone={telefone}
                setTelefone={setTelefone}
                cepLoading={cepLoading}
                cepErro={cepErro}
                setCepErro={setCepErro}
                onBuscarCep={handleBuscarCep}
              />
            )}
            {step === 3 && (
              <StepTeam
                direction={direction}
                profNome={profNome}
                setProfNome={setProfNome}
                profEmail={profEmail}
                setProfEmail={setProfEmail}
                profFuncao={profFuncao}
                setProfFuncao={setProfFuncao}
                profSenha={profSenha}
                setProfSenha={setProfSenha}
                profSenhaConfirm={profSenhaConfirm}
                setProfSenhaConfirm={setProfSenhaConfirm}
                showSenha={showSenha}
                setShowSenha={setShowSenha}
                showConfirm={showConfirm}
                setShowConfirm={setShowConfirm}
                cadastrarOutro={cadastrarOutro}
                setCadastrarOutro={setCadastrarOutro}
                senhaValida={senhaValida}
                senhasIguais={senhasIguais}
              />
            )}
          </div>

          {/* ---------- Botões de navegação ---------- */}
          <div className="flex items-center justify-between mt-7 pt-5 border-t border-slate-100">
            {step > 1 ? (
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                disabled={submitting}
                className="rounded-xl border-slate-300 text-sm font-semibold h-11 px-5 flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </Button>
            ) : (
              <span />
            )}

            {step < 3 ? (
              <Button
                type="button"
                onClick={handleNext}
                className="bg-[#1e3a8a] hover:bg-[#1e40af] text-white font-semibold rounded-xl h-11 px-6 flex items-center gap-2 shadow-sm"
              >
                Próximo
                <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleConcluir}
                disabled={submitting}
                className="bg-[#1e3a8a] hover:bg-[#1e40af] text-white font-bold rounded-xl h-11 px-6 flex items-center gap-2 shadow-sm"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Concluindo...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Concluir
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Barra de progresso — 3 steps numerados com linhas conectando
// ============================================================

function ProgressBar({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center">
      <div className="flex items-center w-full max-w-[320px]">
        {STEPS.map((s, i) => {
          const StepIcon = s.icon
          const isDone = currentStep > s.id
          const isCurrent = currentStep === s.id
          return (
            <React.Fragment key={s.id}>
              {/* Círculo numerado */}
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <div
                  className={cn(
                    'flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300',
                    isDone && 'bg-emerald-500 border-emerald-500 text-white',
                    isCurrent &&
                      'bg-[#1e3a8a] border-[#1e3a8a] text-white shadow-md ring-4 ring-[#1e3a8a]/15',
                    !isDone && !isCurrent && 'bg-white border-slate-300 text-slate-400',
                  )}
                >
                  {isDone ? <Check className="w-5 h-5" /> : <StepIcon className="w-5 h-5" />}
                </div>
                <span
                  className={cn(
                    'text-[11px] font-semibold transition-colors',
                    isDone || isCurrent ? 'text-slate-800' : 'text-slate-400',
                  )}
                >
                  {s.label}
                </span>
              </div>
              {/* Linha conectora */}
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    'flex-1 h-0.5 mx-2 mb-5 transition-colors duration-300',
                    currentStep > s.id ? 'bg-emerald-500' : 'bg-slate-200',
                  )}
                />
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================
// Etapa 1 — Logo e Identidade
// ============================================================

interface StepIdentityProps {
  direction: 'forward' | 'backward'
  nomeClinica: string
  setNomeClinica: (v: string) => void
  logoPreviewUrl: string
  handleLogoChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleRemoveLogo: () => void
  fileInputRef: React.RefObject<HTMLInputElement>
}

function StepIdentity({
  nomeClinica,
  setNomeClinica,
  logoPreviewUrl,
  handleLogoChange,
  handleRemoveLogo,
  fileInputRef,
}: StepIdentityProps) {
  return (
    <div className="animate-in fade-in-50 duration-300 space-y-5">
      {/* Título */}
      <div>
        <h2 className="text-lg font-bold text-slate-900">Logo e Identidade</h2>
        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
          <Building2 className="w-3.5 h-3.5" />
          Esses dados aparecerão nos laudos e na sua identidade visual.
        </p>
      </div>

      {/* Preview circular da logo */}
      <div className="flex flex-col items-center gap-3 py-2">
        <div className="relative">
          <div className="w-[150px] h-[150px] rounded-full border-4 border-[#1e3a8a] overflow-hidden flex items-center justify-center bg-slate-50">
            {logoPreviewUrl ? (
              <img
                src={logoPreviewUrl}
                alt="Logo da clínica"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center gap-1 text-slate-300">
                <Ear className="w-12 h-12" />
                <span className="text-[10px] font-medium text-slate-400">Sem logo</span>
              </div>
            )}
          </div>
          {logoPreviewUrl && (
            <button
              type="button"
              onClick={handleRemoveLogo}
              className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md hover:bg-red-600 transition-colors"
              aria-label="Remover logo"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Upload de imagem */}
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg"
          onChange={handleLogoChange}
          className="hidden"
          id="logo-upload"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          className="w-full rounded-xl border-slate-300 text-sm font-semibold h-11 flex items-center justify-center gap-2"
        >
          <Upload className="w-4 h-4" />
          {logoPreviewUrl ? 'Trocar logo' : 'Enviar logo'}
        </Button>
        <p className="text-[11px] text-slate-400 mt-1.5 text-center">PNG ou JPG, máximo 2MB</p>
      </div>

      {/* Nome da clínica */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-slate-700">
          Nome da Clínica <span className="text-red-500">*</span>
        </Label>
        <div className="relative">
          <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            value={nomeClinica}
            onChange={(e) => setNomeClinica(e.target.value)}
            placeholder="Nome da sua clínica"
            required
            className="h-11 pl-10 rounded-xl border-slate-300 focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20 text-sm"
          />
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Etapa 2 — Endereço e Contato
// ============================================================

interface StepAddressProps {
  direction: 'forward' | 'backward'
  cep: string
  setCep: (v: string) => void
  logradouro: string
  setLogradouro: (v: string) => void
  numero: string
  setNumero: (v: string) => void
  complemento: string
  setComplemento: (v: string) => void
  bairro: string
  setBairro: (v: string) => void
  cidade: string
  setCidade: (v: string) => void
  estado: string
  setEstado: (v: string) => void
  telefone: string
  setTelefone: (v: string) => void
  cepLoading: boolean
  cepErro: string
  setCepErro: (v: string) => void
  onBuscarCep: () => void
}

function StepAddress({
  cep,
  setCep,
  logradouro,
  setLogradouro,
  numero,
  setNumero,
  complemento,
  setComplemento,
  bairro,
  setBairro,
  cidade,
  setCidade,
  estado,
  setEstado,
  telefone,
  setTelefone,
  cepLoading,
  cepErro,
  setCepErro,
  onBuscarCep,
}: StepAddressProps) {
  const cepDigits = cep.replace(/\D/g, '')
  const canBuscarCep = cepDigits.length === 8

  return (
    <div className="animate-in fade-in-50 duration-300 space-y-4">
      {/* Título */}
      <div>
        <h2 className="text-lg font-bold text-slate-900">Endereço e Contato</h2>
        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5" />
          Endereço que aparecerá nos documentos fiscais e laudos.
        </p>
      </div>

      {/* CEP + botão buscar */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-slate-700">CEP</Label>
        <div className="flex gap-2">
          <Input
            value={cep}
            onChange={(e) => {
              setCep(maskCEP(e.target.value))
              setCepErro('')
            }}
            placeholder="00000-000"
            inputMode="numeric"
            className="h-11 rounded-xl border-slate-300 focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20 text-sm"
          />
          <Button
            type="button"
            variant="outline"
            onClick={onBuscarCep}
            disabled={!canBuscarCep || cepLoading}
            className="h-11 rounded-xl border-slate-300 text-sm font-semibold px-4 flex items-center gap-2 shrink-0"
          >
            {cepLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            Buscar
          </Button>
        </div>
        {cepErro && <p className="text-xs text-red-500 mt-1">{cepErro}</p>}
      </div>

      {/* Logradouro */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-slate-700">
          Logradouro <span className="text-red-500">*</span>
        </Label>
        <Input
          value={logradouro}
          onChange={(e) => setLogradouro(e.target.value)}
          placeholder="Rua, avenida..."
          className="h-11 rounded-xl border-slate-300 focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20 text-sm"
        />
      </div>

      {/* Número + Complemento */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-700">
            Número <span className="text-red-500">*</span>
          </Label>
          <Input
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            placeholder="123"
            className="h-11 rounded-xl border-slate-300 focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-700">Complemento</Label>
          <Input
            value={complemento}
            onChange={(e) => setComplemento(e.target.value)}
            placeholder="Sala 2"
            className="h-11 rounded-xl border-slate-300 focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20 text-sm"
          />
        </div>
      </div>

      {/* Bairro */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-slate-700">Bairro</Label>
        <Input
          value={bairro}
          onChange={(e) => setBairro(e.target.value)}
          placeholder="Centro"
          className="h-11 rounded-xl border-slate-300 focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20 text-sm"
        />
      </div>

      {/* Cidade + Estado */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label className="text-xs font-semibold text-slate-700">
            Cidade <span className="text-red-500">*</span>
          </Label>
          <Input
            value={cidade}
            onChange={(e) => setCidade(e.target.value)}
            placeholder="Sua cidade"
            className="h-11 rounded-xl border-slate-300 focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-700">
            Estado <span className="text-red-500">*</span>
          </Label>
          <Select value={estado} onValueChange={setEstado}>
            <SelectTrigger className="h-11 rounded-xl border-slate-300 text-sm">
              <SelectValue placeholder="UF" />
            </SelectTrigger>
            <SelectContent>
              {UFS.map((uf) => (
                <SelectItem key={uf} value={uf}>
                  {uf}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Telefone */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-slate-700">Telefone</Label>
        <div className="relative">
          <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            value={telefone}
            onChange={(e) => setTelefone(maskPhone(e.target.value))}
            placeholder="(00) 90000-0000"
            inputMode="tel"
            className="h-11 pl-10 rounded-xl border-slate-300 focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20 text-sm"
          />
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Etapa 3 — Primeiro Profissional
// ============================================================

interface StepTeamProps {
  direction: 'forward' | 'backward'
  profNome: string
  setProfNome: (v: string) => void
  profEmail: string
  setProfEmail: (v: string) => void
  profFuncao: string
  setProfFuncao: (v: string) => void
  profSenha: string
  setProfSenha: (v: string) => void
  profSenhaConfirm: string
  setProfSenhaConfirm: (v: string) => void
  showSenha: boolean
  setShowSenha: (v: boolean) => void
  showConfirm: boolean
  setShowConfirm: (v: boolean) => void
  cadastrarOutro: boolean
  setCadastrarOutro: (v: boolean) => void
  senhaValida: boolean
  senhasIguais: boolean
}

function StepTeam({
  profNome,
  setProfNome,
  profEmail,
  setProfEmail,
  profFuncao,
  setProfFuncao,
  profSenha,
  setProfSenha,
  profSenhaConfirm,
  setProfSenhaConfirm,
  showSenha,
  setShowSenha,
  showConfirm,
  setShowConfirm,
  cadastrarOutro,
  setCadastrarOutro,
  senhaValida,
  senhasIguais,
}: StepTeamProps) {
  return (
    <div className="animate-in fade-in-50 duration-300 space-y-4">
      {/* Título */}
      <div>
        <h2 className="text-lg font-bold text-slate-900">Primeiro Profissional</h2>
        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
          <UsersIcon className="w-3.5 h-3.5" />
          Adicione pelo menos um profissional para começar a atender.
        </p>
      </div>

      {/* Nome completo */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-slate-700">
          Nome completo <span className="text-red-500">*</span>
        </Label>
        <Input
          value={profNome}
          onChange={(e) => setProfNome(e.target.value)}
          placeholder="Nome do profissional"
          className="h-11 rounded-xl border-slate-300 focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20 text-sm"
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
            value={profEmail}
            onChange={(e) => setProfEmail(e.target.value)}
            placeholder="profissional@clinica.com.br"
            className="h-11 pl-10 rounded-xl border-slate-300 focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20 text-sm"
          />
        </div>
      </div>

      {/* Função */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-slate-700">
          Função <span className="text-red-500">*</span>
        </Label>
        <Select value={profFuncao} onValueChange={setProfFuncao}>
          <SelectTrigger className="h-11 rounded-xl border-slate-300 text-sm">
            <SelectValue placeholder="Selecione a função" />
          </SelectTrigger>
          <SelectContent>
            {FUNCOES.map((fn) => (
              <SelectItem key={fn} value={fn}>
                {fn}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Senha + Confirmar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-700">
            Senha <span className="text-red-500">*</span>
            <span className="ml-1 font-normal text-slate-400">(mín. 8)</span>
          </Label>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              type={showSenha ? 'text' : 'password'}
              value={profSenha}
              onChange={(e) => setProfSenha(e.target.value)}
              placeholder="••••••••"
              className="h-11 pl-10 pr-10 rounded-xl border-slate-300 focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowSenha(!showSenha)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              aria-label="Mostrar senha"
            >
              {showSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-700">
            Confirmar Senha <span className="text-red-500">*</span>
          </Label>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              type={showConfirm ? 'text' : 'password'}
              value={profSenhaConfirm}
              onChange={(e) => setProfSenhaConfirm(e.target.value)}
              placeholder="••••••••"
              className="h-11 pl-10 pr-10 rounded-xl border-slate-300 focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              aria-label="Mostrar senha"
            >
              {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {profSenhaConfirm.length > 0 && !senhasIguais && (
            <p className="text-xs text-red-500">As senhas não coincidem.</p>
          )}
        </div>
      </div>

      {/* Checklist de senha */}
      {profSenha.length > 0 && <PasswordChecklist password={profSenha} />}

      {/* Checkbox cadastrar outro depois */}
      <div className="flex items-center space-x-2 pt-1">
        <Checkbox
          id="cadastrar-outro"
          checked={cadastrarOutro}
          onCheckedChange={(c) => setCadastrarOutro(!!c)}
          className="border-slate-300 data-[state=checked]:bg-[#1e3a8a]"
        />
        <label
          htmlFor="cadastrar-outro"
          className="text-xs font-medium text-slate-600 cursor-pointer select-none"
        >
          Cadastrar outro profissional depois
        </label>
      </div>
    </div>
  )
}
