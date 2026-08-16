migrate(
  (app) => {
    // ============================================================
    // Estende a coleção `sales` para suportar o módulo de PDV
    // (Ponto de Venda) e o histórico de vendas.
    //
    // Campos adicionados:
    //  - type            ('PDV' | 'atendimento') — origem da venda
    //  - items           (json) — itens do carrinho (PDV): {id,name,type,quantity,unitPrice,subtotal,stockItemId}
    //  - subtotal        (number) — soma dos subtotais antes do desconto
    //  - discountValue   (number) — desconto em R$ aplicado
    //  - discountPercent (number) — desconto em % aplicado
    //  - cancelReason    (text) — justificativa de cancelamento/estorno
    //  - appointmentId   (relation -> appointments) — venda gerada pelo prontuário
    //  - updated         (autodate) — ausente na coleção original
    // ============================================================

    const col = app.findCollectionByNameOrId('sales')

    if (!col.fields.getByName('type')) {
      col.fields.add(new TextField({ name: 'type' }))
    }

    if (!col.fields.getByName('items')) {
      col.fields.add(new JSONField({ name: 'items' }))
    }

    if (!col.fields.getByName('subtotal')) {
      col.fields.add(new NumberField({ name: 'subtotal' }))
    }

    if (!col.fields.getByName('discountValue')) {
      col.fields.add(new NumberField({ name: 'discountValue' }))
    }

    if (!col.fields.getByName('discountPercent')) {
      col.fields.add(new NumberField({ name: 'discountPercent' }))
    }

    if (!col.fields.getByName('cancelReason')) {
      col.fields.add(new TextField({ name: 'cancelReason' }))
    }

    if (!col.fields.getByName('appointmentId')) {
      const apptCol = app.findCollectionByNameOrId('appointments')
      col.fields.add(
        new RelationField({
          name: 'appointmentId',
          collectionId: apptCol.id,
          maxSelect: 1,
        }),
      )
    }

    if (!col.fields.getByName('updated')) {
      col.fields.add(new AutodateField({ name: 'updated', onCreate: true, onUpdate: true }))
    }

    app.save(col)

    // ------------------------------------------------------------
    // Backfill: marca as vendas existentes (geradas pelo prontuário
    // ou financeiro) como type = 'atendimento' para que o histórico
    // continue exibindo-as corretamente.
    // ------------------------------------------------------------
    try {
      const existing = app.findRecordsByFilter(
        'sales',
        "type = '' || type = null",
        '-created',
        500,
        0,
      )
      existing.forEach((r) => {
        r.set('type', 'atendimento')
        app.save(r)
      })
    } catch (_) {}
  },
  (app) => {
    const col = app.findCollectionByNameOrId('sales')
    ;[
      'type',
      'items',
      'subtotal',
      'discountValue',
      'discountPercent',
      'cancelReason',
      'appointmentId',
      'updated',
    ].forEach((fname) => {
      try {
        const f = col.fields.getByName(fname)
        if (f) col.fields.remove(f)
      } catch (_) {}
    })
    app.save(col)
  },
)
