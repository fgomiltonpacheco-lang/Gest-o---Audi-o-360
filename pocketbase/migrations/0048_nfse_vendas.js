// Migration 0048 — Coleção `nfse_emitidas`
// Registra as NFS-e emitidas para vendas PDV (e futuramente B2B),
// incluindo o XML de envio/retorno para auditoria. Reutiliza a config
// existente em `nfse_b2b_config`.
migrate(
  (app) => {
    let salesCol
    try {
      salesCol = app.findCollectionByNameOrId('sales')
    } catch (_) {
      salesCol = null
    }

    const fields = [
      // Relação opcional com a venda (PDV ou B2B)
      salesCol
        ? {
            name: 'sale',
            type: 'relation',
            required: false,
            maxSelect: 1,
            collectionId: salesCol.id,
            cascadeDelete: false,
          }
        : { name: 'sale', type: 'text' },
      { name: 'tipo_venda', type: 'select', values: ['PDV', 'B2B'] },
      { name: 'numero_rps', type: 'text' },
      { name: 'numero_lote', type: 'text' },
      { name: 'numero_nfse', type: 'text' },
      { name: 'codigo_verificacao', type: 'text' },
      {
        name: 'status',
        type: 'select',
        values: ['pendente', 'enviada', 'autorizada', 'cancelada', 'erro'],
      },
      { name: 'valor_servico', type: 'number' },
      { name: 'aliquota_iss', type: 'number' },
      { name: 'valor_iss', type: 'number' },
      { name: 'valor_liquido', type: 'number' },
      { name: 'discriminacao', type: 'text' },
      { name: 'tomador_nome', type: 'text' },
      { name: 'tomador_cpf_cnpj', type: 'text' },
      { name: 'xml_envio', type: 'text' },
      { name: 'xml_retorno', type: 'text' },
      { name: 'data_emissao', type: 'date' },
      { name: 'observacao', type: 'text' },
      { name: 'pdf_url', type: 'text' },
      { name: 'erro_mensagem', type: 'text' },
      { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
    ]

    const emitCol = new Collection({
      name: 'nfse_emitidas',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.role = 'admin'",
      updateRule: "@request.auth.role = 'admin'",
      deleteRule: "@request.auth.role = 'admin'",
      fields: fields,
    })
    app.save(emitCol)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('nfse_emitidas')
      app.delete(col)
    } catch (_) {
      // coleção não existe — nada a reverter
    }
  },
)
