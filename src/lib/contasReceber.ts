import type { ContaReceber, ContaReceberStatus } from '@/types'

export { STATUS_BADGE_CLASS } from '@/lib/contasReceberStatus'

/** Hoje em YYYY-MM-DD (horário local). */
export function todayStr(): string {
  const d = new Date()
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().split('T')[0]
}

/** Soma dias a uma data YYYY-MM-DD e retorna YYYY-MM-DD. */
export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  if (isNaN(d.getTime())) return dateStr
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

/**
 * Dias em atraso: data_atual - data_vencimento.
 * Retorna 0 se não venceu ou se a conta já está quitada/cancelada/renegociada.
 */
export function diasEmAtraso(conta: ContaReceber): number {
  if (
    conta.status === 'recebido_total' ||
    conta.status === 'cancelado' ||
    conta.status === 'renegociado'
  ) {
    return 0
  }
  const venc = new Date(conta.data_vencimento + 'T00:00:00')
  if (isNaN(venc.getTime())) return 0
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const diff = Math.floor((hoje.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24))
  return diff > 0 ? diff : 0
}

/** Status efetivo considerando vencimento dinâmico. */
export function statusEfetivo(conta: ContaReceber): ContaReceberStatus {
  if (
    conta.status === 'recebido_total' ||
    conta.status === 'cancelado' ||
    conta.status === 'renegociado'
  ) {
    return conta.status
  }
  return diasEmAtraso(conta) > 0 ? 'vencido' : conta.status
}

export const STATUS_BADGE_CLASS: Record<ContaReceberStatus, string> = {
  a_receber: 'bg-blue-50 text-blue-700 border-blue-200',
  recebido_parcial: 'bg-amber-50 text-amber-700 border-amber-200',
  recebido_total: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  vencido: 'bg-red-50 text-red-700 border-red-200',
  renegociado: 'bg-purple-50 text-purple-700 border-purple-200',
  cancelado: 'bg-slate-100 text-slate-500 border-slate-200',
}

/** Normaliza um telefone brasileiro para o formato do WhatsApp (55DDDNNNNNNNNN). */
export function whatsappNumber(telefone: string): string {
  const digits = (telefone || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('55')) return digits
  return '55' + digits
}

/** Monta a URL de wa.me com mensagem codificada. */
export function whatsappUrl(telefone: string, mensagem: string): string {
  const num = whatsappNumber(telefone)
  if (!num) return ''
  return `https://wa.me/${num}?text=${encodeURIComponent(mensagem)}`
}
