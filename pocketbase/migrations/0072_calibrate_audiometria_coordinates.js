/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0072: Grava coordenadas calibradas de audiometria para o registro
 * ol2egon1y3uaga5 na coleção clinic_settings.
 */
migrate(
  (app) => {
    try {
      const record = app.findFirstRecordByData('clinic_settings', 'id', 'ol2egon1y3uaga5')
      const coordenadas = {
        nome: { x: 78, y: 730 },
        data: { x: 468, y: 730 },
        cpf: { x: 72, y: 708 },
        nascimento: { x: 230, y: 708 },
        sexoF: { x: 372, y: 708 },
        sexoM: { x: 400, y: 708 },
        convenio: { x: 488, y: 708 },
        audiometro: { x: 108, y: 686 },
        calibracao: { x: 450, y: 686 },
        graficoOD: { left: 52, top: 642, width: 220, height: 148 },
        graficoOE: { left: 326, top: 642, width: 220, height: 148 },
        mtOD: { x: 80, y: 460 },
        lrfOD: { x: 154, y: 460 },
        ldvOD: { x: 232, y: 460 },
        mtOE: { x: 348, y: 460 },
        lrfOE: { x: 422, y: 460 },
        ldvOE: { x: 500, y: 460 },
        iprfOD: {
          intensidadeX: 98,
          dissilabosX: 160,
          monossilabosX: 225,
          mascaramentoX: 258,
          y: 408,
        },
        iprfOE: {
          intensidadeX: 98,
          dissilabosX: 160,
          monossilabosX: 225,
          mascaramentoX: 258,
          y: 392,
        },
        parecer: { x: 45, y: 195 },
        assinaturaNome: { x: 247, y: 90 },
        assinaturaCrfa: { x: 247, y: 76 },
        rodape: { x: 247, y: 32 },
        logo: { left: 45, top: 805, width: 120, height: 42 },
      }

      record.set('coordenadas_audiometria', coordenadas)
      app.save(record)
    } catch (err) {
      console.log(
        'Registro clinic_settings ol2egon1y3uaga5 não encontrado na migration 0072 ou erro ao salvar:',
        err,
      )
    }
  },
  (app) => {
    try {
      const record = app.findFirstRecordByData('clinic_settings', 'id', 'ol2egon1y3uaga5')
      record.set('coordenadas_audiometria', null)
      app.save(record)
    } catch (_) {}
  },
)
