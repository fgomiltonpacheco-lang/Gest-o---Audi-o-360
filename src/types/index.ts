export type UserRole = 'admin' | 'profissional' | 'secretaria'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  avatar?: string
  crmCrfa?: string
}

export type PatientStatus = 'Ativo' | 'Em tratamento' | 'Inativo'
export type Gender = 'Masculino' | 'Feminino' | 'Outro' | 'Não informar'
export type HearingLossType = 'Normal' | 'Condutiva' | 'Neurossensorial' | 'Mista'

export interface FinancialResponsible {
  name: string
  relationship: string
  cpf: string
  phone: string
  email: string
}

export interface Patient {
  id: string
  name: string
  cpf: string
  birthDate: string // YYYY-MM-DD
  gender: Gender
  phone: string
  mobile: string
  email: string
  // Endereço
  cep: string
  street: string
  number: string
  complement?: string
  neighborhood: string
  city: string
  state: string
  // Convênio
  planType: 'Particular' | 'Convênio' | 'SUS'
  planName?: string
  cardNumber?: string
  // Responsável Financeiro
  hasResponsible?: boolean
  responsible?: FinancialResponsible
  // Histórico Auditivo
  hearingLossType: HearingLossType
  previousHearingAid: boolean
  previousAidBrand?: string
  previousAidModel?: string
  generalNotes?: string
  status: PatientStatus
  createdAt: string
  lastVisit?: string
}

// Tipo de atendimento agora é livre (texto) — vem do nome do procedimento
// cadastrado em `procedures`. Mantemos a união apenas como referência para os
// tipos legados; novos agendamentos podem usar qualquer nome de procedimento.
export type AppointmentType =
  | 'Avaliação auditiva'
  | 'Audiometria'
  | 'Imitanciometria'
  | 'Logoaudiometria'
  | 'BERA'
  | 'Adaptação de aparelho'
  | 'Retorno/ajuste'
  | 'Manutenção'
  | 'Entrega de aparelho'
  | 'Orientação'
  // Permite nomes de procedimentos cadastrados (ex.: "Audiometria Tonal Liminar")
  | (string & {})

export type AppointmentStatus = 'Agendado' | 'Confirmado' | 'Realizado' | 'Faltou' | 'Cancelado'

/**
 * Item de procedimento vinculado a um agendamento. O array `proceduresList`
 * substitui gradualmente o `procedureId`/`value` legados, permitindo que um
 * atendimento contenha vários procedimentos com seus respectivos valores.
 */
export interface AppointmentProcedureItem {
  procedureId: string
  procedureName: string
  value: number
  planType: PatientPlanType
}

export interface Procedure {
  id: string
  name: string
  duration: number // minutos
  value: number // R$ (legado — espelha valueParticular para compatibilidade)
  valueParticular: number // R$ — valor para pacientes Particulares
  valueSUS: number // R$ — valor para pacientes SUS
  valueConvenio: number // R$ — valor para pacientes de Convênio/Plano de Saúde
  category?: string
  active: boolean
  createdAt: string
  updatedAt: string
}

/** Tipo de plano do paciente (espelha Patient.planType). */
export type PatientPlanType = 'Particular' | 'Convênio' | 'SUS'

/**
 * Retorna o valor de um procedimento conforme o plano do paciente.
 * Se o plano não for reconhecido, usa `valueParticular` como padrão.
 */
export function getProcedureValueByPlan(
  proc: Pick<Procedure, 'valueParticular' | 'valueSUS' | 'valueConvenio'>,
  planType?: PatientPlanType | null,
): number {
  if (planType === 'SUS') return Number(proc.valueSUS) || 0
  if (planType === 'Convênio') return Number(proc.valueConvenio) || 0
  return Number(proc.valueParticular) || 0
}

export interface Appointment {
  id: string
  patientId: string
  patientName: string
  patientPhone?: string
  /** Vínculo com a coleção `procedures` (vazio para agendamentos legados). */
  procedureId?: string
  /** Nome do procedimento exibido (fallback do antigo campo "type"). */
  type: string
  procedimentos?: string
  date: string // YYYY-MM-DD
  time: string // HH:mm
  duration: number // minutes
  /** Valor (R$) preenchido automaticamente a partir do procedimento. */
  value?: number
  professionalName: string
  status: AppointmentStatus
  notes?: string
  /** Tipo de pagamento (Particular/SUS/Convênio) — fallback "Particular". */
  planType?: PatientPlanType
  /** Estado de recepção: "" (não chegou), "presente" (na recepção), "atendendo" (em atendimento). */
  reception?: string
  /** Marca o agendamento como encaixe (paciente inserido em horário ocupado). */
  isEncaixe?: boolean
  /**
   * Lista de procedimentos efetivamente realizados no atendimento. Pode ter
   * múltiplos itens quando o profissional acrescenta procedimentos durante o
   * atendimento. Fallback: quando ausente, monta-se um array com o
   * `procedureId`/`type`/`value` legados.
   */
  proceduresList?: AppointmentProcedureItem[]
  createdAt: string
}

export interface ClinicalRecord {
  patientId: string
  mainComplaint: string
  anamnesis: string
  hearingHistory: string
  currentMedications: string
  familyHistory: string
  diagnosis: string
  conduct: string
  nextReturn?: string // YYYY-MM-DD
  updatedAt: string
}

export interface ClinicalEvolution {
  id: string
  patientId: string
  date: string // YYYY-MM-DD
  professionalName: string
  description: string
  createdAt: string
}

// Exames
export interface AudiometryExam {
  id: string
  patientId: string
  patientName: string
  date: string
  professionalName: string
  // Via Aérea (OD / OE) em dB
  airOD: Record<string, number | null | 'NR'> // '250', '500', '1000', '2000', '3000', '4000', '6000', '8000'
  airOE: Record<string, number | null | 'NR'>
  // Via Óssea (OD / OE) em dB
  boneOD: Record<string, number | null | 'NR'> // '500', '1000', '2000', '4000'
  boneOE: Record<string, number | null | 'NR'>
  // SRT & IPRF
  srtOD?: number
  srtOE?: number
  iprfOD?: number // %
  iprfOE?: number // %
  lossDegree: 'Normal' | 'Leve' | 'Moderada' | 'Moderadamente severa' | 'Severa' | 'Profunda'
  lossType: 'Condutiva' | 'Neurossensorial' | 'Mista'
  notes?: string
}

