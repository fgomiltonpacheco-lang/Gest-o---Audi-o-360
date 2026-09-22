// pocketbase/migrations/0078_fix_milton_pacheco_clinica_id.js
// Atualiza o registro do paciente Milton Soares Pacheco (id: wvsokzdgcmquakj)
// definindo clinica_id = 'tekgpi6lyeoz4or'.
// Idempotente: só atualiza se clinica_id estiver vazio ou diferente de 'tekgpi6lyeoz4or'.
// Não toca em nenhum outro registro, clínica ou coleção.

migrate(
  (app) => {
    const PATIENT_ID = 'wvsokzdgcmquakj'
    const CLINICA_ID = 'tekgpi6lyeoz4or'

    try {
      const patient = app.findFirstRecordByData('patients', 'id', PATIENT_ID)
      if (patient) {
        const currentClinicaId = patient.getString('clinica_id')
        if (currentClinicaId !== CLINICA_ID) {
          patient.set('clinica_id', CLINICA_ID)
          app.save(patient)
          console.log(
            `[0078_fix_milton_pacheco_clinica_id] Paciente ${PATIENT_ID} atualizado com clinica_id = ${CLINICA_ID}`,
          )
        }
      }
    } catch (err) {
      console.warn(
        '[0078_fix_milton_pacheco_clinica_id] Paciente não encontrado ou erro ao atualizar via SDK:',
        err,
      )
      // Fallback via raw SQL com checagem estrita por id
      try {
        app
          .db()
          .newQuery(
            'UPDATE patients SET clinica_id = {:clinica_id} WHERE id = {:id} AND (clinica_id IS NULL OR clinica_id != {:clinica_id})',
          )
          .bind({ clinica_id: CLINICA_ID, id: PATIENT_ID })
          .execute()
      } catch (sqlErr) {
        console.warn('[0078_fix_milton_pacheco_clinica_id] Erro no fallback SQL:', sqlErr)
      }
    }
  },
  (app) => {
    // Revert opcional: remove o clinica_id do paciente específico se necessário
    try {
      const patient = app.findFirstRecordByData('patients', 'id', 'wvsokzdgcmquakj')
      if (patient && patient.getString('clinica_id') === 'tekgpi6lyeoz4or') {
        patient.set('clinica_id', '')
        app.save(patient)
      }
    } catch (_) {}
  },
)
