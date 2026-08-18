migrate(
  (app) => {
    // ============================================================
    // Collection: mensagens
    // Chat interno entre usuários do sistema.
    // - remetente: usuário que enviou (relation -> users)
    // - destinatario: usuário destinatário (relation -> users, opcional).
    //   Quando nulo, a mensagem é direcionada ao grupo/todos.
    // - texto: conteúdo da mensagem (obrigatório)
    // - lida: indica se o destinatário já visualizou (default false)
    // ============================================================
    const usersColId = '_pb_users_auth_'

    const mensagensCol = new Collection({
      name: 'mensagens',
      type: 'base',
      // Usuários autenticados podem listar e visualizar mensagens.
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      // Qualquer usuário autenticado pode enviar mensagens.
      createRule: "@request.auth.id != ''",
      // Permite marcar como lida (atualização) apenas para usuários autenticados.
      updateRule: "@request.auth.id != ''",
      // Exclusão restrita a superusuários (null) — apenas admins do PocketBase.
      deleteRule: null,
      fields: [
        {
          name: 'remetente',
          type: 'relation',
          required: true,
          collectionId: usersColId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'destinatario',
          type: 'relation',
          required: false,
          collectionId: usersColId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'texto', type: 'text', required: true },
        { name: 'lida', type: 'bool', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_mensagens_remetente ON mensagens (remetente)',
        'CREATE INDEX idx_mensagens_destinatario ON mensagens (destinatario)',
        'CREATE INDEX idx_mensagens_lida ON mensagens (lida)',
        'CREATE INDEX idx_mensagens_created ON mensagens (created DESC)',
      ],
    })
    app.save(mensagensCol)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('mensagens'))
    } catch (_) {}
  },
)
