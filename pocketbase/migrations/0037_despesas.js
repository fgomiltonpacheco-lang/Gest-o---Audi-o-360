/// <reference path="../pb_data/pocketbase.d.ts" />
//
// 0037_despesas.js — Módulo de Despesas do Audição360.
//
// Cria a coleção `despesas` para registrar todas as despesas da clínica
// (aluguel, salários, fornecedores, impostos, marketing, etc.),
// integrada ao caixa (movimentacoes_caixa) e ao fluxo de caixa projetado.
//
// Cada despesa possui: descrição, valor, vencimento, pagamento (parcial/total),
// categoria, forma de pagamento, status (a_pagar/pago/vencido/cancelado),
// comprovante (upload de imagem/PDF) e observações. Exclusão não é permitida
// — apenas cancelamento com motivo (registrado na trilha de auditoria).
//
// Regras de acesso: apenas autenticados podem listar/ver; apenas admin pode
// criar/editar/cancelar. A exclusão é bloqueada via regra `delete = ""`.
migrate(
  (app) => {
    const usersColId = '_pb_users_auth_'

    // ============================================================
    // Collection: despesas
    // ============================================================
    const despesasCol = new Collection({
      name: 'despesas',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.role = 'admin'",
      updateRule: "@request.auth.role = 'admin'",
      // Exclusão não permitida — apenas cancelamento.
      deleteRule: '',
      fields: [
        { name: 'descricao', type: 'text', required: true },
        { name: 'valor', type: 'number', required: true },
        { name: 'data_vencimento', type: 'date', required: true },
        { name: 'data_pagamento', type: 'date' },
        {
          name: 'categoria',
          type: 'select',
          required: false,
          maxSelect: 1,
          values: [
            'aluguel',
            'salario',
            'fornecedor',
            'imposto',
            'marketing',
            'manutencao',
            'utilidades',
            'software',
            'comissao',
            'outros',
          ],
        },
        {
          name: 'forma_pagamento',
          type: 'select',
          required: false,
          maxSelect: 1,
          values: ['dinheiro', 'cartao', 'pix', 'transferencia', 'boleto', 'cheque'],
        },
        {
          name: 'status',
          type: 'select',
          required: false,
          maxSelect: 1,
          values: ['a_pagar', 'pago', 'vencido', 'cancelado'],
        },
        // Valor efetivamente pago (suporta pagamento parcial). Quando >= valor
        // total, o status passa a 'pago'; quando < total, permanece 'a_pagar'.
        { name: 'valor_pago', type: 'number' },
        // Upload do comprovante (imagem ou PDF).
        {
          name: 'comprovante',
          type: 'file',
          required: false,
          maxSelect: 1,
          maxSize: 5242880,
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'],
        },
        { name: 'observacoes', type: 'text' },
        // Motivo do cancelamento (obrigatório ao cancelar).
        { name: 'motivo_cancelamento', type: 'text' },
        // Usuário que registrou a despesa.
        {
          name: 'usuario_id',
          type: 'relation',
          required: false,
          collectionId: usersColId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        // Vínculo com a movimentação de caixa gerada ao pagar a despesa
        // (saída). Permite estornar a entrada correspondente ao cancelar.
        {
          name: 'movimentacao_caixa_id',
          type: 'text',
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_despesas_status ON despesas (status)',
        'CREATE INDEX idx_despesas_vencimento ON despesas (data_vencimento)',
        'CREATE INDEX idx_despesas_pagamento ON despesas (data_pagamento)',
        'CREATE INDEX idx_despesas_categoria ON despesas (categoria)',
        'CREATE INDEX idx_despesas_usuario ON despesas (usuario_id)',
      ],
    })
    app.save(despesasCol)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('despesas'))
    } catch (_) {}
  },
)
