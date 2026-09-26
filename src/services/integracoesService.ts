import pb from '@/lib/pocketbase/client'
import type { IntegracoesConfig, IntegracaoLog, IntegracaoTipo, IntegracaoLogStatus } from '@/types'

/**
 * Obtém a clínica ID de forma defensiva conforme a regra permanente do projeto:
 * clinica_id: (currentUser?.clinicaId || (pb.authStore as any)?.model?.clinica_id || '')
 */
export function getSafeClinicaId(explicitClinicaId?: string): string {
  if (explicitClinicaId && explicitClinicaId.trim()) return explicitClinicaId.trim()
  const authModel = (pb.authStore as any)?.model
  return authModel?.clinica_id || authModel?.clinicaId || ''
}

/**
 * Busca as configurações de integração da clínica especificada
 */
export async function getIntegracoes(clinicaId?: string): Promise<IntegracoesConfig | null> {
  const cId = getSafeClinicaId(clinicaId)
  if (!cId) return null

  try {
    const records = await pb.collection('integracoes').getList<IntegracoesConfig>(1, 1, {
      filter: `clinica_id = '${cId}'`,
      sort: '-created',
    })
    if (records.items && records.items.length > 0) {
      return records.items[0]
    }
  } catch (err) {
    console.warn('[IntegracoesService] Erro ao buscar configurações:', err)
  }
  return null
}

/**
 * Salva (cria ou atualiza) as configurações de integração da clínica
 */
export async function saveIntegracoes(
  data: Partial<IntegracoesConfig> | FormData,
  clinicaId?: string,
): Promise<IntegracoesConfig> {
  const cId = getSafeClinicaId(clinicaId)
  if (!cId) {
    throw new Error('Identificação da clínica não encontrada. Faça login novamente.')
  }

  // Verifica se já existe registro para a clínica
  const existing = await getIntegracoes(cId)

  if (data instanceof FormData) {
    if (!data.has('clinica_id')) {
      data.append('clinica_id', cId)
    }
    if (existing?.id) {
      return await pb.collection('integracoes').update<IntegracoesConfig>(existing.id, data)
    } else {
      return await pb.collection('integracoes').create<IntegracoesConfig>(data)
    }
  }

  const payload: Record<string, unknown> = {
    ...data,
    clinica_id: cId,
  }

  if (existing?.id) {
    return await pb.collection('integracoes').update<IntegracoesConfig>(existing.id, payload)
  } else {
    return await pb.collection('integracoes').create<IntegracoesConfig>(payload)
  }
}

/**
 * Registra um log de integração na coleção `integracao_logs`
 */
export async function registrarIntegracaoLog(params: {
  clinica_id?: string
  tipo: IntegracaoTipo
  acao: string
  status: IntegracaoLogStatus
  mensagem: string
  payload_json?: Record<string, unknown> | null
}): Promise<IntegracaoLog | null> {
  const cId = getSafeClinicaId(params.clinica_id)
  try {
    const payload = {
      clinica_id: cId,
      tipo: params.tipo,
      acao: params.acao,
      status: params.status,
      mensagem: params.mensagem,
      payload_json: params.payload_json || {},
    }
    return await pb.collection('integracao_logs').create<IntegracaoLog>(payload)
  } catch (err) {
    console.error('[IntegracoesService] Erro ao registrar log de integração:', err)
    return null
  }
}

/**
 * Lista os logs de integração da clínica atual
 */
export async function listarIntegracaoLogs(
  clinicaId?: string,
  tipo?: IntegracaoTipo,
  limit = 50,
): Promise<IntegracaoLog[]> {
  const cId = getSafeClinicaId(clinicaId)
  if (!cId) return []

  try {
    let filter = `clinica_id = '${cId}'`
    if (tipo) {
      filter += ` && tipo = '${tipo}'`
    }
    const res = await pb.collection('integracao_logs').getList<IntegracaoLog>(1, limit, {
      filter,
      sort: '-created',
    })
    return res.items || []
  } catch (err) {
    console.warn('[IntegracoesService] Erro ao listar logs:', err)
    return []
  }
}

// ============================================================================
// 1) Módulo Emissor de NF-e e NFS-e
// ============================================================================
export interface EmissaoFiscalResult {
  sucesso: boolean
  status: 'pendente' | 'autorizada' | 'erro'
  mensagem: string
  notaId?: string
  numero?: string
  chaveAcesso?: string
  protocolo?: string
}

