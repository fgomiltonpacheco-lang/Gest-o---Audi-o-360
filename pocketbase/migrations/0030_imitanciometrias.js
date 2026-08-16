migrate(
  (app) => {
    const usersColId = '_pb_users_auth_'
    const patientsColId = app.findCollectionByNameOrId('patients').id
    const equipmentsColId = app.findCollectionByNameOrId('equipments').id

    // ============================================================
    // Collection: imitanciometrias
    // Exame de imitanciometria (timpanometria + reflexo acústico).
    // Os dados detalhados ficam nas subcoleções timpanometria_dados e
    // reflexo_acustico_dados, relacionadas via imitanciometria_id.
    // ============================================================
    const imitCol = new Collection({
      name: 'imitanciometrias',
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
        {
          name: 'medical_record_id',
          type: 'text',
          required: false,
        },
        { name: 'data_exame', type: 'date', required: false },
        {
          name: 'especialista_id',
          type: 'relation',
          required: false,
          collectionId: usersColId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'equipment_id',
          type: 'relation',
          required: false,
          collectionId: equipmentsColId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'observacoes', type: 'text', required: false },
        {
          name: 'status',
          type: 'select',
          required: false,
          maxSelect: 1,
          values: ['rascunho', 'finalizado'],
        },
        // Campos denormalizados para o laudo
        { name: 'tipo_curva_od', type: 'text', required: false },
        { name: 'tipo_curva_oe', type: 'text', required: false },
        { name: 'reflexos_status', type: 'text', required: false },
        { name: 'laudo', type: 'text', required: false },
        { name: 'referencias', type: 'text', required: false },
        // Identificação do paciente (denormalizada para impressão)
        { name: 'paciente_nome', type: 'text', required: false },
        { name: 'paciente_cpf', type: 'text', required: false },
        { name: 'paciente_nascimento', type: 'text', required: false },
        { name: 'paciente_idade', type: 'text', required: false },
        { name: 'paciente_sexo', type: 'text', required: false },
        { name: 'especialista_nome', type: 'text', required: false },
        { name: 'equipment_nome', type: 'text', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_imitanciometrias_paciente ON imitanciometrias (paciente_id)',
        'CREATE INDEX idx_imitanciometrias_data ON imitanciometrias (data_exame)',
        'CREATE INDEX idx_imitanciometrias_status ON imitanciometrias (status)',
      ],
    })
    app.save(imitCol)

    const imitColId = app.findCollectionByNameOrId('imitanciometrias').id

    // ============================================================
    // Collection: timpanometria_dados
    // Uma linha por orelha (OD / OE) por imitanciometria.
    // ============================================================
    const timpCol = new Collection({
      name: 'timpanometria_dados',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'imitanciometria_id',
          type: 'relation',
          required: false,
          collectionId: imitColId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'orelha',
          type: 'select',
          required: false,
          maxSelect: 1,
          values: ['OD', 'OE'],
        },
        { name: 'volume_meato', type: 'number', required: false },
        { name: 'complacencia', type: 'number', required: false },
        { name: 'pressao_maxima', type: 'number', required: false },
        {
          name: 'tipo_curva',
          type: 'select',
          required: false,
          maxSelect: 1,
          values: ['A', 'Ad', 'As', 'B', 'C', 'Ad/As'],
        },
        { name: 'pressao_pico', type: 'number', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_timpanometria_dados_imit ON timpanometria_dados (imitanciometria_id)',
        'CREATE INDEX idx_timpanometria_dados_orelha ON timpanometria_dados (orelha)',
      ],
    })
    app.save(timpCol)

    // ============================================================
    // Collection: reflexo_acustico_dados
    // Uma linha por (orelha + via) por imitanciometria.
    // ============================================================
    const reflexCol = new Collection({
      name: 'reflexo_acustico_dados',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'imitanciometria_id',
          type: 'relation',
          required: false,
          collectionId: imitColId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'orelha',
          type: 'select',
          required: false,
          maxSelect: 1,
          values: ['OD', 'OE'],
        },
        {
          name: 'via',
          type: 'select',
          required: false,
          maxSelect: 1,
          values: ['contra_lateral', 'ipsi_lateral'],
        },
        { name: 'frequencia_500', type: 'number', required: false },
        { name: 'frequencia_1000', type: 'number', required: false },
        { name: 'frequencia_2000', type: 'number', required: false },
        { name: 'frequencia_4000', type: 'number', required: false },
        {
          name: 'status',
          type: 'select',
          required: false,
          maxSelect: 1,
          values: ['presente', 'ausente', 'elevado'],
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_reflexo_acustico_dados_imit ON reflexo_acustico_dados (imitanciometria_id)',
        'CREATE INDEX idx_reflexo_acustico_dados_orelha ON reflexo_acustico_dados (orelha)',
      ],
    })
    app.save(reflexCol)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('reflexo_acustico_dados'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('timpanometria_dados'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('imitanciometrias'))
    } catch (_) {}
  },
)
