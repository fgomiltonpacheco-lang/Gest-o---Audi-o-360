migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('procedures')

    // valueParticular: valor para pacientes Particulares (min 0)
    if (!col.fields.getByName('valueParticular')) {
      col.fields.add(
        new NumberField({
          name: 'valueParticular',
          min: 0,
        }),
      )
    }

    // valueSUS: valor para pacientes SUS (min 0)
    if (!col.fields.getByName('valueSUS')) {
      col.fields.add(
        new NumberField({
          name: 'valueSUS',
          min: 0,
        }),
      )
    }

    // valueConvenio: valor para pacientes de Convênio (min 0)
    if (!col.fields.getByName('valueConvenio')) {
      col.fields.add(
        new NumberField({
          name: 'valueConvenio',
          min: 0,
        }),
      )
    }

    app.save(col)

    // Copia o valor atual do campo `value` para os 3 novos campos, preservando
    // os valores já cadastrados. Usa COALESCE para tratar NULL como 0. Registros
    // que já possuam um valor específico (não-zero) não são sobrescritos.
    app
      .db()
      .newQuery(
        `UPDATE procedures SET
          valueParticular = COALESCE(NULLIF(valueParticular, 0), COALESCE(value, 0)),
          valueSUS = COALESCE(NULLIF(valueSUS, 0), COALESCE(value, 0)),
          valueConvenio = COALESCE(NULLIF(valueConvenio, 0), COALESCE(value, 0))
        WHERE 1=1`,
      )
      .execute()
  },
  (app) => {
    const col = app.findCollectionByNameOrId('procedures')

    try {
      const f1 = col.fields.getByName('valueParticular')
      if (f1) col.fields.remove(f1)
    } catch (_) {}

    try {
      const f2 = col.fields.getByName('valueSUS')
      if (f2) col.fields.remove(f2)
    } catch (_) {}

    try {
      const f3 = col.fields.getByName('valueConvenio')
      if (f3) col.fields.remove(f3)
    } catch (_) {}

    app.save(col)
  },
)
