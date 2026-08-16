// Adiciona o campo `proceduresList` (json) à coleção `appointments` e faz o
// backfill dos registros antigos: agendamentos que já possuem `procedureId`
// (e `value`/`type`/`planType`) passam a ter também `proceduresList` como um
// array com um único item, mantendo compatibilidade com o campo legado.
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('appointments')

    // 1. Adiciona o campo JSON `proceduresList` (idempotente)
    if (!col.fields.getByName('proceduresList')) {
      col.fields.add(new JSONField({ name: 'proceduresList' }))
    }
    app.save(col)

    // 2. Backfill: para cada agendamento sem `proceduresList`, cria um array
    //    com um item a partir dos dados legados (`procedureId`, `type`,
    //    `value`, `planType`).
    let records = []
    try {
      records = app.findRecordsByFilter('appointments', '1 = 1', 'created', 0, 0)
    } catch (e) {
      // nenhum registro — nada a fazer
      records = []
    }

    records.forEach((rec) => {
      const existing = rec.get('proceduresList')
      if (existing && Array.isArray(existing) && existing.length > 0) {
        return // já possui lista — não sobrescreve
      }

      const procedureId = rec.getString('procedureId') || ''
      const procedureName = rec.getString('type') || ''
      const value = Number(rec.get('value') || 0)
      let planType = rec.getString('planType') || 'Particular'
      if (planType !== 'Particular' && planType !== 'SUS' && planType !== 'Convênio') {
        planType = 'Particular'
      }

      // Só cria a lista quando houver algum procedimento para registrar.
      if (!procedureId && !procedureName) {
        rec.set('proceduresList', [])
        app.save(rec)
        return
      }

      rec.set('proceduresList', [
        {
          procedureId: procedureId,
          procedureName: procedureName,
          value: value,
          planType: planType,
        },
      ])
      app.save(rec)
    })
  },
  (app) => {
    // Reverte removendo o campo (não é possível apagar dados do backfill com
    // segurança, mas a presença do campo não causa problemas de leitura).
    const col = app.findCollectionByNameOrId('appointments')
    const field = col.fields.getByName('proceduresList')
    if (field) {
      col.fields.remove(field)
      app.save(col)
    }
  },
)
