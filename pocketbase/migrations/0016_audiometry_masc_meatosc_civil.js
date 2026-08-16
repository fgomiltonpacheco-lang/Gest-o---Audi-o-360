migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('audiometry_exams')

    // Estado civil (texto livre)
    if (!col.fields.getByName('marital_status')) {
      col.fields.add(new TextField({ name: 'marital_status' }))
    }

    // Mascaramento — via aérea (dB) OD / OE
    if (!col.fields.getByName('masking_air_od')) {
      col.fields.add(new NumberField({ name: 'masking_air_od' }))
    }
    if (!col.fields.getByName('masking_air_oe')) {
      col.fields.add(new NumberField({ name: 'masking_air_oe' }))
    }
    // Mascaramento — via óssea (dB) OD / OE
    if (!col.fields.getByName('masking_bone_od')) {
      col.fields.add(new NumberField({ name: 'masking_bone_od' }))
    }
    if (!col.fields.getByName('masking_bone_oe')) {
      col.fields.add(new NumberField({ name: 'masking_bone_oe' }))
    }

    // Inspeção do meato acústico externo (texto descritivo)
    if (!col.fields.getByName('meatoscopy_od')) {
      col.fields.add(new TextField({ name: 'meatoscopy_od' }))
    }
    if (!col.fields.getByName('meatoscopy_oe')) {
      col.fields.add(new TextField({ name: 'meatoscopy_oe' }))
    }

    // SRT (Speech Reception Threshold) por orelha — exibido abaixo de cada audiograma
    if (!col.fields.getByName('srt_od')) {
      col.fields.add(new NumberField({ name: 'srt_od' }))
    }
    if (!col.fields.getByName('srt_oe')) {
      col.fields.add(new NumberField({ name: 'srt_oe' }))
    }

    // IPRF estruturado (intensidade / monossílabos / dissílabos) — JSON por orelha
    if (!col.fields.getByName('iprf_vocal')) {
      col.fields.add(new JSONField({ name: 'iprf_vocal' }))
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('audiometry_exams')
    ;[
      'marital_status',
      'masking_air_od',
      'masking_air_oe',
      'masking_bone_od',
      'masking_bone_oe',
      'meatoscopy_od',
      'meatoscopy_oe',
      'srt_od',
      'srt_oe',
      'iprf_vocal',
    ].forEach((name) => {
      const f = col.fields.getByName(name)
      if (f) col.fields.remove(f)
    })
    app.save(col)
  },
)
