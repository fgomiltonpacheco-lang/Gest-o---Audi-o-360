import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
  Procedure,
  PatientPlanType,
  AppointmentProcedureItem,
  getProcedureValueByPlan,
} from '@/types'
import { useApp } from '@/context/AppContext'
import { formatCurrency } from '@/lib/formatters'
import pb from '@/lib/pocketbase/client'
import {
  Stethoscope,
  Plus,
  Trash2,
  Check,
  ChevronsUpDown,
  Clock,
  User,
  FileText,
  DollarSign,
  AlertCircle,
} from 'lucide-react'

interface AttendanceModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  appointment: Appointment | null
  onFinish: (appointmentId: string) => void
  onOpenProntuario: (patientId: string) => void
}

/**
 * Modal de Atendimento: permite ao profissional acrescentar ou remover
 * procedimentos durante o atendimento, ver o valor total e finalizar.
 * Ao finalizar, salva `proceduresList`, atualiza `value` com o total,
 * marca status "Realizado" e reception "atendido".
 */
export const AttendanceModal: React.FC<AttendanceModalProps> = ({
  open,
  onOpenChange,
  appointment,
  onFinish,
  onOpenProntuario,
}) => {
  const { updateAppointment } = useApp()

  const [items, setItems] = useState<AppointmentProcedureItem[]>([])
  const [procedureSearch, setProcedureSearch] = useState('')
  const [comboboxOpen, setComboboxOpen] = useState(false)
  const [procedures, setProcedures] = useState<Procedure[]>([])
  const [proceduresLoading, setProceduresLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const planType: PatientPlanType = appointment?.planType || 'Particular'

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

  // Inicializa a lista de procedimentos a partir do agendamento.
  useEffect(() => {
    if (open && appointment) {
      const base =
        appointment.proceduresList && appointment.proceduresList.length > 0
          ? appointment.proceduresList.map((p) => ({ ...p }))
          : [
              {
                procedureId: appointment.procedureId || '',
                procedureName: appointment.type || '',
                value: Number(appointment.value || 0),
                planType: appointment.planType || 'Particular',
              },
            ]
      setItems(base)
      setErrorMessage('')
      setProcedureSearch('')
      setComboboxOpen(false)
    }
  }, [open, appointment])

  const filteredProcedures = useMemo(() => {
    const q = procedureSearch.toLowerCase().trim()
    if (!q) return procedures
    return procedures.filter((p) => p.name.toLowerCase().includes(q))
  }, [procedures, procedureSearch])

  const total = useMemo(() => items.reduce((sum, it) => sum + (Number(it.value) || 0), 0), [items])

  const handleAddProcedure = (procId: string) => {
    const proc = procedures.find((p) => p.id === procId)
    if (!proc) return
    // Evita duplicar o mesmo procedimento.
    if (items.some((it) => it.procedureId === proc.id)) {
      setComboboxOpen(false)
      setProcedureSearch('')
      return
    }
    const value = getProcedureValueByPlan(proc, planType)
    setItems((prev) => [
      ...prev,
      {
        procedureId: proc.id,
        procedureName: proc.name,
        value,
        planType,
      },
    ])
    setComboboxOpen(false)
    setProcedureSearch('')
  }

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const handleItemValueChange = (index: number, newValue: number) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, value: newValue } : it)))
  }

  const handleFinish = () => {
    if (!appointment) return
    if (items.length === 0) {
      setErrorMessage('Adicione ao menos um procedimento antes de finalizar.')
      return
    }
    const finishTotal = items.reduce((sum, it) => sum + (Number(it.value) || 0), 0)
    const firstProc = items[0]
    const res = updateAppointment(appointment.id, {
      proceduresList: items,
      value: finishTotal,
      // Mantém compatibilidade com os campos legados: procedureId/type
      // passam a refletir o primeiro procedimento da lista.
      procedureId: firstProc.procedureId || appointment.procedureId || '',
      type: firstProc.procedureName || appointment.type,
      status: 'Realizado',
      reception: 'atendido',
    })
    if (res.success) {
      onOpenChange(false)
      onFinish(appointment.id)
    } else {
      setErrorMessage(res.message || 'Não foi possível finalizar o atendimento.')
    }
  }

  const handleOpenProntuario = () => {
    if (!appointment) return
    onOpenChange(false)
    onOpenProntuario(appointment.patientId)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-full rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto">
        <DialogHeader className="border-b border-slate-100 pb-3">
          <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-teal-600" />
            <span>Atendimento</span>
          </DialogTitle>
        </DialogHeader>

        {appointment && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <User className="w-4 h-4 text-slate-400" />
              {appointment.patientName}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {appointment.date} às {appointment.time}
              </span>
              <span className="flex items-center gap-1">
                <Stethoscope className="w-3.5 h-3.5 text-slate-400" />
                {appointment.professionalName}
              </span>
              <Badge
                variant="outline"
                className="text-[10px] font-bold px-1.5 py-0 h-4 border bg-blue-50 text-blue-700 border-blue-200"
              >
                {planType}
              </Badge>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Lista de procedimentos */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Procedimentos do Atendimento
            </h3>
            <span className="text-[11px] text-slate-400">
              {items.length} {items.length === 1 ? 'item' : 'itens'}
            </span>
          </div>

          {items.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
              Nenhum procedimento adicionado. Use o botão abaixo.
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((it, index) => (
                <div
                  key={`${it.procedureId || 'manual'}-${index}`}
                  className="flex items-center gap-2 p-2.5 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">
                      {it.procedureName || 'Procedimento sem nome'}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {it.procedureId ? 'Vinculado à tabela' : 'Sem vínculo'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={it.value}
                      onChange={(e) => handleItemValueChange(index, Number(e.target.value) || 0)}
                      className="h-8 w-24 rounded-lg text-xs border-slate-200"
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRemoveItem(index)}
                    className="h-8 w-8 p-0 text-red-500 hover:bg-red-50 rounded-lg"
                    title="Remover procedimento"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Adicionar procedimento (autocomplete) */}
          <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="w-full h-9 rounded-xl border-dashed border-slate-300 text-xs font-semibold text-teal-700 hover:bg-teal-50 hover:border-teal-400"
              >
                <Plus className="w-4 h-4 mr-1" />
                Adicionar procedimento
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <Command shouldFilter={false}>
                <CommandInput
                  placeholder="Digite parte do nome do procedimento..."
                  value={procedureSearch}
                  onValueChange={setProcedureSearch}
                />
                <CommandList>
                  {proceduresLoading && <CommandEmpty>Carregando procedimentos...</CommandEmpty>}
                  {!proceduresLoading && filteredProcedures.length === 0 && (
                    <CommandEmpty>Nenhum procedimento encontrado</CommandEmpty>
                  )}
                  <CommandGroup>
                    {filteredProcedures.map((p) => {
                      const value = getProcedureValueByPlan(p, planType)
                      const alreadyAdded = items.some((it) => it.procedureId === p.id)
                      return (
                        <CommandItem
                          key={p.id}
                          value={p.id}
                          onSelect={() => handleAddProcedure(p.id)}
                          className="text-xs font-medium"
                          disabled={alreadyAdded}
                        >
                          <span className="flex items-center gap-2 w-full">
                            <span className="flex-1 truncate">{p.name}</span>
                            <span className="text-slate-400 text-[10px]">
                              {formatCurrency(value)}
                            </span>
                            {alreadyAdded && (
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
        </div>

        {/* Rodapé: total + ações */}
        <div className="border-t border-slate-100 pt-3 space-y-3">
          <div className="flex items-center justify-between bg-teal-50 border border-teal-200 rounded-xl px-4 py-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-teal-700">
                Valor Total
              </p>
              <p className="text-[11px] text-teal-600">Soma de {items.length} procedimento(s)</p>
            </div>
            <span className="text-2xl font-extrabold text-teal-800">{formatCurrency(total)}</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleOpenProntuario}
              className="w-full sm:w-auto rounded-xl border-slate-300 text-xs font-semibold"
            >
              <FileText className="w-4 h-4 mr-1.5" />
              Abrir prontuário
            </Button>
            <Button
              type="button"
              onClick={handleFinish}
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm"
            >
              <Check className="w-4 h-4 mr-1.5" />
              Finalizar atendimento
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
