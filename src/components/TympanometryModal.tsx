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
import { TympanometryExam, ReflexStatus, Patient } from '@/types'
import { Activity } from 'lucide-react'

const REFLEX_FREQUENCIES = ['500', '1000', '2000', '4000']

interface TympanometryModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  patient: Patient
  onSave: (exam: Omit<TympanometryExam, 'id'>) => void
}

export const TympanometryModal: React.FC<TympanometryModalProps> = ({
  open,
  onOpenChange,
  patient,
  onSave,
}) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [professionalName, setProfessionalName] = useState('Dra. Mariana Silva Costa')

  // Timpanometria OD
  const [curveOD, setCurveOD] = useState<'A' | 'As' | 'Ad' | 'B' | 'C'>('A')
  const [compOD, setCompOD] = useState<number>(0.65)
  const [pressOD, setPressOD] = useState<number>(-10)
  const [volOD, setVolOD] = useState<number>(1.1)

  // Timpanometria OE
  const [curveOE, setCurveOE] = useState<'A' | 'As' | 'Ad' | 'B' | 'C'>('A')
  const [compOE, setCompOE] = useState<number>(0.7)
  const [pressOE, setPressOE] = useState<number>(-5)
  const [volOE, setVolOE] = useState<number>(1.15)

  // Reflexos Estapedianos
  const [reflexOD, setReflexOD] = useState<Record<string, ReflexStatus>>({
    '500': 'Presente',
    '1000': 'Presente',
    '2000': 'Presente',
    '4000': 'Presente',
  })
  const [reflexOE, setReflexOE] = useState<Record<string, ReflexStatus>>({
    '500': 'Presente',
    '1000': 'Presente',
    '2000': 'Presente',
    '4000': 'Presente',
  })

  const [conclusion, setConclusion] = useState(
    'Curvas timpanométricas tipo A bilateralmente com presença de reflexos estapedianos contralaterais.',
  )
  const [notes, setNotes] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      patientId: patient.id,
      patientName: patient.name,
      date,
      professionalName,
      tympanometryOD: {
        curve: curveOD,
        compliance: compOD,
        pressure: pressOD,
        volume: volOD,
      },
      tympanometryOE: {
        curve: curveOE,
        compliance: compOE,
        pressure: pressOE,
        volume: volOE,
      },
      reflexesOD: reflexOD,
      reflexesOE: reflexOE,
      conclusion,
      notes,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
        <DialogHeader className="border-b border-slate-100 pb-3">
          <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-600" />
            <span>Registro de Imitanciometria (Timpanometria)</span>
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

          {/* Timpanometria OD e OE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* OD */}
            <div className="p-4 rounded-xl border border-red-200 bg-red-50/20 space-y-3">
              <h4 className="text-xs font-bold text-red-700 uppercase tracking-wider">
                Timpanometria OD (Orelha Direita)
              </h4>
              <div>
                <Label className="text-xs font-medium text-slate-700">Tipo de Curva</Label>
                <Select value={curveOD} onValueChange={(v: any) => setCurveOD(v)}>
                  <SelectTrigger className="h-9 rounded-lg mt-1 text-xs bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">Tipo A (Normal)</SelectItem>
                    <SelectItem value="As">Tipo As (Rigidez ossicular)</SelectItem>
                    <SelectItem value="Ad">Tipo Ad (Hipermobilidade)</SelectItem>
                    <SelectItem value="B">Tipo B (Efuso / Otite média)</SelectItem>
                    <SelectItem value="C">Tipo C (Disfunção tubária)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-[10px] text-slate-600">Compl. (ml)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={compOD}
                    onChange={(e) => setCompOD(Number(e.target.value))}
                    className="h-8 text-xs bg-white"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-slate-600">Pressão (daPa)</Label>
                  <Input
                    type="number"
                    value={pressOD}
                    onChange={(e) => setPressOD(Number(e.target.value))}
                    className="h-8 text-xs bg-white"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-slate-600">Vol. (ml)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={volOD}
                    onChange={(e) => setVolOD(Number(e.target.value))}
                    className="h-8 text-xs bg-white"
                  />
                </div>
              </div>
            </div>

            {/* OE */}
            <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/20 space-y-3">
              <h4 className="text-xs font-bold text-blue-700 uppercase tracking-wider">
                Timpanometria OE (Orelha Esquerda)
              </h4>
              <div>
                <Label className="text-xs font-medium text-slate-700">Tipo de Curva</Label>
                <Select value={curveOE} onValueChange={(v: any) => setCurveOE(v)}>
                  <SelectTrigger className="h-9 rounded-lg mt-1 text-xs bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">Tipo A (Normal)</SelectItem>
                    <SelectItem value="As">Tipo As (Rigidez ossicular)</SelectItem>
                    <SelectItem value="Ad">Tipo Ad (Hipermobilidade)</SelectItem>
                    <SelectItem value="B">Tipo B (Efuso / Otite média)</SelectItem>
                    <SelectItem value="C">Tipo C (Disfunção tubária)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-[10px] text-slate-600">Compl. (ml)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={compOE}
                    onChange={(e) => setCompOE(Number(e.target.value))}
                    className="h-8 text-xs bg-white"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-slate-600">Pressão (daPa)</Label>
                  <Input
                    type="number"
                    value={pressOE}
                    onChange={(e) => setPressOE(Number(e.target.value))}
                    className="h-8 text-xs bg-white"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-slate-600">Vol. (ml)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={volOE}
                    onChange={(e) => setVolOE(Number(e.target.value))}
                    className="h-8 text-xs bg-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Reflexos Estapedianos */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Pesquisa de Reflexos Acústicos Estapedianos (Contralateral)
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-center text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 font-bold">
                    <th className="py-2 px-3 text-left">Orelha</th>
                    {REFLEX_FREQUENCIES.map((f) => (
                      <th key={f} className="py-2 px-2">
                        {f} Hz
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  <tr>
                    <td className="py-2 px-3 font-bold text-red-600 text-left">OD</td>
                    {REFLEX_FREQUENCIES.map((f) => (
                      <td key={f} className="p-1">
                        <Select
                          value={reflexOD[f]}
                          onValueChange={(val: ReflexStatus) =>
                            setReflexOD((prev) => ({ ...prev, [f]: val }))
                          }
                        >
                          <SelectTrigger
                            className={`h-8 text-xs ${
                              reflexOD[f] === 'Presente'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : reflexOD[f] === 'Ausente'
                                  ? 'bg-red-50 text-red-700 border-red-200'
                                  : 'bg-slate-50 text-slate-600'
                            }`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Presente">Presente</SelectItem>
                            <SelectItem value="Ausente">Ausente</SelectItem>
                            <SelectItem value="Não testado">Não testado</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-bold text-blue-600 text-left">OE</td>
                    {REFLEX_FREQUENCIES.map((f) => (
                      <td key={f} className="p-1">
                        <Select
                          value={reflexOE[f]}
                          onValueChange={(val: ReflexStatus) =>
                            setReflexOE((prev) => ({ ...prev, [f]: val }))
                          }
                        >
                          <SelectTrigger
                            className={`h-8 text-xs ${
                              reflexOE[f] === 'Presente'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : reflexOE[f] === 'Ausente'
                                  ? 'bg-red-50 text-red-700 border-red-200'
                                  : 'bg-slate-50 text-slate-600'
                            }`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Presente">Presente</SelectItem>
                            <SelectItem value="Ausente">Ausente</SelectItem>
                            <SelectItem value="Não testado">Não testado</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold text-slate-700">Conclusão / Laudo</Label>
            <Textarea
              value={conclusion}
              onChange={(e) => setConclusion(e.target.value)}
              rows={2}
              className="rounded-xl mt-1 text-xs border-slate-300 resize-none"
            />
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
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm"
            >
              Salvar Imitanciometria
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
