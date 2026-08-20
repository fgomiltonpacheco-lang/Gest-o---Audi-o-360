migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('procedures')
    if (!col.fields.getByName('code')) {
      col.fields.add(
        new TextField({
          name: 'code',
          required: false,
        }),
      )
      app.save(col)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('procedures')
      const field = col.fields.getByName('code')
      if (field) {
        col.fields.removeByName('code')
        app.save(col)
      }
    } catch (_) {}
  },
)