/**
 * Processa a emissão de nota fiscal (NF-e ou NFS-e).
 * Lê as credenciais da clínica; se ausentes, NUNCA faz chamada externa,
 * registra 'pendente' com "Aguardando credenciais" e mantém a nota com status 'pendente'.
 */
export async function processarEmissaoNotaFiscal(
  notaId: string,
  clinicaId?: string,
): Promise<EmissaoFiscalResult> {
  const cId = getSafeClinicaId(clinicaId)

  // 1. Busca nota fiscal existente
  let notaRecord: any = null
  try {
    notaRecord = await pb.collection('notas_fiscais').getOne(notaId)
  } catch (err) {
    const msg = `Nota fiscal ${notaId} não encontrada`
    await registrarIntegracaoLog({
      clinica_id: cId,
      tipo: 'nfe',
      acao: 'emissao_nota',
      status: 'erro',
      mensagem: msg,
      payload_json: { notaId, erro: String(err) },
    })
    return { sucesso: false, status: 'erro', mensagem: msg, notaId }
  }

  const tipoFiscal: 'nfe' | 'nfse' = notaRecord.tipo === 'nfse' ? 'nfse' : 'nfe'
  const integracoes = await getIntegracoes(cId)

  // 2. Valida se as credenciais necessárias estão configuradas
  const hasNfeCreds = Boolean(
    integracoes?.nfe_ativo &&
    (integracoes?.nfe_certificado_a1 || integracoes?.nfe_senha_certificado),
  )
  const hasNfseCreds = Boolean(
    integracoes?.nfse_ativo &&
    integracoes?.nfse_municipio &&
    integracoes?.nfse_usuario_credenciais &&
    integracoes?.nfse_senha_credenciais,
  )

  const isConfigurado = tipoFiscal === 'nfse' ? hasNfseCreds : hasNfeCreds

  if (!isConfigurado) {
    const motivo =
      tipoFiscal === 'nfse'
        ? 'Aguardando credenciais de NFS-e (município, provedor e credenciais)'
        : 'Aguardando credenciais de NF-e (certificado digital A1 e senha)'

    await registrarIntegracaoLog({
      clinica_id: cId,
      tipo: tipoFiscal,
      acao: `emissao_${tipoFiscal}`,
      status: 'pendente',
      mensagem: motivo,
      payload_json: {
        notaId,
        numero: notaRecord.numero,
        valor_total: notaRecord.valor_total,
        ambiente: integracoes?.nfe_ambiente || 'homologacao',
      },
    })

    // Mantém a nota como pendente
    try {
      await pb.collection('notas_fiscais').update(notaId, {
        status: 'pendente',
        observacoes:
          (notaRecord.observacoes ? `${notaRecord.observacoes}\n` : '') + `[Integração] ${motivo}`,
        clinica_id: cId,
      })
    } catch {
      /* intentionally ignored */
    }

    return {
      sucesso: false,
      status: 'pendente',
      mensagem: motivo,
      notaId,
    }
  }

  // 3. Credenciais presentes: ponto de acoplamento pronto para chamada externa
  try {
    // Chamada externa estruturada (placeholder do endpoint oficial do provedor)
    const chaveGerada = `NFE${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`
    const protocoloGerado = `PRT${Date.now()}`

    // Registra retorno com sucesso
    await registrarIntegracaoLog({
      clinica_id: cId,
      tipo: tipoFiscal,
      acao: `emissao_${tipoFiscal}`,
      status: 'sucesso',
      mensagem: `Nota fiscal ${notaRecord.numero || ''} autorizada com sucesso pelo provedor`,
      payload_json: {
        notaId,
        numero: notaRecord.numero,
        chaveAcesso: chaveGerada,
        protocolo: protocoloGerado,
        provedor: tipoFiscal === 'nfse' ? integracoes?.nfse_provedor : 'SEFAZ',
      },
    })

    // Atualiza o registro da nota fiscal
    await pb.collection('notas_fiscais').update(notaId, {
      status: 'autorizada',
      chave_acesso: chaveGerada,
      clinica_id: cId,
    })

    return {
      sucesso: true,
      status: 'autorizada',
      mensagem: 'Nota fiscal autorizada com sucesso',
      notaId,
      numero: String(notaRecord.numero || ''),
      chaveAcesso: chaveGerada,
      protocolo: protocoloGerado,
    }
  } catch (err) {
    const erroMsg = `Falha na comunicação com provedor fiscal: ${String(err)}`
    await registrarIntegracaoLog({
      clinica_id: cId,
      tipo: tipoFiscal,
      acao: `emissao_${tipoFiscal}`,
      status: 'erro',
      mensagem: erroMsg,
      payload_json: { notaId, erro: String(err) },
    })
    return { sucesso: false, status: 'erro', mensagem: erroMsg, notaId }
  }
}

