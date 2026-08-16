migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('audiometry_exams')

    // IPRF agora é um percentual simples por orelha (sem tabela complexa)
    if (!col.fields.getByName('iprf_od')) {
      col.fields.add(new NumberField({ name: 'iprf_od' }))
    }
    if (!col.fields.getByName('iprf_oe')) {
      col.fields.add(new NumberField({ name: 'iprf_oe' }))
    }

    // Grau e Tipo da perda — laudo clínico
    if (!col.fields.getByName('loss_degree')) {
      col.fields.add(
        new SelectField({
          name: 'loss_degree',
          values: ['', 'Normal', 'Leve', 'Moderada', 'Moderadamente Severa', 'Severa', 'Profunda'],
          maxSelect: 1,
        }),
      )
    }
    if (!col.fields.getByName('loss_type')) {
      col.fields.add(
        new SelectField({
          name: 'loss_type',
          values: ['', 'Condutiva', 'Neurossensorial', 'Mista'],
          maxSelect: 1,
        }),
      )
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('audiometry_exams')
    try {
      col.fields.remove('iprf_od')
    } catch (_) {}
    try {
      col.fields.remove('iprf_oe')
    } catch (_) {}
    try {
      col.fields.remove('loss_degree')
    } catch (_) {}
    try {
      col.fields.remove('loss_type')
    } catch (_) {}
    app.save(col)
  },
)
