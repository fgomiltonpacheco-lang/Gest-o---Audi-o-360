import React from 'react'
import { FechamentoCaixa } from '@/types'
import { formatCurrency, formatDate } from '@/lib/formatters'

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
    <span style={{ width: '55%', color: '#64748b', fontWeight: 600 }}>{label}:</span>
    <span style={{ flex: 1, color: '#1e293b', fontWeight: 500 }}>{value || '—'}</span>
  </div>
)

export function FechamentoCaixaPrint({
  fechamento,
  responsavelNome,
}: {
  fechamento: FechamentoCaixa
  responsavelNome?: string
}) {
  const formas: { label: string; valor: number }[] = [
    { label: '💵 Dinheiro', valor: fechamento.totalDinheiro },
    { label: '💳 Débito', valor: fechamento.totalDebito },
    { label: '💳 Crédito', valor: fechamento.totalCredito },
    { label: '📱 PIX', valor: fechamento.totalPix },
    { label: '🏥 Convênio', valor: fechamento.totalConvenio },
    { label: '📄 Boleto', valor: fechamento.totalBoleto },
  ]

  return (
    <div style={{ color: '#1e293b' }}>
      {/* Subtítulo */}
      <div style={{ fontSize: '10pt', color: '#475569', marginBottom: '10px' }}>
        <strong>Fechamento de Caixa — {formatDate(fechamento.data)}</strong>
      </div>

      {/* Totais por forma de pagamento */}
      {sectionTitle('Totais por Forma de Pagamento')}
      <table>
        <thead>
          <tr>
            <th>Forma de Pagamento</th>
            <th style={{ textAlign: 'right' }}>Valor (R$)</th>
          </tr>
        </thead>
        <tbody>
          {formas.map((f) => (
            <tr key={f.label}>
              <td>{f.label}</td>
              <td style={{ textAlign: 'right' }}>{formatCurrency(f.valor)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Resumo financeiro */}
      {sectionTitle('Resumo Financeiro')}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px' }}>
        {row('Saldo Inicial', formatCurrency(fechamento.saldoInicial))}
        {row('Total de Vendas', formatCurrency(fechamento.totalVendas))}
        {row('Quantidade de Vendas', fechamento.quantidadeVendas)}
        {row('Total de Entradas', formatCurrency(fechamento.totalEntradas))}
        {row('Total de Saídas', formatCurrency(fechamento.totalSaidas))}
        {row('Saldo Final Informado', formatCurrency(fechamento.saldoFinal))}
        {row(
          'Diferença',
          <span
            style={{
              color: Math.abs(fechamento.diferenca) > 0.009 ? '#dc2626' : '#10b981',
              fontWeight: 700,
            }}
          >
            {formatCurrency(fechamento.diferenca)}
          </span>,
        )}
        {row('Status', fechamento.status === 'fechado' ? 'Fechado' : 'Aberto')}
      </div>

      {fechamento.observacao && (
        <>
          {sectionTitle('Observações')}
          <div
            style={{
              fontSize: '9pt',
              color: '#334155',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              padding: '8px 10px',
              whiteSpace: 'pre-wrap',
            }}
          >
            {fechamento.observacao}
          </div>
        </>
      )}

      {/* Linha de assinatura */}
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
          {responsavelNome || fechamento.usuarioNome || 'Responsável'}
        </div>
        <div style={{ fontSize: '8pt', color: '#475569', marginTop: '2px' }}>
          Assinatura do Responsável
        </div>
      </div>
    </div>
  )
}
