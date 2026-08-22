/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0063: Adiciona campos JSON de coordenadas calibradas dos
 * templates PDF de laudo em `clinic_settings`.
 *
 * - coordenadas_audiometria (json): objeto AudiometriaCoordinates serializado
 *   (pontos X/Y em pt para cada campo do template de audiometria).
 * - coordenadas_imitanciometria (json): objeto ImitanciometriaCoordinates
 *   serializado (pontos X/Y em pt para cada campo do template de imitanciometria).
 *
 * Quando vazios, o preenchimento do PDF (pdfTemplateFiller) utiliza os valores
 * padrão calibrados para um template A4 (595 x 842 pt).
 */
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('clinic_settings')

    if (!col.fields.getByName('coordenadas_audiometria')) {
      col.fields.add(
        new JSONField({
          name: 'coordenadas_audiometria',
          required: false,
        }),
      )
    }

    if (!col.fields.getByName('coordenadas_imitanciometria')) {
      col.fields.add(
        new JSONField({
          name: 'coordenadas_imitanciometria',
          required: false,
        }),
      )
    }

    app.save(col)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('clinic_settings')
      const names = ['coordenadas_audiometria', 'coordenadas_imitanciometria']
      for (const n of names) {
        const f = col.fields.getByName(n)
        if (f) col.fields.remove(f)
      }
      app.save(col)
    } catch (_) {}
  },
)
