migrate(
  (app) => {
    // ============================================================
    // nfse_config — configuração da NFS-e (singleton da clínica).
    // Armazena os dados do município/provedor, certificado A1 e
    // parâmetros de emissão de RPS/NFS-e (padrão ABRASF 2.04).
    // ============================================================
    const configCol = new Collection({
      name: 'nfse_config',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.role = 'admin'",
      updateRule: "@request.auth.role = 'admin'",
      deleteRule: "@request.auth.role = 'admin'",
      fields: [
        { name: 'municipio', type: 'text' },
        { name: 'codigo_municipio', type: 'text' },
        {
          name: 'provedor',
          type: 'select',
          required: false,
          values: ['ABRASF', 'GINFES', 'ISSDIGITAL', 'OUTRO'],
        },
        { name: 'url_api', type: 'text' },
        { name: 'certificado_pfx', type: 'file', maxSize: 5242880 },
        { name: 'senha_certificado', type: 'text' },
        { name: 'inscricao_municipal', type: 'text' },
        { name: 'serie_rps', type: 'text' },
        { name: 'aliquota_iss', type: 'number' },
        { name: 'codigo_servico', type: 'text' },
        {
          name: 'ambiente',
          type: 'select',
          required: false,
          values: ['homologacao', 'producao'],
        },
        { name: 'ativo', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(configCol)

    // ============================================================
    // nfse_emitidas — notas fiscais de serviço emitidas a partir
    // de vendas (sales). Guarda RPS, lote, XML de envio/retorno e
    // status do processo junto à prefeitura.
    // ============================================================
    const salesCol = app.findCollectionByNameOrId('sales')

    const emitCol = new Collection({
      name: 'nfse_emitidas',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.role = 'admin'",
      updateRule: "@request.auth.role = 'admin'",
      deleteRule: "@request.auth.role = 'admin'",
      fields: [
        {
          name: 'sale',
          type: 'relation',
          required: false,
          maxSelect: 1,
          collectionId: salesCol.id,
          cascadeDelete: false,
        },
        { name: 'numero_rps', type: 'text' },
        { name: 'numero_lote', type: 'text' },
        { name: 'numero_nfse', type: 'text' },
        { name: 'codigo_verificacao', type: 'text' },
        {
          name: 'status',
          type: 'select',
          required: false,
          values: ['pendente', 'enviada', 'autorizada', 'cancelada', 'erro'],
        },
        { name: 'xml_envio', type: 'text' },
        { name: 'xml_retorno', type: 'text' },
        { name: 'data_emissao', type: 'date' },
        { name: 'data_envio', type: 'date' },
        { name: 'observacao', type: 'text' },
        { name: 'alert_message', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(emitCol)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('nfse_emitidas'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('nfse_config'))
    } catch (_) {}
  },
)
