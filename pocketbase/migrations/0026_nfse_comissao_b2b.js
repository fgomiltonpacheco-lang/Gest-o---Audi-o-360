// NFS-e de Comissão B2B — substitui a "NF de Promoção de Vendas" por NFS-e
// sobre o valor da comissão. Renomeia numero_nf -> numero_nfse, adiciona os
// dados do tomador, motivo_cancelamento, pdf_url e o status
// "cancelada_prefeitura". Cria a coleção nfse_b2b_config (singleton) com os
// parâmetros de emissão (alíquota, item da lista, discriminação, inscrição
// municipal e credenciais da API da prefeitura).
migrate(
  (app) => {
    // ============================================================
    // 1) Coleção nf_servico_comissao — ajuste de campos
    // ============================================================
    const col = app.findCollectionByNameOrId('nf_servico_comissao')

    // Renomeia numero_nf -> numero_nfse (mantém os dados já gravados).
    const numeroNfField = col.fields.getByName('numero_nf')
    if (numeroNfField) {
      numeroNfField.name = 'numero_nfse'
    }

    // Adiciona os campos do tomador (empresa parceira compradora).
    if (!col.fields.getByName('tomador_cnpj')) {
      col.fields.add(new TextField({ name: 'tomador_cnpj' }))
    }
    if (!col.fields.getByName('tomador_razao_social')) {
      col.fields.add(new TextField({ name: 'tomador_razao_social' }))
    }
    if (!col.fields.getByName('tomador_endereco')) {
      col.fields.add(new TextField({ name: 'tomador_endereco' }))
    }
    if (!col.fields.getByName('tomador_municipio')) {
      col.fields.add(new TextField({ name: 'tomador_municipio' }))
    }
    if (!col.fields.getByName('tomador_uf')) {
      col.fields.add(new TextField({ name: 'tomador_uf' }))
    }
    if (!col.fields.getByName('tomador_cep')) {
      col.fields.add(new TextField({ name: 'tomador_cep' }))
    }
    if (!col.fields.getByName('tomador_email')) {
      col.fields.add(new TextField({ name: 'tomador_email' }))
    }

    // Cancelamento e PDF.
    if (!col.fields.getByName('motivo_cancelamento')) {
      col.fields.add(new TextField({ name: 'motivo_cancelamento' }))
    }
    if (!col.fields.getByName('pdf_url')) {
      col.fields.add(new TextField({ name: 'pdf_url' }))
    }

    // Inclui a opção "cancelada_prefeitura" no select `status`.
    const statusField = col.fields.getByName('status')
    const currentValues = statusField.values || []
    if (currentValues.indexOf('cancelada_prefeitura') === -1) {
      currentValues.push('cancelada_prefeitura')
      statusField.values = currentValues
    }

    // Recria o índice que referenciava `numero_nf` para usar `numero_nfse`.
    col.indexes = (col.indexes || []).map((idx) => idx.replace(/numero_nf\b/g, 'numero_nfse'))

    app.save(col)

    // ============================================================
    // 2) Coleção nfse_b2b_config — singleton de configuração da NFS-e
    // ============================================================
    let configCol
    try {
      configCol = app.findCollectionByNameOrId('nfse_b2b_config')
    } catch (_) {
      configCol = new Collection({
        name: 'nfse_b2b_config',
        type: 'base',
      })
    }
    configCol.listRule = "@request.auth.id != ''"
    configCol.viewRule = "@request.auth.id != ''"
    configCol.createRule = "@request.auth.role = 'admin'"
    configCol.updateRule = "@request.auth.role = 'admin'"
    configCol.deleteRule = "@request.auth.role = 'admin'"

    if (!configCol.fields.getByName('municipio')) {
      configCol.fields.add(new TextField({ name: 'municipio' }))
    }
    if (!configCol.fields.getByName('uf')) {
      configCol.fields.add(new TextField({ name: 'uf' }))
    }
    if (!configCol.fields.getByName('codigo_municipio')) {
      configCol.fields.add(new TextField({ name: 'codigo_municipio' }))
    }
    if (!configCol.fields.getByName('provedor')) {
      configCol.fields.add(
        new SelectField({
          name: 'provedor',
          required: false,
          values: ['BETHA', 'NOTABLU', 'SIMPLISS', 'GINFES', 'ABRASF', 'OUTRO'],
          maxSelect: 1,
        }),
      )
    }
    if (!configCol.fields.getByName('url_api')) {
      configCol.fields.add(new TextField({ name: 'url_api' }))
    }
    if (!configCol.fields.getByName('login_api')) {
      configCol.fields.add(new TextField({ name: 'login_api' }))
    }
    if (!configCol.fields.getByName('token_api')) {
      configCol.fields.add(new TextField({ name: 'token_api' }))
    }
    if (!configCol.fields.getByName('inscricao_municipal')) {
      configCol.fields.add(new TextField({ name: 'inscricao_municipal' }))
    }
    if (!configCol.fields.getByName('aliquota_iss_padrao')) {
      configCol.fields.add(new NumberField({ name: 'aliquota_iss_padrao' }))
    }
    if (!configCol.fields.getByName('item_lista_servico')) {
      configCol.fields.add(new TextField({ name: 'item_lista_servico' }))
    }
    if (!configCol.fields.getByName('discriminacao_padrao')) {
      configCol.fields.add(new TextField({ name: 'discriminacao_padrao' }))
    }
    if (!configCol.fields.getByName('ambiente')) {
      configCol.fields.add(
        new SelectField({
          name: 'ambiente',
          required: false,
          values: ['homologacao', 'producao'],
          maxSelect: 1,
        }),
      )
    }
    if (!configCol.fields.getByName('ativo')) {
      configCol.fields.add(new BoolField({ name: 'ativo' }))
    }
    if (!configCol.fields.getByName('created')) {
      configCol.fields.add(new AutodateField({ name: 'created', onCreate: true, onUpdate: false }))
    }
    if (!configCol.fields.getByName('updated')) {
      configCol.fields.add(new AutodateField({ name: 'updated', onCreate: true, onUpdate: true }))
    }

    app.save(configCol)
  },
  (app) => {
    // ---- Reverte nf_servico_comissao ----
    const col = app.findCollectionByNameOrId('nf_servico_comissao')
    const numeroNfseField = col.fields.getByName('numero_nfse')
    if (numeroNfseField) {
      numeroNfseField.name = 'numero_nf'
    }
    ;[
      'tomador_cnpj',
      'tomador_razao_social',
      'tomador_endereco',
      'tomador_municipio',
      'tomador_uf',
      'tomador_cep',
      'tomador_email',
      'motivo_cancelamento',
      'pdf_url',
    ].forEach((name) => {
      try {
        col.fields.removeByName(name)
      } catch (_) {}
    })
    const statusField = col.fields.getByName('status')
    if (statusField) {
      statusField.values = (statusField.values || []).filter((v) => v !== 'cancelada_prefeitura')
    }
    col.indexes = (col.indexes || []).map((idx) => idx.replace(/numero_nfse\b/g, 'numero_nf'))
    app.save(col)

    // ---- Remove nfse_b2b_config ----
    try {
      app.delete(app.findCollectionByNameOrId('nfse_b2b_config'))
    } catch (_) {}
  },
)
