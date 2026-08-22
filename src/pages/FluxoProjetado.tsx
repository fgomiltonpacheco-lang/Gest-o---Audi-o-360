import React, { useEffect, useMemo, useState } from 'react'
import { CalendarRange, RefreshCw, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { addDays, todayStr, statusEfetivo, STATUS_BADGE_CLASS } from '@/lib/contasReceber'
import {
  CONTA_RECEBER_STATUS_LABELS,
  DESPESA_STATUS_LABELS,
  type Despesa,
  type DespesaStatus,
} from '@/types'

/** Status efetivo de uma despesa: a_pagar vencida → "vencido". */
function statusEfetivoDespesa(d: Despesa): DespesaStatus {
  if (d.status === 'cancelado' || d.status === 'pago') return d.status
  const hoje = todayStr()
  if (d.data_vencimento && d.data_vencimento < hoje) return 'vencido'
  return 'a_pagar'
}

const DESPESA_BADGE_CLASS: Record<DespesaStatus, string> = {
  a_pagar: 'bg-blue-50 text-blue-700 border-blue-200',
  pendente: 'bg-blue-50 text-blue-700 border-blue-200',
  pago: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  vencido: 'bg-red-50 text-red-700 border-red-200',
  atrasado: 'bg-red-50 text-red-700 border-red-200',
  cancelado: 'bg-slate-100 text-slate-600 border-slate-200',
}

type Linha = {
  id: string
  data: string
  descricao: string
  cliente: string
  valor: number
  tipo: 'entrada' | 'saida'
  statusLabel: string
  statusClass: string
}

export default function FluxoProjetado() {
  const { contasReceber, fetchContasReceber, despesas, fetchDespesas } = useApp()
  const [horizonDays, setHorizonDays] = useState(30)

  useEffect(() => {
    fetchContasReceber()
    fetchDespesas()
  }, [fetchContasReceber, fetchDespesas])

  const limite = addDays(todayStr(), horizonDays)

  // Contas a receber com vencimento nos próximos N dias (entradas previstas),
  // excluindo quitadas/canceladas/renegociadas.
  const entradas = useMemo(() => {
    const hoje = todayStr()
    return contasReceber
      .filter((c) => {
        const st = statusEfetivo(c)
        if (st === 'recebido_total' || st === 'cancelado' || st === 'renegociado') return false
        return c.data_vencimento >= hoje && c.data_vencimento <= limite
      })
      .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento))
  }, [contasReceber, limite])

  // Despesas a pagar com vencimento nos próximos N dias (saídas previstas),
  // excluindo pagas e canceladas.
  const saidas = useMemo(() => {
    const hoje = todayStr()
    return despesas
      .filter((d) => {
        const st = statusEfetivoDespesa(d)
        if (st === 'pago' || st === 'cancelado') return false
        return d.data_vencimento >= hoje && d.data_vencimento <= limite
      })
      .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento))
  }, [despesas, limite])

  // Linhas combinadas e ordenadas por data.
  const linhas = useMemo<Linha[]>(() => {
    const le: Linha[] = entradas.map((c) => {
      const st = statusEfetivo(c)
      return {
        id: 'in-' + c.id,
        data: c.data_vencimento,
        descricao: c.descricao,
        cliente: c.cliente_nome,
        valor: c.valor_restante,
        tipo: 'entrada',
        statusLabel: CONTA_RECEBER_STATUS_LABELS[st],
        statusClass: STATUS_BADGE_CLASS[st],
      }
    })
    const ls: Linha[] = saidas.map((d) => {
      const st = statusEfetivoDespesa(d)
      return {
        id: 'out-' + d.id,
        data: d.data_vencimento,
        descricao: d.descricao,
        cliente: 'Despesa',
        valor: (Number(d.valor) || 0) - (Number(d.valor_pago) || 0),
        tipo: 'saida',
        statusLabel: DESPESA_STATUS_LABELS[st],
        statusClass: DESPESA_BADGE_CLASS[st],
      }
    })
    return [...le, ...ls].sort((a, b) => a.data.localeCompare(b.data))
  }, [entradas, saidas])

  const totalEntradas = useMemo(
    () => entradas.reduce((acc, c) => acc + c.valor_restante, 0),
    [entradas],
  )
  const totalSaidas = useMemo(
    () =>
      saidas.reduce((acc, d) => acc + ((Number(d.valor) || 0) - (Number(d.valor_pago) || 0)), 0),
    [saidas],
  )
  const saldoLiquido = totalEntradas - totalSaidas

  return (
    <div className="space-y-5 animate-in fade-in-50 duration-200">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center">
            <CalendarRange className="w-6 h-6 text-indigo-700" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Fluxo de Caixa Projetado
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Entradas e saídas previstas nos próximos {horizonDays} dias
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <select
            value={horizonDays}
            onChange={(e) => setHorizonDays(Number(e.target.value))}
            className="h-9 rounded-lg text-sm border border-slate-200 px-2"
          >
            <option value={7}>7 dias</option>
            <option value={15}>15 dias</option>
            <option value={30}>30 dias</option>
            <option value={60}>60 dias</option>
            <option value={90}>90 dias</option>
          </select>
          <Button
            onClick={() => {
              fetchContasReceber()
              fetchDespesas()
            }}
            variant="outline"
            className="rounded-xl text-sm"
          >
            <RefreshCw className="w-4 h-4 mr-1.5" /> Atualizar
          </Button>
        </div>
      </div>

      {/* Resumo — 3 cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
              <ArrowUpCircle className="w-4 h-4 text-emerald-600" /> Entradas previstas
            </p>
            <p className="text-2xl font-extrabold text-emerald-700 mt-1">
              {formatCurrency(totalEntradas)}
            </p>
          </div>
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
            {entradas.length} conta(s)
          </Badge>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
              <ArrowDownCircle className="w-4 h-4 text-rose-600" /> Saídas previstas (despesas)
            </p>
            <p className="text-2xl font-extrabold text-rose-700 mt-1">
              {formatCurrency(totalSaidas)}
            </p>
          </div>
          <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">
            {saidas.length} despesa(s)
          </Badge>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">Saldo líquido projetado</p>
            <p
              className={`text-2xl font-extrabold mt-1 ${saldoLiquido >= 0 ? 'text-indigo-700' : 'text-red-600'}`}
            >
              {formatCurrency(saldoLiquido)}
            </p>
          </div>
          <Badge
            variant="outline"
            className={
              saldoLiquido >= 0
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                : 'bg-red-50 text-red-700 border-red-200'
            }
          >
            até {formatDate(limite)}
          </Badge>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="text-xs uppercase tracking-wider">Data</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Tipo</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Descrição</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Origem</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-right">Valor</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-slate-400">
                    <CalendarRange className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    Nenhuma movimentação prevista para o período.
                  </TableCell>
                </TableRow>
              ) : (
                linhas.map((l) => (
                  <TableRow key={l.id} className="hover:bg-slate-50/60">
                    <TableCell className="text-slate-700 font-medium whitespace-nowrap">
                      {formatDate(l.data)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          l.tipo === 'entrada'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }
                      >
                        {l.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className="text-slate-900 font-semibold max-w-[240px] truncate"
                      title={l.descricao}
                    >
                      {l.descricao}
                    </TableCell>
                    <TableCell className="text-slate-600">{l.cliente}</TableCell>
                    <TableCell
                      className={`text-right font-semibold whitespace-nowrap ${l.tipo === 'entrada' ? 'text-emerald-700' : 'text-rose-700'}`}
                    >
                      {l.tipo === 'entrada' ? '+' : '−'} {formatCurrency(l.valor)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={l.statusClass}>
                        {l.statusLabel}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            {linhas.length > 0 && (
              <TableFooter className="bg-slate-50">
                <TableRow>
                  <TableCell colSpan={4} className="font-bold text-slate-900">
                    Saldo líquido projetado
                  </TableCell>
                  <TableCell
                    className={`text-right font-extrabold whitespace-nowrap ${saldoLiquido >= 0 ? 'text-indigo-700' : 'text-red-600'}`}
                  >
                    {formatCurrency(saldoLiquido)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>
      </div>
    </div>
  )
}
