// src/lib/twoFactor.ts
// Utilitários de autenticação de dois fatores (TOTP) e códigos de backup.

import { authenticator, totp } from 'otplib'

// Janela de 1 token antes/depois para tolerância de relógio.
totp.options = { window: 1, step: 30 }
authenticator.options = { window: 1, step: 30 }

/**
 * Gera um novo segredo TOTP (base32) para o usuário.
 */
export function generateSecret(): string {
  return authenticator.generateSecret()
}

/**
 * Monta a URI otpauth:// para o QR code (formato Google Authenticator).
 */
export function generateOtpAuthUri(secret: string, email: string, issuer = 'Audição360'): string {
  return authenticator.keyuri(email, issuer, secret)
}

/**
 * Gera a URL do QR code (otpauth://) — alias usado pelos componentes.
 */
export function generateQrCodeUrl(secret: string, email: string, issuer = 'Audição360'): string {
  return generateOtpAuthUri(secret, email, issuer)
}

/**
 * Verifica um token TOTP (6 dígitos) contra o segredo informado.
 * Aceita 1 step de tolerância (±30s).
 */
export function verifyToken(secret: string, token: string): boolean {
  if (!secret || !token) return false
  const clean = token.replace(/\s+/g, '').trim()
  if (!/^\d{6}$/.test(clean)) return false
  try {
    return authenticator.verify({ token: clean, secret })
  } catch {
    return false
  }
}

/**
 * Gera `count` códigos de backup hexadecimais de 8 caracteres.
 * Retorna o array de códigos em texto plano (para exibir ao usuário uma única vez).
 */
export function generateBackupCodes(count = 10): string[] {
  const codes: string[] = []
  const seen = new Set<string>()
  while (codes.length < count) {
    const hex = Array.from({ length: 4 }, () =>
      Math.floor(Math.random() * 0xffff)
        .toString(16)
        .padStart(4, '0'),
    ).join('')
    if (seen.has(hex)) continue
    seen.add(hex)
    codes.push(hex.toUpperCase())
  }
  return codes
}

/**
 * Calcula o hash SHA-256 de um código (para armazenar apenas o hash no banco).
 * Retorna um hex string.
 */
export async function hashBackupCode(code: string): Promise<string> {
  const data = new TextEncoder().encode(code.toUpperCase().trim())
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Verifica um código de backup digitado contra uma lista de hashes SHA-256.
 * Retorna true se algum hash bate.
 */
export async function verifyBackupCode(code: string, hashedCodes: string[]): Promise<boolean> {
  if (!code || !hashedCodes || hashedCodes.length === 0) return false
  const hash = await hashBackupCode(code)
  return hashedCodes.includes(hash)
}
