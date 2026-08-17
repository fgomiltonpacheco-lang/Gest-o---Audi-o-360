// TemplateRenderer.tsx — Renderiza um modelo de laudo (estrutura_layout) em React.
// Usado tanto na prévia em tela quanto na geração de PDF (via window.print).
import React from 'react'
import type { ExamReportTemplate, LayoutElement, LayoutElementStyle } from '@/types'
import { AudiogramaSVG } from './AudiogramaSVG'
import type { AudiogramMap } from '@/types'

export interface TemplateDataContext {
  paciente?: {
    nome?: string
    cpf?: string
    data_nascimento?: string
    idade?: string
    sexo?: string
    telefone?: string
    endereco?: string
    convenio?: string
    prontuario?: string
  }
  exame?: Record<string, unknown>
  profissional?: { nome?: string; crfa?: string }
  clinica?: { nome?: string; endereco?: string; telefone?: string; email?: string }
}

const MM_PER_PX = 3.7795275591 // 1mm ≈ 3.78px @96dpi

export function mmToPx(mm: number): number {
  return mm * MM_PER_PX
}

/** Resolve tokens {{paciente.nome}} dentro de uma string usando o contexto. */
export function resolveTokens(text: string, ctx: TemplateDataContext): string {
  if (!text) return ''
  return text.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_m, key: string) => {
    const k = key.trim()
    const parts = k.split('.')
    let cur: unknown = ctx
    for (const p of parts) {
      if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[p]
      } else {
        cur = undefined
        break
      }
    }
    if (cur === undefined || cur === null || cur === '') return '—'
    return String(cur)
  })
}

function styleToCss(style?: LayoutElementStyle): React.CSSProperties {
  if (!style) return {}
  const css: React.CSSProperties = {}
  if (style.fontFamily) css.fontFamily = style.fontFamily
  if (style.fontSize) css.fontSize = `${style.fontSize}pt`
  if (style.bold) css.fontWeight = 'bold'
  if (style.italic) css.fontStyle = 'italic'
  if (style.underline) css.textDecoration = 'underline'
  if (style.align) css.textAlign = style.align
  if (style.color) css.color = style.color
  if (style.backgroundColor) css.backgroundColor = style.backgroundColor
  if (style.borderColor && style.borderWidth) {
    css.border = `${style.borderWidth}px solid ${style.borderColor}`
  }
  if (style.padding) css.padding = `${style.padding}px`
  if (style.lineHeight) css.lineHeight = style.lineHeight
  return css
}

// ===== Elementos individuais =====

function TemplateText({ el, ctx }: { el: LayoutElement; ctx: TemplateDataContext }) {
  const content = el.props?.content || ''
  const resolved = el.props?.contentType === 'dynamic' ? resolveTokens(content, ctx) : content
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        ...styleToCss(el.style),
      }}
    >
      {resolved}
    </div>
  )
}

function TemplateField({ el, ctx }: { el: LayoutElement; ctx: TemplateDataContext }) {
  const path = el.props?.fieldPath || ''
  const value = resolveTokens(`{{${path}}}`, ctx)
  const fallback = el.props?.fallback || '—'
  const showLabel = el.props?.showLabel !== false
  const label = el.props?.label || el.label
  const display = value === '—' ? fallback : value
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        ...styleToCss(el.style),
      }}
    >
      {showLabel && <span style={{ fontWeight: 'bold' }}>{label}: </span>}
      <span>{display}</span>
    </div>
  )
}

function TemplateImage({ el }: { el: LayoutElement }) {
  const src = el.props?.src || ''
  const resolved = src === 'logo_clinica' ? '' : src
  return (
    <img
      src={resolved}
      alt=""
      style={{
        width: '100%',
        height: '100%',
        objectFit: el.props?.fit || 'contain',
        opacity: el.props?.opacity ?? 1,
        display: 'block',
      }}
    />
  )
}

function TemplateLine({ el }: { el: LayoutElement }) {
  const dir = el.props?.direction || 'horizontal'
  const color = el.props?.color || '#1E3A8A'
  const thickness = el.props?.thickness || 1
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: dir === 'horizontal' ? '100%' : `${thickness}px`,
          height: dir === 'horizontal' ? `${thickness}px` : '100%',
          backgroundColor: color,
        }}
      />
    </div>
  )
}

