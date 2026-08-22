export type UserRole = 'admin' | 'profissional' | 'secretaria'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  avatar?: string
  crmCrfa?: string
  /** Marca o dono do SaaS (Super Admin) — vê o painel de gestão multi-clínicas. */
  isSuperAdmin?: boolean
  /** ID da clínica (tenant) à qual o usuário pertence. */
  clinicaId?: string
  /** Indica se a clínica já concluiu o wizard de onboarding. */
  onboardingCompleted?: boolean
}

// ============================================================
// Módulo SaaS — Gestão Multi-clínicas (Painel Super Admin)
// ============================================================

/** Status de uma clínica no SaaS. */
export type ClinicaStatus = 'trial' | 'ativo' | 'inadimplente' | 'cancelado'

export const CLINICA_STATUS_LABELS: Record<ClinicaStatus, string> = {
  trial: 'Em Trial',
  ativo: 'Ativo',
  inadimplente: 'Inadimplente',
  cancelado: 'Cancelado',
}

export const CLINICA_STATUS_CLASS: Record<ClinicaStatus, string> = {
  trial: 'bg-blue-100 text-blue-700 border-blue-300',
  ativo: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  inadimplente: 'bg-red-100 text-red-700 border-red-300',
  cancelado: 'bg-slate-200 text-slate-600 border-slate-300',
}

/** Funcionalidades disponíveis nos planos do SaaS. */
export const PLANO_FUNCIONALIDADE_LABELS: Record<string, string> = {
  agenda: 'Agenda',
  pacientes: 'Pacientes',
  prontuario: 'Prontuário',
  exames: 'Exames',
  financeiro: 'Financeiro',
  aparelhos: 'Aparelhos Auditivos',
  estoque: 'Estoque',
  relatorios: 'Relatórios',
  laudos_pdf: 'Laudos em PDF',
  b2b: 'Vendas B2B',
  auditoria: 'Auditoria',
  ia: 'Inteligência Artificial',
  chat: 'Chat Interno',
  nfse: 'NFS-e',
  contas_receber: 'Contas a Receber',
  despesas: 'Despesas',
  lembretes_whatsapp: 'Lembretes WhatsApp',
}

/** Plano de assinatura do SaaS. */
export interface Plano {
  id: string
  nome: string
  preco_mensal: number
  funcionalidades: string[]
  max_profissionais: number
  max_pacientes: number
  ativo: boolean
  created: string
  updated: string
}

/** Clínica cadastrada no SaaS. */
export interface Clinica {
  id: string
  nome: string
  slug?: string
  email?: string
  email_admin?: string
  cnpj?: string
  telefone?: string
  endereco?: string
  plano_id?: string
  plano_nome?: string
  plano_preco?: number
  status: ClinicaStatus
  trial_ends?: string
  created: string
  updated: string
}

/** Estatísticas agregadas para o Dashboard do Super Admin. */
export interface SaaSStats {
  total_clinicas: number
  ativas: number
  trial: number
  inadimplentes: number
  canceladas: number
  receita_mensal: number
  novas_30dias: number
}

/** Status de um pagamento de mensalidade no SaaS. */
export type PagamentoSaaSStatus = 'pago' | 'pendente' | 'atrasado' | 'trial'

export const PAGAMENTO_SAAS_STATUS_LABELS: Record<PagamentoSaaSStatus, string> = {
  pago: 'Pago',
  pendente: 'Pendente',
  atrasado: 'Atrasado',
  trial: 'Trial',
}

export const PAGAMENTO_SAAS_STATUS_CLASS: Record<PagamentoSaaSStatus, string> = {
  pago: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  pendente: 'bg-amber-100 text-amber-700 border-amber-300',
  atrasado: 'bg-red-100 text-red-700 border-red-300',
  trial: 'bg-blue-100 text-blue-700 border-blue-300',
}

export type PagamentoSaaSForma = 'pix' | 'boleto' | 'cartao' | 'transferencia' | 'dinheiro'

export const PAGAMENTO_SAAS_FORMA_LABELS: Record<PagamentoSaaSForma, string> = {
  pix: 'PIX',
  boleto: 'Boleto',
  cartao: 'Cartão',
  transferencia: 'Transferência',
  dinheiro: 'Dinheiro',
}

