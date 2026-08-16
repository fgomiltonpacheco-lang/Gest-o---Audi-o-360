migrate(
  (app) => {
    const usersColId = '_pb_users_auth_'
    const inventoryColId = app.findCollectionByNameOrId('inventory').id

    // ============================================================
    // Collection: empresas_parceiras
    // ============================================================
    const empresas = new Collection({
      name: 'empresas_parceiras',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'razao_social', type: 'text', required: true },
        { name: 'nome_fantasia', type: 'text' },
        { name: 'cnpj', type: 'text' },
        { name: 'inscricao_estadual', type: 'text' },
        { name: 'email', type: 'text' },
        { name: 'telefone', type: 'text' },
        { name: 'endereco', type: 'text' },
        { name: 'cidade', type: 'text' },
        { name: 'estado', type: 'text', min: 2, max: 2 },
        { name: 'cep', type: 'text' },
        {
          name: 'status',
          type: 'select',
          values: ['ativo', 'inativo'],
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_empresas_parceiras_status ON empresas_parceiras (status)',
        'CREATE INDEX idx_empresas_parceiras_cnpj ON empresas_parceiras (cnpj)',
      ],
    })
    app.save(empresas)

    const empresasColId = app.findCollectionByNameOrId('empresas_parceiras').id

    // ============================================================
    // Collection: vendas_b2b
    // ============================================================
    const vendas = new Collection({
      name: 'vendas_b2b',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'numero_venda', type: 'text' },
        {
          name: 'cliente_empresa_id',
          type: 'relation',
          collectionId: empresasColId,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'cliente_empresa_nome', type: 'text' },
        { name: 'data_venda', type: 'date' },
        { name: 'valor_total', type: 'number' },
        { name: 'percentual_comissao', type: 'number' },
        { name: 'valor_comissao', type: 'number' },
        { name: 'valor_repasse', type: 'number' },
        {
          name: 'status',
          type: 'select',
          values: ['pendente', 'aprovada', 'nf_emitida', 'concluida', 'cancelada'],
          maxSelect: 1,
        },
        {
          name: 'especialista_id',
          type: 'relation',
          collectionId: usersColId,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'especialista_nome', type: 'text' },
        { name: 'observacoes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_vendas_b2b_numero ON vendas_b2b (numero_venda)',
        'CREATE INDEX idx_vendas_b2b_data ON vendas_b2b (data_venda)',
        'CREATE INDEX idx_vendas_b2b_status ON vendas_b2b (status)',
        'CREATE INDEX idx_vendas_b2b_empresa ON vendas_b2b (cliente_empresa_id)',
      ],
    })
    app.save(vendas)

    const vendasColId = app.findCollectionByNameOrId('vendas_b2b').id

    // ============================================================
    // Collection: itens_venda_b2b
    // ============================================================
    const itens = new Collection({
      name: 'itens_venda_b2b',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'venda_b2b_id',
          type: 'relation',
          collectionId: vendasColId,
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          name: 'produto_id',
          type: 'relation',
          collectionId: inventoryColId,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'produto_nome', type: 'text' },
        { name: 'quantidade', type: 'number' },
        { name: 'valor_unitario', type: 'number' },
        { name: 'valor_subtotal', type: 'number' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_itens_venda_b2b_venda ON itens_venda_b2b (venda_b2b_id)',
        'CREATE INDEX idx_itens_venda_b2b_produto ON itens_venda_b2b (produto_id)',
      ],
    })
    app.save(itens)

    // ============================================================
    // Collection: nf_servico_comissao
    // ============================================================
    const nf = new Collection({
      name: 'nf_servico_comissao',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'venda_b2b_id',
          type: 'relation',
          collectionId: vendasColId,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'numero_nf', type: 'text' },
        { name: 'codigo_verificacao', type: 'text' },
        { name: 'data_emissao', type: 'date' },
        { name: 'valor_base', type: 'number' },
        { name: 'aliquota_iss', type: 'number' },
        { name: 'valor_iss', type: 'number' },
        { name: 'valor_liquido', type: 'number' },
        {
          name: 'discriminacao_servico',
          type: 'text',
        },
        { name: 'item_lista_servico', type: 'text' },
        {
          name: 'status',
          type: 'select',
          values: ['rascunho', 'emitida', 'cancelada'],
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_nf_servico_venda ON nf_servico_comissao (venda_b2b_id)',
        'CREATE INDEX idx_nf_servico_numero ON nf_servico_comissao (numero_nf)',
        'CREATE INDEX idx_nf_servico_status ON nf_servico_comissao (status)',
      ],
    })
    app.save(nf)
  },
  (app) => {
    try {
      const nf = app.findCollectionByNameOrId('nf_servico_comissao')
      app.delete(nf)
    } catch (_) {}
    try {
      const itens = app.findCollectionByNameOrId('itens_venda_b2b')
      app.delete(itens)
    } catch (_) {}
    try {
      const vendas = app.findCollectionByNameOrId('vendas_b2b')
      app.delete(vendas)
    } catch (_) {}
    try {
      const empresas = app.findCollectionByNameOrId('empresas_parceiras')
      app.delete(empresas)
    } catch (_) {}
  },
)
