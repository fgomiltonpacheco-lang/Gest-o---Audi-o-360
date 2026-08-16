import pb from '@/lib/pocketbase/client'

// Constrói a URL pública do avatar do usuário no PocketBase.
// Retorna null quando não há avatar salvo (caller mostra iniciais).
export function getAvatarUrl(
  user: { id: string; avatar?: string } | null | undefined,
): string | null {
  if (!user?.id || !user?.avatar) return null
  return `${pb.baseUrl}/api/files/users/${user.id}/${user.avatar}`
}

// Formatador de Moeda Real Brasileiro
export function formatCurrency(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

// Formatador de Data: YYYY-MM-DD para DD/MM/AAAA
export function formatDate(dateString: string | undefined | null): string {
  if (!dateString) return '—'
  const cleanDate = dateString.split('T')[0]
  const parts = cleanDate.split('-')
  if (parts.length === 3) {
    const [year, month, day] = parts
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`
  }
  return dateString
}

// Data por extenso para o header (ex: "segunda-feira, 10 de fevereiro de 2025")
export function formatDateFullExtensive(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d)
}

// Saudação dinâmica por horário
export function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return 'Bom dia'
  if (hour >= 12 && hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

// Cálculo automático de idade a partir de YYYY-MM-DD
export function calculateAge(birthDateString: string | undefined | null): number | null {
  if (!birthDateString) return null
  const birth = new Date(birthDateString)
  if (isNaN(birth.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return age >= 0 ? age : null
}

// Máscara e validação de CPF
export function maskCPF(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`
}

export function validateCPF(cpf: string): boolean {
  const clean = cpf.replace(/\D/g, '')
  if (clean.length !== 11) return false
  if (/^(\d)\1{10}$/.test(clean)) return false

  let sum = 0
  let rest: number

  for (let i = 1; i <= 9; i++) {
    sum += parseInt(clean.substring(i - 1, i), 10) * (11 - i)
  }
  rest = (sum * 10) % 11
  if (rest === 10 || rest === 11) rest = 0
  if (rest !== parseInt(clean.substring(9, 10), 10)) return false

  sum = 0
  for (let i = 1; i <= 10; i++) {
    sum += parseInt(clean.substring(i - 1, i), 10) * (12 - i)
  }
  rest = (sum * 10) % 11
  if (rest === 10 || rest === 11) rest = 0
  if (rest !== parseInt(clean.substring(10, 11), 10)) return false

  return true
}

// Máscara de Telefone/Celular
export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`
}

// Máscara de CEP
export function maskCEP(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 5) return digits
  return `${digits.slice(0, 5)}-${digits.slice(5, 8)}`
}

// Cores dos 10 tipos de atendimento
export const APPOINTMENT_TYPE_COLORS: Record<
  string,
  { bg: string; text: string; border: string; hex: string }
> = {
  'Avaliação auditiva': {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    hex: '#2563eb',
  },
  Audiometria: {
    bg: 'bg-cyan-50',
    text: 'text-cyan-700',
    border: 'border-cyan-200',
    hex: '#06b6d4',
  },
  Imitanciometria: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    hex: '#10b981',
  },
  Logoaudiometria: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    hex: '#8b5cf6',
  },
  BERA: { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200', hex: '#ec4899' },
  'Adaptação de aparelho': {
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-200',
    hex: '#f97316',
  },
  'Retorno/ajuste': {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    hex: '#eab308',
  },
  Manutenção: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', hex: '#ef4444' },
  'Entrega de aparelho': {
    bg: 'bg-teal-50',
    text: 'text-teal-700',
    border: 'border-teal-200',
    hex: '#14b8a6',
  },
  Orientação: {
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
    hex: '#6366f1',
  },
}

// Iniciais do nome para Avatar
export function getInitials(name: string): string {
  if (!name) return 'A'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// Cores para os avatares com base no hash do nome
const AVATAR_COLORS = [
  'bg-blue-600',
  'bg-indigo-600',
  'bg-sky-600',
  'bg-teal-600',
  'bg-cyan-600',
  'bg-blue-700',
]

export function getAvatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length
  return AVATAR_COLORS[index]
}

// Exportação rápida de dados para CSV
export function exportToCSV(filename: string, rows: Record<string, any>[]) {
  if (!rows || !rows.length) return
  const separator = ';'
  const keys = Object.keys(rows[0])
  const csvContent =
    '\uFEFF' + // UTF-8 BOM
    keys.join(separator) +
    '\n' +
    rows
      .map((row) => {
        return keys
          .map((k) => {
            let cell = row[k] === null || row[k] === undefined ? '' : String(row[k])
            cell = cell.replace(/"/g, '""')
            if (cell.search(/("|,|;|\n)/g) >= 0) {
              cell = `"${cell}"`
            }
            return cell
          })
          .join(separator)
      })
      .join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
