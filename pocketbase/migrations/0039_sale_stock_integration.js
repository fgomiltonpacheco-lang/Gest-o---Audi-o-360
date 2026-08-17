migrate(
  (app) => {
    // ============================================================
    // Integração entre Vendas e Estoque:
    //
    // 1. inventory: campos `code` e `sku` (text) para busca no
    //    autocomplete de itens da Nova Venda.
    // 2. sales: campo `estoque_baixado` (bool) — flag que indica se
    //    o estoque já foi baixado para esta venda. Garante que a
    //    baixa ocorra UMA vez (mesmo se a venda for reaberta/revisada).
    // 3. inventory_movements: relação `saleId` -> sales, para
    //    rastrear a venda que originou a baixa/devolução.
    //
    // Backfill: vendas PDV já pagas (status='Pago', type='PDV')
    // tiveram o estoque baixado via addStockExit no PDV — marcar
    // estoque_baixado=1 para que o cancelamento devolva corretamente.
    // ============================================================

    // ---- inventory: code + sku ----
    const invCol = app.findCollectionByNameOrId('inventory')
    if (!invCol.fields.getByName('code')) {
      invCol.fields.add(new TextField({ name: 'code' }))
    }
    if (!invCol.fields.getByName('sku')) {
      invCol.fields.add(new TextField({ name: 'sku' }))
    }
    app.save(invCol)

    // ---- sales: estoque_baixado ----
    const salesCol = app.findCollectionByNameOrId('sales')
    if (!salesCol.fields.getByName('estoque_baixado')) {
      salesCol.fields.add(new BoolField({ name: 'estoque_baixado' }))
    }
    app.save(salesCol)

    // Backfill: PDV pagas já tiveram baixa de estoque no ato da venda.
    try {
      app
        .db()
        .newQuery(
          "UPDATE sales SET estoque_baixado = 1 WHERE status = 'Pago' AND type = 'PDV' AND estoque_baixado = 0",
        )
        .execute()
    } catch (_) {}

    // ---- inventory_movements: saleId -> sales ----
    const movCol = app.findCollectionByNameOrId('inventory_movements')
    if (!movCol.fields.getByName('saleId')) {
      movCol.fields.add(
        new RelationField({
          name: 'saleId',
          collectionId: salesCol.id,
          maxSelect: 1,
        }),
      )
    }
    app.save(movCol)
  },
  (app) => {
    const invCol = app.findCollectionByNameOrId('inventory')
    ;['code', 'sku'].forEach((fname) => {
      try {
        const f = invCol.fields.getByName(fname)
        if (f) invCol.fields.remove(f)
      } catch (_) {}
    })
    app.save(invCol)

    const salesCol = app.findCollectionByNameOrId('sales')
    try {
      const f = salesCol.fields.getByName('estoque_baixado')
      if (f) salesCol.fields.remove(f)
    } catch (_) {}
    app.save(salesCol)

    const movCol = app.findCollectionByNameOrId('inventory_movements')
    try {
      const f = movCol.fields.getByName('saleId')
      if (f) movCol.fields.remove(f)
    } catch (_) {}
    app.save(movCol)
  },
)
