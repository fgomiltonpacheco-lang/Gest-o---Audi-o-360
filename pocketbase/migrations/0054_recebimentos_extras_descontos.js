// Adds support for "Acrescentar Produtos/Procedimentos" and "Desconto"
// in the "Registrar Recebimento" modal of Contas a Receber.
//
// New fields on the `recebimentos` collection:
//  - valor_base     (number): valor original da conta usado como base para o cálculo.
//  - itens_extras   (json):   lista de itens/procedimentos adicionais ({ nome, quantidade, valor_unitario, subtotal }).
//  - desconto_tipo  (select): "valor" | "percentual" | "" (sem desconto).
//  - desconto_valor (number): valor do desconto aplicado (em R$ quando tipo=valor, em % quando tipo=percentual).
//  - valor_total    (number): total efetivamente recebido (valor_base + soma(extras) - desconto em R$).
//
// The existing `valor` field keeps its meaning (valor efetivamente recebido), now
// igual a `valor_total` quando há extras/desconto. Mantemos ambos para não quebrar
// relatórios/consultas existentes: `valor` continua sendo o valor do recebimento.
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('recebimentos')

    if (!col.fields.getByName('valor_base')) {
      col.fields.add(new NumberField({ name: 'valor_base' }))
    }

    if (!col.fields.getByName('itens_extras')) {
      col.fields.add(new JSONField({ name: 'itens_extras' }))
    }

    if (!col.fields.getByName('desconto_tipo')) {
      col.fields.add(
        new SelectField({
          name: 'desconto_tipo',
          required: false,
          maxSelect: 1,
          values: ['valor', 'percentual'],
        }),
      )
    }

    if (!col.fields.getByName('desconto_valor')) {
      col.fields.add(new NumberField({ name: 'desconto_valor' }))
    }

    if (!col.fields.getByName('valor_total')) {
      col.fields.add(new NumberField({ name: 'valor_total' }))
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('recebimentos')

    try {
      const fvb = col.fields.getByName('valor_base')
      if (fvb) col.fields.remove(fvb)
    } catch (_) {}

    try {
      const fie = col.fields.getByName('itens_extras')
      if (fie) col.fields.remove(fie)
    } catch (_) {}

    try {
      const fdt = col.fields.getByName('desconto_tipo')
      if (fdt) col.fields.remove(fdt)
    } catch (_) {}

    try {
      const fdv = col.fields.getByName('desconto_valor')
      if (fdv) col.fields.remove(fdv)
    } catch (_) {}

    try {
      const fvt = col.fields.getByName('valor_total')
      if (fvt) col.fields.remove(fvt)
    } catch (_) {}

    app.save(col)
  },
)
