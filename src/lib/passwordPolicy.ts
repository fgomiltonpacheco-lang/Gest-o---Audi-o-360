// src/lib/passwordPolicy.ts
// Política de senha e validação de senhas comuns.

export interface PasswordChecks {
  minLength: boolean
  hasUpper: boolean
  hasLower: boolean
  hasNumber: boolean
  hasSpecial: boolean
}

export interface PasswordValidation {
  valid: boolean
  checks: PasswordChecks
  errors: string[]
}

const SPECIAL_CHARS = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/

/**
 * Lista das 50 senhas mais comuns (em minúsculas) para bloqueio.
 * Fonte: listas públicas de senhas vazadas (tipo RockYou / SplashData).
 */
const COMMON_PASSWORDS = new Set<string>([
  '123456',
  '123456789',
  '12345678',
  '1234567',
  '1234567890',
  '12345',
  '111111',
  '123456a',
  'qwerty',
  'password',
  'senha',
  'abc123',
  '000000',
  '123123',
  '1q2w3e4r',
  'iloveyou',
  '654321',
  '666666',
  '121212',
  '123321',
  '555555',
  '777777',
  'admin',
  'administrator',
  'root',
  'welcome',
  'login',
  'master',
  'letmein',
  'football',
  'baseball',
  'soccer',
  'monkey',
  'shadow',
  'sunshine',
  'superman',
  'batman',
  'trustno1',
  'dragon',
  'michael',
  'jordan',
  'harley',
  'ranger',
  'secret',
  'mustang',
  'access',
  'diamond',
  'passw0rd',
  'qazwsx',
  'zxcvbn',
])

export function isCommonPassword(password: string): boolean {
  if (!password) return false
  return COMMON_PASSWORDS.has(password.toLowerCase())
}

/**
 * Valida a senha contra a política mínima:
 *  - mínimo de `minLength` caracteres (default 8)
 *  - ao menos 1 letra maiúscula
 *  - ao menos 1 letra minúscula
 *  - ao menos 1 número
 *  - ao menos 1 caractere especial
 *  - não pode ser uma senha comum
 */
export function validatePassword(password: string, minLength = 8): PasswordValidation {
  const checks: PasswordChecks = {
    minLength: password.length >= minLength,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: SPECIAL_CHARS.test(password),
  }

  const errors: string[] = []
  if (!checks.minLength) errors.push(`A senha deve ter pelo menos ${minLength} caracteres.`)
  if (!checks.hasUpper) errors.push('A senha deve conter ao menos uma letra maiúscula.')
  if (!checks.hasLower) errors.push('A senha deve conter ao menos uma letra minúscula.')
  if (!checks.hasNumber) errors.push('A senha deve conter ao menos um número.')
  if (!checks.hasSpecial) errors.push('A senha deve conter ao menos um caractere especial.')
  if (isCommonPassword(password)) {
    errors.push('Esta senha é muito comum e não pode ser usada.')
  }

  const valid =
    checks.minLength &&
    checks.hasUpper &&
    checks.hasLower &&
    checks.hasNumber &&
    checks.hasSpecial &&
    !isCommonPassword(password)

  return { valid, checks, errors }
}
