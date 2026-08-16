import React, { useState, useEffect, useCallback } from 'react'
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
import { Appointment, AppointmentStatus, Procedure } from '@/types'
import { useApp } from '@/context/AppContext'
import { getAppointmentColor } from '@/lib/formatters'
import { Calendar, Clock, User, AlertCircle, DollarSign } from 'lucide-react'
import pb from '@/lib/pocketbase/client'

const DURATIONS = [15, 30, 45, 60, 90, 120]
const STATUSES: AppointmentStatus[] = ['Agendado', 'Confirmado', 'Realizado', 'Faltou', 'Cancelado']

interface AppointmentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  appointmentToEdit?: Appointment | null
  initialDate?: string
  initialTime?: string
  initialPatientId?: string
  initialPatientName?: string
  onSave: (appData: any) => boolean
}

export const AppointmentModal: React.FC<AppointmentModalProps> = ({
  open,
  onOpenChange,
  appointmentToEdit,
  initialDate,
  initialTime,
  initialPatientId,
  initialPatientName,
  onSave,
}) => {
  const { patients } = useApp()

  const [patientId, setPatientId] = useState('')
  const [patientSearch, setPatientSearch] = useState('')
  const [patientDropdownOpen, setPatientDropdownOpen] = useState(false)
  const [procedureId, setProcedureId] = useState<string>('')
  const [procedureName, setProcedureName] = useState<string>('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('09:00')
  const [duration, setDuration] = useState<number>(60)
  const [value, setValue] = useState<number>(0)
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
      const rows: Procedure[] = records.map((r: any) => ({
        id: r.id,
        name: r.name || '',
        duration: Number(r.duration) || 30,
        value: Number(r.value) || 0,
        category: r.category || '',
        active: r.active !== false,
        createdAt: r.created || '',
        updatedAt: r.updated || '',
      }))
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
      setDate(appointmentToEdit.date)
      setTime(appointmentToEdit.time)
      setDuration(appointmentToEdit.duration)
      setValue(appointmentToEdit.value ?? 0)
      setProfessionalName(appointmentToEdit.professionalName)
      setStatus(appointmentToEdit.status)
      setNotes(appointmentToEdit.notes || '')
    } else {
      setPatientId(initialPatientId || '')
      setPatientSearch(initialPatientName || '')
      setProcedureId('')
      setProcedureName('')
      setDate(initialDate || new Date().toISOString().split('T')[0])
      setTime(initialTime || '09:00')
      setDuration(60)
      setValue(0)
      setProfessionalName('Milton Soares Pacheco')
      setStatus('Agendado')
      setNotes('')
    }
    setErrorMessage('')
    setPatientDropdownOpen(false)
  }, [appointmentToEdit, initialDate, initialTime, initialPatientId, initialPatientName, open])

  const filteredPatients = React.useMemo(() => {
    if (!patientSearch.trim()) return patients.slice(0, 6)
    const q = patientSearch.toLowerCase().trim()
    return patients.filter((p) => p.name.toLowerCase().includes(q) || p.cpf.includes(q)).slice(0, 8)
  }, [patients, patientSearch])

  const handleSelectPatient = (p: (typeof patients)[0]) => {
    setPatientId(p.id)
    setPatientSearch(p.name)
    setPatientDropdownOpen(false)
  }

  // Ao selecionar um procedimento, preenche nome/duração/valor automaticamente.
  // Os campos continuam editáveis depois.
  const handleSelectProcedure = (procId: string) => {
    const proc = procedures.find((p) => p.id === procId)
    if (proc) {
      setProcedureId(proc.id)
      setProcedureName(proc.name)
      setDuration(proc.duration)
      setValue(proc.value)
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
      professionalName,
      status,
      notes,
    }

    const ok = onSave(payload)
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

          {/* Procedimento + Profissional */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-semibold text-slate-700">
                Procedimento <span className="text-red-500">*</span>
              </Label>
              <Select value={procedureId} onValueChange={handleSelectProcedure}>
                <SelectTrigger className="h-10 rounded-xl mt-1 border-slate-300 text-xs font-semibold">
                  <SelectValue
                    placeholder={proceduresLoading ? 'Carregando...' : 'Selecione o procedimento'}
                  >
                    {procedureName ||
                      (proceduresLoading ? 'Carregando...' : 'Selecione o procedimento')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {procedures.length === 0 && !proceduresLoading && (
                    <SelectItem value="__none" disabled>
                      Nenhum procedimento ativo
                    </SelectItem>
                  )}
                  {procedures.map((p) => {
                    const color = getAppointmentColor(p.name)
                    return (
                      <SelectItem key={p.id} value={p.id} className="text-xs font-medium">
                        <span className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                            style={{ backgroundColor: color.hex }}
                          />
                          <span className="flex-1 truncate">{p.name}</span>
                          <span className="text-slate-400 text-[10px]">
                            {p.duration}min • R$ {Number(p.value).toFixed(0)}
                          </span>
                        </span>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
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

          {/* Data, Hora, Duração */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                Horário <span className="text-red-500">*</span>
              </Label>
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="h-10 rounded-xl mt-1 text-xs border-slate-300"
              />
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
