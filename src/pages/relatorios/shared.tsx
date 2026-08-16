import React from 'react'
import { Download, Filter, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { exportToCSV } from '@/lib/formatters'
import type { LucideIcon } from 'lucide-react'

// ============================================================
// Tipos & helpers de período
// ============================================================

export interface Period {
  from: string // YYYY-MM-DD
  to: string // YYYY-MM-DD
}

export function ymd(d: Date): string {
  return d.toISOString().split('T')[0]
}

/** Mês corrente (1º ao último dia). */
export function thisMonthRange(today: Date = new Date()): Period {
  const first = new Date(today.getFullYear(), today.getMonth(), 1)
  const last = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  return { from: ymd(first), to: ymd(last) }
}

/** Últimos 30 dias (inclusive hoje). */
export function last30Range(today: Date = new Date()): Period {
  const d = new Date(today)
  d.setDate(d.getDate() - 29)
  return { from: ymd(d), to: ymd(today) }
}

/** Período anterior com a mesma duração (em dias) do período informado. */
export function prevPeriod(p: Period): Period {
  const from = new Date(p.from + 'T00:00:00')
  const to = new Date(p.to + 'T00:00:00')
  const days = Math.round((to.getTime() - from.getTime()) / 86400000) + 1
  const prevTo = new Date(from)
  prevTo.setDate(prevTo.getDate() - 1)
  const prevFrom = new Date(prevTo)
  prevFrom.setDate(prevFrom.getDate() - (days - 1))
  return { from: ymd(prevFrom), to: ymd(prevTo) }
}

/** Verdadeiro se a data (YYYY-MM-DD) está dentro do intervalo. */
export function inDateRange(d: string | undefined | null, from?: string, to?: string): boolean {
  if (!d) return false
  if (from && d < from) return false
  if (to && d > to) return false
  return true
}

export function periodDays(p: Period): number {
  const from = new Date(p.from + 'T00:00:00')
  const to = new Date(p.to + 'T00:00:00')
  return Math.round((to.getTime() - from.getTime()) / 86400000) + 1
}

/** Lista ordenada e sem duplicatas de profissionais a partir de agendamentos e vendas B2B. */
export function professionalOptions(
  appointments: Array<{ professionalName?: string }>,
  vendasB2B: Array<{ especialista_nome?: string }> = [],
): string[] {
  const set = new Set<string>()
  appointments.forEach((a) => {
    const n = (a.professionalName || '').trim()
    if (n) set.add(n)
  })
  vendasB2B.forEach((v) => {
    const n = (v.especialista_nome || '').trim()
    if (n) set.add(n)
  })
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

// ============================================================
// Normalização de forma de pagamento
// ============================================================

export type PaymentGroup = 'Dinheiro' | 'Cartão' | 'PIX' | 'Convênio' | 'Boleto' | 'Outro'

/** Agrupa as várias formas de pagamento (incluindo valores legados) nas 5 categorias do relatório. */
export function normalizePaymentMethod(pm: string | undefined | null): PaymentGroup {
  const s = String(pm || '')
    .toLowerCase()
    .trim()
  if (!s) return 'Outro'
  if (s === 'dinheiro' || s === 'à vista' || s === 'a vista') return 'Dinheiro'
  if (s.includes('pix')) return 'PIX'
  if (s.includes('convênio') || s.includes('convenio')) return 'Convênio'
  if (s.includes('boleto')) return 'Boleto'
  if (
    s.includes('cartão') ||
    s.includes('cartao') ||
    s.includes('crédito') ||
    s.includes('debito') ||
    s.includes('débito') ||
    s.includes('parcelado')
  )
    return 'Cartão'
  return 'Outro'
}

export const PAYMENT_GROUPS: PaymentGroup[] = ['Dinheiro', 'Cartão', 'PIX', 'Convênio', 'Boleto']

// ============================================================
// Variação percentual
// ============================================================

export function growthPct(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return ((current - previous) / previous) * 100
}

export function fmtPct(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || isNaN(v)) return '—'
  const s = v.toFixed(digits).replace('.', ',')
  return `${v > 0 ? '+' : ''}${s}%`
}

// ============================================================
// Exportação CSV (UTF-8 com BOM — exportToCSV já adiciona o BOM)
// ============================================================

export function downloadCSV(filename: string, rows: Record<string, any>[]) {
  if (!rows.length) return
  exportToCSV(filename, rows)
}

// ============================================================
// Componentes de UI compartilhados
// ============================================================

export function ReportHeader({
  title,
  description,
  icon: Icon,
  onExport,
  exportDisabled,
}: {
  title: string
  description: string
  icon: LucideIcon
  onExport?: () => void
  exportDisabled?: boolean
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center">
          <Icon className="w-6 h-6 text-blue-700" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">{title}</h1>
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        </div>
      </div>
      {onExport && (
        <Button
          onClick={onExport}
          disabled={exportDisabled}
          className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm shadow-sm"
        >
          <Download className="w-4 h-4 mr-1.5" /> Exportar CSV
        </Button>
      )}
    </div>
  )
}

export function SummaryCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'slate',
}: {
  label: string
  value: string
  hint?: string
  icon: LucideIcon
  tone?: 'slate' | 'blue' | 'green' | 'amber' | 'red' | 'purple'
}) {
  const tones: Record<string, { ring: string; icon: string; text: string }> = {
    slate: {
      ring: 'border-slate-200',
      icon: 'bg-slate-100 text-slate-600',
      text: 'text-slate-900',
    },
    blue: { ring: 'border-blue-200', icon: 'bg-blue-50 text-blue-600', text: 'text-blue-700' },
    green: { ring: 'border-green-200', icon: 'bg-green-50 text-green-600', text: 'text-green-700' },
    amber: { ring: 'border-amber-200', icon: 'bg-amber-50 text-amber-600', text: 'text-amber-700' },
    red: { ring: 'border-red-200', icon: 'bg-red-50 text-red-600', text: 'text-red-700' },
    purple: {
      ring: 'border-purple-200',
      icon: 'bg-purple-50 text-purple-600',
      text: 'text-purple-700',
    },
  }
  const t = tones[tone] || tones.slate
  return (
    <div className={`bg-white p-4 rounded-2xl border ${t.ring} shadow-sm`}>
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider truncate">
            {label}
          </p>
          <p className={`text-xl font-extrabold ${t.text} mt-1 truncate`}>{value}</p>
          {hint && <p className="text-[10px] text-slate-500 mt-0.5 truncate">{hint}</p>}
        </div>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${t.icon}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
    </div>
  )
}

