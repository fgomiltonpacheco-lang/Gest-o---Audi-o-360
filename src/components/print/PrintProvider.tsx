import React, { createContext, useContext, useState, useCallback, useRef } from 'react'
import logoImg from '@/assets/audicao-360-logo-para-papel-timbrado-da364.png'

export interface PrintContent {
  title: string
  subtitle?: string
  /** Nó renderizado dentro do layout impresso (cabeçalho/rodapé são automáticos) */
  body: React.ReactNode
}

interface PrintContextValue {
  /** Imprime o conteúdo fornecido. O nó é montado, espera um tick e dispara window.print(). */
  print: (content: PrintContent) => void
  /** Conteúdo atualmente montado na área de impressão */
  current: PrintContent | null
  /** Limpa a área de impressão (após o diálogo fechar) */
  clear: () => void
}

const PrintContext = createContext<PrintContextValue | null>(null)

export function PrintProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<PrintContent | null>(null)
  const cleanupTimer = useRef<number | null>(null)

  const clear = useCallback(() => {
    if (cleanupTimer.current) {
      window.clearTimeout(cleanupTimer.current)
      cleanupTimer.current = null
    }
    setCurrent(null)
  }, [])

  const print = useCallback((content: PrintContent) => {
    // Limpa timer anterior pendente, se houver
    if (cleanupTimer.current) {
      window.clearTimeout(cleanupTimer.current)
      cleanupTimer.current = null
    }

    setCurrent(content)

    // Espera o React pintar o #print-root antes de abrir o diálogo
    const raf = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.print()
        // Limpa a área logo após o diálogo fechar
        cleanupTimer.current = window.setTimeout(() => {
          setCurrent(null)
          cleanupTimer.current = null
        }, 300)
      })
    })
    // Fallback de segurança: caso o raf não dispare (raro), limpa após 60s
    void raf
  }, [])

  return (
    <PrintContext.Provider value={{ print, current, clear }}>
      {children}
      <PrintPortal content={current} />
    </PrintContext.Provider>
  )
}

/** Portal fixo no body que só aparece durante a impressão */
function PrintPortal({ content }: { content: PrintContent | null }) {
  if (!content) return null
  return (
    <div id="print-root" aria-hidden>
      <PrintLayout title={content.title} subtitle={content.subtitle}>
        {content.body}
      </PrintLayout>
    </div>
  )
}

/** Layout padrão: logo + cabeçalho "Audição360 — Centro Auditivo" e rodapé com data */
function PrintLayout({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  const today = new Date().toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="font-sans text-slate-800" style={{ fontFamily: 'Roboto, sans-serif' }}>
      {/* Cabeçalho */}
      <div
        className="flex items-center justify-between border-b-2 border-navy-700 pb-3 mb-5"
        style={{ borderBottom: '2px solid #0F2B5C' }}
      >
        <div className="flex items-center gap-4">
          <div className="w-52 h-16 flex items-center justify-center shrink-0">
            <img
              src={logoImg}
              alt="Audição360"
              className="max-h-full max-w-full object-contain mx-auto"
            />
          </div>
          <div>
            <h1
              className="text-lg font-extrabold leading-tight"
              style={{ fontSize: '15pt', color: '#0F2B5C', fontWeight: 800 }}
            >
              Audição360 — Centro Auditivo
            </h1>
            <p className="text-xs text-slate-500" style={{ fontSize: '9pt' }}>
              Gestão Clínica Integrada • Fonoaudiologia
            </p>
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-base font-bold" style={{ fontSize: '13pt', color: '#1e293b' }}>
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs text-slate-500" style={{ fontSize: '9pt' }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Conteúdo do documento */}
      <div className="print-body">{children}</div>

      {/* Rodapé */}
      <div
        className="mt-8 pt-3 border-t border-slate-300 flex items-center justify-between text-[9pt] text-slate-500"
        style={{
          marginTop: '32px',
          paddingTop: '10px',
          borderTop: '1px solid #cbd5e1',
          fontSize: '9pt',
          color: '#64748b',
        }}
      >
        <span>Documento gerado pelo sistema Audição360</span>
        <span>Data de emissão: {today}</span>
      </div>
    </div>
  )
}

export function usePrint(): PrintContextValue {
  const ctx = useContext(PrintContext)
  if (!ctx) {
    throw new Error('usePrint deve ser usado dentro de <PrintProvider>')
  }
  return ctx
}
