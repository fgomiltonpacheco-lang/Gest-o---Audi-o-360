import React, { useState, useEffect } from 'react'
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
import { Appointment, AppointmentType, AppointmentStatus } from '@/types'
import { useApp } from '@/context/AppContext'
import { APPOINTMENT_TYPE_COLORS } from '@/lib/formatters'
import { Calendar, Clock, User, AlertCircle } from 'lucide-react'

const APPOINTMENT_TYPES: AppointmentType[] = [
  'Avaliação auditiva',
  'Audiometria',
  'Imitanciometria',
  'Logoaudiometria',
  'BERA',
  'Adaptação de aparelho',
  'Retorno/ajuste',
  'Manutenção',
  'Entrega de aparelho',
  'Orientação',
]

const DURATIONS = [15, 30, 45, 60, 90]
const STATUSES: AppointmentStatus[] = ['Agendado', 'Confirmado', 'Realizado', 'Faltou', 'Cancelado']

interface AppointmentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  appointmentToEdit?: Appointment | null
  initialDate?: string
  initialTime?: string
  onSave: (appData: any) => boolean
}

export const AppointmentModal: React.FC<AppointmentModalProps> = ({
  open,
  onOpenChange,
  appointmentToEdit,
  initialDate,
  initialTime,
  onSave,
}) => {
  const { patients } = useApp()

  const [patientId, setPatientId] = useState('')
  const [patientSearch, setPatientSearch] = useState('')
  const [patientDropdownOpen, setPatientDropdownOpen] = useState(false)
  const [type, setType] = useState<AppointmentType>('Avaliação auditiva')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('09:00')
  const [duration, setDuration] = useState<number>(60)
  const [professionalName, setProfessionalName] = useState('Dra. Mariana Silva Costa')
  const [status, setStatus] = useState<AppointmentStatus>('Agendado')
  const [notes, setNotes] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (appointmentToEdit) {
      setPatientId(appointmentToEdit.patientId)
      setPatientSearch(appointmentToEdit.patientName)
      setType(appointmentToEdit.type)
      setDate(appointmentToEdit.date)
      setTime(appointmentToEdit.time)
      setDuration(appointmentToEdit.duration)
      setProfessionalName(appointmentToEdit.professionalName)
      setStatus(appointmentToEdit.status)
      setNotes(appointmentToEdit.notes || '')
    } else {
      setPatientId('')
      setPatientSearch('')
      setType('Avaliação auditiva')
      setDate(initialDate || new Date().toISOString().split('T')[0])
      setTime(initialTime || '09:00')
      setDuration(60)
      setProfessionalName('Dra. Mariana Silva Costa')
      setStatus('Agendado')
      setNotes('')
    }
    setErrorMessage('')
    setPatientDropdownOpen(false)
  }, [appointmentToEdit, initialDate, initialTime, open])

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')

    if (!patientId && !patientSearch.trim()) {
      setErrorMessage('Selecione ou informe o paciente.')
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
      type,
      date,
      time,
      duration,
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
      <DialogContent className="max-w-xl w-full rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
        <DialogHeader className="border-b border-slate-100 pb-3">
          <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
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
                    className="p-2.5 hover:bg-blue-50 cursor-pointer text-xs flex items-center justify-between"
                  >
                    <div>
                      <span className="font-bold text-slate-800 block">{p.name}</span>
                      <span className="text-slate-400 text-[10px]">CPF: {p.cpf}</span>
                    </div>
                    <span className="text-blue-600 text-[11px] font-semibold">{p.mobile}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tipo de Atendimento + Profissional */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-semibold text-slate-700">
                Tipo de Atendimento <span className="text-red-500">*</span>
              </Label>
              <Select value={type} onValueChange={(val: AppointmentType) => setType(val)}>
                <SelectTrigger className="h-10 rounded-xl mt-1 border-slate-300 text-xs font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APPOINTMENT_TYPES.map((t) => {
                    const color = APPOINTMENT_TYPE_COLORS[t]
                    return (
                      <SelectItem key={t} value={t} className="text-xs font-medium">
                        <span className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full inline-block"
                            style={{ backgroundColor: color.hex }}
                          />
                          {t}
                        </span>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
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
                  <SelectItem value="Dra. Mariana Silva Costa">
                    Dra. Mariana Silva Costa (CRFa 2-18492)
                  </SelectItem>
                  <SelectItem value="Dr. Lucas Ferreira Santos">
                    Dr. Lucas Ferreira Santos (CRFa 2-20381)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Data, Hora e Duração */}
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
              <Label className="text-xs font-semibold text-slate-700">Duração (min)</Label>
              <Select value={String(duration)} onValueChange={(val) => setDuration(Number(val))}>
                <SelectTrigger className="h-10 rounded-xl mt-1 border-slate-300 text-xs font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATIONS.map((dur) => (
                    <SelectItem key={dur} value={String(dur)}>
                      {dur} minutos
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm"
            >
              Salvar Agendamento
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
