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
} from '@/types'
import { useToast } from '@/hooks/use-toast'
import pb from '@/lib/pocketbase/client'
import { extractFieldErrors } from '@/lib/pocketbase/errors'
import { ClientResponseError } from 'pocketbase'

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
})

const mapStockMovement = (r: any): StockMovement => ({
  id: r.id,
  stockItemId: r.itemId || '',
  date: r.date || '',
  type: r.type === 'Saída' ? 'Saída' : 'Entrada',
  quantity: Number(r.quantity) || 0,
  responsible: r.responsible || '',
  reason: r.reason || '',
  supplier: r.supplier || '',
  patientName: r.patientName || '',
  createdAt: toDateStr(r.created),
})

const mapFechamentoCaixa = (r: any): FechamentoCaixa => {
  const usuario = r.expand?.usuario
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
    status: (r.status === 'fechado' ? 'fechado' : 'aberto') as FechamentoCaixaStatus,
    observacao: r.observacao || '',
    usuarioId: r.usuario || undefined,
    usuarioNome: usuario?.name || undefined,
    created: toDateStr(r.created),
    updated: toDateStr(r.updated),
  }
}

const mapMovimentacaoCaixa = (r: any): MovimentacaoCaixa => {
  const usuario = r.expand?.usuario
  return {
    id: r.id,
    fechamentoId: r.fechamento || '',
    tipo: (r.tipo === 'saida' ? 'saida' : 'entrada') as MovimentacaoCaixaTipo,
    valor: Number(r.valor) || 0,
    descricao: r.descricao || '',
    formaPagamento: (r.forma_pagamento || 'dinheiro') as FormaPagamentoCaixa,
    data: toDateStr(r.data),
    saleId: r.sale || undefined,
    usuarioId: r.usuario || undefined,
    usuarioNome: usuario?.name || undefined,
    created: toDateStr(r.created),
  }
}

const mapEmpresaParceira = (r: any): EmpresaParceira => ({
  id: r.id,
  razao_social: r.razao_social || '',
  nome_fantasia: r.nome_fantasia || '',
  cnpj: r.cnpj || '',
  inscricao_estadual: r.inscricao_estadual || '',
  email: r.email || '',
  telefone: r.telefone || '',
  endereco: r.endereco || '',
  cidade: r.cidade || '',
  estado: r.estado || '',
  cep: r.cep || '',
  status: (r.status === 'inativo' ? 'inativo' : 'ativo') as EmpresaParceira['status'],
  created: toDateStr(r.created),
  updated: toDateStr(r.updated),
})

const mapItemVendaB2B = (r: any): ItemVendaB2B => ({
  id: r.id,
  venda_b2b_id: r.venda_b2b_id || r.venda_b2b || '',
  produto_id: r.produto_id || r.produto || '',
  produto_nome: r.produto_nome || '',
  quantidade: Number(r.quantidade) || 0,
  valor_unitario: Number(r.valor_unitario) || 0,
  valor_subtotal: Number(r.valor_subtotal) || 0,
  created: toDateStr(r.created),
})

const mapNFServicoComissao = (r: any): NFServicoComissao => ({
  id: r.id,
  venda_b2b_id: r.venda_b2b_id || r.venda_b2b || '',
  numero_nfse: r.numero_nfse || r.numero_nf || '',
  codigo_verificacao: r.codigo_verificacao || '',
  data_emissao: toDateStr(r.data_emissao),
  valor_base: Number(r.valor_base) || 0,
  aliquota_iss: Number(r.aliquota_iss) || 0,
  valor_iss: Number(r.valor_iss) || 0,
  valor_liquido: Number(r.valor_liquido) || 0,
  discriminacao_servico: r.discriminacao_servico || '',
  item_lista_servico: r.item_lista_servico || '',
  tomador_cnpj: r.tomador_cnpj || '',
  tomador_razao_social: r.tomador_razao_social || '',
  tomador_endereco: r.tomador_endereco || '',
  tomador_municipio: r.tomador_municipio || '',
  tomador_uf: r.tomador_uf || '',
  tomador_cep: r.tomador_cep || '',
  tomador_email: r.tomador_email || '',
  motivo_cancelamento: r.motivo_cancelamento || undefined,
  pdf_url: r.pdf_url || undefined,
  status: (r.status || 'rascunho') as NFServicoComissao['status'],
  created: toDateStr(r.created),
  updated: toDateStr(r.updated),
})

