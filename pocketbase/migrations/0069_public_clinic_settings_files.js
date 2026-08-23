migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('clinic_settings')
    collection.viewRule = ''
    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('clinic_settings')
    collection.viewRule = "@request.auth.id != '' && clinica_id = @request.auth.clinica_id"
    app.save(collection)
  },
)
