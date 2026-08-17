// src/lib/twoFactor.ts
// Utilitários de autenticação de dois fatores (TOTP) e códigos de backup.
//
// IMPORTANTE: NÃO depende do pacote `otplib` nem do `crypto` do Node.
// O `otplib` puxa `@otplib/plugin-crypto`, que importa o módulo Node
// `crypto` — quando o bundle do navegador o encontra, o Vite externaliza
// `crypto` e o build do preview quebra. Esta implementação usa apenas a
// Web Crypto API (`crypto.subtle`), disponível nativamente no navegador,
// e implementa o RFC 6238 (TOTP) / RFC 4226 (HOTP) manualmente.

const STEP = 30 // segundos por token
const WINDOW = 1 // tolerância de ±1 step (±30s)
const DIGITS = 6
const ALGORITHM = 'SHA-1'

/**
 * Decodifica uma string Base32 (RFC 4648) para um Uint8Array.
 * Aceita segredos no formato retornado por apps autenticadores.
 */
export function base32Decode(input: string): Uint8Array {
  const cleaned = input.replace(/=+$/, '').replace(/\s+/g, '').toUpperCase()
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const lookup = new Map<string, number>()
  for (let i = 0; i < charset.length; i++) lookup.set(charset[i], i)

  let bits = 0
  let value = 0
  const output: number[] = []
  for (const ch of cleaned) {
    const idx = lookup.get(ch)
    if (idx === undefined) continue // ignora caracteres inválidos
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      bits -= 8
      output.push((value >>> bits) & 0xff)
    }
  }
  return new Uint8Array(output)
}

/**
 * Codifica um Uint8Array para Base32 (RFC 4648, sem padding).
 */
function base32Encode(bytes: Uint8Array): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = 0
  let value = 0
  let output = ''
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i]
    bits += 8
    while (bits >= 5) {
      bits -= 5
      output += charset[(value >>> bits) & 0x1f]
    }
  }
  if (bits > 0) {
    output += charset[(value << (5 - bits)) & 0x1f]
  }
  return output
}

/**
 * Gera um array de bytes aleatórios usando a Web Crypto API.
 */
function randomBytes(length: number): Uint8Array {
  const arr = new Uint8Array(length)
  crypto.getRandomValues(arr)
  return arr
}

/**
 * Calcula o contador de tempo (T) para um instante, em número de steps.
 */
function timeCounter(timestampMs: number, step: number): bigint {
  // Usa BigInt porque o contador pode exceder 32 bits em timestamps altos.
  return BigInt(Math.floor(timestampMs / 1000 / step))
}

/**
 * Converte um BigInt em Uint8Array de 8 bytes (big-endian).
 */
function bigIntTo8Bytes(n: bigint): Uint8Array {
  const buf = new Uint8Array(8)
  let v = n
  for (let i = 7; i >= 0; i--) {
    buf[i] = Number(v & 0xffn)
    v >>= 8n
  }
  return buf
}

/**
 * Calcula HMAC do `message` com a `key` usando o algoritmo informado.
 * Retorna o digest como Uint8Array.
 */
async function hmac(algorithm: string, key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key as BufferSource,
    { name: 'HMAC', hash: { name: algorithm } },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, message as BufferSource)
  return new Uint8Array(sig)
}

/**
 * Implementa o truncamento dinâmico (RFC 4226) sobre o HMAC e retorna
 * o código HOTP como número inteiro de `digits` dígitos.
 */
function dynamicTruncate(hmacBytes: Uint8Array, digits: number): string {
  const offset = hmacBytes[hmacBytes.length - 1] & 0x0f
  const binary =
    ((hmacBytes[offset] & 0x7f) << 24) |
    ((hmacBytes[offset + 1] & 0xff) << 16) |
    ((hmacBytes[offset + 2] & 0xff) << 8) |
    (hmacBytes[offset + 3] & 0xff)
  const code = binary % Math.pow(10, digits)
  return code.toString().padStart(digits, '0')
}

/**
 * Gera um token TOTP (6 dígitos) para um segredo Base32 num instante.
 */
export async function generateTOTP(
  secretBase32: string,
  timestampMs: number = Date.now(),
  step: number = STEP,
  digits: number = DIGITS,
): Promise<string> {
  const key = base32Decode(secretBase32)
  const counter = timeCounter(timestampMs, step)
  const message = bigIntTo8Bytes(counter)
  const digest = await hmac(ALGORITHM, key, message)
  return dynamicTruncate(digest, digits)
}

/**
 * Gera um novo segredo TOTP (Base32, 20 bytes = 160 bits) para o usuário.
 */
export function generateSecret(): string {
  return base32Encode(randomBytes(20))
}

/**
 * Monta a URI otpauth:// para o QR code (formato Google Authenticator).
 */
export function generateOtpAuthUri(secret: string, email: string, issuer = 'Audição360'): string {
  const issuerEnc = encodeURIComponent(issuer)
  const emailEnc = encodeURIComponent(email)
  const secretClean = secret.replace(/\s+/g, '').toUpperCase()
  return `otpauth://totp/${issuerEnc}:${emailEnc}?secret=${secretClean}&issuer=${issuerEnc}&algorithm=SHA1&digits=${DIGITS}&period=${STEP}`
}

/**
 * Gera a URL do QR code (otpauth://) — alias usado pelos componentes.
 */
export function generateQrCodeUrl(secret: string, email: string, issuer = 'Audição360'): string {
  return generateOtpAuthUri(secret, email, issuer)
}

/**
 * Verifica um token TOTP (6 dígitos) contra o segredo informado.
 * Aceita `window` steps de tolerância (±30s por padrão).
 *
 * Função assíncrona pois usa a Web Crypto API.
 */
export async function verifyToken(secret: string, token: string): Promise<boolean> {
  if (!secret || !token) return false
  const clean = token.replace(/\s+/g, '').trim()
  if (!/^\d{6}$/.test(clean)) return false
  try {
    const now = Date.now()
    // Verifica o step atual e ±window steps para tolerância de relógio.
    for (let offset = -WINDOW; offset <= WINDOW; offset++) {
      const ts = now + offset * STEP * 1000
      const expected = await generateTOTP(secret, ts)
      // Comparação em tempo constante para evitar timing attacks.
      if (timingSafeEqual(clean, expected)) return true
    }
    return false
  } catch {
    return false
  }
}

/** Comparação de strings em tempo constante. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
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
