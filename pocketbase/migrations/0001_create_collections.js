migrate(
  (app) => {
    const AUTH = "@request.auth.id != ''"

    // ---- Add role + crmCrfa to the built-in users collection ----
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    if (!usersCol.fields.getByName('role')) {
      usersCol.fields.add(new TextField({ name: 'role' }))
    }
    if (!usersCol.fields.getByName('crmCrfa')) {
      usersCol.fields.add(new TextField({ name: 'crmCrfa' }))
    }
    app.save(usersCol)

    // ============================================================
    // patients
    // ============================================================
    const patients = new Collection({
      name: 'patients',
      type: 'base',
      listRule: AUTH,
      viewRule: AUTH,
      createRule: AUTH,
      updateRule: AUTH,
      deleteRule: AUTH,
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'cpf', type: 'text' },
        { name: 'birthDate', type: 'text' },
        { name: 'gender', type: 'text' },
        { name: 'phone', type: 'text' },
        { name: 'mobile', type: 'text' },
        { name: 'email', type: 'email' },
        { name: 'cep', type: 'text' },
        { name: 'street', type: 'text' },
        { name: 'number', type: 'text' },
        { name: 'complement', type: 'text' },
        { name: 'neighborhood', type: 'text' },
        { name: 'city', type: 'text' },
        { name: 'state', type: 'text' },
        { name: 'planType', type: 'text' },
        { name: 'planName', type: 'text' },
        { name: 'cardNumber', type: 'text' },
        { name: 'hasResponsible', type: 'bool' },
        { name: 'responsible', type: 'json' },
        { name: 'hearingLossType', type: 'text' },
        { name: 'previousHearingAid', type: 'bool' },
        { name: 'previousAidBrand', type: 'text' },
        { name: 'previousAidModel', type: 'text' },
        { name: 'generalNotes', type: 'text' },
        { name: 'status', type: 'text' },
        { name: 'lastVisit', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ["CREATE UNIQUE INDEX idx_patients_cpf ON patients (cpf) WHERE cpf != ''"],
    })
    app.save(patients)

    const patientsId = app.findCollectionByNameOrId('patients').id

    // ============================================================
    // appointments
    // ============================================================
    app.save(
      new Collection({
        name: 'appointments',
        type: 'base',
        listRule: AUTH,
        viewRule: AUTH,
        createRule: AUTH,
        updateRule: AUTH,
        deleteRule: AUTH,
        fields: [
          {
            name: 'patientId',
            type: 'relation',
            collectionId: patientsId,
            maxSelect: 1,
            cascadeDelete: false,
          },
          { name: 'patientName', type: 'text' },
          { name: 'patientPhone', type: 'text' },
          { name: 'type', type: 'text' },
          { name: 'date', type: 'text' },
          { name: 'time', type: 'text' },
          { name: 'duration', type: 'number' },
          { name: 'professionalName', type: 'text' },
          { name: 'status', type: 'text' },
          { name: 'notes', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_appointments_date ON appointments (date)'],
      }),
    )

    // ============================================================
    // clinical_records
    // ============================================================
    app.save(
      new Collection({
        name: 'clinical_records',
        type: 'base',
        listRule: AUTH,
        viewRule: AUTH,
        createRule: AUTH,
        updateRule: AUTH,
        deleteRule: AUTH,
        fields: [
          {
            name: 'patientId',
            type: 'relation',
            collectionId: patientsId,
            maxSelect: 1,
            cascadeDelete: true,
          },
          { name: 'patientName', type: 'text' },
          { name: 'mainComplaint', type: 'text' },
          { name: 'anamnesis', type: 'text' },
          { name: 'hearingHistory', type: 'text' },
          { name: 'currentMedications', type: 'text' },
          { name: 'familyHistory', type: 'text' },
          { name: 'diagnosis', type: 'text' },
          { name: 'conduct', type: 'text' },
          { name: 'nextReturn', type: 'text' },
          { name: 'updatedAt', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_clinical_records_patient ON clinical_records (patientId)',
        ],
      }),
    )

    // ============================================================
    // evolutions
    // ============================================================
    app.save(
      new Collection({
        name: 'evolutions',
        type: 'base',
        listRule: AUTH,
        viewRule: AUTH,
        createRule: AUTH,
        updateRule: AUTH,
        deleteRule: AUTH,
        fields: [
          {
            name: 'patientId',
            type: 'relation',
            collectionId: patientsId,
            maxSelect: 1,
            cascadeDelete: true,
          },
          { name: 'patientName', type: 'text' },
          { name: 'date', type: 'text' },
          { name: 'professionalName', type: 'text' },
          { name: 'description', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        ],
      }),
    )

    // ============================================================
    // audiometries
    // ============================================================
    app.save(
      new Collection({
        name: 'audiometries',
        type: 'base',
        listRule: AUTH,
        viewRule: AUTH,
        createRule: AUTH,
        updateRule: AUTH,
        deleteRule: AUTH,
        fields: [
          {
            name: 'patientId',
            type: 'relation',
            collectionId: patientsId,
            maxSelect: 1,
            cascadeDelete: true,
          },
          { name: 'patientName', type: 'text' },
          { name: 'date', type: 'text' },
          { name: 'professionalName', type: 'text' },
          { name: 'airOD', type: 'json' },
          { name: 'airOE', type: 'json' },
          { name: 'boneOD', type: 'json' },
          { name: 'boneOE', type: 'json' },
          { name: 'srtOD', type: 'number' },
          { name: 'srtOE', type: 'number' },
          { name: 'iprfOD', type: 'number' },
          { name: 'iprfOE', type: 'number' },
          { name: 'lossDegree', type: 'text' },
          { name: 'lossType', type: 'text' },
          { name: 'notes', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        ],
      }),
    )

    // ============================================================
    // tympanometries (imitanciometrias)
    // ============================================================
    app.save(
      new Collection({
        name: 'tympanometries',
        type: 'base',
        listRule: AUTH,
        viewRule: AUTH,
        createRule: AUTH,
        updateRule: AUTH,
        deleteRule: AUTH,
        fields: [
          {
            name: 'patientId',
            type: 'relation',
            collectionId: patientsId,
            maxSelect: 1,
            cascadeDelete: true,
          },
          { name: 'patientName', type: 'text' },
          { name: 'date', type: 'text' },
          { name: 'professionalName', type: 'text' },
          { name: 'tympanometryOD', type: 'json' },
          { name: 'tympanometryOE', type: 'json' },
          { name: 'reflexesOD', type: 'json' },
          { name: 'reflexesOE', type: 'json' },
          { name: 'conclusion', type: 'text' },
          { name: 'notes', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        ],
      }),
    )

    // ============================================================
    // beras
    // ============================================================
    app.save(
      new Collection({
        name: 'beras',
        type: 'base',
        listRule: AUTH,
        viewRule: AUTH,
        createRule: AUTH,
        updateRule: AUTH,
        deleteRule: AUTH,
        fields: [
          {
            name: 'patientId',
            type: 'relation',
            collectionId: patientsId,
            maxSelect: 1,
            cascadeDelete: true,
          },
          { name: 'patientName', type: 'text' },
          { name: 'date', type: 'text' },
          { name: 'professionalName', type: 'text' },
          { name: 'od', type: 'json' },
          { name: 'oe', type: 'json' },
          { name: 'classification', type: 'text' },
          { name: 'notes', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        ],
      }),
    )

    // ============================================================
    // hearing_aids
    // ============================================================
    app.save(
      new Collection({
        name: 'hearing_aids',
        type: 'base',
        listRule: AUTH,
        viewRule: AUTH,
        createRule: AUTH,
        updateRule: AUTH,
        deleteRule: AUTH,
        fields: [
          {
            name: 'patientId',
            type: 'relation',
            collectionId: patientsId,
            maxSelect: 1,
            cascadeDelete: false,
          },
          { name: 'patientName', type: 'text' },
          { name: 'brand', type: 'text' },
          { name: 'model', type: 'text' },
          { name: 'type', type: 'text' },
          { name: 'side', type: 'text' },
          { name: 'serialNumber', type: 'text' },
          { name: 'saleDate', type: 'text' },
          { name: 'saleValue', type: 'number' },
          { name: 'paymentMethod', type: 'text' },
          { name: 'warrantyMonths', type: 'number' },
          { name: 'warrantyEndDate', type: 'text' },
          { name: 'powerSource', type: 'text' },
          { name: 'earMold', type: 'bool' },
          { name: 'earMoldType', type: 'text' },
          { name: 'notes', type: 'text' },
          { name: 'status', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
      }),
    )

    const hearingAidsId = app.findCollectionByNameOrId('hearing_aids').id

    // ============================================================
    // maintenances (hearing aid)
    // ============================================================
    app.save(
      new Collection({
        name: 'maintenances',
        type: 'base',
        listRule: AUTH,
        viewRule: AUTH,
        createRule: AUTH,
        updateRule: AUTH,
        deleteRule: AUTH,
        fields: [
          {
            name: 'hearingAidId',
            type: 'relation',
            collectionId: hearingAidsId,
            maxSelect: 1,
            cascadeDelete: true,
          },
          { name: 'hearingAidLabel', type: 'text' },
          { name: 'date', type: 'text' },
          { name: 'description', type: 'text' },
          { name: 'responsible', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        ],
      }),
    )

    // ============================================================
    // adjustments (hearing aid)
    // ============================================================
    app.save(
      new Collection({
        name: 'adjustments',
        type: 'base',
        listRule: AUTH,
        viewRule: AUTH,
        createRule: AUTH,
        updateRule: AUTH,
        deleteRule: AUTH,
        fields: [
          {
            name: 'hearingAidId',
            type: 'relation',
            collectionId: hearingAidsId,
            maxSelect: 1,
            cascadeDelete: true,
          },
          { name: 'hearingAidLabel', type: 'text' },
          { name: 'date', type: 'text' },
          { name: 'description', type: 'text' },
          { name: 'professionalName', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        ],
      }),
    )

    // ============================================================
    // budgets
    // ============================================================
    app.save(
      new Collection({
        name: 'budgets',
        type: 'base',
        listRule: AUTH,
        viewRule: AUTH,
        createRule: AUTH,
        updateRule: AUTH,
        deleteRule: AUTH,
        fields: [
          {
            name: 'patientId',
            type: 'relation',
            collectionId: patientsId,
            maxSelect: 1,
            cascadeDelete: true,
          },
          { name: 'patientName', type: 'text' },
          { name: 'number', type: 'number' },
          { name: 'date', type: 'text' },
          { name: 'items', type: 'json' },
          { name: 'discountPercent', type: 'number' },
          { name: 'totalValue', type: 'number' },
          { name: 'status', type: 'text' },
          { name: 'notes', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
      }),
    )

    // ============================================================
    // sales
    // ============================================================
    app.save(
      new Collection({
        name: 'sales',
        type: 'base',
        listRule: AUTH,
        viewRule: AUTH,
        createRule: AUTH,
        updateRule: AUTH,
        deleteRule: AUTH,
        fields: [
          {
            name: 'patientId',
            type: 'relation',
            collectionId: patientsId,
            maxSelect: 1,
            cascadeDelete: false,
          },
          { name: 'patientName', type: 'text' },
          { name: 'number', type: 'number' },
          { name: 'date', type: 'text' },
          { name: 'itemsDescription', type: 'text' },
          { name: 'totalValue', type: 'number' },
          { name: 'paymentMethod', type: 'text' },
          { name: 'installmentsCount', type: 'number' },
          { name: 'interestPercent', type: 'number' },
          { name: 'firstDueDate', type: 'text' },
          { name: 'status', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        ],
      }),
    )

    const salesId = app.findCollectionByNameOrId('sales').id

    // ============================================================
    // installments
    // ============================================================
    app.save(
      new Collection({
        name: 'installments',
        type: 'base',
        listRule: AUTH,
        viewRule: AUTH,
        createRule: AUTH,
        updateRule: AUTH,
        deleteRule: AUTH,
        fields: [
          {
            name: 'saleId',
            type: 'relation',
            collectionId: salesId,
            maxSelect: 1,
            cascadeDelete: true,
          },
          {
            name: 'patientId',
            type: 'relation',
            collectionId: patientsId,
            maxSelect: 1,
            cascadeDelete: false,
          },
          { name: 'patientName', type: 'text' },
          { name: 'saleNumber', type: 'number' },
          { name: 'installmentNumber', type: 'number' },
          { name: 'totalInstallments', type: 'number' },
          { name: 'dueDate', type: 'text' },
          { name: 'value', type: 'number' },
          { name: 'status', type: 'text' },
          { name: 'paidDate', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_installments_due ON installments (dueDate)'],
      }),
    )

    // ============================================================
    // commissions
    // ============================================================
    app.save(
      new Collection({
        name: 'commissions',
        type: 'base',
        listRule: AUTH,
        viewRule: AUTH,
        createRule: AUTH,
        updateRule: AUTH,
        deleteRule: AUTH,
        fields: [
          {
            name: 'saleId',
            type: 'relation',
            collectionId: salesId,
            maxSelect: 1,
            cascadeDelete: false,
          },
          { name: 'professionalName', type: 'text' },
          { name: 'period', type: 'text' },
          { name: 'salesCount', type: 'number' },
          { name: 'totalSalesValue', type: 'number' },
          { name: 'commissionPercent', type: 'number' },
          { name: 'commissionValue', type: 'number' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
      }),
    )

    // ============================================================
    // cash_flow
    // ============================================================
    app.save(
      new Collection({
        name: 'cash_flow',
        type: 'base',
        listRule: AUTH,
        viewRule: AUTH,
        createRule: AUTH,
        updateRule: AUTH,
        deleteRule: AUTH,
        fields: [
          { name: 'date', type: 'text' },
          { name: 'description', type: 'text' },
          { name: 'type', type: 'text' },
          { name: 'category', type: 'text' },
          { name: 'value', type: 'number' },
          { name: 'responsible', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        ],
      }),
    )

    // ============================================================
    // inventory (stock items)
    // ============================================================
    app.save(
      new Collection({
        name: 'inventory',
        type: 'base',
        listRule: AUTH,
        viewRule: AUTH,
        createRule: AUTH,
        updateRule: AUTH,
        deleteRule: AUTH,
        fields: [
          { name: 'name', type: 'text', required: true },
          { name: 'brand', type: 'text' },
          { name: 'model', type: 'text' },
          { name: 'color', type: 'text' },
          { name: 'category', type: 'text' },
          { name: 'batterySize', type: 'text' },
          { name: 'accessorySubcategory', type: 'text' },
          { name: 'minQuantity', type: 'number' },
          { name: 'currentQuantity', type: 'number' },
          { name: 'supplier', type: 'text' },
          { name: 'costPrice', type: 'number' },
          { name: 'salePrice', type: 'number' },
          { name: 'notes', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
      }),
    )

    const inventoryId = app.findCollectionByNameOrId('inventory').id

    // ============================================================
    // inventory_movements
    // ============================================================
    app.save(
      new Collection({
        name: 'inventory_movements',
        type: 'base',
        listRule: AUTH,
        viewRule: AUTH,
        createRule: AUTH,
        updateRule: AUTH,
        deleteRule: AUTH,
        fields: [
          {
            name: 'itemId',
            type: 'relation',
            collectionId: inventoryId,
            maxSelect: 1,
            cascadeDelete: true,
          },
          { name: 'item_name', type: 'text' },
          { name: 'date', type: 'text' },
          { name: 'type', type: 'text' },
          { name: 'quantity', type: 'number' },
          { name: 'responsible', type: 'text' },
          { name: 'reason', type: 'text' },
          { name: 'supplier', type: 'text' },
          { name: 'patientName', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        ],
      }),
    )
  },
  (app) => {
    const names = [
      'inventory_movements',
      'inventory',
      'cash_flow',
      'commissions',
      'installments',
      'sales',
      'budgets',
      'adjustments',
      'maintenances',
      'hearing_aids',
      'beras',
      'tympanometries',
      'audiometries',
      'evolutions',
      'clinical_records',
      'appointments',
      'patients',
    ]
    names.forEach((n) => {
      try {
        const c = app.findCollectionByNameOrId(n)
        app.delete(c)
      } catch (_) {}
    })
  },
)
