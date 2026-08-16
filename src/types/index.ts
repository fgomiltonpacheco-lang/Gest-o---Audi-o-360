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

// ===== Módulo de Fechamento de Caixa =====
export type FechamentoCaixaStatus = 'aberto' | 'fechado'
export type FormaPagamentoCaixa = 'dinheiro' | 'debito' | 'credito' | 'pix' | 'convenio' | 'boleto'
export type MovimentacaoCaixaTipo = 'entrada' | 'saida'

export interface FechamentoCaixa {
  id: string
  data: string // YYYY-MM-DD
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
  status: FechamentoCaixaStatus
  observacao: string
  /** ID do usuário que abriu/fechou o caixa. */
  usuarioId?: string
  /** Nome do usuário (expand da relação `usuario`). */
  usuarioNome?: string
  created: string
  updated: string
}

export interface MovimentacaoCaixa {
  id: string
  fechamentoId: string
  tipo: MovimentacaoCaixaTipo
  valor: number
  descricao: string
  formaPagamento: FormaPagamentoCaixa
  data: string // YYYY-MM-DD
  /** Relação opcional com a venda de origem. */
  saleId?: string
  usuarioId?: string
  usuarioNome?: string
  created: string
}

// ===== Módulo de Vendas B2B (Business-to-Business) =====
export type VendaB2BStatus = 'pendente' | 'aprovada' | 'nf_emitida' | 'concluida' | 'cancelada'
export type NFServicoStatus = 'rascunho' | 'emitida' | 'cancelada' | 'cancelada_prefeitura'
export type NfseB2BProvedor = 'BETHA' | 'NOTABLU' | 'SIMPLISS' | 'GINFES' | 'ABRASF' | 'OUTRO'
export type NfseB2BAmbiente = 'homologacao' | 'producao'

/** Configuração da NFS-e de comissão B2B (singleton por clínica). */
export interface NfseB2BConfig {
  id: string
  municipio: string
  uf: string
  codigo_municipio: string
  provedor: NfseB2BProvedor
  url_api: string
  login_api: string
  token_api: string
  inscricao_municipal: string
  aliquota_iss_padrao: number
  item_lista_servico: string
  discriminacao_padrao: string
  ambiente: NfseB2BAmbiente
  ativo: boolean
  created: string
  updated: string
}
export type EmpresaParceiraStatus = 'ativo' | 'inativo'

/**
 * Status do repasse da comissão da empresa parceira para a Audição360,
 * após a emissão da NF de Promoção de Vendas.
 * - pendente: NF emitida, aguardando a empresa parceira repassar os 30%
 * - recebido: empresa parceira já repassou os 30% para a Audição360
 */
export type StatusRepasseComissao = 'pendente' | 'recebido'

export interface EmpresaParceira {
  id: string
  razao_social: string
  nome_fantasia: string
  cnpj: string
  inscricao_estadual: string
  email: string
  telefone: string
  endereco: string
  cidade: string
  estado: string
  cep: string
  status: EmpresaParceiraStatus
  created: string
  updated: string
}

export interface ItemVendaB2B {
  id: string
  venda_b2b_id: string
  produto_id: string
  produto_nome: string
  quantidade: number
  valor_unitario: number
  valor_subtotal: number
  created: string
}

export interface VendaB2B {
  id: string
  numero_venda: string
  cliente_empresa_id: string
  cliente_empresa_nome: string
  data_venda: string
  valor_total: number
  percentual_comissao: number
  valor_comissao: number
  valor_repasse: number
  status: VendaB2BStatus
  especialista_id: string
  especialista_nome: string
  observacoes: string
  /** Status do repasse da comissão após emissão da NF de Promoção de Vendas. */
  status_repasse?: StatusRepasseComissao
  /** Data (YYYY-MM-DD) em que o repasse da comissão foi confirmado. */
  data_recebimento_comissao?: string
  itens?: ItemVendaB2B[]
  nf?: NFServicoComissao | null
  created: string
  updated: string
}

