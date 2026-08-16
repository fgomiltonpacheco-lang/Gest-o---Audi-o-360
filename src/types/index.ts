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
  dissilabos: string
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

export type SaleStatus = 'Concluída' | 'Cancelada'

export interface Sale {
  id: string
  number: number
  patientId: string
  patientName: string
  date: string
  itemsDescription: string
  totalValue: number
  paymentMethod: PaymentMethod
  installmentsCount: number
  interestPercent: number
  firstDueDate?: string
  status: SaleStatus
  createdAt: string
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

export interface StockMovement {
  id: string
  stockItemId: string
  date: string
  type: 'Entrada' | 'Saída'
  quantity: number
  responsible: string
  reason?: string
  supplier?: string
  patientName?: string
  createdAt: string
}

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
  movements?: StockMovement[]
  createdAt: string
}

// ===== Módulo de Configurações da Clínica =====

/** Registro singleton (um por clínica) com os dados cadastrais. */
export interface ClinicSettings {
  id: string
  nome: string
  endereco: string
  telefone: string
  email: string
}

/** Equipamento clínico (audiômetro, etc.) com controle de calibração. */
export interface Equipment {
  id: string
  nome: string
  /** Data da última calibração (YYYY-MM-DD). */
  data_calibracao: string
  /** Próxima calibração (YYYY-MM-DD) — calculada: última + 1 ano. */
  proxima_calibracao: string
}

/** Status derivado da calibração do equipamento. */
export type EquipmentCalibrationStatus = 'valid' | 'expiring' | 'expired'

/**
 * Calcula o status de calibração de um equipamento.
 * - `expired`: próxima calibração no passado
 * - `expiring`: próxima calibração nos próximos 30 dias
 * - `valid`: fora da janela de alerta
 */
export function getEquipmentStatus(
  proxima_calibracao: string,
  ref: Date = new Date(),
): EquipmentCalibrationStatus {
  if (!proxima_calibracao) return 'valid'
  const next = new Date(proxima_calibracao + 'T00:00:00')
  if (isNaN(next.getTime())) return 'valid'
  const diffDays = Math.ceil((next.getTime() - ref.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return 'expired'
  if (diffDays <= 30) return 'expiring'
  return 'valid'
}

// Alertas do Sistema
export interface SystemAlert {
  id: string
  type: 'warranty' | 'followup' | 'installment' | 'stock' | 'calibration'
  severity: 'warning' | 'danger' | 'info'
  title: string
  description: string
  linkUrl: string
  targetId?: string
  date?: string
}
