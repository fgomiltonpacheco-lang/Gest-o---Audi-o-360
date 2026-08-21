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

export interface StockItem {
  id: string
  name: string
  description?: string
  quantity: number
  min_quantity?: number
  unit_price: number
  category?: string
  tipo_fiscal?: 'produto' | 'servico'
  clinic_id?: string
  created: string
  updated: string
}

export interface StockMovement {
  id: string
  item_id: string
  quantity: number
  type: 'entrada' | 'saida'
  reason?: string
  appointment_id?: string
  created: string
  clinic_id?: string
}

export type MovimentacaoCaixaTipo = 'entrada' | 'saida'
export type FormaPagamentoCaixa =
  | 'dinheiro'
  | 'pix'
  | 'cartao_credito'
  | 'cartao_debito'
  | 'boleto'
  | 'convenio'
  | 'transferencia'

export interface MovimentacaoCaixa {
  id: string
  descricao: string
  tipo: MovimentacaoCaixaTipo
  valor: number
  forma_pagamento: FormaPagamentoCaixa
  data: string
  profissional_id?: string
  appointment_id?: string
  sale_id?: string
  clinic_id?: string
  created: string
  updated: string
}

export interface FechamentoCaixa {
  id: string
  data_fechamento: string
  profissional_id: string
  saldo_inicial: number
  total_entradas: number
  total_saidas: number
  saldo_final: number
  observacoes?: string
  clinic_id?: string
  created: string
}

export interface NotaFiscalItem {
  descricao: string
  quantidade: number
  valor_unitario: number
  cfop?: string
  ncm?: string
  cnae?: string
  tipo: 'produto' | 'servico'
}

export interface NotaFiscal {
  id: string
  numero: string
  serie?: string
  data_emissao: string
  paciente_id: string
  paciente_nome?: string
  paciente_cpf?: string
  sale_id?: string
  tipo: 'nfe' | 'nfse' | 'ambos'
  itens: NotaFiscalItem[]
  valor_total_produtos: number
  valor_total_servicos: number
  valor_total: number
  chave_acesso?: string
  status: 'pendente' | 'autorizada' | 'cancelada'
  observacoes?: string
  clinic_id?: string
  created: string
  updated: string
}
