import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Appointment,
  AppointmentStatus,
  Procedure,
  PatientPlanType,
  AppointmentProcedureItem,
  getProcedureValueByPlan,
} from '@/types'
import { useApp } from '@/context/AppContext'
import { getAppointmentColor, formatCurrency } from '@/lib/formatters'
import {
  Calendar,
  Clock,
  User,
  AlertCircle,
  DollarSign,
  Check,
  ChevronsUpDown,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import pb from '@/lib/pocketbase/client'

const DURATIONS = [15, 30, 45, 60, 90, 120]
const STATUSES: AppointmentStatus[] = ['Agendado', 'Confirmado', 'Realizado', 'Faltou', 'Cancelado']
const PLAN_OPTIONS: PatientPlanType[] = ['Particular', 'SUS', 'Convênio']

interface AppointmentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  appointmentToEdit?: Appointment | null
  initialDate?: string
  initialTime?: string
  initialPatientId?: string
  initialPatientName?: string
  allowEncaixe?: boolean
  isEncaixe?: boolean
  onSave: (appData: any, options?: { ignoreConflict?: boolean }) => boolean
}

/** Gera opções de horário "HH:MM" de 30 em 30 min (06:00–23:30). */
const TIME_OPTIONS: string[] = (() => {
  const opts: string[] = []
  for (let m = 6 * 60; m <= 23 * 60 + 30; m += 30) {
    const h = Math.floor(m / 60)
    const mm = m % 60
    opts.push(`${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`)
  }
  return opts
})()

