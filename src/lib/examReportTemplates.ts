// examReportTemplates.ts — Serviço para o módulo de Configuração de Laudos.
// Camada fina sobre o PocketBase para CRUD de modelos e versões.
import pb from './pocketbase/client'
import type {
  ExamReportTemplate,
  ExamReportTemplateVersion,
  ExamReportTipoExame,
  LayoutElement,
} from '../types'

const TEMPLATES = 'exam_report_templates'
const VERSIONS = 'exam_report_template_versions'

type RecordModel = Record<string, unknown>

function mapTemplate(r: RecordModel): ExamReportTemplate {
  return {
    id: r.id as string,
    nome_modelo: (r.nome_modelo as string) || '',
    tipo_exame: (r.tipo_exame as ExamReportTipoExame) || 'personalizado',
    descricao: (r.descricao as string) || '',
    versao: Number(r.versao ?? 1),
    status: (r.status as ExamReportTemplate['status']) || 'rascunho',
    largura_pagina: Number(r.largura_pagina ?? 210),
    altura_pagina: Number(r.altura_pagina ?? 297),
    orientacao: (r.orientacao as ExamReportTemplate['orientacao']) || 'retrato',
    margem_superior: Number(r.margem_superior ?? 12),
    margem_inferior: Number(r.margem_inferior ?? 12),
    margem_esquerda: Number(r.margem_esquerda ?? 15),
    margem_direita: Number(r.margem_direita ?? 15),
    estrutura_layout: Array.isArray(r.estrutura_layout)
      ? (r.estrutura_layout as LayoutElement[])
      : [],
    logo_url: (r.logo_url as string) || '',
    cabecalho_configuracao: (r.cabecalho_configuracao as Record<string, unknown>) || undefined,
    rodape_configuracao: (r.rodape_configuracao as Record<string, unknown>) || undefined,
    fonte_padrao: (r.fonte_padrao as string) || 'Arial',
    tamanho_fonte_padrao: Number(r.tamanho_fonte_padrao ?? 9),
    cor_primaria: (r.cor_primaria as string) || '#1E3A8A',
    cor_secundaria: (r.cor_secundaria as string) || '#00897B',
    observacoes: (r.observacoes as string) || '',
    criado_por: (r.criado_por as string) || '',
    atualizado_por: (r.atualizado_por as string) || '',
    publicado_por: (r.publicado_por as string) || '',
    publicado_em: (r.publicado_em as string) || '',
    created: (r.created as string) || '',
    updated: (r.updated as string) || '',
  }
}

function mapVersion(r: RecordModel): ExamReportTemplateVersion {
  return {
    id: r.id as string,
    template_id: (r.template_id as string) || '',
    numero_versao: Number(r.numero_versao ?? 1),
    estrutura_layout: Array.isArray(r.estrutura_layout)
      ? (r.estrutura_layout as LayoutElement[])
      : [],
    alterado_por: (r.alterado_por as string) || '',
    motivo_alteracao: (r.motivo_alteracao as string) || '',
    created: (r.created as string) || '',
  }
}

function currentUserId(): string {
  try {
    const storeAny = pb.authStore as unknown as {
      model?: { id?: string }
      record?: { id?: string }
    }
    const rec = storeAny.model || storeAny.record
    return rec?.id || ''
  } catch {
    return ''
  }
}

/** Lista todos os modelos (ordenados por criação, mais recentes primeiro). */
export async function listTemplates(): Promise<ExamReportTemplate[]> {
  const records = await pb.collection(TEMPLATES).getFullList({
    sort: '-created',
  })
  return records.map((r) => mapTemplate(r as unknown as RecordModel))
}

/** Busca um modelo pelo id. */
export async function getTemplate(id: string): Promise<ExamReportTemplate> {
  const r = await pb.collection(TEMPLATES).getOne(id)
  return mapTemplate(r as unknown as RecordModel)
}

/** Retorna o modelo publicado (status='publicado') para um tipo de exame. */
export async function getPublishedTemplate(
  tipo: ExamReportTipoExame,
): Promise<ExamReportTemplate | null> {
  const records = await pb.collection(TEMPLATES).getFullList({
    filter: `tipo_exame="${tipo}" && status="publicado"`,
    sort: '-updated',
  })
  if (records.length === 0) return null
  return mapTemplate(records[0] as unknown as RecordModel)
}

/** Retorna todos os modelos publicados (um por tipo). */
export async function getAllPublishedTemplates(): Promise<ExamReportTemplate[]> {
  const records = await pb.collection(TEMPLATES).getFullList({
    filter: `status="publicado"`,
  })
  return records.map((r) => mapTemplate(r as unknown as RecordModel))
}

export type NewTemplateInput = Pick<
  ExamReportTemplate,
  | 'nome_modelo'
  | 'tipo_exame'
  | 'descricao'
  | 'orientacao'
  | 'largura_pagina'
  | 'altura_pagina'
  | 'margem_superior'
  | 'margem_inferior'
  | 'margem_esquerda'
  | 'margem_direita'
>

