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
  getProcedureValueByPlan,
} from '@/types'
import { useApp } from '@/context/AppContext'
import { getAppointmentColor, formatCurrency } from '@/lib/formatters'
import { Calendar, Clock, User, AlertCircle, DollarSign, Check, ChevronsUpDown } from 'lucide-react'
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
  const [procedureId, setProcedureId] = useState<string>('')
  const [procedureName, setProcedureName] = useState<string>('')
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
      setProcedureId(appointmentToEdit.procedureId || '')
      setProcedureName(appointmentToEdit.type || '')
      setProcedureSearch(appointmentToEdit.type || '')
      setDate(appointmentToEdit.date)
      setTime(appointmentToEdit.time)
      setDuration(appointmentToEdit.duration)
      setValue(appointmentToEdit.value ?? 0)
      // Ao editar, pré-seleciona o tipo de pagamento conforme o plano do
      // paciente e indica a origem do valor.
      {
        const pat = patients.find((p) => p.id === appointmentToEdit.patientId)
        // Prefere o planType já salvo no agendamento; senão, usa o do paciente.
        const plan: PatientPlanType = appointmentToEdit.planType || pat?.planType || 'Particular'
        setPlanType(plan)
        setValueSourceLabel(appointmentToEdit.procedureId ? `Valor para ${plan}` : '')
      }
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
      setProcedureId('')
      setProcedureName('')
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
  const applyProcedureValue = useCallback(
    (procId: string, plan: PatientPlanType) => {
      const proc = procedures.find((p) => p.id === procId)
      if (proc) {
        setValue(getProcedureValueByPlan(proc, plan))
        setValueSourceLabel(`Valor para ${plan}`)
      } else {
        setValueSourceLabel('')
      }
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
    // Se um procedimento já estiver selecionado, reajusta o valor conforme o
    // novo tipo de pagamento.
    if (procedureId) {
      applyProcedureValue(procedureId, plan)
    }
  }

  /**
   * Ao selecionar um procedimento no combobox, preenche nome/duração/valor
   * automaticamente. O valor é escolhido conforme o tipo de pagamento atual.
   * Os campos continuam editáveis depois.
   */
  const handleSelectProcedure = (procId: string) => {
    const proc = procedures.find((p) => p.id === procId)
    if (proc) {
      setProcedureId(proc.id)
      setProcedureName(proc.name)
      setProcedureSearch(proc.name)
      setDuration(proc.duration)
      applyProcedureValue(proc.id, planType)
      setProcedureComboboxOpen(false)
    }
  }

  /**
   * Ao trocar o tipo de pagamento, reajusta o valor conforme o procedimento
   * já selecionado e o novo plano.
   */
  const handleChangePlanType = (plan: PatientPlanType) => {
    setPlanType(plan)
    if (procedureId) {
      applyProcedureValue(procedureId, plan)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')

    if (!patientId && !patientSearch.trim()) {
      setErrorMessage('Selecione ou informe o paciente.')
      return
    }
    if (!procedureName.trim()) {
      setErrorMessage('Selecione um procedimento.')
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

    const payload = {
      patientId: patientId || `pat-temp-${Date.now()}`,
      patientName,
      patientPhone,
      procedureId: procedureId || '',
      type: procedureName.trim(),
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

          {/* Procedimento (combobox digitável) + Profissional */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-semibold text-slate-700">
                Procedimento <span className="text-red-500">*</span>
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
                      {procedureName ||
                        (proceduresLoading
                          ? 'Carregando...'
                          : 'Digite ou selecione o procedimento')}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Digite parte do nome do procedimento..."
                      value={procedureSearch}
                      onValueChange={(v) => {
                        setProcedureSearch(v)
                        // Ao digitar, libera o nome para edição manual sem
                        // vincular a um procedimento da lista até que ele seja
                        // selecionado no dropdown.
                        setProcedureName(v)
                        setProcedureId('')
                        setValueSourceLabel('')
                      }}
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
                          return (
                            <CommandItem
                              key={p.id}
                              value={p.id}
                              onSelect={() => handleSelectProcedure(p.id)}
                              className="text-xs font-medium"
                            >
                              <span className="flex items-center gap-2 w-full">
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
                                {procedureId === p.id && (
                                  <Check className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                                )}
                              </span>
                            </CommandItem>
                          )
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {/* Editar nome livremente caso o procedimento não esteja na lista */}
              {procedureId && (
                <Input
                  value={procedureName}
                  onChange={(e) => setProcedureName(e.target.value)}
                  placeholder="Nome do procedimento"
                  className="h-8 rounded-lg mt-1 text-[11px] border-slate-200"
                />
              )}
            </div>

            <div>
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
