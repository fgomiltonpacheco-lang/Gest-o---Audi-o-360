migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('equipments')

    if (!col.fields.getByName('tipo')) {
      col.fields.add(
        new SelectField({
          name: 'tipo',
          values: ['Audiômetro', 'Imitanciômetro'],
          maxSelect: 1,
        }),
      )
      app.save(col)
    }

    // Atualiza registros existentes baseado no nome ou padrão
    try {
      const records = app.findRecordsByFilter('equipments', '1=1', '', 0, 0)
      for (const rec of records) {
        const nome = (rec.getString('nome') || '').toLowerCase()
        const tipoAtual = rec.getString('tipo')
        if (!tipoAtual) {
          if (nome.includes('at235') || nome.includes('imitanc') || nome.includes('timpan')) {
            rec.set('tipo', 'Imitanciômetro')
          } else {
            // AD229b ou padrão para audiômetro
            rec.set('tipo', 'Audiômetro')
          }
          app.save(rec)
        }
      }
    } catch (e) {
      console.warn('[0077_add_tipo_to_equipments] Erro ao atualizar registros existentes:', e)
    }
  },
  (app) => {
    const col = app.findCollectionByNameOrId('equipments')
    const f = col.fields.getByName('tipo')
    if (f) {
      col.fields.remove(f)
      app.save(col)
    }
  },
)
