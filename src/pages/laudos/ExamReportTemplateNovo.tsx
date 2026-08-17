import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { createTemplate } from '@/lib/examReportTemplates'
import {
  EXAM_REPORT_TIPO_LABELS,
  PAGE_SIZES,
  type ExamReportTipoExame,
  type ExamReportOrientacao,
} from '@/types'

export default function ExamReportTemplateNovo() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [salvando, setSalvando] = useState(false)

  const [nome, setNome] = useState('')
  const [tipoExame, setTipoExame] = useState<ExamReportTipoExame>('audiometria')
  const [descricao, setDescricao] = useState('')
  const [orientacao, setOrientacao] = useState<ExamReportOrientacao>('retrato')
  const [tamanhoFolha, setTamanhoFolha] = useState('A4')
  const [margemSup, setMargemSup] = useState(12)
  const [margemInf, setMargemInf] = useState(12)
  const [margemEsq, setMargemEsq] = useState(15)
  const [margemDir, setMargemDir] = useState(15)

  const handleSalvar = async () => {
    if (!nome.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Informe um nome para o modelo.',
        variant: 'destructive',
      })
      return
    }
    setSalvando(true)
    try {
      const dims = PAGE_SIZES[tamanhoFolha]
      let largura = dims.largura
      let altura = dims.altura
      if (orientacao === 'paisagem') {
        ;[largura, altura] = [altura, largura]
      }
      const tpl = await createTemplate({
        nome_modelo: nome.trim(),
        tipo_exame: tipoExame,
        descricao: descricao.trim(),
        orientacao,
        largura_pagina: largura,
        altura_pagina: altura,
        margem_superior: margemSup,
        margem_inferior: margemInf,
        margem_esquerda: margemEsq,
        margem_direita: margemDir,
      })
      toast({ title: 'Modelo criado', description: 'Abrindo o editor visual...' })
      navigate(`/configuracoes/laudos/${tpl.id}/editor`)
    } catch (err) {
      toast({ title: 'Erro ao criar modelo', description: String(err), variant: 'destructive' })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center gap-3">
          <Link to="/configuracoes/laudos">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Novo Modelo de Impressão</h1>
            <p className="text-sm text-slate-500">
              Configure as propriedades básicas antes de abrir o editor visual
            </p>
          </div>
        </div>

        <Card>
          <CardContent className="space-y-5 p-6">
            <div className="space-y-2">
              <Label htmlFor="nome">
                Nome do Modelo <span className="text-red-500">*</span>
              </Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: Laudo de Audiometria Padrão"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipo">
                Tipo de Exame <span className="text-red-500">*</span>
              </Label>
              <Select
                value={tipoExame}
                onValueChange={(v) => setTipoExame(v as ExamReportTipoExame)}
              >
                <SelectTrigger id="tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(EXAM_REPORT_TIPO_LABELS) as ExamReportTipoExame[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {EXAM_REPORT_TIPO_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="desc">Descrição</Label>
              <Textarea
                id="desc"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Descreva o objetivo deste modelo (opcional)..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Orientação</Label>
                <div className="flex gap-4 pt-1">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="orientacao"
                      value="retrato"
                      checked={orientacao === 'retrato'}
                      onChange={() => setOrientacao('retrato')}
                      className="h-4 w-4 accent-[#1E3A8A]"
                    />
                    Retrato
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="orientacao"
                      value="paisagem"
                      checked={orientacao === 'paisagem'}
                      onChange={() => setOrientacao('paisagem')}
                      className="h-4 w-4 accent-[#1E3A8A]"
                    />
                    Paisagem
                  </label>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="folha">Tamanho da folha</Label>
                <Select value={tamanhoFolha} onValueChange={setTamanhoFolha}>
                  <SelectTrigger id="folha">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(PAGE_SIZES).map((k) => (
                      <SelectItem key={k} value={k}>
                        {PAGE_SIZES[k].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Margens (mm)</Label>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div>
                  <Label className="text-xs text-slate-500">Superior</Label>
                  <Input
                    type="number"
                    value={margemSup}
                    onChange={(e) => setMargemSup(Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Inferior</Label>
                  <Input
                    type="number"
                    value={margemInf}
                    onChange={(e) => setMargemInf(Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Esquerda</Label>
                  <Input
                    type="number"
                    value={margemEsq}
                    onChange={(e) => setMargemEsq(Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Direita</Label>
                  <Input
                    type="number"
                    value={margemDir}
                    onChange={(e) => setMargemDir(Number(e.target.value))}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Link to="/configuracoes/laudos">
                <Button variant="outline">Cancelar</Button>
              </Link>
              <Button
                onClick={handleSalvar}
                disabled={salvando}
                className="bg-[#1E3A8A] hover:bg-[#1e40af]"
              >
                <Save className="mr-2 h-4 w-4" /> {salvando ? 'Criando...' : 'Criar Modelo'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
