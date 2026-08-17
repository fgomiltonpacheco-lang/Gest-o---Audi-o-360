// Elementos padrão, fábricas e constantes para o editor de laudos.
import type { LayoutElement, LayoutElementType, ExamReportTipoExame } from '@/types'

export function uid(): string {
  return `el_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

interface ElementDef {
  type: LayoutElementType
  label: string
  defaultWidth: number
  defaultHeight: number
  style?: LayoutElement['style']
  props?: LayoutElement['props']
}

export const ELEMENT_DEFS: ElementDef[] = [
  {
    type: 'text',
    label: 'Texto livre',
    defaultWidth: 80,
    defaultHeight: 10,
    props: { content: 'Novo texto', contentType: 'static' },
  },
  {
    type: 'text',
    label: 'Título',
    defaultWidth: 120,
    defaultHeight: 12,
    style: { fontSize: 14, bold: true, align: 'left' },
    props: { content: 'TÍTULO', contentType: 'static' },
  },
  {
    type: 'text',
    label: 'Subtítulo',
    defaultWidth: 100,
    defaultHeight: 10,
    style: { fontSize: 11, bold: true, align: 'left' },
    props: { content: 'Subtítulo', contentType: 'static' },
  },
  {
    type: 'text',
    label: 'Campo automático',
    defaultWidth: 80,
    defaultHeight: 8,
    props: {
      content: '{{paciente.nome}}',
      contentType: 'dynamic',
      dynamicField: 'paciente.nome',
      fallback: '—',
    },
  },
  {
    type: 'image',
    label: 'Logo da clínica',
    defaultWidth: 40,
    defaultHeight: 20,
    props: { src: 'logo_clinica', opacity: 1, fit: 'contain' },
  },
  {
    type: 'line',
    label: 'Linha horizontal',
    defaultWidth: 120,
    defaultHeight: 2,
    props: { direction: 'horizontal', color: '#1E3A8A', thickness: 1 },
  },
  {
    type: 'line',
    label: 'Linha vertical',
    defaultWidth: 2,
    defaultHeight: 40,
    props: { direction: 'vertical', color: '#1E3A8A', thickness: 1 },
  },
  {
    type: 'rectangle',
    label: 'Retângulo',
    defaultWidth: 80,
    defaultHeight: 30,
    style: { borderWidth: 1, borderColor: '#1E3A8A', backgroundColor: null },
  },
  {
    type: 'table',
    label: 'Tabela',
    defaultWidth: 150,
    defaultHeight: 40,
    props: {
      columns: [
        { label: 'Coluna 1', field: 'c1', width: 75 },
        { label: 'Coluna 2', field: 'c2', width: 75 },
      ],
      rows: [{ c1: '—', c2: '—' }],
      headerBgColor: '#F2F4F7',
      alternateRowColor: '#FAFBFC',
      borderColor: '#E2E8F0',
      fontSize: 8,
      dynamicSource: null,
    },
  },
  {
    type: 'audiogram',
    label: 'Audiograma',
    defaultWidth: 120,
    defaultHeight: 90,
    props: {
      mode: 'combined',
      showBone: true,
      showAir: true,
      showLegend: true,
      lineThickness: 1.5,
      odColor: '#DC2626',
      oeColor: '#2563EB',
      showAbsentPoints: true,
      frequencies: [125, 250, 500, 750, 1000, 1500, 2000, 3000, 4000, 6000, 8000],
      intensityRange: [-10, 120],
    },
  },
  {
    type: 'timpanogram',
    label: 'Timpanograma',
    defaultWidth: 90,
    defaultHeight: 60,
    props: { mode: 'combined', odColor: '#DC2626', oeColor: '#2563EB' },
  },
  {
    type: 'signature',
    label: 'Área de assinatura',
    defaultWidth: 80,
    defaultHeight: 30,
    props: {
      who: 'profissional',
      label: 'Assinatura do profissional',
      showName: true,
      showCrfa: true,
      lineWidth: 80,
    },
  },
  {
    type: 'section',
    label: 'Seção (agrupador)',
    defaultWidth: 170,
    defaultHeight: 50,
    props: {
      title: 'NOVA SEÇÃO',
      children: [],
      collapsible: false,
      borderColor: '#1E3A8A',
      titleBgColor: '#F2F4F7',
    },
  },
  {
    type: 'watermark',
    label: "Marca d'água",
    defaultWidth: 150,
    defaultHeight: 80,
    props: { content: 'CONFIDENCIAL' },
  },
  {
    type: 'divider',
    label: 'Divisor de seção',
    defaultWidth: 170,
    defaultHeight: 4,
    style: { borderColor: '#1E3A8A' },
  },
]

export function createElement(def: ElementDef, x = 60, y = 60): LayoutElement {
  return {
    id: uid(),
    type: def.type,
    label: def.label,
    x,
    y,
    width: def.defaultWidth,
    height: def.defaultHeight,
    locked: false,
    visible: true,
    zIndex: Date.now() % 100000,
    style: { ...def.style },
    props: { ...def.props },
  }
}

export function createElementByType(
  type: LayoutElementType,
  label: string,
  x = 60,
  y = 60,
): LayoutElement {
  const def =
    ELEMENT_DEFS.find((d) => d.type === type && d.label === label) ||
    ELEMENT_DEFS.find((d) => d.type === type) ||
    ELEMENT_DEFS[0]
  return createElement(def, x, y)
}

export const PACIENTE_FIELDS: { label: string; token: string }[] = [
  { label: 'Nome do paciente', token: 'paciente.nome' },
  { label: 'CPF', token: 'paciente.cpf' },
  { label: 'Data de nascimento', token: 'paciente.data_nascimento' },
  { label: 'Idade', token: 'paciente.idade' },
  { label: 'Sexo', token: 'paciente.sexo' },
  { label: 'Telefone', token: 'paciente.telefone' },
  { label: 'Endereço', token: 'paciente.endereco' },
  { label: 'Convênio', token: 'paciente.convenio' },
  { label: 'Prontuário', token: 'paciente.prontuario' },
  { label: 'Data do exame', token: 'exame.data' },
  { label: 'Hora do exame', token: 'exame.hora' },
  { label: 'Nome do profissional', token: 'profissional.nome' },
  { label: 'CRFa', token: 'profissional.crfa' },
  { label: 'Nome da clínica', token: 'clinica.nome' },
  { label: 'Endereço da clínica', token: 'clinica.endereco' },
  { label: 'Telefone da clínica', token: 'clinica.telefone' },
  { label: 'E-mail da clínica', token: 'clinica.email' },
]

export const EXAME_FIELDS: Record<ExamReportTipoExame, { label: string; field: string }[]> = {
  audiometria: [
    { label: 'Via Aérea OD', field: 'air_od' },
    { label: 'Via Aérea OE', field: 'air_oe' },
    { label: 'Via Óssea OD', field: 'bone_od' },
    { label: 'Via Óssea OE', field: 'bone_oe' },
    { label: 'SRT OD', field: 'srt_od' },
    { label: 'SRT OE', field: 'srt_oe' },
    { label: 'LRF', field: 'lrf' },
    { label: 'LDV', field: 'ldv' },
    { label: 'IPRF OD', field: 'iprf_od' },
    { label: 'IPRF OE', field: 'iprf_oe' },
    { label: 'Parecer', field: 'report' },
    { label: 'Observações', field: 'observations' },
    { label: 'Meatoscopia', field: 'meatoscopy' },
    { label: 'Média tritonal', field: 'mt' },
    { label: 'Média quadratonal', field: 'mq' },
    { label: 'Referência', field: 'reference' },
  ],
  imitanciometria: [
    { label: 'Timpanometria OD', field: 'timpanometria_od' },
    { label: 'Timpanometria OE', field: 'timpanometria_oe' },
    { label: 'Reflexos', field: 'reflexos' },
    { label: 'Meatoscopia', field: 'meatoscopia' },
    { label: 'Parecer', field: 'laudo' },
    { label: 'Observações', field: 'observacoes' },
    { label: 'Encaminhado por', field: 'encaminhado_por' },
    { label: 'Equipamento', field: 'equipment' },
    { label: 'Calibração', field: 'calibration' },
  ],
  teste_aparelho: [
    { label: 'Parecer', field: 'report' },
    { label: 'Observações', field: 'observations' },
  ],
  personalizado: [
    { label: 'Parecer', field: 'report' },
    { label: 'Observações', field: 'observations' },
  ],
}
