migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('hearing_aid_tests')

    // 1. Adiciona o campo `return_reason` (texto) para registrar o motivo da devolução.
    if (!col.fields.getByName('return_reason')) {
      col.fields.add(new TextField({ name: 'return_reason' }))
    }

    // 2. Inclui a opção "Devolvido" no select `status`, preservando as opções existentes.
    const statusField = col.fields.getByName('status')
    const currentValues = statusField.values || []
    if (currentValues.indexOf('Devolvido') === -1) {
      currentValues.push('Devolvido')
      statusField.values = currentValues
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('hearing_aid_tests')

    // Remove o campo `return_reason`.
    const returnField = col.fields.getByName('return_reason')
    if (returnField) {
      col.fields.remove(returnField)
    }

    // Remove a opção "Devolvido" do select `status`.
    const statusField = col.fields.getByName('status')
    const currentValues = (statusField.values || []).filter((v) => v !== 'Devolvido')
    statusField.values = currentValues

    app.save(col)
  },
)
