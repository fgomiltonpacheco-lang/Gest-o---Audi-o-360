migrate(
  (app) => {
    const AUTH = "@request.auth.id != ''"

    // ============================================================
    // procedures
    // ============================================================
    app.save(
      new Collection({
        name: 'procedures',
        type: 'base',
        listRule: AUTH,
        viewRule: AUTH,
        createRule: AUTH,
        updateRule: AUTH,
        deleteRule: AUTH,
        fields: [
          { name: 'name', type: 'text', required: true },
          { name: 'duration', type: 'number', required: true, min: 1 },
          { name: 'value', type: 'number', min: 0 },
          { name: 'category', type: 'text' },
          { name: 'active', type: 'bool' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_procedures_name ON procedures (name)'],
      }),
    )

    // ============================================================
    // Seed: procedimentos padrão
    // ============================================================
    const col = app.findCollectionByNameOrId('procedures')

    const seeds = [
      { name: 'Avaliação Auditiva', category: 'Avaliação', duration: 60, value: 200 },
      { name: 'Audiometria Tonal Liminar', category: 'Exames', duration: 40, value: 150 },
      { name: 'Imitanciometria', category: 'Exames', duration: 30, value: 120 },
      { name: 'Logoaudiometria', category: 'Exames', duration: 30, value: 100 },
      { name: 'BERA', category: 'Exames', duration: 45, value: 350 },
      { name: 'Adaptação de Aparelho', category: 'Adaptação', duration: 60, value: 100 },
      { name: 'Retorno / Ajuste', category: 'Manutenção', duration: 30, value: 80 },
      { name: 'Manutenção de Aparelho', category: 'Manutenção', duration: 30, value: 80 },
      { name: 'Entrega de Aparelho', category: 'Adaptação', duration: 30, value: 0 },
      { name: 'Orientação', category: 'Terapia', duration: 30, value: 0 },
    ]

    seeds.forEach((s) => {
      // Idempotente: pula se já existir um procedimento com o mesmo nome
      try {
        app.findFirstRecordByData('procedures', 'name', s.name)
        return
      } catch (_) {}

      const record = new Record(col)
      record.set('name', s.name)
      record.set('duration', s.duration)
      record.set('value', s.value)
      record.set('category', s.category)
      record.set('active', true)
      app.save(record)
    })
  },
  (app) => {
    try {
      const c = app.findCollectionByNameOrId('procedures')
      app.delete(c)
    } catch (_) {}
  },
)
