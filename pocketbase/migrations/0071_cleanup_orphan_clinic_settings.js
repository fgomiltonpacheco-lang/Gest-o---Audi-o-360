migrate(
  (app) => {
    // 1. Remove registros órfãos de clinic_settings que não possuem clinica_id ou cujo clinica_id está vazio
    try {
      app
        .db()
        .newQuery("DELETE FROM clinic_settings WHERE clinica_id IS NULL OR clinica_id = ''")
        .execute()
    } catch (e) {
      console.log('Aviso ao limpar registros órfãos de clinic_settings:', e)
    }
  },
  () => {
    // Reversão não é necessária pois são registros órfãos de teste sem clínica vinculada
  },
)
