migrate(
  (app) => {
    // 1. Coleção 'integracoes' (configurações das integrações por clínica)
    const integracoesCol = new Collection({
      name: 'integracoes',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (clinica_id = @request.auth.clinica_id || @request.auth.is_super_admin = true)",
      viewRule:
        "@request.auth.id != '' && (clinica_id = @request.auth.clinica_id || @request.auth.is_super_admin = true)",
      createRule:
        "@request.auth.id != '' && (clinica_id = @request.auth.clinica_id || @request.auth.is_super_admin = true)",
      updateRule:
        "@request.auth.id != '' && (clinica_id = @request.auth.clinica_id || @request.auth.is_super_admin = true)",
      deleteRule:
        "@request.auth.id != '' && (clinica_id = @request.auth.clinica_id || @request.auth.is_super_admin = true)",
      fields: [
        { name: 'clinica_id', type: 'text', required: true },
        // NF-e
        { name: 'nfe_ativo', type: 'bool' },
        { name: 'nfe_certificado_a1', type: 'file', maxSelect: 1, maxSize: 10485760 },
        { name: 'nfe_senha_certificado', type: 'text' },
        { name: 'nfe_ambiente', type: 'select', values: ['homologacao', 'producao'], maxSelect: 1 },
        // NFS-e
        { name: 'nfse_ativo', type: 'bool' },
        { name: 'nfse_municipio', type: 'text' },
        {
          name: 'nfse_provedor',
          type: 'select',
          values: ['betha', 'simpliss', 'ginfes', 'padrao_abrasf', 'outro'],
          maxSelect: 1,
        },
        { name: 'nfse_usuario_credenciais', type: 'text' },
        { name: 'nfse_senha_credenciais', type: 'text' },
        // WhatsApp
        { name: 'whatsapp_ativo', type: 'bool' },
        {
          name: 'whatsapp_provedor',
          type: 'select',
          values: ['meta', 'zapi', 'evolution', 'outro'],
          maxSelect: 1,
        },
        { name: 'whatsapp_token', type: 'text' },
        { name: 'whatsapp_numero', type: 'text' },
        // BTG Pactual
        { name: 'btg_ativo', type: 'bool' },
        { name: 'btg_api_key', type: 'text' },
        { name: 'btg_certificado', type: 'text' },
        { name: 'btg_conta', type: 'text' },
        // Autodate obrigatório em base collections
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_integracoes_clinica_id ON integracoes (clinica_id)'],
    })
    app.save(integracoesCol)

    // 2. Coleção 'integracao_logs' (registro auditável de retornos de integrações)
    const integracaoLogsCol = new Collection({
      name: 'integracao_logs',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (clinica_id = @request.auth.clinica_id || @request.auth.is_super_admin = true)",
      viewRule:
        "@request.auth.id != '' && (clinica_id = @request.auth.clinica_id || @request.auth.is_super_admin = true)",
      createRule:
        "@request.auth.id != '' && (clinica_id = @request.auth.clinica_id || @request.auth.is_super_admin = true)",
      updateRule:
        "@request.auth.id != '' && (clinica_id = @request.auth.clinica_id || @request.auth.is_super_admin = true)",
      deleteRule:
        "@request.auth.id != '' && (clinica_id = @request.auth.clinica_id || @request.auth.is_super_admin = true)",
      fields: [
        { name: 'clinica_id', type: 'text', required: true },
        {
          name: 'tipo',
          type: 'select',
          values: ['nfe', 'nfse', 'whatsapp', 'btg'],
          maxSelect: 1,
          required: true,
        },
        { name: 'acao', type: 'text', required: true },
        {
          name: 'status',
          type: 'select',
          values: ['sucesso', 'erro', 'pendente'],
          maxSelect: 1,
          required: true,
        },
        { name: 'mensagem', type: 'text' },
        { name: 'payload_json', type: 'json' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_integracao_logs_clinica_id ON integracao_logs (clinica_id)',
        'CREATE INDEX idx_integracao_logs_tipo ON integracao_logs (tipo)',
        'CREATE INDEX idx_integracao_logs_status ON integracao_logs (status)',
      ],
    })
    app.save(integracaoLogsCol)
  },
  (app) => {
    try {
      const logs = app.findCollectionByNameOrId('integracao_logs')
      app.delete(logs)
    } catch (_) {}
    try {
      const col = app.findCollectionByNameOrId('integracoes')
      app.delete(col)
    } catch (_) {}
  },
)
