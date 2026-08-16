migrate(
  (app) => {
    const patientsColId = app.findCollectionByNameOrId('patients').id

    // ============================================================
    // consentimentos — registros de consentimento LGPD por paciente.
    // ============================================================
    const consentCol = new Collection({
      name: 'consentimentos',
      type: 'base',
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.role = "admin"',
      deleteRule: '@request.auth.role = "admin"',
      fields: [
        {
          name: 'paciente_id',
          type: 'relation',
          required: true,
          maxSelect: 1,
          collectionId: patientsColId,
          cascadeDelete: true,
        },
        {
          name: 'tipo_consentimento',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['dados_cadastrais', 'dados_saude', 'marketing', 'pesquisa'],
        },
        { name: 'versao_termo', type: 'text' },
        { name: 'data_aceitacao', type: 'date' },
        { name: 'ip_aceitacao', type: 'text' },
        { name: 'usuario_id', type: 'text' },
        { name: 'usuario_nome', type: 'text' },
        {
          name: 'status',
          type: 'select',
          required: false,
          maxSelect: 1,
          values: ['aceito', 'revogado', 'expirado'],
        },
        { name: 'data_revogacao', type: 'date' },
        { name: 'observacoes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_consentimentos_paciente ON consentimentos (paciente_id)',
        'CREATE INDEX idx_consentimentos_status ON consentimentos (status)',
      ],
    })
    app.save(consentCol)

    // ============================================================
    // policy_texts — singleton com os textos dos termos e da
    // política de privacidade configurados pelo administrador.
    // ============================================================
    const policyCol = new Collection({
      name: 'policy_texts',
      type: 'base',
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.role = "admin"',
      updateRule: '@request.auth.role = "admin"',
      deleteRule: '@request.auth.role = "admin"',
      fields: [
        { name: 'dados_cadastrais_texto', type: 'text' },
        { name: 'dados_cadastrais_versao', type: 'text' },
        { name: 'dados_saude_texto', type: 'text' },
        { name: 'dados_saude_versao', type: 'text' },
        { name: 'marketing_texto', type: 'text' },
        { name: 'marketing_versao', type: 'text' },
        { name: 'pesquisa_texto', type: 'text' },
        { name: 'pesquisa_versao', type: 'text' },
        { name: 'politica_privacidade', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(policyCol)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('consentimentos'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('policy_texts'))
    } catch (_) {}
  },
)