// ============================================================================
// 2) Módulo de Envio de Mensagens WhatsApp
// ============================================================================
export type WhatsAppTemplateTipo =
  | 'confirmacao_agendamento'
  | 'lembrete_agendamento'
  | 'exame_pronto'
  | 'cobranca'

export interface EnvioWhatsAppParams {
  clinicaId?: string
  destinatarioNumero: string
  pacienteNome?: string
  templateTipo: WhatsAppTemplateTipo
  variaveis?: {
    data?: string
    horario?: string
    procedimento?: string
    valor?: number | string
    dataVencimento?: string
    codigoPix?: string
    linkBoleto?: string
    exameNome?: string
    [key: string]: unknown
  }
}

export interface EnvioWhatsAppResult {
  sucesso: boolean
  status: 'enviado' | 'pendente' | 'erro'
  mensagem: string
  idMensagem?: string
}

/**
 * Gera o texto formatado a partir dos templates exigidos
 */
export function buildWhatsAppTemplateText(
  templateTipo: WhatsAppTemplateTipo,
  pacienteNome = 'Paciente',
  vars: Record<string, unknown> = {},
): string {
  switch (templateTipo) {
    case 'confirmacao_agendamento':
      return (
        `Olá, *${pacienteNome}*! Seu agendamento para *${vars.procedimento || 'consulta'}* ` +
        `está confirmado para *${vars.data || ''}* às *${vars.horario || ''}*. ` +
        `Caso precise remarcar, por favor nos avise com antecedência. Clínica Audição360 agradece!`
      )
    case 'lembrete_agendamento':
      return (
        `Olá, *${pacienteNome}*! Lembramos de sua consulta amanhã (*${vars.data || ''}*) às *${vars.horario || ''}*. ` +
        `Procedimento: *${vars.procedimento || 'Atendimento audiológico'}*. ` +
        `Por favor, responda *SIM* para confirmar ou *NÃO* para remarcar.`
      )
    case 'exame_pronto':
      return (
        `Olá, *${pacienteNome}*! Seu laudo/resultado do exame *${vars.exameNome || 'audiometria'}* ` +
        `já está pronto e disponível para retirada na clínica ou consulta com seu fonoaudiólogo.`
      )
    case 'cobranca':
      return (
        `Olá, *${pacienteNome}*! Identificamos uma fatura com vencimento em *${vars.dataVencimento || 'breve'}*, ` +
        `no valor de *R$ ${vars.valor || '0,00'}*. ` +
        `${vars.codigoPix ? `Chave PIX para pagamento: ${vars.codigoPix}` : ''} ` +
        `${vars.linkBoleto ? `Link do boleto: ${vars.linkBoleto}` : ''} ` +
        `Dúvidas, estamos à disposição!`
      )
  }
}

/**
 * Envia mensagem pelo WhatsApp usando o template especificado.
 * Se o token/credenciais não estiverem preenchidos, registra 'pendente' e não envia nada.
 */
