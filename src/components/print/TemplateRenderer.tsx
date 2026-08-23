// TemplateRenderer.tsx — Renderiza um modelo de laudo (estrutura_layout) em React.
// Usado tanto na prévia em tela quanto na geração de PDF (via window.print).
import React from 'react'
import type { ExamReportTemplate, LayoutElement, LayoutElementStyle } from '@/types'
import { AudiogramaSVG } from './AudiogramaSVG'
import { TimpanogramChart, type TimpanogramPoint } from './TimpanogramChart'
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

// ===== Tabelas dinâmicas vinculadas ao exame =====
type DynCol = { label: string; field: string; width?: number }
type DynRow = Record<string, string>

function safeStr(v: unknown): string {
  if (v === undefined || v === null || v === '') return '—'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}
function fmtNum(v: unknown): string {
  if (v === undefined || v === null || v === '') return '—'
  const n = Number(v)
  return isNaN(n) ? safeStr(v) : String(n)
}
function avgOfFreqs(map: unknown, freqs: string[]): string {
  if (!map || typeof map !== 'object') return '—'
  const m = map as Record<string, { db?: number | null }>
  const vals = freqs
    .map((f) => m[f]?.db)
    .filter((v): v is number => v !== null && v !== undefined && !isNaN(Number(v)))
  if (vals.length === 0) return '—'
  return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)
}

