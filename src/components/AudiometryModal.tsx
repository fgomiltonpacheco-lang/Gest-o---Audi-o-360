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
import { AudiometryExam, Patient } from '@/types'
import { Activity, Ear } from 'lucide-react'

const AIR_FREQUENCIES = ['250', '500', '1000', '2000', '3000', '4000', '6000', '8000']
const BONE_FREQUENCIES = ['500', '1000', '2000', '4000']

interface AudiometryModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  patient: Patient
  onSave: (exam: Omit<AudiometryExam, 'id'>) => void
}

export const AudiometryModal: React.FC<AudiometryModalProps> = ({
  open,
  onOpenChange,
  patient,
  onSave,
}) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [professionalName, setProfessionalName] = useState('Dra. Mariana Silva Costa')

  // Via Aérea OD & OE
  const [airOD, setAirOD] = useState<Record<string, number | null | 'NR'>>({
    '250': 20,
    '500': 25,
    '1000': 30,
    '2000': 35,
    '3000': 40,
    '4000': 45,
    '6000': 50,
    '8000': 55,
  })
  const [airOE, setAirOE] = useState<Record<string, number | null | 'NR'>>({
    '250': 20,
    '500': 20,
    '1000': 25,
    '2000': 30,
    '3000': 35,
    '4000': 40,
    '6000': 45,
    '8000': 50,
  })

  // Via Óssea OD & OE
  const [boneOD, setBoneOD] = useState<Record<string, number | null | 'NR'>>({
    '500': 25,
    '1000': 30,
    '2000': 35,
    '4000': 45,
  })
  const [boneOE, setBoneOE] = useState<Record<string, number | null | 'NR'>>({
    '500': 20,
    '1000': 25,
    '2000': 30,
    '4000': 40,
  })

  // SRT & IPRF
  const [srtOD, setSrtOD] = useState<number>(30)
  const [srtOE, setSrtOE] = useState<number>(25)
  const [iprfOD, setIprfOD] = useState<number>(92)
  const [iprfOE, setIprfOE] = useState<number>(96)

  const [lossDegree, setLossDegree] = useState<any>('Leve')
  const [lossType, setLossType] = useState<any>('Neurossensorial')
  const [notes, setNotes] = useState('')

  const handleAirChange = (ear: 'OD' | 'OE', freq: string, val: string) => {
    const num = val === '' ? null : val.toUpperCase() === 'NR' ? 'NR' : Number(val)
    if (ear === 'OD') setAirOD((prev) => ({ ...prev, [freq]: num }))
    else setAirOE((prev) => ({ ...prev, [freq]: num }))
  }

  const handleBoneChange = (ear: 'OD' | 'OE', freq: string, val: string) => {
    const num = val === '' ? null : val.toUpperCase() === 'NR' ? 'NR' : Number(val)
    if (ear === 'OD') setBoneOD((prev) => ({ ...prev, [freq]: num }))
    else setBoneOE((prev) => ({ ...prev, [freq]: num }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      patientId: patient.id,
      patientName: patient.name,
      date,
      professionalName,
      airOD,
      airOE,
      boneOD,
      boneOE,
      srtOD,
      srtOE,
      iprfOD,
      iprfOE,
      lossDegree,
      lossType,
      notes,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-full max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
        <DialogHeader className="border-b border-slate-100 pb-3">
          <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Activity className="w-5 h-5 text-teal-600" />
            <span>Registro de Audiometria Tonal Liminar & Vocal</span>
          </DialogTitle>
          <p className="text-xs text-slate-500">
            Paciente: <strong>{patient.name}</strong> • CPF: {patient.cpf}
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-2">
          {/* Data e Profissional */}
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
              <Label className="text-xs font-semibold text-slate-700">
                Profissional Examinador
              </Label>
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

          {/* VIA AÉREA */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Ear className="w-4 h-4 text-teal-600" />
              Limiares por Via Aérea (dB NA)
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-center text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                    <th className="py-2 px-3 text-left">Orelha</th>
                    {AIR_FREQUENCIES.map((f) => (
                      <th key={f} className="py-2 px-2">
                        {f} Hz
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  <tr>
                    <td className="py-2 px-3 font-bold text-red-600 text-left">OD (Direita - O)</td>
                    {AIR_FREQUENCIES.map((f) => (
                      <td key={f} className="p-1">
                        <Input
                          type="text"
                          value={airOD[f] === null || airOD[f] === undefined ? '' : airOD[f]}
                          onChange={(e) => handleAirChange('OD', f, e.target.value)}
                          placeholder="dB"
                          className="h-8 w-14 text-center text-xs rounded-lg border-slate-300 mx-auto"
                        />
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-bold text-blue-600 text-left">
                      OE (Esquerda - X)
                    </td>
                    {AIR_FREQUENCIES.map((f) => (
                      <td key={f} className="p-1">
                        <Input
                          type="text"
                          value={airOE[f] === null || airOE[f] === undefined ? '' : airOE[f]}
                          onChange={(e) => handleAirChange('OE', f, e.target.value)}
                          placeholder="dB"
                          className="h-8 w-14 text-center text-xs rounded-lg border-slate-300 mx-auto"
                        />
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* VIA ÓSSEA */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Ear className="w-4 h-4 text-emerald-600" />
              Limiares por Via Óssea (dB NA)
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-center text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                    <th className="py-2 px-3 text-left">Orelha</th>
                    {BONE_FREQUENCIES.map((f) => (
                      <th key={f} className="py-2 px-2">
                        {f} Hz
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  <tr>
                    <td className="py-2 px-3 font-bold text-red-600 text-left">
                      OD (Direita - &lt;)
                    </td>
                    {BONE_FREQUENCIES.map((f) => (
                      <td key={f} className="p-1">
                        <Input
                          type="text"
                          value={boneOD[f] === null || boneOD[f] === undefined ? '' : boneOD[f]}
                          onChange={(e) => handleBoneChange('OD', f, e.target.value)}
                          placeholder="dB"
                          className="h-8 w-16 text-center text-xs rounded-lg border-slate-300 mx-auto"
                        />
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-bold text-blue-600 text-left">
                      OE (Esquerda - &gt;)
                    </td>
                    {BONE_FREQUENCIES.map((f) => (
                      <td key={f} className="p-1">
                        <Input
                          type="text"
                          value={boneOE[f] === null || boneOE[f] === undefined ? '' : boneOE[f]}
                          onChange={(e) => handleBoneChange('OE', f, e.target.value)}
                          placeholder="dB"
                          className="h-8 w-16 text-center text-xs rounded-lg border-slate-300 mx-auto"
                        />
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* LOGOAUDIOMETRIA: SRT & IPRF */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
              <h5 className="text-xs font-bold text-slate-800">SRT (Limiar de Recepção de Fala)</h5>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[11px] text-red-600 font-bold">OD (dB)</Label>
                  <Input
                    type="number"
                    value={srtOD}
                    onChange={(e) => setSrtOD(Number(e.target.value))}
                    className="h-9 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-blue-600 font-bold">OE (dB)</Label>
                  <Input
                    type="number"
                    value={srtOE}
                    onChange={(e) => setSrtOE(Number(e.target.value))}
                    className="h-9 rounded-lg text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
              <h5 className="text-xs font-bold text-slate-800">IPRF (% de Reconhecimento)</h5>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[11px] text-red-600 font-bold">OD (%)</Label>
                  <Input
                    type="number"
                    value={iprfOD}
                    onChange={(e) => setIprfOD(Number(e.target.value))}
                    className="h-9 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-blue-600 font-bold">OE (%)</Label>
                  <Input
                    type="number"
                    value={iprfOE}
                    onChange={(e) => setIprfOE(Number(e.target.value))}
                    className="h-9 rounded-lg text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* LAUDO CONCLUSIVO */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-semibold text-slate-700">Grau da Perda</Label>
              <Select value={lossDegree} onValueChange={setLossDegree}>
                <SelectTrigger className="h-10 rounded-xl mt-1 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Normal">Normal</SelectItem>
                  <SelectItem value="Leve">Leve</SelectItem>
                  <SelectItem value="Moderada">Moderada</SelectItem>
                  <SelectItem value="Moderadamente severa">Moderadamente severa</SelectItem>
                  <SelectItem value="Severa">Severa</SelectItem>
                  <SelectItem value="Profunda">Profunda</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">Tipo da Perda</Label>
              <Select value={lossType} onValueChange={setLossType}>
                <SelectTrigger className="h-10 rounded-xl mt-1 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Condutiva">Condutiva</SelectItem>
                  <SelectItem value="Neurossensorial">Neurossensorial</SelectItem>
                  <SelectItem value="Mista">Mista</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-2">
              <Label className="text-xs font-semibold text-slate-700">
                Observações Clínicas e Parecer
              </Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Curva audiométrica descendente simétrica bilateral..."
                rows={2}
                className="rounded-xl mt-1 text-xs border-slate-300 resize-none"
              />
            </div>
          </div>

          <DialogFooter className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
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
              Salvar Audiometria
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
