migrate(
  (app) => {
    // Adiciona o campo `procedimentos` (texto, separado por vírgula) à coleção
    // `appointments`, complementando o campo JSON `proceduresList`. Permite
    // armazenar e consultar facilmente a lista de procedimentos de um
    // agendamento como string legível.
    const col = app.findCollectionByNameOrId('appointments')
    if (!col.fields.getByName('procedimentos')) {
      col.fields.add(
        new TextField({
          name: 'procedimentos',
          required: false,
        }),
      )
    }
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('appointments')
    const f = col.fields.getByName('procedimentos')
    if (f) {
      col.fields.remove(f)
      app.save(col)
    }
  },
)