/** Pagamento de mensalidade de uma clínica (controle do Super Admin). */
export interface PagamentoSaaS {
  id: string
  clinica_id: string
  clinica_nome?: string
  plano_id?: string
  plano_nome?: string
  valor: number
  data_vencimento: string
  data_pagamento?: string
  forma_pagamento?: PagamentoSaaSForma
  status: PagamentoSaaSStatus
  referencia?: string
  observacoes?: string
  created: string
  updated: string
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

export type TipoConsentimento = 'dados_cadastrais' | 'dados_saude' | 'marketing' | 'pesquisa'

export interface Consentimento {
  id: string
  paciente_id: string
  tipo_consentimento: TipoConsentimento
  texto_consentimento?: string
  status: 'ativo' | 'revogado' | 'aceito' | string
  data_criacao: string
  data_aceitacao?: string
  data_revogacao?: string
  usuario_nome?: string
  observacoes?: string
  revogado_em?: string
  motivo_revogacao?: string
  clinic_id?: string
  created?: string
  updated?: string
}

export const ROTULO_CONSENTIMENTO: Record<TipoConsentimento, string> = {
  dados_cadastrais: 'Dados Cadastrais',
  dados_saude: 'Dados de Saúde',
  marketing: 'Marketing',
  pesquisa: 'Pesquisa',
}

export const TIPOS_CONSENTIMENTO: TipoConsentimento[] = [
  'dados_cadastrais',
  'dados_saude',
  'marketing',
  'pesquisa',
]

export const TEXTO_PADRAO_CONSENTIMENTO = {
  dados_cadastrais:
    'Autorizo a Audição360 a coletar e armazenar meus dados cadastrais (nome, CPF, RG, data de nascimento, endereço, telefone e e-mail) para fins de identificação, contato e faturamento dos serviços prestados.',
  dados_saude:
    'Autorizo expressamente a Audição360 a coletar, registrar e armazenar meus dados de saúde auditiva (exames, diagnósticos, laudos, anamnese e evolução clínica) para fins de acompanhamento clínico e emissão de laudos.',
  marketing:
    'Autorizo a Audição360 a utilizar meus dados de contato (telefone e e-mail) para envio de comunicações sobre agendamentos, retornos, novidades e promoções relacionadas aos serviços da clínica.',
  pesquisa:
    'Autorizo a utilização anonimizada dos meus dados de saúde auditiva para fins de pesquisa, ensino e publicações científicas, sem qualquer identificação pessoal.',
}

export interface StockItemMovement {
  id: string
  stockItemId?: string
  date: string
  type: 'Entrada' | 'Saída' | 'entrada' | 'saida'
  quantity: number
  responsible: string
  reason?: string
  supplier?: string
  patient?: string
  patientName?: string
  saleId?: string
  createdAt?: string
}

export interface StockItem {
  id: string
  name: string
  description?: string
  brand?: string
  model?: string
  color?: string
  category: StockCategory | string
  batterySize?: BatterySize
  accessorySubcategory?: AccessorySubcategory
  quantity?: number
  minQuantity?: number
  min_quantity?: number
  currentQuantity?: number
  estoqueMinimo?: number
  dataValidade?: string
  lote?: string
  fabricante?: string
  code?: string
  sku?: string
  diasAlertaValidade?: number
  categoria?: InventoryCategoria | string
  unidadeMedida?: string
  supplier?: string
  costPrice?: number
  salePrice?: number
  unit_price?: number
  notes?: string
  movements?: StockItemMovement[]
  tipo_fiscal?: 'produto' | 'servico'
  clinic_id?: string
  created?: string
  updated?: string
  createdAt?: string
}

// === Auditoria ===
export type AuditModulo =
  | 'pacientes'
  | 'agendamentos'
  | 'agenda'
  | 'prontuarios'
  | 'prontuario'
  | 'exames'
  | 'audiometria'
  | 'estoque'
  | 'financeiro'
  | 'aparelhos'
  | 'configuracoes'
  | 'vendas'
  | 'vendas_pdv'
  | 'vendas_b2b'
  | 'procedures'
  | 'convenios'
  | 'clinica'
  | 'caixa'
  | 'parceiros'
  | 'relatorios'
  | 'despesas'

export const AUDIT_MODULO_LABELS: Record<AuditModulo, string> = {
  pacientes: 'Pacientes',
  agendamentos: 'Agendamentos',
  agenda: 'Agenda',
  prontuarios: 'Prontuários',
  prontuario: 'Prontuário',
  exames: 'Exames',
  audiometria: 'Audiometria',
  estoque: 'Estoque',
  financeiro: 'Financeiro',
  aparelhos: 'Aparelhos Auditivos',
  configuracoes: 'Configurações',
  vendas: 'Vendas',
  vendas_pdv: 'Vendas PDV',
  vendas_b2b: 'Vendas B2B',
  procedures: 'Procedimentos',
  convenios: 'Convênios',
  clinica: 'Clínica',
  caixa: 'Caixa',
  parceiros: 'Empresas Parceiras',
  relatorios: 'Relatórios',
  despesas: 'Despesas',
}

export type AuditAcao =
  | 'create'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | 'export'
  | 'print'
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

export const AUDIT_ACAO_LABELS: Record<string, string> = {
  create: 'Criação',
  update: 'Atualização',
  delete: 'Exclusão',
  login: 'Login',
  logout: 'Logout',
  export: 'Exportação',
  print: 'Impressão',
  criar: 'Criação',
  editar: 'Edição',
  deletar: 'Exclusão',
  cancelar: 'Cancelamento',
  estornar: 'Estorno',
  emitir_nf: 'Emissão de NF',
  abrir_caixa: 'Abertura de Caixa',
  fechar_caixa: 'Fechamento de Caixa',
  acessar: 'Acesso',
  exportar: 'Exportação',
  imprimir: 'Impressão',
  baixar_estoque_venda: 'Baixa de Estoque (Venda)',
  devolver_estoque_venda: 'Devolução ao Estoque (Venda)',
  cancelar_venda_paga: 'Cancelamento de Venda Paga',
}

export interface AuditLog {
  id: string
  acao: AuditAcao
  entidade: string
  entidade_id?: string
  descricao: string
  usuario_id: string
  usuario_nome?: string
  clinic_id?: string
  created: string
}

export interface AuditTrail {
  id: string
  created: string
  updated?: string
  usuario_id?: string
  usuario_nome?: string
  usuario_perfil?: string
  modulo: AuditModulo
  acao: AuditAcaoTrail
  entidade_tipo: string
  entidade_id: string
  entidade_descricao: string
  alteracoes?: Record<string, { before: unknown; after: unknown }>
  contexto?: Record<string, unknown>
  ip?: string
  user_agent?: string
  clinica_id?: string
}

// === VendaItem (usado em vendas) ===
export interface VendaItem {
  id?: string
  descricao: string
  quantidade: number
  valor_unitario: number
  valor_total: number
  tipo_fiscal?: 'produto' | 'servico'
  produto_id?: string
  procedimento_id?: string
}

// === Venda ===
export type VendaStatus = 'pendente' | 'concluida' | 'cancelada'

export interface Venda {
  id: string
  paciente_id: string
  paciente_nome?: string
  professional_id?: string
  professional_name?: string
  appointment_id?: string
  itens: VendaItem[]
  valor_total: number
  valor_pago?: number
  status: VendaStatus
  data: string
  observacoes?: string
  clinic_id?: string
  created: string
  updated: string
}

// === CONVENIOS (usado em pacientes) ===
export type Convenio =
  | 'particular'
  | 'unimed'
  | 'bradesco_saude'
  | 'amil'
  | 'sulamerica'
  | 'porto_seguro'
  | 'hapvida'
  | 'intermedica'
  | 'outros'

export const CONVENIO_LABELS: Record<Convenio, string> = {
  particular: 'Particular',
  unimed: 'Unimed',
  bradesco_saude: 'Bradesco Saúde',
  amil: 'Amil',
  sulamerica: 'SulAmérica',
  porto_seguro: 'Porto Seguro',
  hapvida: 'Hapvida',
  intermedica: 'Intermédica',
  outros: 'Outros',
}

// === TIPO DE ATENDIMENTO (usado em agendamentos) ===
export type TipoAtendimento =
  | 'consulta'
  | 'exame'
  | 'retorno'
  | 'protese'
  | 'molde'
  | 'manutencao'
  | 'outros'

export const TIPO_ATENDIMENTO_LABELS: Record<TipoAtendimento, string> = {
  consulta: 'Consulta',
  exame: 'Exame',
  retorno: 'Retorno',
  protese: 'Prótese',
  molde: 'Molde',
  manutencao: 'Manutenção',
  outros: 'Outros',
}

// === STATUS DE AGENDAMENTO ===
export type AgendamentoStatus =
  | 'agendado'
  | 'confirmado'
  | 'em_atendimento'
  | 'finalizado'
  | 'cancelado'
  | 'faltou'

export const AGENDAMENTO_STATUS_LABELS: Record<AgendamentoStatus, string> = {
  agendado: 'Agendado',
  confirmado: 'Confirmado',
  em_atendimento: 'Em Atendimento',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
  faltou: 'Faltou',
}

// === GARANTIA ===
export type GarantiaStatus = 'ativa' | 'expirada' | 'prestes_a_expirar'

export interface Garantia {
  id: string
  paciente_id: string
  paciente_nome?: string
  aparelho_id?: string
  aparelho_descricao?: string
  data_inicio: string
  data_fim: string
  status: GarantiaStatus
  observacoes?: string
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
  | 'debito'
  | 'credito'
  | 'pix'
  | 'convenio'
  | 'boleto'
  | 'cartao_credito'
  | 'cartao_debito'
  | 'cartao'
  | 'transferencia'

export interface MovimentacaoCaixa {
  id: string
  descricao: string
  tipo: MovimentacaoCaixaTipo
  valor: number
  forma_pagamento?: FormaPagamentoCaixa
  formaPagamento?: FormaPagamentoCaixa
  data: string
  fechamentoId?: string
  fechamento_id?: string
  profissional_id?: string
  usuarioId?: string
  usuarioNome?: string
  appointment_id?: string
  sale_id?: string
  clinic_id?: string
  created?: string
  updated?: string
}

export type FechamentoCaixaStatus = 'aberto' | 'fechado'

export const FECHAMENTO_CAIXA_STATUS_LABELS: Record<FechamentoCaixaStatus, string> = {
  aberto: 'Aberto',
  fechado: 'Fechado',
}

export interface FechamentoCaixa {
  id: string
  data?: string
  data_fechamento?: string
  profissional_id?: string
  saldo_inicial?: number
  saldoInicial?: number
  saldo_final?: number
  saldoFinal?: number
  total_dinheiro?: number
  totalDinheiro?: number
  total_debito?: number
  totalDebito?: number
  total_credito?: number
  totalCredito?: number
  total_pix?: number
  totalPix?: number
  total_convenio?: number
  totalConvenio?: number
  total_boleto?: number
  totalBoleto?: number
  total_entradas?: number
  totalEntradas?: number
  total_saidas?: number
  totalSaidas?: number
  total_vendas?: number
  totalVendas?: number
  quantidade_vendas?: number
  quantidadeVendas?: number
  diferenca?: number
  status?: FechamentoCaixaStatus | string
  observacao?: string
  observacoes?: string
  usuarioId?: string
  usuarioNome?: string
  clinic_id?: string
  created?: string
  updated?: string
}

export interface NotaFiscalItem {
  id?: string
  codigo?: string
  nome?: string
  descricao: string
  quantidade: number
  valor_unitario: number
  valor_total?: number
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

// === Despesas ===
export type DespesaCategoria =
  | 'aluguel'
  | 'energia'
  | 'agua'
  | 'internet'
  | 'folha'
  | 'salario'
  | 'comissao'
  | 'fornecedores'
  | 'fornecedor'
  | 'marketing'
  | 'impostos'
  | 'tributo'
  | 'imposto'
  | 'utilidade'
  | 'utilidades'
  | 'software'
  | 'manutencao'
  | 'outros'

export const DESPESA_CATEGORIA_LABELS: Record<DespesaCategoria, string> = {
  aluguel: 'Aluguel',
  energia: 'Energia Elétrica',
  agua: 'Água / Saneamento',
  internet: 'Internet / Telefonia',
  folha: 'Folha de Pagamento',
  salario: 'Salário / Pró-labore',
  comissao: 'Comissão',
  fornecedores: 'Fornecedores',
  fornecedor: 'Fornecedor',
  marketing: 'Marketing / Publicidade',
  impostos: 'Impostos',
  tributo: 'Tributos / Taxas',
  imposto: 'Imposto',
  utilidade: 'Utilidades',
  utilidades: 'Utilidades (água/luz/internet)',
  software: 'Software / Sistemas',
  manutencao: 'Manutenção',
  outros: 'Outros',
}

export type DespesaStatus = 'a_pagar' | 'pago' | 'pendente' | 'vencido' | 'atrasado' | 'cancelado'

export const DESPESA_STATUS_LABELS: Record<DespesaStatus, string> = {
  a_pagar: 'A Pagar',
  pago: 'Pago',
  pendente: 'Pendente',
  vencido: 'Vencido',
  atrasado: 'Atrasado',
  cancelado: 'Cancelado',
}

export type DespesaFormaPagamento =
  | 'dinheiro'
  | 'cartao'
  | 'pix'
  | 'transferencia'
  | 'boleto'
  | 'cheque'

export const DESPESA_FORMA_PAGAMENTO_LABELS: Record<DespesaFormaPagamento, string> = {
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  pix: 'PIX',
  transferencia: 'Transferência Bancária',
  boleto: 'Boleto Bancário',
  cheque: 'Cheque',
}

export interface Despesa {
  id: string
  descricao: string
  categoria: DespesaCategoria
  valor: number
  data?: string
  data_vencimento?: string
  data_pagamento?: string
  forma_pagamento?: DespesaFormaPagamento
  status?: DespesaStatus
  valor_pago?: number
  pago?: boolean
  comprovante?: string
  observacoes?: string
  motivo_cancelamento?: string
  usuario_id?: string
  movimentacao_caixa_id?: string
  clinic_id?: string
  created: string
  updated: string
}

// === ClinicSettings ===
export interface ClinicSettings {
  id?: string
  nome?: string
  nome_clinica?: string
  endereco?: string
  telefone?: string
  email?: string
  logo?: string
  logo_url?: string
  cnpj?: string
  inscricao_estadual?: string
  inscricao_municipal?: string
  certificado_digital?: string
  certificado_digital_url?: string
  template_audiometria?: string
  template_audiometria_url?: string
  template_imitanciometria?: string
  template_imitanciometria_url?: string
  /**
   * Coordenadas calibradas (em pontos) do template de audiometria.
   * Serialização de `AudiometriaCoordinates` (ver pdfTemplateFiller.ts).
   * Quando ausente/vazio, o preenchimento usa os defaults A4.
   */
  coordenadas_audiometria?: Record<string, unknown> | null
  /**
   * Coordenadas calibradas (em pontos) do template de imitanciometria.
   * Serialização de `ImitanciometriaCoordinates` (ver pdfTemplateFiller.ts).
   * Quando ausente/vazio, o preenchimento usa os defaults A4.
   */
  coordenadas_imitanciometria?: Record<string, unknown> | null
  audiometro?: string
  calibracao?: string
  calibracao_audiometro?: string
  especialista_nome?: string
  especialista_crfa?: string
  site?: string
}

// === Equipment ===
export interface Equipment {
  id: string
  nome?: string
  name?: string
  tipo?: string
  marca?: string
  modelo?: string
  serial?: string
  data_calibracao?: string
  proxima_calibracao?: string
  calibration_date?: string
  next_calibration?: string
  status?: 'ativo' | 'inativo' | 'manutencao' | string
  clinic_id?: string
  created?: string
  updated?: string
}

// === PolicyTexts ===
export interface PolicyTexts {
  privacidade?: string
  termos?: string
  consentimento?: string
  politica_privacidade?: string
  dados_cadastrais?: string | { texto: string; finalidade?: string; base_legal?: string }
  dados_saude?: string | { texto: string; finalidade?: string; base_legal?: string }
  marketing?: string | { texto: string; finalidade?: string; base_legal?: string }
  pesquisa?: string | { texto: string; finalidade?: string; base_legal?: string }
}

// === NFS-e B2B ===
export type NfseB2BProvedor = 'BETHA' | 'padrao' | 'issnet' | 'giss' | 'simples'

export type NfseB2BAmbiente = 'producao' | 'homologacao'

// === Exam Reports ===
export type ExamReportTipoExame =
  | 'audiometria'
  | 'imitanciometria'
  | 'otoscopia'
  | 'teste_aparelho'
  | 'personalizado'

export const EXAM_REPORT_TIPO_LABELS: Record<ExamReportTipoExame, string> = {
  audiometria: 'Audiometria',
  imitanciometria: 'Imitanciometria',
  otoscopia: 'Otoscopia',
  teste_aparelho: 'Teste de Aparelho',
  personalizado: 'Personalizado',
}

export type ExamReportStatus = 'rascunho' | 'publicado' | 'arquivado' | 'finalizado' | 'assinado'

export const EXAM_REPORT_STATUS_LABELS: Record<string, string> = {
  rascunho: 'Rascunho',
  publicado: 'Publicado',
  arquivado: 'Arquivado',
  finalizado: 'Finalizado',
  assinado: 'Assinado',
}

export type ExamReportOrientacao = 'retrato' | 'paisagem'

export type LayoutElementType =
  | 'text'
  | 'texto'
  | 'field'
  | 'campo'
  | 'image'
  | 'imagem'
  | 'line'
  | 'linha'
  | 'rectangle'
  | 'retangulo'
  | 'table'
  | 'tabela'
  | 'audiogram'
  | 'audiograma'
  | 'timpanogram'
  | 'timpanograma'
  | 'signature'
  | 'assinatura'
  | 'section'
  | 'secao'
  | 'watermark'
  | 'marca_dagua'
  | 'divider'
  | 'divisor'
  | 'grafico'
  | 'checkbox'

export interface LayoutElementStyle {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  fontSize?: number
  fontFamily?: string
  align?: 'left' | 'center' | 'right' | 'justify'
  color?: string
  backgroundColor?: string | null
  borderColor?: string
  borderWidth?: number | string
  padding?: number | string
  lineHeight?: number | string
  [key: string]: unknown
}

export interface LayoutElementProps {
  content?: string
  contentType?: 'static' | 'dynamic'
  dynamicField?: string
  fallback?: string
  src?: string
  opacity?: number
  fit?: 'contain' | 'cover' | 'fill'
  direction?: 'horizontal' | 'vertical'
  color?: string
  thickness?: number
  columns?: { label: string; field: string; width: number }[]
  rows?: Record<string, any>[]
  headerBgColor?: string
  alternateRowColor?: string
  borderColor?: string
  fontSize?: number
  dynamicSource?: string | null
  mode?: string
  showBone?: boolean
  showAir?: boolean
  showLegend?: boolean
  lineThickness?: number
  odColor?: string
  oeColor?: string
  showAbsentPoints?: boolean
  frequencies?: number[]
  intensityRange?: number[]
  who?: string
  label?: string
  showName?: boolean
  showCrfa?: boolean
  lineWidth?: number
  title?: string
  children?: string[]
  collapsible?: boolean
  titleBgColor?: string
  fieldPath?: string
  showLabel?: boolean
  [key: string]: unknown
}

export interface LayoutElement {
  id: string
  type: LayoutElementType
  label: string
  field?: string
  x: number
  y: number
  width: number
  height: number
  locked?: boolean
  visible?: boolean
  zIndex?: number
  style?: LayoutElementStyle
  options?: string[]
  props?: LayoutElementProps & Record<string, any>
  content?: string
  [key: string]: unknown
}

export interface ExamReportTemplate {
  id: string
  nome_modelo: string
  nome?: string
  tipo_exame: ExamReportTipoExame
  descricao?: string
  versao?: number
  status: ExamReportStatus
  largura_pagina: number
  altura_pagina: number
  orientacao: ExamReportOrientacao
  margem_superior: number
  margem_inferior: number
  margem_esquerda: number
  margem_direita: number
  estrutura_layout: LayoutElement[]
  elementos?: LayoutElement[]
  logo_url?: string
  cabecalho_configuracao?: Record<string, unknown>
  rodape_configuracao?: Record<string, unknown>
  fonte_padrao?: string
  tamanho_fonte_padrao?: number
  cor_primaria?: string
  cor_secundaria?: string
  observacoes?: string
  criado_por?: string
  atualizado_por?: string
  publicado_por?: string
  publicado_em?: string
  clinic_id?: string
  clinica_id?: string
  created?: string
  updated?: string
}

export interface ExamReportTemplateVersion {
  id: string
  template_id: string
  numero_versao: number
  version?: number
  estrutura_layout: LayoutElement[]
  elementos?: LayoutElement[]
  alterado_por?: string
  motivo_alteracao?: string
  created?: string
}

export interface ItemVendaB2B {
  id: string
  venda_b2b_id?: string
  produto_id?: string
  produto_nome?: string
  quantidade: number
  valor_unitario: number
  valor_subtotal: number
  created?: string
}

// === Vendas B2B ===
export type VendaB2BStatus =
  | 'pendente'
  | 'aprovado'
  | 'aprovada'
  | 'concluida'
  | 'entregue'
  | 'cancelado'
  | 'cancelada'
  | 'nf_emitida'

export interface VendaB2B {
  id: string
  empresa_id?: string
  cliente_empresa_id?: string
  cliente_empresa_nome?: string
  parceiro_id?: string
  parceiro_nome?: string
  paciente_id?: string
  paciente_nome?: string
  numero_venda?: string | number
  itens?: ItemVendaB2B[] | NFServicoComissao[]
  valor_total: number
  percentual_comissao?: number
  comissao_percentual?: number
  valor_comissao?: number
  comissao_valor?: number
  valor_repasse?: number
  status: VendaB2BStatus
  status_repasse?: 'pendente' | 'recebido' | string
  data_recebimento_comissao?: string
  especialista_id?: string
  especialista_nome?: string
  data?: string
  data_venda?: string
  observacoes?: string
  nf?: NFServicoComissao | null
  clinic_id?: string
  created?: string
  updated?: string
}

export type NFServicoStatus =
  | 'pendente'
  | 'faturado'
  | 'emitida'
  | 'cancelado'
  | 'cancelada'
  | 'cancelada_prefeitura'
  | 'rascunho'

export interface NFServicoComissao {
  id: string
  venda_id?: string
  venda_b2b_id?: string
  parceiro_id?: string
  numero_nf?: string
  valor_servico?: number
  descricao?: string
  quantidade?: number
  valor_unitario?: number
  valor_total?: number
  comissao_percentual?: number
  comissao_valor?: number
  profissional_id?: string
  status: NFServicoStatus | string
  pdf_url?: string
  motivo_cancelamento?: string
  tipo_fiscal?: 'produto' | 'servico'
  tomador_razao_social?: string
  tomador_cnpj?: string
  tomador_endereco?: string
  tomador_municipio?: string
  tomador_uf?: string
  tomador_cep?: string
  tomador_email?: string
  numero_nfse?: string
  codigo_verificacao?: string
  data_emissao?: string
  discriminacao_servico?: string
  item_lista_servico?: string
  valor_base?: number
  aliquota_iss?: number
  valor_iss?: number
  valor_liquido?: number
  created?: string
  updated?: string
}

export interface EmpresaParceira {
  id: string
  razao_social: string
  nome_fantasia?: string
  cnpj?: string
  telefone?: string
  email?: string
  endereco?: string
  cidade?: string
  estado?: string
  cep?: string
  inscricao_estadual?: string
  inscricao_municipal?: string
  status?: string | boolean
  clinic_id?: string
  created: string
  updated: string
}

// === Contas a Receber ===
export type ContaReceberStatus =
  | 'pendente'
  | 'pago'
  | 'recebido'
  | 'atrasado'
  | 'a_receber'
  | 'recebido_parcial'
  | 'recebido_total'
  | 'vencido'
  | 'renegociado'
  | 'cancelado'

export const CONTA_RECEBER_STATUS_LABELS: Record<ContaReceberStatus, string> = {
  pendente: 'Pendente',
  pago: 'Pago',
  recebido: 'Recebido',
  atrasado: 'Atrasado',
  a_receber: 'A Receber',
  recebido_parcial: 'Recebido Parcial',
  recebido_total: 'Recebido Total',
  vencido: 'Vencido',
  renegociado: 'Renegociado',
  cancelado: 'Cancelado',
}

export type ContaReceberForma =
  | 'dinheiro'
  | 'cartao'
  | 'pix'
  | 'transferencia'
  | 'boleto'
  | 'cheque'
  | 'convenio'
  | 'convênio'
  | 'parcelado'
  | 'promissoria'
  | 'promissória'

export const CONTA_RECEBER_FORMA_LABELS: Record<ContaReceberForma, string> = {
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  pix: 'PIX',
  transferencia: 'Transferência Bancária',
  boleto: 'Boleto',
  cheque: 'Cheque',
  convenio: 'Convênio',
  convênio: 'Convênio',
  parcelado: 'Parcelado',
  promissoria: 'Promissória',
  promissória: 'Promissória',
}

export type FormaRecebimento =
  | 'dinheiro'
  | 'cartao'
  | 'pix'
  | 'transferencia'
  | 'cheque'
  | 'boleto'
  | 'convenio'
  | 'convênio'
  | 'parcelado'
  | 'promissoria'
  | 'promissória'

export const FORMA_RECEBIMENTO_LABELS: Record<string, string> = {
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  pix: 'PIX',
  transferencia: 'Transferência Bancária',
  cheque: 'Cheque',
  boleto: 'Boleto',
  convenio: 'Convênio',
  convênio: 'Convênio',
  parcelado: 'Parcelado',
  promissoria: 'Promissória',
  promissória: 'Promissória',
}

export type ContaReceberOrigem = 'pdv' | 'b2b'

export interface RecebimentoItemExtra {
  id?: string
  nome: string
  quantidade: number
  valor_unitario: number
  subtotal: number
}

export interface Recebimento {
  id: string
  conta_id: string
  valor: number
  data_recebimento: string
  forma_recebimento: FormaRecebimento
  observacoes?: string
  valor_base?: number
  itens_extras?: RecebimentoItemExtra[]
  desconto_tipo?: 'valor' | 'percentual' | ''
  desconto_valor?: number
  valor_total?: number
  usuario_id?: string
  usuario_nome?: string
  created?: string
}

export interface ContaReceber {
  id: string
  venda_id?: string
  venda_origem?: ContaReceberOrigem | string
  cliente_id?: string
  paciente_id?: string
  paciente_nome?: string
  cliente_nome?: string
  cliente_telefone?: string
  descricao: string
  valor?: number
  valor_original: number
  valor_recebido: number
  valor_restante: number
  valor_pago?: number
  data_venda?: string
  data_vencimento: string
  data_recebimento?: string
  data_pagamento?: string
  forma_pagamento: ContaReceberForma | string
  numero_parcelas?: number
  parcela_atual?: number
  status: ContaReceberStatus
  conta_origem_id?: string
  motivo_renegociacao?: string
  motivo_cancelamento?: string
  observacoes?: string
  appointment_id?: string
  usuario_id?: string
  clinic_id?: string
  created: string
  updated: string
}

// === Lembretes WhatsApp ===
export type LembreteStatusEnvio =
  | 'pendente'
  | 'enviando'
  | 'enviado'
  | 'entregue'
  | 'lido'
  | 'falhou'
  | 'cancelado'

export const LEMBRETE_STATUS_ENVIO_LABELS: Record<LembreteStatusEnvio, string> = {
  pendente: 'Pendente',
  enviando: 'Enviando',
  enviado: 'Enviado',
  entregue: 'Entregue',
  lido: 'Lido',
  falhou: 'Falhou',
  cancelado: 'Cancelado',
}

export const LEMBRETE_STATUS_ENVIO_CLASS: Record<LembreteStatusEnvio, string> = {
  pendente: 'bg-slate-100 text-slate-700 border-slate-300',
  enviando: 'bg-blue-100 text-blue-700 border-blue-300',
  enviado: 'bg-cyan-100 text-cyan-700 border-cyan-300',
  entregue: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  lido: 'bg-emerald-100 text-emerald-800 border-emerald-400',
  falhou: 'bg-red-100 text-red-700 border-red-300',
  cancelado: 'bg-slate-100 text-slate-500 border-slate-300',
}

export type LembreteStatusConfirmacao = 'aguardando' | 'confirmado' | 'cancelado' | 'sem_resposta'

export const LEMBRETE_STATUS_CONFIRMACAO_LABELS: Record<LembreteStatusConfirmacao, string> = {
  aguardando: 'Aguardando Resposta',
  confirmado: 'Confirmado pelo Paciente',
  cancelado: 'Cancelado pelo Paciente',
  sem_resposta: 'Sem Resposta',
}

export const LEMBRETE_STATUS_CONFIRMACAO_CLASS: Record<LembreteStatusConfirmacao, string> = {
  aguardando: 'bg-amber-100 text-amber-800 border-amber-300',
  confirmado: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  cancelado: 'bg-red-100 text-red-800 border-red-300',
  sem_resposta: 'bg-slate-100 text-slate-600 border-slate-300',
}

export interface LembreteWhatsapp {
  id: string
  agendamento_id: string
  paciente_id: string
  telefone: string
  mensagem: string
  data_envio: string
  status_envio: LembreteStatusEnvio
  status_confirmacao: LembreteStatusConfirmacao
  data_confirmacao?: string
  resposta_paciente?: string
  tentativas: number
  error_message?: string
  clinic_id?: string
  created?: string
  updated?: string
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

// === Tamanhos de Página para Laudos ===
export const PAGE_SIZES: Record<string, { label: string; largura: number; altura: number }> = {
  A4: { label: 'A4 (210 × 297 mm)', largura: 210, altura: 297 },
  A5: { label: 'A5 (148 × 210 mm)', largura: 148, altura: 210 },
  Carta: { label: 'Carta (216 × 279 mm)', largura: 216, altura: 279 },
  Oficio: { label: 'Ofício (216 × 356 mm)', largura: 216, altura: 356 },
}
export type PageSize = keyof typeof PAGE_SIZES
