import { useState, useEffect, useMemo, useCallback } from 'react'
import { useApp } from '@/context/AppContext'
import { useToast } from '@/hooks/use-toast'
import pb from '@/lib/pocketbase/client'
import { formatDate } from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  MessageCircle,
  Send,
  RotateCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
  Search,
} from 'lucide-react'
import {
  type LembreteWhatsapp,
  type LembreteStatusConfirmacao,
  LEMBRETE_STATUS_ENVIO_LABELS,
  LEMBRETE_STATUS_CONFIRMACAO_LABELS,
  LEMBRETE_STATUS_ENVIO_CLASS,
  LEMBRETE_STATUS_CONFIRMACAO_CLASS,
} from '@/types'

export default function Lembretes() {
  const { currentUser } = useApp()
  const { toast } = useToast()

  const [lembretes, setLembretes] = useState<LembreteWhatsapp[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroData, setFiltroData] = useState<string>('')
  const [filtroConfirmacao, setFiltroConfirmacao] = useState<string>('todos')
  const [busca, setBusca] = useState('')
  const [actionLoadingId, setActionLoadingId] = useState<string>('')

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const filterParts: string[] = []
      if (filtroData) {
        const d = new Date(filtroData + 'T00:00:00')
        const inicio = new Date(d)
        inicio.setHours(0, 0, 0, 0)
        const fim = new Date(d)
        fim.setHours(23, 59, 59, 999)
        filterParts.push(`data_envio >= "${inicio.toISOString()}"`)
        filterParts.push(`data_envio <= "${fim.toISOString()}"`)
      }
      if (filtroConfirmacao !== 'todos') {
        filterParts.push(`status_confirmacao = "${filtroConfirmacao}"`)
      }
      const records = await pb.collection('lembretes_whatsapp').getFullList({
        sort: '-data_envio',
        filter: filterParts.join(' && '),
        expand: 'agendamento_id,paciente_id',
      })
      const rows: LembreteWhatsapp[] = records.map((r: any) => {
        const ag = r.expand?.agendamento_id
        const pac = r.expand?.paciente_id
        return {
          id: r.id,
          agendamento_id: r.agendamento_id || '',
          paciente_id: r.paciente_id || '',
          telefone: r.telefone || '',
          mensagem: r.mensagem || '',
          data_envio: r.data_envio || '',
          status_envio: r.status_envio || 'pendente',
          status_confirmacao: r.status_confirmacao || 'aguardando',
          data_confirmacao: r.data_confirmacao || '',
          resposta_paciente: r.resposta_paciente || '',
          tentativas: Number(r.tentativas) || 0,
          error_message: r.error_message || '',
          created: r.created || '',
          updated: r.updated || '',
          agendamento: ag
            ? {
                id: ag.id,
                date: ag.date || '',
                time: ag.time || '',
                patientName: ag.patientName || '',
                type: ag.type || '',
                status: ag.status || '',
              }
            : undefined,
          paciente: pac
            ? {
                id: pac.id,
                name: pac.name || '',
                mobile: pac.mobile || '',
                phone: pac.phone || '',
              }
            : undefined,
        }
      })
      setLembretes(rows)
    } catch (err) {
      console.error('Erro ao carregar lembretes:', err)
      toast({
        title: 'Erro ao carregar',
        description: 'Não foi possível carregar os lembretes.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [filtroData, filtroConfirmacao, toast])

  useEffect(() => {
    carregar()
  }, [carregar])

  // Filtragem local por busca (nome do paciente / telefone)
  const lembretesFiltrados = useMemo(() => {
    if (!busca.trim()) return lembretes
    const q = busca.toLowerCase()
    return lembretes.filter((l) => {
      const nome = l.paciente?.name || l.agendamento?.patientName || ''
      return nome.toLowerCase().includes(q) || (l.telefone || '').includes(q)
    })
  }, [lembretes, busca])

  // Cards de resumo
  const stats = useMemo(() => {
    const hoje = new Date().toISOString().split('T')[0]
    return {
      enviadosHoje: lembretes.filter(
        (l) =>
          (l.status_envio === 'enviado' || l.status_envio === 'entregue') &&
          (l.data_envio || '').split('T')[0] === hoje,
      ).length,
      confirmados: lembretes.filter((l) => l.status_confirmacao === 'confirmado').length,
      cancelados: lembretes.filter((l) => l.status_confirmacao === 'cancelado').length,
      semResposta: lembretes.filter(
        (l) =>
          l.status_confirmacao === 'aguardando' &&
          (l.status_envio === 'enviado' || l.status_envio === 'entregue'),
      ).length,
      falhas: lembretes.filter((l) => l.status_envio === 'falhou').length,
    }
  }, [lembretes])

  // Ação: reenviar (lembrete que falhou)
  const handleReenviar = async (lembrete: LembreteWhatsapp) => {
    setActionLoadingId(lembrete.id)
    try {
      await pb.collection('lembretes_whatsapp').update(lembrete.id, {
        status_envio: 'pendente',
        error_message: '',
        data_envio: new Date().toISOString(),
      })
      toast({ title: 'Reenvio agendado', description: 'O lembrete voltará a ser enviado.' })
      await carregar()
    } catch (err) {
      toast({
        title: 'Erro ao reenviar',
        description: 'Não foi possível agendar o reenvio.',
        variant: 'destructive',
      })
    } finally {
      setActionLoadingId('')
    }
  }

  // Ação: enviar agora (lembrete pendente)
  const handleEnviarAgora = async (lembrete: LembreteWhatsapp) => {
    setActionLoadingId(lembrete.id)
    try {
      await pb.collection('lembretes_whatsapp').update(lembrete.id, {
        data_envio: new Date().toISOString(),
      })
      toast({
        title: 'Envio adiantado',
        description: 'O lembrete será enviado no próximo ciclo do processador.',
      })
      await carregar()
    } catch (err) {
      toast({
        title: 'Erro ao adiantar',
        description: 'Não foi possível adiantar o envio.',
        variant: 'destructive',
      })
    } finally {
      setActionLoadingId('')
    }
  }

  if (currentUser?.role !== 'admin' && currentUser?.role !== 'profissional') {
    return null
  }

  const cards = [
    {
      label: 'Enviados Hoje',
      value: stats.enviadosHoje,
      icon: Send,
      color: 'bg-blue-50 text-blue-700 border-blue-200',
    },
    {
      label: 'Confirmados',
      value: stats.confirmados,
      icon: CheckCircle2,
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    {
      label: 'Cancelados',
      value: stats.cancelados,
      icon: XCircle,
      color: 'bg-red-50 text-red-700 border-red-200',
    },
    {
      label: 'Sem Resposta',
      value: stats.semResposta,
      icon: Clock,
      color: 'bg-amber-50 text-amber-700 border-amber-200',
    },
    {
      label: 'Falhas',
      value: stats.falhas,
      icon: AlertTriangle,
      color: 'bg-slate-50 text-slate-700 border-slate-200',
    },
  ]

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
            <MessageCircle className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Lembretes de WhatsApp
            </h1>
            <p className="text-sm text-slate-500">
              Acompanhe o envio e a confirmação de presença dos pacientes
            </p>
          </div>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {cards.map((c) => {
          const Icon = c.icon
          return (
            <Card key={c.label} className={`rounded-2xl border ${c.color} shadow-sm`}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-extrabold leading-none">{c.value}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-wider mt-1 opacity-80">
                    {c.label}
                  </p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-3">
        <div className="flex items-center gap-2 flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por paciente ou telefone..."
            className="h-9 rounded-xl border-slate-300 text-sm"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Input
            type="date"
            value={filtroData}
            onChange={(e) => setFiltroData(e.target.value)}
            className="h-9 rounded-xl border-slate-300 text-sm w-full md:w-auto"
          />
          <Select value={filtroConfirmacao} onValueChange={setFiltroConfirmacao}>
            <SelectTrigger className="h-9 rounded-xl border-slate-300 text-sm w-full md:w-52">
              <SelectValue placeholder="Confirmação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas confirmações</SelectItem>
              <SelectItem value="aguardando">Aguardando</SelectItem>
              <SelectItem value="confirmado">Confirmado</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
              <SelectItem value="sem_resposta">Sem resposta</SelectItem>
            </SelectContent>
          </Select>
          {(filtroData || filtroConfirmacao !== 'todos' || busca) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFiltroData('')
                setFiltroConfirmacao('todos')
                setBusca('')
              }}
              className="h-9 rounded-xl border-slate-300 text-xs"
            >
              Limpar
            </Button>
          )}
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Paciente
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Telefone
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Data da Consulta
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Mensagem
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Status Envio
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Confirmação
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-600 uppercase tracking-wider text-right">
                  Ações
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-slate-400 py-10">
                    Carregando lembretes...
                  </TableCell>
                </TableRow>
              ) : lembretesFiltrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-slate-400 py-10">
                    Nenhum lembrete encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                lembretesFiltrados.map((l) => {
                  const nomePaciente = l.paciente?.name || l.agendamento?.patientName || '—'
                  const dataConsulta = l.agendamento?.date
                    ? `${formatDate(l.agendamento.date)} ${l.agendamento.time || ''}`
                    : '—'
                  return (
                    <TableRow key={l.id} className="hover:bg-slate-50/60">
                      <TableCell className="text-sm font-semibold text-slate-800">
                        {nomePaciente}
                        {l.tentativas > 0 && (
                          <span className="block text-[10px] text-slate-400">
                            {l.tentativas} tentativa(s)
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600 font-mono">
                        {l.telefone || '—'}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">{dataConsulta}</TableCell>
                      <TableCell className="text-xs text-slate-500 max-w-[240px]">
                        <p className="line-clamp-2 whitespace-pre-line">{l.mensagem}</p>
                        {l.resposta_paciente && (
                          <p className="mt-1 text-[11px] text-navy-700 font-semibold italic">
                            Resposta: "{l.resposta_paciente}"
                          </p>
                        )}
                        {l.error_message && (
                          <p className="mt-1 text-[11px] text-red-600">Erro: {l.error_message}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-bold ${
                            LEMBRETE_STATUS_ENVIO_CLASS[l.status_envio]
                          }`}
                        >
                          {LEMBRETE_STATUS_ENVIO_LABELS[l.status_envio]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-bold ${
                            LEMBRETE_STATUS_CONFIRMACAO_CLASS[l.status_confirmacao]
                          }`}
                        >
                          {LEMBRETE_STATUS_CONFIRMACAO_LABELS[l.status_confirmacao]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {l.status_envio === 'falhou' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleReenviar(l)}
                              disabled={actionLoadingId === l.id}
                              className="h-8 px-2 text-xs text-blue-700 hover:bg-blue-50 rounded-lg font-semibold"
                              title="Reenviar lembrete"
                            >
                              {actionLoadingId === l.id ? (
                                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                              ) : (
                                <RotateCw className="w-3.5 h-3.5 mr-1" />
                              )}
                              Reenviar
                            </Button>
                          )}
                          {l.status_envio === 'pendente' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEnviarAgora(l)}
                              disabled={actionLoadingId === l.id}
                              className="h-8 px-2 text-xs text-emerald-700 hover:bg-emerald-50 rounded-lg font-semibold"
                              title="Enviar agora"
                            >
                              {actionLoadingId === l.id ? (
                                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                              ) : (
                                <Send className="w-3.5 h-3.5 mr-1" />
                              )}
                              Enviar Agora
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