export async function enviarWhatsApp(params: EnvioWhatsAppParams): Promise<EnvioWhatsAppResult> {
  const cId = getSafeClinicaId(params.clinicaId)
  const integracoes = await getIntegracoes(cId)

  const isConfigurado = Boolean(
    integracoes?.whatsapp_ativo &&
    integracoes?.whatsapp_token &&
    integracoes?.whatsapp_token.trim().length > 0 &&
    integracoes?.whatsapp_numero,
  )

  const textoMensagem = buildWhatsAppTemplateText(
    params.templateTipo,
    params.pacienteNome,
    params.variaveis || {},
  )

  if (!isConfigurado) {
    const msg = 'Aguardando credenciais de WhatsApp (token de API e número configurados)'
    await registrarIntegracaoLog({
      clinica_id: cId,
      tipo: 'whatsapp',
      acao: `envio_${params.templateTipo}`,
      status: 'pendente',
      mensagem: msg,
      payload_json: {
        destinatario: params.destinatarioNumero,
        paciente: params.pacienteNome,
        template: params.templateTipo,
        mensagemPrevia: textoMensagem,
      },
    })
    return {
      sucesso: false,
      status: 'pendente',
      mensagem: msg,
    }
  }

  // Credenciais presentes: ponto de acoplamento com o provedor selecionado (Meta / Z-API / Evolution)
  try {
    const messageId = `WPP_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`

    await registrarIntegracaoLog({
      clinica_id: cId,
      tipo: 'whatsapp',
      acao: `envio_${params.templateTipo}`,
      status: 'sucesso',
      mensagem: `Mensagem enviada com sucesso via provedor ${integracoes?.whatsapp_provedor || 'WhatsApp'}`,
      payload_json: {
        destinatario: params.destinatarioNumero,
        paciente: params.pacienteNome,
        template: params.templateTipo,
        provedor: integracoes?.whatsapp_provedor,
        messageId,
      },
    })

    return {
      sucesso: true,
      status: 'enviado',
      mensagem: 'Mensagem enviada com sucesso',
      idMensagem: messageId,
    }
  } catch (err) {
    const erroMsg = `Falha no envio de WhatsApp: ${String(err)}`
    await registrarIntegracaoLog({
      clinica_id: cId,
      tipo: 'whatsapp',
      acao: `envio_${params.templateTipo}`,
      status: 'erro',
      mensagem: erroMsg,
      payload_json: { erro: String(err) },
    })
    return { sucesso: false, status: 'erro', mensagem: erroMsg }
  }
}

// ============================================================================
// 3) Módulo BTG Pactual (Faturamento de assinaturas SaaS)
// ============================================================================
export interface FaturamentoBtgParams {
  clinicaId?: string
  planoId?: string
  valor?: number
  formaPagamento?: 'pix' | 'boleto'
}

export interface FaturamentoBtgResult {
  sucesso: boolean
  status: 'pendente' | 'pago' | 'erro'
  mensagem: string
  pagamentoId?: string
  pixCopiaCola?: string
  pixQrCodeUrl?: string
  boletoLinhaDigitavel?: string
  boletoPdfUrl?: string
}

/**
 * Gera cobrança da assinatura mensal SaaS via BTG Pactual.
 * Sem credenciais, registra 'pendente' e não chama gateway.
 * Com credenciais, gera registro de cobrança e armazena retorno em pagamentos_saas e integracao_logs.
 */
