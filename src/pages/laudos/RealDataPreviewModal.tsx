// RealDataPreviewModal.tsx — Prévia do template com dados de exame real.
// Usado dentro do editor para visualizar o laudo com paciente/exame reais.
import React, { useCallback, useEffect, useState } from 'react'
import { Search, Loader2, Printer, FileDown, X, FileText, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { TemplateRenderer, type TemplateDataContext } from '@/components/print/TemplateRenderer'
import pb from '@/lib/pocketbase/client'
import type { ExamReportTemplate, ExamReportTipoExame } from '@/types'
import { EXAM_REPORT_TIPO_LABELS } from '@/types'

type PacienteOption = { id: string; name: string; cpf?: string }
type ExameOption = { id: string; date: string; label: string; collection: string }

interface RealDataPreviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  template: ExamReportTemplate
}

/** Lista de pacientes por nome ou CPF. */
async function buscarPacientes(q: string): Promise<PacienteOption[]> {
  if (q.trim().length < 2) return []
  try {
    const cleanQ = q.replace(/[^\w\s.-]/g, ' ').trim()
    const filter = `name ~ "${cleanQ}" || cpf ~ "${cleanQ}"`
    const res = await pb.collection('patients').getList(1, 20, { filter })
    return res.items.map((r: unknown) => {
      const rec = r as { id: string; name: string; cpf?: string }
      return { id: rec.id, name: rec.name, cpf: rec.cpf || '' }
    })
  } catch {
    return []
  }
}

/** Lista exames do paciente conforme o tipo do template. */
async function listarExamesPaciente(
  pacienteId: string,
  tipo: ExamReportTipoExame,
): Promise<ExameOption[]> {
  const out: ExameOption[] = []
  try {
    if (tipo === 'audiometria') {
      const res = await pb.collection('audiometry_exams').getList(1, 50, {
        filter: `patient="${pacienteId}"`,
        sort: '-date',
      })
      res.items.forEach((r: unknown) => {
        const rec = r as { id: string; date: string }
        out.push({
          id: rec.id,
          date: rec.date || '',
          label: `Audiometria — ${rec.date || 's/data'}`,
          collection: 'audiometry_exams',
        })
      })
    } else if (tipo === 'imitanciometria') {
      const res = await pb.collection('imitanciometrias').getList(1, 50, {
        filter: `paciente_id="${pacienteId}"`,
        sort: '-data_exame',
      })
      res.items.forEach((r: unknown) => {
        const rec = r as { id: string; data_exame: string }
        out.push({
          id: rec.id,
          date: rec.data_exame || '',
          label: `Imitanciometria — ${rec.data_exame || 's/data'}`,
          collection: 'imitanciometrias',
        })
      })
    }
  } catch {
    /* ignore */
  }
  return out
}

