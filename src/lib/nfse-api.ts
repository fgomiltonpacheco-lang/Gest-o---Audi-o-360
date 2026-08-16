// ============================================================
// Camada de abstração para a API de NFS-e do município (ABRASF)
// ============================================================
// Como o provedor exato (Betha, Nota Blu, SimplISS, Ginfes, etc.)
// varia por município, este módulo implementa um adapter genérico
// baseado no padrão ABRASF (padrão nacional de NFS-e). Cada provedor
// expõe endpoints REST distintos, mas o payload XML/JSON segue o
// leiaute ABRASF. Aqui centralizamos a montagem do payload, o envio
// HTTP (fetch) e o tratamento padronizado de erros/timeout.
//
// Funções expostas:
//   - emitirNfse(config, dados): Promise<NfseResponse>
//   - consultarNfse(config, numeroNfse): Promise<NfseResponse>
//   - cancelarNfse(config, numeroNfse, motivo): Promise<NfseResponse>
//   - baixarPdfNfse(config, numeroNfse): Promise<Blob>
// ============================================================

/** Credenciais/configuração da API da prefeitura (vindas dos Settings). */
export interface NfseApiConfig {
  baseUrl: string
  usuario: string
  senha: string
  /** Ambiente: homologação ou produção. */
  ambiente?: 'homologacao' | 'producao'
  /** Provedor da prefeitura (Betha, Nota Blu, SimplISS, Ginfes...). */
  provedor?: string
  /** Código IBGE do município prestador. */
  codigoMunicipio?: string
}

/** Dados do prestador (empresa emissora — Audição360). */
export interface NfsePrestador {
  cnpj: string
  inscricaoMunicipal: string
  razaoSocial?: string
  municipio?: string
  uf?: string
}

/** Dados do tomador (empresa parceira compradora). */
export interface NfseTomador {
  cnpj: string
  razaoSocial: string
  endereco: string
  municipio: string
  uf: string
  cep: string
  email: string
}

/** Dados do serviço prestado (comissão). */
export interface NfseServico {
  /** Valor base = valor_comissao (nunca valor_total). */
  valorBase: number
  /** Alíquota de ISS (%). */
  aliquotaIss: number
  /** Valor do ISS calculado sobre a comissão. */
  valorIss: number
  /** Valor líquido (comissão - ISS). */
  valorLiquido: number
  /** Item da lista de serviço (ABRASF). */
  itemListaServico: string
  /** Texto de discriminação do serviço. */
  discriminacao: string
}

/** Conjunto completo de dados para emitir uma NFS-e. */
export interface NfseDados {
  prestador: NfsePrestador
  tomador: NfseTomador
  servico: NfseServico
  /** Número da venda B2B vinculada (referência). */
  numeroVendaB2B: string
}

/** Resposta padronizada das operações de NFS-e. */
export interface NfseResponse {
  sucesso: boolean
  numeroNfse?: string
  codigoVerificacao?: string
  pdfUrl?: string
  erro?: string
}

// ------------------------------------------------------------
// Helpers internos
// ------------------------------------------------------------

/** Normaliza a URL base (remove barra final). */
function normalizeBaseUrl(url: string): string {
  return (url || '').trim().replace(/\/+$/, '')
}

/** Monta o cabeçalho de autenticação básica (usuário:senha). */
function authHeaders(config: NfseApiConfig): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
  // Autenticação: Basic Auth (usuário/token) — padrão mais comum entre
  // provedores ABRASF. O token_api é usado como senha.
  if (config.usuario && config.senha) {
    const cred = btoa(`${config.usuario}:${config.senha}`)
    headers['Authorization'] = `Basic ${cred}`
  }
  return headers
}

/**
 * Monta o payload ABRASF (JSON) para emissão da NFS-e.
 * O leiaute segue o padrão nacional (tcLoteRps / tcInfRps), simplificado
 * para o cenário de comissão B2B. Provedores específicos podem requerer
 * adaptações pontuais, mas a estrutura-base é esta.
 */
