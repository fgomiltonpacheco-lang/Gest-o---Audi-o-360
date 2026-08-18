migrate(
  (app) => {
    const usersColId = '_pb_users_auth_'
    const patientsColId = app.findCollectionByNameOrId('patients').id

    // ============================================================
    // Collection: testes_aparelho
    // Registro de teste com aparelho auditivo (ganho funcional,
    // acoplador / REM). A grade de ganho por frequência (Sem
    // Aparelho / Com Aparelho) é armazenada como JSON.
    // ============================================================
    const col = new Collection({
      name: 'testes_aparelho',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'paciente_id',
          type: 'relation',
          required: false,
          collectionId: patientsColId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'paciente_nome', type: 'text', required: false },
        { name: 'data_teste', type: 'date', required: false },
        {
          name: 'orelha',
          type: 'select',
          required: false,
          maxSelect: 1,
          values: ['OD', 'OE', 'Ambas'],
        },
        {
          name: 'tipo_teste',
          type: 'select',
          required: false,
          maxSelect: 1,
          values: ['ganho_funcional', 'acoplador', 'REM'],
        },
        { name: 'fabricante_aparelho', type: 'text', required: false },
        { name: 'modelo_aparelho', type: 'text', required: false },
        // Grade de ganho: array de { frequencia, sem_aparelho, com_aparelho }
        { name: 'ganho', type: 'json', required: false },
        { name: 'observacoes', type: 'text', required: false },
        {
          name: 'especialista_id',
          type: 'relation',
          required: false,
          collectionId: usersColId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'especialista_nome', type: 'text', required: false },
        {
          name: 'status',
          type: 'select',
          required: false,
          maxSelect: 1,
          values: ['rascunho', 'finalizado'],
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_testes_aparelho_paciente ON testes_aparelho (paciente_id)',
        'CREATE INDEX idx_testes_aparelho_data ON testes_aparelho (data_teste)',
        'CREATE INDEX idx_testes_aparelho_status ON testes_aparelho (status)',
      ],
    })
    app.save(col)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('testes_aparelho'))
    } catch (_) {}
  },
)
