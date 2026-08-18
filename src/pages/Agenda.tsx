import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useApp } from '@/context/AppContext'
import {
  Calendar as CalendarIcon,
  Plus,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  Filter,
  Check,
  X,
  Pencil,
  Trash2,
  Stethoscope,
  List,
  CalendarDays,
  Grid,
  UserCheck,
  DoorOpen,
  Zap,
  AlertTriangle,
  Lock,
  LockOpen,
  Clock3,
  MessageCircle,
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  formatDate,
  formatCurrency,
  APPOINTMENT_TYPE_COLORS,
  getAppointmentColor,
} from '@/lib/formatters'
import { getHolidayOnDate, getYearHolidays } from '@/lib/holidays'
import {
  Appointment,
  AppointmentType,
  AppointmentStatus,
  PatientPlanType,
  type LembreteWhatsapp,
  type LembreteStatusConfirmacao,
} from '@/types'
import pb from '@/lib/pocketbase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AppointmentModal } from '@/components/AppointmentModal'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { usePrint } from '@/components/print/PrintProvider'
import { AgendaPrint } from '@/components/print/PrintDocuments'

// ---------- Helpers de procedimentos múltiplos ----------

/**
 * Retorna o rótulo de procedimentos para o card da agenda. Quando há
 * múltiplos procedimentos, mostra o primeiro + contador; caso contrário,
 * devolve o nome único (comportamento legado).
 */
function getProceduresLabel(app: Appointment): string {
  const list = app.proceduresList
  if (!list || list.length === 0) return app.type
  // Exibe TODOS os procedimentos selecionados, separados por vírgula.
  return (
    list
      .map((it) => it.procedureName)
      .filter(Boolean)
      .join(', ') || app.type
  )
}

/**
 * Soma o valor de todos os procedimentos da lista. Quando não há lista,
 * usa o `value` legado.
 */
function getProceduresTotal(app: Appointment): number {
  const list = app.proceduresList
  if (!list || list.length === 0) return Number(app.value || 0)
  return list.reduce((sum, it) => sum + (Number(it.value) || 0), 0)
}

/** Converte um horário "HH:MM" para minutos desde a meia-noite. */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/** Altura base (px) de cada slot de 30 min na visão Dia. */
const SLOT_HEIGHT = 60

type ViewMode = 'dia' | 'semana' | 'mes' | 'lista'

// ---------- Configuração de horários da clínica ----------

interface DayHours {
  open: boolean
  start: string
  end: string
}
interface OperatingHours {
  monday: DayHours
  tuesday: DayHours
  wednesday: DayHours
  thursday: DayHours
  friday: DayHours
  saturday: DayHours
  sunday: DayHours
}

const DEFAULT_OPERATING_HOURS: OperatingHours = {
  monday: { open: true, start: '07:00', end: '19:00' },
  tuesday: { open: true, start: '07:00', end: '19:00' },
  wednesday: { open: true, start: '07:00', end: '19:00' },
  thursday: { open: true, start: '07:00', end: '19:00' },
  friday: { open: true, start: '07:00', end: '19:00' },
  saturday: { open: true, start: '08:00', end: '12:00' },
  sunday: { open: false, start: '', end: '' },
}

/** Mapa JS getDay() (0=Dom..6=Sáb) -> chave de OperatingHours. */
const WEEKDAY_KEY: Record<number, keyof OperatingHours> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
}

interface BlockedDay {
  id: string
  date: string
  reason: string
  start_time?: string
  end_time?: string
}

/** True quando o bloqueio é parcial (possui intervalo de horário). */
const isPartialBlock = (b: BlockedDay) => !!b.start_time && !!b.end_time

/** Lista de horários "HH:MM" de 30 em 30 min (00:00–23:30). */
const BLOCK_TIME_OPTIONS: string[] = (() => {
  const opts: string[] = []
  for (let m = 0; m < 24 * 60; m += 30) {
    const h = Math.floor(m / 60)
    const mm = m % 60
    opts.push(`${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`)
  }
  return opts
})()

/**
 * Verifica se um horário "HH:MM" cai dentro de um bloqueio parcial
 * [start_time, end_time). O slot é considerado bloqueado quando seu início é
 * menor que o fim do bloqueio E seu início + step é maior que o início do
 * bloqueio (sobreposição de intervalos).
 */
function slotIsInPartialBlock(slotTime: string, b: BlockedDay, stepMin = 30): boolean {
  if (!isPartialBlock(b)) return false
  const sStart = timeToMinutes(b.start_time!)
  const sEnd = timeToMinutes(b.end_time!)
  const slotStart = timeToMinutes(slotTime)
  const slotEnd = slotStart + stepMin
  return slotStart < sEnd && slotEnd > sStart
}

// ---------- Helpers de exibição ----------

const PLAN_CONFIG: Record<PatientPlanType, { badge: string; dot: string }> = {
  Particular: { badge: 'bg-blue-100 text-blue-700 border-blue-200', dot: '#2563eb' },
  SUS: { badge: 'bg-green-100 text-green-700 border-green-200', dot: '#16a34a' },
  Convênio: { badge: 'bg-purple-100 text-purple-700 border-purple-200', dot: '#9333ea' },
}

const STATUS_BADGE_CLASS: Record<AppointmentStatus, string> = {
  Agendado: 'bg-slate-100 text-slate-700 border-slate-200',
  Confirmado: 'bg-teal-50 text-navy-700 border-teal-200',
  Realizado: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Faltou: 'bg-amber-50 text-amber-700 border-amber-200',
  Cancelado: 'bg-red-50 text-red-700 border-red-200',
}

function PlanBadge({ plan }: { plan: PatientPlanType }) {
  const cfg = PLAN_CONFIG[plan] || PLAN_CONFIG.Particular
  return (
    <Badge
      variant="outline"
      className={`text-[10px] font-bold px-1.5 py-0 h-4 border ${cfg.badge}`}
    >
      {plan}
    </Badge>
  )
}

function StatusBadge({ status }: { status: AppointmentStatus }) {
  return (
    <Badge
      variant="outline"
      className={`text-[10px] font-bold px-1.5 py-0 h-4 border ${
        STATUS_BADGE_CLASS[status] || STATUS_BADGE_CLASS.Agendado
      }`}
    >
      {status}
    </Badge>
  )
}

function ReceptionBadge({ reception }: { reception?: string }) {
  if (reception === 'presente') {
    return (
      <Badge className="text-[10px] font-bold px-1.5 py-0 h-4 bg-amber-100 text-amber-800 border border-amber-300">
        <DoorOpen className="w-2.5 h-2.5 mr-0.5" />
        Na recepção
      </Badge>
    )
  }
  if (reception === 'atendendo') {
    return (
      <Badge className="text-[10px] font-bold px-1.5 py-0 h-4 bg-emerald-100 text-emerald-800 border border-emerald-300">
        Em atendimento
      </Badge>
    )
  }
  return null
}

/** Bolinha colorida indicando o estado de recepção (para visões compactas). */
function ReceptionDot({ reception }: { reception?: string }) {
  if (reception === 'presente') {
    return <span className="inline-block w-2 h-2 rounded-full bg-amber-500" title="Na recepção" />
  }
  if (reception === 'atendendo') {
    return (
      <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" title="Em atendimento" />
    )
  }
  return null
}

// ---------- Lembretes de WhatsApp (status de confirmação) ----------

