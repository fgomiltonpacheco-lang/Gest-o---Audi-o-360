import React, { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useApp } from '@/context/AppContext'
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  KeyRound,
  AlertTriangle,
  Building2,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import logoImg from '@/assets/audicao-360-logo-para-papel-timbrado-da364.png'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type TwoFAState = {
  userId: string
  email: string
  backupAvailable: boolean
} | null

export default function Login() {
  const { login, verify2FA, recoverPassword, fetchLgpdPolicyTexts } = useApp()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Login state
  const [email, setEmail] = useState('admin@audicao360.com.br')
  const [password, setPassword] = useState('Admin@123')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // 2FA state
  const [twoFA, setTwoFA] = useState<TwoFAState>(null)
  const [twoFACode, setTwoFACode] = useState('')
  const [useBackupCode, setUseBackupCode] = useState(false)
  const [verifying2FA, setVerifying2FA] = useState(false)

  // Mensagem de sessão expirada por timeout
  const timeoutReason = searchParams.get('reason') === 'timeout'

  // Modal Esqueci minha senha
  const [recoveryOpen, setRecoveryOpen] = useState(false)
  const [recoveryEmail, setRecoveryEmail] = useState('')
  const [recoveryLoading, setRecoveryLoading] = useState(false)

  // Modal Política de Privacidade (LGPD)
  const [policyOpen, setPolicyOpen] = useState(false)
  const [policyText, setPolicyText] = useState('')
  const [policyLoading, setPolicyLoading] = useState(false)

  const openPolicyModal = () => {
    setPolicyOpen(true)
    if (!policyText) {
      setPolicyLoading(true)
      fetchLgpdPolicyTexts()
        .then((texts) => setPolicyText(texts.politica_privacidade))
        .catch(() => setPolicyText('Não foi possível carregar a política de privacidade.'))
        .finally(() => setPolicyLoading(false))
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')

    if (!email || !email.includes('@')) {
      setErrorMessage('Por favor, informe um endereço de e-mail válido.')
      return
    }
    if (!password || password.length < 8) {
      setErrorMessage('A senha deve ter pelo menos 8 caracteres.')
      return
    }

    setLoading(true)
    setErrorMessage('')
    login(email, password, rememberMe).then((result) => {
      setLoading(false)
      // Resultado 2FA: entra no fluxo de verificação
      if (result && typeof result === 'object' && 'requires2FA' in result && result.requires2FA) {
        setTwoFA({
          userId: result.userId,
          email: result.email,
          backupAvailable: result.backupAvailable,
        })
        setTwoFACode('')
        setUseBackupCode(false)
        return
      }
      // Conta bloqueada
      if (result && typeof result === 'object' && 'locked' in result && result.locked) {
        setErrorMessage(
          `Conta bloqueada por excesso de tentativas. Tente novamente em ${result.minutesLeft} minuto(s).`,
        )
        return
      }
      // Sucesso (boolean true)
      if (result === true) {
        navigate('/')
        return
      }
      // Falha
      setErrorMessage('E-mail ou senha inválidos. Tente admin@audicao360.com.br / Admin@123')
    })
  }

  const handle2FASubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!twoFA) return
    setErrorMessage('')
    if (!twoFACode.trim()) {
      setErrorMessage('Digite o código de verificação.')
      return
    }
    setVerifying2FA(true)
    verify2FA(twoFA.userId, twoFACode.trim(), useBackupCode).then((res) => {
      setVerifying2FA(false)
      if (res.success) {
        navigate('/')
      } else {
        setErrorMessage(res.message || 'Código inválido.')
      }
    })
  }

  const handleCancel2FA = () => {
    setTwoFA(null)
    setTwoFACode('')
    setUseBackupCode(false)
    setErrorMessage('')
  }

  const handleRecoverySubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!recoveryEmail || !recoveryEmail.includes('@')) return

    setRecoveryLoading(true)
    setTimeout(() => {
      recoverPassword(recoveryEmail)
      setRecoveryLoading(false)
      setRecoveryOpen(false)
      setRecoveryEmail('')
    }, 500)
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-navy-700 via-navy-700 to-teal-500 p-4 relative overflow-hidden">
      {/* Padrão sutil de fundo em ondas acústicas */}
      <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px]" />

      {/* Onda acústica decorativa no canto */}
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-teal-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-teal-300/10 rounded-full blur-3xl pointer-events-none" />

      {/* Card Central Branco */}
      <div className="w-full max-w-[420px] bg-white rounded-2xl shadow-2xl p-8 sm:p-10 border border-slate-100 relative z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Logo & Cabeçalho */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <div className="w-full max-w-[320px] h-28 flex items-center justify-center p-2">
              <img
                src={logoImg}
                alt="Audição360 Centro Auditivo"
                className="max-h-full max-w-full object-contain mx-auto"
              />
            </div>
          </div>
          <p className="text-sm text-slate-600 mt-1">Acesse o painel de gestão clínica integrada</p>
        </div>

        {/* Aviso de sessão expirada por timeout */}
        {timeoutReason && !twoFA && (
          <div className="mb-5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700 font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Sua sessão expirou por inatividade. Faça login novamente.
          </div>
        )}

        {/* Mensagem de Erro */}
        {errorMessage && (
          <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600 font-medium animate-in fade-in">
            {errorMessage}
          </div>
        )}

        {/* ---------- STEP 2FA ---------- */}
        {twoFA ? (
          <form onSubmit={handle2FASubmit} className="space-y-4">
            <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 rounded-lg p-3">
              <KeyRound className="w-4 h-4 text-teal-600 shrink-0" />
              <span>
                Autenticação de dois fatores ativada. Digite o código de 6 dígitos gerado pelo seu
                app autenticador.
              </span>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {useBackupCode ? 'Código de backup' : 'Código de verificação'}
              </label>
              <Input
                value={twoFACode}
                onChange={(e) =>
                  setTwoFACode(
                    e.target.value
                      .replace(useBackupCode ? /[^a-fA-F0-9]/g : /\D/g, '')
                      .slice(0, useBackupCode ? 8 : 6),
                  )
                }
                placeholder={useBackupCode ? 'XXXXXXXX' : '000000'}
                inputMode={useBackupCode ? 'text' : 'numeric'}
                autoFocus
                className="h-11 rounded-xl border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 text-center text-lg tracking-[0.4em] font-mono"
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              {twoFA.backupAvailable ? (
                <button
                  type="button"
                  onClick={() => {
                    setUseBackupCode((v) => !v)
                    setTwoFACode('')
                  }}
                  className="font-semibold text-teal-600 hover:text-teal-700"
                >
                  {useBackupCode ? 'Usar código TOTP' : 'Usar backup code'}
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={handleCancel2FA}
                className="font-semibold text-slate-500 hover:text-slate-700"
              >
                Voltar
              </button>
            </div>
            <Button
              type="submit"
              disabled={verifying2FA || twoFACode.length === 0}
              className="w-full h-11 bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-150 mt-2 flex items-center justify-center gap-2"
            >
              {verifying2FA ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Verificar e Entrar</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </form>
        ) : (
          /* ---------- STEP LOGIN ---------- */
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* E-mail */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                E-mail profissional <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nome@audicao360.com.br"
                  required
                  className="h-11 pl-10 rounded-xl border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 text-sm"
                />
              </div>
            </div>

            {/* Senha */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Senha de acesso <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setRecoveryOpen(true)}
                  className="text-xs font-semibold text-teal-600 hover:text-teal-700 transition-colors"
                >
                  Esqueci minha senha
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="h-11 pl-10 pr-10 rounded-xl border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  aria-label="Alternar visualização da senha"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Lembrar-me */}
            <div className="flex items-center space-x-2 pt-1">
              <Checkbox
                id="remember"
                checked={rememberMe}
                onCheckedChange={(c) => setRememberMe(!!c)}
                className="border-slate-300 data-[state=checked]:bg-teal-500"
              />
              <label
                htmlFor="remember"
                className="text-xs font-medium text-slate-600 cursor-pointer select-none"
              >
                Lembrar-me neste dispositivo
              </label>
            </div>

            {/* Botão de Entrar */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-150 mt-2 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Entrar no Sistema</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>

            {/* Link Política de Privacidade (LGPD) */}
            <button
              type="button"
              onClick={openPolicyModal}
              className="w-full mt-3 flex items-center justify-center gap-1.5 text-xs font-medium text-slate-500 hover:text-teal-600 transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Política de Privacidade
            </button>
          </form>
        )}

        {/* Dica de Acesso Rápido para Demonstração */}
        <div className="mt-8 pt-6 border-t border-slate-100">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-center mb-2.5">
            Acessos rápidos de demonstração
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => {
                setEmail('admin@audicao360.com.br')
                setPassword('Admin@123')
              }}
              className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 hover:bg-teal-50 hover:border-teal-200 hover:text-teal-600 transition-all text-left"
            >
              <div className="font-bold">Administrador</div>
              <div className="text-[10px] text-slate-400">Milton Soares Pacheco</div>
            </button>
            <button
              type="button"
              onClick={() => {
                setEmail('profissional@audicao360.com.br')
                setPassword('Profissional@123')
              }}
              className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 hover:bg-teal-50 hover:border-teal-200 hover:text-teal-600 transition-all text-left"
            >
              <div className="font-bold">Fonoaudiólogo</div>
              <div className="text-[10px] text-slate-400">Dr. Lucas</div>
            </button>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-500">Não tem uma conta?</p>
          <Link
            to="/cadastro"
            className="mt-1 inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-[#1e3a8a] hover:text-[#1e40af] transition-colors"
          >
            <Building2 className="w-4 h-4" />
            Cadastre sua clínica
          </Link>
        </div>
      </div>

      {/* Modal de Recuperação de Senha */}
      <Dialog open={recoveryOpen} onOpenChange={setRecoveryOpen}>
        <DialogContent className="max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">
              Recuperação de Senha
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-1">
              Informe seu e-mail cadastrado. Enviaremos um link de redefinição imediato.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRecoverySubmit} className="space-y-4 py-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                E-mail institucional
              </label>
              <Input
                type="email"
                value={recoveryEmail}
                onChange={(e) => setRecoveryEmail(e.target.value)}
                placeholder="seu.email@audicao360.com.br"
                required
                className="h-10 rounded-xl border-slate-300 text-sm"
              />
            </div>
            <DialogFooter className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRecoveryOpen(false)}
                className="rounded-xl border-slate-300 text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={recoveryLoading}
                className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-xs font-semibold"
              >
                {recoveryLoading ? 'Enviando...' : 'Enviar Link'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Política de Privacidade (LGPD) */}
      <Dialog open={policyOpen} onOpenChange={setPolicyOpen}>
        <DialogContent className="max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
          <DialogHeader className="border-b border-slate-100 pb-3">
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-teal-600" />
              <span>Política de Privacidade</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-1">
              Conforme a Lei Geral de Proteção de Dados (LGPD - Lei 13.709/2018).
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 max-h-[60vh] overflow-y-auto">
            {policyLoading ? (
              <p className="text-xs text-slate-400 text-center py-6">Carregando...</p>
            ) : (
              <pre className="text-xs text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
                {policyText}
              </pre>
            )}
          </div>
          <DialogFooter className="pt-2 border-t border-slate-100">
            <Button
              type="button"
              onClick={() => setPolicyOpen(false)}
              className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-xs font-semibold"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