export const AppointmentModal: React.FC<AppointmentModalProps> = ({
  open,
  onOpenChange,
  appointmentToEdit,
  initialDate,
  initialTime,
  initialPatientId,
  initialPatientName,
  allowEncaixe = false,
  onSave,
}) => {
  const { patients } = useApp()

  const [patientId, setPatientId] = useState('')
  const [patientSearch, setPatientSearch] = useState('')
  const [patientDropdownOpen, setPatientDropdownOpen] = useState(false)
  // Lista de procedimentos selecionados (multi-select). O tempo total do
  // agendamento é a SOMA das durações de cada procedimento; o valor é a SOMA
  // dos valores conforme o plano do paciente.
  const [selectedProcedures, setSelectedProcedures] = useState<AppointmentProcedureItem[]>([])
  const [procedureSearch, setProcedureSearch] = useState<string>('')
  const [procedureComboboxOpen, setProcedureComboboxOpen] = useState(false)
  const [planType, setPlanType] = useState<PatientPlanType>('Particular')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('09:00')
  const [duration, setDuration] = useState<number>(60)
  const [value, setValue] = useState<number>(0)
  const [valueSourceLabel, setValueSourceLabel] = useState<string>('')
  const [professionalName, setProfessionalName] = useState('Milton Soares Pacheco')
  const [status, setStatus] = useState<AppointmentStatus>('Agendado')
  const [notes, setNotes] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const [procedures, setProcedures] = useState<Procedure[]>([])
  const [proceduresLoading, setProceduresLoading] = useState(false)

  const loadProcedures = useCallback(async () => {
    setProceduresLoading(true)
    try {
      const records = await pb.collection('procedures').getFullList({
        filter: 'active = true',
        sort: 'name',
      })
      const rows: Procedure[] = records.map((r: any) => {
        const particular = Number(r.valueParticular ?? r.value) || 0
        return {
          id: r.id,
          name: r.name || '',
          duration: Number(r.duration) || 30,
          value: Number(r.value) || particular,
          valueParticular: particular,
          valueSUS: Number(r.valueSUS) || 0,
          valueConvenio: Number(r.valueConvenio) || 0,
          category: r.category || '',
          active: r.active !== false,
          createdAt: r.created || '',
          updatedAt: r.updated || '',
        }
      })
      setProcedures(rows)
    } catch (err) {
      console.error('Erro ao carregar procedimentos:', err)
      setProcedures([])
    } finally {
      setProceduresLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      loadProcedures()
    }
  }, [open, loadProcedures])

  useEffect(() => {
    if (appointmentToEdit) {
      setPatientId(appointmentToEdit.patientId)
      setPatientSearch(appointmentToEdit.patientName)
      // Ao editar, monta a lista de procedimentos selecionados a partir do
      // proceduresList salvo (ou fallback legado procedureId/type/value).
      const pat = patients.find((p) => p.id === appointmentToEdit.patientId)
      const plan: PatientPlanType = appointmentToEdit.planType || pat?.planType || 'Particular'
      setPlanType(plan)
      const initialList: AppointmentProcedureItem[] =
        Array.isArray(appointmentToEdit.proceduresList) &&
        appointmentToEdit.proceduresList.length > 0
          ? appointmentToEdit.proceduresList
          : appointmentToEdit.procedureId || appointmentToEdit.type
            ? [
                {
                  procedureId: appointmentToEdit.procedureId || '',
                  procedureName: appointmentToEdit.type || '',
                  value: Number(appointmentToEdit.value || 0),
                  planType: plan,
                },
              ]
            : []
      setSelectedProcedures(initialList)
      setProcedureSearch('')
      setDate(appointmentToEdit.date)
      setTime(appointmentToEdit.time)
      setDuration(appointmentToEdit.duration)
      setValue(appointmentToEdit.value ?? 0)
      setValueSourceLabel(initialList.length > 0 ? `Soma para ${plan}` : '')
      setProfessionalName(appointmentToEdit.professionalName)
      setStatus(appointmentToEdit.status)
      setNotes(appointmentToEdit.notes || '')
    } else {
      setPatientId(initialPatientId || '')
      setPatientSearch(initialPatientName || '')
      // Pré-seleciona o plano conforme o paciente inicial (se houver).
      {
        const pat = initialPatientId ? patients.find((p) => p.id === initialPatientId) : undefined
        setPlanType(pat?.planType || 'Particular')
      }
      setSelectedProcedures([])
      setProcedureSearch('')
      setDate(initialDate || new Date().toISOString().split('T')[0])
      setTime(initialTime || '09:00')
      setDuration(60)
      setValue(0)
      setValueSourceLabel('')
      setProfessionalName('Milton Soares Pacheco')
      setStatus('Agendado')
      setNotes('')
    }
    setErrorMessage('')
    setPatientDropdownOpen(false)
    setProcedureComboboxOpen(false)
  }, [
    appointmentToEdit,
    initialDate,
    initialTime,
    initialPatientId,
    initialPatientName,
    open,
    patients,
  ])

  const filteredPatients = useMemo(() => {
    if (!patientSearch.trim()) return patients.slice(0, 6)
    const q = patientSearch.toLowerCase().trim()
    return patients.filter((p) => p.name.toLowerCase().includes(q) || p.cpf.includes(q)).slice(0, 8)
  }, [patients, patientSearch])

  const filteredProcedures = useMemo(() => {
    const q = procedureSearch.toLowerCase().trim()
    if (!q) return procedures
    return procedures.filter((p) => p.name.toLowerCase().includes(q))
  }, [procedures, procedureSearch])

  // Opções de horário (30 em 30 min). Garante que o horário atual (mesmo fora
  // da grade regular) esteja presente para não "perder" o valor ao editar.
  const timeOptions = useMemo(() => {
    if (!time || TIME_OPTIONS.includes(time)) return TIME_OPTIONS
    return [...TIME_OPTIONS, time].sort()
  }, [time])

  /**
   * Reajusta o valor exibido conforme o procedimento e o tipo de pagamento
   * informados. Mantém o campo editável em seguida.
   */
  /**
   * Recalcula, a partir da lista de procedimentos selecionados, a duração
   * total (soma das durações) e o valor total (soma dos valores conforme o
   * plano) exibidos no modal. Os campos continuam editáveis depois.
   */
  const recalcTotals = useCallback(
    (list: AppointmentProcedureItem[], plan: PatientPlanType) => {
      const totalDuration = list.reduce((sum, it) => {
        const proc = procedures.find((p) => p.id === it.procedureId)
        return sum + (proc ? Number(proc.duration) || 0 : 0)
      }, 0)
      const totalValue = list.reduce((sum, it) => sum + (Number(it.value) || 0), 0)
      setDuration(totalDuration > 0 ? totalDuration : 60)
      setValue(totalValue)
      setValueSourceLabel(list.length > 0 ? `Soma para ${plan}` : '')
    },
    [procedures],
  )

  const handleSelectPatient = (p: (typeof patients)[0]) => {
    setPatientId(p.id)
    setPatientSearch(p.name)
    setPatientDropdownOpen(false)
    // Pré-seleciona o tipo de pagamento conforme o plano do novo paciente.
    const plan: PatientPlanType = p.planType || 'Particular'
    setPlanType(plan)
    // Reajusta os valores dos procedimentos já selecionados conforme o novo
    // plano do paciente.
    if (selectedProcedures.length > 0) {
      const updated = selectedProcedures.map((it) => {
        const proc = procedures.find((pp) => pp.id === it.procedureId)
        return {
          ...it,
          value: proc ? getProcedureValueByPlan(proc, plan) : it.value,
          planType: plan,
        }
      })
      setSelectedProcedures(updated)
      recalcTotals(updated, plan)
    }
  }

  /**
   * Alterna um procedimento na seleção múltipla. Ao marcar, soma sua
   * duração/valor; ao desmarcar, subtrai. O combobox permanece aberto para
   * permitir selecionar vários procedimentos em sequência.
   */
  const handleToggleProcedure = (procId: string) => {
    const proc = procedures.find((p) => p.id === procId)
    if (!proc) return
    setSelectedProcedures((prev) => {
      const exists = prev.find((it) => it.procedureId === procId)
      let next: AppointmentProcedureItem[]
      if (exists) {
        next = prev.filter((it) => it.procedureId !== procId)
      } else {
        next = [
          ...prev,
          {
            procedureId: proc.id,
            procedureName: proc.name,
            value: getProcedureValueByPlan(proc, planType),
            planType,
          },
        ]
      }
      recalcTotals(next, planType)
      return next
    })
  }

  /**
   * Remove um procedimento da seleção (tag/badge clicável).
   */
  const handleRemoveProcedure = (procId: string) => {
    setSelectedProcedures((prev) => {
      const next = prev.filter((it) => it.procedureId !== procId)
      recalcTotals(next, planType)
      return next
    })
  }

  /**
   * Ao trocar o tipo de pagamento, reajusta os valores de todos os
   * procedimentos selecionados conforme o novo plano.
   */
  const handleChangePlanType = (plan: PatientPlanType) => {
    setPlanType(plan)
    if (selectedProcedures.length > 0) {
      const updated = selectedProcedures.map((it) => {
        const proc = procedures.find((pp) => pp.id === it.procedureId)
        return {
          ...it,
          value: proc ? getProcedureValueByPlan(proc, plan) : it.value,
          planType: plan,
        }
      })
      setSelectedProcedures(updated)
      recalcTotals(updated, plan)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')

    if (!patientId && !patientSearch.trim()) {
      setErrorMessage('Selecione ou informe o paciente.')
      return
    }
    if (selectedProcedures.length === 0) {
      setErrorMessage('Selecione ao menos um procedimento.')
      return
    }
    if (!date) {
      setErrorMessage('Informe a data do agendamento.')
      return
    }
    if (!time) {
      setErrorMessage('Informe o horário inicial.')
      return
    }

    const patientObj = patients.find((p) => p.id === patientId)
    const patientName = patientObj ? patientObj.name : patientSearch.trim()
    const patientPhone = patientObj?.mobile || patientObj?.phone || ''

    // Nome de exibição = todos os procedimentos separados por vírgula.
    const proceduresDisplay = selectedProcedures.map((it) => it.procedureName).join(', ')
    // Campo legado: mantém o primeiro procedimento para compatibilidade.
    const firstProc = selectedProcedures[0]

    const payload = {
      patientId: patientId || `pat-temp-${Date.now()}`,
      patientName,
      patientPhone,
      procedureId: firstProc?.procedureId || '',
      type: proceduresDisplay,
      // Lista completa de procedimentos (estruturada) + string legada.
      proceduresList: selectedProcedures,
      procedimentos: proceduresDisplay,
      date,
      time,
      duration,
      value,
      planType,
      professionalName,
      status,
      notes,
    }

    const ok = onSave(payload, { ignoreConflict: allowEncaixe })
    if (ok) {
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl w-full rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto">
        <DialogHeader className="border-b border-slate-100 pb-3">
          <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-teal-600" />
            <span>{appointmentToEdit ? 'Editar Agendamento' : 'Novo Agendamento'}</span>
          </DialogTitle>
        </DialogHeader>

        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Autocomplete de Paciente */}
          <div className="relative">
            <Label className="text-xs font-semibold text-slate-700">
              Paciente <span className="text-red-500">*</span>
            </Label>
            <Input
              value={patientSearch}
              onChange={(e) => {
                setPatientSearch(e.target.value)
                setPatientId('')
                setPatientDropdownOpen(true)
              }}
              onFocus={() => setPatientDropdownOpen(true)}
              placeholder="Digite o nome ou CPF para buscar..."
              className="h-10 rounded-xl mt-1 text-sm border-slate-300"
            />
            {patientDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto divide-y divide-slate-100">
                {filteredPatients.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => handleSelectPatient(p)}
                    className="p-2.5 hover:bg-teal-50 cursor-pointer text-xs flex items-center justify-between"
                  >
                    <div>
                      <span className="font-bold text-slate-800 block">{p.name}</span>
                      <span className="text-slate-400 text-[10px]">CPF: {p.cpf}</span>
                    </div>
                    <span className="text-teal-600 text-[11px] font-semibold">{p.mobile}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Procedimentos (multi-select) + Profissional */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label className="text-xs font-semibold text-slate-700">
                Procedimentos <span className="text-red-500">*</span>{' '}
                <span className="text-slate-400 font-normal">
                  (selecione um ou mais — a duração é a soma)
                </span>
              </Label>
              <Popover open={procedureComboboxOpen} onOpenChange={setProcedureComboboxOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    role="combobox"
                    aria-expanded={procedureComboboxOpen}
                    className="flex h-10 w-full items-center justify-between rounded-xl mt-1 border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 text-left hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                  >
                    <span className="truncate">
                      {selectedProcedures.length > 0
                        ? `${selectedProcedures.length} procedimento(s) selecionado(s)`
                        : proceduresLoading
                          ? 'Carregando...'
                          : 'Selecione um ou mais procedimentos'}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Digite parte do nome do procedimento..."
                      value={procedureSearch}
                      onValueChange={setProcedureSearch}
                    />
                    <CommandList>
                      {procedures.length === 0 && !proceduresLoading && (
                        <CommandEmpty>Nenhum procedimento ativo</CommandEmpty>
                      )}
                      {proceduresLoading && (
                        <CommandEmpty>Carregando procedimentos...</CommandEmpty>
                      )}
                      {!proceduresLoading && filteredProcedures.length === 0 && (
                        <CommandEmpty>Nenhum procedimento encontrado</CommandEmpty>
                      )}
                      <CommandGroup>
                        {filteredProcedures.map((p) => {
                          const color = getAppointmentColor(p.name)
                          const checked = selectedProcedures.some((it) => it.procedureId === p.id)
                          return (
                            <CommandItem
                              key={p.id}
                              value={p.id}
                              onSelect={() => handleToggleProcedure(p.id)}
                              className="text-xs font-medium"
                            >
                              <span className="flex items-center gap-2 w-full">
                                <span
                                  className={`flex h-4 w-4 items-center justify-center rounded border shrink-0 ${
                                    checked
                                      ? 'bg-teal-500 border-teal-500 text-white'
                                      : 'border-slate-300 bg-white'
                                  }`}
                                >
                                  {checked && <Check className="h-3 w-3" />}
                                </span>
                                <span
                                  className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                                  style={{ backgroundColor: color.hex }}
                                />
                                <span className="flex-1 truncate">{p.name}</span>
                                <span className="text-slate-400 text-[10px]">
                                  {p.duration}min • Part: {formatCurrency(p.valueParticular)} • SUS:{' '}
                                  {formatCurrency(p.valueSUS)} • Conv:{' '}
                                  {formatCurrency(p.valueConvenio)}
                                </span>
                              </span>
                            </CommandItem>
                          )
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {/* Tags dos procedimentos selecionados */}
              {selectedProcedures.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {selectedProcedures.map((it) => {
                    const color = getAppointmentColor(it.procedureName)
                    return (
                      <Badge
                        key={it.procedureId}
                        variant="secondary"
                        className="text-[10px] font-semibold pl-2 pr-1 py-0.5 gap-1 rounded-full"
                        style={{ backgroundColor: `${color.hex}22`, color: color.hex }}
                      >
                        {it.procedureName}
                        <button
                          type="button"
                          onClick={() => handleRemoveProcedure(it.procedureId)}
                          className="ml-0.5 hover:bg-black/10 rounded-full p-0.5"
                          aria-label={`Remover ${it.procedureName}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="sm:col-span-2">
              <Label className="text-xs font-semibold text-slate-700">
                Profissional Responsável <span className="text-red-500">*</span>
              </Label>
              <Select value={professionalName} onValueChange={setProfessionalName}>
                <SelectTrigger className="h-10 rounded-xl mt-1 border-slate-300 text-xs font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Milton Soares Pacheco">
                    Milton Soares Pacheco (CRFa 3-11981-5)
                  </SelectItem>
                  <SelectItem value="Dr. Lucas Ferreira Santos">
                    Dr. Lucas Ferreira Santos (CRFa 2-20381)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tipo de Pagamento + Duração */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-semibold text-slate-700">
                Tipo de Pagamento <span className="text-red-500">*</span>
              </Label>
              <Select
                value={planType}
                onValueChange={(v: PatientPlanType) => handleChangePlanType(v)}
              >
                <SelectTrigger className="h-10 rounded-xl mt-1 border-slate-300 text-xs font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLAN_OPTIONS.map((plan) => (
                    <SelectItem key={plan} value={plan}>
                      {plan}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">
                Duração (min) <span className="text-slate-400 font-normal">editável</span>
              </Label>
              <div className="relative">
                <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  type="number"
                  min={5}
                  step={5}
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value) || 0)}
                  className="h-10 rounded-xl mt-1 text-xs border-slate-300 pl-9"
                />
              </div>
            </div>
          </div>

          {/* Data, Hora */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-semibold text-slate-700">
                Data <span className="text-red-500">*</span>
              </Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-10 rounded-xl mt-1 text-xs border-slate-300"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">
                Horário <span className="text-red-500">*</span>{' '}
                <span className="text-slate-400 font-normal">editável</span>
              </Label>
              <Select value={time} onValueChange={setTime}>
                <SelectTrigger className="h-10 rounded-xl mt-1 border-slate-300 text-xs font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {timeOptions.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {allowEncaixe && (
                <p className="text-[11px] text-amber-600 font-medium mt-1">
                  Encaixe: conflito de horário é permitido.
                </p>
              )}
            </div>
          </div>

          {/* Valor */}
          <div>
            <Label className="text-xs font-semibold text-slate-700">
              Valor (R$) <span className="text-slate-400 font-normal">editável</span>
            </Label>
            <div className="relative max-w-[240px]">
              <DollarSign className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                type="number"
                min={0}
                step="0.01"
                value={value}
                onChange={(e) => setValue(Number(e.target.value) || 0)}
                className="h-10 rounded-xl mt-1 text-xs border-slate-300 pl-9"
              />
            </div>
            {valueSourceLabel && (
              <p className="text-[11px] text-teal-600 font-medium mt-1">{valueSourceLabel}</p>
            )}
          </div>

          {/* Status */}
          <div>
            <Label className="text-xs font-semibold text-slate-700">
              Status do Agendamento <span className="text-red-500">*</span>
            </Label>
            <Select value={status} onValueChange={(val: AppointmentStatus) => setStatus(val)}>
              <SelectTrigger className="h-10 rounded-xl mt-1 border-slate-300 text-xs font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((st) => (
                  <SelectItem key={st} value={st}>
                    {st}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Observações */}
          <div>
            <Label className="text-xs font-semibold text-slate-700">Observações Clínicas</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Queixas trazidas pelo paciente, motivo específico do retorno..."
              rows={2}
              className="rounded-xl mt-1 text-xs border-slate-300 resize-none"
            />
          </div>

          <DialogFooter className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl border-slate-300 text-xs font-semibold"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-xs font-semibold shadow-sm"
            >
              Salvar Agendamento
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
