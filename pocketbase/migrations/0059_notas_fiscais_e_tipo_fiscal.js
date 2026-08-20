migrate(
  (app) => {
    // 1. Adiciona o campo `tipo_fiscal` na coleção `inventory`
    try {
      const invCol = app.findCollectionByNameOrId('inventory')
      if (!invCol.fields.getByName('tipo_fiscal')) {
        invCol.fields.add(
          new TextField({
            name: 'tipo_fiscal',
            required: false,
          }),
        )
        app.save(invCol)
      }
    } catch (e) {
      console.warn('Erro ao atualizar coleção inventory:', e)
    }

    // 2. Adiciona o campo `tipo_fiscal` na coleção `procedures`
    try {
      const procCol = app.findCollectionByNameOrId('procedures')
      if (!procCol.fields.getByName('tipo_fiscal')) {
        procCol.fields.add(
          new TextField({
            name: 'tipo_fiscal',
            required: false,
          }),
        )
        app.save(procCol)
      }
    } catch (e) {
      console.warn('Erro ao atualizar coleção procedures:', e)
    }

    // 3. Cria a nova coleção `notas_fiscais`
    if (!app.hasTable('notas_fiscais')) {
      const patientsColId = app.findCollectionByNameOrId('patients').id
      let salesColId = null
      try {
        salesColId = app.findCollectionByNameOrId('sales').id
      } catch (_) {
        salesColId = null
      }

      const fields = [
        { name: 'numero', type: 'number', required: true },
        { name: 'serie', type: 'text', required: false },
        { name: 'data_emissao', type: 'date', required: true },
        {
          name: 'paciente',
          type: 'relation',
          collectionId: patientsColId,
          maxSelect: 1,
          required: true,
          cascadeDelete: false,
        },
      ]

      if (salesColId) {
        fields.push({
          name: 'venda',
          type: 'relation',
          collectionId: salesColId,
          maxSelect: 1,
          required: false,
          cascadeDelete: false,
        })
      } else {
        fields.push({ name: 'venda', type: 'text', required: false })
      }

      fields.push(
        {
          name: 'tipo',
          type: 'text',
          required: true,
        },
        {
          name: 'itens',
          type: 'json',
          required: false,
        },
        {
          name: 'valor_total',
          type: 'number',
          required: true,
        },
        {
          name: 'chave_acesso',
          type: 'text',
          required: false,
        },
        {
          name: 'status',
          type: 'text',
          required: false,
        },
        {
          name: 'pdf_gerado',
          type: 'text',
          required: false,
        },
        {
          name: 'observacoes',
          type: 'text',
          required: false,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      )

      const col = new Collection({
        name: 'notas_fiscais',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: fields,
        indexes: [],
      })

      app.save(col)
    }
  },
  (app) => {
    // Reverter criação de notas_fiscais
    try {
      if (app.hasTable('notas_fiscais')) {
        const col = app.findCollectionByNameOrId('notas_fiscais')
        app.delete(col)
      }
    } catch (_) {}

    // Reverter campo tipo_fiscal em inventory
    try {
      const invCol = app.findCollectionByNameOrId('inventory')
      const f = invCol.fields.getByName('tipo_fiscal')
      if (f) {
        invCol.fields.remove(f)
        app.save(invCol)
      }
    } catch (_) {}

    // Reverter campo tipo_fiscal em procedures
    try {
      const procCol = app.findCollectionByNameOrId('procedures')
      const f = procCol.fields.getByName('tipo_fiscal')
      if (f) {
        procCol.fields.remove(f)
        app.save(procCol)
      }
    } catch (_) {}
  },
)
