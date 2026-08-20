migrate(
  (app) => {
    // Regra que permite autenticados (ou especificamente admin, professional, secretaria)
    const RULE = "@request.auth.id != ''"

    try {
      const invCol = app.findCollectionByNameOrId('inventory')
      invCol.listRule = RULE
      invCol.viewRule = RULE
      app.save(invCol)
    } catch (e) {
      console.warn('Erro ao atualizar regras da coleção inventory:', e)
    }

    try {
      const procCol = app.findCollectionByNameOrId('procedures')
      procCol.listRule = RULE
      procCol.viewRule = RULE
      app.save(procCol)
    } catch (e) {
      console.warn('Erro ao atualizar regras da coleção procedures:', e)
    }
  },
  (app) => {
    // Revert se necessário
    const RULE = "@request.auth.id != ''"

    try {
      const invCol = app.findCollectionByNameOrId('inventory')
      invCol.listRule = RULE
      invCol.viewRule = RULE
      app.save(invCol)
    } catch (_) {}

    try {
      const procCol = app.findCollectionByNameOrId('procedures')
      procCol.listRule = RULE
      procCol.viewRule = RULE
      app.save(procCol)
    } catch (_) {}
  },
)
