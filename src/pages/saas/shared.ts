import {
  Clinica,
  ClinicaStatus,
  PagamentoSaaS,
  PagamentoSaaSForma,
  PagamentoSaaSStatus,
  Plano,
  CLINICA_STATUS_LABELS,
  CLINICA_STATUS_CLASS,
  PAGAMENTO_SAAS_STATUS_LABELS,
  PAGAMENTO_SAAS_STATUS_CLASS,
  PAGAMENTO_SAAS_FORMA_LABELS,
  PLANO_FUNCIONALIDADE_LABELS,
} from '@/types'
import pb from '@/lib/pocketbase/client'

// ============================================================
// Mapeadores: PocketBase record -> domínio SaaS
// ============================================================
/* eslint-disable @typescript-eslint/no-explicit-any */

/** Converte um datetime/string do PocketBase para "YYYY-MM-DD". */
function toDateStr(value?: string | null): string {
  if (!value) return ''
  const s = String(value)
  return s.slice(0, 10)
}

/** Máscara de CNPJ: 12.345.678/0001-90 */
export function maskCNPJ(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14)
  if (digits.length <= 2) return digits
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`
  if (digits.length <= 12)
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`
}

export function mapPlano(r: any): Plano {
  return {
    id: r.id,
    nome: r.nome || '',
    preco_mensal: Number(r.preco_mensal) || 0,
    funcionalidades: Array.isArray(r.funcionalidades) ? r.funcionalidades : [],
    max_profissionais: Number(r.max_profissionais) || 0,
    max_pacientes: Number(r.max_pacientes) || 0,
    ativo: r.ativo !== false,
    created: toDateStr(r.created),
    updated: toDateStr(r.updated),
  }
}

export function mapClinica(r: any): Clinica {
  const expand = r.expand || {}
  const plano = expand.plano_id
  return {
    id: r.id,
    nome: r.nome || '',
    slug: r.slug || '',
    email: r.email || '',
    cnpj: r.cnpj || '',
    telefone: r.telefone || '',
    endereco: r.endereco || '',
    plano_id: r.plano_id || '',
    plano_nome: plano?.nome || '',
    plano_preco: plano ? Number(plano.preco_mensal) || 0 : undefined,
    status: (r.status || 'ativo') as ClinicaStatus,
    trial_ends: toDateStr(r.trial_ends),
    created: toDateStr(r.created),
    updated: toDateStr(r.updated),
  }
}

export function mapPagamento(r: any): PagamentoSaaS {
  const expand = r.expand || {}
  const clinica = expand.clinica_id
  const plano = expand.plano_id
  return {
    id: r.id,
    clinica_id: r.clinica_id || '',
    clinica_nome: clinica?.nome || '',
    plano_id: r.plano_id || '',
    plano_nome: plano?.nome || '',
    valor: Number(r.valor) || 0,
    data_vencimento: toDateStr(r.data_vencimento),
    data_pagamento: toDateStr(r.data_pagamento),
    forma_pagamento: (r.forma_pagamento || '') as PagamentoSaaSForma,
    status: (r.status || 'pendente') as PagamentoSaaSStatus,
    referencia: r.referencia || '',
    observacoes: r.observacoes || '',
    created: toDateStr(r.created),
    updated: toDateStr(r.updated),
  }
}

// ============================================================
// Acesso a dados (Super Admin)
// ============================================================

export async function fetchPlanos(): Promise<Plano[]> {
  const list = await pb.collection('planos').getFullList({
    sort: 'preco_mensal',
  })
  return list.map(mapPlano)
}

export async function fetchClinicas(): Promise<Clinica[]> {
  const list = await pb.collection('clinicas').getFullList({
    sort: '-created',
    expand: 'plano_id',
  })
  return list.map(mapClinica)
}

export async function fetchPagamentos(): Promise<PagamentoSaaS[]> {
  const list = await pb.collection('pagamentos_saas').getFullList({
    sort: '-data_vencimento',
    expand: 'clinica_id,plano_id',
  })
  return list.map(mapPagamento)
}

// ============================================================
// Rótulos e helpers de exibição
// ============================================================

export function clinicaStatusLabel(status: ClinicaStatus): string {
  return CLINICA_STATUS_LABELS[status] || status
}

export function clinicaStatusClass(status: ClinicaStatus): string {
  return CLINICA_STATUS_CLASS[status] || ''
}

export function pagamentoStatusLabel(status: PagamentoSaaSStatus): string {
  return PAGAMENTO_SAAS_STATUS_LABELS[status] || status
}

export function pagamentoStatusClass(status: PagamentoSaaSStatus): string {
  return PAGAMENTO_SAAS_STATUS_CLASS[status] || ''
}

export function pagamentoFormaLabel(forma?: PagamentoSaaSForma): string {
  if (!forma) return '—'
  return PAGAMENTO_SAAS_FORMA_LABELS[forma] || forma
}

export function planoFuncionalidadeLabel(key: string): string {
  return PLANO_FUNCIONALIDADE_LABELS[key] || key
}

/** Calcula dias de atraso de um pagamento (vencimento < hoje e não pago). */
export function diasAtraso(dataVencimento: string): number {
  if (!dataVencimento) return 0
  const venc = new Date(dataVencimento + 'T00:00:00')
  if (isNaN(venc.getTime())) return 0
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const diff = Math.floor((hoje.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24))
  return diff > 0 ? diff : 0
}

/** Gera um slug a partir do nome (para criar clínicas). */
export function slugify(nome: string): string {
  return (nome || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}

/** Calcula estatísticas agregadas a partir das clínicas. */
export function calcularStats(clinicas: Clinica[]): {
  total_clinicas: number
  ativas: number
  trial: number
  inadimplentes: number
  canceladas: number
  receita_mensal: number
  novas_30dias: number
} {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const limite30 = new Date(hoje)
  limite30.setDate(limite30.getDate() - 30)

  let ativas = 0
  let trial = 0
  let inadimplentes = 0
  let canceladas = 0
  let receita = 0
  let novas30 = 0

  for (const c of clinicas) {
    if (c.status === 'ativo') {
      ativas++
      receita += c.plano_preco || 0
    } else if (c.status === 'trial') {
      trial++
      // Trial conta como receita projetada (após conversão) — omitimos aqui.
    } else if (c.status === 'inadimplente') {
      inadimplentes++
    } else if (c.status === 'cancelado') {
      canceladas++
    }

    if (c.created) {
      const criacao = new Date(c.created + 'T00:00:00')
      if (!isNaN(criacao.getTime()) && criacao >= limite30) {
        novas30++
      }
    }
  }

  return {
    total_clinicas: clinicas.length,
    ativas,
    trial,
    inadimplentes,
    canceladas,
    receita_mensal: receita,
    novas_30dias: novas30,
  }
}
