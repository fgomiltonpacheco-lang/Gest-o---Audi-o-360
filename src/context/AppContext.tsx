// @ts-nocheck
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react'
import {
  User,
  Patient,
  Appointment,
  HearingAid,
  StockItem,
  StockMovement,
  Budget,
  Sale,
  SaleItem,
  SaleStatus,
  Installment,
  Commission,
  CashFlowMovement,
  AudiometryExam,
  TympanometryExam,
  BeraExam,
  ClinicalRecord,
  ClinicalEvolution,
  SystemAlert,
  AidMaintenance,
  AidAdjustment,
  AppointmentProcedureItem,
  PatientPlanType,
  ClinicSettings,
  Equipment,
  getEquipmentStatus,
  FechamentoCaixa,
  MovimentacaoCaixa,
  FechamentoCaixaStatus,
  MovimentacaoCaixaTipo,
  FormaPagamentoCaixa,
  VendaB2B,
  ItemVendaB2B,
  NFServicoComissao,
  EmpresaParceira,
  NfseB2BConfig,
  Consentimento,
  TipoConsentimento,
  PolicyTexts,
  TEXTO_PADRAO_CONSENTIMENTO,
  ContaReceber,
  Recebimento,
  ContaReceberForma,
  ContaReceberStatus,
  ContaReceberOrigem,
  FormaRecebimento,
  Despesa,
  DespesaCategoria,
  DespesaFormaPagamento,
  DespesaStatus,
  NfseEmitida,
  NfseEmitidaStatus,
  NfseEmitidaTipoVenda,
} from '@/types'
import { emitirNfse as emitirNfseApi, type NfseApiConfig, type NfseDados } from '@/lib/nfse-api'
import { useToast } from '@/hooks/use-toast'
import pb from '@/lib/pocketbase/client'
import { extractFieldErrors } from '@/lib/pocketbase/errors'
import { ClientResponseError } from 'pocketbase'
import { validatePassword } from '@/lib/passwordPolicy'
import { verifyToken, verifyBackupCode } from '@/lib/twoFactor'

// ============================================================
// Segurança — tipos e constantes
// ============================================================

/** Configurações de segurança globais (collection `settings`, singleton). */
export interface SecuritySettings {
  id: string
  session_timeout_enabled: boolean
  session_timeout_minutes: number
  session_timeout_warning_seconds: number
  password_expiration_enabled: boolean
  password_expiration_days: number
  password_min_length: number
  lockout_max_attempts: number
  lockout_duration_minutes: number
}

const DEFAULT_SECURITY_SETTINGS: SecuritySettings = {
  id: '',
  session_timeout_enabled: true,
  session_timeout_minutes: 15,
  session_timeout_warning_seconds: 60,
  password_expiration_enabled: false,
  password_expiration_days: 0,
  password_min_length: 8,
  lockout_max_attempts: 5,
  lockout_duration_minutes: 15,
}

function mapSecuritySettings(r: any): SecuritySettings {
  return {
    id: r.id || '',
    session_timeout_enabled: r.session_timeout_enabled !== false,
    session_timeout_minutes: Number(r.session_timeout_minutes) || 15,
    session_timeout_warning_seconds: Number(r.session_timeout_warning_seconds) || 60,
    password_expiration_enabled: !!r.password_expiration_enabled,
    password_expiration_days: Number(r.password_expiration_days) || 0,
    password_min_length: Number(r.password_min_length) || 8,
    lockout_max_attempts: Number(r.lockout_max_attempts) || 5,
    lockout_duration_minutes: Number(r.lockout_duration_minutes) || 15,
  }
}

/** Resultado de login: true (ok) | objeto 2FA | false (falha). */
export type LoginResult =
  | boolean
  | {
      requires2FA: true
      userId: string
      email: string
      backupAvailable: boolean
      forcePasswordChange?: boolean
    }
  | { locked: true; minutesLeft: number }
  | { error: string }

/** Util: calcula minutos restantes até uma data ISO futura. */
function minutesUntil(iso: string): number {
  if (!iso) return 0
  const t = new Date(iso).getTime()
  if (isNaN(t)) return 0
  const diff = t - Date.now()
  return Math.max(0, Math.ceil(diff / 60000))
}

