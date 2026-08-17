// 0043_imitanciometria_curva_timpanometrica.js
// Adiciona campos `curva_timpanometrica_od` e `curva_timpanometrica_oe`
// (JSON com array de pontos {pressao, complacencia}) à coleção
// `imitanciometrias`, para alimentar o gráfico timpanométrico real.
migrate(
  (app) => {
    let col
    try {
      col = app.findCollectionByNameOrId('imitanciometrias')
    } catch (_) {
      return
    }

    if (!col.fields.getByName('curva_timpanometrica_od')) {
      col.fields.add(new JSONField({ name: 'curva_timpanometrica_od', maxSize: 1048576 }))
    }
    if (!col.fields.getByName('curva_timpanometrica_oe')) {
      col.fields.add(new JSONField({ name: 'curva_timpanometrica_oe', maxSize: 1048576 }))
    }
    app.save(col)
  },
  (app) => {
    // Reversível: remove os campos de curva timpanométrica.
    try {
      const col = app.findCollectionByNameOrId('imitanciometrias')
      const od = col.fields.getByName('curva_timpanometrica_od')
      if (od) col.fields.remove(od)
      const oe = col.fields.getByName('curva_timpanometrica_oe')
      if (oe) col.fields.remove(oe)
      app.save(col)
    } catch (_) {}
  },
)