const LEMBRETE_CONFIRMACAO_VISUAL: Record<
  LembreteStatusConfirmacao,
  { emoji: string; label: string; cls: string }
> = {
  confirmado: {
    emoji: '✅',
    label: 'Confirmado via WhatsApp',
    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  cancelado: {
    emoji: '❌',
    label: 'Cancelado via WhatsApp',
    cls: 'bg-red-50 text-red-700 border-red-200',
  },
  aguardando: {
    emoji: '⏳',
    label: 'Aguardando confirmação',
    cls: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  sem_resposta: {
    emoji: '📤',
    label: 'Enviado sem resposta',
    cls: 'bg-slate-100 text-slate-600 border-slate-300',
  },
}

function LembreteStatusBadge({ lembrete }: { lembrete?: LembreteWhatsapp }) {
  if (!lembrete) return null
  const cfg = LEMBRETE_CONFIRMACAO_VISUAL[lembrete.status_confirmacao]
  return (
    <Badge
      variant="outline"
      className={`text-[10px] font-bold px-1.5 py-0 h-4 border ${cfg.cls}`}
      title={cfg.label}
    >
      <MessageCircle className="w-2.5 h-2.5 mr-0.5" />
      {cfg.emoji}
    </Badge>
  )
}

export default function Agenda() {
  const { appointments, addAppointment, updateAppointment, deleteAppointment } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const { print } = usePrint()

  const [viewMode, setViewMode] = useState<ViewMode>('dia')
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [selectedProfessional, setSelectedProfessional] = useState<string>('todos')

  // Permitir agendar em horários ocupados (encaixe)
  const [allowEncaixe, setAllowEncaixe] = useState<boolean>(false)

  // Modais
  const [modalOpen, setModalOpen] = useState(false)
  const [appointmentToEdit, setAppointmentToEdit] = useState<Appointment | null>(null)
  const [modalInitialDate, setModalInitialDate] = useState<string>('')
  const [modalInitialTime, setModalInitialTime] = useState<string>('09:00')
  const [modalInitialPatientId, setModalInitialPatientId] = useState<string>('')
  const [modalInitialPatientName, setModalInitialPatientName] = useState<string>('')

  // Contexto de "Agendar Retorno" vindo do prontuário: guarda o paciente
  // que deve ser pré-preenchido ao criar um novo agendamento. O fluxo é:
  // prontuário -> abre a Agenda em visão de mês -> usuário escolhe o dia ->
  // visão de dia -> clica num slot -> modal abre com paciente pré-preenchido.
  const [retornoPatient, setRetornoPatient] = useState<{
    patientId: string
    patientName: string
  } | null>(null)

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [appointmentToDelete, setAppointmentToDelete] = useState<Appointment | null>(null)

  // Configuração da clínica (horários de funcionamento)
  const [operatingHours, setOperatingHours] = useState<OperatingHours>(DEFAULT_OPERATING_HOURS)
  const [slotMinutes, setSlotMinutes] = useState<number>(30)

  // Dias bloqueados
  const [blockedDays, setBlockedDays] = useState<BlockedDay[]>([])
  const [blockModalOpen, setBlockModalOpen] = useState(false)
  const [blockReason, setBlockReason] = useState('')
  // Modal de bloqueio: toggle dia inteiro + horários parciais
  const [blockAllDay, setBlockAllDay] = useState(true)
  const [blockStartTime, setBlockStartTime] = useState('08:00')
  const [blockEndTime, setBlockEndTime] = useState('12:00')
  // Modal de desbloqueio (lista de bloqueios do dia)
  const [unblockListOpen, setUnblockListOpen] = useState(false)

  // String da data selecionada: YYYY-MM-DD
  const selectedDateStr = selectedDate.toISOString().split('T')[0]

  // ---------- Carregar configuração e bloqueios ----------
  const loadConfig = useCallback(async () => {
    try {
      const records = await pb.collection('clinic_config').getFullList({ sort: '-created' })
      if (records.length > 0) {
        const r = records[0] as any
        const oh = r.operating_hours
        if (oh && typeof oh === 'object') {
          const merged: OperatingHours = { ...DEFAULT_OPERATING_HOURS }
          ;(Object.keys(DEFAULT_OPERATING_HOURS) as (keyof OperatingHours)[]).forEach((k) => {
            const v = (oh as any)[k]
            if (v && typeof v === 'object') {
              merged[k] = {
                open: !!v.open,
                start: v.start || '',
                end: v.end || '',
              }
            }
          })
          setOperatingHours(merged)
        }
        setSlotMinutes(Number(r.slot_minutes) || 30)
      }
    } catch (err) {
      console.error('Erro ao carregar configuração da clínica:', err)
    }
  }, [])

  const loadBlockedDays = useCallback(async () => {
    try {
      const records = await pb.collection('blocked_days').getFullList({ sort: 'date' })
      setBlockedDays(
        records.map((r: any) => ({
          id: r.id,
          date: r.date || '',
          reason: r.reason || '',
          start_time: r.start_time || '',
          end_time: r.end_time || '',
        })),
      )
    } catch (err) {
      console.error('Erro ao carregar dias bloqueados:', err)
    }
  }, [])

  useEffect(() => {
    loadConfig()
    loadBlockedDays()
  }, [loadConfig, loadBlockedDays])

  // ---------- Lembretes de WhatsApp (visão Dia) ----------
  // Busca os lembretes da coleção lembretes_whatsapp filtrando pelo
  // agendamento_id de cada appointment do dia selecionado, montando um mapa
  // agendamento_id -> lembrete para exibir o status de confirmação ao lado de
  // cada agendamento e um resumo no topo da visão do dia.
  const [lembretesMap, setLembretesMap] = useState<Record<string, LembreteWhatsapp>>({})

  const loadLembretes = useCallback(async () => {
    const dayAppIds = appointments
      .filter((a) => a.date === selectedDateStr)
      .map((a) => a.id)
      .filter(Boolean)
    if (dayAppIds.length === 0) {
      setLembretesMap({})
      return
    }
    try {
      const filter = dayAppIds.map((id) => `agendamento_id = "${id}"`).join(' || ')
      const records = (await pb.collection('lembretes_whatsapp').getFullList({ filter })) as any[]
      const map: Record<string, LembreteWhatsapp> = {}
      for (const r of records) {
        const aid = r.agendamento_id || ''
        if (!aid) continue
        // Em caso de múltiplos lembretes para o mesmo agendamento, mantém o
        // mais recente (pela data_envio).
        const existing = map[aid]
        if (existing && (existing.data_envio || '') >= (r.data_envio || '')) continue
        map[aid] = {
          id: r.id,
          agendamento_id: aid,
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
        }
      }
      setLembretesMap(map)
    } catch (err) {
      console.error('Erro ao carregar lembretes do dia:', err)
      setLembretesMap({})
    }
  }, [appointments, selectedDateStr])

  useEffect(() => {
    loadLembretes()
  }, [loadLembretes])

  // Resumo de confirmações do dia (visão Dia).
  const dayLembreteStats = useMemo(() => {
    const dayApps = appointments.filter((a) => a.date === selectedDateStr)
    let confirmados = 0
    let pendentes = 0
    let cancelados = 0
    for (const a of dayApps) {
      const l = lembretesMap[a.id]
      if (!l) continue
      if (l.status_confirmacao === 'confirmado') confirmados++
      else if (l.status_confirmacao === 'cancelado') cancelados++
      else pendentes++
    }
    return { total: confirmados + pendentes + cancelados, confirmados, pendentes, cancelados }
  }, [appointments, selectedDateStr, lembretesMap])

  // Tratar estado vindo de navegação externa (ex.: clicar em "Agendar Retorno" no prontuário).
  // Em vez de abrir o modal imediatamente, guardamos os dados do paciente e
  // exibimos a visão de mês para o usuário escolher o dia primeiro. Ao clicar
  // num dia, a visão de dia é exibida com todos os horários; ao clicar num
  // slot, o modal abre com o paciente pré-preenchido.
  useEffect(() => {
    if (location.state && (location.state as any).openModal) {
      const state = location.state as {
        openModal: boolean
        patientId?: string
        patientName?: string
      }
      setAppointmentToEdit(null)
      setModalInitialPatientId('')
      setModalInitialPatientName('')
      setRetornoPatient({
        patientId: state.patientId || '',
        patientName: state.patientName || '',
      })
      setViewMode('mes')
      // Limpar o estado do history para não reabrir o fluxo em re-render ou navegações
      window.history.replaceState({}, document.title)
    }
  }, [location.state])

  // Helpers de bloqueio
  // Bloqueios totais (dia inteiro) da data.
  const fullDayBlocksOf = (dateStr: string) =>
    blockedDays.filter((b) => b.date === dateStr && !isPartialBlock(b))
  // Bloqueios parciais (intervalo de horário) da data.
  const partialBlocksOf = (dateStr: string) =>
    blockedDays.filter((b) => b.date === dateStr && isPartialBlock(b))
  // Indica se a data possui qualquer bloqueio.
  const isBlocked = (dateStr: string) => blockedDays.some((b) => b.date === dateStr)
  // Indica se a data possui bloqueio total (dia inteiro).
  const isFullDayBlocked = (dateStr: string) => fullDayBlocksOf(dateStr).length > 0
  // Bloqueios da data selecionada (todos)
  const selectedBlocks = blockedDays.filter((b) => b.date === selectedDateStr)
  const selectedHasFullDayBlock = isFullDayBlocked(selectedDateStr)
  // Mantém compat. com código legado que esperava um único objeto.
  const selectedBlocked = isBlocked(selectedDateStr) ? selectedBlocks[0] : undefined

  // Feriado na data selecionada (visão Dia)
  const selectedHoliday = useMemo(() => getHolidayOnDate(selectedDateStr), [selectedDateStr])

  // ---------- Bloquear / desbloquear dia ----------
  const handleBlockDay = async () => {
    const reason = blockReason.trim()
    const partial = !blockAllDay && blockStartTime && blockEndTime
    if (partial && timeToMinutes(blockEndTime) <= timeToMinutes(blockStartTime)) {
      // validação simples: horário final deve ser maior que o inicial
      return
    }
    try {
      const payload: any = {
        date: selectedDateStr,
        reason,
        created_by: '',
        start_time: partial ? blockStartTime : '',
        end_time: partial ? blockEndTime : '',
      }
      const rec: any = await pb.collection('blocked_days').create(payload)
      setBlockedDays((prev) =>
        [
          ...prev,
          {
            id: rec.id,
            date: selectedDateStr,
            reason,
            start_time: partial ? blockStartTime : '',
            end_time: partial ? blockEndTime : '',
          },
        ].sort((a, b) => (a.date < b.date ? -1 : 1)),
      )
      setBlockModalOpen(false)
      setBlockReason('')
    } catch (err) {
      console.error('Erro ao bloquear dia:', err)
    }
  }

  const handleUnblockDay = async (id: string) => {
    try {
      await pb.collection('blocked_days').delete(id)
      setBlockedDays((prev) => prev.filter((b) => b.id !== id))
    } catch (err) {
      console.error('Erro ao desbloquear dia:', err)
    }
  }

  // Quando há múltiplos bloqueios no dia, abre o seletor para escolher.
  const openUnblockForSelected = () => {
    if (selectedBlocks.length <= 1 && selectedBlocks[0]) {
      handleUnblockDay(selectedBlocks[0].id)
    } else {
      setUnblockListOpen(true)
    }
  }

  // Navegação Temporal
  const handlePrev = () => {
    const d = new Date(selectedDate)
    if (viewMode === 'dia') d.setDate(d.getDate() - 1)
    else if (viewMode === 'semana') d.setDate(d.getDate() - 7)
    else if (viewMode === 'mes') d.setMonth(d.getMonth() - 1)
    else d.setDate(d.getDate() - 1)
    setSelectedDate(d)
  }

  const handleNext = () => {
    const d = new Date(selectedDate)
    if (viewMode === 'dia') d.setDate(d.getDate() + 1)
    else if (viewMode === 'semana') d.setDate(d.getDate() + 7)
    else if (viewMode === 'mes') d.setMonth(d.getMonth() + 1)
    else d.setDate(d.getDate() + 1)
    setSelectedDate(d)
  }

  const handleToday = () => {
    setSelectedDate(new Date())
  }

  // Imprimir agenda do período atual (dia/semana/mês/lista)
  const handlePrintAgenda = () => {
    let periodAppts: Appointment[] = filteredAppointments
    let label = periodLabel

    if (viewMode === 'dia') {
      periodAppts = filteredAppointments.filter((a) => a.date === selectedDateStr)
    } else if (viewMode === 'semana') {
      const start = new Date(selectedDate)
      const day = start.getDay()
      start.setDate(start.getDate() - (day === 0 ? 6 : day - 1))
      const end = new Date(start)
      end.setDate(end.getDate() + 6)
      const startStr = start.toISOString().split('T')[0]
      const endStr = end.toISOString().split('T')[0]
      periodAppts = filteredAppointments.filter((a) => a.date >= startStr && a.date <= endStr)
    } else if (viewMode === 'mes') {
      const year = selectedDate.getFullYear()
      const month = selectedDate.getMonth()
      const firstStr = new Date(year, month, 1).toISOString().split('T')[0]
      const lastStr = new Date(year, month + 1, 0).toISOString().split('T')[0]
      periodAppts = filteredAppointments.filter((a) => a.date >= firstStr && a.date <= lastStr)
    }

    print({
      title: 'Agenda de Atendimentos',
      subtitle: `Visão: ${viewMode.charAt(0).toUpperCase() + viewMode.slice(1)}`,
      body: (
        <AgendaPrint
          periodLabel={label}
          appointments={periodAppts.map((a) => ({
            date: a.date,
            time: a.time,
            patientName: a.patientName,
            type: a.type,
            professionalName: a.professionalName,
            duration: a.duration,
            status: a.status,
          }))}
        />
      ),
    })
  }

  // Label do período
  const periodLabel = useMemo(() => {
    if (viewMode === 'dia' || viewMode === 'lista') {
      return new Intl.DateTimeFormat('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(selectedDate)
    }
    if (viewMode === 'mes') {
      return new Intl.DateTimeFormat('pt-BR', {
        month: 'long',
        year: 'numeric',
      }).format(selectedDate)
    }
    // semana
    const start = new Date(selectedDate)
    const day = start.getDay()
    start.setDate(start.getDate() - (day === 0 ? 6 : day - 1)) // segunda-feira
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    return `Semana de ${start.getDate()}/${start.getMonth() + 1} a ${end.getDate()}/${
      end.getMonth() + 1
    } de ${end.getFullYear()}`
  }, [viewMode, selectedDate])

  // Filtro por profissional
  const filteredAppointments = useMemo(() => {
    return appointments.filter((a) => {
      if (selectedProfessional !== 'todos' && a.professionalName !== selectedProfessional) {
        return false
      }
      return true
    })
  }, [appointments, selectedProfessional])

  // Salvar agendamento. `options.ignoreConflict` é repassado para o contexto,
  // permitindo encaixes (agendar sobrepostos) quando o toggle Encaixes está
  // ativo.
  const handleSaveAppointment = (data: any, options?: { ignoreConflict?: boolean }) => {
    if (appointmentToEdit) {
      const res = updateAppointment(appointmentToEdit.id, data, options)
      return res.success
    } else {
      const res = addAppointment(data, options)
      return res.success
    }
  }

  // Ação: iniciar atendimento — navega DIRETO para o prontuário do paciente,
  // sem nenhuma etapa intermediária (modal de procedimentos removido).
  const handleFulfill = (app: Appointment) => {
    if (app.patientId) {
      navigate(`/pacientes/${app.patientId}/prontuario`)
    }
  }

  // Marcar chegada do paciente na recepção
  const handleArrival = (app: Appointment) => {
    updateAppointment(app.id, { reception: 'presente' })
  }

  // Horários para visão de dia, gerados a partir dos horários de
  // funcionamento da clínica. Fallback: 07:00 às 19:00 em blocos de 30 min.
  const timeSlots = useMemo(() => {
    const dayKey = WEEKDAY_KEY[selectedDate.getDay()]
    const cfg = operatingHours[dayKey]
    const step = slotMinutes || 30
    let startStr = '07:00'
    let endStr = '19:00'
    if (cfg && cfg.open && cfg.start && cfg.end) {
      startStr = cfg.start
      endStr = cfg.end
    }
    const startMin = timeToMinutes(startStr)
    const endMin = timeToMinutes(endStr)
    const slots: string[] = []
    for (let m = startMin; m < endMin; m += step) {
      const h = Math.floor(m / 60)
      const mm = m % 60
      slots.push(`${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`)
    }
    return slots
  }, [selectedDate, operatingHours, slotMinutes])

  // Slots ocupados por extensão de agendamentos existentes (duração > slot).
  // Um slot intermediário fica ocupado quando um agendamento iniciado antes
  // se estende até ele: app.time + duration > slotTime.
  // Agendamentos cancelados não bloqueiam slots.
  const busySlots = useMemo(() => {
    const busy = new Set<string>()
    const dayApps = filteredAppointments.filter(
      (a) => a.date === selectedDateStr && a.status !== 'Cancelado',
    )
    for (const app of dayApps) {
      const start = timeToMinutes(app.time)
      const end = start + (Number(app.duration) || 0)
      for (const slot of timeSlots) {
        const s = timeToMinutes(slot)
        // somente slots intermediários (após o início e antes do término)
        if (s > start && s < end) busy.add(slot)
      }
    }
    return busy
  }, [filteredAppointments, selectedDateStr, timeSlots])

  // Slots que devem ser completamente OCULTOS da grade (não renderizados).
  // Um slot é oculto quando existe um agendamento que começou antes (ou no
  // mesmo instante) e cujo término é maior que o horário do slot. O slot
  // inicial (onde começa o agendamento) é tratado separadamente com o card.
  const hiddenSlots = useMemo(() => {
    const hidden = new Set<string>()
    const dayApps = filteredAppointments.filter(
      (a) => a.date === selectedDateStr && a.status !== 'Cancelado',
    )
    for (const app of dayApps) {
      const start = timeToMinutes(app.time)
      const end = start + (Number(app.duration) || 0)
      for (const slot of timeSlots) {
        const s = timeToMinutes(slot)
        // slot inicial (s === start) mostra o card; demais dentro do
        // intervalo [start, end) são ocultados.
        if (s >= start && s < end && s !== start) {
          hidden.add(slot)
        }
      }
    }
    return hidden
  }, [filteredAppointments, selectedDateStr, timeSlots])

  // Mapa de agendamentos por horário de início (para a visão Dia).
  const appsByTime = useMemo(() => {
    const map = new Map<string, Appointment[]>()
    for (const app of filteredAppointments) {
      if (app.date !== selectedDateStr) continue
      const arr = map.get(app.time) || []
      arr.push(app)
      map.set(app.time, arr)
    }
    return map
  }, [filteredAppointments, selectedDateStr])

  // Dias da semana para visão de semana
  const weekDays = useMemo(() => {
    const days: Date[] = []
    const start = new Date(selectedDate)
    const day = start.getDay()
    const mondayOffset = day === 0 ? -6 : 1 - day
    start.setDate(start.getDate() + mondayOffset)

    for (let i = 0; i < 7; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      days.push(d)
    }
    return days
  }, [selectedDate])

  // Dias do mês para visão de mês
  const monthDays = useMemo(() => {
    const year = selectedDate.getFullYear()
    const month = selectedDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const days: { date: Date; inCurrentMonth: boolean }[] = []

    // Padding antes do 1º dia
    let startingDay = firstDay.getDay()
    const prevPadding = startingDay === 0 ? 6 : startingDay - 1
    for (let i = prevPadding; i > 0; i--) {
      const d = new Date(year, month, 1 - i)
      days.push({ date: d, inCurrentMonth: false })
    }

    // Dias do mês atual
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, month, i), inCurrentMonth: true })
    }

    // Padding depois
    const remaining = 42 - days.length
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), inCurrentMonth: false })
    }

    return days
  }, [selectedDate])

  // Feriados do mês corrente (visão Mês)
  const monthHolidays = useMemo(() => {
    const year = selectedDate.getFullYear()
    const map = new Map<string, { date: string; name: string }>()
    for (const h of getYearHolidays(year)) map.set(h.date, h)
    return map
  }, [selectedDate])

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Agenda</h1>
            <Badge variant="secondary" className="bg-teal-50 text-navy-700 font-bold text-xs">
              {filteredAppointments.length} atendimentos
            </Badge>
            {viewMode === 'dia' && selectedHoliday && (
              <Badge
                variant="outline"
                className="bg-red-50 text-red-700 border-red-200 font-bold text-[11px]"
              >
                Feriado: {selectedHoliday.name}
              </Badge>
            )}
            {viewMode === 'dia' && selectedHasFullDayBlock && (
              <Badge
                variant="outline"
                className="bg-slate-200 text-slate-700 border-slate-300 font-bold text-[11px]"
              >
                <Lock className="w-3 h-3 mr-1" />
                Dia bloqueado
              </Badge>
            )}
            {viewMode === 'dia' && partialBlocksOf(selectedDateStr).length > 0 && (
              <Badge
                variant="outline"
                className="bg-amber-50 text-amber-700 border-amber-200 font-bold text-[11px]"
              >
                <Clock3 className="w-3 h-3 mr-1" />
                {partialBlocksOf(selectedDateStr).length} bloqueio(s) parcial(is)
              </Badge>
            )}
            {viewMode === 'dia' && dayLembreteStats.total > 0 && (
              <Badge
                variant="outline"
                className="bg-emerald-50 text-emerald-700 border-emerald-200 font-bold text-[11px]"
              >
                <MessageCircle className="w-3 h-3 mr-1" />
                {dayLembreteStats.confirmados} confirmado(s), {dayLembreteStats.pendentes}{' '}
                pendente(s)
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1 capitalize">{periodLabel}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Seletor de Profissional */}
          <Select value={selectedProfessional} onValueChange={setSelectedProfessional}>
            <SelectTrigger className="h-10 rounded-xl border-slate-300 text-xs font-semibold w-[200px] bg-slate-50">
              <SelectValue placeholder="Profissional" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Profissionais</SelectItem>
              <SelectItem value="Milton Soares Pacheco">Milton Soares Pacheco</SelectItem>
              <SelectItem value="Dr. Lucas Ferreira Santos">Dr. Lucas Ferreira</SelectItem>
            </SelectContent>
          </Select>

          {/* Botão Novo Agendamento */}
          <Button
            onClick={() => {
              setAppointmentToEdit(null)
              setModalInitialDate(selectedDateStr)
              setModalInitialTime('09:00')
              setModalInitialPatientId('')
              setModalInitialPatientName('')
              setModalOpen(true)
            }}
            className="rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-xs font-semibold h-10 shadow-sm flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Novo Agendamento
          </Button>
        </div>
      </div>

      {/* Barra de Controles: Navegação e Modos de Visualização */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Controles de Navegação */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrev}
            className="h-9 w-9 p-0 rounded-xl border-slate-300"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleToday}
            className="h-9 px-3 rounded-xl border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Hoje
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNext}
            className="h-9 w-9 p-0 rounded-xl border-slate-300"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
          <span className="text-xs font-bold text-slate-800 ml-2 capitalize">{periodLabel}</span>
        </div>

        {/* Alternância de Visões */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setViewMode('dia')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'dia'
                ? 'bg-white text-teal-600 shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Dia{' '}
          </button>
          <button
            onClick={() => setViewMode('semana')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'semana'
                ? 'bg-white text-teal-600 shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Semana{' '}
          </button>
          <button
            onClick={() => setViewMode('mes')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'mes'
                ? 'bg-white text-teal-600 shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Mês{' '}
          </button>
          <button
            onClick={() => setViewMode('lista')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'lista'
                ? 'bg-white text-teal-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Lista
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Botão Bloquear / Desbloquear dia (somente visão Dia) */}
          {viewMode === 'dia' &&
            (selectedBlocked ? (
              <button
                onClick={openUnblockForSelected}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border bg-white text-slate-600 hover:bg-slate-50 border-slate-300"
                title="Desbloquear dia"
              >
                <LockOpen className="w-3.5 h-3.5" />
                Desbloquear dia
              </button>
            ) : (
              <button
                onClick={() => {
                  setBlockReason('')
                  setBlockAllDay(true)
                  setBlockStartTime('08:00')
                  setBlockEndTime('12:00')
                  setBlockModalOpen(true)
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border bg-white text-slate-600 hover:bg-slate-50 border-slate-300"
                title="Bloquear dia"
              >
                <Lock className="w-3.5 h-3.5" />
                Bloquear dia
              </button>
            ))}

          {/* Toggle Permitir Encaixes (somente visão Dia) */}
          <button
            onClick={() => setAllowEncaixe((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
              allowEncaixe
                ? 'bg-white text-amber-600 shadow-sm border-amber-200'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-transparent'
            }`}
            title="Permitir agendar em horários ocupados (encaixe)"
          >
            <Zap className="w-3.5 h-3.5" />
            Encaixes
          </button>
        </div>
      </div>

      {/* 1. VISÃO DIA */}
      {viewMode === 'dia' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
          {selectedHasFullDayBlock ? (
            // Dia totalmente bloqueado: card centralizado em vez dos slots.
            // (Bloqueios parciais no mesmo dia ainda são exibidos dentro da
            // grade como slots marcados; o dia inteiro prevalece.)
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                <Lock className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-700">Dia bloqueado</h3>
              <p className="text-sm text-slate-500 mt-1">
                {selectedBlocked?.reason
                  ? `Motivo: ${selectedBlocked.reason}`
                  : 'Sem motivo informado.'}
              </p>
              <p className="text-xs text-slate-400 mt-0.5 capitalize">{periodLabel}</p>
              <Button
                onClick={openUnblockForSelected}
                variant="outline"
                className="mt-5 rounded-xl border-slate-300 text-xs font-semibold h-9 flex items-center gap-1.5"
              >
                <LockOpen className="w-3.5 h-3.5" />
                Desbloquear dia
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {timeSlots.map((time) => {
                // Slots ocultos (intermediários de agendamentos longos) não
                // são renderizados — o card do agendamento inicial já ocupa
                // visualmente o espaço proporcional à duração.
                if (hiddenSlots.has(time)) return null

                const matchedApps = appsByTime.get(time) || []
                const isBusy = busySlots.has(time)
                const showBusyStyle = isBusy && matchedApps.length === 0
                // Bloqueio parcial que cobre este slot.
                const partialBlockHere = partialBlocksOf(selectedDateStr).find((b) =>
                  slotIsInPartialBlock(time, b, slotMinutes || 30),
                )
                return (
                  <div
                    key={time}
                    className={`py-2.5 flex items-start gap-4 transition-colors group rounded-xl px-2 ${
                      partialBlockHere
                        ? 'bg-slate-100/70 hover:bg-slate-100'
                        : showBusyStyle
                          ? allowEncaixe
                            ? 'bg-amber-50/50 hover:bg-amber-50'
                            : 'bg-slate-100/60 hover:bg-slate-100/80'
                          : 'hover:bg-slate-50/70'
                    }`}
                  >
                    <span className="w-14 text-xs font-bold text-slate-400 shrink-0 pt-1 font-mono">
                      {time}
                    </span>

                    <div className="flex-1 min-h-[44px] flex flex-wrap gap-3">
                      {matchedApps.length === 0 ? (
                        partialBlockHere ? (
                          <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5 py-1">
                            <Lock className="w-3.5 h-3.5 text-slate-400" />
                            Bloqueado
                            {partialBlockHere.reason ? `: ${partialBlockHere.reason}` : ''}
                            <span className="text-slate-300 font-mono">
                              ({partialBlockHere.start_time}–{partialBlockHere.end_time})
                            </span>
                          </span>
                        ) : isBusy ? (
                          allowEncaixe ? (
                            <button
                              onClick={() => {
                                setAppointmentToEdit(null)
                                setModalInitialDate(selectedDateStr)
                                setModalInitialTime(time)
                                setModalInitialPatientId(retornoPatient?.patientId || '')
                                setModalInitialPatientName(retornoPatient?.patientName || '')
                                setModalOpen(true)
                              }}
                              className="text-[11px] text-amber-700 font-semibold flex items-center gap-1 hover:underline py-1"
                            >
                              <AlertTriangle className="w-3.5 h-3.5" />
                              Encaixar neste horário
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5 py-1 italic">
                              <span className="line-through opacity-60">Ocupado</span>
                            </span>
                          )
                        ) : (
                          <button
                            onClick={() => {
                              setAppointmentToEdit(null)
                              setModalInitialDate(selectedDateStr)
                              setModalInitialTime(time)
                              setModalInitialPatientId(retornoPatient?.patientId || '')
                              setModalInitialPatientName(retornoPatient?.patientName || '')
                              setModalOpen(true)
                            }}
                            className="opacity-0 group-hover:opacity-100 text-[11px] text-teal-600 font-semibold flex items-center gap-1 hover:underline py-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Agendar neste horário
                          </button>
                        )
                      ) : (
                        matchedApps.map((app) => {
                          const typeConfig = getAppointmentColor(app.type)
                          const plan: PatientPlanType = app.planType || 'Particular'
                          const isPresent = app.reception === 'presente'
                          // Altura proporcional à duração: cada 30 min = 1 slot
                          // (60px). Mínimo de 1 slot.
                          const slotsCount = Math.max(1, app.duration / 30)
                          const cardMinHeight = SLOT_HEIGHT * slotsCount
                          return (
                            <div
                              key={app.id}
                              className={`p-3 rounded-xl border ${typeConfig.border} ${typeConfig.bg} flex-1 min-w-[280px] flex items-center justify-between gap-3 shadow-sm`}
                              style={{ minHeight: `${cardMinHeight}px` }}
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={`text-xs font-bold ${typeConfig.text}`}>
                                    {app.patientName}
                                  </span>
                                  <StatusBadge status={app.status} />
                                  <PlanBadge plan={plan} />
                                  <ReceptionBadge reception={app.reception} />
                                  <LembreteStatusBadge lembrete={lembretesMap[app.id]} />
                                </div>
                                <p className="text-[11px] text-slate-600 mt-0.5">
                                  {getProceduresLabel(app)} • {app.duration} min •{' '}
                                  {app.professionalName}
                                </p>
                                <p className="text-[11px] text-slate-700 font-semibold mt-0.5">
                                  {formatCurrency(getProceduresTotal(app))}
                                </p>
                                {app.notes && (
                                  <p className="text-[10px] text-slate-500 italic mt-0.5 truncate">
                                    {app.notes}
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                {/* Chegou: marcar presença na recepção */}
                                {app.status !== 'Cancelado' &&
                                  app.status !== 'Realizado' &&
                                  !app.reception && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleArrival(app)}
                                      className="h-8 px-2 text-xs text-emerald-700 hover:bg-emerald-100/60 rounded-lg font-semibold"
                                      title="Confirmar chegada do paciente"
                                    >
                                      <UserCheck className="w-3.5 h-3.5 mr-1" />
                                      Chegou
                                    </Button>
                                  )}
                                {/* Atender: só quando paciente presente e ainda não realizado */}
                                {app.status !== 'Realizado' && isPresent && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleFulfill(app)}
                                    className="h-8 px-2 text-xs text-emerald-900 bg-emerald-100 hover:bg-emerald-200 rounded-lg font-semibold"
                                    title="Realizar atendimento e abrir prontuário"
                                  >
                                    <Check className="w-3.5 h-3.5 mr-1" />
                                    Atender
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setAppointmentToEdit(app)
                                    setModalOpen(true)
                                  }}
                                  className="h-8 w-8 p-0 text-slate-600 hover:bg-white/80 rounded-lg"
                                  title="Editar"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setAppointmentToDelete(app)
                                    setDeleteConfirmOpen(true)
                                  }}
                                  className="h-8 w-8 p-0 text-red-500 hover:bg-white/80 rounded-lg"
                                  title="Excluir"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* 2. VISÃO SEMANA */}
      {viewMode === 'semana' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 overflow-x-auto">
          <div className="grid grid-cols-7 min-w-[800px] gap-2">
            {weekDays.map((d, index) => {
              const dStr = d.toISOString().split('T')[0]
              const isToday = dStr === new Date().toISOString().split('T')[0]
              const dayApps = filteredAppointments.filter((a) => a.date === dStr)
              const dayFullBlocked = isFullDayBlocked(dStr)
              const dayPartialBlocks = partialBlocksOf(dStr)
              const dayBlocked = isBlocked(dStr)
              const holiday = getHolidayOnDate(dStr)

              return (
                <div
                  key={index}
                  className={`rounded-xl border p-2.5 min-h-[400px] flex flex-col justify-between ${
                    dayFullBlocked
                      ? 'border-slate-300 bg-slate-100/80'
                      : dayPartialBlocks.length > 0
                        ? 'border-amber-200 bg-amber-50/30'
                        : isToday
                          ? 'border-teal-400 bg-teal-50/20'
                          : 'border-slate-200 bg-slate-50/40'
                  }`}
                >
                  <div>
                    <div className="text-center pb-2 border-b border-slate-200">
                      <span className="text-[11px] font-bold text-slate-400 uppercase block">
                        {new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(d)}
                      </span>
                      <span
                        className={`text-sm font-extrabold inline-block mt-0.5 w-7 h-7 rounded-full text-center leading-7 ${
                          isToday ? 'bg-teal-500 text-white' : 'text-slate-800'
                        }`}
                      >
                        {d.getDate()}
                      </span>
                      {dayFullBlocked && (
                        <div className="flex items-center justify-center mt-1">
                          <Lock className="w-3 h-3 text-slate-400" />
                        </div>
                      )}
                      {!dayFullBlocked && dayPartialBlocks.length > 0 && (
                        <div className="flex items-center justify-center mt-1">
                          <Clock3 className="w-3 h-3 text-amber-500" />
                        </div>
                      )}
                      {holiday && !dayBlocked && (
                        <span className="block text-[9px] italic text-red-600 mt-0.5 leading-tight">
                          {holiday.name}
                        </span>
                      )}
                    </div>

                    {dayFullBlocked ? (
                      <div className="mt-2.5 text-center">
                        <p className="text-[10px] font-semibold text-slate-500 italic">
                          {fullDayBlocksOf(dStr)[0]?.reason
                            ? `Bloqueado: ${fullDayBlocksOf(dStr)[0]?.reason}`
                            : 'Bloqueado'}
                        </p>
                      </div>
                    ) : dayPartialBlocks.length > 0 ? (
                      <div className="mt-2.5 space-y-1">
                        {dayPartialBlocks.map((pb) => (
                          <p
                            key={pb.id}
                            className="text-[9px] font-semibold text-amber-700 italic leading-tight"
                          >
                            <Clock3 className="w-2.5 h-2.5 inline mr-0.5 -mt-0.5" />
                            {pb.start_time}–{pb.end_time}
                            {pb.reason ? `: ${pb.reason}` : ''}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-1.5 mt-2.5">
                        {dayApps.map((app) => {
                          const typeConfig = getAppointmentColor(app.type)
                          const plan: PatientPlanType = app.planType || 'Particular'
                          const planCfg = PLAN_CONFIG[plan] || PLAN_CONFIG.Particular
                          return (
                            <div
                              key={app.id}
                              onClick={() => {
                                setAppointmentToEdit(app)
                                setModalOpen(true)
                              }}
                              className={`p-2 rounded-lg border ${typeConfig.border} ${typeConfig.bg} text-left cursor-pointer hover:shadow-sm transition-all`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-[10px] font-extrabold text-slate-500 font-mono">
                                  {app.time}
                                </span>
                                <ReceptionDot reception={app.reception} />
                              </div>
                              <span
                                className={`text-xs font-bold ${typeConfig.text} block truncate`}
                              >
                                {app.patientName}
                              </span>
                              <span className="text-[10px] text-slate-500 block truncate">
                                {getProceduresLabel(app)}
                              </span>
                              <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                <Badge
                                  variant="outline"
                                  className={`text-[9px] font-bold px-1 py-0 h-3.5 border ${planCfg.badge}`}
                                >
                                  {plan}
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className={`text-[9px] font-bold px-1 py-0 h-3.5 ${
                                    STATUS_BADGE_CLASS[app.status] || STATUS_BADGE_CLASS.Agendado
                                  }`}
                                >
                                  {app.status}
                                </Badge>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {!dayFullBlocked && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setAppointmentToEdit(null)
                        setModalInitialDate(dStr)
                        setModalInitialTime('09:00')
                        setModalInitialPatientId('')
                        setModalInitialPatientName('')
                        setModalOpen(true)
                      }}
                      className="w-full text-[11px] text-teal-600 hover:bg-teal-50 h-7 rounded-lg mt-2 font-semibold"
                    >
                      + Agendar
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 3. VISÃO MÊS */}
      {viewMode === 'mes' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="grid grid-cols-7 gap-1.5 text-center font-bold text-xs text-slate-500 uppercase tracking-wider mb-2">
            <div>Seg</div>
            <div>Ter</div>
            <div>Qua</div>
            <div>Qui</div>
            <div>Sex</div>
            <div>Sáb</div>
            <div>Dom</div>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {monthDays.map((item, index) => {
              const dStr = item.date.toISOString().split('T')[0]
              const isToday = dStr === new Date().toISOString().split('T')[0]
              const dayApps = filteredAppointments.filter((a) => a.date === dStr)
              const dayFullBlocked = isFullDayBlocked(dStr)
              const dayPartialCount = partialBlocksOf(dStr).length
              const dayBlocked = isBlocked(dStr)
              const holiday = monthHolidays.get(dStr)

              return (
                <div
                  key={index}
                  onClick={() => {
                    setSelectedDate(item.date)
                    setViewMode('dia')
                  }}
                  className={`min-h-[90px] p-2 rounded-xl border text-left cursor-pointer transition-all hover:border-teal-400 ${
                    dayFullBlocked
                      ? 'bg-slate-100 border-slate-300'
                      : dayPartialCount > 0
                        ? 'bg-amber-50/40 border-amber-200'
                        : item.inCurrentMonth
                          ? 'bg-white border-slate-200'
                          : 'bg-slate-50 text-slate-300 border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-extrabold w-6 h-6 rounded-full flex items-center justify-center ${
                        isToday ? 'bg-teal-500 text-white' : 'text-slate-700'
                      }`}
                    >
                      {item.date.getDate()}
                    </span>
                    {dayFullBlocked && <Lock className="w-3 h-3 text-slate-400" />}
                    {!dayFullBlocked && dayPartialCount > 0 && (
                      <Clock3 className="w-3 h-3 text-amber-500" />
                    )}
                  </div>

                  {dayFullBlocked && (
                    <p className="text-[9px] text-slate-500 italic mt-1 truncate">
                      {fullDayBlocksOf(dStr)[0]?.reason
                        ? `Bloqueado: ${fullDayBlocksOf(dStr)[0]?.reason}`
                        : 'Bloqueado'}
                    </p>
                  )}

                  {!dayFullBlocked && dayPartialCount > 0 && (
                    <p className="text-[9px] text-amber-700 italic mt-1 truncate">
                      {dayPartialCount} bloqueio(s) parcial(is)
                    </p>
                  )}

                  {!dayBlocked && holiday && (
                    <p className="text-[9px] italic text-red-600 mt-1 leading-tight line-clamp-2">
                      {holiday.name}
                    </p>
                  )}

                  {!dayBlocked && (
                    <div className="space-y-1 mt-1.5 overflow-hidden">
                      {dayApps.slice(0, 2).map((app) => {
                        const plan: PatientPlanType = app.planType || 'Particular'
                        const planCfg = PLAN_CONFIG[plan] || PLAN_CONFIG.Particular
                        return (
                          <div
                            key={app.id}
                            className="text-[10px] font-semibold truncate bg-teal-50 text-navy-700 px-1.5 py-0.5 rounded border border-teal-100 flex items-center gap-1"
                          >
                            <span
                              className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: planCfg.dot }}
                            />
                            <span className="flex-1 truncate">
                              {app.time} {app.patientName.split(' ')[0]}
                            </span>
                            <ReceptionDot reception={app.reception} />
                          </div>
                        )
                      })}
                      {dayApps.length > 2 && (
                        <span className="text-[9px] font-bold text-teal-600 pl-1">
                          +{dayApps.length - 2} mais
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 4. VISÃO LISTA */}
      {viewMode === 'lista' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider text-[11px] font-bold">
                <tr>
                  <th className="py-3.5 px-4">Data & Horário</th>
                  <th className="py-3.5 px-4">Paciente</th>
                  <th className="py-3.5 px-4">Tipo de Atendimento</th>
                  <th className="py-3.5 px-4">Profissional</th>
                  <th className="py-3.5 px-4">Duração</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Tipo de Pagamento</th>
                  <th className="py-3.5 px-4">Valor</th>
                  <th className="py-3.5 px-4">Recepção</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAppointments.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400 text-xs">
                      Nenhum agendamento encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredAppointments.map((app) => {
                    const typeConfig = getAppointmentColor(app.type)
                    return (
                      <tr key={app.id} className="hover:bg-teal-50/40 transition-colors">
                        <td className="py-3.5 px-4 font-mono text-xs text-slate-700">
                          <span className="font-bold text-slate-900 block">
                            {formatDate(app.date)}
                          </span>
                          <span className="text-teal-600 font-extrabold">{app.time}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            onClick={() => navigate(`/pacientes/${app.patientId}/prontuario`)}
                            className="font-bold text-slate-900 hover:text-teal-600 cursor-pointer block"
                          >
                            {app.patientName}
                          </span>
                          <span className="text-[11px] text-slate-400">{app.patientPhone}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${typeConfig.bg} ${typeConfig.text} ${typeConfig.border}`}
                          >
                            {getProceduresLabel(app)}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-700">{app.professionalName}</td>
                        <td className="py-3.5 px-4 text-slate-600">{app.duration} min</td>
                        <td className="py-3.5 px-4">
                          <Badge
                            variant="outline"
                            className={
                              STATUS_BADGE_CLASS[app.status] || STATUS_BADGE_CLASS.Agendado
                            }
                          >
                            {app.status}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4">
                          <PlanBadge plan={app.planType || 'Particular'} />
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-slate-700 font-semibold">
                          {formatCurrency(getProceduresTotal(app))}
                        </td>
                        <td className="py-3.5 px-4">
                          <ReceptionBadge reception={app.reception} />
                          {!app.reception && <span className="text-[11px] text-slate-400">—</span>}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {app.status !== 'Cancelado' &&
                              app.status !== 'Realizado' &&
                              !app.reception && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleArrival(app)}
                                  className="h-8 px-2 text-xs text-emerald-700 hover:bg-emerald-50 font-semibold rounded-lg"
                                  title="Confirmar chegada do paciente"
                                >
                                  <UserCheck className="w-4 h-4 mr-1" />
                                  Chegou
                                </Button>
                              )}
                            {app.status !== 'Realizado' && app.reception === 'presente' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleFulfill(app)}
                                className="h-8 px-2 text-xs text-emerald-900 bg-emerald-100 hover:bg-emerald-200 font-semibold rounded-lg"
                                title="Realizar e abrir prontuário"
                              >
                                <Check className="w-4 h-4 mr-1" />
                                Atender
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setAppointmentToEdit(app)
                                setModalOpen(true)
                              }}
                              className="h-8 w-8 p-0 text-slate-600 hover:bg-slate-100 rounded-lg"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setAppointmentToDelete(app)
                                setDeleteConfirmOpen(true)
                              }}
                              className="h-8 w-8 p-0 text-red-500 hover:bg-red-50 rounded-lg"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Legenda de Cores dos 10 Tipos de Atendimento + Pagamento + Recepção */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Legenda de Atendimentos Especializados
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {Object.entries(APPOINTMENT_TYPE_COLORS).map(([type, color]) => (
            <div key={type} className="flex items-center gap-2 text-xs text-slate-700">
              <span
                className="w-3 h-3 rounded-full shrink-0 border shadow-xs"
                style={{ backgroundColor: color.hex, borderColor: color.hex }}
              />
              <span className="truncate">{type}</span>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-100 pt-3 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Pagamento:
            </span>
            <span className="flex items-center gap-1 text-xs text-slate-700">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600" /> Particular
            </span>
            <span className="flex items-center gap-1 text-xs text-slate-700">
              <span className="w-2.5 h-2.5 rounded-full bg-green-600" /> SUS
            </span>
            <span className="flex items-center gap-1 text-xs text-slate-700">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-600" /> Convênio
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Recepção:
            </span>
            <span className="flex items-center gap-1 text-xs text-slate-700">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Na recepção
            </span>
            <span className="flex items-center gap-1 text-xs text-slate-700">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Em atendimento
            </span>
          </div>
        </div>
      </div>

      {/* Modal de Agendamento */}
      <AppointmentModal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open)
          if (!open) {
            setModalInitialPatientId('')
            setModalInitialPatientName('')
            // Limpa o contexto de "Agendar Retorno" ao fechar o modal
            // (seja após salvar ou cancelar) para não persistir.
            setRetornoPatient(null)
          }
        }}
        appointmentToEdit={appointmentToEdit}
        initialDate={modalInitialDate}
        initialTime={modalInitialTime}
        initialPatientId={modalInitialPatientId}
        initialPatientName={modalInitialPatientName}
        allowEncaixe={allowEncaixe && !appointmentToEdit}
        isEncaixe={allowEncaixe && !appointmentToEdit}
        onSave={handleSaveAppointment}
      />

      {/* Confirmação de Exclusão */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Cancelar agendamento?"
        description={`Deseja realmente remover o agendamento de ${appointmentToDelete?.patientName} em ${formatDate(
          appointmentToDelete?.date,
        )} às ${appointmentToDelete?.time}?`}
        confirmText="Sim, Cancelar"
        cancelText="Voltar"
        variant="danger"
        onConfirm={() => {
          if (appointmentToDelete) {
            deleteAppointment(appointmentToDelete.id)
            setAppointmentToDelete(null)
          }
        }}
      />

      {/* Modal: Bloquear dia */}
      <Dialog open={blockModalOpen} onOpenChange={setBlockModalOpen}>
        <DialogContent className="max-w-md w-full rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
          <DialogHeader className="border-b border-slate-100 pb-3">
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Lock className="w-5 h-5 text-slate-500" />
              <span>Bloquear dia</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-semibold text-slate-700">Data</Label>
              <Input
                type="date"
                value={selectedDateStr}
                readOnly
                className="h-10 rounded-xl mt-1 text-sm border-slate-300 bg-slate-50 font-mono"
              />
            </div>

            {/* Toggle Dia inteiro */}
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Clock3 className="w-4 h-4 text-slate-500" />
                <Label className="text-xs font-semibold text-slate-700 m-0 cursor-pointer">
                  Dia inteiro
                </Label>
              </div>
              <Switch checked={blockAllDay} onCheckedChange={setBlockAllDay} />
            </div>

            {/* Horários parciais (somente quando "Dia inteiro" desligado) */}
            {!blockAllDay && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-slate-700">
                    Hora inicial <span className="text-red-500">*</span>
                  </Label>
                  <Select value={blockStartTime} onValueChange={setBlockStartTime}>
                    <SelectTrigger className="h-10 rounded-xl mt-1 border-slate-300 text-xs font-medium">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {BLOCK_TIME_OPTIONS.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700">
                    Hora final <span className="text-red-500">*</span>
                  </Label>
                  <Select value={blockEndTime} onValueChange={setBlockEndTime}>
                    <SelectTrigger className="h-10 rounded-xl mt-1 border-slate-300 text-xs font-medium">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {BLOCK_TIME_OPTIONS.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {!blockAllDay &&
                  blockStartTime &&
                  blockEndTime &&
                  timeToMinutes(blockEndTime) <= timeToMinutes(blockStartTime) && (
                    <p className="col-span-2 text-[11px] text-red-600 font-medium -mt-1">
                      A hora final deve ser maior que a inicial.
                    </p>
                  )}
              </div>
            )}

            <div>
              <Label className="text-xs font-semibold text-slate-700">Motivo</Label>
              <Input
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="Ex.: Feriado, Recesso, Manutenção, Almoço..."
                className="h-10 rounded-xl mt-1 text-sm border-slate-300"
              />
            </div>
          </div>
          <DialogFooter className="pt-4">
            <Button
              variant="outline"
              onClick={() => setBlockModalOpen(false)}
              className="rounded-xl border-slate-300 text-xs font-semibold h-10"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleBlockDay}
              className="bg-slate-700 hover:bg-slate-800 text-white font-semibold rounded-xl h-10"
            >
              {blockAllDay ? 'Bloquear dia' : 'Bloquear horário'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Desbloquear (lista de bloqueios do dia) */}
      <Dialog open={unblockListOpen} onOpenChange={setUnblockListOpen}>
        <DialogContent className="max-w-md w-full rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
          <DialogHeader className="border-b border-slate-100 pb-3">
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <LockOpen className="w-5 h-5 text-slate-500" />
              <span>Desbloquear — {formatDate(selectedDateStr)}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="pt-2">
            {selectedBlocks.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                Nenhum bloqueio encontrado para este dia.
              </p>
            ) : (
              <ScrollArea className="max-h-72">
                <ul className="space-y-2">
                  {selectedBlocks.map((b) => {
                    const partial = isPartialBlock(b)
                    return (
                      <li
                        key={b.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            {partial ? (
                              <Clock3 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            ) : (
                              <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            )}
                            <span className="text-xs font-bold text-slate-800">
                              {partial ? 'Bloqueio parcial' : 'Dia inteiro'}
                            </span>
                            {partial && (
                              <span className="text-[11px] text-slate-500 font-mono">
                                {b.start_time}–{b.end_time}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                            {b.reason || 'Sem motivo informado'}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            handleUnblockDay(b.id)
                            // Fecha o modal se não houver mais bloqueios.
                            if (selectedBlocks.length <= 1) {
                              setUnblockListOpen(false)
                            }
                          }}
                          className="h-8 px-2 text-[11px] font-semibold rounded-lg border-slate-300 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" />
                          Remover
                        </Button>
                      </li>
                    )
                  })}
                </ul>
              </ScrollArea>
            )}
          </div>
          <DialogFooter className="pt-4">
            <Button
              variant="outline"
              onClick={() => setUnblockListOpen(false)}
              className="rounded-xl border-slate-300 text-xs font-semibold h-10"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