function buildDynamicTable(
  source: NonNullable<LayoutElement['props']>['dynamicSource'],
  ctx: TemplateDataContext,
): { columns: DynCol[]; rows: DynRow[] } | null {
  if (!source) return null
  const exame = (ctx.exame || {}) as Record<string, unknown>
  const p = ctx.paciente || {}
  const prof = ctx.profissional || {}
  const cli = ctx.clinica || {}

  if (source === 'identificacao') {
    const rows: DynRow[] = [
      { c1: 'Nome do paciente', c2: safeStr(p.nome) },
      { c1: 'CPF', c2: safeStr(p.cpf) },
      { c1: 'Data de nascimento', c2: safeStr(p.data_nascimento) },
      { c1: 'Idade', c2: safeStr(p.idade) },
      { c1: 'Sexo', c2: safeStr(p.sexo) },
      { c1: 'Data do exame', c2: safeStr(exame.data) },
      { c1: 'Profissional', c2: safeStr(prof.nome) },
      { c1: 'CRFa', c2: safeStr(prof.crfa) },
      { c1: 'Clínica', c2: safeStr(cli.nome) },
    ]
    return {
      columns: [
        { label: 'Campo', field: 'c1', width: 40 },
        { label: 'Valor', field: 'c2', width: 110 },
      ],
      rows,
    }
  }

  if (source === 'iprf' || source === 'iprf_od' || source === 'iprf_oe') {
    const iprf = (exame.iprf_vocal as Record<string, Record<string, unknown>>) || {}
    const od = iprf.od || {}
    const oe = iprf.oe || {}
    const showOD = source === 'iprf' || source === 'iprf_od'
    const showOE = source === 'iprf' || source === 'iprf_oe'
    const columns: DynCol[] = [{ label: 'Parâmetro', field: 'param', width: 60 }]
    if (showOD) columns.push({ label: 'OD', field: 'od', width: 45 })
    if (showOE) columns.push({ label: 'OE', field: 'oe', width: 45 })
    const mk = (label: string, key: string): DynRow => {
      const r: DynRow = { param: label }
      if (showOD) r.od = safeStr(od[key])
      if (showOE) r.oe = safeStr(oe[key])
      return r
    }
    return {
      columns,
      rows: [
        mk('Intensidade (dB)', 'intensidade'),
        mk('Monossílabos (%)', 'monossilabos'),
        mk('Dissílabos (%)', 'dissilabos'),
        mk('Mascaramento (dB)', 'mascaramento'),
        mk('Palavras faladas', 'palavras_faladas'),
      ],
    }
  }

  if (source === 'srt_ldv') {
    return {
      columns: [
        { label: 'Parâmetro', field: 'param', width: 60 },
        { label: 'OD', field: 'od', width: 45 },
        { label: 'OE', field: 'oe', width: 45 },
      ],
      rows: [
        { param: 'SRT (dB)', od: fmtNum(exame.srt_od), oe: fmtNum(exame.srt_oe) },
        { param: 'LDV (dB)', od: fmtNum(exame.ldv_od), oe: fmtNum(exame.ldv_oe) },
      ],
    }
  }

  if (source === 'medias_tonais') {
    return {
      columns: [
        { label: 'Parâmetro', field: 'param', width: 60 },
        { label: 'OD', field: 'od', width: 45 },
        { label: 'OE', field: 'oe', width: 45 },
      ],
      rows: [
        { param: 'Média tritonal (dB)', od: fmtNum(exame.mt_od), oe: fmtNum(exame.mt_oe) },
        {
          param: 'Média quadratonal (dB)',
          od: avgOfFreqs(exame.air_od, ['500', '1000', '2000', '4000']),
          oe: avgOfFreqs(exame.air_oe, ['500', '1000', '2000', '4000']),
        },
      ],
    }
  }

  if (source === 'timpanometria') {
    const timp = (exame.timpanometria as Record<string, Record<string, unknown>>) || {}
    const od = timp.OD || {}
    const oe = timp.OE || {}
    const mk = (label: string, key: string): DynRow => ({
      param: label,
      od: safeStr(od[key]),
      oe: safeStr(oe[key]),
    })
    return {
      columns: [
        { label: 'Parâmetro', field: 'param', width: 60 },
        { label: 'OD', field: 'od', width: 45 },
        { label: 'OE', field: 'oe', width: 45 },
      ],
      rows: [
        mk('Tipo de curva', 'tipo_curva'),
        mk('Volume do meato (ml)', 'volume_meato'),
        mk('Complacência (ml)', 'complacencia'),
        mk('Pressão de pico (daPa)', 'pressao_pico'),
        mk('Gradiente da curva', 'gradiente_curva'),
        mk('Descrição da curva', 'curva_descricao'),
        mk('Observações', 'observacoes'),
      ],
    }
  }

  if (source === 'reflexos') {
    const reflexos = (exame.reflexos as Record<string, Record<string, unknown>>) || {}
    const od = reflexos.OD || {}
    const oe = reflexos.OE || {}
    const cell = (vals: unknown, freq: string): string => {
      if (!vals || typeof vals !== 'object') return '—'
      const v = vals as Record<string, unknown>
      const anyVal = [
        'frequencia_500',
        'frequencia_1000',
        'frequencia_2000',
        'frequencia_4000',
      ].some((f) => v[f] !== null && v[f] !== undefined && v[f] !== '')
      if (!anyVal) {
        const st = String(v.status || '')
        if (st === 'ausente') return 'Ausente'
        if (st === 'elevado' || st === 'Reduzido') return 'Elevado'
        if (st === 'presente' || st === 'Normal') return '—'
        return '—'
      }
      return fmtNum(v[freq])
    }
    const mk = (orelha: string, via: string, vals: unknown): DynRow => ({
      orelha,
      via,
      f500: cell(vals, 'frequencia_500'),
      f1000: cell(vals, 'frequencia_1000'),
      f2000: cell(vals, 'frequencia_2000'),
      f4000: cell(vals, 'frequencia_4000'),
    })
    return {
      columns: [
        { label: 'Orelha', field: 'orelha', width: 25 },
        { label: 'Via', field: 'via', width: 45 },
        { label: '500 Hz', field: 'f500', width: 30 },
        { label: '1.000 Hz', field: 'f1000', width: 30 },
        { label: '2.000 Hz', field: 'f2000', width: 30 },
        { label: '4.000 Hz', field: 'f4000', width: 30 },
      ],
      rows: [
        mk('OD', 'Ipsilateral', od.ipsi_lateral),
        mk('OD', 'Contralateral', od.contra_lateral),
        mk('OE', 'Ipsilateral', oe.ipsi_lateral),
        mk('OE', 'Contralateral', oe.contra_lateral),
      ],
    }
  }

  if (source === 'meatoscopia') {
    const m = (exame.meatoscopia as Record<string, unknown>) || {}
    const yn = (v: unknown) => (v ? 'Sim' : 'Não')
    return {
      columns: [
        { label: 'Parâmetro', field: 'param', width: 60 },
        { label: 'OD', field: 'od', width: 45 },
        { label: 'OE', field: 'oe', width: 45 },
      ],
      rows: [
        { param: 'Normal', od: yn(m.od_normal), oe: yn(m.oe_normal) },
        { param: 'Alterada', od: yn(m.od_alterada), oe: yn(m.oe_alterada) },
        { param: 'Observação', od: safeStr(m.od_obs), oe: safeStr(m.oe_obs) },
      ],
    }
  }

  return null
}

