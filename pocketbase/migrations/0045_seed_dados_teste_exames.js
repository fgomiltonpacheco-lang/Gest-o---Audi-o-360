// 0045_seed_dados_teste_exames.js
// Cria dados de teste realistas: 2 audiometrias e 2 imitanciometrias
// para pacientes existentes, para validar o fluxo de impressão.
//
// Pacientes:
//  - Antônio Carlos de Albuquerque (yo6ar1r4xwqf334) — nasc 1952-04-15
//  - Maria Helena Ribeiro Ramos   (wcj49i6nwp7g8s8) — nasc 1960-08-22
// Profissional: Dr. Milton Soares Pacheco (lxbe8m6zq58ya98)
migrate(
  (app) => {
    const PAC_ANTONIO = 'yo6ar1r4xwqf334'
    const PAC_MARIA = 'wcj49i6nwp7g8s8'
    const USER_MILTON = 'lxbe8m6zq58ya98'

    // Helpers para construir AudiogramMap ({ "250": {db,symbol}, ... })
    const mkAir = (vals) => {
      const m = {}
      for (const [f, db] of Object.entries(vals)) {
        m[f] = { db, symbol: 'normal' }
      }
      return m
    }
    const mkBone = (vals) => {
      const m = {}
      for (const [f, db] of Object.entries(vals)) {
        m[f] = { db, symbol: 'normal' }
      }
      return m
    }

    // ============================================================
    // AUDIOMETRIA 1 — Antônio: perda neurossensorial leve-moderada bilateral
    // ============================================================
    const audCol = app.findCollectionByNameOrId('audiometry_exams')

    const aud1 = new Record(audCol)
    aud1.set('patient', PAC_ANTONIO)
    aud1.set('created_by', USER_MILTON)
    aud1.set('date', '2026-08-15')
    aud1.set('cpf', '123.456.789-00')
    aud1.set('dob', '1952-04-15')
    aud1.set('age', '74')
    aud1.set('sex', 'Masculino')
    aud1.set('referred_by', 'Dr. Otorrino — Clínica São Paulo')
    aud1.set('hearing_rest_14h', true)
    aud1.set('audiometer', 'Interacoustics AD229b')
    aud1.set('calibration', '2025-03-10')
    aud1.set('otoscopy_od', 'normal')
    aud1.set('otoscopy_oe', 'normal')
    aud1.set('meatoscopia_od', 'Normal')
    aud1.set('meatoscopia_oe', 'Normal')
    aud1.set(
      'air_od',
      mkAir({
        250: 15,
        500: 20,
        1000: 25,
        2000: 35,
        3000: 45,
        4000: 50,
        6000: 55,
        8000: 50,
      }),
    )
    aud1.set(
      'air_oe',
      mkAir({
        250: 15,
        500: 20,
        1000: 25,
        2000: 40,
        3000: 45,
        4000: 55,
        6000: 60,
        8000: 55,
      }),
    )
    aud1.set('bone_od', mkBone({ 500: 10, 1000: 15, 2000: 25, 3000: 35, 4000: 40 }))
    aud1.set('bone_oe', mkBone({ 500: 10, 1000: 15, 2000: 30, 3000: 35, 4000: 45 }))
    aud1.set('srt_od', 25)
    aud1.set('srt_oe', 25)
    aud1.set('ldv_od', 65)
    aud1.set('ldv_oe', 70)
    aud1.set('mt_od', 20)
    aud1.set('mt_oe', 21)
    aud1.set('iprf_od', 100)
    aud1.set('iprf_oe', 96)
    aud1.set('iprf_vocal', {
      od: {
        intensidade: 70,
        monossilabos: 100,
        dissilabos: 100,
        mascaramento: '',
        palavras_faladas: 25,
        niveis: '',
      },
      oe: {
        intensidade: 70,
        monossilabos: 96,
        dissilabos: 100,
        mascaramento: '',
        palavras_faladas: 25,
        niveis: '',
      },
    })
    aud1.set('loss_degree', 'Moderada')
    aud1.set('loss_type', 'Neurossensorial')
    aud1.set('loss_configuration', 'Descendente')
    aud1.set(
      'report',
      'Audiometria Tonal Limiar evidenciando perda auditiva do tipo neurossensorial de grau leve a moderado bilateralmente, simétrica. Limiares de reconhecimento de fala compatíveis com as médias tonais. Índice percentual de reconhecimento de fala adequado bilateralmente. Paciente apresenta perda auditiva neurossensorial bilateral. Recomenda-se avaliação otorrinolaringológica e uso de aparelhos de amplificação sonora individual.',
    )
    app.save(aud1)

    // ============================================================
    // AUDIOMETRIA 2 — Maria: perda mista moderada unilateral (OD pior)
    // ============================================================
    const aud2 = new Record(audCol)
    aud2.set('patient', PAC_MARIA)
    aud2.set('created_by', USER_MILTON)
    aud2.set('date', '2026-08-14')
    aud2.set('cpf', '234.567.890-11')
    aud2.set('dob', '1960-08-22')
    aud2.set('age', '65')
    aud2.set('sex', 'Feminino')
    aud2.set('referred_by', 'Dra. Otorrino — Hospital São Camilo')
    aud2.set('hearing_rest_14h', true)
    aud2.set('audiometer', 'Interacoustics AD229b')
    aud2.set('calibration', '2025-03-10')
    aud2.set('otoscopy_od', 'normal')
    aud2.set('otoscopy_oe', 'normal')
    aud2.set('meatoscopia_od', 'Normal')
    aud2.set('meatoscopia_oe', 'Normal')
    aud2.set(
      'air_od',
      mkAir({
        250: 40,
        500: 45,
        1000: 50,
        2000: 55,
        3000: 60,
        4000: 65,
        6000: 70,
        8000: 75,
      }),
    )
    aud2.set(
      'air_oe',
      mkAir({
        250: 10,
        500: 15,
        1000: 15,
        2000: 20,
        3000: 25,
        4000: 30,
        6000: 35,
        8000: 40,
      }),
    )
    aud2.set('bone_od', mkBone({ 500: 20, 1000: 25, 2000: 30, 3000: 35, 4000: 40 }))
    aud2.set('bone_oe', mkBone({ 500: 5, 1000: 10, 2000: 15, 3000: 20, 4000: 25 }))
    aud2.set('srt_od', 50)
    aud2.set('srt_oe', 15)
    aud2.set('ldv_od', 85)
    aud2.set('ldv_oe', 60)
    aud2.set('mt_od', 50)
    aud2.set('mt_oe', 17)
    aud2.set('iprf_od', 88)
    aud2.set('iprf_oe', 100)
    aud2.set('iprf_vocal', {
      od: {
        intensidade: 85,
        monossilabos: 88,
        dissilabos: 92,
        mascaramento: 50,
        palavras_faladas: 25,
        niveis: '',
      },
      oe: {
        intensidade: 45,
        monossilabos: 100,
        dissilabos: 100,
        mascaramento: '',
        palavras_faladas: 25,
        niveis: '',
      },
    })
    aud2.set('loss_degree', 'Moderada')
    aud2.set('loss_type', 'Mista')
    aud2.set('loss_configuration', 'Descendente')
    aud2.set(
      'report',
      'Perda auditiva mista de grau moderado à direita, com gap aéreo-ósseo de aproximadamente 25 dB, sugestiva de comprometimento do sistema tímpano-ossicular. Audição dentro dos padrões de normalidade à esquerda. Recomenda-se avaliação otorrinolaringológica para investigação etiológica e conduta.',
    )
    app.save(aud2)

    // ============================================================
    // IMITANCIOMETRIA 1 — Antônio: curva tipo A bilateral, reflexos presentes
    // ============================================================
    const imitCol = app.findCollectionByNameOrId('imitanciometrias')
    const timpCol = app.findCollectionByNameOrId('timpanometria_dados')
    const reflexCol = app.findCollectionByNameOrId('reflexo_acustico_dados')

    // Curva timpanométrica sintética tipo A (pico em ~-15 daPa, complacência ~0.8)
    const curveA = (peakP, peakC) => {
      const pts = []
      const N = 60
      const sigma = 75
      const amp = Math.min(peakC, 2.5)
      for (let i = 0; i <= N; i++) {
        const p = -400 + (600 * i) / N
        const c = amp * Math.exp(-((p - peakP) ** 2) / (2 * sigma * sigma))
        pts.push({ pressao: Math.round(p), complacencia: Number(c.toFixed(3)) })
      }
      return pts
    }
    // Curva tipo B (plana, complacência < 0.2)
    const curveB = () => {
      const pts = []
      const N = 60
      for (let i = 0; i <= N; i++) {
        const p = -400 + (600 * i) / N
        pts.push({ pressao: Math.round(p), complacencia: 0.12 })
      }
      return pts
    }

    const imit1 = new Record(imitCol)
    imit1.set('paciente_id', PAC_ANTONIO)
    imit1.set('data_exame', '2026-08-15')
    imit1.set('especialista_id', USER_MILTON)
    imit1.set('especialista_nome', 'Dr. Milton Soares Pacheco')
    imit1.set('equipment_nome', 'Interacoustics MT10')
    imit1.set('observacoes', '')
    imit1.set('status', 'finalizado')
    imit1.set('tipo_curva_od', 'A')
    imit1.set('tipo_curva_oe', 'A')
    imit1.set('reflexos_status', 'Normal')
    imit1.set(
      'laudo',
      'Curvas timpanométricas tipo A bilateralmente, indicando mobilidade normal do sistema tímpano-ossicular. Reflexos acústicos presentes bilateralmente em todas as frequências testadas.',
    )
    imit1.set(
      'referencias',
      'Avaliação imitanciométrica baseada em Jerger (1970); Margolis e Heller (1987) para valores de normalidade; classificação das curvas timpanométricas segundo Jerger (1970); reflexos acústicos segundo Stach (1998).',
    )
    imit1.set('encaminhado_por', 'Dr. Otorrino — Clínica São Paulo')
    imit1.set('meatoscopia_od_normal', true)
    imit1.set('meatoscopia_od_alterada', false)
    imit1.set('meatoscopia_od_obs', '')
    imit1.set('meatoscopia_oe_normal', true)
    imit1.set('meatoscopia_oe_alterada', false)
    imit1.set('meatoscopia_oe_obs', '')
    imit1.set('paciente_nome', 'Antônio Carlos de Albuquerque')
    imit1.set('paciente_cpf', '123.456.789-00')
    imit1.set('paciente_nascimento', '1952-04-15')
    imit1.set('paciente_idade', '74')
    imit1.set('paciente_sexo', 'Masculino')
    imit1.set('curva_timpanometrica_od', curveA(-15, 0.8))
    imit1.set('curva_timpanometrica_oe', curveA(-10, 0.9))
    app.save(imit1)

    // Timpanometria OD/OE
    const timp1Od = new Record(timpCol)
    timp1Od.set('imitanciometria_id', imit1.id)
    timp1Od.set('orelha', 'OD')
    timp1Od.set('volume_meato', 1.2)
    timp1Od.set('complacencia', 0.8)
    timp1Od.set('pressao_maxima', 0)
    timp1Od.set('tipo_curva', 'A')
    timp1Od.set('pressao_pico', -15)
    timp1Od.set('gradiente_curva', 55)
    timp1Od.set('curva_descricao', 'Curva tipo A com pico em -15 daPa')
    app.save(timp1Od)

    const timp1Oe = new Record(timpCol)
    timp1Oe.set('imitanciometria_id', imit1.id)
    timp1Oe.set('orelha', 'OE')
    timp1Oe.set('volume_meato', 1.1)
    timp1Oe.set('complacencia', 0.9)
    timp1Oe.set('pressao_maxima', 0)
    timp1Oe.set('tipo_curva', 'A')
    timp1Oe.set('pressao_pico', -10)
    timp1Oe.set('gradiente_curva', 60)
    timp1Oe.set('curva_descricao', 'Curva tipo A com pico em -10 daPa')
    app.save(timp1Oe)

    // Reflexos imit1
    const mkReflex = (imitId, orelha, via, f500, f1000, f2000, f4000, status) => {
      const r = new Record(reflexCol)
      r.set('imitanciometria_id', imitId)
      r.set('orelha', orelha)
      r.set('via', via)
      r.set('frequencia_500', f500)
      r.set('frequencia_1000', f1000)
      r.set('frequencia_2000', f2000)
      r.set('frequencia_4000', f4000)
      r.set('status', status)
      app.save(r)
    }
    mkReflex(imit1.id, 'OD', 'ipsi_lateral', 85, 85, 90, 95, 'presente')
    mkReflex(imit1.id, 'OD', 'contra_lateral', 90, 90, 95, 100, 'presente')
    mkReflex(imit1.id, 'OE', 'ipsi_lateral', 85, 85, 90, 95, 'presente')
    mkReflex(imit1.id, 'OE', 'contra_lateral', 90, 90, 95, null, 'presente')

    // ============================================================
    // IMITANCIOMETRIA 2 — Maria: curva tipo B à direita, tipo A à esquerda
    // ============================================================
    const imit2 = new Record(imitCol)
    imit2.set('paciente_id', PAC_MARIA)
    imit2.set('data_exame', '2026-08-14')
    imit2.set('especialista_id', USER_MILTON)
    imit2.set('especialista_nome', 'Dr. Milton Soares Pacheco')
    imit2.set('equipment_nome', 'Interacoustics MT10')
    imit2.set('observacoes', '')
    imit2.set('status', 'finalizado')
    imit2.set('tipo_curva_od', 'B')
    imit2.set('tipo_curva_oe', 'A')
    imit2.set('reflexos_status', 'Ausente à direita')
    imit2.set(
      'laudo',
      'Curva timpanométrica tipo B à direita, sugerindo disfunção de orelha média, com possível presença de líquido no espaço retrotrimpanular. Curva tipo A à esquerda com mobilidade do sistema tímpano-ossicular preservada. Reflexos acústicos ausentes à direita e presentes à esquerda.',
    )
    imit2.set(
      'referencias',
      'Avaliação imitanciométrica baseada em Jerger (1970); Margolis e Heller (1987) para valores de normalidade; classificação das curvas timpanométricas segundo Jerger (1970); reflexos acústicos segundo Stach (1998).',
    )
    imit2.set('encaminhado_por', 'Dra. Otorrino — Hospital São Camilo')
    imit2.set('meatoscopia_od_normal', false)
    imit2.set('meatoscopia_od_alterada', true)
    imit2.set('meatoscopia_od_obs', 'Membrana timpânica opaca, sem brilho reflexo')
    imit2.set('meatoscopia_oe_normal', true)
    imit2.set('meatoscopia_oe_alterada', false)
    imit2.set('meatoscopia_oe_obs', '')
    imit2.set('paciente_nome', 'Maria Helena Ribeiro Ramos')
    imit2.set('paciente_cpf', '234.567.890-11')
    imit2.set('paciente_nascimento', '1960-08-22')
    imit2.set('paciente_idade', '65')
    imit2.set('paciente_sexo', 'Feminino')
    imit2.set('curva_timpanometrica_od', curveB())
    imit2.set('curva_timpanometrica_oe', curveA(-20, 0.7))
    app.save(imit2)

    const timp2Od = new Record(timpCol)
    timp2Od.set('imitanciometria_id', imit2.id)
    timp2Od.set('orelha', 'OD')
    timp2Od.set('volume_meato', 0.3)
    timp2Od.set('complacencia', 0.1)
    timp2Od.set('pressao_maxima', 0)
    timp2Od.set('tipo_curva', 'B')
    timp2Od.set('pressao_pico', null)
    timp2Od.set('gradiente_curva', null)
    timp2Od.set('curva_descricao', 'Curva tipo B — plana, sem pico definido')
    app.save(timp2Od)

    const timp2Oe = new Record(timpCol)
    timp2Oe.set('imitanciometria_id', imit2.id)
    timp2Oe.set('orelha', 'OE')
    timp2Oe.set('volume_meato', 1.0)
    timp2Oe.set('complacencia', 0.7)
    timp2Oe.set('pressao_maxima', 0)
    timp2Oe.set('tipo_curva', 'A')
    timp2Oe.set('pressao_pico', -20)
    timp2Oe.set('gradiente_curva', 58)
    timp2Oe.set('curva_descricao', 'Curva tipo A com pico em -20 daPa')
    app.save(timp2Oe)

    // Reflexos imit2 — OD todos ausentes, OE presentes
    mkReflex(imit2.id, 'OD', 'ipsi_lateral', null, null, null, null, 'ausente')
    mkReflex(imit2.id, 'OD', 'contra_lateral', null, null, null, null, 'ausente')
    mkReflex(imit2.id, 'OE', 'ipsi_lateral', 85, 85, 90, 95, 'presente')
    mkReflex(imit2.id, 'OE', 'contra_lateral', 90, 90, 95, 100, 'presente')
  },
  (app) => {
    // Reversível: remove os exames de teste criados por esta migration.
    // Identificamos pelas datas e pacientes.
    const tryDel = (collection, ids) => {
      for (const id of ids) {
        try {
          app.delete(app.findRecordById(collection, id))
        } catch (_) {}
      }
    }
    // Não há marca própria; a reversão remove por filtro de paciente+data.
    const cleanupByFilter = (collection, filter) => {
      try {
        const recs = app.findRecordsByFilter(collection, filter)
        for (const r of recs) {
          // remove subcoleções de imitanciometrias
          if (collection === 'imitanciometrias') {
            try {
              const t = app.findRecordsByFilter(
                'timpanometria_dados',
                `imitanciometria_id="${r.id}"`,
              )
              for (const x of t) app.delete(x)
            } catch (_) {}
            try {
              const rf = app.findRecordsByFilter(
                'reflexo_acustico_dados',
                `imitanciometria_id="${r.id}"`,
              )
              for (const x of rf) app.delete(x)
            } catch (_) {}
          }
          app.delete(r)
        }
      } catch (_) {}
    }

    cleanupByFilter('audiometry_exams', `patient="yo6ar1r4xwqf334" && date="2026-08-15"`)
    cleanupByFilter('audiometry_exams', `patient="wcj49i6nwp7g8s8" && date="2026-08-14"`)
    cleanupByFilter('imitanciometrias', `paciente_id="yo6ar1r4xwqf334" && data_exame="2026-08-15"`)
    cleanupByFilter('imitanciometrias', `paciente_id="wcj49i6nwp7g8s8" && data_exame="2026-08-14"`)
  },
)
