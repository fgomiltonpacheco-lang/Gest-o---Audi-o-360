migrate(
  (app) => {
    // ============================================================
    // fechamentos_caixa — fechamentos diários de caixa.
    // Um registro por dia (status "aberto" enquanto o caixa do dia
    // não foi fechado; "fechado" após a conferência final).
    // ============================================================
    const usersCol = app.findCollectionByNameOrId('users')

    const fcCol = new Collection({
      name: 'fechamentos_caixa',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.role = 'admin'",
      fields: [
        { name: 'data', type: 'date', required: true },
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
          required: false,
          values: ['aberto', 'fechado'],
        },
        { name: 'observacao', type: 'text' },
        {
          name: 'usuario',
          type: 'relation',
          required: false,
          maxSelect: 1,
          collectionId: usersCol.id,
          cascadeDelete: false,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_fechamentos_data ON fechamentos_caixa (data)'],
    })
    app.save(fcCol)

    // ============================================================
    // movimentacoes_caixa — entradas/saídas manuais associadas a
    // um fechamento (fundo de caixa, pagamento de fornecedor, etc.).
    // ============================================================
    const salesCol = app.findCollectionByNameOrId('sales')

    const movCol = new Collection({
      name: 'movimentacoes_caixa',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.role = 'admin'",
      fields: [
        {
          name: 'fechamento',
          type: 'relation',
          required: false,
          maxSelect: 1,
          collectionId: fcCol.id,
          cascadeDelete: true,
        },
        {
          name: 'tipo',
          type: 'select',
          required: false,
          values: ['entrada', 'saida'],
        },
        { name: 'valor', type: 'number', required: true },
        { name: 'descricao', type: 'text' },
        {
          name: 'forma_pagamento',
          type: 'select',
          required: false,
          values: ['dinheiro', 'debito', 'credito', 'pix', 'convenio', 'boleto'],
        },
        { name: 'data', type: 'date' },
        {
          name: 'sale',
          type: 'relation',
          required: false,
          maxSelect: 1,
          collectionId: salesCol.id,
          cascadeDelete: false,
        },
        {
          name: 'usuario',
          type: 'relation',
          required: false,
          maxSelect: 1,
          collectionId: usersCol.id,
          cascadeDelete: false,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_mov_caixa_fech ON movimentacoes_caixa (fechamento)'],
    })
    app.save(movCol)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('movimentacoes_caixa'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('fechamentos_caixa'))
    } catch (_) {}
  },
)
