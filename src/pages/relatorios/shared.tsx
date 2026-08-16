import React from 'react'
import { Download, Filter, X, AlertTriangle, Inbox } from 'lucide-react'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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

// ============================================================
// Presets de período (DateRangeFilter)
// ============================================================

export type ShortcutId =
  | 'today'
  | 'last_7d'
  | 'last_30d'
  | 'this_month'
  | 'last_month'
  | 'this_year'

export function shortcutPeriod(id: ShortcutId, today: Date = new Date()): Period {
  const y = today.getFullYear()
  const m = today.getMonth()
  switch (id) {
    case 'today':
      return { from: ymd(today), to: ymd(today) }
    case 'last_7d': {
      const d = new Date(today)
      d.setDate(d.getDate() - 6)
      return { from: ymd(d), to: ymd(today) }
    }
    case 'last_30d':
      return last30Range(today)
    case 'this_month':
      return thisMonthRange(today)
    case 'last_month':
      return {
        from: ymd(new Date(y, m - 1, 1)),
        to: ymd(new Date(y, m, 0)),
      }
    case 'this_year':
      return { from: `${y}-01-01`, to: `${y}-12-31` }
  }
}

export const SHORTCUTS: { id: ShortcutId; label: string }[] = [
  { id: 'today', label: 'Hoje' },
  { id: 'last_7d', label: 'Últimos 7 dias' },
  { id: 'last_30d', label: 'Últimos 30 dias' },
  { id: 'this_month', label: 'Este mês' },
  { id: 'last_month', label: 'Mês passado' },
  { id: 'this_year', label: 'Este ano' },
]

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

export interface CsvColumn<T> {
  header: string
  accessor: (row: T) => string | number | null | undefined
}

/**
 * Exporta dados para CSV usando uma lista tipada de colunas.
 * Gera arquivo UTF-8 com BOM, separador `;` (compatível com Excel pt-BR).
 */
export function exportToCSVGeneric<T>(filename: string, columns: CsvColumn<T>[], rows: T[]): void {
  if (!rows.length) return
  const out = rows.map((row) => {
    const obj: Record<string, string | number | null | undefined> = {}
    columns.forEach((c) => {
      obj[c.header] = c.accessor(row)
    })
    return obj
  })
  exportToCSV(filename, out)
}

/** Mantém compatibilidade com páginas legadas que chamavam downloadCSV. */
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

/**
 * Filtro de período com dois date inputs + presets rápidos.
 * Usa os presets oficiais (Hoje, 7/30 dias, este mês, mês passado, este ano).
 */
export function DateRangeFilter({
  period,
  onChange,
  extra,
  hasFilters,
  onClear,
}: {
  period: Period
  onChange: (p: Period) => void
  extra?: React.ReactNode
  hasFilters?: boolean
  onClear?: () => void
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
            value={period.from}
            onChange={(e) => onChange({ ...period, from: e.target.value })}
            className="h-9 rounded-lg text-sm"
          />
        </div>
        <div>
          <Label className="text-[11px] text-slate-500 mb-1 block">Data final</Label>
          <Input
            type="date"
            value={period.to}
            onChange={(e) => onChange({ ...period, to: e.target.value })}
            className="h-9 rounded-lg text-sm"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {SHORTCUTS.map((s) => (
            <Button
              key={s.id}
              variant="outline"
              size="sm"
              className="h-9 text-xs"
              onClick={() => onChange(shortcutPeriod(s.id))}
            >
              {s.label}
            </Button>
          ))}
        </div>
        {extra}
      </div>
    </div>
  )
}

/**
 * Barra de filtro legada (mantida para não quebrar páginas existentes).
 * Equivalente a DateRangeFilter + atalhos antigos.
 */
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

/** Estado de erro padronizado para os relatórios. */
export function ErrorState({ message }: { message?: string }) {
  return (
    <div className="py-10 text-center">
      <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-red-400" />
      <p className="text-sm text-red-600 font-semibold">Erro ao carregar os dados</p>
      <p className="text-xs text-slate-500 mt-1">
        {message || 'Tente novamente em alguns instantes.'}
      </p>
    </div>
  )
}

/** Skeleton genérico para cards de resumo durante o carregamento. */
export function SummaryCardSkeleton() {
  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2 flex-1">
          <div className="h-3 w-20 bg-slate-200 rounded" />
          <div className="h-5 w-28 bg-slate-200 rounded" />
          <div className="h-2.5 w-16 bg-slate-100 rounded" />
        </div>
        <div className="w-9 h-9 rounded-lg bg-slate-200" />
      </div>
    </div>
  )
}

/** Skeleton para gráficos durante o carregamento. */
export function ChartSkeleton({ height = 240 }: { height?: number }) {
  return <div className="w-full bg-slate-100 rounded-xl animate-pulse" style={{ height }} />
}

export interface ReportColumn<T = any> {
  header: string
  className?: string
  render: (row: T) => React.ReactNode
  /** Acessor para o CSV (quando fornecido). */
  csv?: (row: T) => string | number | null | undefined
  /** Se a coluna participa do total no rodapé. */
  total?: (rows: T[]) => React.ReactNode
}

/**
 * Tabela padronizada de relatório: cabeçalho fixo, corpo com rolagem horizontal,
 * estado vazio, e linha de totais opcional no rodapé.
 */
export function ReportTable<T = any>({
  columns,
  rows,
  emptyMessage = 'Nenhum dado encontrado no período selecionado.',
  emptyIcon = Inbox,
  loading,
  loadingRows = 6,
}: {
  columns: ReportColumn<T>[]
  rows: T[]
  emptyMessage?: string
  emptyIcon?: LucideIcon
  loading?: boolean
  loadingRows?: number
}) {
  const cols: ReportColumn<any>[] = columns
  const hasTotals = cols.some((c) => c.total)
  const r: any[] = rows
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-slate-50 sticky top-0">
            <TableRow>
              {cols.map((c, i) => (
                <TableHead key={i} className={`text-xs uppercase ${c.className || ''}`}>
                  {c.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: loadingRows }).map((_, ri) => (
                <TableRow key={`sk-${ri}`}>
                  {cols.map((_, ci) => (
                    <TableCell key={ci}>
                      <div className="h-4 w-full bg-slate-100 rounded animate-pulse" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : r.length === 0 ? (
              <TableRow>
                <TableCell colSpan={cols.length}>
                  <EmptyState message={emptyMessage} icon={emptyIcon} />
                </TableCell>
              </TableRow>
            ) : (
              r.map((row, ri) => (
                <TableRow key={ri} className="hover:bg-slate-50/60">
                  {cols.map((c, ci) => (
                    <TableCell key={ci} className={c.className || ''}>
                      {c.render(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
          {hasTotals && !loading && r.length > 0 && (
            <tfoot className="bg-slate-50 border-t-2 border-slate-200">
              <tr>
                {cols.map((c, ci) => (
                  <td
                    key={ci}
                    className={`px-3 py-2.5 text-xs font-bold text-slate-800 ${c.className || ''}`}
                  >
                    {c.total ? c.total(r) : ''}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </Table>
      </div>
    </div>
  )
}
