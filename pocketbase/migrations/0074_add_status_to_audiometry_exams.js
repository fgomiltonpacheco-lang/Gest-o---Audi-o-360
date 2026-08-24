migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('audiometry_exams')

    if (!col.fields.getByName('status')) {
      col.fields.add(
        new TextField({
          name: 'status',
          required: false,
        }),
      )
    }

    app.save(col)

    // Atualiza exames existentes sem status para 'rascunho'
    app
      .db()
      .newQuery(
        "UPDATE audiometry_exams SET status = 'rascunho' WHERE status IS NULL OR status = ''",
      )
      .execute()
  },
  (app) => {
    const col = app.findCollectionByNameOrId('audiometry_exams')
    const field = col.fields.getByName('status')
    if (field) {
      col.fields.remove(field)
    }
    app.save(col)
  },
)
