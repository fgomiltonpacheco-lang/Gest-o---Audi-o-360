import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2, ArrowRight, Sparkles, Calendar, ShieldCheck, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'

// ============================================================
// Página de boas-vindas pós-cadastro (Fase 3 do SaaS).
// Confirmação da criação da clínica e início do trial de 14 dias.
// Rota pública /boas-vindas.
// ============================================================

export default function BoasVindas() {
  const navigate = useNavigate()

  // Redireciona automaticamente para /login após alguns segundos (opcional).
  const [countdown, setCountdown] = useState<number | null>(null)

  // Não auto-redireciona por padrão — deixa o usuário clicar no botão.
  // Mantém o estado para um possível auto-início futuro.
  useEffect(() => {
    if (countdown === null) return
    if (countdown <= 0) {
      navigate('/login', { replace: true })
      return
    }
    const t = setTimeout(() => setCountdown((c) => (c ?? 1) - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown, navigate])

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#1e3a8a] via-[#1d4ed8] to-[#2563eb] p-4 relative overflow-hidden flex items-center justify-center">
      {/* Padrão sutil de fundo */}
      <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px]" />
      <div className="absolute -bottom-32 -right-32 w-[28rem] h-[28rem] bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-cyan-300/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-xl">
        {/* Card principal */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 sm:p-10 text-center border border-white/20 animate-in fade-in zoom-in-95 duration-300">
          {/* Ícone de sucesso */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-200/40 rounded-full blur-2xl animate-pulse" />
              <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-emerald-100">
                <CheckCircle2 className="w-11 h-11 text-emerald-600" />
              </div>
            </div>
          </div>

          {/* Título e mensagem */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-[#1e3a8a] text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            Cadastro concluído
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
            Sua clínica foi criada com sucesso!
          </h1>
          <p className="mt-3 text-slate-600 leading-relaxed">
            Seu período de <strong className="text-[#1e3a8a]">trial de 14 dias</strong> começou.
            Aproveite para configurar sua clínica, cadastrar pacientes e testar todos os recursos.
          </p>

          {/* Resumo do que vem agora */}
          <div className="mt-7 grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <Calendar className="w-5 h-5 text-[#1e3a8a] mb-2" />
              <h3 className="text-sm font-bold text-slate-900">14 dias grátis</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Acesso completo a todos os recursos do plano escolhido.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <ShieldCheck className="w-5 h-5 text-[#1e3a8a] mb-2" />
              <h3 className="text-sm font-bold text-slate-900">Dados protegidos</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Cada clínica enxerga apenas os próprios dados, conforme a LGPD.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <Clock className="w-5 h-5 text-[#1e3a8a] mb-2" />
              <h3 className="text-sm font-bold text-slate-900">Configure no seu tempo</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Cadastre profissionais, pacientes e comece a usar a agenda.
              </p>
            </div>
          </div>

          {/* Dica de próximo passo */}
          <div className="mt-6 p-3.5 rounded-xl bg-blue-50 border border-blue-100 text-xs text-slate-700 flex items-start gap-2 text-left">
            <ArrowRight className="w-4 h-4 text-[#1e3a8a] shrink-0 mt-0.5" />
            <span>
              Faça login com o <strong>e-mail</strong> e a <strong>senha</strong> que você acabou de
              cadastrar para acessar o sistema e configurar sua clínica.
            </span>
          </div>

          {/* CTA principal */}
          <Link to="/login" className="block mt-7">
            <Button className="w-full h-12 bg-[#1e3a8a] hover:bg-[#1e40af] text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all duration-150 flex items-center justify-center gap-2">
              Acessar o Sistema
              <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>

          {/* Link secundário */}
          <Link
            to="/landing"
            className="block mt-4 text-xs font-medium text-slate-500 hover:text-[#1e3a8a] transition-colors"
          >
            Voltar para a página inicial
          </Link>
        </div>

        {/* Selo de segurança */}
        <p className="mt-6 text-center text-xs text-blue-100 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5" />
          Audição360 — Gestão Inteligente para Centros Auditivos
        </p>
      </div>
    </div>
  )
}
