import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useApp } from '@/context/AppContext'
import { useToast } from '@/hooks/use-toast'
import { useIsMobile } from '@/hooks/use-mobile'
import pb from '@/lib/pocketbase/client'
import { getInitials, getAvatarColor, getAvatarUrl } from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Send, Users, MessageCircle, ArrowLeft, Minus, X } from 'lucide-react'
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
  key: string
  user: User | null
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

export function ChatWidget() {
  const { currentUser, unreadMessagesCount, refreshUnreadMessagesCount } = useApp()
  const { toast } = useToast()
  const isMobile = useIsMobile()

  const [isOpen, setIsOpen] = useState(false)
  const [showList, setShowList] = useState(true) // mobile: true = lista, false = chat
  const [usuarios, setUsuarios] = useState<User[]>([])
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [conversaAtiva, setConversaAtiva] = useState<string>('')
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)

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

  // ---------- Carregar usuários + mensagens ao abrir ----------
  useEffect(() => {
    if (!isOpen || !currentUser) return
    carregarUsuarios()
    carregarMensagens()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, currentUser?.id])

  // ---------- Polling a cada 5s quando aberto ----------
  useEffect(() => {
    if (!isOpen || !currentUser) return
    const interval = setInterval(() => {
      carregarMensagens()
      refreshUnreadMessagesCount()
    }, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [isOpen, currentUser, carregarMensagens, refreshUnreadMessagesCount])

  // ---------- Auto-expandir quando chega nova mensagem ----------
  const prevUnreadRef = useRef(unreadMessagesCount)
  useEffect(() => {
    if (!currentUser) return
    if (unreadMessagesCount > prevUnreadRef.current && unreadMessagesCount > 0) {
      setIsOpen(true)
    }
    prevUnreadRef.current = unreadMessagesCount
  }, [unreadMessagesCount, currentUser])

  // ---------- Construir lista de conversas ----------
  const conversas: Conversa[] = useMemo(() => {
    if (!currentUser) return []
    const conversaMap = new Map<string, Conversa>()

    conversaMap.set('', { key: '', user: null, ultimaMensagem: null, naoLidas: 0 })

    usuarios.forEach((u) => {
      conversaMap.set(u.id, { key: u.id, user: u, ultimaMensagem: null, naoLidas: 0 })
    })

    mensagens.forEach((m) => {
      if (m.destinatarioId === '') {
        const c = conversaMap.get('')
        if (c) {
          if (!c.ultimaMensagem || m.created > c.ultimaMensagem.created) {
            c.ultimaMensagem = m
          }
          if (!m.lida && m.remetenteId !== currentUser.id) c.naoLidas += 1
        }
      } else {
        const outroId = m.remetenteId === currentUser.id ? m.destinatarioId : m.remetenteId
        if (!outroId) return
        let c = conversaMap.get(outroId)
        if (!c) {
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
        if (!m.lida && m.destinatarioId === currentUser.id) c.naoLidas += 1
      }
    })

    return Array.from(conversaMap.values()).sort((a, b) => {
      if (a.key === '' && b.key !== '') return -1
      if (a.key !== '' && b.key === '') return 1
      const aTime = a.ultimaMensagem?.created || ''
      const bTime = b.ultimaMensagem?.created || ''
      if (aTime && bTime) return aTime < bTime ? 1 : aTime > bTime ? -1 : 0
      if (aTime) return -1
      if (bTime) return 1
      const aName = a.user?.name || ''
      const bName = b.user?.name || ''
      return aName.localeCompare(bName)
    })
  }, [mensagens, usuarios, currentUser])

  // ---------- Mensagens da conversa ativa ----------
  const mensagensAtivas = useMemo(() => {
    if (!currentUser) return []
    if (conversaAtiva === '') {
      return mensagens.filter((m) => m.destinatarioId === '')
    }
    return mensagens.filter(
      (m) =>
        m.destinatarioId !== '' &&
        ((m.remetenteId === currentUser.id && m.destinatarioId === conversaAtiva) ||
          (m.remetenteId === conversaAtiva && m.destinatarioId === currentUser.id)),
    )
  }, [mensagens, currentUser, conversaAtiva])

  // ---------- Marcar mensagens como lidas ----------
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
          } catch {
            // ignora erro individual
          }
        }
        if (pendentes.length > 0) {
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
      setShowList(false)
      marcarComoLidas(key)
    },
    [marcarComoLidas],
  )

  // ---------- Scroll automático ----------
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [mensagensAtivas, conversaAtiva, isOpen])

  // ---------- Enviar mensagem ----------
  const enviarMensagem = async () => {
    const conteudo = texto.trim()
    if (!conteudo || !currentUser || enviando) return
    setEnviando(true)
    try {
      const rec: any = await pb.collection('mensagens').create({
        remetente: currentUser.id,
        destinatario: conversaAtiva === '' ? '' : conversaAtiva,
        texto: conteudo,
        lida: false,
      })
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

  const handleExpand = () => {
    setIsOpen(true)
    setConversaAtiva('')
    setShowList(true)
  }

  const handleMinimize = () => {
    setIsOpen(false)
  }

  if (!currentUser) return null

  const conversaAtivaObj = conversas.find((c) => c.key === conversaAtiva) || null

  // ----------------------------------------------------------------
  // MINIMIZADO: botão flutuante
  // ----------------------------------------------------------------
  if (!isOpen) {
    return (
      <button
        onClick={handleExpand}
        className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-[#1e3a8a] text-white shadow-lg hover:bg-[#1e40af] transition-all hover:scale-105 flex items-center justify-center"
        aria-label="Abrir chat"
      >
        <MessageCircle className="w-7 h-7" />
        {unreadMessagesCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1.5 rounded-full bg-red-600 text-white text-[11px] font-bold flex items-center justify-center ring-2 ring-white animate-pulse">
            {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
          </span>
        )}
      </button>
    )
  }

  // ----------------------------------------------------------------
  // EXPANDIDO: janela de chat
  // ----------------------------------------------------------------
  const containerClass = isMobile
    ? 'fixed inset-0 z-50 flex flex-col bg-white animate-in fade-in-50 duration-150'
    : 'fixed bottom-5 right-5 z-50 w-[360px] h-[480px] rounded-2xl bg-white shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-2 duration-200'

  return (
    <div className={containerClass}>
      {/* Header */}
      <div className="px-3 py-2.5 bg-[#1e3a8a] text-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {!showList && isMobile && (
            <button
              onClick={() => setShowList(true)}
              className="p-1 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Voltar"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <MessageCircle className="w-4 h-4 shrink-0" />
          <span className="text-sm font-semibold truncate">
            {showList
              ? 'Mensagens'
              : conversaAtiva === ''
                ? 'Todos (Grupo)'
                : conversaAtivaObj?.user?.name || 'Conversa'}
          </span>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {!isMobile && (
            <button
              onClick={handleMinimize}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Minimizar"
              title="Minimizar"
            >
              <Minus className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={handleMinimize}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Fechar"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Corpo */}
      <div className="flex-1 flex min-h-0">
        {/* Lista de conversas */}
        <div
          className={`${showList ? 'flex' : 'hidden'} flex-col w-full ${isMobile ? '' : 'border-r border-slate-200'} bg-slate-50/50`}
        >
          <div className="flex-1 overflow-y-auto">
            {conversas.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-400">Carregando...</div>
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
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 border-b border-slate-100 text-left transition-colors ${
                      ativa ? 'bg-blue-50' : 'hover:bg-white'
                    }`}
                  >
                    {isGrupo ? (
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#1e3a8a] to-[#3b82f6] text-white flex items-center justify-center shrink-0 shadow-sm">
                        <Users className="w-4 h-4" />
                      </div>
                    ) : getAvatarUrl(c.user) ? (
                      <Avatar className="w-9 h-9 shrink-0">
                        <AvatarImage src={getAvatarUrl(c.user) || ''} alt={c.user?.name} />
                        <AvatarFallback className={getAvatarColor(c.user?.name || 'U')}>
                          {getInitials(c.user?.name || 'U')}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <div
                        className={`w-9 h-9 rounded-full ${getAvatarColor(
                          c.user?.name || 'U',
                        )} text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm`}
                      >
                        {getInitials(c.user?.name || 'U')}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-800 truncate">
                          {isGrupo ? 'Todos (Grupo)' : c.user?.name || 'Usuário'}
                        </span>
                        {ultima && (
                          <span className="text-[9px] text-slate-400 shrink-0">
                            {formatHora(ultima.created)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <span className="text-[11px] text-slate-500 truncate">
                          {ultima
                            ? `${ultima.remetenteId === currentUser.id ? 'Você: ' : ''}${ultima.texto}`
                            : isGrupo
                              ? 'Equipe toda'
                              : 'Iniciar'}
                        </span>
                        {c.naoLidas > 0 && (
                          <span className="shrink-0 min-w-[16px] h-[16px] px-1 rounded-full bg-[#1e3a8a] text-white text-[9px] font-bold flex items-center justify-center">
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

        {/* Chat ativo */}
        {!showList && (
          <div className="flex flex-col flex-1 bg-slate-50 min-w-0">
            {/* Sub-header do chat */}
            <div className="px-3 py-2 border-b border-slate-200 bg-white flex items-center gap-2 shrink-0">
              {!isMobile && (
                <button
                  onClick={() => setShowList(true)}
                  className="p-1 rounded-lg text-slate-500 hover:bg-slate-100"
                  aria-label="Voltar"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              {conversaAtiva === '' ? (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#1e3a8a] to-[#3b82f6] text-white flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4" />
                </div>
              ) : getAvatarUrl(conversaAtivaObj?.user) ? (
                <Avatar className="w-8 h-8">
                  <AvatarImage
                    src={getAvatarUrl(conversaAtivaObj?.user) || ''}
                    alt={conversaAtivaObj?.user?.name}
                  />
                  <AvatarFallback className={getAvatarColor(conversaAtivaObj?.user?.name || 'U')}>
                    {getInitials(conversaAtivaObj?.user?.name || 'U')}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <div
                  className={`w-8 h-8 rounded-full ${getAvatarColor(
                    conversaAtivaObj?.user?.name || 'U',
                  )} text-white flex items-center justify-center font-bold text-xs shrink-0`}
                >
                  {getInitials(conversaAtivaObj?.user?.name || 'U')}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate">
                  {conversaAtiva === '' ? 'Todos (Grupo)' : conversaAtivaObj?.user?.name}
                </p>
                <p className="text-[10px] text-slate-500 truncate">
                  {conversaAtiva === ''
                    ? 'Toda a equipe'
                    : conversaAtivaObj?.user?.email || 'Individual'}
                </p>
              </div>
            </div>

            {/* Mensagens */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
              {mensagensAtivas.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                  <MessageCircle className="w-8 h-8 opacity-40" />
                  <p className="text-xs">Nenhuma mensagem. Envie a primeira!</p>
                </div>
              ) : (
                mensagensAtivas.map((m) => {
                  const minha = m.remetenteId === currentUser.id
                  const mostrarRemetente = conversaAtiva === '' && !minha
                  return (
                    <div key={m.id} className={`flex ${minha ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[80%] rounded-2xl px-3 py-1.5 shadow-sm ${
                          minha
                            ? 'bg-[#1e3a8a] text-white rounded-br-md'
                            : 'bg-white text-slate-800 border border-slate-200 rounded-bl-md'
                        }`}
                      >
                        {mostrarRemetente && (
                          <p className="text-[10px] font-bold text-[#1e3a8a] mb-0.5">
                            {m.remetenteNome}
                          </p>
                        )}
                        <p className="text-xs whitespace-pre-line break-words">{m.texto}</p>
                        <p
                          className={`text-[9px] mt-0.5 text-right ${
                            minha ? 'text-blue-100' : 'text-slate-400'
                          }`}
                        >
                          {formatHora(m.created)}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Campo de envio */}
            <div className="px-2.5 py-2 border-t border-slate-200 bg-white flex items-center gap-2 shrink-0">
              <Input
                ref={textoRef}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite..."
                disabled={enviando}
                className="flex-1 rounded-full border-slate-300 text-xs h-9"
              />
              <Button
                onClick={enviarMensagem}
                disabled={!texto.trim() || enviando}
                size="icon"
                className="rounded-full bg-[#1e3a8a] hover:bg-[#1e40af] text-white shrink-0 h-9 w-9"
                aria-label="Enviar"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ChatWidget