const DEFAULT_NFSE_CONFIG: Omit<NfseB2BConfig, 'id' | 'created' | 'updated'> = {
  municipio: 'Caçador',
  uf: 'SC',
  codigo_municipio: '8107308',
  provedor: 'BETHA',
  url_api: '',
  login_api: '',
  token_api: '',
  inscricao_municipal: '',
  aliquota_iss_padrao: 3,
  item_lista_servico: '10.01',
  discriminacao_padrao: 'Intermediação comercial - Comissão sobre venda de aparelhos auditivos',
  ambiente: 'homologacao',
  ativo: true,
}

const mapNfseB2BConfig = (r: any): NfseB2BConfig => ({
  id: r.id,
  municipio: r.municipio || '',
  uf: r.uf || '',
  codigo_municipio: r.codigo_municipio || '',
  provedor: (r.provedor || 'BETHA') as NfseB2BConfig['provedor'],
  url_api: r.url_api || '',
  login_api: r.login_api || '',
  token_api: r.token_api || '',
  inscricao_municipal: r.inscricao_municipal || '',
  aliquota_iss_padrao: Number(r.aliquota_iss_padrao) || 0,
  item_lista_servico: r.item_lista_servico || '',
  discriminacao_padrao: r.discriminacao_padrao || '',
  ambiente: (r.ambiente === 'producao' ? 'producao' : 'homologacao') as NfseB2BConfig['ambiente'],
  ativo: r.ativo !== false,
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
    data_venda: toDateStr(r.data_venda),
    valor_total: Number(r.valor_total) || 0,
    percentual_comissao: Number(r.percentual_comissao) || 0,
    valor_comissao: Number(r.valor_comissao) || 0,
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
  login: (email: string, password: string, rememberMe?: boolean) => Promise<boolean>
  logout: () => void
  recoverPassword: (email: string) => boolean
  updateProfile: (data: {
    name: string
    crmCrfa?: string
    oldPassword?: string
    newPassword?: string
    passwordConfirm?: string
  }) => Promise<{ success: boolean; message?: string }>
  uploadAvatar: (file: File) => Promise<{ success: boolean; message?: string }>
  dataLoading: boolean

  // Configurações da Clínica
  clinicSettings: ClinicSettings | null
  saveClinicSettings: (
    data: Omit<ClinicSettings, 'id'>,
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
    data: Omit<NFServicoComissao, 'id' | 'created'>,
  ) => Promise<NFServicoComissao | null>
  updateNFServicoComissao: (
    id: string,
    data: Partial<NFServicoComissao>,
  ) => Promise<{ success: boolean; message?: string }>
  cancelNFServicoComissao: (
    id: string,
    motivo: string,
  ) => Promise<{ success: boolean; message?: string }>
  // Configuração da NFS-e de comissão B2B
  nfseB2BConfig: NfseB2BConfig | null
  fetchNfseB2BConfig: () => Promise<void>
  saveNfseB2BConfig: (
    data: Partial<Omit<NfseB2BConfig, 'id' | 'created' | 'updated'>>,
  ) => Promise<{ success: boolean; message?: string }>

  // Utilitário para recarregar dados do banco
  resetToSeedData: () => void
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
        setClinicSettings({
          id: clinicRec.id,
          nome: clinicRec.nome || '',
          endereco: clinicRec.endereco || '',
          telefone: clinicRec.telefone || '',
          email: clinicRec.email || '',
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
        setCurrentUser({
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
        })
      }
    } catch (_) {
      // sessão inválida — ignora
    }
  }, [])

  // ---------- Carregar dados quando autenticado ----------
  useEffect(() => {
    if (currentUser && pb.authStore.isValid) {
      reloadAll()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id])

  // ---------- Auth Handlers ----------
  const login = async (email: string, pass: string, _rememberMe = false): Promise<boolean> => {
    try {
      const auth = await pb.collection('users').authWithPassword(email.trim(), pass)
      const r: any = auth.record
      const user: User = {
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
      }
      setCurrentUser(user)
      toast({
        title: 'Acesso autorizado',
        description: `Bem-vindo(a) ao Audição360, ${user.name}!`,
      })
      return true
    } catch (err) {
      console.error('Falha no login:', err)
      return false
    }
  }

  const logout = () => {
    pb.authStore.clear()
    setCurrentUser(null)
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

      // 2. Se newPassword preenchida, atualiza a senha em uma segunda chamada
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
        if (data.newPassword.length < 6) {
          return { success: false, message: 'A nova senha deve ter pelo menos 6 caracteres.' }
        }
        await pb.collection('users').update(currentUser.id, {
          password: data.newPassword,
          passwordConfirm: data.passwordConfirm,
          oldPassword: data.oldPassword,
        })
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
    data: Omit<ClinicSettings, 'id'>,
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      // Garante que exista um registro singleton carregado.
      let current = clinicSettings
      if (!current) {
        try {
          const list = await pb.collection('clinic_settings').getList(1, 1, { sort: '-created' })
          if (list.items.length > 0) {
            const r = list.items[0] as any
            current = {
              id: r.id,
              nome: r.nome || '',
              endereco: r.endereco || '',
              telefone: r.telefone || '',
              email: r.email || '',
            }
          }
        } catch {
          /* intentionally ignored */
        }
      }
      if (!current) {
        const created: any = await pb.collection('clinic_settings').create({
          nome: data.nome || '',
          endereco: data.endereco || '',
          telefone: data.telefone || '',
          email: data.email || '',
        })
        const newRec: ClinicSettings = { id: created.id, ...data }
        setClinicSettings(newRec)
        toast({ title: 'Configurações salvas', description: 'Dados da clínica atualizados.' })
        return { success: true }
      }
      const payload: Record<string, any> = {
        nome: data.nome || '',
        endereco: data.endereco || '',
        telefone: data.telefone || '',
        email: data.email || '',
      }
      const updated: any = await pb.collection('clinic_settings').update(current.id, payload)
      setClinicSettings({
        id: updated.id,
        nome: updated.nome || '',
        endereco: updated.endereco || '',
        telefone: updated.telefone || '',
        email: updated.email || '',
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

    const payload: any = {
      patientId: appData.patientId || '',
      patientName: appData.patientName,
      patientPhone: appData.patientPhone || '',
      procedureId: appData.procedureId || '',
      type: appData.type,
      date: appData.date,
      time: appData.time,
      duration: appData.duration,
      value: appData.value ?? 0,
      professionalName: appData.professionalName,
      status: appData.status,
      notes: appData.notes || '',
      planType: appData.planType || 'Particular',
      reception: appData.reception ?? '',
      // proceduresList: espelha a lista enviada (quando houver). Para novos
      // agendamentos criados pelo AppointmentModal, montamos um item a partir
      // do procedimento principal para manter consistência.
      proceduresList:
        appData.proceduresList && appData.proceduresList.length > 0
          ? appData.proceduresList
          : [
              {
                procedureId: appData.procedureId || '',
                procedureName: appData.type || '',
                value: appData.value ?? 0,
                planType: appData.planType || 'Particular',
              },
            ],
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
    pb.collection('sales')
      .update(id, patch)
      .catch((err) => console.error('Erro ao atualizar venda:', err))
  }

  const cancelSale = (id: string, reason: string, mode: 'Cancelado' | 'Estornado') => {
    const sale = sales.find((s) => s.id === id)
    if (!sale) return

    // 1. Atualiza status + justificativa
    updateSale(id, { status: mode as SaleStatus, cancelReason: reason })

    // 2. Devolve itens de estoque ao saldo (apenas itens de inventário)
    if (Array.isArray(sale.items) && sale.items.length > 0) {
      sale.items.forEach((it: SaleItem) => {
        if (it.type === 'inventory' && it.stockItemId) {
          addStockEntry(
            it.stockItemId,
            it.quantity,
            `Estorno da venda #${sale.number}`,
            currentUser?.name || 'Sistema',
            undefined,
          )
        }
      })
    }

    toast({
      title: mode === 'Estornado' ? 'Venda estornada' : 'Venda cancelada',
      description: `Venda #${sale.number} foi ${mode === 'Estornado' ? 'estornada' : 'cancelada'} e os itens foram devolvidos ao estoque.`,
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
    setStockRaw((prev) =>
      prev.map((it) =>
        it.id === itemId ? { ...it, currentQuantity: Number(it.currentQuantity) - quantity } : it,
      ),
    )
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

    stockItems.forEach((stk) => {
      if (stk.currentQuantity < stk.minQuantity) {
        list.push({
          id: `alert-stk-${stk.id}`,
          type: 'stock',
          severity: stk.currentQuantity === 0 ? 'danger' : 'warning',
          title: `Estoque crítico: ${stk.name}`,
          description: `Saldo atual (${stk.currentQuantity} un) está abaixo do mínimo configurado (${stk.minQuantity} un).`,
          linkUrl: `/estoque`,
          targetId: stk.id,
        })
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
    data: Omit<NFServicoComissao, 'id' | 'created'>,
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
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      if (!motivo?.trim()) {
        return { success: false, message: 'Informe o motivo do cancelamento.' }
      }
      // Busca a NF atual para localizar a venda vinculada.
      const nfRec: any = await pb.collection('nf_servico_comissao').getOne(id)
      const result = await updateNFServicoComissao(id, {
        status: 'cancelada',
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

  return (
    <AppContext.Provider
      value={{
        currentUser,
        login,
        logout,
        recoverPassword,
        updateProfile,
        uploadAvatar,
        dataLoading,
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
        alerts,
        unreadAlertsCount,
        resetToSeedData,
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
