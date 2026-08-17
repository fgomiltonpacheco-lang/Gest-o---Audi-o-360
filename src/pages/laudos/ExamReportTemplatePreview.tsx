// ExamReportTemplatePreview.tsx — Prévia do modelo com dados de exemplo ou reais.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { ArrowLeft, Printer, FileDown, Eye, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { getTemplate } from '@/lib/examReportTemplates'
import { TemplateRenderer, type TemplateDataContext } from '@/components/print/TemplateRenderer'
import pb from '@/lib/pocketbase/client'
import type { ExamReportTemplate } from '@/types'
import { EXAM_REPORT_TIPO_LABELS, EXAM_REPORT_STATUS_LABELS } from '@/types'

const DADOS_EXEMPLO: TemplateDataContext = {
  paciente: {
    nome: 'Maria Exemplo da Silva',
    cpf: '123.456.789-00',
    data_nascimento: '15/03/1980',
    idade: '44 anos',
    sexo: 'Feminino',
    telefone: '(11) 98765-4321',
    endereco: 'Rua das Flores, 123 — São Paulo/SP',
    convenio: 'Particular',
    prontuario: '0001234',
  },
  exame: {
    data: '20/01/2025',
    hora: '14:30',
    report:
      'Audiometria tonal e vocal indicando perda neurossensorial leve bilateral. Limiares de via aérea entre 25 e 45 dB NA nas frequências de 500 a 8000 Hz, bilateralmente.',
    observations: 'Paciente relata zumbido bilateral.',
    air_od: {
      '500': { db: 20, symbol: 'normal' },
      '1000': { db: 25, symbol: 'normal' },
      '2000': { db: 30, symbol: 'normal' },
      '4000': { db: 40, symbol: 'normal' },
      '8000': { db: 45, symbol: 'normal' },
    },
    air_oe: {
      '500': { db: 15, symbol: 'normal' },
      '1000': { db: 20, symbol: 'normal' },
      '2000': { db: 25, symbol: 'normal' },
      '4000': { db: 35, symbol: 'normal' },
      '8000': { db: 40, symbol: 'normal' },
    },
    bone_od: {
      '500': { db: 10, symbol: 'normal' },
      '1000': { db: 15, symbol: 'normal' },
      '2000': { db: 20, symbol: 'normal' },
      '4000': { db: 25, symbol: 'normal' },
    },
    bone_oe: {
      '500': { db: 10, symbol: 'normal' },
      '1000': { db: 15, symbol: 'normal' },
      '2000': { db: 15, symbol: 'normal' },
      '4000': { db: 20, symbol: 'normal' },
    },
    tipo_curva_od: 'A',
    tipo_curva_oe: 'A',
  },
  profissional: {
    nome: 'Dra. Ana Fonoaudióloga',
    crfa: 'CRFa 2-12345',
  },
  clinica: {
    nome: 'Audição360 Clínica Auditiva',
    endereco: 'Av. Principal, 1000 — São Paulo/SP',
    telefone: '(11) 3333-4444',
    email: 'contato@audicao360.com.br',
  },
}

