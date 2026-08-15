// Permite que novos usuários se cadastrem publicamente na coleção `users`
// (createRule = ""), mantendo as demais regras restritas ao próprio usuário
// autenticado. Necessário para o fluxo de "Criar conta" na página de Login.
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('users')

    // Criação pública: qualquer pessoa pode criar uma conta (cadastro)
    col.createRule = ''

    // Mantém as demais regras restritas ao próprio usuário autenticado
    col.listRule = 'id = @request.auth.id'
    col.viewRule = 'id = @request.auth.id'
    col.updateRule = 'id = @request.auth.id'
    col.deleteRule = 'id = @request.auth.id'

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('users')
    // Restaura o padrão restrito (apenas superusuários podem criar)
    col.createRule = null
    app.save(col)
  },
)
