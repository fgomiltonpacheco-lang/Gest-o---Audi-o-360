import React, { useEffect, useMemo, useState } from 'react'
import { CalendarRange, RefreshCw } from 'lucide-react'
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
import { CONTA_RECEBER_STATUS_LABELS } from '@/types'

export default function FluxoProjetado() {
  const { contasReceber, fetchContasReceber } = useApp()
  const [horizonDays, setHorizonDays] = useState(30)

  useEffect(() => {
    fetchContasReceber()
  }, [fetchContasReceber])

  const limite = addDays(todayStr(), horizonDays)

  // Contas a receber com vencimento nos próximos N dias (a partir de hoje),
  // excluindo quitadas/canceladas/renegociadas.
  const projetado = useMemo(() => {
    const hoje = todayStr()
    return contasReceber
      .filter((c) => {
        const st = statusEfetivo(c)
        if (st === 'recebido_total' || st === 'cancelado' || st === 'renegociado') return false
        return c.data_vencimento >= hoje && c.data_vencimento <= limite
      })
      .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento))
  }, [contasReceber, limite])

  const totalPrevisto = useMemo(
    () => projetado.reduce((acc, c) => acc + c.valor_restante, 0),
    [projetado],
  )

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
              Entradas previstas nos próximos {horizonDays} dias
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
            onClick={() => fetchContasReceber()}
            variant="outline"
            className="rounded-xl text-sm"
          >
            <RefreshCw className="w-4 h-4 mr-1.5" /> Atualizar
          </Button>
        </div>
      </div>

      {/* Resumo */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500 font-medium">
            Total de entradas previstas até {formatDate(limite)}
          </p>
          <p className="text-2xl font-extrabold text-indigo-700 mt-1">
            {formatCurrency(totalPrevisto)}
          </p>
        </div>
        <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-sm">
          {projetado.length} conta(s)
        </Badge>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="text-xs uppercase tracking-wider">Data</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Cliente</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Descrição</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-right">
                  Valor Previsto
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projetado.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center text-slate-400">
                    <CalendarRange className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    Nenhuma entrada prevista para o período.
                  </TableCell>
                </TableRow>
              ) : (
                projetado.map((c) => {
                  const st = statusEfetivo(c)
                  return (
                    <TableRow key={c.id} className="hover:bg-slate-50/60">
                      <TableCell className="text-slate-700 font-medium whitespace-nowrap">
                        {formatDate(c.data_vencimento)}
                      </TableCell>
                      <TableCell className="text-slate-900 font-semibold">
                        {c.cliente_nome}
                      </TableCell>
                      <TableCell
                        className="text-slate-600 max-w-[260px] truncate"
                        title={c.descricao}
                      >
                        {c.descricao}
                      </TableCell>
                      <TableCell className="text-right text-indigo-700 font-semibold whitespace-nowrap">
                        {formatCurrency(c.valor_restante)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_BADGE_CLASS[st]}>
                          {CONTA_RECEBER_STATUS_LABELS[st]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
            {projetado.length > 0 && (
              <TableFooter className="bg-slate-50">
                <TableRow>
                  <TableCell colSpan={3} className="font-bold text-slate-900">
                    Total de entradas previstas
                  </TableCell>
                  <TableCell className="text-right font-extrabold text-indigo-700 whitespace-nowrap">
                    {formatCurrency(totalPrevisto)}
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
