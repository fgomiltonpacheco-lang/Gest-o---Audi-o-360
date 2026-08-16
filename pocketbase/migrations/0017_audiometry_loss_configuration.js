migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('audiometry_exams')

    // Configuração da perda auditiva (Plana, Ascendente, Descendente, Mista)
    if (!col.fields.getByName('loss_configuration')) {
      col.fields.add(
        new SelectField({
          name: 'loss_configuration',
          values: ['', 'Plana', 'Ascendente', 'Descendente', 'Mista'],
          maxSelect: 1,
        }),
      )
    }

    // Níveis adicionais de IPRF (texto livre — ex.: "100% a 45 dB, 76% a 95 dB")
    if (!col.fields.getByName('iprf_levels_od')) {
      col.fields.add(new TextField({ name: 'iprf_levels_od' }))
    }
    if (!col.fields.getByName('iprf_levels_oe')) {
      col.fields.add(new TextField({ name: 'iprf_levels_oe' }))
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('audiometry_exams')
    ;['loss_configuration', 'iprf_levels_od', 'iprf_levels_oe'].forEach((name) => {
      const f = col.fields.getByName(name)
      if (f) col.fields.remove(f)
    })
    app.save(col)
  },
)
