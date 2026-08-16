migrate(
  (app) => {
    const usersColId = '_pb_users_auth_'
    const patientsColId = app.findCollectionByNameOrId('patients').id
    const empresasColId = app.findCollectionByNameOrId('empresas_parceiras').id
    let vendasB2BColId = ''
    try {
      vendasB2BColId = app.findCollectionByNameOrId('vendas_b2b').id
    } catch (_) {
      vendasB2BColId = ''
    }
    let salesColId = ''
    try {
      salesColId = app.findCollectionByNameOrId('sales').id
    } catch (_) {
      salesColId = ''
    }

    // ============================================================
    // Collection: contas_receber
    // Contas a receber de vendas a prazo (Convênio, Boleto,
    // Parcelado, Promissória), originadas no PDV ou em vendas B2B
    // (repasse de comissão). Suporta recebimentos parciais e
    // renegociação (a conta original fica "renegociado" e uma nova
    // conta é criada com os novos termos).
    // ============================================================
    const contasCol = new Collection({
      name: 'contas_receber',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        // Origem da conta (venda PDV ou venda B2B).
        { name: 'venda_id', type: 'text' },
        {
          name: 'venda_origem',
          type: 'select',
          required: false,
          maxSelect: 1,
          values: ['pdv', 'b2b'],
        },
        {
          name: 'paciente_id',
          type: 'relation',
          required: false,
          collectionId: patientsColId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'empresa_parceira_id',
          type: 'relation',
          required: false,
          collectionId: empresasColId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'cliente_nome', type: 'text' },
        { name: 'cliente_telefone', type: 'text' },
        { name: 'descricao', type: 'text' },
        { name: 'valor_original', type: 'number' },
        { name: 'valor_recebido', type: 'number' },
        { name: 'valor_restante', type: 'number' },
        {
          name: 'forma_pagamento',
          type: 'select',
          required: false,
          maxSelect: 1,
          values: ['convênio', 'boleto', 'parcelado', 'promissória'],
        },
        { name: 'numero_parcelas', type: 'number' },
        { name: 'parcela_atual', type: 'number' },
        { name: 'data_venda', type: 'date' },
        { name: 'data_vencimento', type: 'date' },
        { name: 'data_recebimento', type: 'date' },
        {
          name: 'status',
          type: 'select',
          required: false,
          maxSelect: 1,
          values: [
            'a_receber',
            'recebido_parcial',
            'recebido_total',
            'vencido',
            'renegociado',
            'cancelado',
          ],
        },
        { name: 'observacoes', type: 'text' },
        // Vínculo com a conta original (quando esta é fruto de renegociação).
        { name: 'conta_origem_id', type: 'text' },
        { name: 'motivo_renegociacao', type: 'text' },
        { name: 'motivo_cancelamento', type: 'text' },
        // Usuário que registrou/criou a conta.
        {
          name: 'usuario_id',
          type: 'relation',
          required: false,
          collectionId: usersColId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_contas_receber_status ON contas_receber (status)',
        'CREATE INDEX idx_contas_receber_vencimento ON contas_receber (data_vencimento)',
        'CREATE INDEX idx_contas_receber_venda ON contas_receber (venda_id)',
        'CREATE INDEX idx_contas_receber_paciente ON contas_receber (paciente_id)',
        'CREATE INDEX idx_contas_receber_empresa ON contas_receber (empresa_parceira_id)',
        'CREATE INDEX idx_contas_receber_origem ON contas_receber (conta_origem_id)',
      ],
    })
    app.save(contasCol)

    const contasColId = app.findCollectionByNameOrId('contas_receber').id

    // ============================================================
    // Collection: recebimentos
    // Cada recebimento (parcial ou total) registrado contra uma
    // conta a receber. Uma conta pode ter múltiplos recebimentos.
    // ============================================================
    const recCol = new Collection({
      name: 'recebimentos',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'conta_receber_id',
          type: 'relation',
          required: true,
          collectionId: contasColId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'valor', type: 'number' },
        { name: 'data_recebimento', type: 'date' },
        {
          name: 'forma_recebimento',
          type: 'select',
          required: false,
          maxSelect: 1,
          values: ['dinheiro', 'cartao', 'pix', 'transferencia', 'cheque'],
        },
        { name: 'observacoes', type: 'text' },
        {
          name: 'usuario_id',
          type: 'relation',
          required: false,
          collectionId: usersColId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'usuario_nome', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_recebimentos_conta ON recebimentos (conta_receber_id)',
        'CREATE INDEX idx_recebimentos_data ON recebimentos (data_recebimento)',
      ],
    })
    app.save(recCol)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('recebimentos'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('contas_receber'))
    } catch (_) {}
  },
)
