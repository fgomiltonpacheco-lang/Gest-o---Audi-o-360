// Feriados nacionais brasileiros (fixos + móveis).

export interface Holiday {
  /** Data no formato "MM-DD" (mês-dia) para feriados fixos. */
  date: string
  name: string
  /** true = data fixa, false = data móvel (calculada a partir da Páscoa). */
  fixed: boolean
}

export const NATIONAL_HOLIDAYS: Holiday[] = [
  { date: '01-01', name: 'Confraternização Universal', fixed: true },
  { date: '04-21', name: 'Tiradentes', fixed: true },
  { date: '05-01', name: 'Dia do Trabalho', fixed: true },
  { date: '09-07', name: 'Independência do Brasil', fixed: true },
  { date: '10-12', name: 'Nossa Senhora Aparecida', fixed: true },
  { date: '11-02', name: 'Finados', fixed: true },
  { date: '11-15', name: 'Proclamação da República', fixed: true },
  { date: '12-25', name: 'Natal', fixed: true },
]

/**
 * Calcula o domingo de Páscoa para um ano usando o algoritmo de Gauss
 * (versão para anos entre 1900 e 2099). Retorna um objeto Date (UTC) da Páscoa.
 */
function easterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) // 3 = março, 4 = abril
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(Date.UTC(year, month - 1, day))
}

/** Soma (ou subtrai) dias a uma data, retornando nova Date em UTC. */
function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

/** Formata uma Date (UTC) como "YYYY-MM-DD". */
function toDateStr(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Retorna todos os feriados nacionais (fixos + móveis) para o ano informado,
 * já formatados como "YYYY-MM-DD".
 */
export function getYearHolidays(year: number): { date: string; name: string }[] {
  const list: { date: string; name: string }[] = []

  // Feriados fixos
  for (const h of NATIONAL_HOLIDAYS) {
    const [mm, dd] = h.date.split('-')
    list.push({ date: `${year}-${mm}-${dd}`, name: h.name })
  }

  // Feriados móveis derivados da Páscoa
  const easter = easterSunday(year)
  list.push({ date: toDateStr(addDays(easter, -47)), name: 'Carnaval' })
  list.push({ date: toDateStr(addDays(easter, -2)), name: 'Sexta-feira Santa' })
  list.push({ date: toDateStr(easter), name: 'Páscoa' })
  list.push({ date: toDateStr(addDays(easter, 60)), name: 'Corpus Christi' })

  return list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

/**
 * Retorna o feriado (se houver) para uma data no formato "YYYY-MM-DD".
 */
export function getHolidayOnDate(dateStr: string): { date: string; name: string } | undefined {
  if (!dateStr) return undefined
  const year = Number(dateStr.slice(0, 4))
  if (!year || isNaN(year)) return undefined
  return getYearHolidays(year).find((h) => h.date === dateStr)
}
