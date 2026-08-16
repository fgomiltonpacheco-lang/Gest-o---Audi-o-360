migrate(
  (app) => {
    const patientsColId = app.findCollectionByNameOrId('patients').id
    const inventoryColId = app.findCollectionByNameOrId('inventory').id

    const tests = new Collection({
      name: 'hearing_aid_tests',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'patient_id',
          type: 'relation',
          collectionId: patientsColId,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'patient_name', type: 'text' },
        {
          name: 'inventory_item_id',
          type: 'relation',
          collectionId: inventoryColId,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'product_name', type: 'text' },
        { name: 'brand', type: 'text' },
        { name: 'model', type: 'text' },
        { name: 'start_date', type: 'text' },
        { name: 'side', type: 'text' },
        {
          name: 'status',
          type: 'select',
          values: [
            'Em teste',
            'Convertido em venda B2B',
            'Convertido em venda direta',
            'Cancelado',
          ],
          maxSelect: 1,
        },
        { name: 'observations', type: 'text' },
        { name: 'sale_type', type: 'text' },
        { name: 'sale_id', type: 'text' },
        { name: 'sale_number', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_hearing_aid_tests_patient ON hearing_aid_tests (patient_id)',
        'CREATE INDEX idx_hearing_aid_tests_status ON hearing_aid_tests (status)',
        'CREATE INDEX idx_hearing_aid_tests_inventory ON hearing_aid_tests (inventory_item_id)',
      ],
    })
    app.save(tests)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('hearing_aid_tests')
      app.delete(col)
    } catch (_) {}
  },
)
