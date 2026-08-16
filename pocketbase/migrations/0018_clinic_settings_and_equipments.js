migrate(
  (app) => {
    // ============================================================
    // 1) clinic_settings — singleton (um único registro por clínica).
    //    Armazena os dados cadastrais da clínica usados nos laudos
    //    impressos (audiometria e futuros exames).
    // ============================================================
    const clinicCol = new Collection({
      name: 'clinic_settings',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.role = 'admin'",
      deleteRule: "@request.auth.role = 'admin'",
      fields: [
        { name: 'nome', type: 'text' },
        { name: 'endereco', type: 'text' },
        { name: 'telefone', type: 'text' },
        { name: 'email', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(clinicCol)

    // ============================================================
    // 2) equipments — equipamentos da clínica (audiômetros, etc.).
    //    `data_calibracao` é informada; `proxima_calibracao` é calculada
    //    automaticamente (+1 ano) no lado do app e persistida.
    // ============================================================
    const equipCol = new Collection({
      name: 'equipments',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'nome', type: 'text', required: true },
        { name: 'data_calibracao', type: 'date' },
        { name: 'proxima_calibracao', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_equipments_nome ON equipments (nome)'],
    })
    app.save(equipCol)

    // ------------------------------------------------------------
    // Seed: cria o registro singleton de clinic_settings caso ainda
    // não exista, com os dados já conhecidos da clínica (que antes
    // estavam hardcoded nos componentes de impressão).
    // ------------------------------------------------------------
    const clinicCollection = app.findCollectionByNameOrId('clinic_settings')
    let existing = null
    try {
      const records = app.findRecordsByFilter('clinic_settings', '1=1', 'created', 1, 0)
      if (records.length > 0) existing = records[0]
    } catch (_) {}

    if (!existing) {
      const rec = new Record(clinicCollection)
      rec.set('nome', 'Audição360')
      rec.set('endereco', 'R. Sadoc Correa, 373 - St. Central, Araguaína - TO, 77803-060')
      rec.set('telefone', '(63) 3421-2611')
      rec.set('email', 'contato@audicao360.com.br')
      app.save(rec)
    }

    // ------------------------------------------------------------
    // Seed: equipamento padrão (AD229b) já utilizado pela clínica,
    // com data de calibração retroativa para demonstrar o status.
    // ------------------------------------------------------------
    const equipCollection = app.findCollectionByNameOrId('equipments')
    try {
      app.findFirstRecordByData('equipments', 'nome', 'AD229b')
    } catch (_) {
      // Calibração há ~10 meses ⇒ próxima calibração dentro de 30 dias (vencendo).
      const calib = new Date()
      calib.setMonth(calib.getMonth() - 10)
      const calibStr = calib.toISOString().split('T')[0]
      const next = new Date(calib)
      next.setFullYear(next.getFullYear() + 1)
      const nextStr = next.toISOString().split('T')[0]
      const rec = new Record(equipCollection)
      rec.set('nome', 'AD229b')
      rec.set('data_calibracao', calibStr)
      rec.set('proxima_calibracao', nextStr)
      app.save(rec)
    }
  },
  (app) => {
    try {
      const c = app.findCollectionByNameOrId('clinic_settings')
      app.delete(c)
    } catch (_) {}
    try {
      const c = app.findCollectionByNameOrId('equipments')
      app.delete(c)
    } catch (_) {}
  },
)
