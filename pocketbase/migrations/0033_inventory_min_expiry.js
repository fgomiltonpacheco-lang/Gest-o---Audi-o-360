migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('inventory')

    // estoque_minimo: quantidade mínima antes de alertar (default 0)
    if (!col.fields.getByName('estoque_minimo')) {
      col.fields.add(new NumberField({ name: 'estoque_minimo', onlyInt: true, min: 0 }))
    }

    // data_validade: data de validade para produtos perecíveis (nullable)
    if (!col.fields.getByName('data_validade')) {
      col.fields.add(new DateField({ name: 'data_validade' }))
    }

    // lote: número do lote (nullable)
    if (!col.fields.getByName('lote')) {
      col.fields.add(new TextField({ name: 'lote' }))
    }

    // fabricante (nullable)
    if (!col.fields.getByName('fabricante')) {
      col.fields.add(new TextField({ name: 'fabricante' }))
    }

    // dias_alerta_validade: quantos dias antes do vencimento alertar (default 30)
    if (!col.fields.getByName('dias_alerta_validade')) {
      col.fields.add(new NumberField({ name: 'dias_alerta_validade', onlyInt: true, min: 0 }))
    }

    // categoria: enum de categoria do item
    if (!col.fields.getByName('categoria')) {
      col.fields.add(
        new SelectField({
          name: 'categoria',
          values: ['aparelho', 'consumivel', 'servico', 'acessorio', 'bateria', 'molde', 'filtro'],
          maxSelect: 1,
        }),
      )
    }

    // unidade_medida: unidade de medida do item (un, cx, par, ...)
    if (!col.fields.getByName('unidade_medida')) {
      col.fields.add(new TextField({ name: 'unidade_medida' }))
    }

    // ⚠ Persiste o schema PRIMEIRO — só assim as colunas físicas existem
    // antes de qualquer SQL que as referencie (UPDATE / CREATE INDEX).
    app.save(col)

    // Defaults para registros existentes — garante que campos numéricos
    // não fiquem nulos, evitando erros de UI/API.
    app
      .db()
      .newQuery('UPDATE inventory SET estoque_minimo = 0 WHERE estoque_minimo IS NULL')
      .execute()
    app
      .db()
      .newQuery('UPDATE inventory SET dias_alerta_validade = 30 WHERE dias_alerta_validade IS NULL')
      .execute()

    // Índices (idempotentes via col.addIndex) — adicionados DEPOIS do save,
    // pois as colunas precisam existir fisicamente no SQLite.
    col.addIndex('idx_inventory_estoque_minimo', false, 'estoque_minimo', '')
    col.addIndex('idx_inventory_categoria', false, 'categoria', '')
    col.addIndex('idx_inventory_data_validade', false, 'data_validade', '')
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('inventory')
    try {
      col.removeIndex('idx_inventory_data_validade')
    } catch (_) {}
    try {
      col.removeIndex('idx_inventory_estoque_minimo')
    } catch (_) {}
    try {
      col.removeIndex('idx_inventory_categoria')
    } catch (_) {}
    ;[
      'estoque_minimo',
      'data_validade',
      'lote',
      'fabricante',
      'dias_alerta_validade',
      'categoria',
      'unidade_medida',
    ].forEach((name) => {
      try {
        const f = col.fields.getByName(name)
        if (f) col.fields.remove(f)
      } catch (_) {}
    })
    app.save(col)
  },
)
