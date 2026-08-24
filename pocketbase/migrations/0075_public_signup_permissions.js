/// <reference path="../pb_data/pocketbase.d.ts" />
//
// 0075_public_signup_permissions.js
//
// Ajusta permissões de criação pública para:
// 1. `users` — permitir criação pública com createRule = "" (necessário para cadastro self-service)
// 2. `clinicas` — garantir createRule = "" para criação da clínica
// 3. `pagamentos_saas` — permitir criação autenticada ou pública (createRule = "") para o trial
//
migrate(
  (app) => {
    // 1. Users — permite cadastro self-service
    const usersCol = app.findCollectionByNameOrId('users')
    usersCol.createRule = ''
    app.save(usersCol)

    // 2. Clinicas — garante que a criação pública está habilitada
    const clinicasCol = app.findCollectionByNameOrId('clinicas')
    clinicasCol.createRule = ''
    app.save(clinicasCol)

    // 3. Pagamentos SaaS — permite criação pública do registro de trial
    const pagamentosCol = app.findCollectionByNameOrId('pagamentos_saas')
    pagamentosCol.createRule = ''
    app.save(pagamentosCol)
  },
  (app) => {
    try {
      const usersCol = app.findCollectionByNameOrId('users')
      usersCol.createRule = '@request.auth.role = "admin"'
      app.save(usersCol)
    } catch (_) {}

    try {
      const clinicasCol = app.findCollectionByNameOrId('clinicas')
      clinicasCol.createRule = '@request.auth.is_super_admin = true'
      app.save(clinicasCol)
    } catch (_) {}

    try {
      const pagamentosCol = app.findCollectionByNameOrId('pagamentos_saas')
      pagamentosCol.createRule = '@request.auth.is_super_admin = true'
      app.save(pagamentosCol)
    } catch (_) {}
  },
)
