// src/components/PasswordChecklist.tsx
// Checklist visual em tempo real dos requisitos de senha.
import React from 'react'
import { Check, X } from 'lucide-react'
import { validatePassword, type PasswordChecks } from '@/lib/passwordPolicy'
import { cn } from '@/lib/utils'

interface PasswordChecklistProps {
  password: string
  minLength?: number
  className?: string
}

const ITEMS: { key: keyof PasswordChecks; label: string }[] = [
  { key: 'minLength', label: 'Tamanho mínimo' },
  { key: 'hasUpper', label: 'Letra maiúscula' },
  { key: 'hasLower', label: 'Letra minúscula' },
  { key: 'hasNumber', label: 'Número' },
  { key: 'hasSpecial', label: 'Caractere especial' },
]

export const PasswordChecklist: React.FC<PasswordChecklistProps> = ({
  password,
  minLength = 8,
  className,
}) => {
  const { checks } = validatePassword(password, minLength)
  const dirty = password.length > 0

  return (
    <div className={cn('rounded-xl border border-slate-200 bg-slate-50/60 p-3', className)}>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
        Requisitos da senha
      </p>
      <ul className="space-y-1.5">
        {ITEMS.map(({ key, label }) => {
          const ok = checks[key]
          const text = key === 'minLength' ? `${label} (${minLength} caracteres)` : label
          return (
            <li key={key} className="flex items-center gap-2 text-xs">
              <span
                className={cn(
                  'flex h-4 w-4 items-center justify-center rounded-full shrink-0',
                  dirty
                    ? ok
                      ? 'bg-emerald-100 text-emerald-600'
                      : 'bg-red-100 text-red-500'
                    : 'bg-slate-200 text-slate-400',
                )}
              >
                {dirty ? ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" /> : null}
              </span>
              <span
                className={cn(
                  'font-medium',
                  dirty ? (ok ? 'text-emerald-700' : 'text-slate-600') : 'text-slate-400',
                )}
              >
                {text}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default PasswordChecklist