// ===== Módulo de Audiometria Completa (audiometry_exams) =====
export const AIR_FREQS = [
  '250',
  '500',
  '750',
  '1000',
  '1500',
  '2000',
  '3000',
  '4000',
  '6000',
  '8000',
] as const
export const BONE_FREQS = ['500', '1000', '2000', '3000', '4000'] as const

export type AudiogramSymbol = 'normal' | 'no_response' | 'masked' | 'masked_no_response'

export interface AudiogramPoint {
  db: number | null
  symbol: AudiogramSymbol
}

/** Mapa frequência -> ponto do audiograma (ex.: { "500": { db: 25, symbol: "normal" } }). */
export type AudiogramMap = Record<string, AudiogramPoint>

export interface IprfRow {
  intensidade: string
  monossilabos: string
  dissilabos: string
  mascaramento: string
  palavras: string
}

export interface IprfData {
  od: IprfRow
  oe: IprfRow
}

/**
 * IPRF estruturado (logoaudiometria) — uma linha por orelha com
 * intensidade (dB), reconhecimento de monossílabos (%) e dissílabos (%).
 * Exibido na seção "I.P.R.F" do exame, no formato do PDF de referência.
 */
export interface IprfVocalRow {
  intensidade: string
  monossilabos: string
  monossilabos_erros?: string
  dissilabos: string
  dissilabos_erros?: string
  intensidade_dissilabos?: string
  tipo_mascaramento?: string
  tipo_mascaramento_dissilabos?: string
  mascaramento_dissilabos?: string
  trissilabos?: string
  trissilabos_erros?: string
  intensidade_trissilabos?: string
  tipo_mascaramento_trissilabos?: string
  mascaramento_trissilabos?: string
  polissilabos?: string
  polissilabos_erros?: string
  intensidade_polissilabos?: string
  tipo_mascaramento_polissilabos?: string
  mascaramento_polissilabos?: string
  mascaramento_srt_tipo?: string
  mascaramento_ldv_tipo?: string
  /** Mascaramento (dB) utilizado na pesquisa de IPRF. */
  mascaramento: string
  /** Quantidade de palavras faladas na pesquisa de IPRF. */
  palavras_faladas: string
  /** Níveis adicionais de intensidade (ex.: "100% a 45 dB, 76% a 95 dB"). */
  niveis: string
}

export interface IprfVocalData {
  od: IprfVocalRow
  oe: IprfVocalRow
}

export interface AudiometryExamFull {
  id: string
  patientId: string
  patientName: string
  created_by?: string
  date: string // YYYY-MM-DD
  cpf: string
  dob: string
  age: string
  sex: string
  referred_by: string
  hearing_rest_14h: boolean
  audiometer: string
  calibration: string
  otoscopy_od: 'Normal' | 'Alterada' | ''
  otoscopy_od_obs: string
  otoscopy_oe: 'Normal' | 'Alterada' | ''
  otoscopy_oe_obs: string
  air_od: AudiogramMap
  air_oe: AudiogramMap
  bone_od: AudiogramMap
  bone_oe: AudiogramMap
  ldl_od?: AudiogramMap
  ldl_oe?: AudiogramMap
  mt_od: number | null
  mt_oe: number | null
  lrf_od: number | null
  lrf_oe: number | null
  ldv_od: number | null
  ldv_oe: number | null
  iprf: IprfData
  // IPRF simplificado (percentual por orelha)
  iprf_od: number | null
  iprf_oe: number | null
  // IPRF estruturado (logoaudiometria — intensidade/monossílabos/dissílabos)
  iprf_vocal: IprfVocalData
  // SRT (Speech Reception Threshold) por orelha
  srt_od: number | null
  srt_oe: number | null
  // Mascaramento (dB) — via aérea / via óssea por orelha
  masking_air_od: number | null
  masking_air_oe: number | null
  masking_bone_od: number | null
  masking_bone_oe: number | null
  // Inspeção do meato acústico externo (texto descritivo)
  meatoscopy_od: string
  meatoscopy_oe: string
  // Estado civil
  marital_status: string
  // Laudo clínico
  loss_degree: string
  loss_type: string
  loss_configuration: string
  /** Níveis adicionais de IPRF (texto livre), por orelha. */
  iprf_levels_od: string
  iprf_levels_oe: string
  report: string
  created: string
  updated: string
}

// ===== Módulo de NFS-e Emitidas (Vendas PDV) =====

export type NfseEmitidaStatus = 'pendente' | 'enviada' | 'autorizada' | 'cancelada' | 'erro'
export type NfseEmitidaTipoVenda = 'PDV' | 'B2B'

/** Registro de NFS-e emitida para uma venda (PDV ou B2B). */
export interface NfseEmitida {
  id: string
  /** Relação com a coleção `sales`. */
  sale?: string
  tipo_venda: NfseEmitidaTipoVenda
  numero_rps?: string
  numero_lote?: string
  numero_nfse?: string
  codigo_verificacao?: string
  status: NfseEmitidaStatus
  valor_servico: number
  aliquota_iss: number
  valor_iss: number
  valor_liquido: number
  discriminacao: string
  tomador_nome: string
  tomador_cpf_cnpj: string
  pdf_url?: string
  erro_mensagem?: string
  data_emissao?: string
  observacao?: string
  created: string
  updated: string
}

export const LOSS_DEGREE_OPTIONS = [
  'Normal',
  'Leve',
  'Moderada',
  'Moderadamente Severa',
  'Severa',
  'Profunda',
] as const
export const LOSS_TYPE_OPTIONS = ['Condutiva', 'Neurossensorial', 'Mista'] as const
export const LOSS_CONFIGURATION_OPTIONS = ['Plana', 'Ascendente', 'Descendente', 'Mista'] as const

export function emptyAudiogramMap(freqs: readonly string[]): AudiogramMap {
  const m: AudiogramMap = {}
  freqs.forEach((f) => {
    m[f] = { db: null, symbol: 'normal' }
  })
  return m
}

export function emptyIprf(): IprfData {
  const emptyRow = (): IprfRow => ({
    intensidade: '',
    monossilabos: '',
    dissilabos: '',
    mascaramento: '',
    palavras: '',
  })
  return { od: emptyRow(), oe: emptyRow() }
}