function TemplateRectangle({ el }: { el: LayoutElement }) {
  const s = el.style || {}
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        border: `${s.borderWidth || 1}px solid ${s.borderColor || '#1E3A8A'}`,
        backgroundColor: s.backgroundColor || 'transparent',
      }}
    />
  )
}

function TemplateTable({ el, ctx }: { el: LayoutElement; ctx: TemplateDataContext }) {
  const columns = el.props?.columns || []
  const rows = el.props?.rows || []
  const fontSize = el.props?.fontSize || 8
  const headerBg = el.props?.headerBgColor || '#F2F4F7'
  const altRow = el.props?.alternateRowColor || '#FAFBFC'
  const borderColor = el.props?.borderColor || '#E2E8F0'

  const renderCell = (val: unknown): string => {
    if (val === undefined || val === null) return ''
    if (typeof val === 'string') return resolveTokens(val, ctx)
    return String(val)
  }

  return (
    <table
      style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: `${fontSize}pt`,
        tableLayout: 'fixed',
      }}
    >
      <thead>
        <tr>
          {columns.map((c, i) => (
            <th
              key={i}
              style={{
                border: `1px solid ${borderColor}`,
                background: headerBg,
                padding: '2px 4px',
                textAlign: 'left',
                width: c.width ? `${c.width}px` : undefined,
              }}
            >
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => (
          <tr key={ri} style={{ background: ri % 2 === 1 ? altRow : 'transparent' }}>
            {columns.map((c, ci) => (
              <td key={ci} style={{ border: `1px solid ${borderColor}`, padding: '2px 4px' }}>
                {renderCell((row as Record<string, unknown>)?.[c.field])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function TemplateAudiogram({ el, ctx }: { el: LayoutElement; ctx: TemplateDataContext }) {
  const exame = (ctx.exame || {}) as Record<string, unknown>
  const airOD = (exame.air_od as AudiogramMap) || {}
  const airOE = (exame.air_oe as AudiogramMap) || {}
  const boneOD = (exame.bone_od as AudiogramMap) || {}
  const boneOE = (exame.bone_oe as AudiogramMap) || {}
  const mode = el.props?.mode || 'combined'

  const renderSide = (label: string, od: boolean, oe: boolean) => (
    <div style={{ width: '100%', height: '100%' }}>
      {label && (
        <div style={{ fontSize: '8pt', textAlign: 'center', marginBottom: 2 }}>{label}</div>
      )}
      <AudiogramaSVG
        airOD={od ? airOD : {}}
        airOE={oe ? airOE : {}}
        boneOD={od ? boneOD : {}}
        boneOE={oe ? boneOE : {}}
      />
    </div>
  )

  if (mode === 'side_by_side') {
    return (
      <div style={{ display: 'flex', gap: 8, width: '100%', height: '100%' }}>
        <div style={{ flex: 1 }}>{renderSide('OD', true, false)}</div>
        <div style={{ flex: 1 }}>{renderSide('OE', false, true)}</div>
      </div>
    )
  }
  if (mode === 'od_only') return renderSide('OD', true, false)
  if (mode === 'oe_only') return renderSide('OE', false, true)
  return renderSide('', true, true)
}

function TemplateTimpanogram({ el, ctx }: { el: LayoutElement; ctx: TemplateDataContext }) {
  const exame = (ctx.exame || {}) as Record<string, unknown>
  // Dados de timpanometria podem vir em formats variados; desenhamos curva tipo A genérica
  const odCurve = (exame.tipo_curva_od as string) || (exame.timpanometria_od as string) || 'A'
  const oeCurve = (exame.tipo_curva_oe as string) || (exame.timpanometria_oe as string) || 'A'
  const odColor = el.props?.odColor || '#DC2626'
  const oeColor = el.props?.oeColor || '#2563EB'
  const mode = el.props?.mode || 'combined'

  // Curva simples (parábola) centrada em 0 daPa para tipo A, deslocada para C
  const curvePath = (type: string, color: string, offset: number) => {
    const peak = type === 'C' ? -100 : 0
    const amp = type === 'B' ? 0.2 : 1
    const pts: string[] = []
    for (let p = -300; p <= 200; p += 10) {
      const x = 30 + ((p + 300) / 500) * 240 + offset
      const y = 60 - amp * 45 * Math.exp(-Math.pow((p - peak) / 80, 2))
      pts.push(`${pts.length === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`)
    }
    return <path d={pts.join(' ')} fill="none" stroke={color} strokeWidth={1.5} />
  }

  const renderSide = (label: string, type: string, color: string) => (
    <div style={{ width: '100%', height: '100%' }}>
      {label && (
        <div style={{ fontSize: '8pt', textAlign: 'center', marginBottom: 2 }}>{label}</div>
      )}
      <svg viewBox="0 0 300 90" width="100%" height="100%" style={{ display: 'block' }}>
        <line x1={30} y1={75} x2={270} y2={75} stroke="#94a3b8" strokeWidth={1} />
        <line
          x1={150}
          y1={15}
          x2={150}
          y2={75}
          stroke="#94a3b8"
          strokeWidth={0.6}
          strokeDasharray="3 3"
        />
        <text x={150} y={86} textAnchor="middle" fontSize="7" fill="#475569">
          daPa
        </text>
        <text
          x={10}
          y={45}
          textAnchor="middle"
          fontSize="7"
          fill="#475569"
          transform="rotate(-90 10 45)"
        >
          ml
        </text>
        {curvePath(type, color, 0)}
      </svg>
    </div>
  )

  if (mode === 'side_by_side') {
    return (
      <div style={{ display: 'flex', gap: 8, width: '100%', height: '100%' }}>
        <div style={{ flex: 1 }}>{renderSide('OD', odCurve, odColor)}</div>
        <div style={{ flex: 1 }}>{renderSide('OE', oeCurve, oeColor)}</div>
      </div>
    )
  }
  if (mode === 'od_only') return renderSide('OD', odCurve, odColor)
  if (mode === 'oe_only') return renderSide('OE', oeCurve, oeColor)
  // combined: ambas sobrepostas
  return (
    <div style={{ width: '100%', height: '100%' }}>
      <svg viewBox="0 0 300 90" width="100%" height="100%" style={{ display: 'block' }}>
        <line x1={30} y1={75} x2={270} y2={75} stroke="#94a3b8" strokeWidth={1} />
        <line
          x1={150}
          y1={15}
          x2={150}
          y2={75}
          stroke="#94a3b8"
          strokeWidth={0.6}
          strokeDasharray="3 3"
        />
        {curvePath(odCurve, odColor, 0)}
        {curvePath(oeCurve, oeColor, 0)}
      </svg>
    </div>
  )
}

function TemplateSignature({ el, ctx }: { el: LayoutElement; ctx: TemplateDataContext }) {
  const lineWidth = el.props?.lineWidth || 80
  const label = el.props?.label || 'Assinatura do profissional'
  const showName = el.props?.showName !== false
  const showCrfa = el.props?.showCrfa !== false
  const who = el.props?.who || 'profissional'
  const nome =
    who === 'paciente' ? ctx.paciente?.nome : who === 'responsavel' ? '' : ctx.profissional?.nome
  const crfa = who === 'profissional' ? ctx.profissional?.crfa : ''
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        ...styleToCss(el.style),
      }}
    >
      <div style={{ width: `${lineWidth}%`, borderTop: '1px solid #000', marginBottom: 4 }} />
      <div style={{ fontSize: '8pt', textAlign: 'center' }}>
        {showName && nome && <div style={{ fontWeight: 'bold' }}>{nome}</div>}
        {showCrfa && crfa && <div>{crfa}</div>}
        <div>{label}</div>
      </div>
    </div>
  )
}

function TemplateWatermark({ el }: { el: LayoutElement }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 0.1,
        transform: 'rotate(-30deg)',
        fontSize: '48pt',
        fontWeight: 'bold',
        color: el.style?.color || '#1E3A8A',
        pointerEvents: 'none',
      }}
    >
      {el.props?.content || 'CONFIDENCIAL'}
    </div>
  )
}

// ===== Renderizador principal =====

export interface TemplateRendererProps {
  template: ExamReportTemplate
  data: TemplateDataContext
  /** Escala visual (1 = tamanho real em px). Padrão 1. */
  scale?: number
}

export const TemplateRenderer: React.FC<TemplateRendererProps> = ({
  template,
  data,
  scale = 1,
}) => {
  const larguraPx = mmToPx(template.largura_pagina) * scale
  const alturaPx = mmToPx(template.altura_pagina) * scale
  const margemSup = mmToPx(template.margem_superior) * scale
  const margemInf = mmToPx(template.margem_inferior) * scale
  const margemEsq = mmToPx(template.margem_esquerda) * scale
  const margemDir = mmToPx(template.margem_direita) * scale

  const areaLargura = larguraPx - margemEsq - margemDir
  const areaAltura = alturaPx - margemSup - margemInf

  const elementos = [...(template.estrutura_layout || [])].sort(
    (a, b) => (a.zIndex || 0) - (b.zIndex || 0),
  )

  const renderElement = (el: LayoutElement): React.ReactNode => {
    if (el.visible === false) return null
    const px = mmToPx(el.x) * scale
    const py = mmToPx(el.y) * scale
    const pw = mmToPx(el.width) * scale
    const ph = mmToPx(el.height) * scale

    let content: React.ReactNode = null
    switch (el.type) {
      case 'text':
        content = <TemplateText el={el} ctx={data} />
        break
      case 'field':
        content = <TemplateField el={el} ctx={data} />
        break
      case 'image':
        content = <TemplateImage el={el} />
        break
      case 'line':
        content = <TemplateLine el={el} />
        break
      case 'rectangle':
        content = <TemplateRectangle el={el} />
        break
      case 'table':
        content = <TemplateTable el={el} ctx={data} />
        break
      case 'audiogram':
        content = <TemplateAudiogram el={el} ctx={data} />
        break
      case 'timpanogram':
        content = <TemplateTimpanogram el={el} ctx={data} />
        break
      case 'signature':
        content = <TemplateSignature el={el} ctx={data} />
        break
      case 'watermark':
        content = <TemplateWatermark el={el} />
        break
      case 'divider':
        content = (
          <div
            style={{
              width: '100%',
              borderTop: `1px solid ${el.style?.borderColor || '#1E3A8A'}`,
              marginTop: '50%',
            }}
          />
        )
        break
      case 'section':
        content = (
          <div
            style={{
              width: '100%',
              height: '100%',
              border: `1px solid ${el.props?.borderColor || '#1E3A8A'}`,
            }}
          >
            {el.props?.title && (
              <div
                style={{
                  background: el.props?.titleBgColor || '#F2F4F7',
                  padding: '2px 6px',
                  fontWeight: 'bold',
                  fontSize: '9pt',
                }}
              >
                {el.props.title}
              </div>
            )}
            <div style={{ padding: 4 }}>
              {/* children renderizados recursivamente com posições relativas */}
              {(el.props?.children || []).map((childId) => {
                const child = elementos.find((e) => e.id === childId)
                if (!child) return null
                return (
                  <div
                    key={child.id}
                    style={{
                      position: 'relative',
                      marginBottom: 4,
                    }}
                  >
                    {renderElement({ ...child, x: 0, y: 0 })}
                  </div>
                )
              })}
            </div>
          </div>
        )
        break
      default:
        content = null
    }

    return (
      <div
        key={el.id}
        style={{
          position: 'absolute',
          left: px,
          top: py,
          width: pw,
          height: ph,
          zIndex: el.zIndex || 1,
          overflow: 'hidden',
        }}
      >
        {content}
      </div>
    )
  }

  return (
    <div
      className="template-page"
      style={{
        width: larguraPx,
        height: alturaPx,
        background: '#ffffff',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: template.fonte_padrao || 'Arial',
        fontSize: `${template.tamanho_fonte_padrao || 9}pt`,
        color: '#000000',
        boxSizing: 'border-box',
      }}
    >
      {/* Logo no canto superior esquerdo da margem */}
      {template.logo_url && (
        <img
          src={template.logo_url}
          alt="Logo"
          style={{
            position: 'absolute',
            top: margemSup,
            left: margemEsq,
            maxWidth: margemEsq + areaLargura * 0.3,
            maxHeight: margemSup + 20,
            objectFit: 'contain',
          }}
        />
      )}
      {/* Área útil com margens */}
      <div
        style={{
          position: 'absolute',
          left: margemEsq,
          top: margemSup,
          width: areaLargura,
          height: areaAltura,
        }}
      >
        {elementos.map(renderElement)}
      </div>
    </div>
  )
}

export default TemplateRenderer