function montarPayloadAbrASF(config: NfseApiConfig, dados: NfseDados) {
  const ambiente = config.ambiente || 'homologacao'
  const dataEmissao = new Date().toISOString()
  return {
    LoteRps: {
      '@xmlns': 'http://www.abrasf.org.br/nfse.xsd',
      NumeroLote: String(Date.now()),
      Cnpj: dados.prestador.cnpj.replace(/\D/g, ''),
      InscricaoMunicipal: dados.prestador.inscricaoMunicipal,
      QuantidadeRps: 1,
      ListaRps: {
        Rps: {
          InfRps: {
            Id: `RPS${dados.numeroVendaB2B}`,
            IdentificacaoRps: {
              Numero: String(dados.numeroVendaB2B),
              Serie: 'A360',
              Tipo: 1, // 1 = RPS
            },
            DataEmissao: dataEmissao,
            NaturezaOperacao: 1, // 1 = Tributação no município
            RegimeEspecialTributacao: 6, // 6 = Sociedade de Profissionais (padrão)
            OptanteSimplesNacional: 2, // 2 = Não
            IncentivadorCultural: 2, // 2 = Não
            Status: 1, // 1 = Normal
            Servico: {
              Valores: {
                ValorServicos: Number(dados.servico.valorBase.toFixed(2)),
                IssRetido: 2, // 2 = Não retido
                BaseCalculo: Number(dados.servico.valorBase.toFixed(2)),
                Aliquota: Number(dados.servico.aliquotaIss.toFixed(4)),
                ValorLiquidoNfse: Number(dados.servico.valorLiquido.toFixed(2)),
                ValorIss: Number(dados.servico.valorIss.toFixed(2)),
              },
              ItemListaServico: dados.servico.itemListaServico,
              Discriminacao: dados.servico.discriminacao,
              CodigoMunicipio: config.codigoMunicipio || '',
            },
            Prestador: {
              Cnpj: dados.prestador.cnpj.replace(/\D/g, ''),
              InscricaoMunicipal: dados.prestador.inscricaoMunicipal,
            },
            Tomador: {
              IdentificacaoTomador: {
                CpfCnpj: {
                  Cnpj: dados.tomador.cnpj.replace(/\D/g, ''),
                },
                InscricaoMunicipal: '',
              },
              RazaoSocial: dados.tomador.razaoSocial,
              Endereco: {
                Endereco: dados.tomador.endereco,
                CodigoMunicipio: '',
                Municipio: dados.tomador.municipio,
                Uf: dados.tomador.uf,
                Cep: dados.tomador.cep.replace(/\D/g, ''),
              },
              Contato: {
                Email: dados.tomador.email,
              },
            },
          },
        },
      },
    },
    ambiente,
    provedor: config.provedor || 'ABRASF',
  }
}

/**
 * Executa um fetch com timeout (30s). Lança erro padronizado em caso
 * de timeout ou falha de rede.
 */
async function fetchComTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = 30000,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const resp = await fetch(url, { ...options, signal: controller.signal })
    return resp
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('Tempo limite excedido (30s) ao contatar a API da prefeitura.')
    }
    throw new Error(`Erro de rede ao contatar a API da prefeitura: ${err?.message || err}`)
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Tenta extrair número/código/pdf de uma resposta JSON ABRASF.
 * Provedores variam o formato, então buscamos em vários caminhos comuns.
 */