export function emptyIprfVocal(): IprfVocalData {
  const emptyRow = (): IprfVocalRow => ({
    intensidade: '',
    monossilabos: '',
    dissilabos: '',
    mascaramento: '',
    palavras_faladas: '',
    niveis: '',
  })
  return { od: emptyRow(), oe: emptyRow() }
}

export function emptyAudiometryExamFull(
  patientId: string,
  patientName: string,
): Omit<AudiometryExamFull, 'id' | 'created' | 'updated'> {
  return {
    patientId,
    patientName,
    created_by: '',
    date: new Date().toISOString().split('T')[0],
    cpf: '',
    dob: '',
    age: '',
    sex: '',
    referred_by: '',
    hearing_rest_14h: false,
    audiometer: 'R27a Resonance',
    calibration: '',
    otoscopy_od: '',
    otoscopy_od_obs: '',
    otoscopy_oe: '',
    otoscopy_oe_obs: '',
    air_od: emptyAudiogramMap(AIR_FREQS),
    air_oe: emptyAudiogramMap(AIR_FREQS),
    bone_od: emptyAudiogramMap(BONE_FREQS),
    bone_oe: emptyAudiogramMap(BONE_FREQS),
    ldl_od: emptyAudiogramMap(AIR_FREQS),
    ldl_oe: emptyAudiogramMap(AIR_FREQS),
    mt_od: null,
    mt_oe: null,
    lrf_od: null,
    lrf_oe: null,
    ldv_od: null,
    ldv_oe: null,
    iprf: emptyIprf(),
    iprf_od: null,
    iprf_oe: null,
    iprf_vocal: emptyIprfVocal(),
    srt_od: null,
    srt_oe: null,
    masking_air_od: null,
    masking_air_oe: null,
    masking_bone_od: null,
    masking_bone_oe: null,
    meatoscopy_od: '',
    meatoscopy_oe: '',
    marital_status: '',
    loss_degree: '',
    loss_type: '',
    loss_configuration: '',
    iprf_levels_od: '',
    iprf_levels_oe: '',
    report: '',
  }
}

// ===== Módulo de Imitanciometria (imitanciometrias) =====
export interface ImitanciometriaMeatoscopia {
  od_normal: boolean
  od_alterada: boolean
  od_obs: string
  oe_normal: boolean
  oe_alterada: boolean
  oe_obs: string
}

export interface ImitanciometriaTimpanometria {
  orelha: 'OD' | 'OE'
  volume_meato: number | null
  complacencia: number | null
  pressao_maxima: number | null
  tipo_curva: string
  pressao_pico: number | null
  gradiente_curva: number | null
  curva_descricao: string
  observacoes: string
}

export interface ImitanciometriaReflexo {
  orelha: 'OD' | 'OE'
  via: 'contra_lateral' | 'ipsi_lateral'
  frequencia_500: number | null
  frequencia_1000: number | null
  frequencia_2000: number | null
  frequencia_4000: number | null
  status: string
}

export interface Imitanciometria {
  id: string
  paciente_id: string
  data_exame: string
  especialista_id: string
  especialista_nome: string
  equipment_id: string
  equipment_nome: string
  observacoes: string
  status: 'rascunho' | 'finalizado'
  tipo_curva_od: string
  tipo_curva_oe: string
  reflexos_status: string
  laudo: string
  referencias: string
  encaminhado_por: string
  meatoscopia: ImitanciometriaMeatoscopia
  paciente_nome: string
  paciente_cpf: string
  paciente_nascimento: string
  paciente_idade: string
  paciente_sexo: string
  created: string
  updated: string
}

export type ReflexStatus = 'Presente' | 'Ausente' | 'Não testado'

export interface TympanometryData {
  curve: 'A' | 'As' | 'Ad' | 'B' | 'C'
  compliance: number // ml
  pressure: number // daPa
  volume: number // ml
}

export interface TympanometryExam {
  id: string
  patientId: string
  patientName: string
  date: string
  professionalName: string
  tympanometryOD: TympanometryData
  tympanometryOE: TympanometryData
  reflexesOD: Record<string, ReflexStatus> // 500, 1000, 2000, 4000
  reflexesOE: Record<string, ReflexStatus>
  conclusion: string
  notes?: string
}

export interface BeraWaves {
  waveI?: number // ms
  waveIII?: number
  waveV?: number
  interI_III?: number
  interIII_V?: number
  interI_V?: number
  threshold?: number // dBnHL
}

export interface BeraExam {
  id: string
  patientId: string
  patientName: string
  date: string
  professionalName: string
  od: BeraWaves
  oe: BeraWaves
  classification: 'Normal' | 'Alterado'
  notes?: string
}

// Aparelhos Auditivos
export type HearingAidType = 'BTE' | 'RIC' | 'ITE' | 'CIC' | 'IIC'
export type HearingAidSide = 'Direito' | 'Esquerdo' | 'Bilateral'
export type HearingAidStatus = 'Em uso' | 'Estoque' | 'Vendido' | 'Em manutenção'
export type PaymentMethod = 'À vista' | 'Parcelado' | 'Boleto' | 'Cartão'

export interface AidMaintenance {
  id: string
  hearingAidId: string
  date: string
  description: string
  responsible: string
  createdAt: string
}

export interface AidAdjustment {
  id: string
  hearingAidId: string
  date: string
  description: string
  professionalName: string
  createdAt: string
}

export interface HearingAid {
  id: string
  brand: string
  model: string
  type: HearingAidType
  side: HearingAidSide
  serialNumber: string
  patientId?: string
  patientName?: string
  saleDate?: string
  saleValue?: number
  paymentMethod?: PaymentMethod
  warrantyMonths: number
  warrantyEndDate?: string
  powerSource: 'Pilha' | 'Recarregável'
  earMold: boolean
  earMoldType?: string
  notes?: string
  status: HearingAidStatus
  maintenances?: AidMaintenance[]
  adjustments?: AidAdjustment[]
  createdAt: string
}

// Financeiro
export type BudgetStatus = 'Rascunho' | 'Enviado' | 'Aprovado' | 'Recusado' | 'Convertido'

export interface BudgetItem {
  id: string
  type: 'Aparelho' | 'Serviço' | 'Exame'
  description: string
  quantity: number
  unitPrice: number
  total: number
}

