import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import {
  CalendarClock,
  FileText,
  Stethoscope,
  Ear,
  Wallet,
  BarChart3,
  Check,
  ChevronDown,
  ArrowRight,
  ShieldCheck,
  Users,
  Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { formatCurrency } from '@/lib/formatters'
import { PLANO_FUNCIONALIDADE_LABELS, type Plano } from '@/types'
import { getAppUrl, isPreviewOrLocal } from '@/lib/domain'

// ============================================================
// Landing Page pública do Audição360.
// Acessível sem autenticação em /landing ou diretamente em audicao360.com.br.
// Forçado rebuild para sincronização de cache de domínio de produção.
// ============================================================

const FEATURES = [
  {
    icon: CalendarClock,
    title: 'Agenda',
    desc: 'Agendamento inteligente de consultas e exames com lembretes automáticos por WhatsApp e controle de encaixes.',
  },
  {
    icon: FileText,
    title: 'Prontuário Eletrônico',
    desc: 'Histórico clínico completo do paciente: anamnese, evoluções, diagnósticos e condutas em um só lugar.',
  },
  {
    icon: Stethoscope,
    title: 'Exames Audiológicos',
    desc: 'Audiometrias, imitanciometrias, BERA e logoaudiometria com audiogramas visuais e laudos em PDF personalizados.',
  },
  {
    icon: Ear,
    title: 'Aparelhos Auditivos',
    desc: 'Controle de adaptação, vendas, garantias, manutenções e ajustes de aparelhos auditivos por paciente.',
  },
  {
    icon: Wallet,
    title: 'Financeiro',
    desc: 'Caixa, contas a receber, despesas, comissões, NFS-e e fluxo de caixa projetado com gestão de inadimplência.',
  },
  {
    icon: BarChart3,
    title: 'Relatórios',
    desc: 'Relatórios de faturamento, produção, conversão, no-show, estoque baixo e garantias — exportáveis em CSV.',
  },
]

const TESTIMONIALS = [
  {
    name: 'Dra. Carla Mendes',
    role: 'Fonoaudióloga — Clínica Auditiva Sul',
    text: 'Migramos para o Audição360 e o ganho de tempo foi absurdo. Os laudos em PDF e os lembretes por WhatsApp reduziram o no-show em mais de 40%.',
  },
  {
    name: 'Dr. Rafael Lima',
    role: 'Diretor — Centro Auditivo Norte',
    text: 'O controle financeiro integrado ao PDV e às comissões mudou a forma como gerenciamos a clínica. Tudo num só lugar.',
  },
  {
    name: 'Patrícia Souza',
    role: 'Recepção — OuviBem Clínicas',
    text: 'A agenda é intuitiva e o prontuário eletrônico organiza toda a história do paciente. Não imaginava como podia ser tão prático.',
  },
]

const FAQ = [
  {
    q: 'Preciso instalar algum programa?',
    a: 'Não. O Audição360 é 100% online (SaaS). Basta acessar pelo navegador do computador ou tablet, de qualquer lugar.',
  },
  {
    q: 'Como funciona o período de teste de 14 dias?',
    a: 'Ao se cadastrar, sua clínica entra em modo Trial por 14 dias, com acesso a todos os recursos do plano selecionado. Não pedimos cartão de crédito para começar.',
  },
  {
    q: 'Meus dados estão seguros?',
    a: 'Sim. Os dados ficam em infraestrutura na nuvem com backup automático, criptografia e isolamento multi-tenant — cada clínica enxerga apenas os próprios dados. Seguimos a LGPD.',
  },
  {
    q: 'Posso trocar de plano depois?',
    a: 'Sim. Você pode fazer upgrade ou downgrade do plano a qualquer momento direto no sistema, com reajuste proporcional.',
  },
  {
    q: 'O sistema atende centrais auditivas de qualquer porte?',
    a: 'Sim. Desde clínicas individuais até redes com vários profissionais e unidades, com gestão de permissões por perfil (admin, profissional e secretária).',
  },
  {
    q: 'Há suporte e treinamento?',
    a: 'Sim. Oferecemos suporte por chat dentro do próprio sistema e materiais de ajuda para a equipe começar rapidamente.',
  },
]

export default function Landing() {
  const [planos, setPlanos] = useState<Plano[]>([])
  const [totalClinicas, setTotalClinicas] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    pb.collection('planos')
      .getFullList<Plano>({
        filter: 'ativo = true',
        sort: 'preco_mensal',
      })
      .then((planosList) => {
        if (!active) return
        setPlanos(Array.isArray(planosList) ? planosList : [])
        setTotalClinicas(null)
        setLoading(false)
      })
      .catch(() => {
        if (!active) return
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  // Planos fallback (caso a API não retorne): espelha os seed do banco.
  const planosExibidos: Plano[] =
    planos.length > 0
      ? planos
      : [
          {
            id: 'basico',
            nome: 'Básico',
            preco_mensal: 97,
            funcionalidades: ['agenda', 'pacientes', 'prontuario', 'exames', 'financeiro'],
            max_profissionais: 3,
            max_pacientes: 100,
            ativo: true,
            created: '',
            updated: '',
          },
          {
            id: 'profissional',
            nome: 'Profissional',
            preco_mensal: 197,
            funcionalidades: [
              'agenda',
              'pacientes',
              'prontuario',
              'exames',
              'financeiro',
              'aparelhos',
              'estoque',
              'relatorios',
              'laudos_pdf',
            ],
            max_profissionais: 10,
            max_pacientes: 500,
            ativo: true,
            created: '',
            updated: '',
          },
          {
            id: 'premium',
            nome: 'Premium',
            preco_mensal: 297,
            funcionalidades: [
              'agenda',
              'pacientes',
              'prontuario',
              'exames',
              'financeiro',
              'aparelhos',
              'estoque',
              'relatorios',
              'laudos_pdf',
              'b2b',
              'auditoria',
              'ia',
              'chat',
              'nfse',
              'contas_receber',
              'despesas',
              'lembretes_whatsapp',
            ],
            max_profissionais: 50,
            max_pacientes: 2000,
            ativo: true,
            created: '',
            updated: '',
          },
        ]

  // Destaca o plano Profissional (meio) quando há 3.
  const isProfissional = (nome: string) => {
    const n = (nome || '').toLowerCase()
    return n.indexOf('profis') >= 0
  }

  const isPreview = isPreviewOrLocal()
  const loginUrl = getAppUrl('/login')
  const cadastroUrl = getAppUrl('/cadastro')

  return (
    <div className="min-h-screen bg-white text-slate-800 font-sans antialiased">
      {/* ===== NAVBAR ===== */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {isPreview ? (
            <Link to="/landing" className="flex items-center gap-2">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-[#1e3a8a] to-[#2563eb] text-white font-bold">
                A
              </div>
              <span className="font-bold text-lg text-[#1e3a8a]">Audição360</span>
            </Link>
          ) : (
            <a href="/" className="flex items-center gap-2">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-[#1e3a8a] to-[#2563eb] text-white font-bold">
                A
              </div>
              <span className="font-bold text-lg text-[#1e3a8a]">Audição360</span>
            </a>
          )}
          <nav className="hidden sm:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a href="#funcionalidades" className="hover:text-[#1e3a8a] transition-colors">
              Funcionalidades
            </a>
            <a href="#planos" className="hover:text-[#1e3a8a] transition-colors">
              Planos
            </a>
            <a href="#faq" className="hover:text-[#1e3a8a] transition-colors">
              FAQ
            </a>
          </nav>
          <div className="flex items-center gap-2">
            {isPreview ? (
              <Link to="/login">
                <Button
                  variant="ghost"
                  className="text-[#1e3a8a] hover:text-[#1e3a8a] text-sm font-semibold"
                >
                  Acessar o Sistema
                </Button>
              </Link>
            ) : (
              <a href={loginUrl}>
                <Button
                  variant="ghost"
                  className="text-[#1e3a8a] hover:text-[#1e3a8a] text-sm font-semibold"
                >
                  Acessar o Sistema
                </Button>
              </a>
            )}
            {isPreview ? (
              <Link to="/cadastro">
                <Button className="bg-[#1e3a8a] hover:bg-[#1e40af] text-white text-sm font-semibold rounded-xl">
                  Comece Grátis
                </Button>
              </Link>
            ) : (
              <a href={cadastroUrl}>
                <Button className="bg-[#1e3a8a] hover:bg-[#1e40af] text-white text-sm font-semibold rounded-xl">
                  Comece Grátis
                </Button>
              </a>
            )}
          </div>
        </div>
      </header>

      {/* ===== HERO ===== */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#1e3a8a] via-[#1d4ed8] to-[#2563eb] text-white">
        <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:28px_28px]" />
        <div className="absolute -bottom-32 -right-32 w-[28rem] h-[28rem] bg-blue-400/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-cyan-300/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-blue-50 text-xs font-semibold mb-5">
              <ShieldCheck className="w-3.5 h-3.5" />
              Gestão clínica completa para centros auditivos
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight">
              Audição360 — Gestão Inteligente para Centros Auditivos
            </h1>
            <p className="mt-5 text-lg sm:text-xl text-blue-100 max-w-2xl leading-relaxed">
              Tudo o que sua clínica auditiva precisa em um só lugar: agenda, prontuário eletrônico,
              exames audiológicos, aparelhos, financeiro e relatórios. Comece grátis por 14 dias,
              sem cartão de crédito.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              {isPreview ? (
                <Link to="/cadastro">
                  <Button className="w-full sm:w-auto h-12 px-7 bg-white text-[#1e3a8a] hover:bg-blue-50 font-bold rounded-xl shadow-lg text-base">
                    Comece Grátis por 14 Dias
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
              ) : (
                <a href={cadastroUrl}>
                  <Button className="w-full sm:w-auto h-12 px-7 bg-white text-[#1e3a8a] hover:bg-blue-50 font-bold rounded-xl shadow-lg text-base">
                    Comece Grátis por 14 Dias
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </a>
              )}
              <a href="#planos">
                <Button
                  variant="outline"
                  className="w-full sm:w-auto h-12 px-7 border-white/40 text-white hover:bg-white/10 hover:text-white font-semibold rounded-xl text-base"
                >
                  Ver Planos e Preços
                </Button>
              </a>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-blue-100">
              <span className="flex items-center gap-1.5">
                <Check className="w-4 h-4" /> 14 dias grátis
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="w-4 h-4" /> Sem cartão de crédito
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="w-4 h-4" /> Cancele quando quiser
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ===== SELO DE CONFIANÇA ===== */}
      <section className="bg-slate-50 border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <p className="text-center text-sm text-slate-500 font-medium flex items-center justify-center gap-2 flex-wrap">
            <Users className="w-4 h-4 text-[#1e3a8a]" />
            {totalClinicas !== null ? (
              <>
                Utilizado por{' '}
                <strong className="text-[#1e3a8a]">{totalClinicas} centros auditivos</strong> em
                todo o Brasil
              </>
            ) : (
              <>Utilizado por centros auditivos em todo o Brasil</>
            )}
          </p>
        </div>
      </section>

      {/* ===== FUNCIONALIDADES ===== */}
      <section id="funcionalidades" className="py-20 sm:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#1e3a8a]">
              Tudo integrado para a sua clínica auditiva
            </h2>
            <p className="mt-4 text-slate-600 text-lg">
              Da recepção ao financeiro, o Audição360 unifica os processos do seu centro auditivo em
              uma plataforma moderna e fácil de usar.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="group rounded-2xl border border-slate-200 bg-white p-6 hover:shadow-lg hover:border-[#1e3a8a]/30 transition-all duration-200"
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-blue-50 text-[#1e3a8a] mb-4 group-hover:bg-[#1e3a8a] group-hover:text-white transition-colors">
                  <f.icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== PLANOS E PREÇOS ===== */}
      <section id="planos" className="py-20 sm:py-24 bg-slate-50 border-y border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#1e3a8a]">Planos e Preços</h2>
            <p className="mt-4 text-slate-600 text-lg">
              Escolha o plano ideal para o tamanho da sua clínica. Todos com 14 dias de teste
              grátis.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            {planosExibidos.map((p) => {
              const destaque = isProfissional(p.nome)
              return (
                <div
                  key={p.id}
                  className={`relative flex flex-col rounded-2xl border-2 p-7 bg-white transition-all duration-200 ${
                    destaque
                      ? 'border-[#1e3a8a] shadow-xl lg:scale-[1.03] lg:-my-2'
                      : 'border-slate-200 hover:border-[#1e3a8a]/30 hover:shadow-lg'
                  }`}
                >
                  {destaque && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#1e3a8a] text-white text-xs font-bold uppercase tracking-wide">
                      Mais Popular
                    </span>
                  )}
                  <h3 className="text-xl font-bold text-slate-900">{p.nome}</h3>
                  <div className="mt-3 flex items-end gap-1">
                    <span className="text-4xl font-extrabold text-[#1e3a8a]">
                      {formatCurrency(p.preco_mensal)}
                    </span>
                    <span className="text-sm text-slate-500 mb-1">/mês</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {p.max_profissionais > 0
                      ? `Até ${p.max_profissionais} profissionais`
                      : 'Profissionais ilimitados'}
                    {p.max_pacientes > 0 ? ` · até ${p.max_pacientes} pacientes` : ''}
                  </p>

                  <ul className="mt-6 space-y-2.5 flex-1">
                    {p.funcionalidades.map((fn) => (
                      <li key={fn} className="flex items-start gap-2 text-sm text-slate-700">
                        <Check className="w-4 h-4 text-[#1e3a8a] shrink-0 mt-0.5" />
                        <span>{PLANO_FUNCIONALIDADE_LABELS[fn] || fn}</span>
                      </li>
                    ))}
                  </ul>

                  {isPreview ? (
                    <Link to="/cadastro" className="mt-7">
                      <Button
                        className={`w-full h-11 font-semibold rounded-xl ${
                          destaque
                            ? 'bg-[#1e3a8a] hover:bg-[#1e40af] text-white'
                            : 'bg-white border-2 border-[#1e3a8a] text-[#1e3a8a] hover:bg-blue-50'
                        }`}
                      >
                        Começar Grátis
                      </Button>
                    </Link>
                  ) : (
                    <a href={cadastroUrl} className="mt-7">
                      <Button
                        className={`w-full h-11 font-semibold rounded-xl ${
                          destaque
                            ? 'bg-[#1e3a8a] hover:bg-[#1e40af] text-white'
                            : 'bg-white border-2 border-[#1e3a8a] text-[#1e3a8a] hover:bg-blue-50'
                        }`}
                      >
                        Começar Grátis
                      </Button>
                    </a>
                  )}
                </div>
              )
            })}
          </div>

          {loading && <p className="text-center text-xs text-slate-400 mt-6">Carregando planos…</p>}
          {!loading && planos.length === 0 && (
            <p className="text-center text-xs text-slate-400 mt-6">
              Não foi possível carregar os planos do servidor. Valores de referência exibidos acima.
            </p>
          )}
        </div>
      </section>

      {/* ===== DEPOIMENTOS ===== */}
      <section className="py-20 sm:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#1e3a8a]">
              Profissionais que confiam no Audição360
            </h2>
            <p className="mt-4 text-slate-600 text-lg">
              Centrais auditivas de todo o Brasil usam o sistema para atender melhor e crescer.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <figure
                key={t.name}
                className="rounded-2xl border border-slate-200 bg-white p-7 flex flex-col"
              >
                <div className="text-amber-400 mb-3 text-lg">★★★★★</div>
                <blockquote className="text-sm text-slate-700 leading-relaxed flex-1">
                  “{t.text}”
                </blockquote>
                <figcaption className="mt-5 pt-4 border-t border-slate-100">
                  <div className="font-semibold text-slate-900 text-sm">{t.name}</div>
                  <div className="text-xs text-slate-500">{t.role}</div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA FINAL ===== */}
      <section className="py-16 bg-gradient-to-br from-[#1e3a8a] to-[#2563eb] text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <Clock className="w-10 h-10 mx-auto mb-4 text-blue-200" />
          <h2 className="text-3xl sm:text-4xl font-bold">Pronto para modernizar sua clínica?</h2>
          <p className="mt-3 text-blue-100 text-lg">
            Comece seu período de teste de 14 dias hoje. Sem cartão de crédito, sem compromisso.
          </p>
          {isPreview ? (
            <Link to="/cadastro" className="inline-block mt-7">
              <Button className="h-12 px-8 bg-white text-[#1e3a8a] hover:bg-blue-50 font-bold rounded-xl shadow-lg text-base">
                Cadastrar minha clínica
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          ) : (
            <a href={cadastroUrl} className="inline-block mt-7">
              <Button className="h-12 px-8 bg-white text-[#1e3a8a] hover:bg-blue-50 font-bold rounded-xl shadow-lg text-base">
                Cadastrar minha clínica
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </a>
          )}
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section id="faq" className="py-20 sm:py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#1e3a8a]">Perguntas Frequentes</h2>
            <p className="mt-4 text-slate-600">Tire suas dúvidas antes de começar.</p>
          </div>
          <Accordion type="single" collapsible className="w-full">
            {FAQ.map((item, i) => (
              <AccordionItem
                key={i}
                value={`item-${i}`}
                className="border border-slate-200 rounded-xl mb-3 px-5 data-[state=open]:border-[#1e3a8a]/30 data-[state=open]:shadow-sm bg-white"
              >
                <AccordionTrigger className="text-left text-base font-semibold text-slate-900 hover:no-underline">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-slate-600 leading-relaxed pt-2">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="bg-[#0b1f42] text-slate-300">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-8">
            <div className="sm:col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-[#1e3a8a] to-[#2563eb] text-white font-bold">
                  A
                </div>
                <span className="font-bold text-lg text-white">Audição360</span>
              </div>
              <p className="text-sm text-slate-400 max-w-md leading-relaxed">
                Gestão inteligente para centros auditivos. Agenda, prontuário, exames, aparelhos,
                financeiro e relatórios em uma única plataforma.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white mb-3">Produto</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#funcionalidades" className="hover:text-white transition-colors">
                    Funcionalidades
                  </a>
                </li>
                <li>
                  <a href="#planos" className="hover:text-white transition-colors">
                    Planos e Preços
                  </a>
                </li>
                <li>
                  <a href="#faq" className="hover:text-white transition-colors">
                    Perguntas Frequentes
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white mb-3">Acesso</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  {isPreview ? (
                    <Link to="/login" className="hover:text-white transition-colors">
                      Entrar no sistema
                    </Link>
                  ) : (
                    <a href={loginUrl} className="hover:text-white transition-colors">
                      Entrar no sistema
                    </a>
                  )}
                </li>
                <li>
                  {isPreview ? (
                    <Link to="/cadastro" className="hover:text-white transition-colors">
                      Cadastrar minha clínica
                    </Link>
                  ) : (
                    <a href={cadastroUrl} className="hover:text-white transition-colors">
                      Cadastrar minha clínica
                    </a>
                  )}
                </li>
                <li>
                  {isPreview ? (
                    <Link to="/landing" className="hover:text-white transition-colors">
                      Página inicial
                    </Link>
                  ) : (
                    <a href="/" className="hover:text-white transition-colors">
                      Página inicial
                    </a>
                  )}
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-slate-400">
              © {new Date().getFullYear()} Audição360 — Gestão Clínica para Centros Auditivos. Todos
              os direitos reservados.
            </p>
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              Conforme a LGPD (Lei 13.709/2018)
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