function extrairResultadoAbrASF(json: any): {
  numeroNfse?: string
  codigoVerificacao?: string
  pdfUrl?: string
} {
  const out: { numeroNfse?: string; codigoVerificacao?: string; pdfUrl?: string } = {}
  if (!json) return out
  // Caminhos comuns em respostas ABRASF
  const nf = json.Nfse || json.CompNfse || json.nfse || json
  const inf = nf.InfNfse || nf.infNfse || nf
  out.numeroNfse =
    inf.Numero || inf.numero || inf.NumeroNfse || nf.NumeroNfse || nf.numeroNfse || undefined
  out.codigoVerificacao =
    inf.CodigoVerificacao || inf.codigoVerificacao || nf.CodigoVerificacao || undefined
  out.pdfUrl =
    inf.LinkNfse ||
    inf.linkNfse ||
    nf.LinkNfse ||
    nf.linkNfse ||
    inf.PdfUrl ||
    nf.PdfUrl ||
    json.pdfUrl ||
    json.link ||
    undefined
  return out
}

/** Extrai mensagem de erro de uma resposta JSON de rejeição. */
function extrairErroJson(json: any): string | undefined {
  if (!json) return undefined
  // Lista de mensagens (padrão ABRASF)
  const lista = json.ListaMensagemRetorno || json.listaMensagemRetorno || json.Mensagens
  if (Array.isArray(lista?.MensagemRetorno) && lista.MensagemRetorno.length > 0) {
    const msgs = lista.MensagemRetorno.map(
      (m: any) => m.Mensagem || m.mensagem || m.Codigo || '',
    ).filter(Boolean)
    if (msgs.length) return msgs.join('; ')
  }
  if (Array.isArray(lista) && lista.length > 0) {
    const msgs = lista.map((m: any) => m.Mensagem || m.mensagem || m.Codigo || '').filter(Boolean)
    if (msgs.length) return msgs.join('; ')
  }
  if (typeof json.mensagem === 'string') return json.mensagem
  if (typeof json.message === 'string') return json.message
  if (typeof json.erro === 'string') return json.erro
  return undefined
}

// ------------------------------------------------------------
// API pública
// ------------------------------------------------------------

/**
 * Emite uma NFS-e na prefeitura via API ABRASF.
 * Retorna o número, código de verificação e URL do PDF quando sucesso.
 */
export async function emitirNfse(config: NfseApiConfig, dados: NfseDados): Promise<NfseResponse> {
  if (!config.baseUrl) {
    return {
      sucesso: false,
      erro: 'API da prefeitura não configurada. Defina a URL base nas Configurações.',
    }
  }
  const base = normalizeBaseUrl(config.baseUrl)
  const url = `${base}/nfse/emissao`
  const payload = montarPayloadAbrASF(config, dados)

  try {
    const resp = await fetchComTimeout(url, {
      method: 'POST',
      headers: authHeaders(config),
      body: JSON.stringify(payload),
    })
    const text = await resp.text()
    let json: any = null
    try {
      json = text ? JSON.parse(text) : null
    } catch (_) {
      // resposta não-JSON
    }

    if (!resp.ok) {
      const erroMsg =
        extrairErroJson(json) ||
        `Rejeição da prefeitura (HTTP ${resp.status}). ${text.slice(0, 200)}`
      return { sucesso: false, erro: erroMsg }
    }

    const res = extrairResultadoAbrASF(json)
    if (!res.numeroNfse) {
      // Alguns provedores retornam sucesso sem número (processamento assíncrono)
      const erroAsync = extrairErroJson(json)
      return {
        sucesso: false,
        erro:
          erroAsync || 'Resposta da prefeitura sem número de NFS-e (processamento assíncrono?).',
      }
    }
    return { sucesso: true, ...res }
  } catch (err: any) {
    return { sucesso: false, erro: err?.message || 'Erro desconhecido ao emitir NFS-e.' }
  }
}

/**
 * Consulta o status/resultado de uma NFS-e já enviada.
 */
