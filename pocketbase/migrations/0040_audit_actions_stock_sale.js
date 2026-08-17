migrate(
  (app) => {
    // ============================================================
    // 0040 — Novas ações de auditoria para a integração
    // Vendas x Estoque (baixa/devolução de estoque por venda):
    //   - baixar_estoque_venda
    //   - devolver_estoque_venda
    //   - cancelar_venda_paga
    //
    // Adicionadas ao select `acao` da coleção `audit_trail`.
    // (idempotente: só acrescenta valores ainda não presentes.)
    // ============================================================
    const col = app.findCollectionByNameOrId('audit_trail')
    const acaoField = col.fields.getByName('acao')

    if (acaoField && Array.isArray(acaoField.values)) {
      const existing = new Set(acaoField.values)
      ;['baixar_estoque_venda', 'devolver_estoque_venda', 'cancelar_venda_paga'].forEach((v) => {
        if (!existing.has(v)) acaoField.values.push(v)
      })
    }
    app.save(col)
  },
  (app) => {
    // Down: remove apenas os valores adicionados por esta migration.
    try {
      const col = app.findCollectionByNameOrId('audit_trail')
      const acaoField = col.fields.getByName('acao')
      if (acaoField && Array.isArray(acaoField.values)) {
        acaoField.values = acaoField.values.filter(
          (v) =>
            v !== 'baixar_estoque_venda' &&
            v !== 'devolver_estoque_venda' &&
            v !== 'cancelar_venda_paga',
        )
      }
      app.save(col)
    } catch (_) {}
  },
)