export interface Budget {
  id: string
  number: number
  patientId: string
  patientName: string
  date: string
  items: BudgetItem[]
  discountPercent: number
  totalValue: number
  status: BudgetStatus
  notes?: string
  createdAt: string
}

export type SaleStatus = 'Pendente' | 'Pago' | 'Cancelado' | 'Estornado' | 'Concluída'
export type SaleType = 'PDV' | 'atendimento'

/** Forma de pagamento usada no PDV (mais granular que PaymentMethod legado). */
export type PDVPaymentMethod =
  | 'Dinheiro'
  | 'Cartão de Débito'
  | 'Cartão de Crédito'
  | 'PIX'
  | 'Convênio'
  | 'Boleto'
  // valores legados do Financeiro
  | 'À vista'
  | 'Parcelado'
  | 'Cartão'

/** Item do carrinho de vendas (PDV) — persistido no campo JSON `items` da venda. */
export interface SaleItem {
  id: string
  name: string
  /** 'procedure' (serviço/exame) ou 'inventory' (produto). */
  type: 'procedure' | 'inventory'
  quantity: number
  unitPrice: number
  subtotal: number
  /** ID do item de estoque (apenas type=inventory) para baixa/devolução. */
  stockItemId?: string
}

export interface Sale {
  id: string
  number: number
  patientId: string
  patientName: string
  date: string
  itemsDescription: string
  totalValue: number
  paymentMethod: PDVPaymentMethod
  installmentsCount: number
  interestPercent: number
  firstDueDate?: string
  status: SaleStatus
  createdAt: string
  // ---- Campos do módulo PDV ----
  type?: SaleType
  items?: SaleItem[]
  subtotal?: number
  discountValue?: number
  discountPercent?: number
  cancelReason?: string
  appointmentId?: string
  // ---- Recebimento (Finalizar como Paga) ----
  /** Data (YYYY-MM-DD) em que a venda foi paga/finalizada. */
  paymentDate?: string
  /** Observações do recebimento (forma de recebimento, etc.). */
  paymentNotes?: string
  /**
   * Flag que indica se o estoque já foi baixado para esta venda.
   * Garante idempotência: a baixa ocorre UMA vez (ao finalizar como
   * Paga). Ao cancelar/estornar uma venda com estoque_baixado=true,
   * os itens são devolvidos e a flag volta para false.
   */
  estoqueBaixado?: boolean
}

export type InstallmentStatus = 'Pendente' | 'Pago' | 'Atrasado'

export interface Installment {
  id: string
  saleId: string
  saleNumber: number
  installmentNumber: number
  totalInstallments: number
  patientId: string
  patientName: string
  dueDate: string // YYYY-MM-DD
  value: number
  status: InstallmentStatus
  paidDate?: string
}

export interface Commission {
  id: string
  professionalName: string
  period: string // MM/YYYY
  salesCount: number
  totalSalesValue: number
  commissionPercent: number
  commissionValue: number
}

export type CashFlowType = 'Entrada' | 'Saída'
export type CashFlowCategory =
  | 'Consulta'
  | 'Venda de aparelho'
  | 'Serviço'
  | 'Pagamento de parcela'
  | 'Despesa operacional'
  | 'Salários/Comissões'
  | 'Fornecedores'
  | 'Outros'

export interface CashFlowMovement {
  id: string
  date: string // YYYY-MM-DD
  description: string
  type: CashFlowType
  category: CashFlowCategory
  value: number
  responsible: string
  createdAt: string
}

// Estoque
export type StockCategory = 'Aparelhos auditivos' | 'Pilhas' | 'Moldes' | 'Acessórios'
export type BatterySize = '10' | '13' | '312' | '675'
export type AccessorySubcategory =
  | 'Tubos'
  | 'Filtros'
  | 'Cerúmen'
  | 'Cordões'
  | 'Carregadores'
  | 'Outros'

/**
 * Categoria de inventário (enum `categoria` na coleção `inventory`).
 * Usada para controle de estoque mínimo, validade e relatórios.
 * - 'servico' não possui controle de estoque mínimo nem validade.
 */
export type InventoryCategoria =
  | 'aparelho'
  | 'consumivel'
  | 'servico'
  | 'acessorio'
  | 'bateria'
  | 'molde'
  | 'filtro'

export const INVENTORY_CATEGORIAS: InventoryCategoria[] = [
  'aparelho',
  'consumivel',
  'servico',
  'acessorio',
  'bateria',
  'molde',
  'filtro',
]

export const INVENTORY_CATEGORIA_LABELS: Record<InventoryCategoria, string> = {
  aparelho: 'Aparelho',
  consumivel: 'Consumível',
  servico: 'Serviço',
  acessorio: 'Acessório',
  bateria: 'Bateria',
  molde: 'Molde',
  filtro: 'Filtro',
}

/**
 * Retorna o status da calibração de um equipamento.
 * - 'expired': a data de calibração já passou
 * - 'expiring': a calibração vence em até 30 dias
 * - 'valid': calibração em dia
 */
export function getEquipmentStatus(
  proximaCalibracao?: string,
  today?: string,
): 'expired' | 'expiring' | 'valid' {
  if (!proximaCalibracao) return 'valid'
  const calib = new Date(proximaCalibracao + 'T00:00:00')
  const hoje = today ? new Date(today + 'T00:00:00') : new Date()
  hoje.setHours(0, 0, 0, 0)
  const diff = calib.getTime() - hoje.getTime()
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
  if (days < 0) return 'expired'
  if (days <= 30) return 'expiring'
  return 'valid'
}

// ===== Módulo de Estoque (tipos usados por AppContext e Estoque.tsx) =====

export interface StockItem {
  id: string
  name: string
  brand?: string
  model?: string
  color?: string
  category: StockCategory
  batterySize?: BatterySize
  accessorySubcategory?: AccessorySubcategory
  minQuantity: number
  currentQuantity: number
  supplier?: string
  costPrice: number
  salePrice: number
  notes?: string
  // Novos campos de controle
  estoqueMinimo?: number
  dataValidade?: string
  lote?: string
  fabricante?: string
  diasAlertaValidade?: number
  categoria?: InventoryCategoria
  unidadeMedida?: string
  code?: string
  sku?: string
  movements?: StockMovement[]
  createdAt?: string
  updatedAt?: string
}

