migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('audiometry_exams')

    if (!col.fields.getByName('ldl_od')) {
      col.fields.add(new JSONField({ name: 'ldl_od', required: false }))
    }
    if (!col.fields.getByName('ldl_oe')) {
      col.fields.add(new JSONField({ name: 'ldl_oe', required: false }))
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('audiometry_exams')
    const ldlOd = col.fields.getByName('ldl_od')
    if (ldlOd) col.fields.remove(ldlOd)
    const ldlOe = col.fields.getByName('ldl_oe')
    if (ldlOe) col.fields.remove(ldlOe)
    app.save(col)
  },
)