/** Hash SHA-256 (hex) usando Web Crypto API (disponível no browser). */
async function hashSha256Browser(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// ============================================================
// Helpers
// ============================================================

/** Converte um datetime/string do PocketBase para "YYYY-MM-DD". */
function toDateStr(value?: string | null): string {
  if (!value) return ''
  const s = String(value)
  // Aceita "2026-08-15 22:09:44.604Z" ou "2026-08-15T22:09:44.604Z" ou "2026-08-15"
  return s.slice(0, 10)
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

function nowIso(): string {
  return new Date().toISOString()
}

/** Formata YYYY-MM-DD -> DD/MM/YYYY para exibição em alertas. */
function formatDateBR(dateStr: string): string {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  if (!y || !m || !d) return dateStr
  return `${d}/${m}/${y}`
}

/**
 * Calcula a próxima calibração (última calibração + 1 ano) no formato YYYY-MM-DD.
 * Usado ao criar/atualizar equipamentos.
 */
function computeNextCalibration(dataCalibracao: string): string {
  if (!dataCalibracao) return ''
  const d = new Date(dataCalibracao + 'T00:00:00')
  if (isNaN(d.getTime())) return ''
  d.setFullYear(d.getFullYear() + 1)
  return d.toISOString().split('T')[0]
}

/**
 * Extrai uma mensagem de erro legível do PocketBase (ClientResponseError),
 * listando os campos que falharam na validação. Usado nos toasts de erro.
 */
function describePbError(error: unknown): string {
  if (error instanceof ClientResponseError) {
    const fieldErrors = extractFieldErrors(error)
    const parts = Object.entries(fieldErrors).map(([field, msg]) => `${field}: ${msg}`)
    if (parts.length > 0) return parts.join(' • ')
    if (error.response?.message) return String(error.response.message)
  }
  return error instanceof Error ? error.message : 'Erro desconhecido.'
}

// ============================================================
// Mappers: PocketBase record -> domínio TS
// ============================================================
/* eslint-disable @typescript-eslint/no-explicit-any */

const mapPatient = (r: any): Patient => ({
  id: r.id,
  name: r.name || '',
  cpf: r.cpf || '',
  birthDate: r.birthDate || '',
  gender: r.gender || 'Não informar',
  phone: r.phone || '',
  mobile: r.mobile || '',
  email: r.email || '',
  cep: r.cep || '',
  street: r.street || '',
  number: r.number || '',
  complement: r.complement || '',
  neighborhood: r.neighborhood || '',
  city: r.city || '',
  state: r.state || '',
  planType: r.planType === 'Convênio' ? 'Convênio' : r.planType === 'SUS' ? 'SUS' : 'Particular',
  planName: r.planName || '',
  cardNumber: r.cardNumber || '',
  hasResponsible: !!r.hasResponsible,
  responsible: r.responsible || undefined,
  hearingLossType: r.hearingLossType || 'Normal',
  previousHearingAid: !!r.previousHearingAid,
  previousAidBrand: r.previousAidBrand || '',
  previousAidModel: r.previousAidModel || '',
  generalNotes: r.generalNotes || '',
  status: r.status || 'Ativo',
  createdAt: toDateStr(r.created),
  lastVisit: r.lastVisit || toDateStr(r.created),
})

const mapAppointment = (r: any): Appointment => {
  const planType: PatientPlanType =
    r.planType === 'Convênio' ? 'Convênio' : r.planType === 'SUS' ? 'SUS' : 'Particular'
  const procedureId = r.procedureId || ''
  const type = r.type || 'Avaliação auditiva'
  const value = r.value != null ? Number(r.value) : undefined

  // proceduresList: se já existir no registro, normaliza; caso contrário,
  // monta um fallback a partir dos campos legados para manter compatibilidade.
  let proceduresList: AppointmentProcedureItem[] = []
  if (Array.isArray(r.proceduresList) && r.proceduresList.length > 0) {
    proceduresList = r.proceduresList.map((p: any) => ({
      procedureId: String(p?.procedureId || ''),
      procedureName: String(p?.procedureName || ''),
      value: Number(p?.value) || 0,
      planType:
        p?.planType === 'Convênio' ? 'Convênio' : p?.planType === 'SUS' ? 'SUS' : 'Particular',
    }))
  } else if (procedureId || (type && type !== 'Avaliação auditiva')) {
    proceduresList = [
      {
        procedureId,
        procedureName: type,
        value: Number(value || 0),
        planType,
      },
    ]
  }

  return {
    id: r.id,
    patientId: r.patientId || '',
    patientName: r.patientName || '',
    patientPhone: r.patientPhone || '',
    procedureId,
    // `type` continua sendo o nome exibido (procedimento ou tipo legado).
    type,
    date: r.date || '',
    time: r.time || '',
    duration: Number(r.duration) || 60,
    value,
    professionalName: r.professionalName || '',
    status: r.status || 'Agendado',
    notes: r.notes || '',
    planType,
    reception: r.reception || '',
    isEncaixe: r.isEncaixe === true,
    proceduresList,
    createdAt: toDateStr(r.created),
  }
}

const mapClinicalRecord = (r: any): ClinicalRecord => ({
  patientId: r.patientId || '',
  mainComplaint: r.mainComplaint || '',
  anamnesis: r.anamnesis || '',
  hearingHistory: r.hearingHistory || '',
  currentMedications: r.currentMedications || '',
  familyHistory: r.familyHistory || '',
  diagnosis: r.diagnosis || '',
  conduct: r.conduct || '',
  nextReturn: r.nextReturn || '',
  updatedAt: r.updatedAt || toDateStr(r.updated),
})

const mapEvolution = (r: any): ClinicalEvolution => ({
  id: r.id,
  patientId: r.patientId || '',
  date: r.date || '',
  professionalName: r.professionalName || '',
  description: r.description || '',
  createdAt: toDateStr(r.created),
})

const mapAudiometry = (r: any): AudiometryExam => ({
  id: r.id,
  patientId: r.patientId || '',
  patientName: r.patientName || '',
  date: r.date || '',
  professionalName: r.professionalName || '',
  airOD: r.airOD || {},
  airOE: r.airOE || {},
  boneOD: r.boneOD || {},
  boneOE: r.boneOE || {},
  srtOD: r.srtOD != null ? Number(r.srtOD) : undefined,
  srtOE: r.srtOE != null ? Number(r.srtOE) : undefined,
  iprfOD: r.iprfOD != null ? Number(r.iprfOD) : undefined,
  iprfOE: r.iprfOE != null ? Number(r.iprfOE) : undefined,
  lossDegree: r.lossDegree || 'Normal',
  lossType: r.lossType || 'Neurossensorial',
  notes: r.notes || '',
})

const mapTympanometry = (r: any): TympanometryExam => ({
  id: r.id,
  patientId: r.patientId || '',
  patientName: r.patientName || '',
  date: r.date || '',
  professionalName: r.professionalName || '',
  tympanometryOD: r.tympanometryOD || {},
  tympanometryOE: r.tympanometryOE || {},
  reflexesOD: r.reflexesOD || {},
  reflexesOE: r.reflexesOE || {},
  conclusion: r.conclusion || '',
  notes: r.notes || '',
})

const mapBera = (r: any): BeraExam => ({
  id: r.id,
  patientId: r.patientId || '',
  patientName: r.patientName || '',
  date: r.date || '',
  professionalName: r.professionalName || '',
  od: r.od || {},
  oe: r.oe || {},
  classification: r.classification || 'Normal',
  notes: r.notes || '',
})

const mapMaintenance = (r: any): AidMaintenance => ({
  id: r.id,
  hearingAidId: r.hearingAidId || '',
  date: r.date || '',
  description: r.description || '',
  responsible: r.responsible || '',
  createdAt: toDateStr(r.created),
})

const mapAdjustment = (r: any): AidAdjustment => ({
  id: r.id,
  hearingAidId: r.hearingAidId || '',
  date: r.date || '',
  description: r.description || '',
  professionalName: r.professionalName || '',
  createdAt: toDateStr(r.created),
})

const mapHearingAid = (r: any, maints: AidMaintenance[], adjs: AidAdjustment[]): HearingAid => ({
  id: r.id,
  brand: r.brand || '',
  model: r.model || '',
  type: r.type || 'RIC',
  side: r.side || 'Bilateral',
  serialNumber: r.serialNumber || '',
  patientId: r.patientId || '',
  patientName: r.patientName || '',
  saleDate: r.saleDate || '',
  saleValue: r.saleValue != null ? Number(r.saleValue) : undefined,
  paymentMethod: r.paymentMethod || undefined,
  warrantyMonths: Number(r.warrantyMonths) || 12,
  warrantyEndDate: r.warrantyEndDate || '',
  powerSource: r.powerSource === 'Recarregável' ? 'Recarregável' : 'Pilha',
  earMold: !!r.earMold,
  earMoldType: r.earMoldType || '',
  notes: r.notes || '',
  status: r.status || 'Em uso',
  maintenances: maints,
  adjustments: adjs,
  createdAt: toDateStr(r.created),
})

const mapBudget = (r: any): Budget => ({
  id: r.id,
  number: Number(r.number) || 0,
  patientId: r.patientId || '',
  patientName: r.patientName || '',
  date: r.date || '',
  items: r.items || [],
  discountPercent: Number(r.discountPercent) || 0,
  totalValue: Number(r.totalValue) || 0,
  status: r.status || 'Rascunho',
  notes: r.notes || '',
  createdAt: toDateStr(r.created),
})

const mapSale = (r: any): Sale => ({
  id: r.id,
  number: Number(r.number) || 0,
  patientId: r.patientId || '',
  patientName: r.patientName || '',
  date: r.date || '',
  itemsDescription: r.itemsDescription || '',
  totalValue: Number(r.totalValue) || 0,
  paymentMethod: (r.paymentMethod || 'À vista') as Sale['paymentMethod'],
  installmentsCount: Number(r.installmentsCount) || 1,
  interestPercent: Number(r.interestPercent) || 0,
  firstDueDate: r.firstDueDate || '',
  status: (r.status || 'Concluída') as Sale['status'],
  createdAt: toDateStr(r.created),
  type: (r.type === 'PDV' ? 'PDV' : 'atendimento') as Sale['type'],
  items: Array.isArray(r.items) ? (r.items as SaleItem[]) : undefined,
  subtotal: r.subtotal != null ? Number(r.subtotal) : undefined,
  discountValue: r.discountValue != null ? Number(r.discountValue) : undefined,
  discountPercent: r.discountPercent != null ? Number(r.discountPercent) : undefined,
  cancelReason: r.cancelReason || undefined,
  appointmentId: r.appointmentId || undefined,
  paymentDate: r.paymentDate || undefined,
  paymentNotes: r.paymentNotes || undefined,
  estoqueBaixado: r.estoque_baixado === true,
})

const mapInstallment = (r: any): Installment => ({
  id: r.id,
  saleId: r.saleId || '',
  saleNumber: Number(r.saleNumber) || 0,
  installmentNumber: Number(r.installmentNumber) || 1,
  totalInstallments: Number(r.totalInstallments) || 1,
  patientId: r.patientId || '',
  patientName: r.patientName || '',
  dueDate: r.dueDate || '',
  value: Number(r.value) || 0,
  status: r.status || 'Pendente',
  paidDate: r.paidDate || undefined,
})

const mapCommission = (r: any): Commission => ({
  id: r.id,
  professionalName: r.professionalName || '',
  period: r.period || '',
  salesCount: Number(r.salesCount) || 0,
  totalSalesValue: Number(r.totalSalesValue) || 0,
  commissionPercent: Number(r.commissionPercent) || 0,
  commissionValue: Number(r.commissionValue) || 0,
})

const mapCashMovement = (r: any): CashFlowMovement => ({
  id: r.id,
  date: r.date || '',
  description: r.description || '',
  type: r.type === 'Saída' ? 'Saída' : 'Entrada',
  category: r.category || 'Outros',
  value: Number(r.value) || 0,
  responsible: r.responsible || '',
  createdAt: toDateStr(r.created),
})

const mapStockItem = (r: any, movements: StockMovement[]): StockItem => ({
  id: r.id,
  name: r.name || '',
  brand: r.brand || '',
  model: r.model || '',
  color: r.color || '',
  category: r.category || 'Acessórios',
  batterySize: r.batterySize || undefined,
  accessorySubcategory: r.accessorySubcategory || undefined,
  minQuantity: Number(r.minQuantity) || 0,
  currentQuantity: Number(r.currentQuantity) || 0,
  supplier: r.supplier || '',
  costPrice: Number(r.costPrice) || 0,
  salePrice: Number(r.salePrice) || 0,
  notes: r.notes || '',
  movements,
  createdAt: toDateStr(r.created),
  estoqueMinimo: Number(r.estoque_minimo) || 0,
  dataValidade: r.data_validade ? toDateStr(r.data_validade) : undefined,
  lote: r.lote || undefined,
  fabricante: r.fabricante || undefined,
  code: r.code || undefined,
  sku: r.sku || undefined,
  diasAlertaValidade: Number(r.dias_alerta_validade) || 30,
  categoria: (r.categoria as StockItem['categoria']) || undefined,
  unidadeMedida: r.unidade_medida || undefined,
})

const mapStockMovement = (r: any): StockMovement => ({
  id: r.id,
  stockItemId: r.itemId || '',
  date: r.date || '',
  type: r.type === 'Saída' || r.type === 'saida' ? 'saida' : 'entrada',
  quantity: Number(r.quantity) || 0,
  responsible: r.responsible || '',
  reason: r.reason || '',
  supplier: r.supplier || '',
  patient: r.patientName || '',
  createdAt: toDateStr(r.created),
})

const mapFechamentoCaixa = (r: any): FechamentoCaixa => {
  return {
    id: r.id,
    data: toDateStr(r.data),
    saldoInicial: Number(r.saldo_inicial) || 0,
    saldoFinal: Number(r.saldo_final) || 0,
    totalDinheiro: Number(r.total_dinheiro) || 0,
    totalDebito: Number(r.total_debito) || 0,
    totalCredito: Number(r.total_credito) || 0,
    totalPix: Number(r.total_pix) || 0,
    totalConvenio: Number(r.total_convenio) || 0,
    totalBoleto: Number(r.total_boleto) || 0,
    totalEntradas: Number(r.total_entradas) || 0,
    totalSaidas: Number(r.total_saidas) || 0,
    totalVendas: Number(r.total_vendas) || 0,
    quantidadeVendas: Number(r.quantidade_vendas) || 0,
    diferenca: Number(r.diferenca) || 0,
    status: r.status === 'fechado' ? 'fechado' : 'aberto',
    observacao: r.observacao || '',
    usuarioId: r.usuario || undefined,
    created: toDateStr(r.created),
    updated: toDateStr(r.updated),
  }
}

const mapMovimentacaoCaixa = (r: any): MovimentacaoCaixa => {
  return {
    id: r.id,
    fechamentoId: r.fechamento || '',
    tipo: r.tipo === 'saida' ? 'saida' : 'entrada',
    valor: Number(r.valor) || 0,
    descricao: r.descricao || '',
    formaPagamento: (r.forma_pagamento || 'dinheiro') as FormaPagamentoCaixa,
    data: toDateStr(r.data),
    created: toDateStr(r.created),
  }
}

const mapItemVendaB2B = (r: any): ItemVendaB2B => ({
  id: r.id,
  venda_b2b_id: r.venda_b2b_id || r.venda_b2b || '',
  produto_id: r.produto_id || r.produto || '',
  produto_nome: r.produto_nome || r.expand?.produto_id?.name || '',
  quantidade: Number(r.quantidade) || 0,
  valor_unitario: Number(r.valor_unitario) || 0,
  valor_subtotal: Number(r.valor_subtotal) || 0,
  created: toDateStr(r.created),
})

const mapEmpresaParceira = (r: any): EmpresaParceira => ({
  id: r.id,
  nome: r.razao_social || r.nome || '',
  cnpj: r.cnpj || '',
  telefone: r.telefone || '',
  email: r.email || '',
  contato: r.contato || '',
  comissao_padrao: Number(r.comissao_padrao) || 0,
  ativo: r.status !== 'inativo',
  observacoes: r.observacoes || '',
  created: toDateStr(r.created),
  updated: toDateStr(r.updated),
})

const mapNFServicoComissao = (r: any): NFServicoComissao => ({
  id: r.id,
  venda_id: r.venda_b2b_id || r.venda_id || '',
  parceiro_id: r.parceiro_id || '',
  numero_nf: r.numero_nfse || r.numero_nf || '',
  valor_servico: Number(r.valor_liquido || r.valor_base) || 0,
  aliquota_iss: Number(r.aliquota_iss) || 0,
  valor_iss: Number(r.valor_iss) || 0,
  valor_liquido: Number(r.valor_liquido) || 0,
  status: (r.status || 'pendente') as NFServicoComissao['status'],
  data_emissao: toDateStr(r.data_emissao),
  created: toDateStr(r.created),
  updated: toDateStr(r.updated),
})

const mapContaReceber = (r: any): ContaReceber => ({
  id: r.id,
  venda_id: r.venda_id || '',
  venda_origem: r.venda_origem || 'pdv',
  cliente_id: r.paciente_id || r.cliente_id || '',
  cliente_nome: r.cliente_nome || '',
  descricao: r.descricao || '',
  valor_original: Number(r.valor_original) || 0,
  valor_recebido: Number(r.valor_recebido) || 0,
  valor_restante: Number(r.valor_restante) || 0,
  data_vencimento: toDateStr(r.data_vencimento),
  data_recebimento: r.data_recebimento ? toDateStr(r.data_recebimento) : undefined,
  status: (r.status || 'pendente') as ContaReceberStatus,
  forma_pagamento: r.forma_pagamento || 'boleto',
  numero_parcelas: Number(r.numero_parcelas) || 1,
  parcela_atual: Number(r.parcela_atual) || 1,
  observacoes: r.observacoes || '',
  created: toDateStr(r.created),
  updated: toDateStr(r.updated),
})

const mapRecebimento = (r: any): Recebimento => ({
  id: r.id,
  conta_id: r.conta_receber_id || r.conta_id || '',
  valor: Number(r.valor) || 0,
  data_recebimento: toDateStr(r.data_recebimento),
  forma_recebimento: (r.forma_recebimento || 'dinheiro') as FormaRecebimento,
  observacoes: r.observacoes || '',
  valor_base: r.valor_base != null ? Number(r.valor_base) : undefined,
  itens_extras: Array.isArray(r.itens_extras) ? r.itens_extras : undefined,
  desconto_tipo: (r.desconto_tipo || '') as Recebimento['desconto_tipo'],
  desconto_valor: r.desconto_valor != null ? Number(r.desconto_valor) : undefined,
  valor_total: r.valor_total != null ? Number(r.valor_total) : undefined,
  created: toDateStr(r.created),
})

const mapDespesa = (r: any): Despesa => ({
  id: r.id,
  descricao: r.descricao || '',
  valor: Number(r.valor) || 0,
  data_vencimento: toDateStr(r.data_vencimento),
  data_pagamento: r.data_pagamento ? toDateStr(r.data_pagamento) : undefined,
  categoria: (r.categoria || 'outros') as DespesaCategoria,
  forma_pagamento: (r.forma_pagamento || undefined) as DespesaFormaPagamento | undefined,
  status: (r.status || 'a_pagar') as DespesaStatus,
  valor_pago: Number(r.valor_pago) || 0,
  comprovante: r.comprovante || undefined,
  observacoes: r.observacoes || undefined,
  created: toDateStr(r.created),
  updated: toDateStr(r.updated),
})

const DEFAULT_NFSE_CONFIG = {
  municipio: 'Caçador',
  uf: 'SC',
  codigo_municipio: '4203006',
  provedor: 'BETHA' as const,
  url_api: '',
  login_api: '',
  token_api: '',
  inscricao_municipal: '',
  aliquota_iss_padrao: 2,
  item_lista_servico: '10.01',
  discriminacao_padrao: 'Comissão sobre intermediação comercial de aparelhos auditivos',
  ambiente: 'homologacao' as const,
  ativo: true,
}

const mapNfseB2BConfig = (r: any): NfseB2BConfig => ({
  id: r.id,
  municipio: r.municipio || 'Caçador',
  uf: r.uf || 'SC',
  codigo_municipio: r.codigo_municipio || '4203006',
  provedor: r.provedor || 'BETHA',
  url_api: r.url_api || '',
  login_api: r.login_api || '',
  token_api: r.token_api || '',
  inscricao_municipal: r.inscricao_municipal || '',
  aliquota_iss_padrao: Number(r.aliquota_iss_padrao) || 0,
  item_lista_servico: r.item_lista_servico || '10.01',
  discriminacao_padrao: r.discriminacao_padrao || '',
  ambiente: r.ambiente || 'homologacao',
  ativo: r.ativo !== false,
  created: toDateStr(r.created),
  updated: toDateStr(r.updated),
})

const mapNfseEmitida = (r: any): NfseEmitida => ({
  id: r.id,
  sale: r.sale || undefined,
  tipo_venda: (r.tipo_venda || 'PDV') as NfseEmitidaTipoVenda,
  numero_rps: r.numero_rps || undefined,
  numero_lote: r.numero_lote || undefined,
  numero_nfse: r.numero_nfse || undefined,
  codigo_verificacao: r.codigo_verificacao || undefined,
  status: (r.status || 'pendente') as NfseEmitidaStatus,
  valor_servico: Number(r.valor_servico) || 0,
  aliquota_iss: Number(r.aliquota_iss) || 0,
  valor_iss: Number(r.valor_iss) || 0,
  valor_liquido: Number(r.valor_liquido) || 0,
  discriminacao: r.discriminacao || '',
  tomador_nome: r.tomador_nome || '',
  tomador_cpf_cnpj: r.tomador_cpf_cnpj || '',
  pdf_url: r.pdf_url || undefined,
  erro_mensagem: r.erro_mensagem || undefined,
  data_emissao: r.data_emissao ? toDateStr(r.data_emissao) : undefined,
  observacao: r.observacao || undefined,
  created: toDateStr(r.created),
  updated: toDateStr(r.updated),
})
const mapVendaB2B = (r: any): VendaB2B => {
  const itens = Array.isArray(r.expand?.itens_venda_b2b_venda_b2b_id)
    ? r.expand.itens_venda_b2b_venda_b2b_id.map(mapItemVendaB2B)
    : Array.isArray(r.itens)
      ? r.itens.map(mapItemVendaB2B)
      : undefined
  const nfRec = r.expand?.nf_servico_comissao_venda_b2b_id?.[0] || r.expand?.nf?.[0] || r.nf || null
  return {
    id: r.id,
    numero_venda: r.numero_venda || '',
    cliente_empresa_id: r.cliente_empresa_id || r.cliente_empresa || '',
    cliente_empresa_nome:
      r.cliente_empresa_nome || r.expand?.cliente_empresa_id?.razao_social || '',
    parceiro_id: r.parceiro_id || r.parceiro || r.cliente_empresa_id || '',
    parceiro_nome:
      r.parceiro_nome ||
      r.expand?.parceiro_id?.nome ||
      r.expand?.cliente_empresa_id?.razao_social ||
      '',
    paciente_nome: r.paciente_nome || r.expand?.paciente_id?.nome || '',
    data_venda: toDateStr(r.data_venda),
    valor_total: Number(r.valor_total) || 0,
    percentual_comissao: Number(r.percentual_comissao) || 0,
    comissao_percentual: Number(r.percentual_comissao || r.comissao_percentual) || 0,
    valor_comissao: Number(r.valor_comissao) || 0,
    comissao_valor: Number(r.valor_comissao || r.comissao_valor) || 0,
    valor_repasse: Number(r.valor_repasse) || 0,
    status: (r.status || 'pendente') as VendaB2B['status'],
    especialista_id: r.especialista_id || r.especialista || '',
    especialista_nome: r.especialista_nome || r.expand?.especialista_id?.name || '',
    observacoes: r.observacoes || '',
    status_repasse: (r.status_repasse === 'recebido'
      ? 'recebido'
      : 'pendente') as VendaB2B['status_repasse'],
    data_recebimento_comissao: r.data_recebimento_comissao
      ? toDateStr(r.data_recebimento_comissao)
      : undefined,
    itens,
    nf: nfRec ? mapNFServicoComissao(nfRec) : null,
    created: toDateStr(r.created),
    updated: toDateStr(r.updated),
  }
}

// ============================================================
// Context interface (mantida compatível com as páginas existentes)
// ============================================================

interface AppContextType {
  // Auth
  currentUser: User | null
  login: (email: string, password: string, rememberMe?: boolean) => Promise<LoginResult>
  verify2FA: (
    userId: string,
    token: string,
    useBackup?: boolean,
  ) => Promise<{ success: boolean; message?: string; forcePasswordChange?: boolean }>
  logout: () => void
  recoverPassword: (email: string) => boolean
  updateProfile: (data: {
    name: string
    crmCrfa?: string
    oldPassword?: string
    newPassword?: string
    passwordConfirm?: string
  }) => Promise<{ success: boolean; message?: string }>
  changePassword: (
    oldPassword: string,
    newPassword: string,
  ) => Promise<{ success: boolean; message?: string }>
  enable2FA: (
    secret: string,
    backupCodesHashed: string[],
  ) => Promise<{ success: boolean; message?: string }>
  disable2FA: () => Promise<{ success: boolean; message?: string }>
  twoFactorEnabled: boolean
  uploadAvatar: (file: File) => Promise<{ success: boolean; message?: string }>
  dataLoading: boolean
  /**
   * Marca o onboarding da clínica do usuário atual como concluído no estado
   * local (currentUser.onboardingCompleted = true). Usado pelo wizard de
   * onboarding ao finalizar, para que o redirecionamento pós-login não o
   * recapture. O campo `onboarding_completed` já foi persistido como true no
   * registro da clínica pelo próprio wizard.
   */
  markOnboardingCompleted: () => void

  // Segurança — configurações globais (settings)
  securitySettings: SecuritySettings | null
  fetchSecuritySettings: () => Promise<void>
  saveSecuritySettings: (
    data: Partial<SecuritySettings>,
  ) => Promise<{ success: boolean; message?: string }>
  /** Desabilita temporariamente o timeout de sessão (formulário sujo, impressão, download). */
  sessionTimeoutDisabled: boolean
  setSessionTimeoutDisabled: (disabled: boolean) => void

  // Configurações da Clínica
  clinicSettings: ClinicSettings | null
  saveClinicSettings: (
    data: Partial<Omit<ClinicSettings, 'id'>> & {
      logoFile?: File | null
      certificadoFile?: File | null
      templateAudiometriaFile?: File | null
      templateImitanciometriaFile?: File | null
    },
  ) => Promise<{ success: boolean; message?: string }>
  equipments: Equipment[]
  addEquipment: (
    eq: Omit<Equipment, 'id' | 'proxima_calibracao'>,
  ) => Promise<{ success: boolean; message?: string }>
  updateEquipment: (
    id: string,
    eq: Partial<Omit<Equipment, 'id'>>,
  ) => Promise<{ success: boolean; message?: string }>
  deleteEquipment: (id: string) => Promise<{ success: boolean; message?: string }>

  // Pacientes
  patients: Patient[]
  addPatient: (patient: Omit<Patient, 'id' | 'createdAt'>) => Patient
  updatePatient: (id: string, patient: Partial<Patient>) => void
  deletePatient: (id: string) => void
  getPatient: (id: string) => Patient | undefined

  // Agenda
  appointments: Appointment[]
  addAppointment: (
    app: Omit<Appointment, 'id' | 'createdAt'>,
    options?: { ignoreConflict?: boolean },
  ) => {
    success: boolean
    message?: string
    appointment?: Appointment
  }
  updateAppointment: (
    id: string,
    app: Partial<Appointment>,
    options?: { ignoreConflict?: boolean },
  ) => { success: boolean; message?: string }
  deleteAppointment: (id: string) => void

  // Prontuário & Evoluções
  clinicalRecords: Record<string, ClinicalRecord>
  updateClinicalRecord: (patientId: string, record: Partial<ClinicalRecord>) => void
  evolutions: ClinicalEvolution[]
  addEvolution: (evo: Omit<ClinicalEvolution, 'id' | 'createdAt'>) => ClinicalEvolution
  deleteEvolution: (id: string) => void

  // Exames
  audiometries: AudiometryExam[]
  addAudiometry: (exam: Omit<AudiometryExam, 'id'>) => AudiometryExam
  deleteAudiometry: (id: string) => void

  tympanometries: TympanometryExam[]
  addTympanometry: (exam: Omit<TympanometryExam, 'id'>) => TympanometryExam
  deleteTympanometry: (id: string) => void

  beras: BeraExam[]
  addBera: (exam: Omit<BeraExam, 'id'>) => BeraExam
  deleteBera: (id: string) => void

  // Aparelhos
  hearingAids: HearingAid[]
  addHearingAid: (aid: Omit<HearingAid, 'id' | 'createdAt'>) => HearingAid
  updateHearingAid: (id: string, aid: Partial<HearingAid>) => void
  deleteHearingAid: (id: string) => void
  addAidMaintenance: (aidId: string, description: string, responsible: string, date: string) => void
  addAidAdjustment: (
    aidId: string,
    description: string,
    professionalName: string,
    date: string,
  ) => void

  // Financeiro
  budgets: Budget[]
  addBudget: (budget: Omit<Budget, 'id' | 'createdAt' | 'number'>) => Budget
  updateBudget: (id: string, budget: Partial<Budget>) => void
  deleteBudget: (id: string) => void
  convertBudgetToSale: (
    budgetId: string,
    paymentMethod: any,
    installmentsCount?: number,
    firstDueDate?: string,
  ) => Sale

  sales: Sale[]
  addSale: (sale: Omit<Sale, 'id' | 'createdAt' | 'number'>) => Sale
  /** Atualiza uma venda existente (status, justificativa, etc.). */
  updateSale: (id: string, data: Partial<Sale>) => void
  /** Cancela/estorna uma venda, devolvendo itens de estoque ao saldo. */
  cancelSale: (id: string, reason: string, mode: 'Cancelado' | 'Estornado') => void
  /**
   * Baixa o estoque dos itens de inventário de uma venda (saída).
   * Idempotente: só baixa uma vez (controlado por `estoqueBaixado`).
   * Permite estoque negativo com aviso.
   */
  baixarEstoqueVenda: (sale: Sale) => void
  /**
   * Devolve ao estoque os itens baixados de uma venda (entrada).
   * Só devolve se a venda teve baixa (`estoqueBaixado === true`).
   */
  devolverEstoqueVenda: (sale: Sale) => void
  installments: Installment[]
  payInstallment: (installmentId: string, paidDate?: string) => void
  commissions: Commission[]
  addCommission: (comm: Omit<Commission, 'id'>) => void

  cashMovements: CashFlowMovement[]
  addCashMovement: (mov: Omit<CashFlowMovement, 'id' | 'createdAt'>) => CashFlowMovement

  // Fechamento de Caixa
  fechamentosCaixa: FechamentoCaixa[]
  fetchFechamentosCaixa: () => Promise<void>
  addFechamentoCaixa: (
    data: Omit<FechamentoCaixa, 'id' | 'created' | 'updated'>,
  ) => Promise<FechamentoCaixa | null>
  updateFechamentoCaixa: (
    id: string,
    data: Partial<FechamentoCaixa>,
  ) => Promise<{ success: boolean; message?: string }>
  movimentacoesCaixa: MovimentacaoCaixa[]
  fetchMovimentacoesCaixa: (fechamentoId?: string) => Promise<void>
  addMovimentacaoCaixa: (
    data: Omit<MovimentacaoCaixa, 'id' | 'created' | 'usuarioId' | 'usuarioNome'>,
  ) => Promise<MovimentacaoCaixa | null>

  // Estoque
  stockItems: StockItem[]
  addStockItem: (item: Omit<StockItem, 'id' | 'createdAt'>) => StockItem
  updateStockItem: (id: string, item: Partial<StockItem>) => void
  deleteStockItem: (id: string) => void
  addStockEntry: (
    itemId: string,
    quantity: number,
    supplier?: string,
    responsible?: string,
    date?: string,
  ) => void
  addStockExit: (
    itemId: string,
    quantity: number,
    reason: string,
    responsible?: string,
    patientName?: string,
    date?: string,
  ) => boolean

  // Alertas e Notificações
  alerts: SystemAlert[]
  unreadAlertsCount: number

  // Vendas B2B (Business-to-Business)
  vendasB2B: VendaB2B[]
  fetchVendasB2B: () => Promise<void>
  addVendaB2B: (
    data: Omit<VendaB2B, 'id' | 'created' | 'updated' | 'numero_venda' | 'itens' | 'nf'> & {
      itens: Array<Omit<ItemVendaB2B, 'id' | 'created' | 'venda_b2b_id'>>
    },
  ) => Promise<VendaB2B | null>
  updateVendaB2B: (
    id: string,
    data: Partial<VendaB2B>,
  ) => Promise<{ success: boolean; message?: string }>
  cancelVendaB2B: (id: string, reason: string) => Promise<{ success: boolean; message?: string }>
  fetchItensVendaB2B: (vendaId: string) => Promise<ItemVendaB2B[]>
  empresasParceiras: EmpresaParceira[]
  fetchEmpresasParceiras: () => Promise<void>
  addEmpresaParceira: (
    data: Omit<EmpresaParceira, 'id' | 'created' | 'updated'>,
  ) => Promise<{ success: boolean; message?: string }>
  updateEmpresaParceira: (
    id: string,
    data: Partial<EmpresaParceira>,
  ) => Promise<{ success: boolean; message?: string }>
  nfServicoComissao: NFServicoComissao[]
  fetchNFServicoComissao: (vendaId?: string) => Promise<void>
  addNFServicoComissao: (
    data: Omit<NFServicoComissao, 'id' | 'created' | 'updated'>,
  ) => Promise<NFServicoComissao | null>
  updateNFServicoComissao: (
    id: string,
    data: Partial<NFServicoComissao>,
  ) => Promise<{ success: boolean; message?: string }>
  cancelNFServicoComissao: (
    id: string,
    motivo: string,
    status?: 'cancelada' | 'cancelada_prefeitura',
  ) => Promise<{ success: boolean; message?: string }>
  // Configuração da NFS-e de comissão B2B
  nfseB2BConfig: NfseB2BConfig | null
  fetchNfseB2BConfig: () => Promise<void>
  saveNfseB2BConfig: (
    data: Partial<Omit<NfseB2BConfig, 'id' | 'created' | 'updated'>>,
  ) => Promise<{ success: boolean; message?: string }>

  // NFS-e emitidas (Vendas PDV)
  nfseEmitidas: NfseEmitida[]
  fetchNfseEmitidas: () => Promise<void>
  /**
   * Emite uma NFS-e para uma venda PDV. Monta os dados de tomador e serviço,
   * chama a API da prefeitura (quando configurada) e persiste o resultado em
   * `nfse_emitidas` — mesmo em caso de erro (status 'erro'), para auditoria.
   * Retorna o registro criado/atualizado.
   */
  emitirNfseVenda: (
    saleId: string,
    dados: {
      tomadorNome: string
      tomadorCpfCnpj: string
      discriminacao: string
      aliquotaIss?: number
      observacao?: string
    },
  ) => Promise<NfseEmitida | null>

  // LGPD — Consentimentos e Política de Privacidade
  fetchConsentimentos: (pacienteId: string) => Promise<Consentimento[]>
  registrarConsentimento: (
    pacienteId: string,
    tipo: TipoConsentimento,
    textoTermo: string,
    observacoes?: string,
  ) => Promise<{ success: boolean; message?: string }>
  revogarConsentimento: (
    consentimentoId: string,
    motivo: string,
  ) => Promise<{ success: boolean; message?: string }>
  fetchLgpdPolicyTexts: () => Promise<PolicyTexts>
  saveLgpdPolicyTexts: (texts: PolicyTexts) => Promise<{ success: boolean; message?: string }>

  // Controle de Inadimplência (Contas a Receber)
  contasReceber: ContaReceber[]
  fetchContasReceber: () => Promise<void>
  registrarRecebimento: (
    contaId: string,
    data: {
      valor: number
      data_recebimento: string
      forma_recebimento: FormaRecebimento
      observacoes?: string
      // ---- Acréscimo de itens extras + desconto (Registrar Recebimento) ----
      valor_base?: number
      itens_extras?: Array<{
        nome: string
        quantidade: number
        valor_unitario: number
        subtotal: number
      }>
      desconto_tipo?: 'valor' | 'percentual' | ''
      desconto_valor?: number
      valor_total?: number
    },
  ) => Promise<{ success: boolean; message?: string }>
  renegociarConta: (
    contaId: string,
    data: {
      novo_vencimento: string
      novo_valor: number
      novo_numero_parcelas: number
      motivo: string
    },
  ) => Promise<{ success: boolean; message?: string }>
  cancelarConta: (
    contaId: string,
    motivo: string,
  ) => Promise<{ success: boolean; message?: string }>
  fetchRecebimentos: (contaId: string) => Promise<Recebimento[]>

  // Despesas
  despesas: Despesa[]
  fetchDespesas: () => Promise<void>
  createDespesa: (
    data: Omit<Despesa, 'id' | 'created' | 'updated'> & { comprovanteFile?: File | null },
  ) => Promise<{ success: boolean; message?: string }>
  updateDespesa: (
    id: string,
    data: Partial<Despesa> & { comprovanteFile?: File | null },
  ) => Promise<{ success: boolean; message?: string }>
  pagarDespesa: (
    id: string,
    data: {
      data_pagamento: string
      forma_pagamento: DespesaFormaPagamento
      valor: number
      observacoes?: string
    },
  ) => Promise<{ success: boolean; message?: string }>
  cancelarDespesa: (id: string, motivo: string) => Promise<{ success: boolean; message?: string }>

  // Utilitário para recarregar dados do banco
  resetToSeedData: () => void

  // Chat Interno
  /** Número de mensagens não lidas destinadas ao usuário logado (diretas ou grupo). */
  unreadMessagesCount: number
  /** Recarrega a contagem de mensagens não lidas do backend. */
  refreshUnreadMessagesCount: () => Promise<void>
}

const AppContext = createContext<AppContextType | undefined>(undefined)

// ============================================================
// Provider
// ============================================================

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { toast } = useToast()

  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [dataLoading, setDataLoading] = useState(false)

  // Entidades principais
  const [patients, setPatients] = useState<Patient[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [aidsRaw, setAidsRaw] = useState<any[]>([])
  const [maintenances, setMaintenances] = useState<AidMaintenance[]>([])
  const [adjustments, setAdjustments] = useState<AidAdjustment[]>([])
  const [stockRaw, setStockRaw] = useState<any[]>([])
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [installments, setInstallments] = useState<Installment[]>([])
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [cashMovements, setCashMovements] = useState<CashFlowMovement[]>([])
  const [clinicalRecords, setClinicalRecords] = useState<Record<string, ClinicalRecord>>({})
  const [evolutions, setEvolutions] = useState<ClinicalEvolution[]>([])
  const [audiometries, setAudiometries] = useState<AudiometryExam[]>([])
  const [tympanometries, setTympanometries] = useState<TympanometryExam[]>([])
  const [beras, setBeras] = useState<BeraExam[]>([])

  // Configurações da Clínica + Equipamentos
  const [clinicSettings, setClinicSettings] = useState<ClinicSettings | null>(null)
  const [equipments, setEquipments] = useState<Equipment[]>([])

  // Fechamento de Caixa
  const [fechamentosCaixa, setFechamentosCaixa] = useState<FechamentoCaixa[]>([])
  const [movimentacoesCaixa, setMovimentacoesCaixa] = useState<MovimentacaoCaixa[]>([])

  // Vendas B2B
  const [vendasB2B, setVendasB2B] = useState<VendaB2B[]>([])
  const [empresasParceiras, setEmpresasParceiras] = useState<EmpresaParceira[]>([])
  const [nfServicoComissao, setNfServicoComissao] = useState<NFServicoComissao[]>([])
  const [nfseB2BConfig, setNfseB2BConfig] = useState<NfseB2BConfig | null>(null)

  // Contas a Receber (Controle de Inadimplência)
  const [contasReceber, setContasReceber] = useState<ContaReceber[]>([])

  // Despesas
  const [despesas, setDespesas] = useState<Despesa[]>([])

  // NFS-e emitidas (Vendas PDV)
  const [nfseEmitidas, setNfseEmitidas] = useState<NfseEmitida[]>([])

  // Chat Interno — contagem de mensagens não lidas
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0)

  // Segurança — configurações globais + estado 2FA + timeout
  const [securitySettings, setSecuritySettings] = useState<SecuritySettings | null>(null)
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [sessionTimeoutDisabled, setSessionTimeoutDisabled] = useState(false)

  // ---------- Carregamento de dados ----------
  const reloadAll = useCallback(async () => {
    setDataLoading(true)
    try {
      const [
        p,
        ap,
        aids,
        maints,
        adjs,
        stk,
        stkmov,
        bud,
        sl,
        inst,
        com,
        cash,
        clin,
        evo,
        aud,
        tymp,
        bera,
        clinicSet,
        equips,
        contasRec,
      ] = await Promise.all([
        pb.collection('patients').getFullList({ sort: '-created' }),
        pb.collection('appointments').getFullList({ sort: '-created' }),
        pb.collection('hearing_aids').getFullList({ sort: '-created' }),
        pb.collection('maintenances').getFullList({ sort: '-created' }),
        pb.collection('adjustments').getFullList({ sort: '-created' }),
        pb.collection('inventory').getFullList({ sort: '-created' }),
        pb.collection('inventory_movements').getFullList({ sort: '-created' }),
        pb.collection('budgets').getFullList({ sort: '-created' }),
        pb.collection('sales').getFullList({ sort: '-created' }),
        pb.collection('installments').getFullList({ sort: '-created' }),
        pb.collection('commissions').getFullList({ sort: '-created' }),
        pb.collection('cash_flow').getFullList({ sort: '-created' }),
        pb.collection('clinical_records').getFullList({ sort: '-created' }),
        pb.collection('evolutions').getFullList({ sort: '-created' }),
        pb.collection('audiometries').getFullList({ sort: '-created' }),
        pb.collection('tympanometries').getFullList({ sort: '-created' }),
        pb.collection('beras').getFullList({ sort: '-created' }),
        // Configurações: lista paginada (1) — singleton; cria automaticamente se vazio.
        pb.collection('clinic_settings').getList(1, 1, { sort: '-created' }),
        pb.collection('equipments').getFullList({ sort: 'nome' }),
        pb.collection('contas_receber').getFullList({ sort: '-data_vencimento' }),
      ])

      const maintList = maints.map(mapMaintenance)
      const adjList = adjs.map(mapAdjustment)
      const movList = stkmov.map(mapStockMovement)

      setPatients(p.map(mapPatient))
      setAppointments(ap.map(mapAppointment))
      setAidsRaw(aids)
      setMaintenances(maintList)
      setAdjustments(adjList)
      setStockRaw(stk)
      setStockMovements(movList)
      setBudgets(bud.map(mapBudget))
      setSales(sl.map(mapSale))
      setInstallments(inst.map(mapInstallment))
      setCommissions(com.map(mapCommission))
      setCashMovements(cash.map(mapCashMovement))

      const clinMap: Record<string, ClinicalRecord> = {}
      clin.forEach((r: any) => {
        const rec = mapClinicalRecord(r)
        if (rec.patientId) clinMap[rec.patientId] = rec
      })
      setClinicalRecords(clinMap)

      setEvolutions(evo.map(mapEvolution))
      setAudiometries(aud.map(mapAudiometry))
      setTympanometries(tymp.map(mapTympanometry))
      setBeras(bera.map(mapBera))

      // ---- Configurações da clínica (singleton) ----
      // Se ainda não existir, cria automaticamente com campos vazios.
      let clinicRec: any = clinicSet?.items?.[0] || null
      if (!clinicRec) {
        try {
          clinicRec = await pb.collection('clinic_settings').create({
            nome: '',
            endereco: '',
            telefone: '',
            email: '',
          })
        } catch (e) {
          console.warn('Não foi possível criar registro de clinic_settings:', e)
        }
      }
      if (clinicRec) {
        const logoUrl = clinicRec.logo
          ? pb.files.getUrl(clinicRec, clinicRec.logo)
          : clinicRec.logo_url || ''
        const certificadoUrl = clinicRec.certificado_digital
          ? pb.files.getUrl(clinicRec, clinicRec.certificado_digital)
          : clinicRec.certificado_digital_url || ''
        const tplAudioUrl = clinicRec.template_audiometria
          ? pb.files.getUrl(clinicRec, clinicRec.template_audiometria)
          : clinicRec.template_audiometria_url || ''
        const tplImitUrl = clinicRec.template_imitanciometria
          ? pb.files.getUrl(clinicRec, clinicRec.template_imitanciometria)
          : clinicRec.template_imitanciometria_url || ''
        setClinicSettings({
          id: clinicRec.id,
          nome: clinicRec.nome || '',
          cnpj: clinicRec.cnpj || '',
          inscricao_estadual: clinicRec.inscricao_estadual || '',
          inscricao_municipal: clinicRec.inscricao_municipal || '',
          certificado_digital: clinicRec.certificado_digital || '',
          certificado_digital_url: certificadoUrl,
          template_audiometria: clinicRec.template_audiometria || '',
          template_audiometria_url: tplAudioUrl,
          template_imitanciometria: clinicRec.template_imitanciometria || '',
          template_imitanciometria_url: tplImitUrl,
          coordenadas_audiometria:
            (clinicRec.coordenadas_audiometria as Record<string, unknown> | null) ?? null,
          coordenadas_imitanciometria:
            (clinicRec.coordenadas_imitanciometria as Record<string, unknown> | null) ?? null,
          endereco: clinicRec.endereco || '',
          telefone: clinicRec.telefone || '',
          email: clinicRec.email || '',
          site: clinicRec.site || '',
          logo: clinicRec.logo || '',
          logo_url: logoUrl,
          audiometro: clinicRec.audiometro || '',
          calibracao: clinicRec.calibracao || '',
          especialista_nome: clinicRec.especialista_nome || '',
          especialista_crfa: clinicRec.especialista_crfa || '',
        })
      }

      // ---- Equipamentos ----
      setEquipments(
        equips.map((e: any) => ({
          id: e.id,
          nome: e.nome || '',
          data_calibracao: e.data_calibracao || '',
          proxima_calibracao: e.proxima_calibracao || '',
        })),
      )

      // ---- Contas a Receber ----
      setContasReceber(contasRec.map(mapContaReceber))

      // ---- Despesas ----
      try {
        const despesasList = await pb
          .collection('despesas')
          .getFullList({ sort: '-data_vencimento' })
        setDespesas(despesasList.map(mapDespesa))
      } catch (e) {
        console.warn('Erro ao carregar despesas:', e)
      }

      // ---- NFS-e emitidas (Vendas PDV) ----
      try {
        const nfseList = await pb.collection('nfse_emitidas').getFullList({ sort: '-created' })
        setNfseEmitidas(nfseList.map(mapNfseEmitida))
      } catch (e) {
        console.warn('Erro ao carregar NFS-e emitidas:', e)
      }
    } catch (err) {
      console.error('Erro ao carregar dados do PocketBase:', err)
    } finally {
      setDataLoading(false)
    }
  }, [])

  // ---------- Auth: restaurar sessão ----------
  useEffect(() => {
    try {
      // `pb.authStore.record` was renamed to `model` in PocketBase SDK v0.21+.
      // Support both to stay compatible across versions.
      const storeAny = pb.authStore as any
      const rec: any = storeAny.model || storeAny.record
      if (pb.authStore.isValid && rec) {
        const r: any = rec
        const restoredUser: User = {
          id: r.id,
          name: r.name || r.email || 'Usuário',
          email: r.email || '',
          role:
            r.role === 'profissional'
              ? 'profissional'
              : r.role === 'secretaria'
                ? 'secretaria'
                : 'admin',
          avatar: r.avatar || undefined,
          crmCrfa: r.crmCrfa || undefined,
          isSuperAdmin: !!r.is_super_admin,
          clinicaId: r.clinica_id || undefined,
          onboardingCompleted: undefined,
        }
        setCurrentUser(restoredUser)
        setTwoFactorEnabled(!!r.two_factor_enabled)
        // Hidrata o flag de onboarding da clínica em segundo plano.
        if (r.role === 'admin' && r.clinica_id) {
          fetchUserOnboarding(r.clinica_id).then((done) => {
            setCurrentUser((prev) =>
              prev && prev.id === restoredUser.id ? { ...prev, onboardingCompleted: done } : prev,
            )
          })
        } else {
          // Não-admin ou sem clínica: onboarding irrelevante => concluído.
          setCurrentUser((prev) =>
            prev && prev.id === restoredUser.id ? { ...prev, onboardingCompleted: true } : prev,
          )
        }
      }
    } catch (_) {
      // sessão inválida — ignora
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------- Carregar dados e assinar Realtime quando autenticado ----------
  useEffect(() => {
    if (currentUser && pb.authStore.isValid) {
      reloadAll()

      // Assinatura Realtime do PocketBase para a coleção 'appointments'
      pb.collection('appointments')
        .subscribe('*', (e) => {
          if (e.action === 'create') {
            const mapped = mapAppointment(e.record)
            setAppointments((prev) => {
              if (prev.some((a) => a.id === mapped.id)) return prev
              return [...prev, mapped]
            })
          } else if (e.action === 'update') {
            const mapped = mapAppointment(e.record)
            setAppointments((prev) => prev.map((a) => (a.id === mapped.id ? mapped : a)))
          } else if (e.action === 'delete') {
            setAppointments((prev) => prev.filter((a) => a.id !== e.record.id))
          }
        })
        .catch((err) => {
          console.warn('Erro ao assinar realtime de appointments:', err)
        })
    }

    return () => {
      pb.collection('appointments')
        .unsubscribe('*')
        .catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id])

  // Carrega as configurações de segurança ao autenticar.
  useEffect(() => {
    if (currentUser && pb.authStore.isValid) {
      fetchSecuritySettings()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id])

  // ---------- Chat Interno: contagem de mensagens não lidas ----------
  const refreshUnreadMessagesCount = useCallback(async () => {
    if (!currentUser?.id || !pb.authStore.isValid) {
      setUnreadMessagesCount(0)
      return
    }
    try {
      // Mensagens diretas: destinadas ao usuário e ainda não lidas.
      const direct = await pb.collection('mensagens').getList(1, 1, {
        filter: `destinatario = "${currentUser.id}" && lida = false && remetente != "${currentUser.id}"`,
      })
      // Mensagens de grupo (destinatario vazio): todas não lidas que não
      // foram enviadas pelo próprio usuário. Não há controle individual de
      // leitura por usuário no esquema, então contamos as não lidas do grupo.
      const grupo = await pb.collection('mensagens').getList(1, 1, {
        filter: `destinatario = "" && lida = false && remetente != "${currentUser.id}"`,
      })
      setUnreadMessagesCount((direct.totalItems || 0) + (grupo.totalItems || 0))
    } catch (err) {
      // Silencioso — a coleção pode não existir em ambientes sem a migration.
      console.warn('Erro ao contar mensagens não lidas:', err)
      setUnreadMessagesCount(0)
    }
  }, [currentUser?.id])

  // Carrega a contagem ao autenticar e faz polling a cada 30s.
  useEffect(() => {
    if (!currentUser?.id || !pb.authStore.isValid) {
      setUnreadMessagesCount(0)
      return
    }
    refreshUnreadMessagesCount()
    const interval = setInterval(refreshUnreadMessagesCount, 30000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, refreshUnreadMessagesCount])

  // ---------- Carregar configurações de segurança ----------
  const fetchSecuritySettings = useCallback(async () => {
    try {
      const list = await pb.collection('settings').getList(1, 1, { sort: '-created' })
      const rec: any = list.items?.[0]
      if (rec) {
        setSecuritySettings(mapSecuritySettings(rec))
      } else {
        // Cria o singleton com defaults se não existir.
        const created: any = await pb.collection('settings').create({
          session_timeout_enabled: true,
          session_timeout_minutes: 15,
          session_timeout_warning_seconds: 60,
          password_expiration_enabled: false,
          password_expiration_days: 0,
          password_min_length: 8,
          lockout_max_attempts: 5,
          lockout_duration_minutes: 15,
        })
        setSecuritySettings(mapSecuritySettings(created))
      }
    } catch (err) {
      console.error('Erro ao carregar configurações de segurança:', err)
      setSecuritySettings({ ...DEFAULT_SECURITY_SETTINGS })
    }
  }, [])

  const saveSecuritySettings = useCallback(
    async (data: Partial<SecuritySettings>): Promise<{ success: boolean; message?: string }> => {
      try {
        let current = securitySettings
        if (!current || !current.id) {
          try {
            const list = await pb.collection('settings').getList(1, 1, { sort: '-created' })
            if (list.items.length > 0) {
              current = mapSecuritySettings(list.items[0] as any)
            }
          } catch {
            /* ignore */
          }
        }
        const payload: Record<string, any> = {
          session_timeout_enabled: data.session_timeout_enabled ?? true,
          session_timeout_minutes: data.session_timeout_minutes ?? 15,
          session_timeout_warning_seconds: data.session_timeout_warning_seconds ?? 60,
          password_expiration_enabled: data.password_expiration_enabled ?? false,
          password_expiration_days: data.password_expiration_days ?? 0,
          password_min_length: data.password_min_length ?? 8,
          lockout_max_attempts: data.lockout_max_attempts ?? 5,
          lockout_duration_minutes: data.lockout_duration_minutes ?? 15,
        }
        let rec: any
        if (current && current.id) {
          rec = await pb.collection('settings').update(current.id, payload)
        } else {
          rec = await pb.collection('settings').create(payload)
        }
        setSecuritySettings(mapSecuritySettings(rec))
        toast({ title: 'Configurações de segurança salvas' })
        return { success: true }
      } catch (err) {
        console.error('Erro ao salvar configurações de segurança:', err)
        return {
          success: false,
          message: describePbError(err) || 'Não foi possível salvar as configurações.',
        }
      }
    },
    [securitySettings],
  )

  // ---------- Auth Handlers ----------
  const loginUserRecord = useCallback((r: any): User => {
    return {
      id: r.id,
      name: r.name || r.email || 'Usuário',
      email: r.email || '',
      role:
        r.role === 'profissional'
          ? 'profissional'
          : r.role === 'secretaria'
            ? 'secretaria'
            : 'admin',
      avatar: r.avatar || undefined,
      crmCrfa: r.crmCrfa || undefined,
      isSuperAdmin: !!r.is_super_admin,
      clinicaId: r.clinica_id || undefined,
      // onboardingCompleted é preenchido depois (ver fetchUserOnboarding),
      // porque o flag vive na coleção `clinicas`, não no `users`.
      onboardingCompleted: undefined,
    }
  }, [])

  /**
   * Busca o flag `onboarding_completed` da clínica vinculada ao usuário.
   * Retorna true se a clínica não existir ou se o campo estiver ausente
   * (preserva o comportamento de clínicas legadas, que não passam pelo
   * wizard). Chamado após login bem-sucedido e na restauração de sessão.
   */
  const fetchUserOnboarding = useCallback(
    async (clinicaId: string | undefined): Promise<boolean> => {
      if (!clinicaId) return true
      try {
        const clinica: any = await pb.collection('clinicas').getOne(clinicaId)
        return clinica?.onboarding_completed === true
      } catch (_) {
        // clínica não encontrada ou sem permissão: assume concluído.
        return true
      }
    },
    [],
  )

  /**
   * Marca o onboarding da clínica do usuário atual como concluído no estado
   * local (currentUser.onboardingCompleted = true). O wizard persistiu o
   * flag na clínica antes de chamar; aqui só sincronizamos o cache local.
   */
  const markOnboardingCompleted = useCallback(() => {
    setCurrentUser((prev) => (prev ? { ...prev, onboardingCompleted: true } : prev))
  }, [])

  /**
   * Busca um usuário pelo e-mail SEM autenticar (para checar bloqueio/2FA antes).
   * Usa authWithPassword só para validar a senha; se falhar, trata como falha de login.
   */
  const login = async (email: string, pass: string, _rememberMe = false): Promise<LoginResult> => {
    const trimmedEmail = email.trim()
    try {
      // 1) Tenta autenticar com senha. Se falhar, conta como tentativa falha.
      const auth = await pb.collection('users').authWithPassword(trimmedEmail, pass)
      const r: any = auth.record

      // 2) Verifica bloqueio (locked_until).
      const lockedUntil = r.locked_until as string | undefined
      if (lockedUntil) {
        const mins = minutesUntil(lockedUntil)
        if (mins > 0) {
          // Limpa a sessão que acabou de ser criada — não deve logar.
          pb.authStore.clear()
          return { locked: true, minutesLeft: mins }
        }
      }

      // 3) Reseta tentativas falhas em login bem-sucedido.
      try {
        await pb.collection('users').update(r.id, { failed_login_attempts: 0, locked_until: '' })
      } catch {
        /* ignore */
      }

      // 4) 2FA: se habilitado, NÃO consolida o login — pede o token.
      //    Mantemos o authStore válido (a sessão foi autenticada por senha)
      //    mas NÃO setamos currentUser, de forma que as rotas protegidas
      //    permanecem bloqueadas até verify2FA() concluir.
      if (r.two_factor_enabled) {
        const backupCodes: string[] = Array.isArray(r.two_factor_backup_codes)
          ? r.two_factor_backup_codes
          : []
        return {
          requires2FA: true,
          userId: r.id,
          email: r.email || trimmedEmail,
          backupAvailable: backupCodes.length > 0,
          forcePasswordChange: !!r.force_password_change,
        }
      }

      // 5) Sem 2FA — loga normalmente.
      const user = loginUserRecord(r)
      // Resolve o flag de onboarding da clínica antes de consolidar o login,
      // para que o redirecionamento pós-login (Dashboard vs /onboarding)
      // decida com base no estado já hidratado — sem flash de tela.
      if (user.role === 'admin' && user.clinicaId) {
        user.onboardingCompleted = await fetchUserOnboarding(user.clinicaId)
      } else {
        user.onboardingCompleted = true
      }
      setCurrentUser(user)
      setTwoFactorEnabled(false)
      toast({
        title: 'Acesso autorizado',
        description: `Bem-vindo(a) ao Audição360, ${user.name}!`,
      })
      return true
    } catch (err: any) {
      console.error('Falha no login:', err)
      // 6) Tentativa falha: tenta incrementar o contador e bloquear se exceder.
      try {
        // Busca o usuário pelo e-mail para incrementar o contador (best-effort).
        const list = await pb.collection('users').getList(1, 1, {
          filter: `email = "${trimmedEmail}"`,
        })
        if (list.items.length > 0) {
          const u: any = list.items[0]
          const attempts = (Number(u.failed_login_attempts) || 0) + 1
          const maxAttempts = securitySettings?.lockout_max_attempts || 5
          const lockoutMin = securitySettings?.lockout_duration_minutes || 15
          const patch: Record<string, any> = { failed_login_attempts: attempts }
          if (attempts >= maxAttempts) {
            const lockUntil = new Date(Date.now() + lockoutMin * 60000).toISOString()
            patch.locked_until = lockUntil
            await pb.collection('users').update(u.id, patch)
            return { locked: true, minutesLeft: lockoutMin }
          }
          await pb.collection('users').update(u.id, patch)
        }
      } catch (e) {
        console.warn('Não foi possível incrementar tentativas falhas:', e)
      }
      return false
    }
  }

  /**
   * Finaliza o login após verificação do 2FA (token TOTP ou backup code).
   * Reautentica com senha? Não — não temos a senha. Em vez disso, autenticamos
   * via token TOTP com authWithPassword novamente não é possível.
   *
   * Abordagem: usamos o fato de que o PocketBase retorna o registro auth.
   * Como não temos a senha aqui, faremos uma segunda authWithPassword com
   * um token "mágico"? Não. Em vez disso, o fluxo real é: a tela de login
   * chama login(email, senha) que autentica e detecta 2FA; mantemos a
   * sessão autenticada ativa (não limpamos) e apenas verificamos o token
   * TOTP no cliente. Se válido, consolidamos o login.
   *
   * Para manter a sessão já autenticada, verify2FA reautentica com a senha
   * armazenada temporariamente. Como não guardamos a senha, o fluxo abaixo
   * espera que a tela repasse email+senha. Implementação simplificada:
   * verify2FA(userId, token, useBackup) verifica o token contra o segredo
   * do registro (buscado via API) e, se ok, reautentica com a senha
   * temporária guardada no estado de login.
   *
   * NOTA PRÁTICA: A tela de Login guarda email+senha e chama login() que
   * autentica e devolve requires2FA; a sessão fica válida no authStore.
   * Mantemos authStore intacto e apenas verificamos o token no cliente.
   * Assim verify2FA não precisa reautenticar.
   */
  const verify2FA = useCallback(
    async (
      userId: string,
      token: string,
      useBackup = false,
    ): Promise<{ success: boolean; message?: string; forcePasswordChange?: boolean }> => {
      try {
        // Busca o registro do usuário (segredo + backup codes).
        const rec: any = await pb.collection('users').getOne(userId)

        if (useBackup) {
          const hashes: string[] = Array.isArray(rec.two_factor_backup_codes)
            ? rec.two_factor_backup_codes
            : []
          const ok = await verifyBackupCode(token, hashes)
          if (!ok) {
            return { success: false, message: 'Código de backup inválido.' }
          }
          // Remove o código usado (consome um backup code).
          const used = await (await import('@/lib/twoFactor')).hashBackupCode(token)
          const remaining = hashes.filter((h) => h !== used)
          await pb.collection('users').update(userId, {
            two_factor_backup_codes: remaining,
            failed_login_attempts: 0,
            locked_until: '',
          })
        } else {
          const secret = rec.two_factor_secret || ''
          if (!secret) {
            return { success: false, message: '2FA não configurado para este usuário.' }
          }
          const ok = await verifyToken(secret, token)
          if (!ok) {
            return { success: false, message: 'Código de verificação inválido.' }
          }
        }

        // Reautentica para estabelecer a sessão (não temos a senha —
        // rely on the still-valid authStore from the initial login call).
        // Como o login() limpou o authStore ao detectar 2FA, precisamos
        // reautenticar. Sem a senha isso não é possível pela API de auth.
        //
        // SOLUÇÃO: o fluxo de login NÃO limpa o authStore quando 2FA é
        // requerido. Ajustamos login() acima para manter a sessão e
        // apenas sinalizar requires2FA. Aqui, portanto, a sessão já
        // está autenticada; basta carregar o usuário.
        const storeAny = pb.authStore as any
        const authRec: any = storeAny.model || storeAny.record
        if (!pb.authStore.isValid || !authRec || authRec.id !== userId) {
          return {
            success: false,
            message: 'Sessão expirada. Faça login novamente.',
          }
        }

        const user = loginUserRecord(authRec)
        // Resolve o flag de onboarding da clínica para o admin (2FA).
        if (user.role === 'admin' && user.clinicaId) {
          user.onboardingCompleted = await fetchUserOnboarding(user.clinicaId)
        } else {
          user.onboardingCompleted = true
        }
        setCurrentUser(user)
        setTwoFactorEnabled(true)
        toast({
          title: 'Acesso autorizado',
          description: `Bem-vindo(a) ao Audição360, ${user.name}!`,
        })
        return { success: true, forcePasswordChange: !!rec.force_password_change }
      } catch (err) {
        console.error('Erro na verificação 2FA:', err)
        return { success: false, message: 'Não foi possível verificar o 2FA.' }
      }
    },
    [loginUserRecord, fetchUserOnboarding],
  )

  /**
   * Ativa 2FA para o usuário atual: armazena o segredo e os hashes dos
   * backup codes, marca two_factor_enabled = true.
   */
  const enable2FA = useCallback(
    async (
      secret: string,
      backupCodesHashed: string[],
    ): Promise<{ success: boolean; message?: string }> => {
      if (!currentUser?.id) {
        return { success: false, message: 'Usuário não autenticado.' }
      }
      try {
        await pb.collection('users').update(currentUser.id, {
          two_factor_enabled: true,
          two_factor_secret: secret,
          two_factor_backup_codes: backupCodesHashed,
          two_factor_method: 'totp',
          two_factor_setup_at: new Date().toISOString(),
        })
        setTwoFactorEnabled(true)
        toast({
          title: 'Autenticação de dois fatores ativada',
          description: 'Sua conta está mais segura agora.',
        })
        return { success: true }
      } catch (err) {
        console.error('Erro ao ativar 2FA:', err)
        return {
          success: false,
          message: describePbError(err) || 'Não foi possível ativar o 2FA.',
        }
      }
    },
    [currentUser?.id],
  )

  /**
   * Desativa 2FA. Admin NÃO pode desativar (regra de negócio).
   */
  const disable2FA = useCallback(async (): Promise<{ success: boolean; message?: string }> => {
    if (!currentUser?.id) {
      return { success: false, message: 'Usuário não autenticado.' }
    }
    if (currentUser.role === 'admin') {
      return {
        success: false,
        message: 'Por segurança, o administrador não pode desativar o 2FA.',
      }
    }
    try {
      await pb.collection('users').update(currentUser.id, {
        two_factor_enabled: false,
        two_factor_secret: '',
        two_factor_backup_codes: [],
        two_factor_method: '',
        two_factor_setup_at: '',
      })
      setTwoFactorEnabled(false)
      toast({ title: '2FA desativado', variant: 'destructive' })
      return { success: true }
    } catch (err) {
      console.error('Erro ao desativar 2FA:', err)
      return {
        success: false,
        message: describePbError(err) || 'Não foi possível desativar o 2FA.',
      }
    }
  }, [currentUser?.id, currentUser?.role])

  const logout = () => {
    pb.authStore.clear()
    setCurrentUser(null)
    setTwoFactorEnabled(false)
    // Limpar dados em memória
    setPatients([])
    setAppointments([])
    setAidsRaw([])
    setMaintenances([])
    setAdjustments([])
    setStockRaw([])
    setStockMovements([])
    setBudgets([])
    setSales([])
    setInstallments([])
    setCommissions([])
    setCashMovements([])
    setClinicalRecords({})
    setEvolutions([])
    setAudiometries([])
    setTympanometries([])
    setBeras([])
    setClinicSettings(null)
    setEquipments([])
    setFechamentosCaixa([])
    setMovimentacoesCaixa([])
    setVendasB2B([])
    setEmpresasParceiras([])
    setNfServicoComissao([])
    setNfseB2BConfig(null)
    setContasReceber([])
    setDespesas([])
    setNfseEmitidas([])
    toast({
      title: 'Sessão encerrada',
      description: 'Você saiu do sistema com segurança.',
    })
  }

  const recoverPassword = (email: string): boolean => {
    if (!email || !email.includes('@')) return false
    // Dispara solicitação de redefinição de senha no PocketBase
    pb.collection('users')
      .requestPasswordReset(email)
      .catch((e) => {
        console.warn('requestPasswordReset falhou:', e)
      })
    toast({
      title: 'Link de recuperação enviado',
      description: `Enviamos as instruções de recuperação para ${email}.`,
    })
    return true
  }

  /**
   * Troca de senha com política, histórico (últimas 3) e atualização de
   * password_changed_at + force_password_change = false.
   */
  const changePassword = useCallback(
    async (
      oldPassword: string,
      newPassword: string,
    ): Promise<{ success: boolean; message?: string }> => {
      if (!currentUser?.id) {
        return { success: false, message: 'Usuário não autenticado.' }
      }
      const minLen = securitySettings?.password_min_length || 8
      const validation = validatePassword(newPassword, minLen)
      if (!validation.valid) {
        return { success: false, message: validation.errors.join(' ') }
      }
      try {
        // Busca o registro atual para validar a senha antiga e o histórico.
        const rec: any = await pb.collection('users').getOne(currentUser.id)

        // Verifica o histórico (últimas 3) ANTES de trocar a senha —
        // rejeita reuso sem chegar a alterar a senha no PocketBase.
        const history: any[] = Array.isArray(rec.password_history) ? rec.password_history : []
        const candidateHash = await hashSha256Browser(newPassword)
        if (history.includes(candidateHash)) {
          return {
            success: false,
            message: 'A nova senha não pode ser igual a uma das últimas 3 senhas utilizadas.',
          }
        }

        // Atualiza a senha (PocketBase valida oldPassword automaticamente
        // quando o campo `oldPassword` é enviado junto).
        await pb.collection('users').update(currentUser.id, {
          password: newPassword,
          passwordConfirm: newPassword,
          oldPassword,
        })

        // Atualiza histórico (mantém últimas 3) + password_changed_at +
        // limpa force_password_change.
        const newHistory = [candidateHash, ...history].slice(0, 3)

        await pb.collection('users').update(currentUser.id, {
          password_history: newHistory,
          password_changed_at: new Date().toISOString(),
          force_password_change: false,
        })

        toast({ title: 'Senha alterada com sucesso' })
        return { success: true }
      } catch (err) {
        console.error('Erro ao trocar senha:', err)
        const msg = describePbError(err)
        if (msg && /old|senha atual|current password/i.test(msg)) {
          return { success: false, message: 'A senha atual informada está incorreta.' }
        }
        return { success: false, message: msg || 'Não foi possível alterar a senha.' }
      }
    },
    [currentUser?.id, securitySettings?.password_min_length],
  )

  // ---------- Atualização do próprio perfil ----------
  const updateProfile = async (data: {
    name: string
    crmCrfa?: string
    oldPassword?: string
    newPassword?: string
    passwordConfirm?: string
  }): Promise<{ success: boolean; message?: string }> => {
    if (!currentUser?.id) {
      return { success: false, message: 'Usuário não autenticado.' }
    }
    try {
      const baseData: Record<string, any> = {
        name: data.name.trim(),
        crmCrfa: data.crmCrfa?.trim() || '',
      }
      // 1. Atualiza nome/CRFa
      await pb.collection('users').update(currentUser.id, baseData)

      // 2. Se newPassword preenchida, delega para changePassword (com política).
      if (data.newPassword && data.newPassword.trim() !== '') {
        if (!data.oldPassword) {
          return {
            success: false,
            message: 'Para alterar a senha é necessário informar a senha atual.',
          }
        }
        if (data.newPassword !== data.passwordConfirm) {
          return { success: false, message: 'A nova senha e a confirmação não conferem.' }
        }
        const res = await changePassword(data.oldPassword, data.newPassword)
        if (!res.success) return res
      }

      // Atualiza o currentUser local
      setCurrentUser((prev) =>
        prev
          ? {
              ...prev,
              name: data.name.trim(),
              crmCrfa: data.crmCrfa?.trim() || prev.crmCrfa,
            }
          : prev,
      )
      return { success: true }
    } catch (err) {
      console.error('Erro ao atualizar perfil:', err)
      return {
        success: false,
        message: describePbError(err) || 'Não foi possível atualizar o perfil.',
      }
    }
  }

  // ---------- Upload de avatar ----------
  const uploadAvatar = async (file: File): Promise<{ success: boolean; message?: string }> => {
    if (!currentUser?.id) {
      return { success: false, message: 'Usuário não autenticado.' }
    }
    // Validação de tipo
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return {
        success: false,
        message: 'Formato não suportado. Envie uma imagem JPG, PNG ou WebP.',
      }
    }
    // Validação de tamanho (máx. 2MB)
    const MAX_SIZE = 2 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      return {
        success: false,
        message: 'A imagem excede o limite de 2MB.',
      }
    }
    try {
      const formData = new FormData()
      formData.append('avatar', file)
      const updated: any = await pb.collection('users').update(currentUser.id, formData)
      const newAvatar = updated?.avatar || ''
      // Atualiza o currentUser local para refletir imediatamente na UI
      setCurrentUser((prev) => (prev ? { ...prev, avatar: newAvatar || undefined } : prev))
      return { success: true }
    } catch (err) {
      console.error('Erro ao enviar avatar:', err)
      return {
        success: false,
        message: describePbError(err) || 'Não foi possível enviar a foto.',
      }
    }
  }

  // ---------- Configurações da Clínica Handlers ----------
  const saveClinicSettings = async (
    data: Partial<Omit<ClinicSettings, 'id'>> & {
      logoFile?: File | null
      certificadoFile?: File | null
      templateAudiometriaFile?: File | null
      templateImitanciometriaFile?: File | null
    },
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      // Garante que exista um registro singleton carregado.
      let current = clinicSettings
      if (!current) {
        try {
          const list = await pb.collection('clinic_settings').getList(1, 1, { sort: '-created' })
          if (list.items.length > 0) {
            const r = list.items[0] as any
            const logoUrl = r.logo ? pb.files.getUrl(r, r.logo) : r.logo_url || ''
            const certificadoUrl = r.certificado_digital
              ? pb.files.getUrl(r, r.certificado_digital)
              : r.certificado_digital_url || ''
            const tplAudioUrl = r.template_audiometria
              ? pb.files.getUrl(r, r.template_audiometria)
              : r.template_audiometria_url || ''
            const tplImitUrl = r.template_imitanciometria
              ? pb.files.getUrl(r, r.template_imitanciometria)
              : r.template_imitanciometria_url || ''
            current = {
              id: r.id,
              nome: r.nome || '',
              cnpj: r.cnpj || '',
              inscricao_estadual: r.inscricao_estadual || '',
              inscricao_municipal: r.inscricao_municipal || '',
              certificado_digital: r.certificado_digital || '',
              certificado_digital_url: certificadoUrl,
              template_audiometria: r.template_audiometria || '',
              template_audiometria_url: tplAudioUrl,
              template_imitanciometria: r.template_imitanciometria || '',
              template_imitanciometria_url: tplImitUrl,
              coordenadas_audiometria:
                (r.coordenadas_audiometria as Record<string, unknown> | null) ?? null,
              coordenadas_imitanciometria:
                (r.coordenadas_imitanciometria as Record<string, unknown> | null) ?? null,
              endereco: r.endereco || '',
              telefone: r.telefone || '',
              email: r.email || '',
              site: r.site || '',
              logo: r.logo || '',
              logo_url: logoUrl,
              audiometro: r.audiometro || '',
              calibracao: r.calibracao || '',
              especialista_nome: r.especialista_nome || '',
              especialista_crfa: r.especialista_crfa || '',
            }
          }
        } catch {
          /* intentionally ignored */
        }
      }

      let updated: any
      const hasFiles =
        !!data.logoFile ||
        !!data.certificadoFile ||
        !!data.templateAudiometriaFile ||
        !!data.templateImitanciometriaFile

      if (hasFiles) {
        const formData = new FormData()
        if (data.nome !== undefined) formData.append('nome', data.nome)
        if (data.cnpj !== undefined) formData.append('cnpj', data.cnpj)
        if (data.inscricao_estadual !== undefined)
          formData.append('inscricao_estadual', data.inscricao_estadual)
        if (data.inscricao_municipal !== undefined)
          formData.append('inscricao_municipal', data.inscricao_municipal)
        if (data.endereco !== undefined) formData.append('endereco', data.endereco)
        if (data.telefone !== undefined) formData.append('telefone', data.telefone)
        if (data.email !== undefined) formData.append('email', data.email)
        if (data.site !== undefined) formData.append('site', data.site)
        if (data.audiometro !== undefined) formData.append('audiometro', data.audiometro)
        if (data.calibracao !== undefined) formData.append('calibracao', data.calibracao)
        if (data.especialista_nome !== undefined)
          formData.append('especialista_nome', data.especialista_nome)
        if (data.especialista_crfa !== undefined)
          formData.append('especialista_crfa', data.especialista_crfa)
        if (data.logoFile) {
          formData.append('logo', data.logoFile)
        }
        if (data.certificadoFile) {
          formData.append('certificado_digital', data.certificadoFile)
        }
        if (data.templateAudiometriaFile) {
          formData.append('template_audiometria', data.templateAudiometriaFile)
        }
        if (data.templateImitanciometriaFile) {
          formData.append('template_imitanciometria', data.templateImitanciometriaFile)
        }

        if (!current) {
          updated = await pb.collection('clinic_settings').create(formData)
        } else {
          updated = await pb.collection('clinic_settings').update(current.id, formData)
        }
      } else {
        const payload: Record<string, any> = {}
        if (data.nome !== undefined) payload.nome = data.nome
        if (data.cnpj !== undefined) payload.cnpj = data.cnpj
        if (data.inscricao_estadual !== undefined)
          payload.inscricao_estadual = data.inscricao_estadual
        if (data.inscricao_municipal !== undefined)
          payload.inscricao_municipal = data.inscricao_municipal
        if (data.endereco !== undefined) payload.endereco = data.endereco
        if (data.telefone !== undefined) payload.telefone = data.telefone
        if (data.email !== undefined) payload.email = data.email
        if (data.site !== undefined) payload.site = data.site
        if (data.audiometro !== undefined) payload.audiometro = data.audiometro
        if (data.calibracao !== undefined) payload.calibracao = data.calibracao
        if (data.especialista_nome !== undefined) payload.especialista_nome = data.especialista_nome
        if (data.especialista_crfa !== undefined) payload.especialista_crfa = data.especialista_crfa
        if (data.coordenadas_audiometria !== undefined)
          payload.coordenadas_audiometria = data.coordenadas_audiometria
        if (data.coordenadas_imitanciometria !== undefined)
          payload.coordenadas_imitanciometria = data.coordenadas_imitanciometria

        if (!current) {
          updated = await pb.collection('clinic_settings').create(payload)
        } else {
          updated = await pb.collection('clinic_settings').update(current.id, payload)
        }
      }

      const logoUrl = updated.logo ? pb.files.getUrl(updated, updated.logo) : updated.logo_url || ''
      const certificadoUrl = updated.certificado_digital
        ? pb.files.getUrl(updated, updated.certificado_digital)
        : updated.certificado_digital_url || ''
      const tplAudioUrl = updated.template_audiometria
        ? pb.files.getUrl(updated, updated.template_audiometria)
        : updated.template_audiometria_url || ''
      const tplImitUrl = updated.template_imitanciometria
        ? pb.files.getUrl(updated, updated.template_imitanciometria)
        : updated.template_imitanciometria_url || ''
      setClinicSettings({
        id: updated.id,
        nome: updated.nome || '',
        cnpj: updated.cnpj || '',
        inscricao_estadual: updated.inscricao_estadual || '',
        inscricao_municipal: updated.inscricao_municipal || '',
        certificado_digital: updated.certificado_digital || '',
        certificado_digital_url: certificadoUrl,
        template_audiometria: updated.template_audiometria || '',
        template_audiometria_url: tplAudioUrl,
        template_imitanciometria: updated.template_imitanciometria || '',
        template_imitanciometria_url: tplImitUrl,
        coordenadas_audiometria:
          (updated.coordenadas_audiometria as Record<string, unknown> | null) ?? null,
        coordenadas_imitanciometria:
          (updated.coordenadas_imitanciometria as Record<string, unknown> | null) ?? null,
        endereco: updated.endereco || '',
        telefone: updated.telefone || '',
        email: updated.email || '',
        site: updated.site || '',
        logo: updated.logo || '',
        logo_url: logoUrl,
        audiometro: updated.audiometro || '',
        calibracao: updated.calibracao || '',
        especialista_nome: updated.especialista_nome || '',
        especialista_crfa: updated.especialista_crfa || '',
      })
      toast({ title: 'Configurações salvas', description: 'Dados da clínica atualizados.' })
      return { success: true }
    } catch (err) {
      console.error('Erro ao salvar clinic_settings:', err)
      return {
        success: false,
        message: describePbError(err) || 'Não foi possível salvar as configurações.',
      }
    }
  }

  const addEquipment = async (
    eq: Omit<Equipment, 'id' | 'proxima_calibracao'>,
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      if (!eq.nome?.trim()) return { success: false, message: 'Informe o nome do equipamento.' }
      if (!eq.data_calibracao) return { success: false, message: 'Informe a data de calibração.' }
      const proxima = computeNextCalibration(eq.data_calibracao)
      const rec: any = await pb.collection('equipments').create({
        nome: eq.nome.trim(),
        data_calibracao: eq.data_calibracao,
        proxima_calibracao: proxima,
      })
      setEquipments((prev) =>
        [
          ...prev,
          {
            id: rec.id,
            nome: rec.nome || '',
            data_calibracao: rec.data_calibracao || '',
            proxima_calibracao: rec.proxima_calibracao || '',
          },
        ].sort((a, b) => a.nome.localeCompare(b.nome)),
      )
      toast({ title: 'Equipamento cadastrado', description: `${eq.nome} foi adicionado.` })
      return { success: true }
    } catch (err) {
      console.error('Erro ao criar equipamento:', err)
      return {
        success: false,
        message: describePbError(err) || 'Não foi possível cadastrar o equipamento.',
      }
    }
  }

  const updateEquipment = async (
    id: string,
    eq: Partial<Omit<Equipment, 'id'>>,
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      const patch: Record<string, any> = {}
      if (eq.nome !== undefined) patch.nome = eq.nome.trim()
      if (eq.data_calibracao !== undefined) {
        patch.data_calibracao = eq.data_calibracao
        patch.proxima_calibracao = computeNextCalibration(eq.data_calibracao)
      }
      const rec: any = await pb.collection('equipments').update(id, patch)
      setEquipments((prev) =>
        prev
          .map((e) =>
            e.id === id
              ? {
                  id: rec.id,
                  nome: rec.nome || '',
                  data_calibracao: rec.data_calibracao || '',
                  proxima_calibracao: rec.proxima_calibracao || '',
                }
              : e,
          )
          .sort((a, b) => a.nome.localeCompare(b.nome)),
      )
      toast({ title: 'Equipamento atualizado', description: 'Dados salvos com sucesso.' })
      return { success: true }
    } catch (err) {
      console.error('Erro ao atualizar equipamento:', err)
      return {
        success: false,
        message: describePbError(err) || 'Não foi possível atualizar o equipamento.',
      }
    }
  }

  const deleteEquipment = async (id: string): Promise<{ success: boolean; message?: string }> => {
    try {
      await pb.collection('equipments').delete(id)
      setEquipments((prev) => prev.filter((e) => e.id !== id))
      toast({ title: 'Equipamento excluído', variant: 'destructive' })
      return { success: true }
    } catch (err) {
      console.error('Erro ao excluir equipamento:', err)
      return {
        success: false,
        message: describePbError(err) || 'Não foi possível excluir o equipamento.',
      }
    }
  }

  // ---------- Pacientes Handlers ----------
  const addPatient = (patientData: Omit<Patient, 'id' | 'createdAt'>): Patient => {
    const tempId = `temp-${Date.now()}`
    const newPatient: Patient = {
      ...patientData,
      id: tempId,
      createdAt: todayStr(),
      lastVisit: patientData.lastVisit || todayStr(),
    }
    setPatients((prev) => [newPatient, ...prev])
    toast({
      title: 'Paciente cadastrado',
      description: `${newPatient.name} foi adicionado(a) com sucesso.`,
    })

    // Monta o payload respeitando os tipos do schema do PocketBase:
    // - email (tipo email): enviar vazio é rejeitado por validação; omitir quando ausente.
    // - responsible (tipo json): só enviar quando houver responsável; caso contrário omitir.
    const payload: Record<string, any> = {
      name: newPatient.name,
      cpf: newPatient.cpf,
      birthDate: newPatient.birthDate,
      gender: newPatient.gender,
      phone: newPatient.phone,
      mobile: newPatient.mobile,
      cep: newPatient.cep,
      street: newPatient.street,
      number: newPatient.number,
      complement: newPatient.complement || '',
      neighborhood: newPatient.neighborhood,
      city: newPatient.city,
      state: newPatient.state,
      planType: newPatient.planType,
      planName: newPatient.planName || '',
      cardNumber: newPatient.cardNumber || '',
      hasResponsible: !!newPatient.hasResponsible,
      hearingLossType: newPatient.hearingLossType,
      previousHearingAid: !!newPatient.previousHearingAid,
      previousAidBrand: newPatient.previousAidBrand || '',
      previousAidModel: newPatient.previousAidModel || '',
      generalNotes: newPatient.generalNotes || '',
      status: newPatient.status,
      lastVisit: newPatient.lastVisit || '',
    }
    // email: o campo é do tipo "email" no PocketBase — string vazia falha a validação.
    if (newPatient.email && newPatient.email.trim() !== '') {
      payload.email = newPatient.email.trim()
    }
    // responsible: campo json — só enviar quando houver dados de responsável.
    if (newPatient.hasResponsible && newPatient.responsible) {
      payload.responsible = newPatient.responsible
    }
    pb.collection('patients')
      .create(payload)
      .then((rec: any) => {
        const mapped = mapPatient(rec)
        setPatients((prev) => prev.map((p) => (p.id === tempId ? mapped : p)))
        // LGPD: registra automaticamente o consentimento de dados cadastrais
        // (status='aceito') para o novo paciente.
        pb.collection('consentimentos')
          .create({
            paciente_id: rec.id,
            tipo_consentimento: 'dados_cadastrais',
            versao_termo: `v1-${todayStr()}`,
            data_aceitacao: new Date().toISOString(),
            ip_aceitacao: '',
            usuario_id: currentUser?.id || '',
            usuario_nome: currentUser?.name || '',
            status: 'aceito',
            observacoes: TEXTO_PADRAO_CONSENTIMENTO.dados_cadastrais,
          })
          .catch((e) => console.warn('Não foi possível registrar consentimento LGPD:', e))
      })
      .catch((err) => {
        console.error('Erro ao criar paciente no PB:', err)
        setPatients((prev) => prev.filter((p) => p.id !== tempId))
        toast({
          title: 'Erro ao cadastrar',
          description: `Não foi possível salvar o paciente no servidor. ${describePbError(err)}`,
          variant: 'destructive',
        })
      })
    return newPatient
  }

  const updatePatient = (id: string, patientData: Partial<Patient>) => {
    setPatients((prev) => prev.map((p) => (p.id === id ? { ...p, ...patientData } : p)))
    const patch: any = { ...patientData }
    delete patch.id
    delete patch.createdAt
    // Mesmas regras do addPatient: email vazio falha validação do tipo "email";
    // responsible deve ser enviado apenas quando houver dados.
    if ('email' in patch) {
      if (patch.email && String(patch.email).trim() !== '') {
        patch.email = String(patch.email).trim()
      } else {
        delete patch.email
      }
    }
    if ('responsible' in patch) {
      if (!patch.responsible || Object.keys(patch.responsible).length === 0) {
        delete patch.responsible
      }
    }
    pb.collection('patients')
      .update(id, patch)
      .catch((err) => {
        console.error('Erro ao atualizar paciente:', err)
        toast({
          title: 'Erro ao atualizar',
          description: `Não foi possível salvar as alterações. ${describePbError(err)}`,
          variant: 'destructive',
        })
      })
    toast({
      title: 'Cadastro atualizado',
      description: 'Os dados do paciente foram salvos com sucesso.',
    })
  }

  const deletePatient = (id: string) => {
    const target = patients.find((p) => p.id === id)
    setPatients((prev) => prev.filter((p) => p.id !== id))
    pb.collection('patients')
      .delete(id)
      .catch((err) => console.error('Erro ao excluir paciente:', err))
    toast({
      title: 'Paciente excluído',
      description: target ? `${target.name} foi removido(a) do sistema.` : 'Paciente excluído.',
      variant: 'destructive',
    })
  }

  const getPatient = (id: string) => patients.find((p) => p.id === id)

  // ---------- Agenda Handlers ----------
  const addAppointment = (
    appData: Omit<Appointment, 'id' | 'createdAt'>,
    options?: { ignoreConflict?: boolean },
  ): { success: boolean; message?: string; appointment?: Appointment } => {
    // Encaixe: ignora validação de conflito de profissional.
    const ignoreConflict = !!options?.ignoreConflict
    // Validação de conflito de profissional
    const conflict = ignoreConflict
      ? undefined
      : appointments.find((existing) => {
          if (existing.status === 'Cancelado') return false
          if (existing.professionalName !== appData.professionalName) return false
          if (existing.date !== appData.date) return false
          const [exHour, exMin] = existing.time.split(':').map(Number)
          const [newHour, newMin] = appData.time.split(':').map(Number)
          const existingStart = exHour * 60 + exMin
          const existingEnd = existingStart + existing.duration
          const newStart = newHour * 60 + newMin
          const newEnd = newStart + appData.duration
          return newStart < existingEnd && newEnd > existingStart
        })

    if (conflict) {
      const msg = `Conflito de horário: ${appData.professionalName} já possui atendimento (${conflict.patientName}) às ${conflict.time}.`
      toast({
        title: 'Horário indisponível',
        description: msg,
        variant: 'destructive',
      })
      return { success: false, message: msg }
    }

    const tempId = `temp-${Date.now()}`
    const newAppointment: Appointment = {
      ...appData,
      id: tempId,
      createdAt: todayStr(),
    }
    setAppointments((prev) => [...prev, newAppointment])
    toast({
      title: 'Agendamento confirmado',
      description: `Atendimento agendado para ${newAppointment.patientName} em ${newAppointment.date} às ${newAppointment.time}.`,
    })

    const proceduresList =
      appData.proceduresList && appData.proceduresList.length > 0
        ? appData.proceduresList
        : [
            {
              procedureId: appData.procedureId || '',
              procedureName: appData.type || '',
              value: appData.value ?? 0,
              planType: appData.planType || 'Particular',
            },
          ]
    const payload: any = {
      patientId: appData.patientId || '',
      patientName: appData.patientName,
      patientPhone: appData.patientPhone || '',
      procedureId: appData.procedureId || '',
      type: appData.type,
      // Campo legado em texto (vírgula-separated) para consultas/buscas.
      procedimentos: appData.procedimentos || appData.type || '',
      date: appData.date,
      time: appData.time,
      duration: appData.duration,
      value: appData.value ?? 0,
      professionalName: appData.professionalName,
      status: appData.status,
      notes: appData.notes || '',
      planType: appData.planType || 'Particular',
      reception: appData.reception ?? '',
      // proceduresList: lista estruturada de procedimentos (multi-select).
      proceduresList,
    }
    pb.collection('appointments')
      .create(payload)
      .then((rec: any) => {
        const mapped = mapAppointment(rec)
        setAppointments((prev) => prev.map((a) => (a.id === tempId ? mapped : a)))
      })
      .catch((err) => {
        console.error('Erro ao criar agendamento no PB:', err)
        setAppointments((prev) => prev.filter((a) => a.id !== tempId))
      })

    return { success: true, appointment: newAppointment }
  }

  const updateAppointment = (
    id: string,
    appData: Partial<Appointment>,
    options?: { ignoreConflict?: boolean },
  ): { success: boolean; message?: string } => {
    const current = appointments.find((a) => a.id === id)
    if (!current) return { success: false, message: 'Agendamento não encontrado' }

    const ignoreConflict = !!options?.ignoreConflict
    const targetProf = appData.professionalName || current.professionalName
    const targetDate = appData.date || current.date
    const targetTime = appData.time || current.time
    const targetDur = appData.duration || current.duration

    if (appData.status !== 'Cancelado' && !ignoreConflict) {
      const conflict = appointments.find((existing) => {
        if (existing.id === id || existing.status === 'Cancelado') return false
        if (existing.professionalName !== targetProf) return false
        if (existing.date !== targetDate) return false
        const [exHour, exMin] = existing.time.split(':').map(Number)
        const [newHour, newMin] = targetTime.split(':').map(Number)
        const existingStart = exHour * 60 + exMin
        const existingEnd = existingStart + existing.duration
        const newStart = newHour * 60 + newMin
        const newEnd = newStart + targetDur
        return newStart < existingEnd && newEnd > existingStart
      })
      if (conflict) {
        const msg = `Conflito de horário: ${targetProf} já possui agendamento (${conflict.patientName}) às ${conflict.time}.`
        toast({
          title: 'Horário indisponível',
          description: msg,
          variant: 'destructive',
        })
        return { success: false, message: msg }
      }
    }

    setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, ...appData } : a)))
    const patch: any = { ...appData }
    delete patch.id
    delete patch.createdAt
    pb.collection('appointments')
      .update(id, patch)
      .catch((err) => console.error('Erro ao atualizar agendamento:', err))
    toast({
      title: 'Agendamento atualizado',
      description: 'As alterações foram salvas com sucesso.',
    })
    return { success: true }
  }

  const deleteAppointment = (id: string) => {
    const target = appointments.find((a) => a.id === id)
    if (target?.status === 'Realizado') {
      toast({
        title: 'Operação não permitida',
        description: 'Atendimentos finalizados (Realizados) não podem ser excluídos da agenda.',
        variant: 'destructive',
      })
      return
    }
    setAppointments((prev) => prev.filter((a) => a.id !== id))
    pb.collection('appointments')
      .delete(id)
      .catch((err) => console.error('Erro ao excluir agendamento:', err))
    toast({
      title: 'Agendamento cancelado',
      description: 'O agendamento foi removido da grade.',
      variant: 'destructive',
    })
  }

  // ---------- Prontuário & Evoluções ----------
  const updateClinicalRecord = (patientId: string, record: Partial<ClinicalRecord>) => {
    const pat = patients.find((p) => p.id === patientId)
    const current = clinicalRecords[patientId] || {
      patientId,
      mainComplaint: '',
      anamnesis: '',
      hearingHistory: '',
      currentMedications: '',
      familyHistory: '',
      diagnosis: '',
      conduct: '',
      nextReturn: '',
      updatedAt: '',
    }
    const updated: ClinicalRecord = {
      ...current,
      ...record,
      updatedAt: todayStr(),
    }
    setClinicalRecords((prev) => ({ ...prev, [patientId]: updated }))

    const payload: any = {
      patientId,
      patientName: pat?.name || '',
      mainComplaint: updated.mainComplaint,
      anamnesis: updated.anamnesis,
      hearingHistory: updated.hearingHistory,
      currentMedications: updated.currentMedications,
      familyHistory: updated.familyHistory,
      diagnosis: updated.diagnosis,
      conduct: updated.conduct,
      nextReturn: updated.nextReturn || '',
      updatedAt: updated.updatedAt,
    }

    // Procura registro existente pelo patientId
    pb.collection('clinical_records')
      .getFirstListItem(`patientId = "${patientId}"`)
      .then((existing) => {
        pb.collection('clinical_records')
          .update(existing.id, payload)
          .catch((err) => console.error('Erro ao atualizar prontuário:', err))
      })
      .catch(() => {
        // não existe — cria
        pb.collection('clinical_records')
          .create(payload)
          .catch((err) => console.error('Erro ao criar prontuário:', err))
      })

    toast({
      title: 'Prontuário salvo',
      description: 'Dados clínicos atualizados com sucesso.',
    })
  }

  const addEvolution = (
    evoData: Omit<ClinicalEvolution, 'id' | 'createdAt'>,
  ): ClinicalEvolution => {
    const tempId = `temp-${Date.now()}`
    const newEvo: ClinicalEvolution = {
      ...evoData,
      id: tempId,
      createdAt: nowIso(),
    }
    setEvolutions((prev) => [newEvo, ...prev])
    toast({
      title: 'Evolução registrada',
      description: 'Nova entrada adicionada ao histórico clínico.',
    })

    pb.collection('evolutions')
      .create({
        patientId: evoData.patientId || '',
        patientName: '',
        date: evoData.date,
        professionalName: evoData.professionalName,
        description: evoData.description,
      })
      .then((rec: any) => {
        const mapped = mapEvolution(rec)
        setEvolutions((prev) => prev.map((e) => (e.id === tempId ? mapped : e)))
      })
      .catch((err) => {
        console.error('Erro ao criar evolução:', err)
        setEvolutions((prev) => prev.filter((e) => e.id !== tempId))
      })
    return newEvo
  }

  const deleteEvolution = (id: string) => {
    setEvolutions((prev) => prev.filter((e) => e.id !== id))
    pb.collection('evolutions')
      .delete(id)
      .catch((err) => console.error('Erro ao excluir evolução:', err))
    toast({
      title: 'Evolução removida',
      description: 'Registro excluído do prontuário.',
      variant: 'destructive',
    })
  }

  // ---------- Exames ----------
  const addAudiometry = (exam: Omit<AudiometryExam, 'id'>): AudiometryExam => {
    const tempId = `temp-${Date.now()}`
    const newExam: AudiometryExam = { ...exam, id: tempId }
    setAudiometries((prev) => [newExam, ...prev])
    toast({
      title: 'Audiometria registrada',
      description: `Exame de audiometria de ${exam.patientName} salvo com sucesso.`,
    })

    pb.collection('audiometries')
      .create({
        patientId: exam.patientId || '',
        patientName: exam.patientName,
        date: exam.date,
        professionalName: exam.professionalName,
        airOD: exam.airOD,
        airOE: exam.airOE,
        boneOD: exam.boneOD,
        boneOE: exam.boneOE,
        srtOD: exam.srtOD,
        srtOE: exam.srtOE,
        iprfOD: exam.iprfOD,
        iprfOE: exam.iprfOE,
        lossDegree: exam.lossDegree,
        lossType: exam.lossType,
        notes: exam.notes || '',
      })
      .then((rec: any) => {
        const mapped = mapAudiometry(rec)
        setAudiometries((prev) => prev.map((a) => (a.id === tempId ? mapped : a)))
      })
      .catch((err) => {
        console.error('Erro ao criar audiometria:', err)
        setAudiometries((prev) => prev.filter((a) => a.id !== tempId))
      })
    return newExam
  }

  const deleteAudiometry = (id: string) => {
    setAudiometries((prev) => prev.filter((a) => a.id !== id))
    pb.collection('audiometries')
      .delete(id)
      .catch((err) => console.error('Erro ao excluir audiometria:', err))
    toast({
      title: 'Exame excluído',
      description: 'Audiometria removida com sucesso.',
      variant: 'destructive',
    })
  }

  const addTympanometry = (exam: Omit<TympanometryExam, 'id'>): TympanometryExam => {
    const tempId = `temp-${Date.now()}`
    const newExam: TympanometryExam = { ...exam, id: tempId }
    setTympanometries((prev) => [newExam, ...prev])
    toast({
      title: 'Imitanciometria registrada',
      description: `Exame de imitanciometria de ${exam.patientName} salvo com sucesso.`,
    })

    pb.collection('tympanometries')
      .create({
        patientId: exam.patientId || '',
        patientName: exam.patientName,
        date: exam.date,
        professionalName: exam.professionalName,
        tympanometryOD: exam.tympanometryOD,
        tympanometryOE: exam.tympanometryOE,
        reflexesOD: exam.reflexesOD,
        reflexesOE: exam.reflexesOE,
        conclusion: exam.conclusion,
        notes: exam.notes || '',
      })
      .then((rec: any) => {
        const mapped = mapTympanometry(rec)
        setTympanometries((prev) => prev.map((t) => (t.id === tempId ? mapped : t)))
      })
      .catch((err) => {
        console.error('Erro ao criar imitanciometria:', err)
        setTympanometries((prev) => prev.filter((t) => t.id !== tempId))
      })
    return newExam
  }

  const deleteTympanometry = (id: string) => {
    setTympanometries((prev) => prev.filter((t) => t.id !== id))
    pb.collection('tympanometries')
      .delete(id)
      .catch((err) => console.error('Erro ao excluir imitanciometria:', err))
    toast({
      title: 'Exame excluído',
      description: 'Imitanciometria removida com sucesso.',
      variant: 'destructive',
    })
  }

  const addBera = (exam: Omit<BeraExam, 'id'>): BeraExam => {
    const tempId = `temp-${Date.now()}`
    const newExam: BeraExam = { ...exam, id: tempId }
    setBeras((prev) => [newExam, ...prev])
    toast({
      title: 'BERA registrado',
      description: `Potencial evocado de ${exam.patientName} salvo com sucesso.`,
    })

    pb.collection('beras')
      .create({
        patientId: exam.patientId || '',
        patientName: exam.patientName,
        date: exam.date,
        professionalName: exam.professionalName,
        od: exam.od,
        oe: exam.oe,
        classification: exam.classification,
        notes: exam.notes || '',
      })
      .then((rec: any) => {
        const mapped = mapBera(rec)
        setBeras((prev) => prev.map((b) => (b.id === tempId ? mapped : b)))
      })
      .catch((err) => {
        console.error('Erro ao criar BERA:', err)
        setBeras((prev) => prev.filter((b) => b.id !== tempId))
      })
    return newExam
  }

  const deleteBera = (id: string) => {
    setBeras((prev) => prev.filter((b) => b.id !== id))
    pb.collection('beras')
      .delete(id)
      .catch((err) => console.error('Erro ao excluir BERA:', err))
    toast({
      title: 'Exame excluído',
      description: 'Registro de BERA removido.',
      variant: 'destructive',
    })
  }

  // ---------- Aparelhos Handlers ----------
  const addHearingAid = (aidData: Omit<HearingAid, 'id' | 'createdAt'>): HearingAid => {
    const tempId = `temp-${Date.now()}`
    const newAid: HearingAid = {
      ...aidData,
      id: tempId,
      createdAt: todayStr(),
      maintenances: [],
      adjustments: [],
    }
    setAidsRaw((prev) => [
      {
        id: tempId,
        brand: aidData.brand,
        model: aidData.model,
        type: aidData.type,
        side: aidData.side,
        serialNumber: aidData.serialNumber,
        patientId: aidData.patientId || '',
        patientName: aidData.patientName || '',
        saleDate: aidData.saleDate || '',
        saleValue: aidData.saleValue ?? 0,
        paymentMethod: aidData.paymentMethod || '',
        warrantyMonths: aidData.warrantyMonths,
        warrantyEndDate: aidData.warrantyEndDate || '',
        powerSource: aidData.powerSource,
        earMold: aidData.earMold,
        earMoldType: aidData.earMoldType || '',
        notes: aidData.notes || '',
        status: aidData.status,
        created: nowIso(),
      },
      ...prev,
    ])
    toast({
      title: 'Aparelho cadastrado',
      description: `${newAid.brand} ${newAid.model} adicionado com sucesso.`,
    })

    const payload: any = {
      patientId: aidData.patientId || '',
      patientName: aidData.patientName || '',
      brand: aidData.brand,
      model: aidData.model,
      type: aidData.type,
      side: aidData.side,
      serialNumber: aidData.serialNumber,
      saleDate: aidData.saleDate || '',
      saleValue: aidData.saleValue ?? 0,
      paymentMethod: aidData.paymentMethod || '',
      warrantyMonths: aidData.warrantyMonths,
      warrantyEndDate: aidData.warrantyEndDate || '',
      powerSource: aidData.powerSource,
      earMold: !!aidData.earMold,
      earMoldType: aidData.earMoldType || '',
      notes: aidData.notes || '',
      status: aidData.status,
    }
    pb.collection('hearing_aids')
      .create(payload)
      .then((rec: any) => {
        setAidsRaw((prev) => prev.map((a) => (a.id === tempId ? rec : a)))
      })
      .catch((err) => {
        console.error('Erro ao criar aparelho:', err)
        setAidsRaw((prev) => prev.filter((a) => a.id !== tempId))
      })
    return newAid
  }

  const updateHearingAid = (id: string, aidData: Partial<HearingAid>) => {
    setAidsRaw((prev) => prev.map((a) => (a.id === id ? { ...a, ...aidData } : a)))
    const patch: any = { ...aidData }
    delete patch.id
    delete patch.createdAt
    delete patch.maintenances
    delete patch.adjustments
    pb.collection('hearing_aids')
      .update(id, patch)
      .catch((err) => console.error('Erro ao atualizar aparelho:', err))
    toast({
      title: 'Aparelho atualizado',
      description: 'Informações do aparelho auditivo salvas.',
    })
  }

  const deleteHearingAid = (id: string) => {
    setAidsRaw((prev) => prev.filter((a) => a.id !== id))
    pb.collection('hearing_aids')
      .delete(id)
      .catch((err) => console.error('Erro ao excluir aparelho:', err))
    toast({
      title: 'Aparelho excluído',
      description: 'Registro de aparelho auditivo removido.',
      variant: 'destructive',
    })
  }

  const addAidMaintenance = (
    aidId: string,
    description: string,
    responsible: string,
    date: string,
  ) => {
    const aid = aidsRaw.find((a) => a.id === aidId)
    const tempId = `temp-${Date.now()}`
    const newMaint: AidMaintenance = {
      id: tempId,
      hearingAidId: aidId,
      date,
      description,
      responsible,
      createdAt: nowIso(),
    }
    setMaintenances((prev) => [newMaint, ...prev])
    toast({
      title: 'Manutenção registrada',
      description: 'Histórico de manutenção atualizado.',
    })

    pb.collection('maintenances')
      .create({
        hearingAidId: aidId,
        hearingAidLabel: aid ? `${aid.brand} ${aid.model}` : '',
        date,
        description,
        responsible,
      })
      .then((rec: any) => {
        const mapped = mapMaintenance(rec)
        setMaintenances((prev) => prev.map((m) => (m.id === tempId ? mapped : m)))
      })
      .catch((err) => {
        console.error('Erro ao criar manutenção:', err)
        setMaintenances((prev) => prev.filter((m) => m.id !== tempId))
      })
  }

  const addAidAdjustment = (
    aidId: string,
    description: string,
    professionalName: string,
    date: string,
  ) => {
    const aid = aidsRaw.find((a) => a.id === aidId)
    const tempId = `temp-${Date.now()}`
    const newAdj: AidAdjustment = {
      id: tempId,
      hearingAidId: aidId,
      date,
      description,
      professionalName,
      createdAt: nowIso(),
    }
    setAdjustments((prev) => [newAdj, ...prev])
    toast({
      title: 'Ajuste registrado',
      description: 'Histórico de ajuste fino do aparelho atualizado.',
    })

    pb.collection('adjustments')
      .create({
        hearingAidId: aidId,
        hearingAidLabel: aid ? `${aid.brand} ${aid.model}` : '',
        date,
        description,
        professionalName,
      })
      .then((rec: any) => {
        const mapped = mapAdjustment(rec)
        setAdjustments((prev) => prev.map((a) => (a.id === tempId ? mapped : a)))
      })
      .catch((err) => {
        console.error('Erro ao criar ajuste:', err)
        setAdjustments((prev) => prev.filter((a) => a.id !== tempId))
      })
  }

  // ---------- Financeiro Handlers ----------
  const addCashMovement = (
    movData: Omit<CashFlowMovement, 'id' | 'createdAt'>,
  ): CashFlowMovement => {
    const tempId = `temp-${Date.now()}`
    const newMov: CashFlowMovement = {
      ...movData,
      id: tempId,
      createdAt: nowIso(),
    }
    setCashMovements((prev) => [newMov, ...prev])

    pb.collection('cash_flow')
      .create({
        date: movData.date,
        description: movData.description,
        type: movData.type,
        category: movData.category,
        value: movData.value,
        responsible: movData.responsible,
      })
      .then((rec: any) => {
        const mapped = mapCashMovement(rec)
        setCashMovements((prev) => prev.map((m) => (m.id === tempId ? mapped : m)))
      })
      .catch((err) => {
        console.error('Erro ao criar movimentação de caixa:', err)
        setCashMovements((prev) => prev.filter((m) => m.id !== tempId))
      })
    return newMov
  }

  const addBudget = (budgetData: Omit<Budget, 'id' | 'createdAt' | 'number'>): Budget => {
    const nextNum = budgets.length > 0 ? Math.max(...budgets.map((b) => b.number)) + 1 : 1001
    const tempId = `temp-${Date.now()}`
    const newBudget: Budget = {
      ...budgetData,
      id: tempId,
      number: nextNum,
      createdAt: todayStr(),
    }
    setBudgets((prev) => [newBudget, ...prev])
    toast({
      title: 'Orçamento gerado',
      description: `Orçamento #${newBudget.number} criado com sucesso.`,
    })

    pb.collection('budgets')
      .create({
        patientId: budgetData.patientId || '',
        patientName: budgetData.patientName,
        number: nextNum,
        date: budgetData.date,
        items: budgetData.items,
        discountPercent: budgetData.discountPercent,
        totalValue: budgetData.totalValue,
        status: budgetData.status,
        notes: budgetData.notes || '',
      })
      .then((rec: any) => {
        const mapped = mapBudget(rec)
        setBudgets((prev) => prev.map((b) => (b.id === tempId ? mapped : b)))
      })
      .catch((err) => {
        console.error('Erro ao criar orçamento:', err)
        setBudgets((prev) => prev.filter((b) => b.id !== tempId))
      })
    return newBudget
  }

  const updateBudget = (id: string, budgetData: Partial<Budget>) => {
    setBudgets((prev) => prev.map((b) => (b.id === id ? { ...b, ...budgetData } : b)))
    const patch: any = { ...budgetData }
    delete patch.id
    delete patch.createdAt
    pb.collection('budgets')
      .update(id, patch)
      .catch((err) => console.error('Erro ao atualizar orçamento:', err))
    toast({
      title: 'Orçamento atualizado',
      description: 'As alterações foram salvas.',
    })
  }

  const deleteBudget = (id: string) => {
    setBudgets((prev) => prev.filter((b) => b.id !== id))
    pb.collection('budgets')
      .delete(id)
      .catch((err) => console.error('Erro ao excluir orçamento:', err))
    toast({
      title: 'Orçamento excluído',
      description: 'Orçamento removido com sucesso.',
      variant: 'destructive',
    })
  }

  const addSale = (saleData: Omit<Sale, 'id' | 'createdAt' | 'number'>): Sale => {
    const nextNum = sales.length > 0 ? Math.max(...sales.map((s) => Number(s.number))) + 1 : 501
    const tempId = `temp-${Date.now()}`
    const newSale: Sale = {
      ...saleData,
      id: tempId,
      number: nextNum,
      createdAt: todayStr(),
    }
    setSales((prev) => [newSale, ...prev])

    const totalInstallments = newSale.installmentsCount || 1
    const totalWithInterest = newSale.totalValue * (1 + (newSale.interestPercent || 0) / 100)
    const installmentValue = totalWithInterest / totalInstallments
    const baseDueDate = newSale.firstDueDate ? new Date(newSale.firstDueDate) : new Date()

    const tempInstallments: Installment[] = []
    for (let i = 1; i <= totalInstallments; i++) {
      const d = new Date(baseDueDate)
      d.setMonth(d.getMonth() + (i - 1))
      const dueStr = d.toISOString().split('T')[0]
      const isFirstPaid = newSale.paymentMethod === 'À vista'
      tempInstallments.push({
        id: `temp-inst-${Date.now()}-${i}`,
        saleId: tempId,
        saleNumber: nextNum,
        installmentNumber: i,
        totalInstallments,
        patientId: newSale.patientId,
        patientName: newSale.patientName,
        dueDate: dueStr,
        value: installmentValue,
        status: isFirstPaid ? 'Pago' : 'Pendente',
        paidDate: isFirstPaid ? newSale.date : undefined,
      })
    }
    setInstallments((prev) => [...tempInstallments, ...prev])

    if (newSale.paymentMethod === 'À vista') {
      addCashMovement({
        date: newSale.date,
        description: `Venda #${nextNum} à vista - ${newSale.patientName}`,
        type: 'Entrada',
        category: 'Venda de aparelho',
        value: newSale.totalValue,
        responsible: currentUser?.name || 'Recepção',
      })
    }

    toast({
      title: 'Venda registrada com sucesso!',
      description: `Venda #${nextNum} gerou ${totalInstallments} parcela(s).`,
    })

    // Persistir venda e parcelas no PB
    pb.collection('sales')
      .create({
        patientId: newSale.patientId || '',
        patientName: newSale.patientName,
        number: nextNum,
        date: newSale.date,
        itemsDescription: newSale.itemsDescription,
        totalValue: newSale.totalValue,
        paymentMethod: newSale.paymentMethod,
        installmentsCount: newSale.installmentsCount,
        interestPercent: newSale.interestPercent || 0,
        firstDueDate: newSale.firstDueDate || '',
        status: newSale.status,
        type: newSale.type || 'atendimento',
        items: newSale.items || [],
        subtotal: newSale.subtotal ?? newSale.totalValue,
        discountValue: newSale.discountValue ?? 0,
        discountPercent: newSale.discountPercent ?? 0,
        cancelReason: newSale.cancelReason || '',
        appointmentId: newSale.appointmentId || '',
        paymentDate: newSale.paymentDate || '',
        paymentNotes: newSale.paymentNotes || '',
      })
      .then(async (rec: any) => {
        const mappedSale = mapSale(rec)
        const realSaleId = rec.id
        setSales((prev) => prev.map((s) => (s.id === tempId ? mappedSale : s)))

        // Criar parcelas no PB
        const createdInsts: Installment[] = []
        for (const inst of tempInstallments) {
          try {
            const r: any = await pb.collection('installments').create({
              saleId: realSaleId,
              patientId: inst.patientId || '',
              patientName: inst.patientName,
              saleNumber: nextNum,
              installmentNumber: inst.installmentNumber,
              totalInstallments: inst.totalInstallments,
              dueDate: inst.dueDate,
              value: inst.value,
              status: inst.status,
              paidDate: inst.paidDate || '',
            })
            createdInsts.push(mapInstallment(r))
          } catch (err) {
            console.error('Erro ao criar parcela:', err)
          }
        }
        if (createdInsts.length > 0) {
          setInstallments((prev) => {
            const filtered = prev.filter((i) => !i.id.startsWith('temp-inst-'))
            return [...createdInsts, ...filtered]
          })
        }

        // ---- Integração Controle de Inadimplência ----
        // Vendas no PDV com forma "Convênio" ou "Boleto" geram 1 conta a
        // receber; vendas "Parcelado" geram N contas (uma por parcela).
        const pat = patients.find((p) => p.id === newSale.patientId)
        const descResumida =
          newSale.itemsDescription || `Venda #${nextNum} - ${newSale.patientName}`
        const baseVenc = newSale.firstDueDate || newSale.date
        if (newSale.paymentMethod === 'Convênio' || newSale.paymentMethod === 'Boleto') {
          const forma = newSale.paymentMethod === 'Convênio' ? 'convênio' : 'boleto'
          criarContasReceberDeVenda(realSaleId, 'pdv', {
            pacienteId: newSale.patientId,
            pacienteNome: newSale.patientName,
            pacienteTelefone: pat?.mobile || pat?.phone || '',
            descricao: descResumida,
            valor: newSale.totalValue,
            forma,
            numeroParcelas: 1,
            dataVenda: newSale.date,
            primeiroVencimento: baseVenc,
          }).catch((e) => console.error('Erro ao gerar conta a receber (PDV):', e))
        } else if (newSale.paymentMethod === 'Parcelado') {
          criarContasReceberDeVenda(realSaleId, 'pdv', {
            pacienteId: newSale.patientId,
            pacienteNome: newSale.patientName,
            pacienteTelefone: pat?.mobile || pat?.phone || '',
            descricao: descResumida,
            valor: newSale.totalValue,
            forma: 'parcelado',
            numeroParcelas: Math.max(1, newSale.installmentsCount || 1),
            dataVenda: newSale.date,
            primeiroVencimento: baseVenc,
          }).catch((e) => console.error('Erro ao gerar contas a receber (Parcelado):', e))
        }
      })
      .catch((err) => {
        console.error('Erro ao criar venda:', err)
        setSales((prev) => prev.filter((s) => s.id !== tempId))
      })

    return newSale
  }

  // ---------- Atualização / Cancelamento de Vendas ----------
  const updateSale = (id: string, data: Partial<Sale>) => {
    setSales((prev) => prev.map((s) => (s.id === id ? { ...s, ...data } : s)))
    const patch: any = { ...data }
    delete patch.id
    delete patch.createdAt
    delete patch.number
    // O campo no PocketBase é `estoque_baixado` (snake_case). A flag camelCase
    // `estoqueBaixado` existe apenas no tipo TS — traduzimos antes de enviar,
    // caso contrário a flag não persiste e o hook de auditoria (que observa
    // `estoque_baixado`) não dispara baixar_estoque_venda/devolver_estoque_venda.
    if ('estoqueBaixado' in patch) {
      patch.estoque_baixado = !!patch.estoqueBaixado
      delete patch.estoqueBaixado
    }
    pb.collection('sales')
      .update(id, patch)
      .catch((err) => console.error('Erro ao atualizar venda:', err))
  }

  // ============================================================
  // Baixa de estoque ao finalizar venda como Paga.
  //
  // Percorre os itens da venda e, para cada item de inventário
  // (type === 'inventory' com stockItemId), subtrai `quantity` do
  // currentQuantity do item e registra uma movimentação de saída.
  //
  // Idempotente: a flag `estoqueBaixado` garante que a baixa só
  // ocorra UMA vez por venda (mesmo se a venda for reaberta e
  // finalizada novamente). Permite estoque negativo (com aviso).
  // ============================================================
  const baixarEstoqueVenda = (sale: Sale): void => {
    if (!sale.items || sale.items.length === 0) return
    if (sale.estoqueBaixado) return // já baixado — não repetir

    const saleNum = sale.number
    let baixados = 0
    let avisos: string[] = []

    for (const it of sale.items) {
      if (it.type !== 'inventory' || !it.stockItemId) continue
      try {
        const target = stockRaw.find((s) => s.id === it.stockItemId)
        if (!target) {
          console.warn(`baixarEstoqueVenda: item ${it.stockItemId} não encontrado no estoque`)
          continue
        }
        // Subtrai do currentQuantity local (permite negativo)
        const newQty = Number(target.currentQuantity) - it.quantity
        setStockRaw((prev) =>
          prev.map((s) => (s.id === it.stockItemId ? { ...s, currentQuantity: newQty } : s)),
        )

        // Movimentação de saída vinculada à venda
        const movDate = sale.paymentDate || sale.date || todayStr()
        const tempId = `temp-mov-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        const newMov: StockMovement = {
          id: tempId,
          stockItemId: it.stockItemId,
          date: movDate,
          type: 'Saída',
          quantity: it.quantity,
          reason: `Venda #${saleNum} finalizada`,
          responsible: currentUser?.name || 'Sistema',
          saleId: sale.id,
          createdAt: nowIso(),
        }
        setStockMovements((prev) => [newMov, ...prev])

        pb.collection('inventory_movements')
          .create({
            itemId: it.stockItemId,
            item_name: target.name,
            date: movDate,
            type: 'Saída',
            quantity: it.quantity,
            reason: `Venda #${saleNum} finalizada`,
            supplier: '',
            patientName: sale.patientName || '',
            responsible: currentUser?.name || 'Sistema',
            saleId: sale.id,
          })
          .then((rec: any) => {
            const mapped = mapStockMovement(rec)
            setStockMovements((prev) => prev.map((m) => (m.id === tempId ? mapped : m)))
            // Atualiza o currentQuantity do item no PocketBase para refletir a
            // baixa local (a movimentação por si só não altera o saldo — é
            // apenas o registro histórico; o saldo fica no campo
            // currentQuantity do inventory).
            pb.collection('inventory')
              .update(it.stockItemId, { currentQuantity: newQty })
              .catch((err) =>
                console.error('Erro ao persistir currentQuantity (baixa venda):', err),
              )
          })
          .catch((err) => {
            console.error('Erro ao registrar baixa de estoque da venda:', err)
            setStockMovements((prev) => prev.filter((m) => m.id !== tempId))
          })

        baixados += 1

        // Avisos: abaixo do mínimo ou negativo
        const isServico = (target as any).categoria === 'servico'
        if (!isServico) {
          const min = Number((target as any).estoque_minimo) || Number(target.minQuantity) || 0
          if (newQty < 0) {
            avisos.push(`⚠ ${target.name} ficou com estoque negativo (${newQty}).`)
          } else if (min > 0 && newQty < min) {
            avisos.push(`${target.name} abaixo do mínimo (${newQty}/${min}).`)
          }
        }
      } catch (err) {
        console.error('Erro ao baixar estoque do item da venda:', err)
      }
    }

    // Marca a venda como tendo o estoque baixado (idempotência)
    if (baixados > 0) {
      updateSale(sale.id, { estoqueBaixado: true })
    }

    // Notificação/log de alertas
    if (avisos.length > 0) {
      toast({
        title: `Baixa de estoque — Venda #${saleNum}`,
        description: `${baixados} item(ns) baixado(s). ${avisos.join(' ')}`,
        variant: avisos.some((a) => a.includes('negativo')) ? 'destructive' : 'default',
      })
    }
  }

  // ============================================================
  // Devolução de estoque ao cancelar/estornar venda Paga.
  //
  // Só devolve se a venda teve baixa de estoque (estoqueBaixado).
  // Soma `quantity` de volta ao currentQuantity e registra uma
  // movimentação de entrada. O registro no audit_trail é feito
  // automaticamente pelo hook server-side (auditTrail.js).
  // ============================================================
  const devolverEstoqueVenda = (sale: Sale): void => {
    if (!sale.estoqueBaixado) return // não teve baixa — nada a devolver
    if (!sale.items || sale.items.length === 0) {
      // Mesmo sem itens, reseta a flag
      updateSale(sale.id, { estoqueBaixado: false })
      return
    }

    const saleNum = sale.number
    let devolvidos = 0

    for (const it of sale.items) {
      if (it.type !== 'inventory' || !it.stockItemId) continue
      try {
        const target = stockRaw.find((s) => s.id === it.stockItemId)
        if (!target) {
          console.warn(`devolverEstoqueVenda: item ${it.stockItemId} não encontrado`)
          continue
        }
        const newQty = Number(target.currentQuantity) + it.quantity
        setStockRaw((prev) =>
          prev.map((s) => (s.id === it.stockItemId ? { ...s, currentQuantity: newQty } : s)),
        )

        const movDate = todayStr()
        const tempId = `temp-mov-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        const newMov: StockMovement = {
          id: tempId,
          stockItemId: it.stockItemId,
          date: movDate,
          type: 'Entrada',
          quantity: it.quantity,
          reason: `Devolução — Venda #${saleNum} cancelada/estornada`,
          responsible: currentUser?.name || 'Sistema',
          saleId: sale.id,
          createdAt: nowIso(),
        }
        setStockMovements((prev) => [newMov, ...prev])

        pb.collection('inventory_movements')
          .create({
            itemId: it.stockItemId,
            item_name: target.name,
            date: movDate,
            type: 'Entrada',
            quantity: it.quantity,
            reason: `Devolução — Venda #${saleNum} cancelada/estornada`,
            supplier: '',
            responsible: currentUser?.name || 'Sistema',
            saleId: sale.id,
          })
          .then((rec: any) => {
            const mapped = mapStockMovement(rec)
            setStockMovements((prev) => prev.map((m) => (m.id === tempId ? mapped : m)))
            // Atualiza o currentQuantity do item no PocketBase para refletir a
            // devolução (a movimentação é apenas o histórico; o saldo fica no
            // campo currentQuantity do inventory).
            pb.collection('inventory')
              .update(it.stockItemId, { currentQuantity: newQty })
              .catch((err) =>
                console.error('Erro ao persistir currentQuantity (devolução venda):', err),
              )
          })
          .catch((err) => {
            console.error('Erro ao registrar devolução de estoque:', err)
            setStockMovements((prev) => prev.filter((m) => m.id !== tempId))
          })

        devolvidos += 1
      } catch (err) {
        console.error('Erro ao devolver estoque do item da venda:', err)
      }
    }

    // Reseta a flag — estoque devolvido
    updateSale(sale.id, { estoqueBaixado: false })

    if (devolvidos > 0) {
      toast({
        title: `Devolução de estoque — Venda #${saleNum}`,
        description: `${devolvidos} item(ns) devolvido(s) ao estoque.`,
      })
    }
  }

  const cancelSale = (id: string, reason: string, mode: 'Cancelado' | 'Estornado') => {
    const sale = sales.find((s) => s.id === id)
    if (!sale) return

    const tinhaBaixa = !!sale.estoqueBaixado

    // 1. Devolve itens de estoque ao saldo (apenas se houve baixa).
    //    O registro no audit_trail (ação devolver_estoque_venda e/ou
    //    cancelar_venda_paga) é feito pelo hook server-side ao detectar a
    //    mudança da flag `estoque_baixado` (true -> false) e do `status`.
    try {
      devolverEstoqueVenda(sale)
    } catch (err) {
      console.error('Erro ao devolver estoque na venda:', err)
    }

    // 2. Atualiza status + justificativa
    updateSale(id, { status: mode as SaleStatus, cancelReason: reason })

    toast({
      title: mode === 'Estornado' ? 'Venda estornada' : 'Venda cancelada',
      description: tinhaBaixa
        ? `Venda #${sale.number} foi ${mode === 'Estornado' ? 'estornada' : 'cancelada'} e os itens foram devolvidos ao estoque.`
        : `Venda #${sale.number} foi ${mode === 'Estornado' ? 'estornada' : 'cancelada'}.`,
      variant: 'destructive',
    })
  }

  const convertBudgetToSale = (
    budgetId: string,
    paymentMethod: any,
    installmentsCount = 1,
    firstDueDate?: string,
  ): Sale => {
    const b = budgets.find((item) => item.id === budgetId)
    if (!b) throw new Error('Orçamento não encontrado')

    const itemsSummary = b.items.map((it) => `${it.quantity}x ${it.description}`).join(', ')

    const newSale = addSale({
      patientId: b.patientId,
      patientName: b.patientName,
      date: todayStr(),
      itemsDescription: itemsSummary,
      totalValue: b.totalValue,
      paymentMethod,
      installmentsCount,
      interestPercent: 0,
      firstDueDate: firstDueDate || todayStr(),
      status: 'Concluída',
    })

    updateBudget(budgetId, { status: 'Convertido' })

    toast({
      title: 'Orçamento convertido em Venda!',
      description: `Orçamento #${b.number} transformado na Venda #${newSale.number}.`,
    })

    return newSale
  }

  const payInstallment = (installmentId: string, paidDate?: string) => {
    const paymentDateStr = paidDate || todayStr()
    let paidVal = 0
    let patName = ''
    let sNum = 0
    let iNum = 0

    setInstallments((prev) =>
      prev.map((inst) => {
        if (inst.id !== installmentId) return inst
        paidVal = inst.value
        patName = inst.patientName
        sNum = inst.saleNumber
        iNum = inst.installmentNumber
        return {
          ...inst,
          status: 'Pago',
          paidDate: paymentDateStr,
        }
      }),
    )

    pb.collection('installments')
      .update(installmentId, { status: 'Pago', paidDate: paymentDateStr })
      .catch((err) => console.error('Erro ao pagar parcela:', err))

    if (paidVal > 0) {
      addCashMovement({
        date: paymentDateStr,
        description: `Pagamento Parcela ${iNum} Venda #${sNum} - ${patName}`,
        type: 'Entrada',
        category: 'Pagamento de parcela',
        value: paidVal,
        responsible: currentUser?.name || 'Recepção',
      })
    }

    toast({
      title: 'Pagamento registrado',
      description: `Parcela quitada com sucesso em ${paymentDateStr}.`,
    })
  }

  const addCommission = (commData: Omit<Commission, 'id'>) => {
    const tempId = `temp-${Date.now()}`
    const newComm: Commission = { ...commData, id: tempId }
    setCommissions((prev) => [newComm, ...prev])
    toast({
      title: 'Comissão registrada',
      description: `Comissão de ${commData.professionalName} cadastrada para ${commData.period}.`,
    })

    pb.collection('commissions')
      .create({
        professionalName: commData.professionalName,
        period: commData.period,
        salesCount: commData.salesCount,
        totalSalesValue: commData.totalSalesValue,
        commissionPercent: commData.commissionPercent,
        commissionValue: commData.commissionValue,
      })
      .then((rec: any) => {
        const mapped = mapCommission(rec)
        setCommissions((prev) => prev.map((c) => (c.id === tempId ? mapped : c)))
      })
      .catch((err) => {
        console.error('Erro ao criar comissão:', err)
        setCommissions((prev) => prev.filter((c) => c.id !== tempId))
      })
  }

  // ---------- Estoque Handlers ----------
  const addStockItem = (itemData: Omit<StockItem, 'id' | 'createdAt'>): StockItem => {
    const tempId = `temp-${Date.now()}`
    const initialMov: StockMovement = {
      id: `temp-mov-${Date.now()}`,
      stockItemId: tempId,
      date: todayStr(),
      type: 'Entrada',
      quantity: itemData.currentQuantity,
      responsible: currentUser?.name || 'Administrador',
      reason: 'Estoque inicial cadastrado',
      supplier: itemData.supplier,
      createdAt: nowIso(),
    }
    const newItem: StockItem = {
      ...itemData,
      id: tempId,
      createdAt: todayStr(),
      movements: [initialMov],
    }
    setStockRaw((prev) => [
      {
        id: tempId,
        name: itemData.name,
        brand: itemData.brand || '',
        model: itemData.model || '',
        color: itemData.color || '',
        category: itemData.category,
        batterySize: itemData.batterySize || '',
        accessorySubcategory: itemData.accessorySubcategory || '',
        minQuantity: itemData.minQuantity,
        currentQuantity: itemData.currentQuantity,
        supplier: itemData.supplier || '',
        costPrice: itemData.costPrice,
        salePrice: itemData.salePrice,
        notes: itemData.notes || '',
        created: nowIso(),
        estoque_minimo: itemData.estoqueMinimo ?? 0,
        data_validade: itemData.dataValidade || '',
        lote: itemData.lote || '',
        fabricante: itemData.fabricante || '',
        code: itemData.code || '',
        sku: itemData.sku || '',
        dias_alerta_validade: itemData.diasAlertaValidade ?? 30,
        categoria: itemData.categoria || '',
        unidade_medida: itemData.unidadeMedida || '',
      },
      ...prev,
    ])
    toast({
      title: 'Item cadastrado no estoque',
      description: `${newItem.name} adicionado com sucesso.`,
    })

    pb.collection('inventory')
      .create({
        name: itemData.name,
        brand: itemData.brand || '',
        model: itemData.model || '',
        color: itemData.color || '',
        category: itemData.category,
        batterySize: itemData.batterySize || '',
        accessorySubcategory: itemData.accessorySubcategory || '',
        minQuantity: itemData.minQuantity,
        currentQuantity: itemData.currentQuantity,
        supplier: itemData.supplier || '',
        costPrice: itemData.costPrice,
        salePrice: itemData.salePrice,
        notes: itemData.notes || '',
        estoque_minimo: itemData.estoqueMinimo ?? 0,
        data_validade: itemData.dataValidade || null,
        lote: itemData.lote || '',
        fabricante: itemData.fabricante || '',
        code: itemData.code || '',
        sku: itemData.sku || '',
        dias_alerta_validade: itemData.diasAlertaValidade ?? 30,
        categoria: itemData.categoria || '',
        unidade_medida: itemData.unidadeMedida || '',
      })
      .then(async (rec: any) => {
        const realId = rec.id
        setStockRaw((prev) => prev.map((it) => (it.id === tempId ? rec : it)))
        // registrar movimento inicial
        try {
          const m: any = await pb.collection('inventory_movements').create({
            itemId: realId,
            item_name: itemData.name,
            date: todayStr(),
            type: 'Entrada',
            quantity: itemData.currentQuantity,
            responsible: currentUser?.name || 'Administrador',
            reason: 'Estoque inicial cadastrado',
            supplier: itemData.supplier || '',
          })
          setStockMovements((prev) => [
            mapStockMovement(m),
            ...prev.filter((mv) => mv.id !== initialMov.id),
          ])
        } catch (err) {
          console.error('Erro ao registrar movimento inicial:', err)
        }
      })
      .catch((err) => {
        console.error('Erro ao criar item de estoque:', err)
        setStockRaw((prev) => prev.filter((it) => it.id !== tempId))
      })
    return newItem
  }

  const updateStockItem = (id: string, itemData: Partial<StockItem>) => {
    setStockRaw((prev) => prev.map((it) => (it.id === id ? { ...it, ...itemData } : it)))
    const patch: any = { ...itemData }
    delete patch.id
    delete patch.createdAt
    delete patch.movements
    // Mapeia campos camelCase do StockItem para os nomes snake_case do banco.
    if (itemData.estoqueMinimo !== undefined) {
      patch.estoque_minimo = itemData.estoqueMinimo
      delete patch.estoqueMinimo
    }
    if (itemData.dataValidade !== undefined) {
      patch.data_validade = itemData.dataValidade || null
      delete patch.dataValidade
    }
    if (itemData.lote !== undefined) {
      patch.lote = itemData.lote
      delete patch.lote
    }
    if (itemData.fabricante !== undefined) {
      patch.fabricante = itemData.fabricante
      delete patch.fabricante
    }
    if (itemData.diasAlertaValidade !== undefined) {
      patch.dias_alerta_validade = itemData.diasAlertaValidade
      delete patch.diasAlertaValidade
    }
    if (itemData.categoria !== undefined) {
      patch.categoria = itemData.categoria
      delete patch.categoria
    }
    if (itemData.unidadeMedida !== undefined) {
      patch.unidade_medida = itemData.unidadeMedida
      delete patch.unidadeMedida
    }
    pb.collection('inventory')
      .update(id, patch)
      .catch((err) => console.error('Erro ao atualizar item de estoque:', err))
    toast({
      title: 'Item atualizado',
      description: 'Dados do item de estoque foram salvos.',
    })
  }

  const deleteStockItem = (id: string) => {
    setStockRaw((prev) => prev.filter((it) => it.id !== id))
    pb.collection('inventory')
      .delete(id)
      .catch((err) => console.error('Erro ao excluir item de estoque:', err))
    toast({
      title: 'Item excluído',
      description: 'Item removido do controle de estoque.',
      variant: 'destructive',
    })
  }

  const addStockEntry = (
    itemId: string,
    quantity: number,
    supplier?: string,
    responsible?: string,
    date?: string,
  ) => {
    const movDate = date || todayStr()
    const target = stockRaw.find((it) => it.id === itemId)
    if (target) {
      setStockRaw((prev) =>
        prev.map((it) =>
          it.id === itemId ? { ...it, currentQuantity: Number(it.currentQuantity) + quantity } : it,
        ),
      )
    }
    const tempId = `temp-mov-${Date.now()}`
    const newMov: StockMovement = {
      id: tempId,
      stockItemId: itemId,
      date: movDate,
      type: 'Entrada',
      quantity,
      responsible: responsible || currentUser?.name || 'Almoxarifado',
      supplier: supplier || target?.supplier,
      createdAt: nowIso(),
    }
    setStockMovements((prev) => [newMov, ...prev])
    toast({
      title: 'Entrada de estoque realizada',
      description: `+${quantity} unidades adicionadas ao saldo.`,
    })

    // Persiste o novo currentQuantity no registro do item no PocketBase,
    // além de criar a movimentação de histórico.
    const newQty = target ? Number(target.currentQuantity) + quantity : quantity
    pb.collection('inventory_movements')
      .create({
        itemId,
        item_name: target?.name || '',
        date: movDate,
        type: 'Entrada',
        quantity,
        responsible: responsible || currentUser?.name || 'Almoxarifado',
        reason: '',
        supplier: supplier || target?.supplier || '',
      })
      .then((rec: any) => {
        const mapped = mapStockMovement(rec)
        setStockMovements((prev) => prev.map((m) => (m.id === tempId ? mapped : m)))
        pb.collection('inventory')
          .update(itemId, { currentQuantity: newQty })
          .catch((err) => console.error('Erro ao persistir currentQuantity (entrada manual):', err))
      })
      .catch((err) => {
        console.error('Erro ao registrar entrada:', err)
        setStockMovements((prev) => prev.filter((m) => m.id !== tempId))
      })
  }

  const addStockExit = (
    itemId: string,
    quantity: number,
    reason: string,
    responsible?: string,
    patientName?: string,
    date?: string,
  ): boolean => {
    const target = stockRaw.find((it) => it.id === itemId)
    if (!target) return false
    if (Number(target.currentQuantity) < quantity) {
      toast({
        title: 'Saldo insuficiente',
        description: `O estoque possui apenas ${target.currentQuantity} unidades disponíveis.`,
        variant: 'destructive',
      })
      return false
    }

    const movDate = date || todayStr()
    const newQty = Number(target.currentQuantity) - quantity
    setStockRaw((prev) =>
      prev.map((it) =>
        it.id === itemId ? { ...it, currentQuantity: Number(it.currentQuantity) - quantity } : it,
      ),
    )
    // Regra 1: ao registrar uma venda (PDV/B2B/teste), verifica se o estoque
    // ficou abaixo do mínimo e gera alerta imediato (toast).
    // Regra 3: produtos com categoria 'servico' não têm controle de estoque.
    const isServico = (target as any).categoria === 'servico'
    if (!isServico) {
      const min = Number((target as any).estoque_minimo) || Number(target.minQuantity) || 0
      if (newQty <= 0) {
        toast({
          title: '⚠ Estoque zerado',
          description: `${target.name} ficou com saldo zero após esta saída.`,
          variant: 'destructive',
        })
      } else if (min > 0 && newQty < min) {
        toast({
          title: '⚠ Estoque abaixo do mínimo',
          description: `${target.name} ficou com ${newQty} un (mínimo: ${min} un).`,
        })
      }
    }
    const tempId = `temp-mov-${Date.now()}`
    const newMov: StockMovement = {
      id: tempId,
      stockItemId: itemId,
      date: movDate,
      type: 'Saída',
      quantity,
      reason,
      patientName,
      responsible: responsible || currentUser?.name || 'Atendimento',
      createdAt: nowIso(),
    }
    setStockMovements((prev) => [newMov, ...prev])
    toast({
      title: 'Saída de estoque registrada',
      description: `-${quantity} unidades baixadas do estoque.`,
    })

    // Regra 1: alerta imediato quando o estoque fica abaixo do mínimo após
    // uma venda/baixa (PDV, B2B, teste convertido). Produtos 'servico' não
    // têm controle de estoque mínimo.
    if (target.categoria !== 'servico') {
      const novoSaldo = Number(target.currentQuantity) - quantity
      const min = Number(target.estoque_minimo) || Number(target.minQuantity) || 0
      if (novoSaldo <= 0) {
        toast({
          title: 'Estoque zerado',
          description: `${target.name} ficou sem saldo após esta baixa.`,
          variant: 'destructive',
        })
      } else if (min > 0 && novoSaldo < min) {
        toast({
          title: 'Estoque abaixo do mínimo',
          description: `${target.name} está com ${novoSaldo} un (mínimo: ${min} un).`,
          variant: 'default',
        })
      }
    }

    // Persiste o novo currentQuantity no registro do item no PocketBase,
    // além de criar a movimentação de histórico.
    pb.collection('inventory_movements')
      .create({
        itemId,
        item_name: target.name,
        date: movDate,
        type: 'Saída',
        quantity,
        reason,
        supplier: '',
        patientName: patientName || '',
        responsible: responsible || currentUser?.name || 'Atendimento',
      })
      .then((rec: any) => {
        const mapped = mapStockMovement(rec)
        setStockMovements((prev) => prev.map((m) => (m.id === tempId ? mapped : m)))
        pb.collection('inventory')
          .update(itemId, { currentQuantity: newQty })
          .catch((err) => console.error('Erro ao persistir currentQuantity (saída manual):', err))
      })
      .catch((err) => {
        console.error('Erro ao registrar saída:', err)
        setStockMovements((prev) => prev.filter((m) => m.id !== tempId))
      })
    return true
  }

  // ---------- Derivar aparelhos com manutenções/ajustes ----------
  const hearingAids: HearingAid[] = useMemo(() => {
    return aidsRaw.map((r) => {
      const maints = maintenances.filter((m) => m.hearingAidId === r.id)
      const adjs = adjustments.filter((a) => a.hearingAidId === r.id)
      return mapHearingAid(r, maints, adjs)
    })
  }, [aidsRaw, maintenances, adjustments])

  // ---------- Derivar itens de estoque com movimentos ----------
  const stockItems: StockItem[] = useMemo(() => {
    return stockRaw.map((r) => {
      const movs = stockMovements
        .filter((m) => m.stockItemId === r.id)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      return mapStockItem(r, movs)
    })
  }, [stockRaw, stockMovements])

  // ---------- Alertas Inteligentes ----------
  const alerts = useMemo<SystemAlert[]>(() => {
    const list: SystemAlert[] = []
    const today = new Date()

    hearingAids.forEach((aid) => {
      if (aid.warrantyEndDate && aid.status === 'Em uso') {
        const end = new Date(aid.warrantyEndDate)
        const diffDays = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        if (diffDays >= 0 && diffDays <= 30) {
          list.push({
            id: `alert-war-${aid.id}`,
            type: 'warranty',
            severity: diffDays <= 10 ? 'danger' : 'warning',
            title: `Garantia de ${aid.brand} ${aid.model} vencendo`,
            description: `${aid.patientName || 'Paciente'} — garantia expira em ${diffDays} dia(s) (${aid.warrantyEndDate}).`,
            linkUrl: `/aparelhos`,
            targetId: aid.id,
            date: aid.warrantyEndDate,
          })
        }
      }
    })

    patients
      .filter((p) => p.status === 'Em tratamento')
      .slice(0, 3)
      .forEach((pat) => {
        list.push({
          id: `alert-fol-${pat.id}`,
          type: 'followup',
          severity: 'info',
          title: `Follow-up de adaptação pendente`,
          description: `Paciente ${pat.name} está em período de adaptação (30 dias). Agendar retorno de avaliação.`,
          linkUrl: `/pacientes/${pat.id}/prontuario`,
          targetId: pat.id,
        })
      })

    const todayISO = today.toISOString().split('T')[0]
    installments.forEach((inst) => {
      if (inst.status === 'Atrasado' || (inst.status === 'Pendente' && inst.dueDate < todayISO)) {
        list.push({
          id: `alert-inst-${inst.id}`,
          type: 'installment',
          severity: 'danger',
          title: `Parcela em atraso: ${inst.patientName}`,
          description: `Parcela ${inst.installmentNumber}/${inst.totalInstallments} de R$ ${inst.value.toFixed(2)} venceu em ${inst.dueDate}.`,
          linkUrl: `/financeiro`,
          targetId: inst.id,
          date: inst.dueDate,
        })
      }
    })

    // ---- Alertas de estoque (mínimo e validade) ----
    // Regra 3: produtos com categoria 'servico' não têm controle de estoque
    // mínimo nem validade.
    const hoje0h = new Date()
    hoje0h.setHours(0, 0, 0, 0)
    stockItems.forEach((stk) => {
      const isServico = stk.categoria === 'servico'
      const min = stk.estoqueMinimo ?? stk.minQuantity ?? 0
      if (!isServico && stk.currentQuantity <= 0) {
        // Estoque zerado (badge vermelho)
        list.push({
          id: `alert-stk-zero-${stk.id}`,
          type: 'stock',
          subtype: 'zerado',
          severity: 'danger',
          title: `Estoque zerado: ${stk.name}`,
          description: `Saldo atual de ${stk.name} é zero. Reposição necessária.`,
          linkUrl: `/estoque?f=zerado`,
          targetId: stk.id,
        })
      } else if (!isServico && min > 0 && stk.currentQuantity < min) {
        // Estoque baixo (badge amarelo)
        list.push({
          id: `alert-stk-baixo-${stk.id}`,
          type: 'stock',
          subtype: 'baixo',
          severity: 'warning',
          title: `Estoque baixo: ${stk.name}`,
          description: `Saldo atual (${stk.currentQuantity} un) abaixo do mínimo (${min} un).`,
          linkUrl: `/estoque?f=baixo`,
          targetId: stk.id,
        })
      }

      // Alertas de validade (apenas produtos perecíveis com data_validade)
      if (!isServico && stk.dataValidade) {
        const validade = new Date(stk.dataValidade + 'T00:00:00')
        if (!isNaN(validade.getTime())) {
          const diffDias = Math.ceil(
            (validade.getTime() - hoje0h.getTime()) / (1000 * 60 * 60 * 24),
          )
          const diasAlerta = stk.diasAlertaValidade ?? 30
          if (diffDias < 0) {
            // Vencido (badge vermelho)
            list.push({
              id: `alert-stk-vencido-${stk.id}`,
              type: 'stock',
              subtype: 'vencido',
              severity: 'danger',
              title: `Produto vencido: ${stk.name}`,
              description: `${stk.name} venceu em ${formatDateBR(stk.dataValidade)} (lote ${stk.lote || '—'}).`,
              linkUrl: `/estoque?f=vencido`,
              targetId: stk.id,
              date: stk.dataValidade,
            })
          } else if (diffDias <= diasAlerta) {
            // Vencendo (badge amarelo)
            list.push({
              id: `alert-stk-vencendo-${stk.id}`,
              type: 'stock',
              subtype: 'vencendo',
              severity: 'warning',
              title: `Validade próxima: ${stk.name}`,
              description: `${stk.name} vence em ${diffDias} dia(s) (${formatDateBR(stk.dataValidade)}, lote ${stk.lote || '—'}).`,
              linkUrl: `/estoque?f=vencendo`,
              targetId: stk.id,
              date: stk.dataValidade,
            })
          }
        }
      }
    })

    // ---- Alertas de calibração de equipamentos ----
    // Aparecem para TODOS os perfis. Vencida (danger) ou vencendo nos
    // próximos 30 dias (warning).
    equipments.forEach((eq) => {
      const status = getEquipmentStatus(eq.proxima_calibracao, today)
      if (status === 'expired') {
        list.push({
          id: `alert-cal-${eq.id}`,
          type: 'calibration',
          severity: 'danger',
          title: `Calibração vencida: ${eq.nome}`,
          description: `Calibração do equipamento ${eq.nome} vencida em ${formatDateBR(eq.proxima_calibracao)}.`,
          linkUrl: `/configuracoes`,
          targetId: eq.id,
          date: eq.proxima_calibracao,
        })
      } else if (status === 'expiring') {
        const diffDays = Math.ceil(
          (new Date(eq.proxima_calibracao + 'T00:00:00').getTime() - today.getTime()) /
            (1000 * 60 * 60 * 24),
        )
        list.push({
          id: `alert-cal-${eq.id}`,
          type: 'calibration',
          severity: 'warning',
          title: `Calibração vencendo: ${eq.nome}`,
          description: `Calibração do equipamento ${eq.nome} vence em ${diffDays} dia(s) (${formatDateBR(eq.proxima_calibracao)}).`,
          linkUrl: `/configuracoes`,
          targetId: eq.id,
          date: eq.proxima_calibracao,
        })
      }
    })

    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hearingAids, patients, installments, stockItems, equipments])

  const unreadAlertsCount = alerts.length

  const resetToSeedData = () => {
    reloadAll()
    toast({
      title: 'Dados recarregados',
      description: 'Todos os registros foram recarregados a partir do banco de dados.',
    })
  }

  // ---------- Fechamento de Caixa Handlers ----------
  const fetchFechamentosCaixa = useCallback(async () => {
    try {
      const list = await pb
        .collection('fechamentos_caixa')
        .getFullList({ sort: '-data', expand: 'usuario' })
      setFechamentosCaixa(list.map(mapFechamentoCaixa))
    } catch (err) {
      console.error('Erro ao carregar fechamentos de caixa:', err)
    }
  }, [])

  const fetchMovimentacoesCaixa = useCallback(async (fechamentoId?: string) => {
    try {
      let list: any[] = []
      if (fechamentoId) {
        list = await pb.collection('movimentacoes_caixa').getFullList({
          filter: `fechamento = "${fechamentoId}"`,
          sort: 'created',
          expand: 'usuario',
        })
      } else {
        list = await pb
          .collection('movimentacoes_caixa')
          .getFullList({ sort: '-created', expand: 'usuario' })
      }
      setMovimentacoesCaixa(list.map(mapMovimentacaoCaixa))
    } catch (err) {
      console.error('Erro ao carregar movimentações de caixa:', err)
    }
  }, [])

  const addFechamentoCaixa = async (
    data: Omit<FechamentoCaixa, 'id' | 'created' | 'updated'>,
  ): Promise<FechamentoCaixa | null> => {
    try {
      const payload: Record<string, any> = {
        data: data.data,
        saldo_inicial: data.saldoInicial ?? 0,
        saldo_final: data.saldoFinal ?? 0,
        total_dinheiro: data.totalDinheiro ?? 0,
        total_debito: data.totalDebito ?? 0,
        total_credito: data.totalCredito ?? 0,
        total_pix: data.totalPix ?? 0,
        total_convenio: data.totalConvenio ?? 0,
        total_boleto: data.totalBoleto ?? 0,
        total_entradas: data.totalEntradas ?? 0,
        total_saidas: data.totalSaidas ?? 0,
        total_vendas: data.totalVendas ?? 0,
        quantidade_vendas: data.quantidadeVendas ?? 0,
        diferenca: data.diferenca ?? 0,
        status: data.status || 'aberto',
        observacao: data.observacao || '',
        usuario: data.usuarioId || currentUser?.id || '',
      }
      const rec: any = await pb.collection('fechamentos_caixa').create(payload, {
        expand: 'usuario',
      })
      const mapped = mapFechamentoCaixa(rec)
      setFechamentosCaixa((prev) => [mapped, ...prev])
      return mapped
    } catch (err) {
      console.error('Erro ao criar fechamento de caixa:', err)
      toast({
        title: 'Erro ao abrir caixa',
        description: describePbError(err),
        variant: 'destructive',
      })
      return null
    }
  }

  const updateFechamentoCaixa = async (
    id: string,
    data: Partial<FechamentoCaixa>,
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      const patch: Record<string, any> = {}
      if (data.saldoInicial !== undefined) patch.saldo_inicial = data.saldoInicial
      if (data.saldoFinal !== undefined) patch.saldo_final = data.saldoFinal
      if (data.totalDinheiro !== undefined) patch.total_dinheiro = data.totalDinheiro
      if (data.totalDebito !== undefined) patch.total_debito = data.totalDebito
      if (data.totalCredito !== undefined) patch.total_credito = data.totalCredito
      if (data.totalPix !== undefined) patch.total_pix = data.totalPix
      if (data.totalConvenio !== undefined) patch.total_convenio = data.totalConvenio
      if (data.totalBoleto !== undefined) patch.total_boleto = data.totalBoleto
      if (data.totalEntradas !== undefined) patch.total_entradas = data.totalEntradas
      if (data.totalSaidas !== undefined) patch.total_saidas = data.totalSaidas
      if (data.totalVendas !== undefined) patch.total_vendas = data.totalVendas
      if (data.quantidadeVendas !== undefined) patch.quantidade_vendas = data.quantidadeVendas
      if (data.diferenca !== undefined) patch.diferenca = data.diferenca
      if (data.status !== undefined) patch.status = data.status
      if (data.observacao !== undefined) patch.observacao = data.observacao
      if (data.usuarioId !== undefined) patch.usuario = data.usuarioId
      const rec: any = await pb.collection('fechamentos_caixa').update(id, patch, {
        expand: 'usuario',
      })
      const mapped = mapFechamentoCaixa(rec)
      setFechamentosCaixa((prev) => prev.map((f) => (f.id === id ? mapped : f)))
      return { success: true }
    } catch (err) {
      console.error('Erro ao atualizar fechamento de caixa:', err)
      return {
        success: false,
        message: describePbError(err),
      }
    }
  }

  const addMovimentacaoCaixa = async (
    data: Omit<MovimentacaoCaixa, 'id' | 'created' | 'usuarioId' | 'usuarioNome'>,
  ): Promise<MovimentacaoCaixa | null> => {
    try {
      const payload: Record<string, any> = {
        fechamento: data.fechamentoId || '',
        tipo: data.tipo,
        valor: data.valor ?? 0,
        descricao: data.descricao || '',
        forma_pagamento: data.formaPagamento || 'dinheiro',
        data: data.data,
        sale: data.saleId || '',
        usuario: currentUser?.id || '',
      }
      const rec: any = await pb.collection('movimentacoes_caixa').create(payload, {
        expand: 'usuario',
      })
      const mapped = mapMovimentacaoCaixa(rec)
      setMovimentacoesCaixa((prev) => [...prev, mapped])
      return mapped
    } catch (err) {
      console.error('Erro ao criar movimentação de caixa:', err)
      toast({
        title: 'Erro ao registrar movimentação',
        description: describePbError(err),
        variant: 'destructive',
      })
      return null
    }
  }

  // ---------- Vendas B2B Handlers ----------
  const fetchVendasB2B = useCallback(async () => {
    try {
      const list = await pb.collection('vendas_b2b').getFullList({
        sort: '-data_venda',
        expand:
          'cliente_empresa_id,especialista_id,itens_venda_b2b_venda_b2b_id,nf_servico_comissao_venda_b2b_id',
      })
      setVendasB2B(list.map(mapVendaB2B))
    } catch (err) {
      console.error('Erro ao carregar vendas B2B:', err)
    }
  }, [])

  const fetchEmpresasParceiras = useCallback(async () => {
    try {
      const list = await pb.collection('empresas_parceiras').getFullList({ sort: 'razao_social' })
      setEmpresasParceiras(list.map(mapEmpresaParceira))
    } catch (err) {
      console.error('Erro ao carregar empresas parceiras:', err)
    }
  }, [])

  const fetchNFServicoComissao = useCallback(async (vendaId?: string) => {
    try {
      let list: any[] = []
      if (vendaId) {
        list = await pb
          .collection('nf_servico_comissao')
          .getFullList({ filter: `venda_b2b_id = "${vendaId}"`, sort: '-created' })
      } else {
        list = await pb.collection('nf_servico_comissao').getFullList({ sort: '-created' })
      }
      setNfServicoComissao(list.map(mapNFServicoComissao))
    } catch (err) {
      console.error('Erro ao carregar NFs de serviço:', err)
    }
  }, [])

  const fetchItensVendaB2B = useCallback(async (vendaId: string): Promise<ItemVendaB2B[]> => {
    try {
      const list = await pb
        .collection('itens_venda_b2b')
        .getFullList({ filter: `venda_b2b_id = "${vendaId}"`, sort: 'created' })
      return list.map(mapItemVendaB2B)
    } catch (err) {
      console.error('Erro ao carregar itens da venda B2B:', err)
      return []
    }
  }, [])

  const addEmpresaParceira = async (
    data: Omit<EmpresaParceira, 'id' | 'created' | 'updated'>,
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      if (!data.razao_social?.trim()) {
        return { success: false, message: 'Informe a razão social.' }
      }
      const rec: any = await pb.collection('empresas_parceiras').create({
        razao_social: data.razao_social.trim(),
        nome_fantasia: data.nome_fantasia || '',
        cnpj: data.cnpj || '',
        inscricao_estadual: data.inscricao_estadual || '',
        email: data.email || '',
        telefone: data.telefone || '',
        endereco: data.endereco || '',
        cidade: data.cidade || '',
        estado: data.estado || '',
        cep: data.cep || '',
        status: data.status || 'ativo',
      })
      setEmpresasParceiras((prev) =>
        [...prev, mapEmpresaParceira(rec)].sort((a, b) =>
          a.razao_social.localeCompare(b.razao_social),
        ),
      )
      toast({ title: 'Empresa parceira cadastrada', description: data.razao_social.trim() })
      return { success: true }
    } catch (err) {
      console.error('Erro ao criar empresa parceira:', err)
      return { success: false, message: describePbError(err) }
    }
  }

  const updateEmpresaParceira = async (
    id: string,
    data: Partial<EmpresaParceira>,
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      const patch: Record<string, any> = {}
      if (data.razao_social !== undefined) patch.razao_social = data.razao_social.trim()
      if (data.nome_fantasia !== undefined) patch.nome_fantasia = data.nome_fantasia || ''
      if (data.cnpj !== undefined) patch.cnpj = data.cnpj || ''
      if (data.inscricao_estadual !== undefined)
        patch.inscricao_estadual = data.inscricao_estadual || ''
      if (data.email !== undefined) patch.email = data.email || ''
      if (data.telefone !== undefined) patch.telefone = data.telefone || ''
      if (data.endereco !== undefined) patch.endereco = data.endereco || ''
      if (data.cidade !== undefined) patch.cidade = data.cidade || ''
      if (data.estado !== undefined) patch.estado = data.estado || ''
      if (data.cep !== undefined) patch.cep = data.cep || ''
      if (data.status !== undefined) patch.status = data.status
      const rec: any = await pb.collection('empresas_parceiras').update(id, patch)
      setEmpresasParceiras((prev) =>
        prev
          .map((e) => (e.id === id ? mapEmpresaParceira(rec) : e))
          .sort((a, b) => a.razao_social.localeCompare(b.razao_social)),
      )
      toast({ title: 'Empresa parceira atualizada' })
      return { success: true }
    } catch (err) {
      console.error('Erro ao atualizar empresa parceira:', err)
      return { success: false, message: describePbError(err) }
    }
  }

  const addVendaB2B = async (
    data: Omit<VendaB2B, 'id' | 'created' | 'updated' | 'numero_venda' | 'itens' | 'nf'> & {
      itens: Array<Omit<ItemVendaB2B, 'id' | 'created' | 'venda_b2b_id'>>
    },
  ): Promise<VendaB2B | null> => {
    try {
      if (!data.cliente_empresa_id) {
        toast({ title: 'Selecione a empresa parceira', variant: 'destructive' })
        return null
      }
      if (!data.itens || data.itens.length === 0) {
        toast({ title: 'Adicione ao menos um item', variant: 'destructive' })
        return null
      }

      const empresa = empresasParceiras.find((e) => e.id === data.cliente_empresa_id)
      const ano = new Date().getFullYear()
      // Conta vendas do ano para gerar número sequencial (B2B-ANO-0001)
      let seq = 1
      try {
        const existing = await pb.collection('vendas_b2b').getFullList({
          filter: `numero_venda ~ "B2B-${ano}-"`,
        })
        seq = existing.length + 1
      } catch (_) {
        seq = vendasB2B.filter((v) => v.numero_venda.includes(`B2B-${ano}-`)).length + 1
      }
      const numero_venda = `B2B-${ano}-${String(seq).padStart(4, '0')}`

      const valor_total = data.itens.reduce((acc, it) => acc + (it.valor_subtotal || 0), 0)
      const percentual_comissao = Number(data.percentual_comissao) || 30
      const valor_comissao = (valor_total * percentual_comissao) / 100
      const valor_repasse = valor_total - valor_comissao

      const rec: any = await pb.collection('vendas_b2b').create({
        numero_venda,
        cliente_empresa_id: data.cliente_empresa_id,
        cliente_empresa_nome: empresa?.razao_social || data.cliente_empresa_nome || '',
        data_venda: data.data_venda || todayStr(),
        valor_total,
        percentual_comissao,
        valor_comissao,
        valor_repasse,
        status: data.status || 'pendente',
        especialista_id: data.especialista_id || currentUser?.id || '',
        especialista_nome: data.especialista_nome || currentUser?.name || '',
        observacoes: data.observacoes || '',
      })

      // Cria itens
      const itensCriados: ItemVendaB2B[] = []
      for (const it of data.itens) {
        try {
          const r: any = await pb.collection('itens_venda_b2b').create({
            venda_b2b_id: rec.id,
            produto_id: it.produto_id || '',
            produto_nome: it.produto_nome || '',
            quantidade: it.quantidade,
            valor_unitario: it.valor_unitario,
            valor_subtotal: it.valor_subtotal,
          })
          itensCriados.push(mapItemVendaB2B(r))
        } catch (err) {
          console.error('Erro ao criar item da venda B2B:', err)
        }
      }

      // Recarrega vendas B2B para incluir a nova com expand
      await fetchVendasB2B()

      // Integração com estoque: baixa produtos se status aprovada/concluida
      if (data.status === 'aprovada' || data.status === 'concluida') {
        for (const it of data.itens) {
          if (it.produto_id) {
            addStockExit(
              it.produto_id,
              it.quantidade,
              `Venda B2B ${numero_venda}`,
              currentUser?.name || 'Sistema',
              empresa?.razao_social || '',
              data.data_venda || todayStr(),
            )
          }
        }
      }

      toast({
        title: 'Venda B2B registrada',
        description: `${numero_venda} criada com sucesso.`,
      })
      return mapVendaB2B(rec)
    } catch (err) {
      console.error('Erro ao criar venda B2B:', err)
      toast({
        title: 'Erro ao criar venda B2B',
        description: describePbError(err),
        variant: 'destructive',
      })
      return null
    }
  }

  const updateVendaB2B = async (
    id: string,
    data: Partial<VendaB2B>,
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      const current = vendasB2B.find((v) => v.id === id)
      const patch: Record<string, any> = {}
      if (data.status !== undefined) patch.status = data.status
      if (data.status_repasse !== undefined) patch.status_repasse = data.status_repasse
      if (data.data_recebimento_comissao !== undefined) {
        patch.data_recebimento_comissao = data.data_recebimento_comissao || null
      }
      if (data.observacoes !== undefined) patch.observacoes = data.observacoes
      if (data.percentual_comissao !== undefined) {
        const valor_total = current?.valor_total || 0
        const percentual_comissao = Number(data.percentual_comissao)
        patch.percentual_comissao = percentual_comissao
        patch.valor_comissao = (valor_total * percentual_comissao) / 100
        patch.valor_repasse = valor_total - patch.valor_comissao
      }
      if (data.valor_total !== undefined) {
        const valor_total = Number(data.valor_total)
        const percentual = Number(data.percentual_comissao ?? current?.percentual_comissao ?? 30)
        patch.valor_total = valor_total
        patch.valor_comissao = (valor_total * percentual) / 100
        patch.valor_repasse = valor_total - patch.valor_comissao
      }

      const rec: any = await pb.collection('vendas_b2b').update(id, patch, {
        expand:
          'cliente_empresa_id,especialista_id,itens_venda_b2b_venda_b2b_id,nf_servico_comissao_venda_b2b_id',
      })
      const mapped = mapVendaB2B(rec)
      setVendasB2B((prev) => prev.map((v) => (v.id === id ? mapped : v)))

      // Integração com estoque: baixa/devolve conforme mudança de status
      if (data.status && current) {
        const baixar = data.status === 'aprovada' || data.status === 'concluida'
        const devolver = data.status === 'cancelada'
        const jaBaixada =
          current.status === 'aprovada' ||
          current.status === 'concluida' ||
          current.status === 'nf_emitida'
        const itens = current.itens || []
        if (baixar && !jaBaixada) {
          for (const it of itens) {
            if (it.produto_id) {
              addStockExit(
                it.produto_id,
                it.quantidade,
                `Venda B2B ${current.numero_venda}`,
                currentUser?.name || 'Sistema',
                current.cliente_empresa_nome,
                current.data_venda,
              )
            }
          }
        } else if (devolver && jaBaixada) {
          for (const it of itens) {
            if (it.produto_id) {
              addStockEntry(
                it.produto_id,
                it.quantidade,
                `Cancelamento Venda B2B ${current.numero_venda}`,
                currentUser?.name || 'Sistema',
                undefined,
              )
            }
          }
        }
      }

      toast({ title: 'Venda B2B atualizada' })
      return { success: true }
    } catch (err) {
      console.error('Erro ao atualizar venda B2B:', err)
      return { success: false, message: describePbError(err) }
    }
  }

  const cancelVendaB2B = async (
    id: string,
    reason: string,
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      const current = vendasB2B.find((v) => v.id === id)
      if (!current) return { success: false, message: 'Venda não encontrada.' }

      // RN4: o cancelamento da NFS-e na prefeitura é obrigatório antes de
      // cancelar a venda B2B. Se existir uma NFS-e ainda ativa, bloqueia.
      const nfAtiva = nfServicoComissao.find(
        (n) => n.venda_b2b_id === id && (n.status === 'emitida' || n.status === 'rascunho'),
      )
      if (nfAtiva) {
        return {
          success: false,
          message: 'Cancele a NFS-e de Comissão vinculada antes de cancelar a venda B2B.',
        }
      }

      const obs = reason.trim()
        ? `${current.observacoes ? current.observacoes + '\n' : ''}Cancelada: ${reason.trim()}`
        : current.observacoes
      const result = await updateVendaB2B(id, { status: 'cancelada', observacoes: obs })
      if (result.success) {
        toast({
          title: 'Venda B2B cancelada',
          description: `${current.numero_venda} foi cancelada.`,
          variant: 'destructive',
        })
      }
      return result
    } catch (err) {
      console.error('Erro ao cancelar venda B2B:', err)
      return { success: false, message: describePbError(err) }
    }
  }

  const addNFServicoComissao = async (
    data: Omit<NFServicoComissao, 'id' | 'created' | 'updated'>,
  ): Promise<NFServicoComissao | null> => {
    try {
      const rec: any = await pb.collection('nf_servico_comissao').create({
        venda_b2b_id: data.venda_b2b_id || '',
        numero_nfse: data.numero_nfse || '',
        codigo_verificacao: data.codigo_verificacao || '',
        data_emissao: data.data_emissao || todayStr(),
        valor_base: data.valor_base ?? 0,
        aliquota_iss: data.aliquota_iss ?? 3,
        valor_iss: data.valor_iss ?? 0,
        valor_liquido: data.valor_liquido ?? 0,
        discriminacao_servico: data.discriminacao_servico || '',
        item_lista_servico: data.item_lista_servico || '10.01',
        tomador_cnpj: data.tomador_cnpj || '',
        tomador_razao_social: data.tomador_razao_social || '',
        tomador_endereco: data.tomador_endereco || '',
        tomador_municipio: data.tomador_municipio || '',
        tomador_uf: data.tomador_uf || '',
        tomador_cep: data.tomador_cep || '',
        tomador_email: data.tomador_email || '',
        pdf_url: data.pdf_url || '',
        status: data.status || 'emitida',
      })
      const mapped = mapNFServicoComissao(rec)
      setNfServicoComissao((prev) => [mapped, ...prev])
      // Ao emitir a NFS-e de Comissão, a venda passa a aguardar o repasse da
      // comissão por parte da empresa parceira.
      await updateVendaB2B(data.venda_b2b_id, {
        status: 'nf_emitida',
        status_repasse: 'pendente',
        data_recebimento_comissao: undefined,
      })
      await fetchVendasB2B()

      // ---- Integração Controle de Inadimplência ----
      // Ao emitir a NFS-e de Comissão, a empresa parceira passa a dever o
      // repasse (70%) à Audição360. Cria uma conta a receber para esse valor.
      const venda = vendasB2B.find((v) => v.id === data.venda_b2b_id)
      if (venda && venda.valor_repasse > 0) {
        const empresa = empresasParceiras.find((e) => e.id === venda.cliente_empresa_id)
        // Vencimento do repasse: 30 dias após a emissão da NF.
        const venc = new Date()
        venc.setDate(venc.getDate() + 30)
        criarContasReceberDeVenda(venda.id, 'b2b', {
          empresaId: venda.cliente_empresa_id,
          empresaNome: venda.cliente_empresa_nome,
          empresaTelefone: empresa?.telefone || '',
          descricao: `Repasse de comissão — Venda B2B ${venda.numero_venda}`,
          valor: venda.valor_repasse,
          forma: 'boleto',
          numeroParcelas: 1,
          dataVenda: venda.data_venda,
          primeiroVencimento: venc.toISOString().split('T')[0],
        }).catch((e) => console.error('Erro ao gerar conta a receber (B2B repasse):', e))
      }

      toast({ title: 'NFS-e de Comissão emitida', description: `NFS-e ${data.numero_nfse}` })
      return mapped
    } catch (err) {
      console.error('Erro ao criar NFS-e de serviço:', err)
      toast({
        title: 'Erro ao emitir NFS-e',
        description: describePbError(err),
        variant: 'destructive',
      })
      return null
    }
  }

  const updateNFServicoComissao = async (
    id: string,
    data: Partial<NFServicoComissao>,
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      const patch: Record<string, any> = {}
      if (data.numero_nfse !== undefined) patch.numero_nfse = data.numero_nfse
      if (data.codigo_verificacao !== undefined) patch.codigo_verificacao = data.codigo_verificacao
      if (data.data_emissao !== undefined) patch.data_emissao = data.data_emissao
      if (data.valor_base !== undefined) patch.valor_base = data.valor_base
      if (data.aliquota_iss !== undefined) patch.aliquota_iss = data.aliquota_iss
      if (data.valor_iss !== undefined) patch.valor_iss = data.valor_iss
      if (data.valor_liquido !== undefined) patch.valor_liquido = data.valor_liquido
      if (data.discriminacao_servico !== undefined)
        patch.discriminacao_servico = data.discriminacao_servico
      if (data.item_lista_servico !== undefined) patch.item_lista_servico = data.item_lista_servico
      if (data.tomador_cnpj !== undefined) patch.tomador_cnpj = data.tomador_cnpj
      if (data.tomador_razao_social !== undefined)
        patch.tomador_razao_social = data.tomador_razao_social
      if (data.tomador_endereco !== undefined) patch.tomador_endereco = data.tomador_endereco
      if (data.tomador_municipio !== undefined) patch.tomador_municipio = data.tomador_municipio
      if (data.tomador_uf !== undefined) patch.tomador_uf = data.tomador_uf
      if (data.tomador_cep !== undefined) patch.tomador_cep = data.tomador_cep
      if (data.tomador_email !== undefined) patch.tomador_email = data.tomador_email
      if (data.motivo_cancelamento !== undefined)
        patch.motivo_cancelamento = data.motivo_cancelamento
      if (data.pdf_url !== undefined) patch.pdf_url = data.pdf_url
      if (data.status !== undefined) patch.status = data.status
      const rec: any = await pb.collection('nf_servico_comissao').update(id, patch)
      const mapped = mapNFServicoComissao(rec)
      setNfServicoComissao((prev) => prev.map((n) => (n.id === id ? mapped : n)))
      await fetchVendasB2B()
      toast({ title: 'NFS-e de Comissão atualizada' })
      return { success: true }
    } catch (err) {
      console.error('Erro ao atualizar NFS-e de serviço:', err)
      return { success: false, message: describePbError(err) }
    }
  }

  // Cancelamento da NFS-e: exige motivo e marca o status como cancelada.
  // A venda vinculada volta para "aprovada" (o cancelamento da NFS-e na
  // prefeitura é pré-requisito para cancelar a venda B2B).
  const cancelNFServicoComissao = async (
    id: string,
    motivo: string,
    status: 'cancelada' | 'cancelada_prefeitura' = 'cancelada',
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      if (!motivo?.trim()) {
        return { success: false, message: 'Informe o motivo do cancelamento.' }
      }
      // Busca a NF atual para localizar a venda vinculada.
      const nfRec: any = await pb.collection('nf_servico_comissao').getOne(id)
      const result = await updateNFServicoComissao(id, {
        status,
        motivo_cancelamento: motivo.trim(),
      })
      if (!result.success) return result
      // Volta a venda para "aprovada" e limpa o repasse.
      if (nfRec?.venda_b2b_id) {
        await updateVendaB2B(nfRec.venda_b2b_id, {
          status: 'aprovada',
          status_repasse: 'pendente',
          data_recebimento_comissao: undefined,
        })
      }
      toast({ title: 'NFS-e de Comissão cancelada', variant: 'destructive' })
      return { success: true }
    } catch (err) {
      console.error('Erro ao cancelar NFS-e de serviço:', err)
      return { success: false, message: describePbError(err) }
    }
  }

  // ---------- Configuração da NFS-e B2B (singleton) ----------
  const fetchNfseB2BConfig = useCallback(async () => {
    try {
      const list = await pb.collection('nfse_b2b_config').getList(1, 1, { sort: '-created' })
      const rec = list.items?.[0]
      if (rec) {
        setNfseB2BConfig(mapNfseB2BConfig(rec))
      } else {
        // Cria o registro singleton com valores padrão (Caçador/SC).
        try {
          const created: any = await pb.collection('nfse_b2b_config').create(DEFAULT_NFSE_CONFIG)
          setNfseB2BConfig(mapNfseB2BConfig(created))
        } catch (e) {
          console.warn('Não foi possível criar registro de nfse_b2b_config:', e)
        }
      }
    } catch (err) {
      console.error('Erro ao carregar configuração da NFS-e B2B:', err)
    }
  }, [])

  const saveNfseB2BConfig = async (
    data: Partial<Omit<NfseB2BConfig, 'id' | 'created' | 'updated'>>,
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      let current = nfseB2BConfig
      if (!current) {
        try {
          const list = await pb.collection('nfse_b2b_config').getList(1, 1, { sort: '-created' })
          if (list.items.length > 0) {
            current = mapNfseB2BConfig(list.items[0])
          }
        } catch (_) {
          /* ignore */
        }
      }
      const payload: Record<string, any> = {
        municipio: data.municipio ?? '',
        uf: data.uf ?? '',
        codigo_municipio: data.codigo_municipio ?? '',
        provedor: data.provedor ?? 'BETHA',
        url_api: data.url_api ?? '',
        login_api: data.login_api ?? '',
        token_api: data.token_api ?? '',
        inscricao_municipal: data.inscricao_municipal ?? '',
        aliquota_iss_padrao: Number(data.aliquota_iss_padrao) || 0,
        item_lista_servico: data.item_lista_servico ?? '',
        discriminacao_padrao: data.discriminacao_padrao ?? '',
        ambiente: data.ambiente ?? 'homologacao',
        ativo: data.ativo !== false,
      }
      if (!current) {
        const created: any = await pb.collection('nfse_b2b_config').create(payload)
        setNfseB2BConfig(mapNfseB2BConfig(created))
      } else {
        const updated: any = await pb.collection('nfse_b2b_config').update(current.id, payload)
        setNfseB2BConfig(mapNfseB2BConfig(updated))
      }
      toast({ title: 'Configuração da NFS-e salva' })
      return { success: true }
    } catch (err) {
      console.error('Erro ao salvar configuração da NFS-e B2B:', err)
      return { success: false, message: describePbError(err) }
    }
  }

  // ---------- NFS-e emitidas (Vendas PDV) ----------
  const fetchNfseEmitidas = useCallback(async () => {
    try {
      const list = await pb.collection('nfse_emitidas').getFullList({ sort: '-created' })
      setNfseEmitidas(list.map(mapNfseEmitida))
    } catch (err) {
      console.error('Erro ao carregar NFS-e emitidas:', err)
    }
  }, [])

  /**
   * Emite uma NFS-e para uma venda PDV. Reutiliza a config `nfse_b2b_config`.
   * Persiste o registro em `nfse_emitidas` mesmo em caso de erro (status 'erro').
   */
  const emitirNfseVenda = useCallback(
    async (
      saleId: string,
      dados: {
        tomadorNome: string
        tomadorCpfCnpj: string
        discriminacao: string
        aliquotaIss?: number
        observacao?: string
      },
    ): Promise<NfseEmitida | null> => {
      try {
        // 1) Busca a venda
        const saleRec: any = await pb.collection('sales').getOne(saleId)
        const valorServico = Number(saleRec.totalValue) || 0
        const aliquota =
          dados.aliquotaIss != null
            ? Number(dados.aliquotaIss)
            : Number(nfseB2BConfig?.aliquota_iss_padrao) || 0
        const valorIss = (valorServico * aliquota) / 100
        const valorLiquido = valorServico - valorIss
        const discriminacao = dados.discriminacao || ''
        const tomadorNome = dados.tomadorNome || 'CONSUMIDOR FINAL'
        const tomadorCpfCnpj = (dados.tomadorCpfCnpj || '').replace(/\D/g, '')

        // 2) Configura a API (se houver)
        const config: NfseApiConfig | null = nfseB2BConfig
          ? {
              baseUrl: nfseB2BConfig.url_api || '',
              usuario: nfseB2BConfig.login_api || '',
              senha: nfseB2BConfig.token_api || '',
              ambiente: nfseB2BConfig.ambiente,
              provedor: nfseB2BConfig.provedor,
              codigoMunicipio: nfseB2BConfig.codigo_municipio,
            }
          : null

        let numeroNfse = ''
        let codigoVerificacao = ''
        let pdfUrl = ''
        let status: NfseEmitidaStatus = 'pendente'
        let erroMsg = ''

        // 3) Chama a API da prefeitura quando configurada
        if (config && config.baseUrl) {
          status = 'enviada'
          const nfDados: NfseDados = {
            prestador: {
              cnpj: '',
              inscricaoMunicipal: nfseB2BConfig?.inscricao_municipal || '',
              razaoSocial: clinicSettings?.nome,
              municipio: nfseB2BConfig?.municipio,
              uf: nfseB2BConfig?.uf,
            },
            tomador: {
              cnpj: tomadorCpfCnpj,
              razaoSocial: tomadorNome,
              endereco: '',
              municipio: nfseB2BConfig?.municipio || '',
              uf: nfseB2BConfig?.uf || '',
              cep: '',
              email: '',
            },
            servico: {
              valorBase: valorServico,
              aliquotaIss: aliquota,
              valorIss,
              valorLiquido,
              itemListaServico: nfseB2BConfig?.item_lista_servico || '10.01',
              discriminacao,
            },
            numeroVendaB2B: String(saleRec.number || saleId),
          }
          const resp = await emitirNfseApi(config, nfDados)
          if (resp.sucesso) {
            status = 'autorizada'
            numeroNfse = resp.numeroNfse || ''
            codigoVerificacao = resp.codigoVerificacao || ''
            pdfUrl = resp.pdfUrl || ''
          } else {
            status = 'erro'
            erroMsg = resp.erro || 'Erro desconhecido na emissão.'
          }
        } else {
          // Sem API configurada: registra como pendente para emissão manual/offline.
          status = 'pendente'
          erroMsg = 'API da prefeitura não configurada. NFS-e registrada como pendente.'
        }

        // 4) Persiste em nfse_emitidas (sempre, mesmo em erro)
        const payload: Record<string, any> = {
          sale: saleId,
          tipo_venda: 'PDV',
          numero_nfse: numeroNfse,
          codigo_verificacao: codigoVerificacao,
          status,
          valor_servico: valorServico,
          aliquota_iss: aliquota,
          valor_iss: valorIss,
          valor_liquido: valorLiquido,
          discriminacao,
          tomador_nome: tomadorNome,
          tomador_cpf_cnpj: tomadorCpfCnpj,
          pdf_url: pdfUrl,
          erro_mensagem: erroMsg,
          data_emissao: todayStr(),
          observacao: dados.observacao || '',
        }
        const rec: any = await pb.collection('nfse_emitidas').create(payload)
        const mapped = mapNfseEmitida(rec)
        setNfseEmitidas((prev) => [mapped, ...prev])

        if (status === 'autorizada') {
          toast({
            title: 'NFS-e emitida com sucesso',
            description: `NFS-e ${numeroNfse} — Código de verificação: ${codigoVerificacao}`,
          })
        } else if (status === 'erro') {
          toast({
            title: 'Erro ao emitir NFS-e na prefeitura',
            description: erroMsg,
            variant: 'destructive',
          })
        } else {
          toast({
            title: 'NFS-e registrada como pendente',
            description: erroMsg,
          })
        }
        return mapped
      } catch (err) {
        console.error('Erro ao emitir NFS-e da venda:', err)
        toast({
          title: 'Erro ao emitir NFS-e',
          description: describePbError(err),
          variant: 'destructive',
        })
        return null
      }
    },
    [nfseB2BConfig, clinicSettings],
  )

  // ---------- LGPD: Consentimentos ----------
  const fetchConsentimentos = useCallback(async (pacienteId: string): Promise<Consentimento[]> => {
    if (!pacienteId) return []
    try {
      const recs = await pb.collection('consentimentos').getFullList({
        filter: `paciente_id = "${pacienteId}"`,
        sort: '-data_aceitacao',
      })
      return recs.map((r: any) => ({
        id: r.id,
        paciente_id: r.paciente_id || '',
        tipo_consentimento: (r.tipo_consentimento || 'dados_cadastrais') as TipoConsentimento,
        versao_termo: r.versao_termo || '',
        data_aceitacao: r.data_aceitacao || '',
        ip_aceitacao: r.ip_aceitacao || '',
        usuario_id: r.usuario_id || '',
        usuario_nome: r.usuario_nome || '',
        status: (r.status || 'aceito') as Consentimento['status'],
        data_revogacao: r.data_revogacao || null,
        observacoes: r.observacoes || '',
      }))
    } catch (err) {
      console.error('Erro ao buscar consentimentos:', err)
      return []
    }
  }, [])

  const registrarConsentimento = useCallback(
    async (
      pacienteId: string,
      tipo: TipoConsentimento,
      textoTermo: string,
      observacoes?: string,
    ): Promise<{ success: boolean; message?: string }> => {
      try {
        // versão do termo: hash simples da data atual + tamanho do texto
        const versao = `v1-${new Date().toISOString().slice(0, 10)}`
        const payload: Record<string, any> = {
          paciente_id: pacienteId,
          tipo_consentimento: tipo,
          versao_termo: versao,
          data_aceitacao: new Date().toISOString(),
          ip_aceitacao: '',
          usuario_id: currentUser?.id || '',
          usuario_nome: currentUser?.name || '',
          status: 'aceito',
          observacoes: observacoes || textoTermo || '',
        }
        await pb.collection('consentimentos').create(payload)
        toast({
          title: 'Consentimento registrado',
          description: 'O consentimento foi salvo com sucesso.',
        })
        return { success: true }
      } catch (err) {
        console.error('Erro ao registrar consentimento:', err)
        const msg = describePbError(err)
        toast({
          title: 'Erro ao registrar consentimento',
          description: msg,
          variant: 'destructive',
        })
        return { success: false, message: msg }
      }
    },
    [currentUser?.id, currentUser?.name],
  )

  const revogarConsentimento = useCallback(
    async (
      consentimentoId: string,
      motivo: string,
    ): Promise<{ success: boolean; message?: string }> => {
      try {
        await pb.collection('consentimentos').update(consentimentoId, {
          status: 'revogado',
          data_revogacao: new Date().toISOString(),
          observacoes: motivo,
        })
        toast({
          title: 'Consentimento revogado',
          description: 'O consentimento foi revogado com sucesso.',
          variant: 'destructive',
        })
        return { success: true }
      } catch (err) {
        console.error('Erro ao revogar consentimento:', err)
        const msg = describePbError(err)
        toast({
          title: 'Erro ao revogar consentimento',
          description: msg,
          variant: 'destructive',
        })
        return { success: false, message: msg }
      }
    },
    [],
  )

  // ---------- LGPD: Textos de Política/Termos ----------
  const defaultPolicyTexts = (): PolicyTexts => ({
    dados_cadastrais: {
      texto: TEXTO_PADRAO_CONSENTIMENTO.dados_cadastrais,
      versao: 'v1',
    },
    dados_saude: { texto: TEXTO_PADRAO_CONSENTIMENTO.dados_saude, versao: 'v1' },
    marketing: { texto: TEXTO_PADRAO_CONSENTIMENTO.marketing, versao: 'v1' },
    pesquisa: { texto: TEXTO_PADRAO_CONSENTIMENTO.pesquisa, versao: 'v1' },
    politica_privacidade:
      'POLÍTICA DE PRIVACIDADE — AUDIÇÃO360 (LGPD - Lei 13.709/2018)\n\n' +
      'A AUDIÇÃO360 valoriza a privacidade e a proteção dos dados pessoais de seus pacientes, ' +
      'colaboradores e parceiros. Esta Política de Privacidade descreve como coletamos, usamos, ' +
      'armazenamos e protegemos as informações em conformidade com a Lei Geral de Proteção de Dados (LGPD).\n\n' +
      '1. Dados coletados: nome, CPF, data de nascimento, endereço, telefones, e-mail e dados de saúde ' +
      'necessários à prestação dos serviços audiológicos.\n' +
      '2. Finalidade do tratamento: cadastro, agendamento, prestação de serviços, comunicação e ' +
      'cumprimento de obrigações legais.\n' +
      '3. Compartilhamento: os dados são tratados com sigilo e somente compartilhados quando exigido ' +
      'por lei ou mediante autorização expressa do titular.\n' +
      '4. Direitos do titular: acesso, correção, exclusão, portabilidade e revogação do consentimento, ' +
      'mediante solicitação por escrito à clínica.\n' +
      '5. Segurança: adotamos medidas técnicas e organizacionais para proteger os dados contra acessos ' +
      'não autorizados, perda ou alteração indevida.\n\n' +
      'Para mais informações ou exercício de direitos, entre em contato pelo e-mail da clínica.',
  })

  const fetchLgpdPolicyTexts = useCallback(async (): Promise<PolicyTexts> => {
    try {
      const list = await pb.collection('policy_texts').getList(1, 1, { sort: '-created' })
      const rec: any = list.items?.[0]
      if (!rec) return defaultPolicyTexts()
      return {
        dados_cadastrais: {
          texto: rec.dados_cadastrais_texto || TEXTO_PADRAO_CONSENTIMENTO.dados_cadastrais,
          versao: rec.dados_cadastrais_versao || 'v1',
        },
        dados_saude: {
          texto: rec.dados_saude_texto || TEXTO_PADRAO_CONSENTIMENTO.dados_saude,
          versao: rec.dados_saude_versao || 'v1',
        },
        marketing: {
          texto: rec.marketing_texto || TEXTO_PADRAO_CONSENTIMENTO.marketing,
          versao: rec.marketing_versao || 'v1',
        },
        pesquisa: {
          texto: rec.pesquisa_texto || TEXTO_PADRAO_CONSENTIMENTO.pesquisa,
          versao: rec.pesquisa_versao || 'v1',
        },
        politica_privacidade: rec.politica_privacidade || defaultPolicyTexts().politica_privacidade,
      }
    } catch (err) {
      console.error('Erro ao buscar textos da política LGPD:', err)
      return defaultPolicyTexts()
    }
  }, [])

  const saveLgpdPolicyTexts = useCallback(
    async (texts: PolicyTexts): Promise<{ success: boolean; message?: string }> => {
      try {
        const payload = {
          dados_cadastrais_texto: texts.dados_cadastrais.texto,
          dados_cadastrais_versao: texts.dados_cadastrais.versao || 'v1',
          dados_saude_texto: texts.dados_saude.texto,
          dados_saude_versao: texts.dados_saude.versao || 'v1',
          marketing_texto: texts.marketing.texto,
          marketing_versao: texts.marketing.versao || 'v1',
          pesquisa_texto: texts.pesquisa.texto,
          pesquisa_versao: texts.pesquisa.versao || 'v1',
          politica_privacidade: texts.politica_privacidade,
        }
        const list = await pb.collection('policy_texts').getList(1, 1, { sort: '-created' })
        if (list.items.length > 0) {
          await pb.collection('policy_texts').update(list.items[0].id, payload)
        } else {
          await pb.collection('policy_texts').create(payload)
        }
        toast({
          title: 'Textos da LGPD salvos',
          description: 'As configurações foram atualizadas.',
        })
        return { success: true }
      } catch (err) {
        console.error('Erro ao salvar textos da LGPD:', err)
        const msg = describePbError(err)
        toast({
          title: 'Erro ao salvar',
          description: msg,
          variant: 'destructive',
        })
        return { success: false, message: msg }
      }
    },
    [],
  )

  // ---------- Controle de Inadimplência (Contas a Receber) ----------
  const fetchContasReceber = useCallback(async () => {
    try {
      const list = await pb.collection('contas_receber').getFullList({ sort: '-data_vencimento' })
      setContasReceber(list.map(mapContaReceber))
    } catch (err) {
      console.error('Erro ao carregar contas a receber:', err)
    }
  }, [])

  const fetchRecebimentos = useCallback(async (contaId: string): Promise<Recebimento[]> => {
    if (!contaId) return []
    try {
      const list = await pb.collection('recebimentos').getFullList({
        filter: `conta_receber_id = "${contaId}"`,
        sort: '-data_recebimento',
      })
      return list.map(mapRecebimento)
    } catch (err) {
      console.error('Erro ao carregar recebimentos:', err)
      return []
    }
  }, [])

  /**
   * Cria uma ou mais contas a receber a partir de uma venda (PDV ou B2B).
   * Chamado automaticamente após a criação da venda.
   * - Convênio / Boleto / Promissória: 1 conta com o valor total.
   * - Parcelado: N contas, uma por parcela, vencimentos mensais.
   */
  const criarContasReceberDeVenda = useCallback(
    async (
      vendaId: string,
      origem: ContaReceberOrigem,
      params: {
        pacienteId?: string
        pacienteNome?: string
        pacienteTelefone?: string
        empresaId?: string
        empresaNome?: string
        empresaTelefone?: string
        descricao: string
        valor: number
        forma: ContaReceberForma
        numeroParcelas: number
        dataVenda: string
        primeiroVencimento: string
      },
    ) => {
      const parcelas = Math.max(1, params.numeroParcelas || 1)
      const baseVenc = new Date(params.primeiroVencimento + 'T00:00:00')
      if (isNaN(baseVenc.getTime())) return
      const valorParcela = params.valor / parcelas
      const usuarioId = currentUser?.id || ''
      const cliente_nome = params.pacienteNome || params.empresaNome || 'Venda avulsa'
      const cliente_telefone = params.pacienteTelefone || params.empresaTelefone || ''
      const pacienteId = params.pacienteId || ''
      const empresaId = params.empresaId || ''

      for (let i = 1; i <= parcelas; i++) {
        const venc = new Date(baseVenc)
        venc.setMonth(venc.getMonth() + (i - 1))
        const vencStr = venc.toISOString().split('T')[0]
        try {
          const rec: any = await pb.collection('contas_receber').create({
            venda_id: vendaId,
            venda_origem: origem,
            paciente_id: pacienteId,
            empresa_parceira_id: empresaId,
            cliente_nome,
            cliente_telefone,
            descricao:
              parcelas > 1 ? `${params.descricao} (Parcela ${i}/${parcelas})` : params.descricao,
            valor_original: valorParcela,
            valor_recebido: 0,
            valor_restante: valorParcela,
            forma_pagamento: params.forma,
            numero_parcelas: parcelas,
            parcela_atual: i,
            data_venda: params.dataVenda,
            data_vencimento: vencStr,
            status: 'a_receber',
            observacoes: '',
            usuario_id: usuarioId,
          })
          setContasReceber((prev) => [mapContaReceber(rec), ...prev])
        } catch (err) {
          console.error('Erro ao criar conta a receber:', err)
        }
      }
    },
    [currentUser?.id],
  )

  const registrarRecebimento = useCallback(
    async (
      contaId: string,
      data: {
        valor: number
        data_recebimento: string
        forma_recebimento: FormaRecebimento
        observacoes?: string
        // ---- Acréscimo de itens extras + desconto (Registrar Recebimento) ----
        valor_base?: number
        itens_extras?: Array<{
          nome: string
          quantidade: number
          valor_unitario: number
          subtotal: number
        }>
        desconto_tipo?: 'valor' | 'percentual' | ''
        desconto_valor?: number
        valor_total?: number
      },
    ): Promise<{ success: boolean; message?: string }> => {
      try {
        const conta = contasReceber.find((c) => c.id === contaId)
        if (!conta) return { success: false, message: 'Conta não encontrada.' }
        const valor = Number(data.valor) || 0
        if (valor <= 0) return { success: false, message: 'Informe um valor válido.' }
        // Quando há itens extras/desconto, o valor a quitar é o valor_total (maior
        // que o restante original). Sem extras, mantém o limite do restante.
        const temExtras =
          (Array.isArray(data.itens_extras) && data.itens_extras.length > 0) ||
          (Number(data.desconto_valor) || 0) > 0
        const limite = temExtras ? Number.MAX_SAFE_INTEGER : conta.valor_restante + 0.01
        if (valor > limite) {
          return { success: false, message: 'Valor maior que o restante da conta.' }
        }

        // Cria o recebimento (com itens extras + desconto, quando houver)
        await pb.collection('recebimentos').create({
          conta_receber_id: contaId,
          valor,
          data_recebimento: data.data_recebimento,
          forma_recebimento: data.forma_recebimento,
          observacoes: data.observacoes || '',
          usuario_id: currentUser?.id || '',
          usuario_nome: currentUser?.name || '',
          valor_base: data.valor_base != null ? Number(data.valor_base) : conta.valor_restante,
          itens_extras: Array.isArray(data.itens_extras) ? data.itens_extras : [],
          desconto_tipo: data.desconto_tipo || '',
          desconto_valor: Number(data.desconto_valor) || 0,
          valor_total: data.valor_total != null ? Number(data.valor_total) : valor,
        })

        // Atualiza a conta: o valor quitado contra a conta é o `valor` informado
        // (já contabilizando extras/desconto). O acréscimo líquido
        // (itens extras - desconto em R$) ajusta o valor_original da conta,
        // de modo que o restante seja zerado ao receber o total. Pode ser
        // negativo quando o desconto supera os acréscimos (abatimento da conta).
        const novoRecebido = conta.valor_recebido + valor
        const acrescimoLiquido = temExtras ? valor - conta.valor_restante : 0
        const novoOriginal = Math.max(0, conta.valor_original + acrescimoLiquido)
        const novoRestante = Math.max(0, novoOriginal - novoRecebido)
        const novoStatus: ContaReceberStatus =
          novoRestante <= 0.01 ? 'recebido_total' : 'recebido_parcial'
        const updated: any = await pb.collection('contas_receber').update(contaId, {
          valor_original: novoOriginal,
          valor_recebido: novoRecebido,
          valor_restante: novoRestante,
          status: novoStatus,
          data_recebimento: novoStatus === 'recebido_total' ? data.data_recebimento : '',
        })
        const mapped = mapContaReceber(updated)
        setContasReceber((prev) => prev.map((c) => (c.id === contaId ? mapped : c)))
        toast({
          title:
            novoStatus === 'recebido_total'
              ? 'Recebimento total registrado'
              : 'Recebimento parcial registrado',
          description: `R$ ${valor.toFixed(2)} • ${conta.cliente_nome}`,
        })

        // FEATURE 2: Notificar profissional via chat interno quando secretária recebe pagamento
        try {
          const valorFormatado = valor.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
          const dataFormatada = data.data_recebimento
            ? data.data_recebimento.split('-').reverse().join('/')
            : new Date().toLocaleDateString('pt-BR')
          const formaTexto = data.forma_recebimento || 'outros'
          const mensagemTexto = `✅ Recebimento registrado: ${conta.cliente_nome} — R$ ${valorFormatado} via ${formaTexto} em ${dataFormatada}`

          // Tentar identificar o profissional que atendeu o paciente
          let destinatarioIds: string[] = []

          if (conta.venda_id) {
            try {
              const saleRec: any = await pb.collection('sales').getOne(conta.venda_id)
              if (saleRec?.appointmentId) {
                const aptRec: any = await pb
                  .collection('appointments')
                  .getOne(saleRec.appointmentId)
                if (aptRec?.professionalName) {
                  // Busca o user pelo nome do profissional
                  const profUsers = await pb.collection('users').getFullList({
                    filter: `name ~ "${aptRec.professionalName}" || role = "profissional"`,
                  })
                  const matchedProf = profUsers.find(
                    (u: any) =>
                      u.name &&
                      (u.name.toLowerCase().includes(aptRec.professionalName.toLowerCase()) ||
                        aptRec.professionalName.toLowerCase().includes(u.name.toLowerCase())),
                  )
                  if (matchedProf) {
                    destinatarioIds.push(matchedProf.id)
                  }
                }
              }
            } catch (errFindApt) {
              console.warn('Não foi possível identificar agendamento da venda:', errFindApt)
            }
          }

          // Se não encontrou profissional específico pelo agendamento, busca todos com role='profissional'
          if (destinatarioIds.length === 0) {
            try {
              const allProfs = await pb.collection('users').getFullList({
                filter: 'role = "profissional"',
              })
              destinatarioIds = allProfs.map((u: any) => u.id)
            } catch (errProfs) {
              console.warn('Erro ao listar profissionais para notificação:', errProfs)
            }
          }

          const remetenteId = currentUser?.id || ''
          // Envia a mensagem para os profissionais identificados
          for (const destId of destinatarioIds) {
            if (destId && destId !== remetenteId) {
              await pb.collection('mensagens').create({
                remetente: remetenteId,
                destinatario: destId,
                texto: mensagemTexto,
                lida: false,
              })
            }
          }
        } catch (errNotif) {
          console.error('Erro ao enviar notificação de recebimento ao profissional:', errNotif)
        }

        return { success: true }
      } catch (err) {
        console.error('Erro ao registrar recebimento:', err)
        return { success: false, message: describePbError(err) }
      }
    },
    [contasReceber, currentUser?.id, currentUser?.name],
  )

  const renegociarConta = useCallback(
    async (
      contaId: string,
      data: {
        novo_vencimento: string
        novo_valor: number
        novo_numero_parcelas: number
        motivo: string
      },
    ): Promise<{ success: boolean; message?: string }> => {
      try {
        if (!data.motivo?.trim()) {
          return { success: false, message: 'Informe o motivo da renegociação.' }
        }
        const conta = contasReceber.find((c) => c.id === contaId)
        if (!conta) return { success: false, message: 'Conta não encontrada.' }

        // Marca a conta original como renegociada
        const origUpdated: any = await pb.collection('contas_receber').update(contaId, {
          status: 'renegociado',
          motivo_renegociacao: data.motivo.trim(),
        })
        setContasReceber((prev) =>
          prev.map((c) => (c.id === contaId ? mapContaReceber(origUpdated) : c)),
        )

        // Cria nova conta com os termos renegociados
        const parcelas = Math.max(1, data.novo_numero_parcelas || 1)
        const baseVenc = new Date(data.novo_vencimento + 'T00:00:00')
        const valorParcela = (Number(data.novo_valor) || conta.valor_restante) / parcelas
        const usuarioId = currentUser?.id || ''
        const novasContas: ContaReceber[] = []
        for (let i = 1; i <= parcelas; i++) {
          const venc = new Date(baseVenc)
          venc.setMonth(venc.getMonth() + (i - 1))
          const vencStr = venc.toISOString().split('T')[0]
          const rec: any = await pb.collection('contas_receber').create({
            venda_id: conta.venda_id,
            venda_origem: conta.venda_origem,
            paciente_id: conta.paciente_id,
            empresa_parceira_id: conta.empresa_parceira_id,
            cliente_nome: conta.cliente_nome,
            cliente_telefone: conta.cliente_telefone,
            descricao:
              parcelas > 1
                ? `${conta.descricao} — Renegociada (Parcela ${i}/${parcelas})`
                : `${conta.descricao} — Renegociada`,
            valor_original: valorParcela,
            valor_recebido: 0,
            valor_restante: valorParcela,
            forma_pagamento: conta.forma_pagamento,
            numero_parcelas: parcelas,
            parcela_atual: i,
            data_venda: conta.data_venda,
            data_vencimento: vencStr,
            status: 'a_receber',
            observacoes: `Renegociação da conta ${contaId}. Motivo: ${data.motivo.trim()}`,
            conta_origem_id: contaId,
            motivo_renegociacao: data.motivo.trim(),
            usuario_id: usuarioId,
          })
          novasContas.push(mapContaReceber(rec))
        }
        setContasReceber((prev) => [...novasContas, ...prev])
        toast({
          title: 'Renegociação concluída',
          description: `${parcelas} nova(s) conta(s) criada(s) a partir de ${conta.cliente_nome}.`,
        })
        return { success: true }
      } catch (err) {
        console.error('Erro ao renegociar conta:', err)
        return { success: false, message: describePbError(err) }
      }
    },
    [contasReceber, currentUser?.id],
  )

  const cancelarConta = useCallback(
    async (contaId: string, motivo: string): Promise<{ success: boolean; message?: string }> => {
      try {
        if (!motivo?.trim()) {
          return { success: false, message: 'Informe o motivo do cancelamento.' }
        }
        const conta = contasReceber.find((c) => c.id === contaId)
        if (!conta) return { success: false, message: 'Conta não encontrada.' }
        const updated: any = await pb.collection('contas_receber').update(contaId, {
          status: 'cancelado',
          motivo_cancelamento: motivo.trim(),
        })
        setContasReceber((prev) =>
          prev.map((c) => (c.id === contaId ? mapContaReceber(updated) : c)),
        )
        toast({
          title: 'Conta cancelada',
          description: `Conta de ${conta.cliente_nome} cancelada. Registro salvo na auditoria.`,
          variant: 'destructive',
        })
        return { success: true }
      } catch (err) {
        console.error('Erro ao cancelar conta:', err)
        return { success: false, message: describePbError(err) }
      }
    },
    [contasReceber],
  )

  // ============================================================
  // ---------- Despesas Handlers ----------
  // ============================================================
  const fetchDespesas = useCallback(async () => {
    try {
      const list = await pb.collection('despesas').getFullList({ sort: '-data_vencimento' })
      setDespesas(list.map(mapDespesa))
    } catch (err) {
      console.error('Erro ao carregar despesas:', err)
    }
  }, [])

  /** Converte forma de pagamento de despesa para a forma usada em movimentacoes_caixa. */
  const formaDespesaToCaixa = (forma?: DespesaFormaPagamento): FormaPagamentoCaixa => {
    switch (forma) {
      case 'cartao':
        return 'credito'
      case 'pix':
        return 'pix'
      case 'transferencia':
        return 'pix'
      case 'boleto':
        return 'boleto'
      case 'cheque':
        return 'dinheiro'
      default:
        return 'dinheiro'
    }
  }

  const createDespesa = useCallback(
    async (
      data: Omit<Despesa, 'id' | 'created' | 'updated'> & { comprovanteFile?: File | null },
    ): Promise<{ success: boolean; message?: string }> => {
      try {
        if (!data.descricao?.trim()) {
          return { success: false, message: 'Informe a descrição.' }
        }
        if (!data.valor || data.valor <= 0) {
          return { success: false, message: 'Informe um valor válido.' }
        }
        if (!data.data_vencimento) {
          return { success: false, message: 'Informe a data de vencimento.' }
        }
        const payload: Record<string, any> = {
          descricao: data.descricao.trim(),
          valor: Number(data.valor),
          data_vencimento: data.data_vencimento,
          categoria: data.categoria || 'outros',
          forma_pagamento: data.forma_pagamento || '',
          status: data.status || 'a_pagar',
          valor_pago: Number(data.valor_pago) || 0,
          observacoes: data.observacoes || '',
          motivo_cancelamento: '',
          usuario_id: currentUser?.id || '',
          movimentacao_caixa_id: '',
        }
        if (data.data_pagamento) payload.data_pagamento = data.data_pagamento

        let rec: any
        if (data.comprovanteFile) {
          const fd = new FormData()
          for (const [k, v] of Object.entries(payload)) fd.append(k, String(v))
          fd.append('comprovante', data.comprovanteFile)
          rec = await pb.collection('despesas').create(fd)
        } else {
          rec = await pb.collection('despesas').create(payload)
        }
        setDespesas((prev) => [mapDespesa(rec), ...prev])
        toast({ title: 'Despesa cadastrada', description: data.descricao.trim() })
        return { success: true }
      } catch (err) {
        console.error('Erro ao criar despesa:', err)
        return { success: false, message: describePbError(err) }
      }
    },
    [currentUser?.id],
  )

  const updateDespesa = useCallback(
    async (
      id: string,
      data: Partial<Despesa> & { comprovanteFile?: File | null },
    ): Promise<{ success: boolean; message?: string }> => {
      try {
        const patch: Record<string, any> = {}
        if (data.descricao !== undefined) patch.descricao = data.descricao.trim()
        if (data.valor !== undefined) patch.valor = Number(data.valor)
        if (data.data_vencimento !== undefined) patch.data_vencimento = data.data_vencimento
        if (data.data_pagamento !== undefined) patch.data_pagamento = data.data_pagamento || ''
        if (data.categoria !== undefined) patch.categoria = data.categoria
        if (data.forma_pagamento !== undefined) patch.forma_pagamento = data.forma_pagamento || ''
        if (data.status !== undefined) patch.status = data.status
        if (data.valor_pago !== undefined) patch.valor_pago = Number(data.valor_pago) || 0
        if (data.observacoes !== undefined) patch.observacoes = data.observacoes || ''
        if (data.motivo_cancelamento !== undefined)
          patch.motivo_cancelamento = data.motivo_cancelamento || ''

        let rec: any
        if (data.comprovanteFile) {
          const fd = new FormData()
          for (const [k, v] of Object.entries(patch)) fd.append(k, String(v))
          fd.append('comprovante', data.comprovanteFile)
          rec = await pb.collection('despesas').update(id, fd)
        } else {
          rec = await pb.collection('despesas').update(id, patch)
        }
        setDespesas((prev) => prev.map((d) => (d.id === id ? mapDespesa(rec) : d)))
        toast({ title: 'Despesa atualizada' })
        return { success: true }
      } catch (err) {
        console.error('Erro ao atualizar despesa:', err)
        return { success: false, message: describePbError(err) }
      }
    },
    [],
  )

  const pagarDespesa = useCallback(
    async (
      id: string,
      data: {
        data_pagamento: string
        forma_pagamento: DespesaFormaPagamento
        valor: number
        observacoes?: string
      },
    ): Promise<{ success: boolean; message?: string }> => {
      try {
        const despesa = despesas.find((d) => d.id === id)
        if (!despesa) return { success: false, message: 'Despesa não encontrada.' }
        const valor = Number(data.valor) || 0
        if (valor <= 0) return { success: false, message: 'Informe um valor válido.' }
        if (!data.data_pagamento) return { success: false, message: 'Informe a data de pagamento.' }

        const valorPagoAnterior = Number(despesa.valor_pago) || 0
        const novoValorPago = valorPagoAnterior + valor
        const total = Number(despesa.valor) || 0
        // Quitação total considera tolerância de 1 centavo.
        const quitada = novoValorPago >= total - 0.01
        const novoStatus: DespesaStatus = quitada ? 'pago' : 'a_pagar'

        // Cria movimentação de caixa (saída) e guarda o id para estorno futuro.
        let movId = ''
        try {
          const movRec: any = await pb.collection('movimentacoes_caixa').create({
            fechamento: '',
            tipo: 'saida',
            valor,
            descricao: `Despesa: ${despesa.descricao}`,
            forma_pagamento: formaDespesaToCaixa(data.forma_pagamento),
            data: data.data_pagamento,
            sale: '',
            usuario: currentUser?.id || '',
          })
          movId = movRec?.id || ''
          const mappedMov = mapMovimentacaoCaixa(movRec)
          setMovimentacoesCaixa((prev) => [...prev, mappedMov])
        } catch (eMov) {
          console.error('Erro ao criar movimentação de caixa (saída despesa):', eMov)
        }

        const obsConcat = data.observacoes?.trim()
          ? `${despesa.observacoes ? despesa.observacoes + '\n' : ''}Pgto ${data.data_pagamento}: ${data.observacoes.trim()}`
          : despesa.observacoes

        const updated: any = await pb.collection('despesas').update(id, {
          status: novoStatus,
          valor_pago: novoValorPago,
          data_pagamento: quitada
            ? data.data_pagamento
            : despesa.data_pagamento || data.data_pagamento,
          forma_pagamento: data.forma_pagamento,
          observacoes: obsConcat,
          movimentacao_caixa_id: movId || despesa.movimentacao_caixa_id || '',
        })
        setDespesas((prev) => prev.map((d) => (d.id === id ? mapDespesa(updated) : d)))
        toast({
          title: quitada ? 'Despesa quitada' : 'Pagamento parcial registrado',
          description: `R$ ${valor.toFixed(2)} • ${despesa.descricao}`,
        })
        return { success: true }
      } catch (err) {
        console.error('Erro ao pagar despesa:', err)
        return { success: false, message: describePbError(err) }
      }
    },
    [despesas, currentUser?.id],
  )

  const cancelarDespesa = useCallback(
    async (id: string, motivo: string): Promise<{ success: boolean; message?: string }> => {
      try {
        if (!motivo?.trim()) {
          return { success: false, message: 'Informe o motivo do cancelamento.' }
        }
        const despesa = despesas.find((d) => d.id === id)
        if (!despesa) return { success: false, message: 'Despesa não encontrada.' }

        // Estorno de caixa: se a despesa havia gerado movimentação de saída,
        // cria uma movimentação de entrada equivalente ao valor pago.
        const valorPago = Number(despesa.valor_pago) || 0
        if (valorPago > 0 && despesa.movimentacao_caixa_id) {
          try {
            const estornoRec: any = await pb.collection('movimentacoes_caixa').create({
              fechamento: '',
              tipo: 'entrada',
              valor: valorPago,
              descricao: `Estorno — Cancelamento despesa: ${despesa.descricao}`,
              forma_pagamento: formaDespesaToCaixa(despesa.forma_pagamento),
              data: todayStr(),
              sale: '',
              usuario: currentUser?.id || '',
            })
            const mappedMov = mapMovimentacaoCaixa(estornoRec)
            setMovimentacoesCaixa((prev) => [...prev, mappedMov])
          } catch (eEst) {
            console.error('Erro ao criar estorno de caixa (despesa):', eEst)
          }
        }

        const updated: any = await pb.collection('despesas').update(id, {
          status: 'cancelado',
          motivo_cancelamento: motivo.trim(),
        })
        setDespesas((prev) => prev.map((d) => (d.id === id ? mapDespesa(updated) : d)))
        toast({
          title: 'Despesa cancelada',
          description: `${despesa.descricao}. Registro salvo na auditoria.`,
          variant: 'destructive',
        })
        return { success: true }
      } catch (err) {
        console.error('Erro ao cancelar despesa:', err)
        return { success: false, message: describePbError(err) }
      }
    },
    [despesas, currentUser?.id],
  )

  return (
    <AppContext.Provider
      value={{
        currentUser,
        login,
        verify2FA,
        logout,
        recoverPassword,
        updateProfile,
        changePassword,
        enable2FA,
        disable2FA,
        twoFactorEnabled,
        uploadAvatar,
        dataLoading,
        markOnboardingCompleted,
        // Segurança
        securitySettings,
        fetchSecuritySettings,
        saveSecuritySettings,
        sessionTimeoutDisabled,
        setSessionTimeoutDisabled,
        clinicSettings,
        saveClinicSettings,
        equipments,
        addEquipment,
        updateEquipment,
        deleteEquipment,
        patients,
        addPatient,
        updatePatient,
        deletePatient,
        getPatient,
        appointments,
        addAppointment,
        updateAppointment,
        deleteAppointment,
        clinicalRecords,
        updateClinicalRecord,
        evolutions,
        addEvolution,
        deleteEvolution,
        audiometries,
        addAudiometry,
        deleteAudiometry,
        tympanometries,
        addTympanometry,
        deleteTympanometry,
        beras,
        addBera,
        deleteBera,
        hearingAids,
        addHearingAid,
        updateHearingAid,
        deleteHearingAid,
        addAidMaintenance,
        addAidAdjustment,
        budgets,
        addBudget,
        updateBudget,
        deleteBudget,
        convertBudgetToSale,
        sales,
        addSale,
        updateSale,
        cancelSale,
        baixarEstoqueVenda,
        devolverEstoqueVenda,
        installments,
        payInstallment,
        commissions,
        addCommission,
        cashMovements,
        addCashMovement,
        stockItems,
        addStockItem,
        updateStockItem,
        deleteStockItem,
        addStockEntry,
        addStockExit,
        // Fechamento de Caixa
        fechamentosCaixa,
        fetchFechamentosCaixa,
        addFechamentoCaixa,
        updateFechamentoCaixa,
        movimentacoesCaixa,
        fetchMovimentacoesCaixa,
        addMovimentacaoCaixa,
        // Vendas B2B
        vendasB2B,
        fetchVendasB2B,
        addVendaB2B,
        updateVendaB2B,
        cancelVendaB2B,
        fetchItensVendaB2B,
        empresasParceiras,
        fetchEmpresasParceiras,
        addEmpresaParceira,
        updateEmpresaParceira,
        nfServicoComissao,
        fetchNFServicoComissao,
        addNFServicoComissao,
        updateNFServicoComissao,
        cancelNFServicoComissao,
        nfseB2BConfig,
        fetchNfseB2BConfig,
        saveNfseB2BConfig,
        // NFS-e emitidas (Vendas PDV)
        nfseEmitidas,
        fetchNfseEmitidas,
        emitirNfseVenda,
        // LGPD
        fetchConsentimentos,
        registrarConsentimento,
        revogarConsentimento,
        fetchLgpdPolicyTexts,
        saveLgpdPolicyTexts,
        // Contas a Receber
        contasReceber,
        fetchContasReceber,
        registrarRecebimento,
        renegociarConta,
        cancelarConta,
        fetchRecebimentos,
        // Despesas
        despesas,
        fetchDespesas,
        createDespesa,
        updateDespesa,
        pagarDespesa,
        cancelarDespesa,
        alerts,
        unreadAlertsCount,
        resetToSeedData,
        // Chat Interno
        unreadMessagesCount,
        refreshUnreadMessagesCount,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp(): AppContextType {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useApp deve ser utilizado dentro de um AppProvider')
  }
  return context
}
