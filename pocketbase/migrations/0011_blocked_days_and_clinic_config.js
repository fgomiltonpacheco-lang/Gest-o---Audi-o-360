/// Cria as coleções `blocked_days` (dias bloqueados na agenda) e
/// `clinic_config` (configurações da clínica — horários de funcionamento).
migrate(
  (app) => {
    // ---------- blocked_days ----------
    const blocked = new Collection({
      name: 'blocked_days',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'date', type: 'text', required: true },
        { name: 'reason', type: 'text', required: false },
        { name: 'created_by', type: 'text', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_blocked_days_date ON blocked_days (date)'],
    })
    app.save(blocked)

    // ---------- clinic_config ----------
    // Armazena um único registro de configuração da clínica. O campo
    // `operating_hours` guarda um JSON com os horários de funcionamento por
    // dia da semana (seg..dom) e o `slot_minutes` define o intervalo da grade.
    const clinic = new Collection({
      name: 'clinic_config',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'operating_hours', type: 'json', required: false },
        { name: 'slot_minutes', type: 'number', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [],
    })
    app.save(clinic)

    // Semeia um registro inicial de configuração com horários padrão:
    // Seg-Sex 07:00-19:00, Sáb 08:00-12:00, Dom fechado.
    const cfgCol = app.findCollectionByNameOrId('clinic_config')
    const seed = new Record(cfgCol)
    seed.set('operating_hours', {
      monday: { open: true, start: '07:00', end: '19:00' },
      tuesday: { open: true, start: '07:00', end: '19:00' },
      wednesday: { open: true, start: '07:00', end: '19:00' },
      thursday: { open: true, start: '07:00', end: '19:00' },
      friday: { open: true, start: '07:00', end: '19:00' },
      saturday: { open: true, start: '08:00', end: '12:00' },
      sunday: { open: false, start: '', end: '' },
    })
    seed.set('slot_minutes', 30)
    app.save(seed)
  },
  (app) => {
    try {
      const c = app.findCollectionByNameOrId('clinic_config')
      app.delete(c)
    } catch (_) {}
    try {
      const c = app.findCollectionByNameOrId('blocked_days')
      app.delete(c)
    } catch (_) {}
  },
)
