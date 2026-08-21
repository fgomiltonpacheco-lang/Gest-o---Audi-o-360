/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0060: Adiciona campos fiscais e upload de certificado digital em `clinic_settings`
 * - cnpj (text): CNPJ da clínica
 * - inscricao_estadual (text): Inscrição Estadual (IE)
 * - inscricao_municipal (text): Inscrição Municipal (IM)
 * - certificado_digital (file): Certificado Digital (.pfx, .p12, .pem)
 */
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('clinic_settings')

    if (!col.fields.getByName('cnpj')) {
      col.fields.add(new TextField({ name: 'cnpj', required: false }))
    }

    if (!col.fields.getByName('inscricao_estadual')) {
      col.fields.add(new TextField({ name: 'inscricao_estadual', required: false }))
    }

    if (!col.fields.getByName('inscricao_municipal')) {
      col.fields.add(new TextField({ name: 'inscricao_municipal', required: false }))
    }

    if (!col.fields.getByName('certificado_digital')) {
      col.fields.add(
        new FileField({
          name: 'certificado_digital',
          maxSelect: 1,
          maxSize: 10485760, // 10MB
          mimeTypes: [],
        }),
      )
    }

    app.save(col)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('clinic_settings')
      const names = ['cnpj', 'inscricao_estadual', 'inscricao_municipal', 'certificado_digital']
      for (const n of names) {
        const f = col.fields.getByName(n)
        if (f) col.fields.remove(f)
      }
      app.save(col)
    } catch (_) {}
  },
)