/** Carrega o exame real e monta o TemplateDataContext correspondente. */
async function carregarContexto(
  exame: ExameOption,
  pacienteId: string,
): Promise<TemplateDataContext> {
  // Carrega dados do paciente (sempre disponível para complementar)
  let pacienteRec: Record<string, unknown> | null = null
  try {
    pacienteRec = (await pb.collection('patients').getOne(pacienteId)) as Record<string, unknown>
  } catch {
    pacienteRec = null
  }

  if (exame.collection === 'audiometry_exams') {
    // expande created_by (relation→users) para obter o nome do profissional
    const rec = (await pb
      .collection(exame.collection)
      .getOne(exame.id, { expand: 'created_by' })) as Record<string, unknown>
    const createdBy = (rec.expand as Record<string, unknown> | undefined)?.created_by as
      | { name?: string }
      | undefined
    return {
      paciente: {
        nome: (pacienteRec?.name as string) || '',
        cpf: (pacienteRec?.cpf as string) || (rec.cpf as string) || '',
        data_nascimento: (pacienteRec?.birthDate as string) || (rec.dob as string) || '',
        idade: (rec.age as string) || '',
        sexo: (pacienteRec?.gender as string) || (rec.sex as string) || '',
        telefone: (pacienteRec?.mobile as string) || (pacienteRec?.phone as string) || '',
        endereco: [
          pacienteRec?.street,
          pacienteRec?.number,
          pacienteRec?.neighborhood,
          pacienteRec?.city,
          pacienteRec?.state,
        ]
          .filter(Boolean)
          .join(', '),
      },
      exame: {
        ...rec,
        data: (rec.date as string) || '',
      },
      profissional: {
        nome: createdBy?.name || '',
      },
      clinica: {},
    }
  }

  const rec = (await pb.collection(exame.collection).getOne(exame.id)) as Record<string, unknown>

  // imitanciometrias
  const timpRecs = (await pb
    .collection('timpanometria_dados')
    .getFullList({ filter: `imitanciometria_id="${exame.id}"` })) as Record<string, unknown>[]
  const reflexRecs = (await pb
    .collection('reflexo_acustico_dados')
    .getFullList({ filter: `imitanciometria_id="${exame.id}"` })) as Record<string, unknown>[]

  const findTimp = (orelha: string) => timpRecs.find((r) => r.orelha === orelha) || {}
  const findReflex = (orelha: string, via: string) =>
    reflexRecs.find((r) => r.orelha === orelha && r.via === via) || {}

  return {
    paciente: {
      nome: (rec.paciente_nome as string) || (pacienteRec?.name as string) || '',
      cpf: (rec.paciente_cpf as string) || (pacienteRec?.cpf as string) || '',
      data_nascimento:
        (rec.paciente_nascimento as string) || (pacienteRec?.birthDate as string) || '',
      idade: (rec.paciente_idade as string) || '',
      sexo: (rec.paciente_sexo as string) || (pacienteRec?.gender as string) || '',
    },
    exame: {
      ...rec,
      data: (rec.data_exame as string) || '',
      tipo_curva_od: (rec.tipo_curva_od as string) || '',
      tipo_curva_oe: (rec.tipo_curva_oe as string) || '',
      timpanometria: {
        OD: findTimp('OD'),
        OE: findTimp('OE'),
      },
      reflexos: {
        OD: {
          contra_lateral: findReflex('OD', 'contra_lateral'),
          ipsi_lateral: findReflex('OD', 'ipsi_lateral'),
        },
        OE: {
          contra_lateral: findReflex('OE', 'contra_lateral'),
          ipsi_lateral: findReflex('OE', 'ipsi_lateral'),
        },
      },
      meatoscopia: {
        od_normal: !!rec.meatoscopia_od_normal,
        od_alterada: !!rec.meatoscopia_od_alterada,
        od_obs: (rec.meatoscopia_od_obs as string) || '',
        oe_normal: !!rec.meatoscopia_oe_normal,
        oe_alterada: !!rec.meatoscopia_oe_alterada,
        oe_obs: (rec.meatoscopia_oe_obs as string) || '',
      },
    },
    profissional: {
      nome: (rec.especialista_nome as string) || '',
    },
    clinica: {},
  }
}

