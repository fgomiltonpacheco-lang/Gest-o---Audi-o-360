/**
 * Utilitários de detecção e manipulação de domínio para Audição360.
 *
 * Estrutura:
 * - audicao360.com.br (domínio raiz) -> Landing Page pública
 * - app.audicao360.com.br (subdomínio) -> Login / Dashboard do sistema
 * - *.goskip.app (ambiente de preview do Skip) -> Tratar como "modo app" padrão
 * - localhost / 127.0.0.1 (desenvolvimento local) -> Tratar como "modo app" padrão
 */

export const MAIN_DOMAIN = 'audicao360.com.br'
export const APP_SUBDOMAIN = 'app.audicao360.com.br'

/**
 * Retorna o hostname atual de forma segura mesmo em SSR/testes.
 */
export function getHostname(): string {
  if (typeof window === 'undefined' || !window.location) {
    return ''
  }
  return (window.location.hostname || '').toLowerCase()
}

/**
 * Retorna o protocolo atual (ex: https: ou http:).
 */
export function getProtocol(): string {
  if (typeof window === 'undefined' || !window.location || !window.location.protocol) {
    return 'https:'
  }
  return window.location.protocol
}

/**
 * Retorna `true` se estamos em ambiente de preview (*.goskip.app) ou desenvolvimento local.
 */
export function isPreviewOrLocal(): boolean {
  const host = getHostname()
  return (
    host.endsWith('.goskip.app') ||
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.endsWith('.local')
  )
}

/**
 * Retorna `true` se window.location.hostname começa com `app.` OU se estamos no preview do Skip (*.goskip.app) / localhost.
 * No preview/local, o comportamento padrão é "app mode".
 */
export function isAppSubdomain(): boolean {
  const host = getHostname()
  if (isPreviewOrLocal()) {
    return true
  }
  return host.startsWith('app.')
}

/**
 * Retorna `true` se é o domínio principal (audicao360.com.br ou www.audicao360.com.br) SEM o prefixo app.
 * Retorna `false` em preview/local ou quando está no subdomínio app.
 */
export function isMainDomain(): boolean {
  const host = getHostname()
  if (isPreviewOrLocal()) {
    return false
  }
  return (
    (host === MAIN_DOMAIN || host === `www.${MAIN_DOMAIN}` || host.endsWith(`.${MAIN_DOMAIN}`)) &&
    !host.startsWith('app.')
  )
}

/**
 * Retorna a URL completa da landing page (protocolo + domínio principal).
 * Ex: `https://audicao360.com.br` ou caminho relativo em preview/local quando preferido.
 */
export function getLandingUrl(path: string = ''): string {
  const cleanPath = path ? (path.startsWith('/') ? path : `/${path}`) : ''
  if (isPreviewOrLocal()) {
    return cleanPath || '/landing'
  }
  const protocol = getProtocol()
  return `${protocol}//${MAIN_DOMAIN}${cleanPath}`
}

/**
 * Retorna a URL completa do app (protocolo + app. domínio).
 * Ex: `https://app.audicao360.com.br/login`
 * No preview (*.goskip.app) ou localhost, retorna o path relativo (ex: `/login`) para manter navegação interna.
 */
export function getAppUrl(path: string = ''): string {
  const cleanPath = path ? (path.startsWith('/') ? path : `/${path}`) : ''
  if (isPreviewOrLocal()) {
    return cleanPath || '/'
  }
  const protocol = getProtocol()
  return `${protocol}//${APP_SUBDOMAIN}${cleanPath}`
}