/** Cria um novo modelo em rascunho com layout vazio. */
export async function createTemplate(input: NewTemplateInput): Promise<ExamReportTemplate> {
  const uid = currentUserId()
  const payload: Record<string, unknown> = {
    nome_modelo: input.nome_modelo,
    tipo_exame: input.tipo_exame,
    descricao: input.descricao || '',
    versao: 1,
    status: 'rascunho',
    largura_pagina: input.largura_pagina,
    altura_pagina: input.altura_pagina,
    orientacao: input.orientacao,
    margem_superior: input.margem_superior,
    margem_inferior: input.margem_inferior,
    margem_esquerda: input.margem_esquerda,
    margem_direita: input.margem_direita,
    estrutura_layout: [],
    fonte_padrao: 'Arial',
    tamanho_fonte_padrao: 9,
    cor_primaria: '#1E3A8A',
    cor_secundaria: '#00897B',
    criado_por: uid,
    atualizado_por: uid,
  }
  const r = await pb.collection(TEMPLATES).create(payload)
  return mapTemplate(r as unknown as RecordModel)
}

/** Atualiza os campos básicos de um modelo (não o layout). */
export async function updateTemplate(
  id: string,
  patch: Partial<ExamReportTemplate>,
): Promise<ExamReportTemplate> {
  const payload: Record<string, unknown> = { ...patch, atualizado_por: currentUserId() }
  // nunca enviar campos do sistema
  delete payload.id
  delete payload.created
  delete payload.updated
  delete payload.criado_por
  delete payload.publicado_em
  const r = await pb.collection(TEMPLATES).update(id, payload)
  return mapTemplate(r as unknown as RecordModel)
}

/** Salva o layout do editor (rascunho). */
export async function saveDraft(
  id: string,
  estrutura_layout: LayoutElement[],
  extra?: Partial<ExamReportTemplate>,
): Promise<ExamReportTemplate> {
  return updateTemplate(id, { estrutura_layout, status: 'rascunho', ...extra })
}

/**
 * Publica o modelo: incrementa versão, status='publicado',
 * arquiva outros modelos publicados do mesmo tipo e cria snapshot
 * em exam_report_template_versions.
 */
export async function publishTemplate(id: string, motivo?: string): Promise<ExamReportTemplate> {
  const uid = currentUserId()
  const tpl = await getTemplate(id)
  const novaVersao = (tpl.versao || 1) + 1

  // Arquiva outros modelos publicados do mesmo tipo
  const publicados = await pb.collection(TEMPLATES).getFullList({
    filter: `tipo_exame="${tpl.tipo_exame}" && status="publicado" && id != "${id}"`,
  })
  for (const p of publicados) {
    await pb.collection(TEMPLATES).update(p.id, { status: 'arquivado' })
  }

  const updated = await pb.collection(TEMPLATES).update(id, {
    status: 'publicado',
    versao: novaVersao,
    publicado_por: uid,
    publicado_em: new Date().toISOString().slice(0, 19).replace('T', ' '),
    atualizado_por: uid,
  })

  // Snapshot da versão
  await pb.collection(VERSIONS).create({
    template_id: id,
    numero_versao: novaVersao,
    estrutura_layout: tpl.estrutura_layout || [],
    alterado_por: uid,
    motivo_alteracao: motivo || `Publicação v${novaVersao}`,
  })

  return mapTemplate(updated as unknown as RecordModel)
}

/** Arquiva um modelo. */
export async function archiveTemplate(id: string): Promise<ExamReportTemplate> {
  return updateTemplate(id, { status: 'arquivado' })
}

/** Duplica um modelo (cria cópia em rascunho). */
export async function duplicateTemplate(id: string): Promise<ExamReportTemplate> {
  const original = await getTemplate(id)
  return createTemplate({
    nome_modelo: `${original.nome_modelo} (cópia)`,
    tipo_exame: original.tipo_exame,
    descricao: original.descricao,
    orientacao: original.orientacao,
    largura_pagina: original.largura_pagina,
    altura_pagina: original.altura_pagina,
    margem_superior: original.margem_superior,
    margem_inferior: original.margem_inferior,
    margem_esquerda: original.margem_esquerda,
    margem_direita: original.margem_direita,
  }).then(async (copia) => {
    return updateTemplate(copia.id, {
      estrutura_layout: original.estrutura_layout,
      logo_url: original.logo_url,
      fonte_padrao: original.fonte_padrao,
      tamanho_fonte_padrao: original.tamanho_fonte_padrao,
      cor_primaria: original.cor_primaria,
      cor_secundaria: original.cor_secundaria,
    })
  })
}

/** Exclui um modelo. */
export async function deleteTemplate(id: string): Promise<void> {
  await pb.collection(TEMPLATES).delete(id)
}

/** Lista as versões publicadas de um modelo. */
export async function listVersions(templateId: string): Promise<ExamReportTemplateVersion[]> {
  const records = await pb.collection(VERSIONS).getFullList({
    filter: `template_id="${templateId}"`,
    sort: '-numero_versao',
  })
  return records.map((r) => mapVersion(r as unknown as RecordModel))
}

/** Restaura uma versão anterior (sobrescreve o layout do rascunho). */
export async function restoreVersion(
  templateId: string,
  versionId: string,
): Promise<ExamReportTemplate> {
  const versions = await listVersions(templateId)
  const v = versions.find((x) => x.id === versionId)
  if (!v) throw new Error('Versão não encontrada')
  return updateTemplate(templateId, {
    estrutura_layout: v.estrutura_layout,
    status: 'rascunho',
  })
}
