/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0062: Adiciona campos de templates PDF em `clinic_settings`
 * - template_audiometria (file, PDF)
 * - template_imitanciometria (file, PDF)
 */
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('clinic_settings')

    if (!col.fields.getByName('template_audiometria')) {
      col.fields.add(
        new FileField({
          name: 'template_audiometria',
          maxSelect: 1,
          maxSize: 15728640, // 15MB
          mimeTypes: ['application/pdf'],
        }),
      )
    }

    if (!col.fields.getByName('template_imitanciometria')) {
      col.fields.add(
        new FileField({
          name: 'template_imitanciometria',
          maxSelect: 1,
          maxSize: 15728640, // 15MB
          mimeTypes: ['application/pdf'],
        }),
      )
    }

    app.save(col)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('clinic_settings')
      const names = ['template_audiometria', 'template_imitanciometria']
      for (const n of names) {
        const f = col.fields.getByName(n)
        if (f) col.fields.remove(f)
      }
      app.save(col)
    } catch (_) {}
  },
)
