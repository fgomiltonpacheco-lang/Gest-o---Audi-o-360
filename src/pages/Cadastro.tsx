import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import {
  Building2,
  User,
  Mail,
  Lock,
  Phone,
  ArrowRight,
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordChecklist } from '@/components/PasswordChecklist'
import { validatePassword } from '@/lib/passwordPolicy'
import { maskPhone } from '@/lib/formatters'
import { maskCNPJ } from '@/pages/saas/shared'
import { formatCurrency } from '@/lib/formatters'
import { PLANO_FUNCIONALIDADE_LABELS, type Plano } from '@/types'
import { useToast } from '@/hooks/use-toast'

// ============================================================
// Cadastro self-service de clínica (Fase 3 do SaaS).
// Rota pública /cadastro. Cria clínica (trial) + usuário admin.
// ============================================================

export default function Cadastro() {
  const navigate = useNavigate()
  const { toast } = useToast()

  // Campos do formulário
  const [nomeClinica, setNomeClinica] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [senha, setSenha] = useState('')
  const [senhaConfirm, setSenhaConfirm] = useState('')
  const [showSenha, setShowSenha] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // Plano selecionado (padrão: Profissional)
  const [planos, setPlanos] = useState<Plano[]>([])
  const [planoSelecionado, setPlanoSelecionado] = useState<string>('')
  const [loadingPlanos, setLoadingPlanos] = useState(true)

  const [submitting, setSubmitting] = useState(false)
  const [erro, setErro] = useState('')

  // Carrega planos da API pública e pré-seleciona o Profissional.
  useEffect(() => {
    let active = true
    pb.send('/api/public/planos', {})
      .then((res: any) => {
        if (!active) return
        const list: Plano[] = res?.planos || []
        setPlanos(list)
        // Pré-seleciona "Profissional" se existir; senão o primeiro.
        const prof = list.find((p) => p.nome.toLowerCase().indexOf('profis') >= 0)
        setPlanoSelecionado(prof?.id || list[0]?.id || '')
        setLoadingPlanos(false)
      })
      .catch(() => {
        if (!active) return
        setLoadingPlanos(false)
      })
    return () => {
      active = false
    }
  }, [])

  const { valid: senhaValida } = validatePassword(senha)
  const senhasIguais = senha.length > 0 && senha === senhaConfirm

  const podeEnviar =
    nomeClinica.trim().length >= 3 &&
    cnpj.replace(/\D/g, '').length === 14 &&
    responsavel.trim().length >= 3 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    senhaValida &&
    senhasIguais &&
    !!planoSelecionado &&
    !submitting

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')

    if (!podeEnviar) {
      setErro('Preencha todos os campos obrigatórios corretamente.')
      return
    }

    setSubmitting(true)
    try {
      const res: any = await pb.send('/api/public/cadastro', {
        method: 'POST',
        body: {
          nome: nomeClinica.trim(),
          cnpj: cnpj.replace(/\D/g, ''),
          responsavel: responsavel.trim(),
          email: email.trim().toLowerCase(),
          telefone: telefone.trim(),
          senha,
          plano_id: planoSelecionado,
        },
      })
      if (res?.success) {
        toast({
          title: 'Cadastro realizado!',
          description: 'Sua clínica foi criada. Comece seu período de teste de 14 dias.',
        })
        navigate('/boas-vindas', { replace: true })
      } else {
        setErro(res?.error || 'Não foi possível concluir o cadastro.')
      }
    } catch (err: any) {
      const apiErr = err?.response?.data
      const msg =
        (apiErr && typeof apiErr === 'object' && (apiErr as any).error) ||
        err?.message ||
        'Não foi possível concluir o cadastro. Tente novamente.'
      setErro(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#1e3a8a] via-[#1d4ed8] to-[#2563eb] p-4 relative overflow-hidden">
      {/* Padrão sutil de fundo */}
      <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px]" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-cyan-300/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-3xl mx-auto py-8 sm:py-12">
        {/* Cabeçalho */}
        <div className="text-center mb-8">
          <Link
            to="/landing"
            className="inline-flex items-center gap-2 mb-6 text-blue-100 hover:text-white text-sm font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para a página inicial
          </Link>
          <div className="flex justify-center mb-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-white text-[#1e3a8a] font-bold text-xl shadow-lg">
              A
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Cadastre sua clínica</h1>
          <p className="text-blue-100 mt-2 text-sm sm:text-base">
            Comece grátis por 14 dias. Sem cartão de crédito.
          </p>
        </div>

        {/* Card do formulário */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 border border-white/20">
          {erro && (
            <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600 font-medium animate-in fade-in">
              {erro}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Bloco: dados da clínica */}
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                Dados da clínica
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Nome da clínica <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <Input
                      value={nomeClinica}
                      onChange={(e) => setNomeClinica(e.target.value)}
                      placeholder="Ex.: Clínica Auditiva Bem-Ouvir"
                      required
                      className="h-11 pl-10 rounded-xl border-slate-300 focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    CNPJ <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={cnpj}
                    onChange={(e) => setCnpj(maskCNPJ(e.target.value))}
                    placeholder="00.000.000/0000-00"
                    inputMode="numeric"
                    required
                    className="h-11 rounded-xl border-slate-300 focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Telefone / WhatsApp
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
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
            </div>

            {/* Bloco: responsável */}
            <div className="pt-2 border-t border-slate-100">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 mt-4">
                Responsável e acesso
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Nome do responsável <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <Input
                      value={responsavel}
                      onChange={(e) => setResponsavel(e.target.value)}
                      placeholder="Seu nome completo"
                      required
                      className="h-11 pl-10 rounded-xl border-slate-300 focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    E-mail (será seu login) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="voce@clinica.com.br"
                      required
                      className="h-11 pl-10 rounded-xl border-slate-300 focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Senha <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <Input
                      type={showSenha ? 'text' : 'password'}
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      placeholder="Mín. 8 caracteres"
                      required
                      className="h-11 pl-10 pr-10 rounded-xl border-slate-300 focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSenha((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                      aria-label="Mostrar senha"
                    >
                      {showSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Confirmar senha <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <Input
                      type={showConfirm ? 'text' : 'password'}
                      value={senhaConfirm}
                      onChange={(e) => setSenhaConfirm(e.target.value)}
                      placeholder="Repita a senha"
                      required
                      className="h-11 pl-10 pr-10 rounded-xl border-slate-300 focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                      aria-label="Mostrar senha"
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {senhaConfirm.length > 0 && !senhasIguais && (
                    <p className="mt-1.5 text-xs text-red-500">As senhas não coincidem.</p>
                  )}
                </div>
              </div>

              {senha.length > 0 && <PasswordChecklist password={senha} className="mt-3" />}
            </div>

            {/* Bloco: plano selecionado */}
            <div className="pt-2 border-t border-slate-100">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 mt-4">
                Escolha seu plano
              </h2>
              {loadingPlanos ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-36 rounded-xl bg-slate-50 border border-slate-200 animate-pulse"
                    />
                  ))}
                </div>
              ) : planos.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Não foi possível carregar os planos. Tente novamente em instantes.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {planos.map((p) => {
                    const selecionado = planoSelecionado === p.id
                    const isProf = p.nome.toLowerCase().indexOf('profis') >= 0
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPlanoSelecionado(p.id)}
                        className={`relative text-left rounded-xl border-2 p-4 transition-all ${
                          selecionado
                            ? 'border-[#1e3a8a] bg-blue-50 shadow-sm'
                            : 'border-slate-200 hover:border-[#1e3a8a]/40'
                        }`}
                      >
                        {isProf && (
                          <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-[#1e3a8a] text-white text-[10px] font-bold uppercase">
                            Recomendado
                          </span>
                        )}
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-bold text-slate-900 text-sm">{p.nome}</h3>
                          {selecionado && (
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1e3a8a] text-white">
                              <Check className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                        <div className="flex items-end gap-1 mb-2">
                          <span className="text-xl font-extrabold text-[#1e3a8a]">
                            {formatCurrency(p.preco_mensal)}
                          </span>
                          <span className="text-[11px] text-slate-500 mb-0.5">/mês</span>
                        </div>
                        <ul className="space-y-1">
                          {p.funcionalidades.slice(0, 4).map((fn) => (
                            <li
                              key={fn}
                              className="flex items-start gap-1 text-[11px] text-slate-600"
                            >
                              <Check className="w-3 h-3 text-[#1e3a8a] shrink-0 mt-0.5" />
                              <span>{PLANO_FUNCIONALIDADE_LABELS[fn] || fn}</span>
                            </li>
                          ))}
                          {p.funcionalidades.length > 4 && (
                            <li className="text-[11px] text-slate-400 pl-4">
                              +{p.funcionalidades.length - 4} recursos
                            </li>
                          )}
                        </ul>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Termos + CTA */}
            <div className="pt-2">
              <p className="text-[11px] text-slate-500 leading-relaxed mb-4">
                Ao continuar, você concorda com os Termos de Uso e a Política de Privacidade do
                Audição360. Seu período de teste de 14 dias começa agora.
              </p>
              <Button
                type="submit"
                disabled={!podeEnviar}
                className="w-full h-12 bg-[#1e3a8a] hover:bg-[#1e40af] text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all duration-150 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    Criar minha clínica
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </Button>
            </div>
          </form>

          <p className="mt-6 text-center text-xs text-slate-500">
            Já tem conta?{' '}
            <Link to="/login" className="font-semibold text-[#1e3a8a] hover:underline">
              Entrar no sistema
            </Link>
          </p>
        </div>

        {/* Selo de segurança */}
        <p className="mt-6 text-center text-xs text-blue-100 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5" />
          Dados protegidos — isolamento multi-tenant e conforme a LGPD
        </p>
      </div>
    </div>
  )
}
