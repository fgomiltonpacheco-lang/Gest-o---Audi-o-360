// Adiciona campos de meatoscopia + encaminhado_por em `imitanciometrias`
// e gradiente_curva / curva_descricao / observacoes em `timpanometria_dados`,
// para alinhar o laudo de imitanciometria ao template do Dr. Adriano.
migrate(
  (app) => {
    // ---------- imitanciometrias ----------
    const imitCol = app.findCollectionByNameOrId('imitanciometrias')

    if (!imitCol.fields.getByName('encaminhado_por')) {
      imitCol.fields.add(new TextField({ name: 'encaminhado_por', required: false }))
    }
    if (!imitCol.fields.getByName('meatoscopia_od_normal')) {
      imitCol.fields.add(new BoolField({ name: 'meatoscopia_od_normal', required: false }))
    }
    if (!imitCol.fields.getByName('meatoscopia_od_alterada')) {
      imitCol.fields.add(new BoolField({ name: 'meatoscopia_od_alterada', required: false }))
    }
    if (!imitCol.fields.getByName('meatoscopia_od_obs')) {
      imitCol.fields.add(new TextField({ name: 'meatoscopia_od_obs', required: false }))
    }
    if (!imitCol.fields.getByName('meatoscopia_oe_normal')) {
      imitCol.fields.add(new BoolField({ name: 'meatoscopia_oe_normal', required: false }))
    }
    if (!imitCol.fields.getByName('meatoscopia_oe_alterada')) {
      imitCol.fields.add(new BoolField({ name: 'meatoscopia_oe_alterada', required: false }))
    }
    if (!imitCol.fields.getByName('meatoscopia_oe_obs')) {
      imitCol.fields.add(new TextField({ name: 'meatoscopia_oe_obs', required: false }))
    }
    app.save(imitCol)

    // ---------- timpanometria_dados ----------
    const timpCol = app.findCollectionByNameOrId('timpanometria_dados')

    if (!timpCol.fields.getByName('gradiente_curva')) {
      timpCol.fields.add(new NumberField({ name: 'gradiente_curva', required: false }))
    }
    if (!timpCol.fields.getByName('curva_descricao')) {
      timpCol.fields.add(new TextField({ name: 'curva_descricao', required: false }))
    }
    if (!timpCol.fields.getByName('observacoes')) {
      timpCol.fields.add(new TextField({ name: 'observacoes', required: false }))
    }
    app.save(timpCol)
  },
  (app) => {
    const removeFields = (colName, fieldNames) => {
      try {
        const col = app.findCollectionByNameOrId(colName)
        let changed = false
        fieldNames.forEach((fn) => {
          const f = col.fields.getByName(fn)
          if (f) {
            col.fields.remove(f)
            changed = true
          }
        })
        if (changed) app.save(col)
      } catch (_) {}
    }

    removeFields('imitanciometrias', [
      'encaminhado_por',
      'meatoscopia_od_normal',
      'meatoscopia_od_alterada',
      'meatoscopia_od_obs',
      'meatoscopia_oe_normal',
      'meatoscopia_oe_alterada',
      'meatoscopia_oe_obs',
    ])
    removeFields('timpanometria_dados', ['gradiente_curva', 'curva_descricao', 'observacoes'])
  },
)