export interface StockMovement {
  id: string
  stockItemId: string
  type: 'entrada' | 'saida'
  quantity: number
  reason: string
  responsible: string
  patient?: string
  supplier?: string
  date: string
  createdAt: string
}

// ===== Módulo de Caixa =====

export type MovimentacaoCaixaTipo = 'entrada' | 'saida'

export type FormaPagamentoCaixa = 'dinheiro' | 'debito' | 'credito' | 'pix' | 'convenio' | 'boleto'

export interface MovimentacaoCaixa {
  id: string
  fechamentoId: string
  tipo: MovimentacaoCaixaTipo
  valor: number
  descricao: string
  formaPagamento: FormaPagamentoCaixa
  data: string
  saleId?: string
  created?: string
}

export interface FechamentoCaixa {
  id: string
  data: string
  saldoInicial: number
  saldoFinal: number
  totalDinheiro: number
  totalDebito: number
  totalCredito: number
  totalPix: number
  totalConvenio: number
  totalBoleto: number
  totalEntradas: number
  totalSaidas: number
  totalVendas: number
  quantidadeVendas: number
  diferenca: number
  status: 'aberto' | 'fechado'
  observacao: string
  usuarioId?: string
  usuarioNome?: string
  created?: string
  updated?: string
}

// ===== Módulo de Contas a Receber =====

export type ContaReceberStatus =
  | 'pendente'
  | 'recebido_parcial'
  | 'recebido_total'
  | 'vencido'
  | 'cancelado'
  | 'renegociado'

export type FormaRecebimento =
  | 'dinheiro'
  | 'debito'
  | 'credito'
  | 'pix'
  | 'convenio'
  | 'boleto'
  | 'promissoria'
  | 'deposito'
  | 'transferencia'

/** Item extra (produto/procedimento) adicionado no momento do recebimento. */
export interface RecebimentoItemExtra {
  nome: string
  quantidade: number
  valor_unitario: number
  subtotal: number
}

/** Tipo de desconto aplicado em um recebimento. */
export type RecebimentoDescontoTipo = 'valor' | 'percentual' | ''

export interface Recebimento {
  id: string
  conta_id: string
  valor: number
  data_recebimento: string
  forma_recebimento: FormaRecebimento
  observacoes?: string
  usuario_id?: string
  usuario_nome?: string
  // ---- Campos de acréscimo/desconto (Registrar Recebimento) ----
  /** Valor original da conta usado como base para o cálculo (valor_restante na data do recebimento). */
  valor_base?: number
  /** Itens extras (produtos/procedimentos) adicionados no recebimento. */
  itens_extras?: RecebimentoItemExtra[]
  /** Tipo do desconto aplicado: valor (R$) ou percentual (%). Vazio quando não há desconto. */
  desconto_tipo?: RecebimentoDescontoTipo
  /** Valor do desconto (em R$ quando tipo=valor; em % quando tipo=percentual). */
  desconto_valor?: number
  /** Total efetivamente recebido: valor_base + soma(itens_extras) - desconto em R$. */
  valor_total?: number
  created?: string
}

export interface ContaReceber {
  id: string
  venda_id: string
  venda_origem: string
  cliente_id: string
  cliente_nome: string
  paciente_id?: string
  empresa_parceira_id?: string
  cliente_telefone?: string
  data_venda?: string
  descricao: string
  valor_original: number
  valor_recebido: number
  valor_restante: number
  data_vencimento: string
  data_recebimento?: string
  status: ContaReceberStatus
  forma_pagamento: string
  numero_parcelas: number
  parcela_atual: number
  observacoes?: string
  conta_origem_id?: string
  motivo_renegociacao?: string
  motivo_cancelamento?: string
  created?: string
  updated?: string
}

export const CONTA_RECEBER_STATUS_LABELS: Record<ContaReceberStatus, string> = {
  pendente: 'Pendente',
  recebido_parcial: 'Recebido Parcial',
  recebido_total: 'Recebido Total',
  vencido: 'Vencido',
  cancelado: 'Cancelado',
  renegociado: 'Renegociado',
}

export const CONTA_RECEBER_FORMA_LABELS: Record<string, string> = {
  dinheiro: 'Dinheiro',
  debito: 'Débito',
  credito: 'Crédito',
  pix: 'PIX',
  convenio: 'Convênio',
  boleto: 'Boleto',
  promissoria: 'Promissória',
  deposito: 'Depósito',
  transferencia: 'Transferência',
}

export const FORMA_RECEBIMENTO_LABELS: Record<FormaRecebimento, string> = {
  dinheiro: 'Dinheiro',
  debito: 'Débito',
  credito: 'Crédito',
  pix: 'PIX',
  convenio: 'Convênio',
  boleto: 'Boleto',
  promissoria: 'Promissória',
  deposito: 'Depósito',
  transferencia: 'Transferência',
}

// ===== Módulo de Despesas =====

export type DespesaCategoria =
  | 'aluguel'
  | 'salarios'
  | 'comissoes'
  | 'fornecedores'
  | 'utilidades'
  | 'marketing'
  | 'manutencao'
  | 'impostos'
  | 'material_consumo'
  | 'outros'

export type DespesaFormaPagamento =
  | 'dinheiro'
  | 'debito'
  | 'credito'
  | 'pix'
  | 'boleto'
  | 'transferencia'
  | 'cartao'
  | 'cheque'

export type DespesaStatus = 'a_pagar' | 'pago' | 'vencido' | 'cancelado'

export const DESPESA_CATEGORIAS: DespesaCategoria[] = [
  'aluguel',
  'salarios',
  'comissoes',
  'fornecedores',
  'utilidades',
  'marketing',
  'manutencao',
  'impostos',
  'material_consumo',
  'outros',
]

export const DESPESA_CATEGORIA_LABELS: Record<DespesaCategoria, string> = {
  aluguel: 'Aluguel',
  salarios: 'Salários',
  comissoes: 'Comissões',
  fornecedores: 'Fornecedores',
  utilidades: 'Utilidades (Água/Luz/Internet)',
  marketing: 'Marketing',
  manutencao: 'Manutenção',
  impostos: 'Impostos',
  material_consumo: 'Material de Consumo',
  outros: 'Outros',
}

