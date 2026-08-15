import React, { useState } from 'react'
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
import { BeraExam, Patient } from '@/types'
import { Zap } from 'lucide-react'

interface BeraModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  patient: Patient
  onSave: (exam: Omit<BeraExam, 'id'>) => void
}

export const BeraModal: React.FC<BeraModalProps> = ({ open, onOpenChange, patient, onSave }) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [professionalName, setProfessionalName] = useState('Dra. Mariana Silva Costa')

  // OD Waves
  const [w1OD, setW1OD] = useState<number>(1.6)
  const [w3OD, setW3OD] = useState<number>(3.7)
  const [w5OD, setW5OD] = useState<number>(5.65)
  const [threshOD, setThreshOD] = useState<number>(25)

  // OE Waves
  const [w1OE, setW1OE] = useState<number>(1.62)
  const [w3OE, setW3OE] = useState<number>(3.75)
  const [w5OE, setW5OE] = useState<number>(5.7)
  const [threshOE, setThreshOE] = useState<number>(25)

  const [classification, setClassification] = useState<'Normal' | 'Alterado'>('Normal')
  const [notes, setNotes] = useState(
    'Ondas I, III e V identificadas com morfologia adequada e latências absolutas e interpicos dentro dos limites normais.',
  )

  // Cálculos automáticos de interpicos
  const interI_III_OD = Number((w3OD - w1OD).toFixed(2))
  const interIII_V_OD = Number((w5OD - w3OD).toFixed(2))
  const interI_V_OD = Number((w5OD - w1OD).toFixed(2))

  const interI_III_OE = Number((w3OE - w1OE).toFixed(2))
  const interIII_V_OE = Number((w5OE - w3OE).toFixed(2))
  const interI_V_OE = Number((w5OE - w1OE).toFixed(2))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      patientId: patient.id,
      patientName: patient.name,
      date,
      professionalName,
      od: {
        waveI: w1OD,
        waveIII: w3OD,
        waveV: w5OD,
        interI_III: interI_III_OD,
        interIII_V: interIII_V_OD,
        interI_V: interI_V_OD,
        threshold: threshOD,
      },
      oe: {
        waveI: w1OE,
        waveIII: w3OE,
        waveV: w5OE,
        interI_III: interI_III_OE,
        interIII_V: interIII_V_OE,
        interI_V: interI_V_OE,
        threshold: threshOE,
      },
      classification,
      notes,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
        <DialogHeader className="border-b border-slate-100 pb-3">
          <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Zap className="w-5 h-5 text-pink-600" />
            <span>Registro de BERA / PEATE (Tronco Encefálico)</span>
          </DialogTitle>
          <p className="text-xs text-slate-500">
            Paciente: <strong>{patient.name}</strong>
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-semibold text-slate-700">Data do Exame</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-10 rounded-xl mt-1 text-xs border-slate-300"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700">Profissional</Label>
              <Select value={professionalName} onValueChange={setProfessionalName}>
                <SelectTrigger className="h-10 rounded-xl mt-1 border-slate-300 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Dra. Mariana Silva Costa">Dra. Mariana Silva Costa</SelectItem>
                  <SelectItem value="Dr. Lucas Ferreira Santos">
                    Dr. Lucas Ferreira Santos
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Orelha Direita (OD) */}
          <div className="p-4 rounded-xl border border-red-200 bg-red-50/20 space-y-3">
            <h4 className="text-xs font-bold text-red-700 uppercase tracking-wider">
              Latências Absolutas e Interpicos — OD (ms)
            </h4>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              <div>
                <Label className="text-[11px] text-slate-700">Onda I (ms)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={w1OD}
                  onChange={(e) => setW1OD(Number(e.target.value))}
                  className="h-8 text-xs bg-white mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px] text-slate-700">Onda III (ms)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={w3OD}
                  onChange={(e) => setW3OD(Number(e.target.value))}
                  className="h-8 text-xs bg-white mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px] text-slate-700">Onda V (ms)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={w5OD}
                  onChange={(e) => setW5OD(Number(e.target.value))}
                  className="h-8 text-xs bg-white mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px] text-red-700 font-bold">Limiar (dBnHL)</Label>
                <Input
                  type="number"
                  value={threshOD}
                  onChange={(e) => setThreshOD(Number(e.target.value))}
                  className="h-8 text-xs bg-white mt-1"
                />
              </div>
            </div>
            <div className="text-[11px] text-slate-600 bg-white p-2 rounded-lg border border-red-100 flex items-center justify-between">
              <span>
                Interpico I-III: <strong>{interI_III_OD} ms</strong>
              </span>
              <span>
                Interpico III-V: <strong>{interIII_V_OD} ms</strong>
              </span>
              <span>
                Interpico I-V: <strong>{interI_V_OD} ms</strong>
              </span>
            </div>
          </div>

          {/* Orelha Esquerda (OE) */}
          <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/20 space-y-3">
            <h4 className="text-xs font-bold text-blue-700 uppercase tracking-wider">
              Latências Absolutas e Interpicos — OE (ms)
            </h4>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              <div>
                <Label className="text-[11px] text-slate-700">Onda I (ms)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={w1OE}
                  onChange={(e) => setW1OE(Number(e.target.value))}
                  className="h-8 text-xs bg-white mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px] text-slate-700">Onda III (ms)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={w3OE}
                  onChange={(e) => setW3OE(Number(e.target.value))}
                  className="h-8 text-xs bg-white mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px] text-slate-700">Onda V (ms)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={w5OE}
                  onChange={(e) => setW5OE(Number(e.target.value))}
                  className="h-8 text-xs bg-white mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px] text-blue-700 font-bold">Limiar (dBnHL)</Label>
                <Input
                  type="number"
                  value={threshOE}
                  onChange={(e) => setThreshOE(Number(e.target.value))}
                  className="h-8 text-xs bg-white mt-1"
                />
              </div>
            </div>
            <div className="text-[11px] text-slate-600 bg-white p-2 rounded-lg border border-blue-100 flex items-center justify-between">
              <span>
                Interpico I-III: <strong>{interI_III_OE} ms</strong>
              </span>
              <span>
                Interpico III-V: <strong>{interIII_V_OE} ms</strong>
              </span>
              <span>
                Interpico I-V: <strong>{interI_V_OE} ms</strong>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-semibold text-slate-700">Classificação Final</Label>
              <Select value={classification} onValueChange={(v: any) => setClassification(v)}>
                <SelectTrigger
                  className={`h-10 rounded-xl mt-1 text-xs font-bold ${
                    classification === 'Normal'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-red-50 text-red-700 border-red-200'
                  }`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Normal">Normal</SelectItem>
                  <SelectItem value="Alterado">Alterado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">Parecer Diagnóstico</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="rounded-xl mt-1 text-xs border-slate-300 resize-none"
              />
            </div>
          </div>

          <DialogFooter className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
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
              Salvar Exame BERA
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