export function ChartCard({
  title,
  children,
  subtitle,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
      <div className="mb-4">
        <h2 className="text-sm font-bold text-slate-800">{title}</h2>
        {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

export function PeriodFilterBar({
  from,
  to,
  onFrom,
  onTo,
  onShortcut,
  extra,
  onClear,
  hasFilters,
}: {
  from: string
  to: string
  onFrom: (v: string) => void
  onTo: (v: string) => void
  onShortcut?: (s: 'this_month' | 'last_30d' | 'last_month' | 'this_year') => void
  extra?: React.ReactNode
  onClear?: () => void
  hasFilters?: boolean
}) {
  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
          <Filter className="w-4 h-4" /> Filtros
          {hasFilters && <Badge className="bg-blue-100 text-blue-700 ml-1">Ativos</Badge>}
        </div>
        {onClear && hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="h-7 text-xs text-slate-500"
          >
            <X className="w-3 h-3 mr-1" /> Limpar
          </Button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 items-end">
        <div>
          <Label className="text-[11px] text-slate-500 mb-1 block">Data inicial</Label>
          <Input
            type="date"
            value={from}
            onChange={(e) => onFrom(e.target.value)}
            className="h-9 rounded-lg text-sm"
          />
        </div>
        <div>
          <Label className="text-[11px] text-slate-500 mb-1 block">Data final</Label>
          <Input
            type="date"
            value={to}
            onChange={(e) => onTo(e.target.value)}
            className="h-9 rounded-lg text-sm"
          />
        </div>
        {onShortcut && (
          <div className="flex gap-1 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-xs"
              onClick={() => onShortcut('this_month')}
            >
              Mês atual
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-xs"
              onClick={() => onShortcut('last_30d')}
            >
              30 dias
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-xs"
              onClick={() => onShortcut('last_month')}
            >
              Mês anterior
            </Button>
          </div>
        )}
        {extra}
      </div>
    </div>
  )
}

export function ProfessionalSelect({
  value,
  onChange,
  options,
  label = 'Profissional',
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
  label?: string
}) {
  return (
    <div>
      <Label className="text-[11px] text-slate-500 mb-1 block">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 rounded-lg text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          {options.map((p) => (
            <SelectItem key={p} value={p}>
              {p}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function EmptyState({ message, icon: Icon }: { message: string; icon: LucideIcon }) {
  return (
    <div className="py-12 text-center text-slate-400">
      <Icon className="w-8 h-8 mx-auto mb-2 opacity-40" />
      <p className="text-sm">{message}</p>
    </div>
  )
}
