migrate(
  (app) => {
    const usersColId = '_pb_users_auth_'
    const salesColId = app.findCollectionByNameOrId('sales').id

    // ============================================================
    // Collection: fechamentos_caixa
    // ============================================================
    const fechamentos = new Collection({
      name: 'fechamentos_caixa',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'data', type: 'date' },
        { name: 'saldo_inicial', type: 'number' },
        { name: 'saldo_final', type: 'number' },
        { name: 'total_dinheiro', type: 'number' },
        { name: 'total_debito', type: 'number' },
        { name: 'total_credito', type: 'number' },
        { name: 'total_pix', type: 'number' },
        { name: 'total_convenio', type: 'number' },
        { name: 'total_boleto', type: 'number' },
        { name: 'total_entradas', type: 'number' },
        { name: 'total_saidas', type: 'number' },
        { name: 'total_vendas', type: 'number' },
        { name: 'quantidade_vendas', type: 'number' },
        { name: 'diferenca', type: 'number' },
        {
          name: 'status',
          type: 'select',
          values: ['aberto', 'fechado'],
          maxSelect: 1,
        },
        { name: 'observacao', type: 'text' },
        {
          name: 'usuario',
          type: 'relation',
          collectionId: usersColId,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_fechamentos_caixa_data ON fechamentos_caixa (data)',
        'CREATE INDEX idx_fechamentos_caixa_status ON fechamentos_caixa (status)',
      ],
    })
    app.save(fechamentos)

    const fechamentosColId = app.findCollectionByNameOrId('fechamentos_caixa').id

    // ============================================================
    // Collection: movimentacoes_caixa
    // ============================================================
    const movimentacoes = new Collection({
      name: 'movimentacoes_caixa',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'fechamento',
          type: 'relation',
          collectionId: fechamentosColId,
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          name: 'tipo',
          type: 'select',
          values: ['entrada', 'saida'],
          maxSelect: 1,
        },
        { name: 'valor', type: 'number' },
        { name: 'descricao', type: 'text' },
        {
          name: 'forma_pagamento',
          type: 'select',
          values: ['dinheiro', 'debito', 'credito', 'pix', 'convenio', 'boleto'],
          maxSelect: 1,
        },
        { name: 'data', type: 'date' },
        {
          name: 'sale',
          type: 'relation',
          collectionId: salesColId,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'usuario',
          type: 'relation',
          collectionId: usersColId,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_movimentacoes_caixa_fechamento ON movimentacoes_caixa (fechamento)',
        'CREATE INDEX idx_movimentacoes_caixa_data ON movimentacoes_caixa (data)',
      ],
    })
    app.save(movimentacoes)
  },
  (app) => {
    try {
      const mov = app.findCollectionByNameOrId('movimentacoes_caixa')
      app.delete(mov)
    } catch (_) {}
    try {
      const fec = app.findCollectionByNameOrId('fechamentos_caixa')
      app.delete(fec)
    } catch (_) {}
  },
)
