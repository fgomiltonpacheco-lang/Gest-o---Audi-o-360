import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save, Loader2, Wrench } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency } from '@/lib/formatters'
import pb from '@/lib/pocketbase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// ---- Labels espelhados da listagem (OrdensServico.tsx) ----
const TIPO_SERVICO_OPTIONS = [
  { value: 'conserto', label: 'Conserto' },
  { value: 'manutencao', label: 'Manutenção' },
  { value: 'revisao', label: 'Revisão' },
  { value: 'ajuste', label: 'Ajuste' },
  { value: 'teste_aparelho', label: 'Teste de Aparelho' },
  { value: 'limpeza', label: 'Limpeza' },
  { value: 'molde', label: 'Molde' },
  { value: 'outro', label: 'Outro' },
] as const

const STATUS_OPTIONS = [
  { value: 'aberta', label: 'Aberta' },
  { value: 'em_andamento', label: 'Em Andamento' },
  { value: 'aguardando_aprovacao', label: 'Aguard. Aprovação' },
  { value: 'aguardando_pecas', label: 'Aguard. Peças' },
  { value: 'concluida', label: 'Concluída' },
  { value: 'entregue', label: 'Entregue' },
  { value: 'cancelada', label: 'Cancelada' },
] as const

const FORMA_PAGAMENTO_OPTIONS = [
  { value: 'nao_definido', label: 'Não definido' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'pix', label: 'PIX' },
  { value: 'cartao_credito', label: 'Cartão de Crédito' },
  { value: 'cartao_debito', label: 'Cartão de Débito' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'convenio', label: 'Convênio' },
  { value: 'gratuito', label: 'Gratuito' },
] as const

interface Tecnico {
  id: string
  name: string
}

interface OrdemServicoRecord {
  id: string
  numero: number | null
  ano: number | null
  paciente: string
  aparelho?: string
  tipo_servico: string
  descricao_problema?: string
  descricao_servico?: string
  status: string
  data_entrada?: string
  data_prevista?: string
  data_saida?: string
  valor?: number | null
  forma_pagamento?: string
  tecnico?: string
  observacoes?: string
  garantia?: boolean
  dias_garantia?: number | null
}

const todayStr = () => new Date().toISOString().split('T')[0]

