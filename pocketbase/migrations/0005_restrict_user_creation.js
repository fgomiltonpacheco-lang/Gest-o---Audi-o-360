// Restringe a coleção `users` para que apenas administradores criem, editem e
// excluam usuários. A criação pública (0003) é revertida: agora só admins
// podem criar novos acessos. Listagem/visualização exige autenticação.
// Atualização/exclusão permitem o próprio usuário alterar seus dados de perfil
// (incluindo senha), mas apenas o admin pode tocar registros de outros usuários.
// Exclusão do próprio usuário é bloqueada via regra.
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('users')

    // list/view: apenas usuários autenticados
    col.listRule = '@request.auth.id != ""'
    col.viewRule = '@request.auth.id != ""'

    // create: apenas admin
    col.createRule = '@request.auth.role = "admin"'

    // update: admin ou o próprio usuário
    col.updateRule = '@request.auth.role = "admin" || id = @request.auth.id'

    // delete: apenas admin, e nunca o próprio usuário
    col.deleteRule = '@request.auth.role = "admin" && id != @request.auth.id'

    app.save(col)
  },
  (app) => {
    // Restaura o estado anterior à migração 0003 (restrito ao próprio usuário)
    const col = app.findCollectionByNameOrId('users')
    col.listRule = 'id = @request.auth.id'
    col.viewRule = 'id = @request.auth.id'
    col.createRule = ''
    col.updateRule = 'id = @request.auth.id'
    col.deleteRule = 'id = @request.auth.id'
    app.save(col)
  },
)
