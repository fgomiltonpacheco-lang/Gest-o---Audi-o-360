/// <reference path="../pb_data/pocketbase.d.ts" />
//
// 0065_public_signup_trial.js — Fase 3: cadastro self-service + trial.
//
// Altera a regra de create de `clinicas` para permitir cadastro público
// (sem auth) e adiciona a opção "trial" no select `status` de
// `pagamentos_saas`, usada no primeiro registro de pagamento de uma nova
// clínica em período de teste.
//
migrate(
  (app) => {
    // ============================================================
    // 1. `clinicas` — permite criação pública (cadastro self-service)
    //    O slug único (idx_clinicas_slug) continua protegendo contra
    //    duplicidade. A validação de campos sensíveis (e-mail/senha) fica
    //    no pb_hook publicSignup.js.
    // ============================================================
    const clinicasCol = app.findCollectionByNameOrId('clinicas')
    // Permite criar clínica sem autenticação (cadastro self-service).
    // list/view/update continuam restritos (super admin ou própria clínica).
    clinicasCol.createRule = ''
    app.save(clinicasCol)

    // ============================================================
    // 2. `pagamentos_saas` — adiciona "trial" no select `status`
    // ============================================================
    const pagamentosCol = app.findCollectionByNameOrId('pagamentos_saas')
    const statusField = pagamentosCol.fields.getByName('status')
    if (statusField) {
      const currentValues = statusField.values || []
      if (currentValues.indexOf('trial') === -1) {
        currentValues.push('trial')
        statusField.values = currentValues
      }
    }
    app.save(pagamentosCol)
  },
  (app) => {
    // ---- Reverte ----
    try {
      const clinicasCol = app.findCollectionByNameOrId('clinicas')
      clinicasCol.createRule = '@request.auth.is_super_admin = true'
      app.save(clinicasCol)
    } catch (_) {}

    try {
      const pagamentosCol = app.findCollectionByNameOrId('pagamentos_saas')
      const statusField = pagamentosCol.fields.getByName('status')
      if (statusField) {
        statusField.values = (statusField.values || []).filter((v) => v !== 'trial')
      }
      app.save(pagamentosCol)
    } catch (_) {}
  },
)
