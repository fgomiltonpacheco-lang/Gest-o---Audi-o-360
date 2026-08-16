import React, { useEffect, useMemo, useState } from 'react'
import { TrendingDown, RefreshCw, MessageCircle, Download, Phone } from 'lucide-react'
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
} from '@/components/ui/table'
import { formatCurrency, formatDate, exportToCSV } from '@/lib/formatters'
import { diasEmAtraso, statusEfetivo, whatsappUrl } from '@/lib/contasReceber'
import type { ContaReceber } from '@/types'

export default function Inadimplentes() {
  const { contasReceber, fetchContasReceber } = useApp()

  useEffect(() => {
    fetchContasReceber()
  }, [fetchContasReceber])

  // Apenas contas vencidas (dias_em_atraso > 0), ordenadas por dias decrescente
  const inadimplentes = useMemo(() => {
    return contasReceber
      .filter((c) => {
        const st = statusEfetivo(c)
        return st === 'vencido'
      })
      .sort((a, b) => diasEmAtraso(b) - diasEmAtraso(a))
  }, [contasReceber])

  const totalInadimplencia = useMemo(
    () => inadimplentes.reduce((acc, c) => acc + c.valor_restante, 0),
    [inadimplentes],
  )

  const notificarWhatsApp = (c: ContaReceber) => {
    const dias = diasEmAtraso(c)
    const msg =
      `Olá ${c.cliente_nome}, aqui é da Audição360 Centro Auditivo. ` +
      `Verificamos que você possui um pagamento vencido há ${dias} dia(s) ` +
      `(vencimento ${formatDate(c.data_vencimento)}) no valor de ${formatCurrency(
        c.valor_restante,
      )}. ` +
      `Por favor, entre em contato para regularizar. Obrigado!`
    const url = whatsappUrl(c.cliente_telefone, msg)
    if (url) {
      window.open(url, '_blank')
    } else {
      alert('Paciente/empresa sem telefone cadastrado.')
    }
  }

  const exportarCSV = () => {
    const rows = inadimplentes.map((c) => ({
      Cliente: c.cliente_nome,
      Telefone: c.cliente_telefone,
      Descrição: c.descricao,
      'Valor Restante': c.valor_restante.toFixed(2),
      'Data Venda': c.data_venda,
      Vencimento: c.data_vencimento,
      'Dias em Atraso': diasEmAtraso(c),
      'Forma Pagamento': c.forma_pagamento,
      Origem: c.venda_origem,
    }))
    exportToCSV('inadimplentes', rows)
  }

  return (
    <div className="space-y-5 animate-in fade-in-50 duration-200">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center">
            <TrendingDown className="w-6 h-6 text-red-700" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Inadimplentes</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Contas vencidas — ordenadas por dias em atraso
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => fetchContasReceber()}
            variant="outline"
            className="rounded-xl text-sm"
          >
            <RefreshCw className="w-4 h-4 mr-1.5" /> Atualizar
          </Button>
          <Button
            onClick={exportarCSV}
            variant="outline"
            className="rounded-xl text-sm"
            disabled={inadimplentes.length === 0}
          >
            <Download className="w-4 h-4 mr-1.5" /> Exportar CSV
          </Button>
        </div>
      </div>

      {/* Resumo */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500 font-medium">
            Total de contas vencidas: {inadimplentes.length}
          </p>
          <p className="text-2xl font-extrabold text-red-700 mt-1">
            {formatCurrency(totalInadimplencia)}
          </p>
        </div>
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-sm">
          {inadimplentes.length} inadimplente(s)
        </Badge>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="text-xs uppercase tracking-wider">Cliente</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-right">Valor</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Vencimento</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-center">
                  Dias em Atraso
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Contato</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inadimplentes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-slate-400">
                    <TrendingDown className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    Nenhuma conta vencida. 🎉
                  </TableCell>
                </TableRow>
              ) : (
                inadimplentes.map((c) => {
                  const dias = diasEmAtraso(c)
                  return (
                    <TableRow key={c.id} className="hover:bg-slate-50/60">
                      <TableCell className="font-semibold text-slate-900">
                        {c.cliente_nome}
                        <div className="text-xs text-slate-400 font-normal">{c.descricao}</div>
                      </TableCell>
                      <TableCell className="text-right text-red-700 font-semibold whitespace-nowrap">
                        {formatCurrency(c.valor_restante)}
                      </TableCell>
                      <TableCell className="text-slate-600 whitespace-nowrap">
                        {formatDate(c.data_vencimento)}
                      </TableCell>
                      <TableCell className="text-center">
                        <span
                          className={`inline-flex items-center justify-center min-w-[36px] px-2 py-0.5 rounded-full text-xs font-bold ${
                            dias > 60
                              ? 'bg-red-100 text-red-800'
                              : dias > 30
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {dias}
                        </span>
                      </TableCell>
                      <TableCell className="text-slate-600 text-xs whitespace-nowrap">
                        {c.cliente_telefone ? (
                          <div className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {c.cliente_telefone}
                          </div>
                        ) : (
                          <span className="text-slate-400">Sem telefone</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() => notificarWhatsApp(c)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs h-8"
                          disabled={!c.cliente_telefone}
                        >
                          <MessageCircle className="w-3.5 h-3.5 mr-1" />
                          WhatsApp
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