export const DESPESA_FORMA_PAGAMENTO_LABELS: Record<DespesaFormaPagamento, string> = {
  dinheiro: 'Dinheiro',
  debito: 'Débito',
  credito: 'Crédito',
  pix: 'PIX',
  boleto: 'Boleto',
  transferencia: 'Transferência',
}

export const DESPESA_STATUS_LABELS: Record<DespesaStatus, string> = {
  a_pagar: 'A Pagar',
  pago: 'Pago',
  vencido: 'Vencido',
  cancelado: 'Cancelado',
}

export interface Despesa {
  id: string
  descricao: string
  valor: number
  data_vencimento: string
  data_pagamento?: string
  categoria: DespesaCategoria
  forma_pagamento?: DespesaFormaPagamento
  status: DespesaStatus
  valor_pago?: number
  observacoes?: string
  motivo_cancelamento?: string
  movimentacao_caixa_id?: string
  comprovante?: string
  fornecedor?: string
  comprovante_url?: string
  recorrente?: boolean
  frequencia_recorrencia?: 'mensal' | 'anual'
  created?: string
  updated?: string
}

// ===== Módulo LGPD / Consentimentos =====

export type TipoConsentimento = 'dados_cadastrais' | 'dados_saude' | 'marketing' | 'pesquisa'

export const TIPOS_CONSENTIMENTO: TipoConsentimento[] = [
  'dados_cadastrais',
  'dados_saude',
  'marketing',
  'pesquisa',
]

export const ROTULO_CONSENTIMENTO: Record<TipoConsentimento, string> = {
  dados_cadastrais: 'Dados Cadastrais',
  dados_saude: 'Dados de Saúde',
  marketing: 'Marketing',
  pesquisa: 'Pesquisa',
}

export const TEXTO_PADRAO_CONSENTIMENTO: Record<TipoConsentimento, string> = {
  dados_cadastrais:
    'Autorizo a Audição360 a armazenar e processar meus dados cadastrais (nome, CPF, endereço, telefone, e-mail) para fins de identificação, contato e faturamento, conforme a Lei Geral de Proteção de Dados (LGPD — Lei 13.709/2018).',
  dados_saude:
    'Autorizo a Audição360 a coletar, armazenar e processar meus dados de saúde auditiva (exames, diagnósticos, prontuários clínicos) para fins de acompanhamento clínico e emissão de laudos, conforme a LGPD.',
  marketing:
    'Autorizo a Audição360 a utilizar meus dados de contato para envio de comunicações de marketing, promoções, lembretes de consulta e novidades sobre saúde auditiva.',
  pesquisa:
    'Autorizo a Audição360 a utilizar meus dados anonimizados para fins de pesquisa, estatística e melhoria dos serviços clínicos prestados.',
}

export interface Consentimento {
  id: string
  paciente_id: string
  tipo?: TipoConsentimento
  tipo_consentimento?: TipoConsentimento
  texto?: string
  versao_termo?: string
  data_consentimento?: string
  data_aceitacao?: string
  ip_aceitacao?: string
  usuario_id?: string
  usuario_nome?: string
  status?: string
  data_revogacao?: string
  observacoes?: string
  revogado_em?: string
  revogado_motivo?: string
  created?: string
  updated?: string
}
// ===== Módulo de Equipamentos =====

export interface Equipment {
  id: string
  nome: string
  modelo?: string
  marca?: string
  tipo?: string
  numero_serie?: string
  data_aquisicao?: string
  data_calibracao?: string
  data_ultima_calibracao?: string
  proxima_calibracao?: string
  data_proxima_calibracao?: string
  status?: string
  observacoes?: string
  created?: string
  updated?: string
}

// ===== Módulo B2B / Empresas Parceiras =====

export interface EmpresaParceira {
  id: string
  nome: string
  razao_social?: string
  nome_fantasia?: string
  cnpj?: string
  inscricao_estadual?: string
  telefone?: string
  email?: string
  contato?: string
  endereco?: string
  cidade?: string
  estado?: string
  cep?: string
  comissao_padrao: number
  ativo: boolean
  status?: string
  observacoes?: string
  created?: string
  updated?: string
}

export type VendaB2BStatus =
  | 'pendente'
  | 'confirmada'
  | 'entregue'
  | 'cancelada'
  | 'aprovada'
  | 'concluida'

export type NFServicoStatus =
  | 'pendente'
  | 'emitida'
  | 'cancelada'
  | 'cancelada_prefeitura'
  | 'erro'
  | 'rascunho'

export interface NFServicoComissao {
  id: string
  venda_id: string
  venda_b2b_id?: string
  parceiro_id: string
  numero_nf?: string
  numero_nfse?: string
  codigo_verificacao?: string
  discriminacao_servico?: string
  item_lista_servico?: string
  valor_base?: number
  tomador_razao_social?: string
  tomador_cnpj?: string
  tomador_endereco?: string
  tomador_municipio?: string
  tomador_uf?: string
  tomador_cep?: string
  tomador_email?: string
  valor_servico: number
  aliquota_iss: number
  valor_iss: number
  valor_liquido: number
  status: NFServicoStatus
  data_emissao?: string
  pdf_url?: string
  motivo_cancelamento?: string
  created?: string
  updated?: string
}

export interface VendaB2B {
  id: string
  numero_venda?: string
  cliente_empresa_id?: string
  cliente_empresa_nome?: string
  especialista_id?: string
  especialista_nome?: string
  status_repasse?: 'pendente' | 'recebido' | string
  data_recebimento_comissao?: string
  parceiro_id: string
  parceiro_nome: string
  paciente_nome: string
  data_venda: string
  valor_total: number
  percentual_comissao?: number
  comissao_percentual?: number
  valor_comissao?: number
  valor_repasse?: number
  comissao_valor?: number
  status: VendaB2BStatus
  nf?: NFServicoComissao | null
  nf_servico?: NFServicoComissao
  itens?: ItemVendaB2B[] | string
  observacoes?: string
  created?: string
  updated?: string
}

export interface ClinicSettings {
  id: string
  nome?: string
  nome_clinica?: string
  cnpj?: string
  endereco?: string
  telefone?: string
  email?: string
  site?: string
  logo?: string
  logo_url?: string
  audiometro?: string
  calibracao?: string
  especialista_nome?: string
  especialista_crfa?: string
  created?: string
  updated?: string
}

