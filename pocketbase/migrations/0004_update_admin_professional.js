// Atualiza o usuário administrador com os dados reais do fonoaudiólogo
// (Milton Soares Pacheco — CRFa 3-11981-5) e renomeia o profissional demo
// "Dra. Mariana Silva Costa" em todos os registros seed existentes.
migrate(
  (app) => {
    const OLD_NAME = 'Dra. Mariana Silva Costa'
    const NEW_NAME = 'Milton Soares Pacheco'
    const NEW_CRFA = '3-11981-5'

    // ---------------------------------------------------------------
    // 1. Usuário administrador (auth) — atualiza name, crmCrfa e role
    // ---------------------------------------------------------------
    try {
      const admin = app.findAuthRecordByEmail('_pb_users_auth_', 'admin@audicao360.com.br')
      admin.set('name', NEW_NAME)
      admin.set('crmCrfa', NEW_CRFA)
      admin.set('role', 'admin')
      app.save(admin)
      console.log('0004: usuário admin atualizado para', NEW_NAME, NEW_CRFA)
    } catch (err) {
      // Fallback pelo id fixo, caso o e-mail tenha mudado
      try {
        const admin = app.findFirstRecordByData('users', 'id', 'lxbe8m6zq58ya98')
        admin.set('name', NEW_NAME)
        admin.set('crmCrfa', NEW_CRFA)
        admin.set('role', 'admin')
        app.save(admin)
        console.log('0004: usuário admin atualizado por id para', NEW_NAME, NEW_CRFA)
      } catch (err2) {
        console.log('0004: usuário admin não encontrado, pulando atualização')
      }
    }

    // ---------------------------------------------------------------
    // 2. Dados demo — substitui o nome do profissional em todas as
    //    coleções onde aparece "Dra. Mariana Silva Costa".
    //    Usa SQL direto (idempotente) para atualização em massa.
    // ---------------------------------------------------------------
    const updates = [
      // professionalName
      ['appointments', 'professionalName'],
      ['evolutions', 'professionalName'],
      ['audiometries', 'professionalName'],
      ['tympanometries', 'professionalName'],
      ['beras', 'professionalName'],
      ['adjustments', 'professionalName'],
      ['commissions', 'professionalName'],
      // responsible
      ['maintenances', 'responsible'],
      ['cash_flow', 'responsible'],
      ['inventory_movements', 'responsible'],
    ]

    updates.forEach((u) => {
      const table = u[0]
      const col = u[1]
      if (!app.hasTable(table)) return
      const q = app
        .db()
        .newQuery(
          'UPDATE `' + table + '` SET `' + col + '` = {:newName} WHERE `' + col + '` = {:oldName}',
        )
        .bind({ newName: NEW_NAME, oldName: OLD_NAME })
      try {
        q.execute()
      } catch (e) {
        console.log('0004: falha ao atualizar ' + table + '.' + col + ': ' + e)
      }
    })

    console.log('0004: migração concluída')
  },
  (app) => {
    // Reverte apenas o usuário admin; os registros demo não são revertidos
    // pois o nome real do profissional deve permanecer.
    const OLD_NAME = 'Dra. Mariana Silva Costa'
    const OLD_CRFA = 'CRFa 2-18492'
    try {
      const admin = app.findAuthRecordByEmail('_pb_users_auth_', 'admin@audicao360.com.br')
      admin.set('name', OLD_NAME)
      admin.set('crmCrfa', OLD_CRFA)
      app.save(admin)
    } catch (_) {}
  },
)
