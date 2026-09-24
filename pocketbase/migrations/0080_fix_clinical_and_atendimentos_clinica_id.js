// pocketbase/migrations/0080_fix_clinical_and_atendimentos_clinica_id.js
// Migration idempotente:
// Atribui clinica_id = 'tekgpi6lyeoz4or' a todos os registros cujo clinica_id esteja
// vazio ('' ou NULL) em todas as coleções afetadas pelos fluxos de atendimento clínico,
// exames, aparelhos e movimentações:
// - clinical_records
// - evolutions
// - audiometries
// - tympanometries
// - beras
// - hearing_aids
// - maintenances
// - adjustments
// - cash_flow
// - budgets
// - inventory_movements
// - commissions
//
// A migration é estrita e idempotente:
// NÃO altera registros de outras clínicas nem registros que já tenham clinica_id preenchido.

migrate(
  (app) => {
    const CLINICA_ID = 'tekgpi6lyeoz4or'

    const collections = [
      'clinical_records',
      'evolutions',
      'audiometries',
      'tympanometries',
      'beras',
      'hearing_aids',
      'maintenances',
      'adjustments',
      'cash_flow',
      'budgets',
      'inventory_movements',
      'commissions',
    ]

    for (const colName of collections) {
      try {
        // Verifica se a tabela/coleção existe no banco
        if (!app.hasTable(colName)) {
          continue
        }

        // Executa UPDATE idempotente via SQL direto com parâmetros seguros
        const query = `
          UPDATE ${colName}
          SET clinica_id = {:clinica_id}
          WHERE clinica_id IS NULL OR clinica_id = ''
        `
        app.db().newQuery(query).bind({ clinica_id: CLINICA_ID }).execute()
      } catch (err) {
        console.warn(`[0080] Erro ao atualizar clinica_id na colecao ${colName}:`, err)
      }
    }
  },
  (app) => {
    // Reversão não é necessária / segura pois registros órfãos não devem voltar a ser órfãos.
  },
)