// ===== Módulo NFS-e Config =====

export type NfseB2BProvedor = 'betta' | 'giss' | 'eiss' | 'simples_nacional'

export type NfseB2BAmbiente = 'homologacao' | 'producao'

export interface PolicyTexts {
  dados_cadastrais: { texto: string; versao?: string }
  dados_saude: { texto: string; versao?: string }
  marketing: { texto: string; versao?: string }
  pesquisa: { texto: string; versao?: string }
  politica_privacidade?: { texto: string; versao?: string }
}

// ===== Módulo de Templates de Laudos =====

export type ExamReportTipoExame =
  | 'audiometria'
  | 'imitanciometria'
  | 'teste_aparelho'
  | 'personalizado'
  | 'outro'

export const EXAM_REPORT_TIPO_LABELS: Record<ExamReportTipoExame, string> = {
  audiometria: 'Audiometria Tonal e Vocal',
  imitanciometria: 'Imitanciometria',
  teste_aparelho: 'Teste com Aparelho',
  personalizado: 'Personalizado',
  outro: 'Outro Exame',
}

export type LayoutElementType = string

export type ExamReportStatus = 'rascunho' | 'publicado' | 'arquivado'

export const EXAM_REPORT_STATUS_LABELS: Record<ExamReportStatus, string> = {
  rascunho: 'Rascunho',
  publicado: 'Publicado',
  arquivado: 'Arquivado',
}

export interface LayoutElementStyle {
  fontFamily?: string
  fontSize?: number
  fontWeight?: 'normal' | 'bold'
  fontStyle?: 'normal' | 'italic'
  textDecoration?: 'none' | 'underline'
  textAlign?: 'left' | 'center' | 'right'
  color?: string
  backgroundColor?: string
  borderColor?: string
  borderWidth?: number
  marginTop?: number
  marginBottom?: number
  marginLeft?: number
  marginRight?: number
  paddingTop?: number
  paddingBottom?: number
  paddingLeft?: number
  paddingRight?: number
  lineHeight?: number
  opacity?: number
  bold?: boolean
  italic?: boolean
  underline?: boolean
  align?: 'left' | 'center' | 'right'
  padding?: number
}

export interface LayoutElement {
  id: string
  type: string
  x: number
  y: number
  width: number
  height: number
  content?: string
  label?: string
  style?: LayoutElementStyle
  locked?: boolean
  visible?: boolean
  zIndex?: number
  fieldKey?: string
  imageUrl?: string
  tableData?: { rows: number; cols: number; headers?: string[]; cells?: string[][] }
  config?: Record<string, any>
  props?: Record<string, any>
}

export interface ExamReportTemplate {
  id: string
  nome_modelo: string
  tipo_exame: ExamReportTipoExame
  descricao?: string
  versao: number
  status: ExamReportStatus
  largura_pagina: number
  altura_pagina: number
  orientacao: 'retrato' | 'paisagem'
  margem_superior: number
  margem_inferior: number
  margem_esquerda: number
  margem_direita: number
  estrutura_layout: LayoutElement[]
  logo_id?: string
  logo_url?: string
  cabecalho_configuracao?: Record<string, any>
  rodape_configuracao?: Record<string, any>
  fonte_padrao?: string
  tamanho_fonte_padrao?: number
  cor_primaria?: string
  cor_secundaria?: string
  observacoes?: string
  criado_por?: string
  atualizado_por?: string
  publicado_por?: string
  publicado_em?: string
  created?: string
  updated?: string
}

export interface ExamReportTemplateVersion {
  id: string
  template_id: string
  numero_versao: number
  estrutura_layout: LayoutElement[]
  alterado_por?: string
  motivo_alteracao?: string
  created?: string
}

// ===== Módulo de Ordens de Serviço =====

export type OrdemServicoStatus =
  | 'aberta'
  | 'em_andamento'
  | 'aguardando_pecas'
  | 'concluida'
  | 'entregue'
  | 'cancelada'

export const ORDEM_SERVICO_STATUS_LABELS: Record<OrdemServicoStatus, string> = {
  aberta: 'Aberta',
  em_andamento: 'Em Andamento',
  aguardando_pecas: 'Aguardando Peças',
  concluida: 'Concluída',
  entregue: 'Entregue',
  cancelada: 'Cancelada',
}

export interface OrdemServico {
  id: string
  paciente_id: string
  paciente_nome: string
  aparelho_id?: string
  tipo_servico: string
  status: OrdemServicoStatus
  descricao: string
  valor: number
  data_entrada: string
  data_previsao?: string
  data_saida?: string
  tecnico?: string
  observacoes?: string
  created?: string
  updated?: string
}

// ===== Constantes de Status diversos =====

export const VENDA_STATUS_LABELS: Record<SaleStatus, string> = {
  Pendente: 'Pendente',
  Pago: 'Pago',
  Cancelado: 'Cancelado',
  Estornado: 'Estornado',
  Concluída: 'Concluída',
}

export const APARELHO_STATUS_LABELS: Record<HearingAidStatus, string> = {
  'Em uso': 'Em uso',
  Estoque: 'Estoque',
  Vendido: 'Vendido',
  'Em manutenção': 'Em manutenção',
}

export const PACIENTE_STATUS_LABELS: Record<string, string> = {
  Ativo: 'Ativo',
  'Em tratamento': 'Em tratamento',
  Inativo: 'Inativo',
}

export const AGENDAMENTO_STATUS_LABELS: Record<string, string> = {
  Agendado: 'Agendado',
  Confirmado: 'Confirmado',
  Realizado: 'Realizado',
  Faltou: 'Faltou',
  Cancelado: 'Cancelado',
}

// ===== Tipos auxiliares (mantidos para compatibilidade com módulos existentes) =====

export type FechamentoCaixaStatus = 'aberto' | 'fechado'

export type ContaReceberForma =
  | 'dinheiro'
  | 'debito'
  | 'credito'
  | 'pix'
  | 'convenio'
  | 'convênio'
  | 'boleto'
  | 'promissoria'
  | 'deposito'
  | 'transferencia'
  | 'cartao'
  | 'parcelado'

export type ContaReceberOrigem = 'pdv' | 'b2b'

