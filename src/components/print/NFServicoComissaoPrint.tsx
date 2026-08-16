import React from 'react'
import { FileText } from 'lucide-react'
import { formatCurrency } from '@/lib/formatters'
import type { VendaB2B, NFServicoComissao, EmpresaParceira, ClinicSettings } from '@/types'

const sectionTitle = (text: string) => (
  <h3
    style={{
      fontSize: '11pt',
      fontWeight: 700,
      color: '#1e3a8a',
      borderBottom: '1.5px solid #cbd5e1',
      paddingBottom: '3px',
      marginTop: '14px',
      marginBottom: '6px',
    }}
  >
    {text}
  </h3>
)

const row = (label: string, value: React.ReactNode) => (
  <div style={{ display: 'flex', padding: '2px 0', fontSize: '9pt' }}>
    <span style={{ width: '45%', color: '#64748b', fontWeight: 600 }}>{label}:</span>
    <span style={{ flex: 1, color: '#1e293b', fontWeight: 500 }}>{value || '—'}</span>
  </div>
)

export function NFServicoComissaoPrint({
  venda,
  nf,
  empresa,
  clinic,
}: {
  venda: VendaB2B
  nf: NFServicoComissao
  empresa?: EmpresaParceira
  clinic?: ClinicSettings | null
}) {
  // Dados do tomador vindos da própria NFS-e (auto-preenchidos no momento da
  // emissão), com fallback para o cadastro da empresa parceira.
  const tomador = {
    razao_social: nf.tomador_razao_social || empresa?.razao_social || venda.cliente_empresa_nome,
    cnpj: nf.tomador_cnpj || empresa?.cnpj || '',
    endereco: nf.tomador_endereco || empresa?.endereco || '',
    municipio: nf.tomador_municipio || empresa?.cidade || '',
    uf: nf.tomador_uf || empresa?.estado || '',
    cep: nf.tomador_cep || empresa?.cep || '',
    email: nf.tomador_email || empresa?.email || '',
    nome_fantasia: empresa?.nome_fantasia || '',
    inscricao_estadual: empresa?.inscricao_estadual || '',
    telefone: empresa?.telefone || '',
  }

  return (
    <div style={{ color: '#1e293b' }}>
      {/* Subtítulo */}
      <div
        style={{
          fontSize: '10pt',
          color: '#475569',
          marginBottom: '6px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <strong style={{ color: '#1e3a8a' }}>
          <FileText style={{ width: 12, height: 12, display: 'inline', marginRight: 4 }} />
          NFS-e de Comissão
        </strong>
        <span>NFS-e Nº {nf.numero_nfse}</span>
      </div>

      {/* Código de verificação + data */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '8pt',
          color: '#475569',
          marginBottom: '10px',
          padding: '4px 8px',
          background: '#f8fafc',
          borderRadius: '4px',
          border: '1px solid #e2e8f0',
        }}
      >
        <span>
          <strong>Código de Verificação:</strong> {nf.codigo_verificacao || '—'}
        </span>
        <span>
          <strong>Data de Emissão:</strong>{' '}
          {new Date(nf.data_emissao + 'T00:00:00').toLocaleDateString('pt-BR')}
        </span>
      </div>

      {/* PRESTADOR */}
      {sectionTitle('Dados do Prestador')}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px' }}>
        {row('Razão Social', clinic?.nome || 'Audição360 — Centro Auditivo')}
        {row('Endereço', clinic?.endereco || '—')}
        {row('Telefone', clinic?.telefone || '—')}
        {row('E-mail', clinic?.email || '—')}
      </div>

      {/* TOMADOR */}
      {sectionTitle('Dados do Tomador')}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px' }}>
        {row('Razão Social', tomador.razao_social)}
        {row('Nome Fantasia', tomador.nome_fantasia)}
        {row('CNPJ', tomador.cnpj)}
        {row('Inscrição Estadual', tomador.inscricao_estadual)}
        {row(
          'Endereço',
          `${tomador.endereco}${tomador.municipio ? ' — ' + tomador.municipio : ''}${tomador.uf ? '/' + tomador.uf : ''}`,
        )}
        {row('CEP', tomador.cep)}
        {row('Telefone', tomador.telefone)}
        {row('E-mail', tomador.email)}
      </div>

      {/* DISCRIMINAÇÃO */}
      {sectionTitle('Discriminação')}
      <div
        style={{
          fontSize: '9pt',
          color: '#334155',
          border: '1px solid #e2e8f0',
          borderRadius: '6px',
          padding: '8px 10px',
          whiteSpace: 'pre-wrap',
          marginBottom: '10px',
        }}
      >
        {nf.discriminacao_servico ||
          'Intermediação comercial - Comissão sobre venda de aparelhos auditivos'}
      </div>
      {row('Item da Lista de Serviço', nf.item_lista_servico || '10.01')}
      {row('Venda B2B relacionada', venda.numero_venda)}

      {/* CÁLCULO DO IMPOSTO */}
      {sectionTitle('Cálculo do ISS')}
      <table>
        <thead>
          <tr>
            <th>Descrição</th>
            <th style={{ textAlign: 'right' }}>Valor (R$)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Valor da Venda (apenas referência — não tributado)</td>
            <td style={{ textAlign: 'right' }}>{formatCurrency(venda.valor_total)}</td>
          </tr>
          <tr>
            <td>Base de Cálculo (Valor da Comissão)</td>
            <td style={{ textAlign: 'right' }}>{formatCurrency(nf.valor_base)}</td>
          </tr>
          <tr>
            <td>Alíquota ISS ({Number(nf.aliquota_iss || 0).toFixed(2)}%)</td>
            <td style={{ textAlign: 'right' }}>{formatCurrency(nf.valor_iss)}</td>
          </tr>
          <tr style={{ fontWeight: 700, background: '#f1f5f9' }}>
            <td>Valor Líquido</td>
            <td style={{ textAlign: 'right', color: '#1e3a8a' }}>
              {formatCurrency(nf.valor_liquido)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Assinatura */}
      <div style={{ marginTop: '40px', textAlign: 'center' }}>
        <div
          style={{
            borderTop: '1px solid #475569',
            width: '60%',
            margin: '0 auto',
            paddingTop: '4px',
            fontSize: '9pt',
            fontWeight: 700,
            color: '#1e293b',
          }}
        >
          {clinic?.nome || 'Audição360 — Centro Auditivo'}
        </div>
        <div style={{ fontSize: '8pt', color: '#475569', marginTop: '2px' }}>
          Assinatura do Prestador
        </div>
      </div>

      <div
        style={{
          marginTop: '14px',
          fontSize: '8pt',
          color: '#94a3b8',
          textAlign: 'center',
        }}
      >
        Documento gerado eletronicamente — Audição360 Gestão Clínica
      </div>
    </div>
  )
}
