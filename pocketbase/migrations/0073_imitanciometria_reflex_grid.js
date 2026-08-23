migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('imitanciometrias')
    if (!col.fields.getByName('reflex_grid')) {
      col.fields.add(new JSONField({ name: 'reflex_grid', maxSize: 1048576 }))
      app.save(col)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('imitanciometrias')
      const f = col.fields.getByName('reflex_grid')
      if (f) {
        col.fields.remove(f)
        app.save(col)
      }
    } catch (_) {}
  },
)