export interface SystemAlert {
  id: string
  type: 'warranty' | 'installment' | 'stock' | 'followup' | 'calibration'
  subtype?: 'baixo' | 'zerado' | 'vencido' | 'vencendo'
  severity: 'info' | 'warning' | 'danger'
  title: string
  description: string
  linkUrl: string
  targetId?: string
  date?: string
}

export interface ItemVendaB2B {
  id: string
  venda_b2b_id: string
  produto_id: string
  produto_nome: string
  quantidade: number
  valor_unitario: number
  valor_subtotal: number
  created?: string
}

export interface NfseB2BConfig {
  id: string
  municipio: string
  uf: string
  codigo_municipio: string
  provedor: 'BETHA' | 'giss' | 'eiss' | 'simples_nacional'
  url_api: string
  login_api: string
  token_api: string
  inscricao_municipal: string
  aliquota_iss_padrao: number
  item_lista_servico: string
  discriminacao_padrao: string
  ambiente: 'homologacao' | 'producao'
  ativo: boolean
  created?: string
  updated?: string
}

// ===== Módulo de Auditoria =====

export type AuditModulo =
  | 'pacientes'
  | 'agenda'
  | 'prontuario'
  | 'audiometria'
  | 'vendas_pdv'
  | 'vendas_b2b'
  | 'caixa'
  | 'estoque'
  | 'configuracoes'
  | 'parceiros'
  | 'relatorios'

export type AuditAcaoTrail =
  | 'criar'
  | 'editar'
  | 'deletar'
  | 'cancelar'
  | 'estornar'
  | 'emitir_nf'
  | 'abrir_caixa'
  | 'fechar_caixa'
  | 'acessar'
  | 'exportar'
  | 'imprimir'
  | 'baixar_estoque_venda'
  | 'devolver_estoque_venda'
  | 'cancelar_venda_paga'

export interface AuditTrail {
  id: string
  usuario_id: string
  usuario_nome: string
  usuario_perfil: string
  modulo: AuditModulo
  acao: AuditAcaoTrail
  entidade_tipo: string
  entidade_id: string
  entidade_descricao: string
  alteracoes?: Record<string, unknown>
  ip?: string
  user_agent?: string
  contexto?: Record<string, unknown>
  created: string
  updated: string
}

export const AUDIT_MODULO_LABELS: Record<AuditModulo, string> = {
  pacientes: 'Pacientes',
  agenda: 'Agenda',
  prontuario: 'Prontuário',
  audiometria: 'Audiometria',
  vendas_pdv: 'Vendas PDV',
  vendas_b2b: 'Vendas B2B',
  caixa: 'Caixa',
  estoque: 'Estoque',
  configuracoes: 'Configurações',
  parceiros: 'Parceiros',
  relatorios: 'Relatórios',
}

export const AUDIT_ACAO_LABELS: Record<AuditAcaoTrail, string> = {
  criar: 'Criar',
  editar: 'Editar',
  deletar: 'Deletar',
  cancelar: 'Cancelar',
  estornar: 'Estornar',
  emitir_nf: 'Emitir NF',
  abrir_caixa: 'Abrir Caixa',
  fechar_caixa: 'Fechar Caixa',
  acessar: 'Acessar',
  exportar: 'Exportar',
  imprimir: 'Imprimir',
  baixar_estoque_venda: 'Baixa Estoque (Venda)',
  devolver_estoque_venda: 'Devolução Estoque (Venda)',
  cancelar_venda_paga: 'Cancelamento Venda Paga',
}

// ===== Módulo de Lembretes WhatsApp =====

export type LembreteStatusEnvio = 'pendente' | 'enviado' | 'falhou' | 'entregue' | 'lido'

export type LembreteStatusConfirmacao = 'aguardando' | 'confirmado' | 'cancelado' | 'sem_resposta'

export interface LembreteWhatsapp {
  id: string
  agendamento_id: string
  paciente_id: string
  telefone: string
  mensagem: string
  data_envio: string
  status_envio: LembreteStatusEnvio
  status_confirmacao: LembreteStatusConfirmacao
  data_confirmacao: string
  resposta_paciente: string
  tentativas: number
  error_message: string
  created: string
  updated: string
  agendamento?: {
    id: string
    date: string
    time: string
    patientName: string
    type: string
    status: string
  }
  paciente?: {
    id: string
    name: string
    mobile: string
    phone: string
  }
}

export const LEMBRETE_STATUS_ENVIO_LABELS: Record<LembreteStatusEnvio, string> = {
  pendente: 'Pendente',
  enviado: 'Enviado',
  falhou: 'Falhou',
  entregue: 'Entregue',
  lido: 'Lido',
}

export const LEMBRETE_STATUS_CONFIRMACAO_LABELS: Record<LembreteStatusConfirmacao, string> = {
  aguardando: 'Aguardando',
  confirmado: 'Confirmado',
  cancelado: 'Cancelado',
  sem_resposta: 'Sem Resposta',
}

export const LEMBRETE_STATUS_ENVIO_CLASS: Record<LembreteStatusEnvio, string> = {
  pendente: 'bg-slate-100 text-slate-700 border-slate-200',
  enviado: 'bg-blue-100 text-blue-700 border-blue-200',
  falhou: 'bg-red-100 text-red-700 border-red-200',
  entregue: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  lido: 'bg-green-100 text-green-700 border-green-200',
}

export const LEMBRETE_STATUS_CONFIRMACAO_CLASS: Record<LembreteStatusConfirmacao, string> = {
  aguardando: 'bg-slate-100 text-slate-700 border-slate-200',
  confirmado: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  cancelado: 'bg-red-100 text-red-700 border-red-200',
  sem_resposta: 'bg-amber-100 text-amber-700 border-amber-200',
}

export const PAGE_SIZES: Record<string, { largura: number; altura: number; label: string }> = {
  A4: { largura: 210, altura: 297, label: 'A4 (210 × 297 mm)' },
  'A4-L': { largura: 297, altura: 210, label: 'A4 Paisagem (297 × 210 mm)' },
  Carta: { largura: 215.9, altura: 279.4, label: 'Carta (215.9 × 279.4 mm)' },
  'Carta-L': { largura: 279.4, altura: 215.9, label: 'Carta Paisagem (279.4 × 215.9 mm)' },
  Ofício: { largura: 215.9, altura: 355.6, label: 'Ofício (215.9 × 355.6 mm)' },
}
