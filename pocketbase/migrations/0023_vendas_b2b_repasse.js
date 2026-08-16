migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('vendas_b2b')

    // status_repasse: controla o repasse da comissão da empresa parceira
    // para a Audição360 após a emissão da NF de Promoção de Vendas.
    // - pendente: NF emitida, aguardando repasse
    // - recebido: empresa parceira repassou os 30% para a Audição360
    if (!col.fields.getByName('status_repasse')) {
      col.fields.add(
        new SelectField({
          name: 'status_repasse',
          values: ['pendente', 'recebido'],
          maxSelect: 1,
        }),
      )
    }

    // data_recebimento_comissao: data em que o repasse foi confirmado.
    if (!col.fields.getByName('data_recebimento_comissao')) {
      col.fields.add(
        new DateField({
          name: 'data_recebimento_comissao',
        }),
      )
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('vendas_b2b')
    try {
      col.fields.removeByName('status_repasse')
    } catch (_) {}
    try {
      col.fields.removeByName('data_recebimento_comissao')
    } catch (_) {}
    app.save(col)
  },
)
