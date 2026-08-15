import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '@/context/AppContext'
import pb from '@/lib/pocketbase/client'
import { Lock, Mail, Eye, EyeOff, ArrowRight, User, IdCard } from 'lucide-react'
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

type Mode = 'login' | 'signup'

export default function Login() {
  const { login, recoverPassword } = useApp()
  const navigate = useNavigate()

  const [mode, setMode] = useState<Mode>('login')

  // Login state
  const [email, setEmail] = useState('admin@audicao360.com.br')
  const [password, setPassword] = useState('Admin@123')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // Signup state
  const [name, setName] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [crfa, setCrfa] = useState('')
  const [showSignupPassword, setShowSignupPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [signupLoading, setSignupLoading] = useState(false)

  // Modal Esqueci minha senha
  const [recoveryOpen, setRecoveryOpen] = useState(false)
  const [recoveryEmail, setRecoveryEmail] = useState('')
  const [recoveryLoading, setRecoveryLoading] = useState(false)

  const switchMode = (next: Mode) => {
    setMode(next)
    setErrorMessage('')
    setSuccessMessage('')
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
    login(email, password, rememberMe).then((success) => {
      setLoading(false)
      if (success) {
        navigate('/')
      } else {
        setErrorMessage('E-mail ou senha inválidos. Tente admin@audicao360.com.br / Admin@123')
      }
    })
  }

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')

    if (!name.trim()) {
      setErrorMessage('Por favor, informe seu nome completo.')
      return
    }
    if (!signupEmail || !signupEmail.includes('@')) {
      setErrorMessage('Por favor, informe um endereço de e-mail válido.')
      return
    }
    if (!signupPassword || signupPassword.length < 6) {
      setErrorMessage('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    if (signupPassword !== confirmPassword) {
      setErrorMessage('As senhas não conferem.')
      return
    }

    setSignupLoading(true)
    try {
      // Cria o usuário (não usa authWithPassword — usa create)
      await pb.collection('users').create({
        email: signupEmail.trim(),
        password: signupPassword,
        passwordConfirm: confirmPassword,
        name: name.trim(),
        crmCrfa: crfa.trim(),
        role: 'profissional',
      })

      // Login automático após cadastro, mantendo o estado do AppContext
      const success = await login(signupEmail.trim(), signupPassword, true)
      if (success) {
        setSuccessMessage('Conta criada com sucesso!')
        navigate('/')
      } else {
        // Conta criada, mas falhou ao autenticar via contexto — tenta direto
        try {
          await pb.collection('users').authWithPassword(signupEmail.trim(), signupPassword)
          setSuccessMessage('Conta criada com sucesso!')
          navigate('/')
        } catch (err) {
          setErrorMessage(
            'Conta criada, mas não foi possível entrar automaticamente. Faça login manualmente.',
          )
          switchMode('login')
        }
      }
    } catch (err: any) {
      const msg =
        err?.response?.message ||
        err?.message ||
        'Não foi possível criar a conta. Verifique os dados e tente novamente.'
      setErrorMessage(typeof msg === 'string' ? msg : 'Erro ao criar conta.')
    } finally {
      setSignupLoading(false)
    }
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
          <p className="text-sm text-slate-600 mt-1">
            {mode === 'login'
              ? 'Acesse o painel de gestão clínica integrada'
              : 'Cadastre-se para acessar o sistema'}
          </p>
        </div>

        {/* Abas Login / Criar conta */}
        <div className="flex p-1 mb-6 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              mode === 'login'
                ? 'bg-white text-teal-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Entrar{' '}
          </button>
          <button
            type="button"
            onClick={() => switchMode('signup')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              mode === 'signup'
                ? 'bg-white text-teal-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Criar conta{' '}
          </button>
        </div>

        {/* Mensagem de Erro */}
        {errorMessage && (
          <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600 font-medium animate-in fade-in">
            {errorMessage}
          </div>
        )}

        {/* Mensagem de Sucesso */}
        {successMessage && (
          <div className="mb-5 p-3 rounded-xl bg-green-50 border border-green-200 text-xs text-green-700 font-medium animate-in fade-in">
            {successMessage}
          </div>
        )}

        {mode === 'login' ? (
          <>
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
            </form>

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

            {/* Link para Criar conta */}
            <p className="mt-6 text-center text-xs text-slate-500">
              Não tem uma conta?{' '}
              <button
                type="button"
                onClick={() => switchMode('signup')}
                className="font-semibold text-teal-600 hover:text-teal-700 transition-colors"
              >
                Criar conta
              </button>
            </p>
          </>
        ) : (
          <>
            <form onSubmit={handleSignupSubmit} className="space-y-4">
              {/* Nome completo */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Nome completo <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <Input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome completo"
                    required
                    className="h-11 pl-10 rounded-xl border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 text-sm"
                  />
                </div>
              </div>

              {/* E-mail */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  E-mail <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <Input
                    type="email"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    placeholder="nome@exemplo.com"
                    required
                    className="h-11 pl-10 rounded-xl border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 text-sm"
                  />
                </div>
              </div>

              {/* Senha */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Senha <span className="text-red-500">*</span>
                  <span className="ml-1 font-normal text-slate-400">(mínimo 6 caracteres)</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <Input
                    type={showSignupPassword ? 'text' : 'password'}
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    placeholder="••••••"
                    required
                    className="h-11 pl-10 pr-10 rounded-xl border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignupPassword(!showSignupPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    aria-label="Alternar visualização da senha"
                  >
                    {showSignupPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Confirmar senha */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Confirmar senha <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <Input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••"
                    required
                    className="h-11 pl-10 pr-10 rounded-xl border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    aria-label="Alternar visualização da senha"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* CRFa */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  CRFa{' '}
                  <span className="font-normal text-slate-400">
                    (opcional — registro no conselho)
                  </span>
                </label>
                <div className="relative">
                  <IdCard className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <Input
                    type="text"
                    value={crfa}
                    onChange={(e) => setCrfa(e.target.value)}
                    placeholder="Ex.: 2-12345"
                    className="h-11 pl-10 rounded-xl border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 text-sm"
                  />
                </div>
              </div>

              {/* Botão Criar Conta */}
              <Button
                type="submit"
                disabled={signupLoading}
                className="w-full h-11 bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-150 mt-2 flex items-center justify-center gap-2"
              >
                {signupLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Criar Conta</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </form>

            {/* Link para voltar ao login */}
            <p className="mt-6 text-center text-xs text-slate-500">
              Já tem uma conta?{' '}
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="font-semibold text-teal-600 hover:text-teal-700 transition-colors"
              >
                Entrar
              </button>
            </p>
          </>
        )}
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
    </div>
  )
}
