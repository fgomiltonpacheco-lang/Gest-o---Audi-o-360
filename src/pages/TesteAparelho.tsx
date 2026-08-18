import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '@/context/AppContext'
import { useToast } from '@/hooks/use-toast'
import pb from '@/lib/pocketbase/client'
import { ClientResponseError } from 'pocketbase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Save, Ear, Loader2, CheckCircle2, FileEdit } from 'lucide-react'
import { calculateAge } from '@/lib/formatters'

const SPECIALIST_NAME = 'MILTON SOARES PACHECO'

const FREQUENCIAS = [250, 500, 1000, 2000, 3000, 4000, 6000, 8000] as const

interface GanhoRow {
  frequencia: number
  sem_aparelho: string
  com_aparelho: string
}

interface ExamState {
  id?: string
  paciente_id: string
  paciente_nome: string
  data_teste: string
  orelha: 'OD' | 'OE' | 'Ambas' | ''
  tipo_teste: 'ganho_funcional' | 'acoplador' | 'REM' | ''
  fabricante_aparelho: string
  modelo_aparelho: string
  observacoes: string
  especialista_id: string
  especialista_nome: string
  status: 'rascunho' | 'finalizado'
}

function emptyGanho(): GanhoRow[] {
  return FREQUENCIAS.map((f) => ({
    frequencia: f,
    sem_aparelho: '',
    com_aparelho: '',
  }))
}