export interface NFServicoComissao {
  id: string
  venda_b2b_id: string
  numero_nfse: string
  codigo_verificacao: string
  data_emissao: string
  valor_base: number
  aliquota_iss: number
  valor_iss: number
  valor_liquido: number
  discriminacao_servico: string
  item_lista_servico: string
  /** Dados do tomador (empresa parceira compradora) — auto-preenchidos, editáveis. */
  tomador_cnpj: string
  tomador_razao_social: string
  tomador_endereco: string
  tomador_municipio: string
  tomador_uf: string
  tomador_cep: string
  tomador_email: string
  motivo_cancelamento?: string
  pdf_url?: string
  status: NFServicoStatus
  created: string
  updated: string
}

// ===== Módulo de Controle de Inadimplência (Contas a Receber) =====

/** Forma de pagamento que gera uma conta a receber. */
export type ContaReceberForma = 'convênio' | 'boleto' | 'parcelado' | 'promissória'

/** Status de uma conta a receber. */
export type ContaReceberStatus =
  | 'a_receber'
  | 'recebido_parcial'
  | 'recebido_total'
  | 'vencido'
  | 'renegociado'
  | 'cancelado'

/** Origem da conta a receber. */
export type ContaReceberOrigem = 'pdv' | 'b2b'

/** Forma de recebimento de uma conta a receber. */
export type FormaRecebimento = 'dinheiro' | 'cartao' | 'pix' | 'transferencia' | 'cheque'

export interface ContaReceber {
  id: string
  venda_id: string
  venda_origem: ContaReceberOrigem
  paciente_id: string
  empresa_parceira_id: string
  cliente_nome: string
  cliente_telefone: string
  descricao: string
  valor_original: number
  valor_recebido: number
  valor_restante: number
  forma_pagamento: ContaReceberForma
  numero_parcelas: number
  parcela_atual: number
  data_venda: string // YYYY-MM-DD
  data_vencimento: string // YYYY-MM-DD
  data_recebimento?: string // YYYY-MM-DD
  status: ContaReceberStatus
  observacoes?: string
  /** ID da conta original (quando esta é fruto de renegociação). */
  conta_origem_id?: string
  motivo_renegociacao?: string
  motivo_cancelamento?: string
  usuario_id?: string
  created: string
  updated: string
}

export interface Recebimento {
  id: string
  conta_receber_id: string
  valor: number
  data_recebimento: string // YYYY-MM-DD
  forma_recebimento: FormaRecebimento
  observacoes?: string
  usuario_id?: string
  usuario_nome?: string
  created: string
}

export const CONTA_RECEBER_STATUS_LABELS: Record<ContaReceberStatus, string> = {
  a_receber: 'A Receber',
  recebido_parcial: 'Recebido Parcial',
  recebido_total: 'Recebido Total',
  vencido: 'Vencido',
  renegociado: 'Renegociado',
  cancelado: 'Cancelado',
}

export const CONTA_RECEBER_FORMA_LABELS: Record<ContaReceberForma, string> = {
  convênio: 'Convênio',
  boleto: 'Boleto',
  parcelado: 'Parcelado',
  promissória: 'Promissória',
}

export const FORMA_RECEBIMENTO_LABELS: Record<FormaRecebimento, string> = {
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  pix: 'PIX',
  transferencia: 'Transferência',
  cheque: 'Cheque',
}

// Alertas do Sistema
export interface SystemAlert {
  id: string
  type: 'warranty' | 'followup' | 'installment' | 'stock' | 'calibration' | 'lgpd'
  severity: 'warning' | 'danger' | 'info'
  title: string
  description: string
  linkUrl: string
  targetId?: string
  date?: string
}

// ===== LGPD — Consentimentos, Auditoria e Política de Privacidade =====

export type TipoConsentimento = 'dados_cadastrais' | 'dados_saude' | 'marketing' | 'pesquisa'
export type StatusConsentimento = 'aceito' | 'revogado' | 'expirado'

export interface Consentimento {
  id: string
  paciente_id: string
  tipo_consentimento: TipoConsentimento
  versao_termo: string
  data_aceitacao: string // datetime ISO
  ip_aceitacao: string
  usuario_id: string
  usuario_nome?: string
  status: StatusConsentimento
  data_revogacao?: string | null
  observacoes?: string
}

