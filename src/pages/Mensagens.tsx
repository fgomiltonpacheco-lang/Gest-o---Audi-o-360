import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useApp } from '@/context/AppContext'
import { useToast } from '@/hooks/use-toast'
import pb from '@/lib/pocketbase/client'
import { getInitials, getAvatarColor, getAvatarUrl } from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Send, Users, MessageCircle, ArrowLeft } from 'lucide-react'
import type { User } from '@/types'

interface Mensagem {
  id: string
  remetenteId: string
  remetenteNome: string
  remetenteAvatar?: string
  destinatarioId: string // "" = grupo/todos
  texto: string
  lida: boolean
  created: string
}

interface Conversa {
  /** Identificador do destinatário: id do usuário ou "" para grupo "Todos". */
  key: string
  user: User | null // null quando for conversa de grupo
  ultimaMensagem: Mensagem | null
  naoLidas: number
}

const POLL_INTERVAL = 5000 // 5 segundos

function formatHora(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function formatDataHora(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const hoje = new Date()
  const mesmoDia =
    d.getDate() === hoje.getDate() &&
    d.getMonth() === hoje.getMonth() &&
    d.getFullYear() === hoje.getFullYear()
  if (mesmoDia) return formatHora(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + formatHora(iso)
}

function mapMensagem(r: any): Mensagem {
  const rem = r.expand?.remetente
  return {
    id: r.id,
    remetenteId: r.remetente || '',
    remetenteNome: rem?.name || rem?.email || 'Usuário',
    remetenteAvatar: rem?.avatar || undefined,
    destinatarioId: r.destinatario || '',
    texto: r.texto || '',
    lida: !!r.lida,
    created: r.created || '',
  }
}

export default function Mensagens() {
  const { currentUser, refreshUnreadMessagesCount } = useApp()
  const { toast } = useToast()

  const [usuarios, setUsuarios] = useState<User[]>([])
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [conversaAtiva, setConversaAtiva] = useState<string | null>(null) // "" = grupo, userId = direta
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [loadingMensagens, setLoadingMensagens] = useState(false)
  const [mobileChatAberto, setMobileChatAberto] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const textoRef = useRef<HTMLInputElement>(null)

  // ---------- Carregar usuários ----------
  const carregarUsuarios = useCallback(async () => {
    if (!currentUser) return
    try {
      const list = await pb.collection('users').getFullList({ sort: 'name' })
      const mapped: User[] = list
        .filter((u: any) => u.id !== currentUser.id)
        .map((u: any) => ({
          id: u.id,
          name: u.name || u.email || 'Usuário',
          email: u.email || '',
          role:
            u.role === 'profissional'
              ? 'profissional'
              : u.role === 'secretaria'
                ? 'secretaria'
                : 'admin',
          avatar: u.avatar || undefined,
          crmCrfa: u.crmCrfa || undefined,
        }))
      setUsuarios(mapped)
    } catch (err) {
      console.error('Erro ao carregar usuários:', err)
    }
  }, [currentUser])

  // ---------- Carregar mensagens ----------
  const carregarMensagens = useCallback(async () => {
    if (!currentUser) return
    try {
      // Busca todas as mensagens relevantes (enviadas ou recebidas pelo usuário,
      // incluindo as de grupo). Ordena por data ASC para exibição cronológica.
      const list = await pb.collection('mensagens').getFullList({
        sort: 'created',
        filter: `remetente = "${currentUser.id}" || destinatario = "${currentUser.id}" || destinatario = ""`,
        expand: 'remetente,destinatario',
      })
      setMensagens(list.map(mapMensagem))
    } catch (err) {
      console.error('Erro ao carregar mensagens:', err)
    }
  }, [currentUser])

  // ---------- Carregar tudo ----------
  const carregarTudo = useCallback(async () => {
    setLoadingMensagens(true)
    await Promise.all([carregarUsuarios(), carregarMensagens()])
    setLoadingMensagens(false)
  }, [carregarUsuarios, carregarMensagens])

  useEffect(() => {
    carregarTudo()
  }, [carregarTudo])

  // ---------- Polling a cada 5s ----------
  useEffect(() => {
    if (!currentUser) return
    const interval = setInterval(() => {
      carregarMensagens()
      refreshUnreadMessagesCount()
    }, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [currentUser, carregarMensagens, refreshUnreadMessagesCount])

  // ---------- Construir lista de conversas ----------
  const conversas: Conversa[] = useMemo(() => {
    if (!currentUser) return []
    const conversaMap = new Map<string, Conversa>()

    // Sempre inclui a conversa de grupo "Todos"
    conversaMap.set('', {
      key: '',
      user: null,
      ultimaMensagem: null,
      naoLidas: 0,
    })

    // Inclui todos os usuários conhecidos (mesmo sem mensagens ainda)
    usuarios.forEach((u) => {
      conversaMap.set(u.id, {
        key: u.id,
        user: u,
        ultimaMensagem: null,
        naoLidas: 0,
      })
    })

    // Percorre mensagens e atualiza conversas
    mensagens.forEach((m) => {
      if (m.destinatarioId === '') {
        // Mensagem de grupo
        const c = conversaMap.get('')
        if (c) {
          if (!c.ultimaMensagem || m.created > c.ultimaMensagem.created) {
            c.ultimaMensagem = m
          }
          if (!m.lida && m.remetenteId !== currentUser.id) {
            c.naoLidas += 1
          }
        }
      } else {
        // Mensagem direta: o "outro" da conversa é o destinatário ou o remetente
        const outroId = m.remetenteId === currentUser.id ? m.destinatarioId : m.remetenteId
        if (!outroId) return
        let c = conversaMap.get(outroId)
        if (!c) {
          // Usuário pode não estar na lista (ex.: desativado). Cria entrada genérica.
          c = {
            key: outroId,
            user: {
              id: outroId,
              name: m.remetenteId === currentUser.id ? m.remetenteNome : 'Usuário',
              email: '',
              role: 'profissional',
            },
            ultimaMensagem: null,
            naoLidas: 0,
          }
          conversaMap.set(outroId, c)
        }
        if (!c.ultimaMensagem || m.created > c.ultimaMensagem.created) {
          c.ultimaMensagem = m
        }
        // Não lidas: recebidas por mim (destinatário = currentUser) e ainda não lidas
        if (!m.lida && m.destinatarioId === currentUser.id) {
          c.naoLidas += 1
        }
      }
    })

    return Array.from(conversaMap.values()).sort((a, b) => {
      // Grupo "Todos" sempre no topo
      if (a.key === '' && b.key !== '') return -1
      if (a.key !== '' && b.key === '') return 1
      // Depois ordena por última mensagem (mais recente primeiro)
      const aTime = a.ultimaMensagem?.created || ''
      const bTime = b.ultimaMensagem?.created || ''
      if (aTime && bTime) return aTime < bTime ? 1 : aTime > bTime ? -1 : 0
      if (aTime) return -1
      if (bTime) return 1
      // Sem mensagens: ordena por nome
      const aName = a.user?.name || ''
      const bName = b.user?.name || ''
      return aName.localeCompare(bName)
    })
  }, [mensagens, usuarios, currentUser])

  // ---------- Mensagens da conversa ativa ----------
  const mensagensAtivas = useMemo(() => {
    if (!currentUser || conversaAtiva === null) return []
    if (conversaAtiva === '') {
      // Grupo: todas as mensagens com destinatario = ""
      return mensagens.filter((m) => m.destinatarioId === '')
    }
    // Direta: mensagens entre currentUser e conversaAtiva
    return mensagens.filter(
      (m) =>
        m.destinatarioId !== '' &&
        ((m.remetenteId === currentUser.id && m.destinatarioId === conversaAtiva) ||
          (m.remetenteId === conversaAtiva && m.destinatarioId === currentUser.id)),
    )
  }, [mensagens, currentUser, conversaAtiva])

  // ---------- Marcar mensagens como lidas ao abrir conversa ----------
  const marcarComoLidas = useCallback(
    async (conversaKey: string) => {
      if (!currentUser) return
      try {
        let filtro = ''
        if (conversaKey === '') {
          filtro = `destinatario = "" && lida = false && remetente != "${currentUser.id}"`
        } else {
          filtro = `destinatario = "${currentUser.id}" && remetente = "${conversaKey}" && lida = false`
        }
        if (!filtro) return
        const pendentes = await pb.collection('mensagens').getFullList({ filter: filtro })
        for (const p of pendentes) {
          try {
            await pb.collection('mensagens').update(p.id, { lida: true })
          } catch (e) {
            // ignora erro individual
          }
        }
        if (pendentes.length > 0) {
          // Atualiza localmente para feedback imediato
          setMensagens((prev) =>
            prev.map((m) => {
              if (conversaKey === '') {
                return m.destinatarioId === '' && m.remetenteId !== currentUser.id
                  ? { ...m, lida: true }
                  : m
              }
              return m.destinatarioId === currentUser.id && m.remetenteId === conversaKey
                ? { ...m, lida: true }
                : m
            }),
          )
          refreshUnreadMessagesCount()
        }
      } catch (err) {
        console.warn('Erro ao marcar mensagens como lidas:', err)
      }
    },
    [currentUser, refreshUnreadMessagesCount],
  )

  // ---------- Selecionar conversa ----------
  const selecionarConversa = useCallback(
    (key: string) => {
      setConversaAtiva(key)
      setMobileChatAberto(true)
      marcarComoLidas(key)
    },
    [marcarComoLidas],
  )

  // ---------- Scroll automático para a última mensagem ----------
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [mensagensAtivas, conversaAtiva])

  // ---------- Enviar mensagem ----------
  const enviarMensagem = async () => {
    const conteudo = texto.trim()
    if (!conteudo || !currentUser || conversaAtiva === null || enviando) return
    setEnviando(true)
    try {
      const rec: any = await pb.collection('mensagens').create({
        remetente: currentUser.id,
        destinatario: conversaAtiva === '' ? '' : conversaAtiva,
        texto: conteudo,
        lida: false,
      })
      // Recarrega para pegar o expand do remetente
      const full: any = await pb
        .collection('mensagens')
        .getOne(rec.id, { expand: 'remetente,destinatario' })
      setMensagens((prev) => [...prev, mapMensagem(full)])
      setTexto('')
      refreshUnreadMessagesCount()
      textoRef.current?.focus()
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err)
      toast({
        title: 'Erro ao enviar',
        description: 'Não foi possível enviar a mensagem.',
        variant: 'destructive',
      })
    } finally {
      setEnviando(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      enviarMensagem()
    }
  }

  if (!currentUser) return null

  const conversaAtivaObj =
    conversaAtiva === null ? null : conversas.find((c) => c.key === conversaAtiva) || null

  return (
    <div className="space-y-4 animate-in fade-in-50 duration-200">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-sm">
          <MessageCircle className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Mensagens
          </h1>
          <p className="text-sm text-slate-500">
            Chat interno da equipe — conversas individuais e mensagens para todos
          </p>
        </div>
      </div>

      {/* Layout estilo WhatsApp */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-[calc(100vh-220px)] min-h-[480px] flex">
        {/* Painel esquerdo: lista de conversas */}
        <div
          className={`${
            mobileChatAberto ? 'hidden md:flex' : 'flex'
          } w-full md:w-[320px] lg:w-[360px] flex-col border-r border-slate-200 bg-slate-50/50`}
        >
          <div className="px-4 py-3 border-b border-slate-200 bg-white">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Conversas</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loadingMensagens && conversas.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-400">Carregando...</div>
            ) : conversas.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-400">
                Nenhum usuário disponível.
              </div>
            ) : (
              conversas.map((c) => {
                const ativa = conversaAtiva === c.key
                const ultima = c.ultimaMensagem
                const isGrupo = c.key === ''
                const avatarUrl = isGrupo ? null : getAvatarUrl(c.user)
                return (
                  <button
                    key={c.key || 'grupo'}
                    onClick={() => selecionarConversa(c.key)}
                    className={`w-full flex items-center gap-3 px-3 py-3 border-b border-slate-100 text-left transition-colors ${
                      ativa ? 'bg-teal-50' : 'hover:bg-white'
                    }`}
                  >
                    {isGrupo ? (
                      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-teal-500 to-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                        <Users className="w-5 h-5" />
                      </div>
                    ) : getAvatarUrl(c.user) ? (
                      <Avatar className="w-11 h-11 shrink-0">
                        <AvatarImage src={getAvatarUrl(c.user) || ''} alt={c.user?.name} />
                        <AvatarFallback className={getAvatarColor(c.user?.name || 'U')}>
                          {getInitials(c.user?.name || 'U')}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <div
                        className={`w-11 h-11 rounded-full ${getAvatarColor(
                          c.user?.name || 'U',
                        )} text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-sm`}
                      >
                        {getInitials(c.user?.name || 'U')}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-800 truncate">
                          {isGrupo ? 'Todos (Grupo)' : c.user?.name || 'Usuário'}
                        </span>
                        {ultima && (
                          <span className="text-[10px] text-slate-400 shrink-0">
                            {formatHora(ultima.created)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <span className="text-xs text-slate-500 truncate">
                          {ultima
                            ? `${ultima.remetenteId === currentUser.id ? 'Você: ' : ''}${ultima.texto}`
                            : isGrupo
                              ? 'Mensagens para toda a equipe'
                              : 'Iniciar conversa'}
                        </span>
                        {c.naoLidas > 0 && (
                          <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-teal-600 text-white text-[10px] font-bold flex items-center justify-center">
                            {c.naoLidas > 99 ? '99+' : c.naoLidas}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Painel direito: chat ativo */}
        <div
          className={`${mobileChatAberto ? 'flex' : 'hidden md:flex'} flex-1 flex-col bg-slate-50`}
        >
          {conversaAtiva === null || !conversaAtivaObj ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3 p-8">
              <MessageCircle className="w-12 h-12 opacity-40" />
              <p className="text-sm">Selecione uma conversa para começar a trocar mensagens.</p>
            </div>
          ) : (
            <>
              {/* Header do chat */}
              <div className="px-4 py-3 border-b border-slate-200 bg-white flex items-center gap-3">
                <button
                  onClick={() => setMobileChatAberto(false)}
                  className="md:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                  aria-label="Voltar"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                {conversaAtiva === '' ? (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-emerald-500 text-white flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                ) : getAvatarUrl(conversaAtivaObj.user) ? (
                  <Avatar className="w-10 h-10">
                    <AvatarImage
                      src={getAvatarUrl(conversaAtivaObj.user) || ''}
                      alt={conversaAtivaObj.user?.name}
                    />
                    <AvatarFallback className={getAvatarColor(conversaAtivaObj.user?.name || 'U')}>
                      {getInitials(conversaAtivaObj.user?.name || 'U')}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <div
                    className={`w-10 h-10 rounded-full ${getAvatarColor(
                      conversaAtivaObj.user?.name || 'U',
                    )} text-white flex items-center justify-center font-bold text-sm shrink-0`}
                  >
                    {getInitials(conversaAtivaObj.user?.name || 'U')}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">
                    {conversaAtiva === '' ? 'Todos (Grupo)' : conversaAtivaObj.user?.name}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {conversaAtiva === ''
                      ? 'Mensagens visíveis para toda a equipe'
                      : conversaAtivaObj.user?.email || 'Conversa individual'}
                  </p>
                </div>
              </div>

              {/* Área de mensagens */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
                {mensagensAtivas.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                    <MessageCircle className="w-10 h-10 opacity-40" />
                    <p className="text-sm">Nenhuma mensagem ainda. Envie a primeira!</p>
                  </div>
                ) : (
                  mensagensAtivas.map((m) => {
                    const minha = m.remetenteId === currentUser.id
                    const mostrarRemetente = conversaAtiva === '' && !minha
                    return (
                      <div key={m.id} className={`flex ${minha ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[75%] sm:max-w-[60%] rounded-2xl px-3.5 py-2 shadow-sm ${
                            minha
                              ? 'bg-teal-600 text-white rounded-br-md'
                              : 'bg-white text-slate-800 border border-slate-200 rounded-bl-md'
                          }`}
                        >
                          {mostrarRemetente && (
                            <p className="text-[11px] font-bold text-teal-600 mb-0.5">
                              {m.remetenteNome}
                            </p>
                          )}
                          <p className="text-sm whitespace-pre-line break-words">{m.texto}</p>
                          <p
                            className={`text-[10px] mt-1 text-right ${
                              minha ? 'text-teal-100' : 'text-slate-400'
                            }`}
                          >
                            {formatDataHora(m.created)}
                          </p>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Campo de envio */}
              <div className="px-3 py-3 border-t border-slate-200 bg-white flex items-center gap-2">
                <Input
                  ref={textoRef}
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Digite uma mensagem..."
                  disabled={enviando}
                  className="flex-1 rounded-full border-slate-300 text-sm"
                />
                <Button
                  onClick={enviarMensagem}
                  disabled={!texto.trim() || enviando}
                  size="icon"
                  className="rounded-full bg-teal-600 hover:bg-teal-700 text-white shrink-0"
                  aria-label="Enviar"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
