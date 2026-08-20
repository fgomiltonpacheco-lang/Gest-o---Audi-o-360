/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration: adiciona campos em `clinic_settings` para emissão do laudo de audiometria
 * - logo (file): upload da logomarca da clínica
 * - audiometro (text): modelo do audiômetro
 * - calibracao (text): data/descrição da calibração
 * - especialista_nome (text): nome do especialista/fonoaudiólogo
 * - especialista_crfa (text): CRFa do especialista
 */
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('clinic_settings')

    if (!col.fields.getByName('logo')) {
      col.fields.add(
        new FileField({
          name: 'logo',
          maxSelect: 1,
          maxSize: 5242880,
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif'],
        }),
      )
    }

    if (!col.fields.getByName('audiometro')) {
      col.fields.add(new TextField({ name: 'audiometro', required: false }))
    }

    if (!col.fields.getByName('calibracao')) {
      col.fields.add(new TextField({ name: 'calibracao', required: false }))
    }

    if (!col.fields.getByName('especialista_nome')) {
      col.fields.add(new TextField({ name: 'especialista_nome', required: false }))
    }

    if (!col.fields.getByName('especialista_crfa')) {
      col.fields.add(new TextField({ name: 'especialista_crfa', required: false }))
    }

    app.save(col)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('clinic_settings')
      const names = ['logo', 'audiometro', 'calibracao', 'especialista_nome', 'especialista_crfa']
      for (const n of names) {
        const f = col.fields.getByName(n)
        if (f) col.fields.remove(f)
      }
      app.save(col)
    } catch (_) {}
  },
)