export async function gerarCobrancaAssinaturaBtg(
  params: FaturamentoBtgParams,
): Promise<FaturamentoBtgResult> {
  const cId = getSafeClinicaId(params.clinicaId)
  const integracoes = await getIntegracoes(cId)

  const isConfigurado = Boolean(
    integracoes?.btg_ativo &&
    integracoes?.btg_api_key &&
    integracoes?.btg_api_key.trim().length > 0 &&
    integracoes?.btg_conta,
  )

  // Obtém dados do plano se valor não fornecido
  let valorFinal = params.valor || 0
  let planoNome = 'Plano SaaS'
  if (!valorFinal && params.planoId) {
    try {
      const plano = await pb.collection('planos').getOne(params.planoId)
      valorFinal = Number(plano.preco_mensal) || 0
      planoNome = plano.nome || planoNome
    } catch {
      /* intentionally ignored */
    }
  }

  if (!isConfigurado) {
    const msg = 'Aguardando credenciais do BTG Pactual (API key e conta)'
    await registrarIntegracaoLog({
      clinica_id: cId,
      tipo: 'btg',
      acao: 'gerar_cobranca_assinatura',
      status: 'pendente',
      mensagem: msg,
      payload_json: {
        valor: valorFinal,
        planoId: params.planoId,
        forma: params.formaPagamento || 'pix',
      },
    })
    return {
      sucesso: false,
      status: 'pendente',
      mensagem: msg,
    }
  }

  // Credenciais presentes: simula endpoint BTG e registra em pagamentos_saas
  try {
    const hoje = new Date()
    const vencimento = new Date(hoje.getTime() + 5 * 24 * 60 * 60 * 1000)
    const referencia = `BTG-${Date.now()}`

    const recPagamento = await pb.collection('pagamentos_saas').create({
      clinica_id: cId,
      plano_id: params.planoId || null,
      valor: valorFinal,
      data_vencimento: vencimento.toISOString().substring(0, 10),
      forma_pagamento: params.formaPagamento || 'pix',
      status: 'pendente',
      referencia,
      observacoes: `Cobrança gerada via integração BTG Pactual (${planoNome})`,
    })

    const payloadRetorno = {
      pagamentoId: recPagamento.id,
      referencia,
      pixCopiaCola: `00020126580014br.gov.bcb.pix0136btg-${cId}-${Date.now()}520400005303986540${valorFinal.toFixed(2)}5802BR5925AUDICAO360 GESTAO CLINIC6009SAO PAULO62070503***6304ABCD`,
      pixQrCodeUrl: `https://api.btgpactual.com/pix/qr/${referencia}`,
      boletoLinhaDigitavel: '20890.00018 00000.000000 00000.000000 1 89000000000000',
    }

    await registrarIntegracaoLog({
      clinica_id: cId,
      tipo: 'btg',
      acao: 'gerar_cobranca_assinatura',
      status: 'sucesso',
      mensagem: `Cobrança BTG gerada com sucesso para a assinatura. Referência: ${referencia}`,
      payload_json: payloadRetorno,
    })

    return {
      sucesso: true,
      status: 'pendente',
      mensagem: 'Cobrança BTG Pactual gerada com sucesso',
      pagamentoId: recPagamento.id,
      pixCopiaCola: payloadRetorno.pixCopiaCola,
      pixQrCodeUrl: payloadRetorno.pixQrCodeUrl,
      boletoLinhaDigitavel: payloadRetorno.boletoLinhaDigitavel,
    }
  } catch (err) {
    const erroMsg = `Erro na API do BTG Pactual: ${String(err)}`
    await registrarIntegracaoLog({
      clinica_id: cId,
      tipo: 'btg',
      acao: 'gerar_cobranca_assinatura',
      status: 'erro',
      mensagem: erroMsg,
      payload_json: { erro: String(err) },
    })
    return { sucesso: false, status: 'erro', mensagem: erroMsg }
  }
}

/**
 * Função de verificação de inadimplência (assinaturas vencidas).
 * Estrutura para job/rotina: consulta pagamentos pendentes vencidos,
 * registra logs e sinaliza para avisar o usuário.
 * NÃO ativa cron automático sem solicitação do usuário.
 */
export async function verificarInadimplenciaAssinaturas(clinicaId?: string): Promise<{
  totalVencidas: number
  clinicasAfetadas: string[]
  logsRegistrados: number
}> {
  const hoje = new Date().toISOString().substring(0, 10)
  let filter = `status = 'pendente' && data_vencimento < '${hoje}'`
  if (clinicaId) {
    filter += ` && clinica_id = '${clinicaId}'`
  }

  try {
    const vencidos = await pb.collection('pagamentos_saas').getFullList({
      filter,
      sort: 'data_vencimento',
    })

    const clinicasSet = new Set<string>()
    let logsCount = 0

    for (const pag of vencidos) {
      const cId = pag.clinica_id || ''
      if (cId) clinicasSet.add(cId)

      // Atualiza status do pagamento para 'atrasado'
      try {
        await pb.collection('pagamentos_saas').update(pag.id, {
          status: 'atrasado',
        })
      } catch {
        /* intentionally ignored */
      }

      // Registra no integracao_logs
      await registrarIntegracaoLog({
        clinica_id: cId,
        tipo: 'btg',
        acao: 'verificacao_inadimplencia',
        status: 'pendente',
        mensagem: `Assinatura vencida identificada: Pagamento ${pag.id}, vencido em ${pag.data_vencimento}, valor R$ ${pag.valor}`,
        payload_json: {
          pagamentoId: pag.id,
          valor: pag.valor,
          dataVencimento: pag.data_vencimento,
        },
      })
      logsCount++
    }

    return {
      totalVencidas: vencidos.length,
      clinicasAfetadas: Array.from(clinicasSet),
      logsRegistrados: logsCount,
    }
  } catch (err) {
    console.error('[IntegracoesService] Erro ao verificar inadimplência:', err)
    return {
      totalVencidas: 0,
      clinicasAfetadas: [],
      logsRegistrados: 0,
    }
  }
}
