import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  isAppSubdomain,
  isMainDomain,
  getLandingUrl,
  getAppUrl,
  isPreviewOrLocal,
} from '@/lib/domain'

describe('domain utils', () => {
  const originalLocation = window.location

  beforeEach(() => {
    // Mock window.location
    Object.defineProperty(window, 'location', {
      writable: true,
      value: {
        ...originalLocation,
        hostname: 'audicao360.com.br',
        protocol: 'https:',
      },
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation,
    })
  })

  it('detecta domínio principal audicao360.com.br', () => {
    window.location.hostname = 'audicao360.com.br'
    expect(isMainDomain()).toBe(true)
    expect(isAppSubdomain()).toBe(false)
    expect(isPreviewOrLocal()).toBe(false)
    expect(getLandingUrl()).toBe('https://audicao360.com.br')
    expect(getAppUrl('/login')).toBe('https://app.audicao360.com.br/login')
  })

  it('detecta subdomínio app.audicao360.com.br', () => {
    window.location.hostname = 'app.audicao360.com.br'
    expect(isMainDomain()).toBe(false)
    expect(isAppSubdomain()).toBe(true)
    expect(isPreviewOrLocal()).toBe(false)
    expect(getLandingUrl('/landing')).toBe('https://audicao360.com.br/landing')
    expect(getAppUrl('/login')).toBe('https://app.audicao360.com.br/login')
  })

  it('trata preview *.goskip.app como modo app com caminhos relativos', () => {
    window.location.hostname = 'audicao360-preview.goskip.app'
    expect(isMainDomain()).toBe(false)
    expect(isAppSubdomain()).toBe(true)
    expect(isPreviewOrLocal()).toBe(true)
    expect(getAppUrl('/login')).toBe('/login')
    expect(getLandingUrl()).toBe('/landing')
  })

  it('trata localhost como modo app com caminhos relativos', () => {
    window.location.hostname = 'localhost'
    expect(isMainDomain()).toBe(false)
    expect(isAppSubdomain()).toBe(true)
    expect(isPreviewOrLocal()).toBe(true)
    expect(getAppUrl('/cadastro')).toBe('/cadastro')
  })
})