function TemplateTable({ el, ctx }: { el: LayoutElement; ctx: TemplateDataContext }) {
  const dynSource = el.props?.dynamicSource
  const dyn = dynSource ? buildDynamicTable(dynSource, ctx) : null
  const columns = dyn?.columns || el.props?.columns || []
  const rows = dyn?.rows || el.props?.rows || []
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
  const mode = el.props?.mode || 'combined'

  // Dados de timpanometria podem vir em formatos variados. Suportamos:
  //  - exame.timpanometria.OD / .OE  (estrutura da imitanciometria)
  //  - exame.curva_timpanometrica_od / _oe  (arrays de pontos reais)
  const timpRoot = (exame.timpanometria as Record<string, Record<string, unknown>>) || {}
  const odTimpRaw = (timpRoot.OD as Record<string, unknown> | undefined) ?? null
  const oeTimpRaw = (timpRoot.OE as Record<string, unknown> | undefined) ?? null

  // Pontos reais da curva (curva_timpanometrica_od/oe) — quando disponíveis.
  // Também aceita pontos embutidos no objeto de timpanometria (timpanometria.OD.curva_timpanometrica).
  const odPoints = Array.isArray(exame.curva_timpanometrica_od)
    ? (exame.curva_timpanometrica_od as TimpanogramPoint[])
    : odTimpRaw && Array.isArray(odTimpRaw.curva_timpanometrica)
      ? (odTimpRaw.curva_timpanometrica as TimpanogramPoint[])
      : null
  const oePoints = Array.isArray(exame.curva_timpanometrica_oe)
    ? (exame.curva_timpanometrica_oe as TimpanogramPoint[])
    : oeTimpRaw && Array.isArray(oeTimpRaw.curva_timpanometrica)
      ? (oeTimpRaw.curva_timpanometrica as TimpanogramPoint[])
      : null

  const W = 320
  const H = 180

  // Modos OD/OE isolados: renderizam apenas uma curva (sem legenda dupla).
  if (mode === 'od_only') {
    return (
      <div style={{ width: '100%', height: '100%' }}>
        <TimpanogramChart
          odPoints={odPoints}
          oePoints={null}
          width={W}
          height={H}
          showTitle
          showLegend={false}
        />
      </div>
    )
  }
  if (mode === 'oe_only') {
    return (
      <div style={{ width: '100%', height: '100%' }}>
        <TimpanogramChart
          odPoints={null}
          oePoints={oePoints}
          width={W}
          height={H}
          showTitle
          showLegend={false}
        />
      </div>
    )
  }
  if (mode === 'side_by_side') {
    return (
      <div style={{ display: 'flex', gap: 8, width: '100%', height: '100%' }}>
        <div style={{ flex: 1 }}>
          <TimpanogramChart
            odPoints={odPoints}
            oePoints={null}
            width={W}
            height={H}
            showTitle
            showLegend={false}
          />
        </div>
        <div style={{ flex: 1 }}>
          <TimpanogramChart
            odPoints={null}
            oePoints={oePoints}
            width={W}
            height={H}
            showTitle
            showLegend={false}
          />
        </div>
      </div>
    )
  }
  // combined (padrão): ambas as curvas sobrepostas no mesmo gráfico.
  return (
    <div style={{ width: '100%', height: '100%' }}>
      <TimpanogramChart
        odPoints={odPoints}
        oePoints={oePoints}
        width={W}
        height={H}
        showTitle
        showLegend
      />
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

export type ElementHighlight = 'added' | 'removed' | 'changed'

export interface TemplateRendererProps {
  template: ExamReportTemplate
  data: TemplateDataContext
  /** Escala visual (1 = tamanho real em px). Padrão 1. */
  scale?: number
  /** Mapa de destaque visual por id do elemento (usado na comparação de versões). */
  highlightMap?: Record<string, ElementHighlight>
}

const HIGHLIGHT_OUTLINE: Record<ElementHighlight, string> = {
  added: '2px solid #16a34a',
  removed: '2px solid #dc2626',
  changed: '2px solid #ca8a04',
}

export const TemplateRenderer: React.FC<TemplateRendererProps> = ({
  template,
  data,
  scale = 1,
  highlightMap,
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

    const highlight = highlightMap?.[el.id]
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
          outline: highlight ? HIGHLIGHT_OUTLINE[highlight] : undefined,
          outlineOffset: highlight ? '1px' : undefined,
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
