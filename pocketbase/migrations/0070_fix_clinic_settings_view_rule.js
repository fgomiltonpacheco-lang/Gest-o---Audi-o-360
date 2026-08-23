migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('clinic_settings')
    collection.viewRule = '1=1'
    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('clinic_settings')
    collection.viewRule = ''
    app.save(collection)
  },
)
