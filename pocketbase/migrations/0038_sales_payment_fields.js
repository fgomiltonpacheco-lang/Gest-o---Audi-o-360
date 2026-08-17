migrate(
  (app) => {
    // ============================================================
    // Adiciona campos de recebimento à coleção `sales` para suportar
    // o fluxo "Finalizar como Paga" pela tela de Vendas.
    //
    // Campos adicionados:
    //  - paymentDate  (text)   — data (YYYY-MM-DD) em que a venda foi paga
    //  - paymentNotes (text)   — observações do recebimento (forma, etc.)
    // ============================================================

    const col = app.findCollectionByNameOrId('sales')

    if (!col.fields.getByName('paymentDate')) {
      col.fields.add(new TextField({ name: 'paymentDate' }))
    }

    if (!col.fields.getByName('paymentNotes')) {
      col.fields.add(new TextField({ name: 'paymentNotes' }))
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('sales')
    ;['paymentDate', 'paymentNotes'].forEach((fname) => {
      try {
        const f = col.fields.getByName(fname)
        if (f) col.fields.remove(f)
      } catch (_) {}
    })
    app.save(col)
  },
)
