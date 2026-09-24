// pocketbase/migrations/0079_fix_sales_contas_receber_clinica_id.js
// Tarefa estrita:
// 1. Atribuir clinica_id = "tekgpi6lyeoz4or" aos registros:
//    - venda s4h6zv3ch7oloif (coleção sales)
//    - parcela ipykoi9ge7dkjg6 (coleção installments)
//    - conta a receber zjyzl9yeqmb54lk (coleção contas_receber)
// 2. Excluir a venda demo órfã ool6grkshmeyui4 (coleção sales).
//
// A migration é idempotente e não toca em nenhum outro registro.

migrate(
  (app) => {
    const CLINICA_ID = 'tekgpi6lyeoz4or'
    const SALE_ID = 's4h6zv3ch7oloif'
    const INSTALLMENT_ID = 'ipykoi9ge7dkjg6'
    const CONTA_RECEBER_ID = 'zjyzl9yeqmb54lk'
    const ORPHAN_SALE_ID = 'ool6grkshmeyui4'

    // 1. Atualizar venda s4h6zv3ch7oloif com clinica_id = "tekgpi6lyeoz4or"
    try {
      const sale = app.findFirstRecordByData('sales', 'id', SALE_ID)
      if (sale && sale.getString('clinica_id') !== CLINICA_ID) {
        sale.set('clinica_id', CLINICA_ID)
        app.save(sale)
      }
    } catch (_) {
      try {
        app
          .db()
          .newQuery(
            'UPDATE sales SET clinica_id = {:clinica_id} WHERE id = {:id} AND (clinica_id IS NULL OR clinica_id != {:clinica_id})',
          )
          .bind({ clinica_id: CLINICA_ID, id: SALE_ID })
          .execute()
      } catch (sqlErr) {
        console.warn('[0079] Erro SQL ao atualizar sale:', sqlErr)
      }
    }

    // 2. Atualizar parcela ipykoi9ge7dkjg6 com clinica_id = "tekgpi6lyeoz4or"
    try {
      const inst = app.findFirstRecordByData('installments', 'id', INSTALLMENT_ID)
      if (inst && inst.getString('clinica_id') !== CLINICA_ID) {
        inst.set('clinica_id', CLINICA_ID)
        app.save(inst)
      }
    } catch (_) {
      try {
        app
          .db()
          .newQuery(
            'UPDATE installments SET clinica_id = {:clinica_id} WHERE id = {:id} AND (clinica_id IS NULL OR clinica_id != {:clinica_id})',
          )
          .bind({ clinica_id: CLINICA_ID, id: INSTALLMENT_ID })
          .execute()
      } catch (sqlErr) {
        console.warn('[0079] Erro SQL ao atualizar installment:', sqlErr)
      }
    }

    // 3. Atualizar conta a receber zjyzl9yeqmb54lk com clinica_id = "tekgpi6lyeoz4or"
    try {
      const conta = app.findFirstRecordByData('contas_receber', 'id', CONTA_RECEBER_ID)
      if (conta && conta.getString('clinica_id') !== CLINICA_ID) {
        conta.set('clinica_id', CLINICA_ID)
        app.save(conta)
      }
    } catch (_) {
      try {
        app
          .db()
          .newQuery(
            'UPDATE contas_receber SET clinica_id = {:clinica_id} WHERE id = {:id} AND (clinica_id IS NULL OR clinica_id != {:clinica_id})',
          )
          .bind({ clinica_id: CLINICA_ID, id: CONTA_RECEBER_ID })
          .execute()
      } catch (sqlErr) {
        console.warn('[0079] Erro SQL ao atualizar conta_receber:', sqlErr)
      }
    }

    // 4. Excluir a venda demo órfã ool6grkshmeyui4 (coleção sales)
    try {
      const orphanSale = app.findFirstRecordByData('sales', 'id', ORPHAN_SALE_ID)
      if (orphanSale) {
        app.delete(orphanSale)
      }
    } catch (_) {
      try {
        app
          .db()
          .newQuery('DELETE FROM sales WHERE id = {:id}')
          .bind({ id: ORPHAN_SALE_ID })
          .execute()
      } catch (sqlErr) {
        console.warn('[0079] Erro SQL ao deletar venda orfa:', sqlErr)
      }
    }
  },
  (app) => {
    // Reversão opcional (não reverte a deleção do registro órfão)
    const SALE_ID = 's4h6zv3ch7oloif'
    const INSTALLMENT_ID = 'ipykoi9ge7dkjg6'
    const CONTA_RECEBER_ID = 'zjyzl9yeqmb54lk'

    try {
      const sale = app.findFirstRecordByData('sales', 'id', SALE_ID)
      if (sale && sale.getString('clinica_id') === 'tekgpi6lyeoz4or') {
        sale.set('clinica_id', '')
        app.save(sale)
      }
    } catch (_) {}

    try {
      const inst = app.findFirstRecordByData('installments', 'id', INSTALLMENT_ID)
      if (inst && inst.getString('clinica_id') === 'tekgpi6lyeoz4or') {
        inst.set('clinica_id', '')
        app.save(inst)
      }
    } catch (_) {}

    try {
      const conta = app.findFirstRecordByData('contas_receber', 'id', CONTA_RECEBER_ID)
      if (conta && conta.getString('clinica_id') === 'tekgpi6lyeoz4or') {
        conta.set('clinica_id', '')
        app.save(conta)
      }
    } catch (_) {}
  },
)