export const RealDataPreviewModal: React.FC<RealDataPreviewModalProps> = ({
  open,
  onOpenChange,
  template,
}) => {
  const { toast } = useToast()
  const [busca, setBusca] = useState('')
  const [pacientes, setPacientes] = useState<PacienteOption[]>([])
  const [pacienteSel, setPacienteSel] = useState<string>('')
  const [exames, setExames] = useState<ExameOption[]>([])
  const [exameSel, setExameSel] = useState<ExameOption | null>(null)
  const [carregandoPacientes, setCarregandoPacientes] = useState(false)
  const [carregandoExames, setCarregandoExames] = useState(false)
  const [carregandoContexto, setCarregandoContexto] = useState(false)
  const [dados, setDados] = useState<TemplateDataContext | null>(null)

  // Reset ao fechar
  useEffect(() => {
    if (!open) {
      setBusca('')
      setPacientes([])
      setPacienteSel('')
      setExames([])
      setExameSel(null)
      setDados(null)
    }
  }, [open])

  // Debounce da busca de pacientes
  useEffect(() => {
    if (!open) return
    if (busca.trim().length < 2) {
      setPacientes([])
      return
    }
    setCarregandoPacientes(true)
    const t = setTimeout(async () => {
      const res = await buscarPacientes(busca)
      setPacientes(res)
      setCarregandoPacientes(false)
    }, 350)
    return () => clearTimeout(t)
  }, [busca, open])

  const selecionarPaciente = useCallback(
    async (id: string) => {
      setPacienteSel(id)
      setExames([])
      setExameSel(null)
      setDados(null)
      setCarregandoExames(true)
      try {
        const lista = await listarExamesPaciente(id, template.tipo_exame)
        setExames(lista)
      } catch {
        setExames([])
      } finally {
        setCarregandoExames(false)
      }
    },
    [template.tipo_exame],
  )

  const selecionarExame = useCallback(
    async (ex: ExameOption) => {
      setExameSel(ex)
      setCarregandoContexto(true)
      setDados(null)
      try {
        const ctx = await carregarContexto(ex, pacienteSel)
        setDados(ctx)
      } catch (err) {
        toast({
          title: 'Erro ao carregar exame',
          description: String(err),
          variant: 'destructive',
        })
      } finally {
        setCarregandoContexto(false)
      }
    },
    [pacienteSel, toast],
  )

  const handleImprimir = () => {
    toast({
      title: 'Imprimindo',
      description: 'No diálogo de impressão, escolha a impressora ou "Salvar como PDF".',
    })
    setTimeout(() => window.print(), 250)
  }

  const handleBaixarPDF = () => {
    toast({
      title: 'Gerando PDF',
      description: 'No diálogo de impressão, escolha "Salvar como PDF" como destino.',
    })
    setTimeout(() => window.print(), 250)
  }

  const tipoLabel = EXAM_REPORT_TIPO_LABELS[template.tipo_exame] || template.tipo_exame

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] h-[92vh] flex flex-col p-0 gap-0">
        {/* Header fixo */}
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#1E3A8A]" />
            Prévia com dados reais — {template.nome_modelo}
          </DialogTitle>
          <DialogDescription>
            Selecione um paciente e um exame de {tipoLabel} para visualizar o laudo exatamente como
            será impresso.
          </DialogDescription>
        </DialogHeader>

        {/* Corpo: painel lateral de seleção + área de prévia */}
        <div className="flex flex-1 min-h-0">
          {/* Painel lateral */}
          <div className="w-80 shrink-0 border-r bg-slate-50 overflow-y-auto p-4 space-y-4 no-print">
            <div>
              <Label className="text-xs font-semibold text-slate-600">Buscar paciente</Label>
              <div className="relative mt-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Nome ou CPF..."
                  className="pl-8 h-9"
                  autoFocus
                />
                {carregandoPacientes && (
                  <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-400" />
                )}
              </div>

              {pacientes.length > 0 && (
                <div className="mt-2 max-h-56 overflow-y-auto rounded-md border bg-white">
                  {pacientes.map((p) => (
                    <button
                      key={p.id}
                      className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-100 ${
                        pacienteSel === p.id ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => selecionarPaciente(p.id)}
                    >
                      <span className="truncate">
                        <span className="font-medium text-slate-800">{p.name}</span>
                        {p.cpf && <span className="block text-[11px] text-slate-400">{p.cpf}</span>}
                      </span>
                      {pacienteSel === p.id && <ChevronRight className="h-4 w-4 text-[#1E3A8A]" />}
                    </button>
                  ))}
                </div>
              )}
              {busca.trim().length >= 2 && !carregandoPacientes && pacientes.length === 0 && (
                <p className="mt-2 text-xs text-slate-400">Nenhum paciente encontrado.</p>
              )}
            </div>

            {pacienteSel && (
              <div>
                <Label className="text-xs font-semibold text-slate-600">
                  Exames de {tipoLabel}
                </Label>
                {carregandoExames ? (
                  <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" /> Carregando exames...
                  </div>
                ) : exames.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-400">
                    Nenhum exame deste tipo encontrado para o paciente.
                  </p>
                ) : (
                  <div className="mt-2 max-h-56 overflow-y-auto rounded-md border bg-white">
                    {exames.map((ex) => (
                      <button
                        key={ex.id}
                        className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-100 ${
                          exameSel?.id === ex.id ? 'bg-blue-50' : ''
                        }`}
                        onClick={() => selecionarExame(ex)}
                      >
                        <span className="truncate text-slate-700">{ex.label}</span>
                        {exameSel?.id === ex.id && (
                          <ChevronRight className="h-4 w-4 text-[#1E3A8A]" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Área de prévia */}
          <div className="flex-1 min-w-0 overflow-auto bg-slate-200 p-6">
            {carregandoContexto ? (
              <div className="flex h-full items-center justify-center text-slate-500">
                <Loader2 className="h-6 w-6 animate-spin mr-2" /> Carregando exame...
              </div>
            ) : !dados ? (
              <div className="flex h-full flex-col items-center justify-center text-slate-400 gap-2">
                <FileText className="h-10 w-10" />
                <p className="text-sm">Selecione um paciente e um exame para ver a prévia.</p>
              </div>
            ) : (
              <div className="print-area flex justify-center">
                <TemplateRenderer template={template} data={dados} scale={1} />
              </div>
            )}
          </div>
        </div>

        {/* Footer fixo com ações */}
        <div className="flex items-center justify-between gap-2 border-t bg-white px-6 py-3 shrink-0 no-print">
          <p className="text-xs text-slate-500">
            {exameSel ? `Exame: ${exameSel.label}` : 'Nenhum exame selecionado.'}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              <X className="mr-1 h-4 w-4" /> Fechar
            </Button>
            <Button variant="outline" size="sm" onClick={handleImprimir} disabled={!dados}>
              <Printer className="mr-1 h-4 w-4" /> Imprimir
            </Button>
            <Button
              size="sm"
              className="bg-[#1E3A8A] hover:bg-[#1e40af]"
              onClick={handleBaixarPDF}
              disabled={!dados}
            >
              <FileDown className="mr-1 h-4 w-4" /> Baixar PDF
            </Button>
          </div>
        </div>
      </DialogContent>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; box-shadow: none !important; }
          @page { size: ${template.largura_pagina}mm ${template.altura_pagina}mm; margin: 0; }
        }
      `}</style>
    </Dialog>
  )
}

export default RealDataPreviewModal
