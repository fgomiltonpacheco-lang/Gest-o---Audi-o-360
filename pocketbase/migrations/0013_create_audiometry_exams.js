migrate(
  (app) => {
    const patientsCol = app.findCollectionByNameOrId('patients')
    const usersCol = app.findCollectionByNameOrId('users')

    const collection = new Collection({
      name: 'audiometry_exams',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        // Relações
        {
          name: 'patient',
          type: 'relation',
          required: false,
          collectionId: patientsCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'created_by',
          type: 'relation',
          required: false,
          collectionId: usersCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        // Identificação
        { name: 'date', type: 'text', required: false },
        { name: 'cpf', type: 'text', required: false },
        { name: 'dob', type: 'text', required: false },
        { name: 'age', type: 'text', required: false },
        { name: 'sex', type: 'text', required: false },
        { name: 'referred_by', type: 'text', required: false },
        { name: 'hearing_rest_14h', type: 'bool', required: false },
        { name: 'audiometer', type: 'text', required: false },
        { name: 'calibration', type: 'text', required: false },
        // Otoscopia / Meatoscopia
        { name: 'otoscopy_od', type: 'text', required: false },
        { name: 'otoscopy_od_obs', type: 'text', required: false },
        { name: 'otoscopy_oe', type: 'text', required: false },
        { name: 'otoscopy_oe_obs', type: 'text', required: false },
        // Via Aérea (OD / OE)
        { name: 'air_od', type: 'json', required: false },
        { name: 'air_oe', type: 'json', required: false },
        // Via Óssea (OD / OE)
        { name: 'bone_od', type: 'json', required: false },
        { name: 'bone_oe', type: 'json', required: false },
        // Logoaudiometria — limiares
        { name: 'mt_od', type: 'number', required: false },
        { name: 'mt_oe', type: 'number', required: false },
        { name: 'lrf_od', type: 'number', required: false },
        { name: 'lrf_oe', type: 'number', required: false },
        { name: 'ldv_od', type: 'number', required: false },
        { name: 'ldv_oe', type: 'number', required: false },
        // IPRF
        { name: 'iprf', type: 'json', required: false },
        // Parecer Audiológico
        { name: 'report', type: 'text', required: false },
        // Campos de auditoria (autodate)
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_audiometry_exams_patient ON audiometry_exams (patient)',
        'CREATE INDEX idx_audiometry_exams_date ON audiometry_exams (date)',
      ],
    })

    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('audiometry_exams')
    app.delete(collection)
  },
)
