migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('appointments')

    // procedureId: vínculo com a coleção procedures (maxSelect 1).
    if (!col.fields.getByName('procedureId')) {
      col.fields.add(
        new RelationField({
          name: 'procedureId',
          collectionId: app.findCollectionByNameOrId('procedures').id,
          maxSelect: 1,
          cascadeDelete: false,
        }),
      )
    }

    // value: valor (R$) do procedimento no momento do agendamento.
    if (!col.fields.getByName('value')) {
      col.fields.add(
        new NumberField({
          name: 'value',
          min: 0,
        }),
      )
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('appointments')

    try {
      const f1 = col.fields.getByName('procedureId')
      if (f1) col.fields.remove(f1)
    } catch (_) {}

    try {
      const f2 = col.fields.getByName('value')
      if (f2) col.fields.remove(f2)
    } catch (_) {}

    app.save(col)
  },
)