export default function ExamReportTemplatePreview() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [template, setTemplate] = useState<ExamReportTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [dados, setDados] = useState<TemplateDataContext>(DADOS_EXEMPLO)
  const [modalExame, setModalExame] = useState(false)
  const [buscaPaciente, setBuscaPaciente] = useState('')
  const [pacientes, setPacientes] = useState<{ id: string; name: string }[]>([])
  const [exames, setExames] = useState<{ id: string; date: string; patientName: string }[]>([])
  const [pacienteSel, setPacienteSel] = useState<string>('')
  const [exameSel, setExameSel] = useState<string>('')
  const [carregandoExame, setCarregandoExame] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const tpl = await getTemplate(id)
      setTemplate(tpl)
    } catch (err) {
      setErro(String(err))
      toast({ title: 'Erro ao carregar modelo', description: String(err), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [id, toast])

  useEffect(() => {
    carregar()
  }, [carregar])

  const buscarPacientes = async (q: string) => {
    setBuscaPaciente(q)
    if (q.length < 2) {
      setPacientes([])
      return
    }
    try {
      const res = await pb.collection('patients').getList(1, 20, {
        filter: `name ~ "${q}"`,
      })
      setPacientes(
        res.items.map((r: unknown) => {
          const rec = r as { id: string; name: string }
          return { id: rec.id, name: rec.name }
        }),
      )
    } catch {
      setPacientes([])
    }
  }

  const carregarExames = async (pacienteId: string) => {
    setPacienteSel(pacienteId)
    setExames([])
    setExameSel('')
    try {
      const res = await pb.collection('audiometry_exams').getList(1, 50, {
        filter: `patientId="${pacienteId}"`,
        sort: '-date',
      })
      setExames(
        res.items.map((r: unknown) => {
          const rec = r as { id: string; date: string; patientName: string }
          return { id: rec.id, date: rec.date, patientName: rec.patientName }
        }),
      )
    } catch {
      setExames([])
    }
  }

  const carregarExameReal = async () => {
    if (!exameSel) {
      toast({ title: 'Selecione um exame', variant: 'destructive' })
      return
    }
    setCarregandoExame(true)
    try {
      const rec = (await pb.collection('audiometry_exams').getOne(exameSel)) as Record<
        string,
        unknown
      >
      const pacienteRec = rec.patientId
        ? ((await pb.collection('patients').getOne(rec.patientId as string)) as Record<
            string,
            unknown
          >)
        : null
      const ctx: TemplateDataContext = {
        paciente: {
          nome: (pacienteRec?.name as string) || (rec.patientName as string) || '',
          cpf: (pacienteRec?.cpf as string) || (rec.cpf as string) || '',
          data_nascimento: (pacienteRec?.birthDate as string) || (rec.dob as string) || '',
          idade: (rec.age as string) || '',
          sexo: (pacienteRec?.sex as string) || (rec.sex as string) || '',
          telefone: (pacienteRec?.phone as string) || '',
          endereco: (pacienteRec?.address as string) || '',
        },
        exame: {
          ...rec,
          data: (rec.date as string) || '',
        },
        profissional: {
          nome: (rec.professionalName as string) || '',
        },
        clinica: {},
      }
      setDados(ctx)
      setModalExame(false)
      toast({ title: 'Exame real carregado' })
    } catch (err) {
      toast({ title: 'Erro ao carregar exame', description: String(err), variant: 'destructive' })
    } finally {
      setCarregandoExame(false)
    }
  }

  const handleImprimir = () => {
    window.print()
  }

  const handleBaixarPDF = () => {
    toast({
      title: 'Gerando PDF',
      description: 'No diálogo de impressão, escolha "Salvar como PDF".',
    })
    setTimeout(() => window.print(), 300)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        Carregando prévia...
      </div>
    )
  }
  if (erro || !template) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-slate-500">
        <p className="text-red-500">{erro || 'Modelo não encontrado.'}</p>
        <Link to="/configuracoes/laudos">
          <Button variant="outline">Voltar para a lista</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header (não impresso) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-2 border-b bg-white px-4 py-2 shadow-sm">
        <div className="flex items-center gap-3">
          <Link to={`/configuracoes/laudos/${template.id}/editor`}>
            <Button variant="ghost" size="icon" title="Voltar ao editor">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-base font-semibold text-slate-800">
              Prévia — {template.nome_modelo}
            </h1>
            <p className="flex items-center gap-2 text-xs text-slate-500">
              <span>v{template.versao}</span>
              <Badge variant="outline" className="text-[10px]">
                {EXAM_REPORT_STATUS_LABELS[template.status]}
              </Badge>
              <span>• {EXAM_REPORT_TIPO_LABELS[template.tipo_exame]}</span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setDados(DADOS_EXEMPLO)}>
            <Eye className="mr-1 h-4 w-4" /> Dados de Exemplo
          </Button>
          <Button size="sm" variant="outline" onClick={() => setModalExame(true)}>
            <User className="mr-1 h-4 w-4" /> Selecionar Exame Real
          </Button>
          <Button size="sm" variant="outline" onClick={handleImprimir}>
            <Printer className="mr-1 h-4 w-4" /> Imprimir
          </Button>
          <Button size="sm" className="bg-[#1E3A8A] hover:bg-[#1e40af]" onClick={handleBaixarPDF}>
            <FileDown className="mr-1 h-4 w-4" /> Baixar PDF
          </Button>
        </div>
      </div>

      {/* Área de visualização (impressa) */}
      <div className="flex justify-center p-8 print:p-0" ref={printRef}>
        <div className="print-area">
          <TemplateRenderer template={template} data={dados} scale={1} />
        </div>
      </div>

      {/* Modal selecionar exame real */}
      <Dialog open={modalExame} onOpenChange={setModalExame}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Visualizar com exame real</DialogTitle>
            <DialogDescription>
              Busque um paciente e selecione um exame de audiometria para preencher a prévia com
              dados reais.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Buscar paciente</Label>
              <Input
                value={buscaPaciente}
                onChange={(e) => buscarPacientes(e.target.value)}
                placeholder="Digite o nome do paciente..."
                autoFocus
              />
              {pacientes.length > 0 && (
                <div className="mt-2 max-h-40 overflow-y-auto rounded border">
                  {pacientes.map((p) => (
                    <button
                      key={p.id}
                      className={`flex w-full px-3 py-1.5 text-left text-sm hover:bg-slate-100 ${pacienteSel === p.id ? 'bg-blue-50' : ''}`}
                      onClick={() => carregarExames(p.id)}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {exames.length > 0 && (
              <div>
                <Label>Selecione o exame</Label>
                <div className="mt-2 max-h-40 overflow-y-auto rounded border">
                  {exames.map((ex) => (
                    <button
                      key={ex.id}
                      className={`flex w-full px-3 py-1.5 text-left text-sm hover:bg-slate-100 ${exameSel === ex.id ? 'bg-blue-50' : ''}`}
                      onClick={() => setExameSel(ex.id)}
                    >
                      {ex.date} — {ex.patientName}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {pacienteSel && exames.length === 0 && (
              <p className="text-sm text-slate-500">Nenhum exame encontrado para este paciente.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalExame(false)}>
              Cancelar
            </Button>
            <Button
              onClick={carregarExameReal}
              disabled={!exameSel || carregandoExame}
              className="bg-[#1E3A8A] hover:bg-[#1e40af]"
            >
              {carregandoExame ? 'Carregando...' : 'Carregar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          @page { size: ${template.largura_pagina}mm ${template.altura_pagina}mm; margin: 0; }
          .print-area { box-shadow: none !important; }
        }
      `}</style>
    </div>
  )
}