export default function TesteAparelho() {
  const { id, examId } = useParams<{ id: string; examId?: string }>()
  const navigate = useNavigate()
  const { getPatient, currentUser } = useApp()
  const { toast } = useToast()

  const patient = getPatient(id || '')
  const isSecretaria = currentUser?.role === 'secretaria'
  const isNew = !examId || examId === 'novo'

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)

  const today = new Date().toISOString().slice(0, 10)

  const [exam, setExam] = useState<ExamState>(() => ({
    paciente_id: patient?.id || '',
    paciente_nome: patient?.name || '',
    data_teste: today,
    orelha: '',
    tipo_teste: '',
    fabricante_aparelho: '',
    modelo_aparelho: '',
    observacoes: '',
    especialista_id: currentUser?.id || '',
    especialista_nome: currentUser?.name || SPECIALIST_NAME,
    status: 'rascunho',
  }))

  const [ganho, setGanho] = useState<GanhoRow[]>(emptyGanho())

  const setField = <K extends keyof ExamState>(key: K, value: ExamState[K]) => {
    setExam((prev) => ({ ...prev, [key]: value }))
  }

  const setGanhoCell = (freq: number, field: 'sem_aparelho' | 'com_aparelho', value: string) => {
    setGanho((prev) =>
      prev.map((row) => (row.frequencia === freq ? { ...row, [field]: value } : row)),
    )
  }

  const loadExam = useCallback(async () => {
    if (!examId || examId === 'novo') return
    setLoading(true)
    try {
      const rec: any = await pb.collection('testes_aparelho').getOne(examId)
      setExam({
        id: rec.id,
        paciente_id: rec.paciente_id || '',
        paciente_nome: rec.paciente_nome || '',
        data_teste: rec.data_teste || today,
        orelha: rec.orelha || '',
        tipo_teste: rec.tipo_teste || '',
        fabricante_aparelho: rec.fabricante_aparelho || '',
        modelo_aparelho: rec.modelo_aparelho || '',
        observacoes: rec.observacoes || '',
        especialista_id: rec.especialista_id || '',
        especialista_nome: rec.especialista_nome || SPECIALIST_NAME,
        status: rec.status || 'rascunho',
      })
      if (Array.isArray(rec.ganho) && rec.ganho.length > 0) {
        const loaded = emptyGanho().map((row) => {
          const found = rec.ganho.find((g: any) => Number(g.frequencia) === row.frequencia)
          return found
            ? {
                frequencia: row.frequencia,
                sem_aparelho: found.sem_aparelho != null ? String(found.sem_aparelho) : '',
                com_aparelho: found.com_aparelho != null ? String(found.com_aparelho) : '',
              }
            : row
        })
        setGanho(loaded)
      }
    } catch (err) {
      console.error('Erro ao carregar teste de aparelho:', err)
      toast({
        title: 'Erro ao carregar',
        description: 'Não foi possível carregar o teste.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [examId, today, toast])

  useEffect(() => {
    loadExam()
  }, [loadExam])

  // Pré-preenche dados do paciente ao criar novo
  useEffect(() => {
    if (isNew && patient) {
      setExam((prev) => ({
        ...prev,
        paciente_id: patient.id,
        paciente_nome: patient.name,
      }))
    }
  }, [patient, isNew])

  const handleSave = async (finalizar = false) => {
    if (!patient) {
      toast({ title: 'Paciente não encontrado', variant: 'destructive' })
      return
    }
    setSaving(true)
    const payload: Record<string, any> = {
      paciente_id: patient.id,
      paciente_nome: patient.name,
      data_teste: exam.data_teste,
      orelha: exam.orelha,
      tipo_teste: exam.tipo_teste,
      fabricante_aparelho: exam.fabricante_aparelho,
      modelo_aparelho: exam.modelo_aparelho,
      ganho: ganho.map((row) => ({
        frequencia: row.frequencia,
        sem_aparelho: row.sem_aparelho === '' ? null : Number(row.sem_aparelho),
        com_aparelho: row.com_aparelho === '' ? null : Number(row.com_aparelho),
      })),
      observacoes: exam.observacoes,
      especialista_id: exam.especialista_id || currentUser?.id || '',
      especialista_nome: exam.especialista_nome || currentUser?.name || SPECIALIST_NAME,
      status: finalizar ? 'finalizado' : exam.status,
    }

    try {
      let savedId: string
      if (exam.id) {
        await pb.collection('testes_aparelho').update(exam.id, payload)
        savedId = exam.id
      } else {
        const rec: any = await pb.collection('testes_aparelho').create(payload)
        savedId = rec.id
        setExam((prev) => ({ ...prev, id: savedId }))
        navigate(`/pacientes/${patient.id}/teste-aparelho/${savedId}`, { replace: true })
      }
      if (finalizar) setField('status', 'finalizado')
      toast({
        title: finalizar ? 'Teste finalizado' : 'Teste salvo',
        description: 'Teste com aparelho salvo com sucesso.',
      })
      void savedId
    } catch (err) {
      console.error('Erro ao salvar teste de aparelho:', err)
      let msg = 'Não foi possível salvar o teste.'
      if (err instanceof ClientResponseError) msg = err.message || msg
      toast({ title: 'Erro ao salvar', description: msg, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (!patient) {
    return (
      <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-4">
        <h2 className="text-xl font-bold text-slate-800">Paciente não localizado</h2>
        <Button onClick={() => navigate('/pacientes')} variant="outline">
          Voltar para Lista de Pacientes
        </Button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    )
  }

  const readOnly = isSecretaria || exam.status === 'finalizado'

  return (
    <div className="space-y-4 animate-in fade-in-50 duration-200 pb-16 text-slate-800">
      {/* Top Header / Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={() => navigate(`/pacientes/${patient.id}/prontuario`)}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg h-8"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Voltar
          </Button>
          <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Ear className="w-5 h-5 text-blue-600" />
            Teste com Aparelho
          </h1>
          {exam.status === 'finalizado' && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5">
              <CheckCircle2 className="w-3 h-3" />
              Finalizado
            </span>
          )}
          {exam.status === 'rascunho' && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5">
              <FileEdit className="w-3 h-3" />
              Rascunho
            </span>
          )}
        </div>

        {!isSecretaria && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => handleSave(false)}
              disabled={saving || exam.status === 'finalizado'}
              className="bg-slate-700 hover:bg-slate-800 text-white h-8 text-xs font-semibold rounded-lg"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5 mr-1" />
              )}
              Salvar
            </Button>

            <Button
              size="sm"
              onClick={() => handleSave(true)}
              disabled={saving || exam.status === 'finalizado'}
              className="bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs font-semibold rounded-lg"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              )}
              Finalizar
            </Button>
          </div>
        )}
      </div>

      {/* Main Container */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-5 shadow-sm">
        {/* Paciente + dados do teste */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pb-3 border-b border-slate-200 text-xs">
          <div>
            <Label className="text-[10px] font-semibold text-slate-500 block mb-0.5">
              Paciente
            </Label>
            <Input
              value={exam.paciente_nome}
              onChange={(e) => setField('paciente_nome', e.target.value)}
              disabled
              className="h-8 text-xs rounded-md border-slate-300"
            />
            {patient && (
              <p className="text-[10px] text-slate-400 mt-0.5">
                {patient.cpf || 'Sem CPF'} •{' '}
                {calculateAge(patient.birthDate) != null
                  ? `${calculateAge(patient.birthDate)} anos`
                  : 'idade n/a'}
              </p>
            )}
          </div>
          <div>
            <Label className="text-[10px] font-semibold text-slate-500 block mb-0.5">
              Data do Teste
            </Label>
            <Input
              type="date"
              value={exam.data_teste}
              onChange={(e) => setField('data_teste', e.target.value)}
              disabled={readOnly}
              className="h-8 text-xs rounded-md border-slate-300"
            />
          </div>
          <div>
            <Label className="text-[10px] font-semibold text-slate-500 block mb-0.5">
              Especialista
            </Label>
            <Input
              value={exam.especialista_nome}
              onChange={(e) => setField('especialista_nome', e.target.value)}
              disabled={readOnly}
              className="h-8 text-xs rounded-md border-slate-300"
            />
          </div>
        </div>

        {/* Configuração do teste */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs font-bold text-slate-700 block mb-1">Orelha</Label>
            <Select
              value={exam.orelha || '__none'}
              onValueChange={(v) =>
                setField('orelha', v === '__none' ? '' : (v as ExamState['orelha']))
              }
              disabled={readOnly}
            >
              <SelectTrigger className="h-9 text-xs rounded-md border-slate-300">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Selecione...</SelectItem>
                <SelectItem value="OD">OD (Direita)</SelectItem>
                <SelectItem value="OE">OE (Esquerda)</SelectItem>
                <SelectItem value="Ambas">Ambas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-bold text-slate-700 block mb-1">Tipo de Teste</Label>
            <Select
              value={exam.tipo_teste || '__none'}
              onValueChange={(v) =>
                setField('tipo_teste', v === '__none' ? '' : (v as ExamState['tipo_teste']))
              }
              disabled={readOnly}
            >
              <SelectTrigger className="h-9 text-xs rounded-md border-slate-300">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Selecione...</SelectItem>
                <SelectItem value="ganho_funcional">Ganho Funcional</SelectItem>
                <SelectItem value="acoplador">Acoplador</SelectItem>
                <SelectItem value="REM">REM (Medida em Ouvido Real)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-bold text-slate-700 block mb-1">
              Fabricante do Aparelho
            </Label>
            <Input
              value={exam.fabricante_aparelho}
              onChange={(e) => setField('fabricante_aparelho', e.target.value)}
              disabled={readOnly}
              placeholder="Ex.: Phonak, Widex..."
              className="h-9 text-xs rounded-md border-slate-300"
            />
          </div>
          <div>
            <Label className="text-xs font-bold text-slate-700 block mb-1">
              Modelo do Aparelho
            </Label>
            <Input
              value={exam.modelo_aparelho}
              onChange={(e) => setField('modelo_aparelho', e.target.value)}
              disabled={readOnly}
              placeholder="Ex.: Audeo Marvel 90"
              className="h-9 text-xs rounded-md border-slate-300"
            />
          </div>
        </div>

        {/* Grade de ganho */}
        <div className="space-y-2 pt-2">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Grade de Ganho (dB)
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-slate-200 rounded">
              <thead>
                <tr className="bg-slate-50 text-slate-700">
                  <th className="text-left font-bold px-3 py-2 border-b border-slate-200">
                    Frequência (Hz)
                  </th>
                  <th className="text-center font-bold px-3 py-2 border-b border-slate-200">
                    Sem Aparelho (dB)
                  </th>
                  <th className="text-center font-bold px-3 py-2 border-b border-slate-200">
                    Com Aparelho (dB)
                  </th>
                  <th className="text-center font-bold px-3 py-2 border-b border-slate-200">
                    Ganho (dB)
                  </th>
                </tr>
              </thead>
              <tbody>
                {ganho.map((row) => {
                  const sem = parseFloat(row.sem_aparelho)
                  const com = parseFloat(row.com_aparelho)
                  const ganhoDb = !isNaN(sem) && !isNaN(com) ? com - sem : null
                  return (
                    <tr key={row.frequencia} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-1.5 font-semibold text-slate-700">{row.frequencia}</td>
                      <td className="px-2 py-1.5">
                        <Input
                          type="number"
                          value={row.sem_aparelho}
                          onChange={(e) =>
                            setGanhoCell(row.frequencia, 'sem_aparelho', e.target.value)
                          }
                          disabled={readOnly}
                          className="h-8 text-center text-xs rounded border-slate-300"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          type="number"
                          value={row.com_aparelho}
                          onChange={(e) =>
                            setGanhoCell(row.frequencia, 'com_aparelho', e.target.value)
                          }
                          disabled={readOnly}
                          className="h-8 text-center text-xs rounded border-slate-300"
                        />
                      </td>
                      <td className="px-3 py-1.5 text-center font-bold text-blue-700">
                        {ganhoDb !== null ? ganhoDb : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Observações */}
        <div className="pt-2">
          <Label className="text-xs font-bold text-slate-700 block mb-1">Observações</Label>
          <Textarea
            value={exam.observacoes}
            onChange={(e) => setField('observacoes', e.target.value)}
            disabled={readOnly}
            rows={4}
            placeholder="Digite aqui as observações do teste..."
            className="rounded-md text-xs border-slate-300 resize-y"
          />
        </div>
      </div>
    </div>
  )
}
