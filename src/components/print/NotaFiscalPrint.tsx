import React from 'react'
import { formatCurrency, formatDate, maskCPF } from '@/lib/formatters'
import type { Patient, ClinicSettings, NotaFiscal, NotaFiscalItem } from '@/types'
import logoImg from '@/assets/audicao-360-logo-para-papel-timbrado-da364.png'

interface NotaFiscalPrintProps {
  notaFiscal: NotaFiscal
  patient?: Patient | null
  clinicSettings?: ClinicSettings | null
}

export function NotaFiscalPrint({ notaFiscal, patient, clinicSettings }: NotaFiscalPrintProps) {
  // Logo
  const logoSrc = clinicSettings?.logo_url || logoImg
  const clinicName = clinicSettings?.nome || clinicSettings?.nome_clinica || 'Audição360'
  const clinicCnpj = clinicSettings?.cnpj || ''
  const clinicAddress =
    clinicSettings?.endereco?.trim() ||
    'R. Sadoc Correa, 373 - St. Central, Araguaína - TO, 77803-060'
  const clinicPhone = clinicSettings?.telefone?.trim() || '(63) 3421-2611'
  const clinicEmail = clinicSettings?.email?.trim() || 'contato@audicao360.com.br'

  // Paciente / Destinatário
  const patientName = patient?.name || 'Cliente / Paciente não informado'
  const patientCpf = patient?.cpf ? maskCPF(patient.cpf) : 'Não informado'
  const patientAddress = patient
    ? [
        patient.street ? `${patient.street}, ${patient.number || 'S/N'}` : '',
        patient.complement,
        patient.neighborhood,
        patient.city && patient.state ? `${patient.city}/${patient.state}` : patient.city,
        patient.cep,
      ]
        .filter(Boolean)
        .join(' - ')
    : ''
  const patientPhone = patient?.mobile || patient?.phone || ''
  const patientEmail = patient?.email || ''

  // Chave de acesso formatada em blocos de 4 dígitos para estética DANFE
  const rawChave =
    notaFiscal.chave_acesso?.replace(/\D/g, '') ||
    // Se não tiver chave de acesso prévia, formata uma chave fictícia baseada no número/data
    `35${(notaFiscal.data_emissao || '').replace(/-/g, '').slice(2, 6)}00000000000155001000${String(
      notaFiscal.numero || 1,
    ).padStart(9, '0')}100000001`
  const formattedChave = rawChave.replace(/(\d{4})(?=\d)/g, '$1 ')

  // Processar itens
  let itemsList: NotaFiscalItem[] = []
  if (Array.isArray(notaFiscal.itens)) {
    itemsList = notaFiscal.itens
  } else if (typeof notaFiscal.itens === 'string') {
    try {
      itemsList = JSON.parse(notaFiscal.itens)
    } catch {
      itemsList = []
    }
  }

  const tipoLabel =
    notaFiscal.tipo === 'nfe'
      ? 'NF-e (Documento Auxiliar da Nota Fiscal Eletrônica)'
      : notaFiscal.tipo === 'nfse'
        ? 'NFS-e (Documento Auxiliar da Nota Fiscal de Serviços)'
        : 'DANFE / Documento Auxiliar da Nota Fiscal Eletrônica'

  return (
    <div
      className="danfe-print-document"
      style={{
        fontFamily: 'Arial, Helvetica, sans-serif',
        color: '#0f172a',
        fontSize: '8pt',
        lineHeight: 1.3,
        maxWidth: '190mm',
        margin: '0 auto',
        padding: '2mm',
      }}
    >
      {/* ========================================================= */}
      {/* 1. CABEÇALHO SUPERIOR / IDENTIFICAÇÃO DO DANFE */}
      {/* ========================================================= */}
      <div
        style={{
          border: '1.5px solid #1e3a8a',
          borderRadius: '4px',
          overflow: 'hidden',
          marginBottom: '8px',
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1.3fr' }}>
          {/* Coluna 1: Emitente / Logo */}
          <div
            style={{
              padding: '8px',
              borderRight: '1px solid #cbd5e1',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              textAlign: 'center',
            }}
          >
            <img
              src={logoSrc}
              alt="Audição360 Logo"
              style={{
                maxHeight: '48px',
                maxWidth: '180px',
                objectFit: 'contain',
                marginBottom: '4px',
              }}
            />
            <div style={{ fontSize: '10pt', fontWeight: 800, color: '#1e3a8a' }}>{clinicName}</div>
            <div style={{ fontSize: '7.5pt', color: '#475569', marginTop: '2px' }}>
              Centro Auditivo Especializado
            </div>
          </div>

          {/* Coluna 2: DANFE Box */}
          <div
            style={{
              padding: '8px',
              borderRight: '1px solid #cbd5e1',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              background: '#f8fafc',
            }}
          >
            <div
              style={{
                fontSize: '12pt',
                fontWeight: 900,
                color: '#1e3a8a',
                letterSpacing: '0.05em',
              }}
            >
              DANFE
            </div>
            <div style={{ fontSize: '6.5pt', color: '#475569', marginBottom: '4px' }}>
              {tipoLabel}
            </div>
            <div
              style={{
                display: 'inline-flex',
                justifyContent: 'center',
                gap: '8px',
                fontSize: '7.5pt',
                margin: '2px 0',
              }}
            >
              <span>
                <strong>0</strong> - Entrada
              </span>
              <span>
                <strong>1</strong> - <strong>Saída</strong> [ <strong>1</strong> ]
              </span>
            </div>
            <div style={{ fontSize: '8pt', fontWeight: 700, marginTop: '2px' }}>
              Nº {String(notaFiscal.numero).padStart(9, '0')}
            </div>
            <div style={{ fontSize: '7.5pt', color: '#334155' }}>
              SÉRIE: {notaFiscal.serie || '1'} • FOLHA 1/1
            </div>
          </div>

          {/* Coluna 3: Código de Barras / Chave de Acesso */}
          <div
            style={{
              padding: '8px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              textAlign: 'center',
            }}
          >
            {/* Simulação de código de barras estilizado */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1.5px',
                height: '32px',
                width: '100%',
                maxWidth: '210px',
                background: '#ffffff',
                padding: '2px 0',
                marginBottom: '4px',
              }}
            >
              {[
                3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 1, 4, 2, 1, 3, 2, 4, 1, 2, 3, 1, 4, 2, 1, 3, 1,
                2, 4, 1, 3, 2, 4, 1, 3, 2, 1, 4, 2,
              ].map((w, i) => (
                <div
                  key={i}
                  style={{
                    width: `${w}px`,
                    height: '100%',
                    backgroundColor: i % 2 === 0 ? '#0f172a' : '#ffffff',
                  }}
                />
              ))}
            </div>
            <div
              style={{
                fontSize: '6.5pt',
                fontWeight: 700,
                color: '#64748b',
                textTransform: 'uppercase',
              }}
            >
              Chave de Acesso
            </div>
            <div
              style={{
                fontSize: '7pt',
                fontFamily: 'monospace',
                fontWeight: 700,
                color: '#1e3a8a',
                letterSpacing: '0.04em',
                wordBreak: 'break-all',
              }}
            >
              {formattedChave}
            </div>
            <div style={{ fontSize: '6pt', color: '#64748b', marginTop: '2px' }}>
              Consulta de autenticidade no portal nacional da NF-e
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. BLOCO DO EMITENTE */}
      {/* ========================================================= */}
      <div
        style={{
          border: '1.5px solid #1e3a8a',
          borderRadius: '4px',
          overflow: 'hidden',
          marginBottom: '8px',
        }}
      >
        <div
          style={{
            background: '#1e3a8a',
            color: '#ffffff',
            padding: '3px 8px',
            fontSize: '7.5pt',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Identificação do Emitente
        </div>
        <div style={{ padding: '6px 8px', background: '#ffffff' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px' }}>
            <div>
              <div style={{ fontSize: '9pt', fontWeight: 700, color: '#1e3a8a' }}>{clinicName}</div>
              <div style={{ fontSize: '7.5pt', color: '#334155' }}>
                <strong>Endereço:</strong> {clinicAddress}
              </div>
              <div style={{ fontSize: '7.5pt', color: '#334155' }}>
                <strong>Telefone:</strong> {clinicPhone} &nbsp;•&nbsp; <strong>E-mail:</strong>{' '}
                {clinicEmail}
              </div>
            </div>
            <div style={{ fontSize: '7.5pt', color: '#334155' }}>
              <div>
                <strong>CNPJ:</strong> {clinicCnpj || 'Não cadastrado'}
              </div>
              <div>
                <strong>Inscrição Estadual:</strong> ISENTO
              </div>
              <div>
                <strong>Inscrição Municipal:</strong> {clinicCnpj ? 'EMITENTE HABILITADO' : '—'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. BLOCO DO DESTINATÁRIO / TOMADOR */}
      {/* ========================================================= */}
      <div
        style={{
          border: '1.5px solid #1e3a8a',
          borderRadius: '4px',
          overflow: 'hidden',
          marginBottom: '8px',
        }}
      >
        <div
          style={{
            background: '#1e3a8a',
            color: '#ffffff',
            padding: '3px 8px',
            fontSize: '7.5pt',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Destinatário / Remetente
        </div>
        <div style={{ padding: '6px 8px', background: '#ffffff' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr',
              gap: '6px 12px',
              borderBottom: '1px solid #f1f5f9',
              paddingBottom: '4px',
              marginBottom: '4px',
            }}
          >
            <div>
              <span style={{ fontSize: '6.5pt', color: '#64748b', display: 'block' }}>
                NOME / RAZÃO SOCIAL
              </span>
              <strong style={{ fontSize: '8.5pt', color: '#0f172a' }}>{patientName}</strong>
            </div>
            <div>
              <span style={{ fontSize: '6.5pt', color: '#64748b', display: 'block' }}>
                CNPJ / CPF
              </span>
              <span style={{ fontSize: '8pt', fontWeight: 600 }}>{patientCpf}</span>
            </div>
            <div>
              <span style={{ fontSize: '6.5pt', color: '#64748b', display: 'block' }}>
                DATA DA EMISSÃO
              </span>
              <span style={{ fontSize: '8pt', fontWeight: 600 }}>
                {formatDate(notaFiscal.data_emissao)}
              </span>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2.5fr 1fr 1fr',
              gap: '6px 12px',
            }}
          >
            <div>
              <span style={{ fontSize: '6.5pt', color: '#64748b', display: 'block' }}>
                ENDEREÇO
              </span>
              <span style={{ fontSize: '7.5pt', color: '#334155' }}>
                {patientAddress || 'Não informado'}
              </span>
            </div>
            <div>
              <span style={{ fontSize: '6.5pt', color: '#64748b', display: 'block' }}>
                TELEFONE
              </span>
              <span style={{ fontSize: '7.5pt', color: '#334155' }}>
                {patientPhone || 'Não informado'}
              </span>
            </div>
            <div>
              <span style={{ fontSize: '6.5pt', color: '#64748b', display: 'block' }}>E-MAIL</span>
              <span style={{ fontSize: '7.5pt', color: '#334155' }}>{patientEmail || '—'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 4. DADOS DOS PRODUTOS / SERVIÇOS (TABELA DE ITENS) */}
      {/* ========================================================= */}
      <div
        style={{
          border: '1.5px solid #1e3a8a',
          borderRadius: '4px',
          overflow: 'hidden',
          marginBottom: '8px',
        }}
      >
        <div
          style={{
            background: '#1e3a8a',
            color: '#ffffff',
            padding: '3px 8px',
            fontSize: '7.5pt',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>Dados dos Produtos e Serviços</span>
          <span style={{ fontSize: '6.5pt', fontWeight: 500 }}>
            {itemsList.length} item(ns) registrado(s)
          </span>
        </div>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '7.5pt',
            background: '#ffffff',
          }}
        >
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
              <th
                style={{
                  padding: '4px 6px',
                  textAlign: 'center',
                  width: '35px',
                  fontWeight: 700,
                  color: '#1e3a8a',
                }}
              >
                CÓD
              </th>
              <th
                style={{
                  padding: '4px 6px',
                  textAlign: 'left',
                  fontWeight: 700,
                  color: '#1e3a8a',
                }}
              >
                DESCRIÇÃO DO PRODUTO / SERVIÇO
              </th>
              <th
                style={{
                  padding: '4px 6px',
                  textAlign: 'center',
                  width: '90px',
                  fontWeight: 700,
                  color: '#1e3a8a',
                }}
              >
                NCM / CNAE
              </th>
              <th
                style={{
                  padding: '4px 6px',
                  textAlign: 'center',
                  width: '55px',
                  fontWeight: 700,
                  color: '#1e3a8a',
                }}
              >
                CFOP
              </th>
              <th
                style={{
                  padding: '4px 6px',
                  textAlign: 'center',
                  width: '45px',
                  fontWeight: 700,
                  color: '#1e3a8a',
                }}
              >
                QTD
              </th>
              <th
                style={{
                  padding: '4px 6px',
                  textAlign: 'right',
                  width: '75px',
                  fontWeight: 700,
                  color: '#1e3a8a',
                }}
              >
                V. UNIT (R$)
              </th>
              <th
                style={{
                  padding: '4px 6px',
                  textAlign: 'right',
                  width: '85px',
                  fontWeight: 700,
                  color: '#1e3a8a',
                }}
              >
                V. TOTAL (R$)
              </th>
            </tr>
          </thead>
          <tbody>
            {itemsList.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  style={{
                    textAlign: 'center',
                    padding: '12px',
                    color: '#94a3b8',
                    fontStyle: 'italic',
                  }}
                >
                  Nenhum item discriminado na Nota Fiscal.
                </td>
              </tr>
            ) : (
              itemsList.map((item, idx) => {
                const cod = item.codigo || String(idx + 1).padStart(3, '0')
                const ncmCnae =
                  item.tipo === 'servico'
                    ? item.cnae || '8650-0/00'
                    : item.ncm || (item.cnae ? item.cnae : '—')
                const cfop = item.tipo === 'servico' ? '—' : item.cfop || '5102'
                const qtd = Number(item.quantidade) || 1
                const vUnit = Number(item.valor_unitario) || 0
                const vTotal = item.valor_total != null ? Number(item.valor_total) : qtd * vUnit

                return (
                  <tr
                    key={item.id || idx}
                    style={{
                      borderBottom: '1px solid #e2e8f0',
                      backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fcfcfd',
                    }}
                  >
                    <td
                      style={{
                        padding: '4px 6px',
                        textAlign: 'center',
                        fontFamily: 'monospace',
                        color: '#64748b',
                      }}
                    >
                      {cod}
                    </td>
                    <td style={{ padding: '4px 6px' }}>
                      <strong style={{ color: '#0f172a' }}>{item.nome}</strong>
                      {item.tipo && (
                        <span
                          style={{
                            marginLeft: '6px',
                            fontSize: '6.5pt',
                            padding: '1px 4px',
                            borderRadius: '3px',
                            backgroundColor: item.tipo === 'servico' ? '#e0e7ff' : '#dcfce7',
                            color: item.tipo === 'servico' ? '#3730a3' : '#166534',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                          }}
                        >
                          {item.tipo}
                        </span>
                      )}
                    </td>
                    <td
                      style={{
                        padding: '4px 6px',
                        textAlign: 'center',
                        fontFamily: 'monospace',
                        color: '#334155',
                      }}
                    >
                      {ncmCnae}
                    </td>
                    <td
                      style={{
                        padding: '4px 6px',
                        textAlign: 'center',
                        fontFamily: 'monospace',
                        color: '#334155',
                      }}
                    >
                      {cfop}
                    </td>
                    <td
                      style={{
                        padding: '4px 6px',
                        textAlign: 'center',
                        fontWeight: 600,
                      }}
                    >
                      {qtd}
                    </td>
                    <td style={{ padding: '4px 6px', textAlign: 'right' }}>
                      {formatCurrency(vUnit)}
                    </td>
                    <td
                      style={{
                        padding: '4px 6px',
                        textAlign: 'right',
                        fontWeight: 700,
                        color: '#1e3a8a',
                      }}
                    >
                      {formatCurrency(vTotal)}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ========================================================= */}
      {/* 5. CÁLCULO DO IMPOSTO / TOTAIS */}
      {/* ========================================================= */}
      <div
        style={{
          border: '1.5px solid #1e3a8a',
          borderRadius: '4px',
          overflow: 'hidden',
          marginBottom: '8px',
        }}
      >
        <div
          style={{
            background: '#1e3a8a',
            color: '#ffffff',
            padding: '3px 8px',
            fontSize: '7.5pt',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Cálculo dos Totais e Impostos
        </div>
        <div style={{ padding: '6px 8px', background: '#ffffff' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: '6px',
              textAlign: 'right',
            }}
          >
            <div
              style={{
                border: '1px solid #e2e8f0',
                padding: '4px 6px',
                borderRadius: '3px',
                background: '#f8fafc',
              }}
            >
              <span
                style={{
                  fontSize: '6pt',
                  color: '#64748b',
                  display: 'block',
                  textAlign: 'left',
                  textTransform: 'uppercase',
                }}
              >
                Base Cálculo ICMS
              </span>
              <strong style={{ fontSize: '8pt', color: '#334155' }}>R$ 0,00</strong>
            </div>

            <div
              style={{
                border: '1px solid #e2e8f0',
                padding: '4px 6px',
                borderRadius: '3px',
                background: '#f8fafc',
              }}
            >
              <span
                style={{
                  fontSize: '6pt',
                  color: '#64748b',
                  display: 'block',
                  textAlign: 'left',
                  textTransform: 'uppercase',
                }}
              >
                Valor do ICMS
              </span>
              <strong style={{ fontSize: '8pt', color: '#334155' }}>R$ 0,00</strong>
            </div>

            <div
              style={{
                border: '1px solid #e2e8f0',
                padding: '4px 6px',
                borderRadius: '3px',
                background: '#f8fafc',
              }}
            >
              <span
                style={{
                  fontSize: '6pt',
                  color: '#64748b',
                  display: 'block',
                  textAlign: 'left',
                  textTransform: 'uppercase',
                }}
              >
                Valor do Frete
              </span>
              <strong style={{ fontSize: '8pt', color: '#334155' }}>R$ 0,00</strong>
            </div>

            <div
              style={{
                border: '1px solid #e2e8f0',
                padding: '4px 6px',
                borderRadius: '3px',
                background: '#f8fafc',
              }}
            >
              <span
                style={{
                  fontSize: '6pt',
                  color: '#64748b',
                  display: 'block',
                  textAlign: 'left',
                  textTransform: 'uppercase',
                }}
              >
                Desconto
              </span>
              <strong style={{ fontSize: '8pt', color: '#334155' }}>R$ 0,00</strong>
            </div>

            <div
              style={{
                border: '1.5px solid #1e3a8a',
                padding: '4px 6px',
                borderRadius: '3px',
                background: '#eff6ff',
              }}
            >
              <span
                style={{
                  fontSize: '6pt',
                  color: '#1e3a8a',
                  display: 'block',
                  textAlign: 'left',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                }}
              >
                Valor Total da Nota
              </span>
              <strong style={{ fontSize: '10pt', color: '#1e3a8a', fontWeight: 800 }}>
                {formatCurrency(notaFiscal.valor_total)}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 6. DADOS ADICIONAIS / OBSERVAÇÕES */}
      {/* ========================================================= */}
      <div
        style={{
          border: '1.5px solid #1e3a8a',
          borderRadius: '4px',
          overflow: 'hidden',
          marginBottom: '12px',
        }}
      >
        <div
          style={{
            background: '#1e3a8a',
            color: '#ffffff',
            padding: '3px 8px',
            fontSize: '7.5pt',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Dados Adicionais / Informações Complementares
        </div>
        <div
          style={{
            padding: '6px 8px',
            background: '#ffffff',
            minHeight: '42px',
            fontSize: '7.5pt',
            color: '#334155',
            lineHeight: 1.4,
            whiteSpace: 'pre-wrap',
          }}
        >
          {notaFiscal.observacoes?.trim() ||
            'Documento emitido por ME ou EPP optante pelo Simples Nacional. Não gera direito a crédito fiscal de IPI ou ICMS. Serviços e aparelhos auditivos comercializados por Audição360 Gestão Clínica.'}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 7. CANHOTO / COMPROVANTE DE ENTREGA E RECEBIMENTO */}
      {/* ========================================================= */}
      <div
        style={{
          border: '1px dashed #94a3b8',
          borderRadius: '4px',
          padding: '6px 8px',
          background: '#f8fafc',
          marginBottom: '10px',
        }}
      >
        <div
          style={{
            fontSize: '6.5pt',
            color: '#64748b',
            marginBottom: '4px',
            textAlign: 'center',
            textTransform: 'uppercase',
          }}
        >
          Recebemos de {clinicName} os produtos e/ou serviços constantes da Nota Fiscal indicada
          abaixo.
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '120px 1.5fr 1fr',
            gap: '8px',
            alignItems: 'flex-end',
          }}
        >
          <div>
            <span style={{ fontSize: '6pt', color: '#64748b', display: 'block' }}>
              DATA DO RECEBIMENTO
            </span>
            <div
              style={{
                borderBottom: '1px solid #475569',
                height: '16px',
                fontSize: '7pt',
                textAlign: 'center',
              }}
            >
              ___/___/______
            </div>
          </div>
          <div>
            <span style={{ fontSize: '6pt', color: '#64748b', display: 'block' }}>
              IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR
            </span>
            <div style={{ borderBottom: '1px solid #475569', height: '16px' }} />
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '6pt', color: '#64748b', display: 'block' }}>NF-e Nº</span>
            <strong style={{ fontSize: '8pt', color: '#1e3a8a' }}>
              {String(notaFiscal.numero).padStart(9, '0')} • SÉRIE {notaFiscal.serie || '1'}
            </strong>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 8. RODAPÉ INSTITUCIONAL */}
      {/* ========================================================= */}
      <div
        style={{
          textAlign: 'center',
          fontSize: '7pt',
          color: '#64748b',
          borderTop: '1px solid #e2e8f0',
          paddingTop: '4px',
        }}
      >
        <strong>{clinicName}</strong> &nbsp;•&nbsp; {clinicAddress} &nbsp;•&nbsp; Tel: {clinicPhone}{' '}
        &nbsp;•&nbsp; E-mail: {clinicEmail}
      </div>
    </div>
  )
}
