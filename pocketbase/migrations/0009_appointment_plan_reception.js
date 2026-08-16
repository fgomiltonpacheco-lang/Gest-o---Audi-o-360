migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('appointments')

    if (!col.fields.getByName('planType')) {
      col.fields.add(
        new TextField({
          name: 'planType',
        }),
      )
    }

    if (!col.fields.getByName('reception')) {
      col.fields.add(
        new TextField({
          name: 'reception',
        }),
      )
    }

    app.save(col)

    // Preenche valores padrão para registros antigos: Particular / "".
    app
      .db()
      .newQuery(
        "UPDATE appointments SET planType = 'Particular' WHERE planType IS NULL OR planType = ''",
      )
      .execute()
    app.db().newQuery("UPDATE appointments SET reception = '' WHERE reception IS NULL").execute()
  },
  (app) => {
    const col = app.findCollectionByNameOrId('appointments')

    const planField = col.fields.getByName('planType')
    if (planField) col.fields.remove(planField)

    const receptionField = col.fields.getByName('reception')
    if (receptionField) col.fields.remove(receptionField)

    app.save(col)
  },
)