export type AuditAcao =
  | 'acessou_prontuario'
  | 'editou_prontuario'
  | 'editou_exame'
  | 'editou_evolucao'
  | 'editou_anamnese'
  | 'editou_aparelhos'
  | 'cancelou_venda'
  | 'estornou_venda'
  | 'editou_financeiro'
  | 'acessou_dados_sensiveis'

export interface AuditLog {
  id: string
  usuario_id: string
  usuario_nome: string
  acao: AuditAcao
  paciente_id?: string | null
  paciente_nome?: string
  recurso: string
  recurso_id?: string | null
  detalhes?: string // JSON { before, after }
  ip: string
  user_agent: string
  created_at: string
}

/** Textos padrão dos termos de consentimento (LGPD). */
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

/** Textos-padrão exibidos quando não há termo configurado pelo admin. */
export const TEXTO_PADRAO_CONSENTIMENTO: Record<TipoConsentimento, string> = {
  dados_cadastrais:
    'CONSENTIMENTO PARA TRATAMENTO DE DADOS CADASTRAIS (LGPD - Lei 13.709/2018)\n\n' +
    'Eu, abaixo identificado, autorizo a AUDIÇÃO360 a coletar, armazenar e tratar meus dados cadastrais ' +
    '(nome, CPF, data de nascimento, endereço, telefones e e-mail), exclusivamente para fins de cadastro, ' +
    'agendamento e comunicação relacionados aos serviços audiológicos prestados.\n\n' +
    'Estou ciente de que posso solicitar, a qualquer momento, a visualização, correção ou exclusão dos meus dados, ' +
    'bem como revogar este consentimento, mediante solicitação por escrito à clínica.',
  dados_saude:
    'CONSENTIMENTO PARA TRATAMENTO DE DADOS DE SAÚDE (LGPD - Lei 13.709/2018)\n\n' +
    'Eu, abaixo identificado, autorizo a AUDIÇÃO360 a coletar, armazenar e tratar meus dados de saúde ' +
    '(histórico clínico, resultados de exames audiológicos, anamnese, evolução e demais informações sensíveis), ' +
    'necessários à prestação de cuidados e serviços audiológicos.\n\n' +
    'Estou ciente de que os dados sensíveis serão tratados com sigilo e somente compartilhados quando exigido por ' +
    'lei ou mediante autorização expressa. Posso revogar este consentimento a qualquer momento.',
  marketing:
    'CONSENTIMENTO PARA USO DE DADOS EM MARKETING (LGPD - Lei 13.709/2018)\n\n' +
    'Eu, abaixo identificado, autorizo a AUDIÇÃO360 a utilizar meus dados de contato (e-mail, telefone e WhatsApp) ' +
    'para o envio de comunicações promocionais, novidades e ofertas relacionadas a produtos e serviços auditivos.\n\n' +
    'Estou ciente de que posso cancelar o recebimento dessas comunicações a qualquer momento, bastando solicitar ' +
    'pelo canal informado na mensagem ou diretamente à clínica.',
  pesquisa:
    'CONSENTIMENTO PARA USO DE DADOS EM PESQUISA (LGPD - Lei 13.709/2018)\n\n' +
    'Eu, abaixo identificado, autorizo a AUDIÇÃO360 a utilizar meus dados, de forma anônima ou agregada, ' +
    'em estudos, pesquisas e estatísticas clínicas, com finalidade acadêmica ou de aprimoramento dos serviços.\n\n' +
    'Estou ciente de que minha identificação não será divulgada e que posso revogar este consentimento a qualquer momento.',
}

export interface PolicyTexts {
  dados_cadastrais: { texto: string; versao: string }
  dados_saude: { texto: string; versao: string }
  marketing: { texto: string; versao: string }
  pesquisa: { texto: string; versao: string }
  politica_privacidade: string
}

// ===== Trilha de Auditoria (audit_trail) =====

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

export interface AuditTrailAlteracao {
  before: unknown
  after: unknown
}

export interface AuditTrail {
  id: string
  timestamp: string
  usuario_id?: string
  usuario_nome: string
  usuario_perfil?: string
  modulo: AuditModulo
  acao: AuditAcaoTrail
  entidade_tipo: string
  entidade_id: string
  entidade_descricao: string
  alteracoes: Record<string, AuditTrailAlteracao>
  ip: string
  user_agent: string
  contexto?: Record<string, unknown> | null
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
}