export async function consultarNfse(
  config: NfseApiConfig,
  numeroNfse: string,
): Promise<NfseResponse> {
  if (!config.baseUrl) {
    return {
      sucesso: false,
      erro: 'API da prefeitura não configurada. Defina a URL base nas Configurações.',
    }
  }
  if (!numeroNfse) {
    return { sucesso: false, erro: 'Número da NFS-e não informado.' }
  }
  const base = normalizeBaseUrl(config.baseUrl)
  const url = `${base}/nfse/consulta/${encodeURIComponent(numeroNfse)}`

  try {
    const resp = await fetchComTimeout(url, {
      method: 'GET',
      headers: authHeaders(config),
    })
    const text = await resp.text()
    let json: any = null
    try {
      json = text ? JSON.parse(text) : null
    } catch (_) {
      /* ignore */
    }

    if (!resp.ok) {
      return {
        sucesso: false,
        erro:
          extrairErroJson(json) ||
          `Erro ao consultar NFS-e (HTTP ${resp.status}). ${text.slice(0, 200)}`,
      }
    }
    const res = extrairResultadoAbrASF(json)
    return { sucesso: true, ...res }
  } catch (err: any) {
    return { sucesso: false, erro: err?.message || 'Erro desconhecido ao consultar NFS-e.' }
  }
}

/**
 * Cancela uma NFS-e na prefeitura. Exige motivo obrigatório.
 */
export async function cancelarNfse(
  config: NfseApiConfig,
  numeroNfse: string,
  motivo: string,
): Promise<NfseResponse> {
  if (!config.baseUrl) {
    return {
      sucesso: false,
      erro: 'API da prefeitura não configurada. Defina a URL base nas Configurações.',
    }
  }
  if (!numeroNfse) {
    return { sucesso: false, erro: 'Número da NFS-e não informado.' }
  }
  if (!motivo || !motivo.trim()) {
    return { sucesso: false, erro: 'Motivo do cancelamento é obrigatório.' }
  }
  const base = normalizeBaseUrl(config.baseUrl)
  const url = `${base}/nfse/cancelamento`
  const body = {
    NumeroNfse: numeroNfse,
    Cnpj: '',
    InscricaoMunicipal: '',
    Motivo: motivo.trim(),
  }

  try {
    const resp = await fetchComTimeout(url, {
      method: 'POST',
      headers: authHeaders(config),
      body: JSON.stringify(body),
    })
    const text = await resp.text()
    let json: any = null
    try {
      json = text ? JSON.parse(text) : null
    } catch (_) {
      /* ignore */
    }

    if (!resp.ok) {
      return {
        sucesso: false,
        erro:
          extrairErroJson(json) ||
          `Erro ao cancelar NFS-e (HTTP ${resp.status}). ${text.slice(0, 200)}`,
      }
    }
    return { sucesso: true, numeroNfse }
  } catch (err: any) {
    return { sucesso: false, erro: err?.message || 'Erro desconhecido ao cancelar NFS-e.' }
  }
}

/**
 * Baixa o PDF da NFS-e gerado pela prefeitura.
 */
export async function baixarPdfNfse(config: NfseApiConfig, numeroNfse: string): Promise<Blob> {
  if (!config.baseUrl) {
    throw new Error('API da prefeitura não configurada. Defina a URL base nas Configurações.')
  }
  if (!numeroNfse) {
    throw new Error('Número da NFS-e não informado.')
  }
  const base = normalizeBaseUrl(config.baseUrl)
  const url = `${base}/nfse/pdf/${encodeURIComponent(numeroNfse)}`

  const resp = await fetchComTimeout(url, {
    method: 'GET',
    headers: { ...authHeaders(config), Accept: 'application/pdf' },
  })
  if (!resp.ok) {
    let detalhe = ''
    try {
      const txt = await resp.text()
      detalhe = txt ? txt.slice(0, 200) : ''
    } catch (_) {
      /* ignore */
    }
    throw new Error(`Erro ao baixar PDF da NFS-e (HTTP ${resp.status}). ${detalhe}`)
  }
  return resp.blob()
}

/**
 * Indica se a API da prefeitura está configurada (URL base preenchida).
 */
export function isApiConfigurada(config: NfseApiConfig | null | undefined): boolean {
  return !!config && !!config.baseUrl && config.baseUrl.trim().length > 0
}
