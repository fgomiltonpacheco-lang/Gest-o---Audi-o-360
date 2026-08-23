migrate(
  (app) => {
    const planos = app.findCollectionByNameOrId('planos')
    planos.listRule = ''
    planos.viewRule = ''
    app.save(planos)
  },
  (app) => {
    const planos = app.findCollectionByNameOrId('planos')
    planos.listRule = "@request.auth.id != ''"
    planos.viewRule = "@request.auth.id != ''"
    app.save(planos)
  },
)