export default function OrdemServicoForm() {
  const navigate = useNavigate()
  const params = useParams<{ id?: string }>()
  const { patients } = useApp()
  const { toast } = useToast()

  const osId = params.id
  const isEdit = !!osId

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Técnicos (usuários)
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([])

  // Aparelhos auditivos vinculados ao paciente selecionado
  const [aparelhos, setAparelhos] = useState<any[]>([])

  // ---- Campos do formulário ----
  const [patientSearch, setPatientSearch] = useState('')
  const [patientId, setPatientId] = useState('')
  const [patientDropdownOpen, setPatientDropdownOpen] = useState(false)
  const [tipoServico, setTipoServico] = useState<string>('manutencao')
  const [status, setStatus] = useState<string>('aberta')
  const [dataEntrada, setDataEntrada] = useState(todayStr())
  const [dataPrevista, setDataPrevista] = useState('')
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState<string>('')
  const [formaPagamento, setFormaPagamento] = useState<string>('nao_definido')
  const [tecnicoId, setTecnicoId] = useState<string>('')
  const [aparelhoId, setAparelhoId] = useState<string>('')
  const [garantia, setGarantia] = useState(false)
  const [diasGarantia, setDiasGarantia] = useState<string>('')
  const [observacoes, setObservacoes] = useState('')

  // ---- Carrega técnicos ----
  useEffect(() => {
    let mounted = true
    async function loadTecnicos() {
      try {
        const res = await pb.collection('users').getFullList({ sort: 'name' })
        if (!mounted) return
        setTecnicos(
          res.map((u: any) => ({
            id: u.id,
            name: u.name || u.email || '—',
          })),
        )
      } catch (err) {
        console.error('Erro ao carregar técnicos:', err)
      }
    }
    loadTecnicos()
    return () => {
      mounted = false
    }
  }, [])

  // ---- Carrega aparelhos do paciente selecionado ----
  useEffect(() => {
    let mounted = true
    async function loadAparelhos(pid: string) {
      if (!pid) {
        setAparelhos([])
        return
      }
      try {
        const res = await pb
          .collection('hearing_aids')
          .getFullList({ filter: `patientId = "${pid}"`, sort: '-created' })
        if (!mounted) return
        setAparelhos(res as any[])
      } catch (err) {
        console.error('Erro ao carregar aparelhos do paciente:', err)
        setAparelhos([])
      }
    }
    loadAparelhos(patientId)
    return () => {
      mounted = false
    }
  }, [patientId])

  // ---- Carrega OS existente (edição) ----
  useEffect(() => {
    let mounted = true
    async function loadOS() {
      if (!osId) return
      setLoading(true)
      try {
        const rec: any = await pb
          .collection('ordens_servico')
          .getOne(osId, { expand: 'paciente,tecnico,aparelho' })
        if (!mounted) return
        setPatientId(rec.paciente || '')
        const pac = rec.expand?.paciente
        setPatientSearch(pac?.name || '')
        setTipoServico(rec.tipo_servico || 'manutencao')
        setStatus(rec.status || 'aberta')
        setDataEntrada(rec.data_entrada || todayStr())
        setDataPrevista(rec.data_prevista || '')
        setDescricao(rec.descricao_problema || rec.descricao_servico || '')
        setValor(rec.valor != null ? String(rec.valor) : '')
        setFormaPagamento(rec.forma_pagamento || 'nao_definido')
        setTecnicoId(rec.tecnico || '')
        setAparelhoId(rec.aparelho || '')
        setGarantia(!!rec.garantia)
        setDiasGarantia(rec.dias_garantia != null ? String(rec.dias_garantia) : '')
        setObservacoes(rec.observacoes || '')
      } catch (err) {
        console.error('Erro ao carregar OS:', err)
        toast({ title: 'Ordem de Serviço não encontrada.', variant: 'destructive' })
        navigate('/ordens-servico')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    loadOS()
    return () => {
      mounted = false
    }
  }, [osId, navigate, toast])

  // ---- Autocomplete de pacientes (igual à agenda) ----
  const filteredPatients = useMemo(() => {
    if (!patientSearch.trim()) return patients.slice(0, 6)
    const q = patientSearch.toLowerCase()
    return patients
      .filter((p) => p.name.toLowerCase().includes(q) || (p.cpf || '').includes(q))
      .slice(0, 8)
  }, [patients, patientSearch])

  const handleSelectPatient = (p: { id: string; name: string }) => {
    setPatientId(p.id)
    setPatientSearch(p.name)
    setPatientDropdownOpen(false)
    setAparelhoId('')
  }

  // ---- Geração do número OS (OS-YYYY-XXXX) ----
  const gerarNumeroOS = async (): Promise<{ numero: number; ano: number }> => {
    const ano = new Date().getFullYear()
    let numero = 1
    try {
      const res = await pb.collection('ordens_servico').getList(1, 1, {
        filter: `ano = ${ano}`,
        sort: '-numero',
      })
      const last = res.items[0] as any
      if (last && last.numero) {
        numero = (Number(last.numero) || 0) + 1
      }
    } catch (err) {
      console.warn('Erro ao buscar última OS; iniciando em 1:', err)
    }
    return { numero, ano }
  }

  // ---- Submit ----
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!patientId) {
      toast({ title: 'Selecione um paciente.', variant: 'destructive' })
      return
    }
    if (!tipoServico) {
      toast({ title: 'Selecione o tipo de serviço.', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const payload: Record<string, any> = {
        paciente: patientId,
        tipo_servico: tipoServico,
        status,
        data_entrada: dataEntrada || null,
        data_prevista: dataPrevista || null,
        descricao_problema: descricao.trim(),
        valor: valor ? Number(valor) : null,
        forma_pagamento: formaPagamento,
        tecnico: tecnicoId || null,
        aparelho: aparelhoId || null,
        garantia: !!garantia,
        dias_garantia: diasGarantia ? Number(diasGarantia) : null,
        observacoes: observacoes.trim(),
      }

      if (!isEdit) {
        // Geração automática do número OS (OS-YYYY-XXXX)
        const { numero, ano } = await gerarNumeroOS()
        payload.numero = numero
        payload.ano = ano
      }

      if (isEdit && osId) {
        await pb.collection('ordens_servico').update(osId, payload)
        toast({ title: 'Ordem de Serviço atualizada com sucesso!' })
      } else {
        const rec = await pb.collection('ordens_servico').create(payload)
        const anoFmt = payload.ano
        const numFmt = String(payload.numero).padStart(4, '0')
        toast({
          title: 'Ordem de Serviço criada!',
          description: `Número gerado: OS-${anoFmt}-${numFmt}`,
        })
        navigate(`/ordens-servico`)
        void rec
      }
      if (isEdit) navigate('/ordens-servico')
    } catch (err: any) {
      console.error('Erro ao salvar OS:', err)
      toast({
        title: 'Erro ao salvar Ordem de Serviço',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-in fade-in-50 duration-200">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/ordens-servico')}
            className="rounded-lg"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                {isEdit ? 'Editar Ordem de Serviço' : 'Nova Ordem de Serviço'}
              </h1>
              <Badge className="bg-teal-50 text-teal-700 border-teal-200">
                <Wrench className="w-3 h-3 mr-1" />
                {isEdit ? 'Edição' : 'Criação'}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {isEdit
                ? 'Atualize os dados da ordem de serviço.'
                : 'Preencha os dados para criar uma nova OS. O número é gerado automaticamente.'}
            </p>
          </div>
        </div>
      </div>

      {/* Formulário */}
      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5 max-w-3xl"
      >
        {/* Paciente */}
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
            autoComplete="off"
          />
          {patientDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto divide-y divide-slate-100">
              {filteredPatients.length === 0 ? (
                <div className="p-2.5 text-xs text-slate-400 text-center">
                  Nenhum paciente encontrado.
                </div>
              ) : (
                filteredPatients.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => handleSelectPatient(p)}
                    className="p-2.5 hover:bg-teal-50 cursor-pointer text-xs flex items-center justify-between"
                  >
                    <div>
                      <span className="font-bold text-slate-800 block">{p.name}</span>
                      <span className="text-slate-400 text-[10px]">CPF: {p.cpf || '—'}</span>
                    </div>
                    <span className="text-teal-600 text-[11px] font-semibold">
                      {p.mobile || p.phone || ''}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Aparelho + Técnico */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs font-semibold text-slate-700">
              Aparelho <span className="text-slate-400 font-normal">(opcional)</span>
            </Label>
            <Select value={aparelhoId} onValueChange={setAparelhoId}>
              <SelectTrigger className="h-10 rounded-xl mt-1 border-slate-300 text-sm">
                <SelectValue placeholder="Selecione o aparelho" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Nenhum</SelectItem>
                {aparelhos.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.brand} {a.model} {a.serialNumber ? `(${a.serialNumber})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {patientId && aparelhos.length === 0 && (
              <p className="text-[11px] text-slate-400 mt-1">
                Nenhum aparelho vinculado a este paciente.
              </p>
            )}
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-700">
              Técnico Responsável <span className="text-slate-400 font-normal">(opcional)</span>
            </Label>
            <Select value={tecnicoId} onValueChange={setTecnicoId}>
              <SelectTrigger className="h-10 rounded-xl mt-1 border-slate-300 text-sm">
                <SelectValue placeholder="Selecione o técnico" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Nenhum</SelectItem>
                {tecnicos.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tipo + Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs font-semibold text-slate-700">
              Tipo de Serviço <span className="text-red-500">*</span>
            </Label>
            <Select value={tipoServico} onValueChange={setTipoServico}>
              <SelectTrigger className="h-10 rounded-xl mt-1 border-slate-300 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPO_SERVICO_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-700">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-10 rounded-xl mt-1 border-slate-300 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Datas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs font-semibold text-slate-700">Data de Entrada</Label>
            <Input
              type="date"
              value={dataEntrada}
              onChange={(e) => setDataEntrada(e.target.value)}
              className="h-10 rounded-xl mt-1 text-sm border-slate-300"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-700">
              Data Prevista <span className="text-slate-400 font-normal">(opcional)</span>
            </Label>
            <Input
              type="date"
              value={dataPrevista}
              onChange={(e) => setDataPrevista(e.target.value)}
              className="h-10 rounded-xl mt-1 text-sm border-slate-300"
            />
          </div>
        </div>

        {/* Valor + Forma de Pagamento */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs font-semibold text-slate-700">
              Valor (R$) <span className="text-slate-400 font-normal">(opcional)</span>
            </Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0,00"
              className="h-10 rounded-xl mt-1 text-sm border-slate-300"
            />
            {valor && Number(valor) > 0 && (
              <p className="text-[11px] text-teal-600 font-medium mt-1">
                {formatCurrency(Number(valor))}
              </p>
            )}
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-700">Forma de Pagamento</Label>
            <Select value={formaPagamento} onValueChange={setFormaPagamento}>
              <SelectTrigger className="h-10 rounded-xl mt-1 border-slate-300 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORMA_PAGAMENTO_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Descrição */}
        <div>
          <Label className="text-xs font-semibold text-slate-700">
            Descrição do Problema / Serviço
          </Label>
          <Textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Descreva o problema relatado e/ou o serviço a ser realizado..."
            className="rounded-xl mt-1 text-sm min-h-[80px] border-slate-300"
          />
        </div>

        {/* Garantia */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
          <div className="flex items-center gap-2">
            <input
              id="garantia-check"
              type="checkbox"
              checked={garantia}
              onChange={(e) => setGarantia(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
            <Label htmlFor="garantia-check" className="text-xs font-semibold text-slate-700 mb-0">
              Possui garantia
            </Label>
          </div>
          {garantia && (
            <div>
              <Label className="text-xs font-semibold text-slate-700">Dias de Garantia</Label>
              <Input
                type="number"
                min="0"
                value={diasGarantia}
                onChange={(e) => setDiasGarantia(e.target.value)}
                placeholder="Ex.: 90"
                className="h-10 rounded-xl mt-1 text-sm border-slate-300"
              />
            </div>
          )}
        </div>

        {/* Observações */}
        <div>
          <Label className="text-xs font-semibold text-slate-700">
            Observações <span className="text-slate-400 font-normal">(opcional)</span>
          </Label>
          <Textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Observações adicionais sobre a OS..."
            className="rounded-xl mt-1 text-sm min-h-[60px] border-slate-300"
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/ordens-servico')}
            className="rounded-xl text-sm"
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={saving}
            className="rounded-xl text-sm bg-teal-500 hover:bg-teal-600 text-white"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-1.5" /> {isEdit ? 'Atualizar OS' : 'Criar OS'}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
