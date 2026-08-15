import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
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
} from 'lucide-react'
import { formatDate, APPOINTMENT_TYPE_COLORS } from '@/lib/formatters'
import { Appointment, AppointmentType, AppointmentStatus } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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

type ViewMode = 'dia' | 'semana' | 'mes' | 'lista'

export default function Agenda() {
  const { appointments, addAppointment, updateAppointment, deleteAppointment } = useApp()
  const navigate = useNavigate()
  const { print } = usePrint()

  const [viewMode, setViewMode] = useState<ViewMode>('dia')
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [selectedProfessional, setSelectedProfessional] = useState<string>('todos')

  // Modais
  const [modalOpen, setModalOpen] = useState(false)
  const [appointmentToEdit, setAppointmentToEdit] = useState<Appointment | null>(null)
  const [modalInitialDate, setModalInitialDate] = useState<string>('')
  const [modalInitialTime, setModalInitialTime] = useState<string>('09:00')

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [appointmentToDelete, setAppointmentToDelete] = useState<Appointment | null>(null)

  // String da data selecionada: YYYY-MM-DD
  const selectedDateStr = selectedDate.toISOString().split('T')[0]

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

  // Salvar agendamento
  const handleSaveAppointment = (data: any) => {
    if (appointmentToEdit) {
      const res = updateAppointment(appointmentToEdit.id, data)
      return res.success
    } else {
      const res = addAppointment(data)
      return res.success
    }
  }

  // Ação rápida: Realizar atendimento (leva ao prontuário)
  const handleFulfill = (app: Appointment) => {
    updateAppointment(app.id, { status: 'Realizado' })
    navigate(`/pacientes/${app.patientId}/prontuario`)
  }

  // Horários para visão de dia (07:00 às 19:00 em blocos de 30 min)
  const timeSlots = useMemo(() => {
    const slots: string[] = []
    for (let h = 7; h <= 19; h++) {
      slots.push(`${String(h).padStart(2, '0')}:00`)
      if (h < 19) slots.push(`${String(h).padStart(2, '0')}:30`)
    }
    return slots
  }, [])

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

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Agenda</h1>
            <Badge variant="secondary" className="bg-teal-50 text-navy-700 font-bold text-xs">
              {filteredAppointments.length} atendimentos
            </Badge>
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
              <SelectItem value="Dra. Mariana Silva Costa">Dra. Mariana Silva</SelectItem>
              <SelectItem value="Dr. Lucas Ferreira Santos">Dr. Lucas Ferreira</SelectItem>
            </SelectContent>
          </Select>

          {/* Botão Novo Agendamento */}
          <Button
            onClick={() => {
              setAppointmentToEdit(null)
              setModalInitialDate(selectedDateStr)
              setModalInitialTime('09:00')
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
      </div>

      {/* 1. VISÃO DIA */}
      {viewMode === 'dia' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
          <div className="divide-y divide-slate-100">
            {timeSlots.map((time) => {
              const matchedApps = filteredAppointments.filter(
                (a) => a.date === selectedDateStr && a.time === time,
              )
              return (
                <div
                  key={time}
                  className="py-2.5 flex items-start gap-4 hover:bg-slate-50/70 transition-colors group rounded-xl px-2"
                >
                  <span className="w-14 text-xs font-bold text-slate-400 shrink-0 pt-1 font-mono">
                    {time}
                  </span>

                  <div className="flex-1 min-h-[44px] flex flex-wrap gap-3">
                    {matchedApps.length === 0 ? (
                      <button
                        onClick={() => {
                          setAppointmentToEdit(null)
                          setModalInitialDate(selectedDateStr)
                          setModalInitialTime(time)
                          setModalOpen(true)
                        }}
                        className="opacity-0 group-hover:opacity-100 text-[11px] text-teal-600 font-semibold flex items-center gap-1 hover:underline py-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Agendar neste horário
                      </button>
                    ) : (
                      matchedApps.map((app) => {
                        const typeConfig = APPOINTMENT_TYPE_COLORS[app.type] || {
                          bg: 'bg-teal-50',
                          text: 'text-navy-700',
                          border: 'border-teal-200',
                        }
                        return (
                          <div
                            key={app.id}
                            className={`p-3 rounded-xl border ${typeConfig.border} ${typeConfig.bg} flex-1 min-w-[280px] flex items-center justify-between gap-3 shadow-sm`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-bold ${typeConfig.text}`}>
                                  {app.patientName}
                                </span>
                                <Badge
                                  variant="outline"
                                  className="text-[10px] bg-white border-slate-200"
                                >
                                  {app.status}
                                </Badge>
                              </div>
                              <p className="text-[11px] text-slate-600 mt-0.5">
                                {app.type} • {app.duration} min • {app.professionalName}
                              </p>
                              {app.notes && (
                                <p className="text-[10px] text-slate-500 italic mt-0.5 truncate">
                                  {app.notes}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {app.status !== 'Realizado' && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleFulfill(app)}
                                  className="h-8 px-2 text-xs text-emerald-700 hover:bg-emerald-100/60 rounded-lg font-semibold"
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

              return (
                <div
                  key={index}
                  className={`rounded-xl border p-2.5 min-h-[400px] flex flex-col justify-between ${
                    isToday ? 'border-teal-400 bg-teal-50/20' : 'border-slate-200 bg-slate-50/40'
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
                    </div>

                    <div className="space-y-1.5 mt-2.5">
                      {dayApps.map((app) => {
                        const typeConfig = APPOINTMENT_TYPE_COLORS[app.type] || {
                          bg: 'bg-teal-50',
                          text: 'text-navy-700',
                          border: 'border-teal-200',
                        }
                        return (
                          <div
                            key={app.id}
                            onClick={() => {
                              setAppointmentToEdit(app)
                              setModalOpen(true)
                            }}
                            className={`p-2 rounded-lg border ${typeConfig.border} ${typeConfig.bg} text-left cursor-pointer hover:shadow-sm transition-all`}
                          >
                            <span className="text-[10px] font-extrabold text-slate-500 font-mono block">
                              {app.time}
                            </span>
                            <span className={`text-xs font-bold ${typeConfig.text} block truncate`}>
                              {app.patientName}
                            </span>
                            <span className="text-[10px] text-slate-500 block truncate">
                              {app.type}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setAppointmentToEdit(null)
                      setModalInitialDate(dStr)
                      setModalInitialTime('09:00')
                      setModalOpen(true)
                    }}
                    className="w-full text-[11px] text-teal-600 hover:bg-teal-50 h-7 rounded-lg mt-2 font-semibold"
                  >
                    + Agendar
                  </Button>
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

              return (
                <div
                  key={index}
                  onClick={() => {
                    setSelectedDate(item.date)
                    setViewMode('dia')
                  }}
                  className={`min-h-[90px] p-2 rounded-xl border text-left cursor-pointer transition-all hover:border-teal-400 ${
                    item.inCurrentMonth
                      ? 'bg-white border-slate-200'
                      : 'bg-slate-50 text-slate-300 border-transparent'
                  }`}
                >
                  <span
                    className={`text-xs font-extrabold w-6 h-6 rounded-full flex items-center justify-center ${
                      isToday ? 'bg-teal-500 text-white' : 'text-slate-700'
                    }`}
                  >
                    {item.date.getDate()}
                  </span>

                  <div className="space-y-1 mt-1.5 overflow-hidden">
                    {dayApps.slice(0, 2).map((app) => (
                      <div
                        key={app.id}
                        className="text-[10px] font-semibold truncate bg-teal-50 text-navy-700 px-1.5 py-0.5 rounded border border-teal-100"
                      >
                        {app.time} {app.patientName.split(' ')[0]}
                      </div>
                    ))}
                    {dayApps.length > 2 && (
                      <span className="text-[9px] font-bold text-teal-600 pl-1">
                        +{dayApps.length - 2} mais
                      </span>
                    )}
                  </div>
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
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAppointments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                      Nenhum agendamento encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredAppointments.map((app) => {
                    const typeConfig = APPOINTMENT_TYPE_COLORS[app.type] || {
                      bg: 'bg-teal-50',
                      text: 'text-navy-700',
                      border: 'border-teal-200',
                    }
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
                            {app.type}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-700">{app.professionalName}</td>
                        <td className="py-3.5 px-4 text-slate-600">{app.duration} min</td>
                        <td className="py-3.5 px-4">
                          <Badge
                            variant="outline"
                            className={
                              app.status === 'Realizado'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : app.status === 'Confirmado'
                                  ? 'bg-teal-50 text-navy-700 border-teal-200'
                                  : app.status === 'Cancelado'
                                    ? 'bg-red-50 text-red-700 border-red-200'
                                    : 'bg-slate-100 text-slate-700'
                            }
                          >
                            {app.status}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {app.status !== 'Realizado' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleFulfill(app)}
                                className="h-8 px-2 text-xs text-emerald-700 hover:bg-emerald-50 font-semibold rounded-lg"
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

      {/* Legenda de Cores dos 10 Tipos de Atendimento */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Legenda de Atendimentos Especializados
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1">
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
      </div>

      {/* Modal de Agendamento */}
      <AppointmentModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        appointmentToEdit={appointmentToEdit}
        initialDate={modalInitialDate}
        initialTime={modalInitialTime}
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
    </div>
  )
}
