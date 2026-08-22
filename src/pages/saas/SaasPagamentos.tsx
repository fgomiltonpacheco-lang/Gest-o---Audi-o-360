import React, { useEffect, useMemo, useState } from 'react'
import { Plus, AlertTriangle, CheckCircle2, Clock, CreditCard } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import {
  SaasPageHeader,
  SaasBreadcrumbs,
  SaasLoading,
  SaasEmptyState,
} from '@/pages/saas/SaasShared'
import {
  fetchPagamentos,
  fetchClinicas,
  fetchPlanos,
  mapPagamento,
  clinicaStatusLabel,
  diasAtraso,
  pagamentoStatusLabel,
  pagamentoStatusClass,
  pagamentoFormaLabel,
} from '@/pages/saas/shared'
import { Clinica, PagamentoSaaS, PagamentoSaaSForma, Plano } from '@/types'
import { formatCurrency } from '@/lib/formatters'
import pb from '@/lib/pocketbase/client'

const fmtDate = (s?: string) => {
  if (!s) return '—'
  const [y, m, d] = s.split('-')
  if (!y || !m || !d) return s
  return `${d}/${m}/${y}`
}

function hojeStr(): string {
  return new Date().toISOString().split('T')[0]
}

export default function SaasPagamentos() {
  const { toast } = useToast()
  const [pagamentos, setPagamentos] = useState<PagamentoSaaS[]>([])
  const [clinicas, setClinicas] = useState<Clinica[]>([])
  const [planos, setPlanos] = useState<Plano[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')

  // Filtros
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [filtroPeriodo, setFiltroPeriodo] = useState('todos') // todos/mes/atrasados

  // Modal registrar pagamento
  const [modalOpen, setModalOpen] = useState(false)
  const [regClinicaId, setRegClinicaId] = useState('')
  const [regValor, setRegValor] = useState<number>(0)
  const [regVencimento, setRegVencimento] = useState('')
  const [regDataPagamento, setRegDataPagamento] = useState('')
  const [regForma, setRegForma] = useState<PagamentoSaaSForma>('pix')
  const [regStatus, setRegStatus] = useState<'pago' | 'pendente' | 'atrasado'>('pago')
  const [regObs, setRegObs] = useState('')
  const [salvando, setSalvando] = useState(false)

  const carregar = async () => {
    try {
      setLoading(true)
      setErro('')
      const [p, c, pl] = await Promise.all([fetchPagamentos(), fetchClinicas(), fetchPlanos()])
      setPagamentos(p)
      setClinicas(c)
      setPlanos(pl)
    } catch (e: any) {
      setErro(e?.message || 'Erro ao carregar pagamentos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  const clinicaNome = (id: string) => clinicas.find((c) => c.id === id)?.nome || '—'
  const clinicaPlano = (id: string) => {
    const c = clinicas.find((x) => x.id === id)
    return c?.plano_id
  }
  const planoPreco = (planoId?: string) => planos.find((p) => p.id === planoId)?.preco_mensal

  const filtrados = useMemo(() => {
    return pagamentos.filter((p) => {
      if (filtroStatus !== 'todos' && p.status !== filtroStatus) return false
      if (filtroPeriodo === 'atrasados') {
        if (p.status !== 'atrasado' && diasAtraso(p.data_vencimento) < 1) return false
      } else if (filtroPeriodo === 'mes') {
        const mesAtual = new Date().toISOString().slice(0, 7)
        if ((p.referencia || '').slice(0, 7) !== mesAtual) return false
      }
      return true
    })
  }, [pagamentos, filtroStatus, filtroPeriodo])

  // ---------- Registrar pagamento ----------
  const abrirModalReg = () => {
    setRegClinicaId(clinicas[0]?.id || '')
    setRegValor(planoPreco(clinicas[0]?.plano_id) || 0)
    setRegVencimento(hojeStr())
    setRegDataPagamento(hojeStr())
    setRegForma('pix')
    setRegStatus('pago')
    setRegObs('')
    setModalOpen(true)
  }

  const onClinicaChange = (id: string) => {
    setRegClinicaId(id)
    const pId = clinicaPlano(id)
    const preco = planoPreco(pId)
    if (preco !== undefined) setRegValor(preco)
  }

  const salvarRegistro = async () => {
    if (!regClinicaId) {
      toast({ title: 'Selecione a clínica.', variant: 'destructive' })
      return
    }
    if (!regVencimento) {
      toast({ title: 'Informe o vencimento.', variant: 'destructive' })
      return
    }
    try {
      setSalvando(true)
      const data: Record<string, unknown> = {
        clinica_id: regClinicaId,
        plano_id: clinicaPlano(regClinicaId) || '',
        valor: Number(regValor) || 0,
        data_vencimento: regVencimento,
        forma_pagamento: regForma,
        status: regStatus,
        observacoes: regObs,
        referencia: regVencimento.slice(0, 7),
      }
      if (regStatus === 'pago' && regDataPagamento) {
        data.data_pagamento = regDataPagamento
      }
      const rec = await pb.collection('pagamentos_saas').create(data)
      setPagamentos((prev) => [mapPagamento(rec), ...prev])
      setModalOpen(false)
      toast({ title: 'Pagamento registrado!' })
    } catch (e: any) {
      toast({
        title: 'Erro ao registrar pagamento',
        description: e?.message,
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  // ---------- Marcar como pago ----------
  const marcarPago = async (p: PagamentoSaaS) => {
    try {
      const rec = await pb.collection('pagamentos_saas').update(p.id, {
        status: 'pago',
        data_pagamento: hojeStr(),
      })
      setPagamentos((prev) => prev.map((x) => (x.id === p.id ? mapPagamento(rec) : x)))
      toast({ title: 'Pagamento confirmado!', description: clinicaNome(p.clinica_id) })
    } catch (e: any) {
      toast({ title: 'Erro', description: e?.message, variant: 'destructive' })
    }
  }

  // Estatísticas
  const totalRecebido = pagamentos
    .filter((p) => p.status === 'pago')
    .reduce((s, p) => s + (p.valor || 0), 0)
  const totalPendente = pagamentos
    .filter((p) => p.status === 'pendente')
    .reduce((s, p) => s + (p.valor || 0), 0)
  const totalAtrasado = pagamentos
    .filter((p) => p.status === 'atrasado' || diasAtraso(p.data_vencimento) >= 1)
    .filter((p) => p.status !== 'pago')
    .reduce((s, p) => s + (p.valor || 0), 0)
  const criticos = pagamentos.filter((p) => diasAtraso(p.data_vencimento) >= 7).length

  return (
    <div className="space-y-6">
      <SaasBreadcrumbs items={[{ label: 'Gestão SaaS', to: '/saas' }, { label: 'Pagamentos' }]} />
      <SaasPageHeader
        title="Gestão de Pagamentos"
        description="Controle de mensalidades e inadimplência das clínicas."
        actions={
          <Button className="bg-amber-600 hover:bg-amber-700" onClick={abrirModalReg}>
            <Plus className="w-4 h-4" />
            Registrar Pagamento
          </Button>
        }
      />

      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-emerald-200 bg-emerald-50/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="text-[11px] uppercase font-medium text-emerald-700">Recebido</span>
            </div>
            <p className="text-xl font-bold text-emerald-700">{formatCurrency(totalRecebido)}</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-amber-600" />
              <span className="text-[11px] uppercase font-medium text-amber-700">Pendente</span>
            </div>
            <p className="text-xl font-bold text-amber-700">{formatCurrency(totalPendente)}</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span className="text-[11px] uppercase font-medium text-red-700">Atrasado</span>
            </div>
            <p className="text-xl font-bold text-red-700">{formatCurrency(totalAtrasado)}</p>
          </CardContent>
        </Card>
        <Card className="border-red-300 bg-red-50/40">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-red-700" />
              <span className="text-[11px] uppercase font-medium text-red-700">
                Inadimpl. 7+ dias
              </span>
            </div>
            <p className="text-xl font-bold text-red-700">{criticos}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="pago">Pagos</SelectItem>
              <SelectItem value="pendente">Pendentes</SelectItem>
              <SelectItem value="atrasado">Atrasados</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os períodos</SelectItem>
              <SelectItem value="mes">Mês atual</SelectItem>
              <SelectItem value="atrasados">Somente atrasados</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700">
            Mensalidades ({filtrados.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <SaasLoading message="Carregando pagamentos…" />
          ) : erro ? (
            <div className="py-10 text-center text-red-600">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
              {erro}
            </div>
          ) : filtrados.length === 0 ? (
            <SaasEmptyState
              icon={CreditCard}
              title="Nenhum pagamento encontrado"
              description="Ajuste os filtros ou registre um novo pagamento."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Clínica</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-6 text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((p) => {
                  const atraso = diasAtraso(p.data_vencimento)
                  const inadimplente = atraso >= 7 && p.status !== 'pago'
                  return (
                    <TableRow key={p.id} className={inadimplente ? 'bg-red-50/40' : ''}>
                      <TableCell className="pl-6 font-medium text-slate-800">
                        {p.clinica_nome || clinicaNome(p.clinica_id)}
                      </TableCell>
                      <TableCell className="text-slate-600 text-sm">
                        {p.plano_nome || '—'}
                      </TableCell>
                      <TableCell className="font-semibold text-slate-700">
                        {formatCurrency(p.valor)}
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm">
                        {fmtDate(p.data_vencimento)}
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm">
                        {fmtDate(p.data_pagamento)}
                        {p.forma_pagamento && (
                          <div className="text-[10px] text-slate-400">
                            {pagamentoFormaLabel(p.forma_pagamento)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`border ${pagamentoStatusClass(p.status)}`}
                          >
                            {pagamentoStatusLabel(p.status)}
                          </Badge>
                          {inadimplente && (
                            <Badge
                              variant="outline"
                              className="border-red-300 bg-red-100 text-red-700 flex items-center gap-1"
                            >
                              <AlertTriangle className="w-3 h-3" />
                              {atraso} dias
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        {p.status !== 'pago' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8"
                            onClick={() => marcarPago(p)}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Confirmar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal Registrar Pagamento */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrar Pagamento</DialogTitle>
            <DialogDescription>
              Registre uma mensalidade manualmente para uma clínica.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="pg-clinica">Clínica *</Label>
              <Select value={regClinicaId} onValueChange={onClinicaChange}>
                <SelectTrigger id="pg-clinica">
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  {clinicas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="pg-valor">Valor (R$)</Label>
                <Input
                  id="pg-valor"
                  type="number"
                  min={0}
                  step="0.01"
                  value={regValor}
                  onChange={(e) => setRegValor(Number(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="pg-forma">Forma de Pagamento</Label>
                <Select
                  value={regForma}
                  onValueChange={(v) => setRegForma(v as PagamentoSaaSForma)}
                >
                  <SelectTrigger id="pg-forma">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="boleto">Boleto</SelectItem>
                    <SelectItem value="cartao">Cartão</SelectItem>
                    <SelectItem value="transferencia">Transferência</SelectItem>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="pg-venc">Vencimento *</Label>
                <Input
                  id="pg-venc"
                  type="date"
                  value={regVencimento}
                  onChange={(e) => setRegVencimento(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="pg-data">Data do Pagamento</Label>
                <Input
                  id="pg-data"
                  type="date"
                  value={regDataPagamento}
                  onChange={(e) => setRegDataPagamento(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="pg-status">Status</Label>
              <Select
                value={regStatus}
                onValueChange={(v) => setRegStatus(v as 'pago' | 'pendente' | 'atrasado')}
              >
                <SelectTrigger id="pg-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="atrasado">Atrasado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="pg-obs">Observações</Label>
              <Input
                id="pg-obs"
                value={regObs}
                onChange={(e) => setRegObs(e.target.value)}
                placeholder="Opcional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={salvando}>
              Cancelar
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700"
              onClick={salvarRegistro}
              disabled={salvando}
            >
              {salvando ? 'Salvando…' : 'Registrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
