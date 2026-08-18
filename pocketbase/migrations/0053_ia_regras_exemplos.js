// Coleções para o Editor de Regras da IA:
// - ia_regras: prompt do sistema, regras de correção, termos proibidos/obrigatórios (1 por usuário)
// - ia_exemplos: pares texto_original → texto_corrigido para few-shot (N por usuário)
// Regras de acesso: usuário autenticado gerencia apenas seus próprios registros.

migrate(
  (app) => {
    // ---------- ia_regras ----------
    const regras = new Collection({
      name: 'ia_regras',
      type: 'base',
      listRule: '@request.auth.id != "" && user_id = @request.auth.id',
      viewRule: '@request.auth.id != "" && user_id = @request.auth.id',
      createRule: '@request.auth.id != "" && user_id = @request.body.user_id',
      updateRule: '@request.auth.id != "" && user_id = @request.auth.id',
      deleteRule: '@request.auth.id != "" && user_id = @request.auth.id',
      fields: [
        {
          name: 'user_id',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'prompt_sistema', type: 'text' },
        { name: 'regras_correcao', type: 'text' },
        { name: 'termos_proibidos', type: 'text' },
        { name: 'termos_obrigatorios', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_ia_regras_user ON ia_regras (user_id)'],
    })
    app.save(regras)

    // ---------- ia_exemplos ----------
    const exemplos = new Collection({
      name: 'ia_exemplos',
      type: 'base',
      listRule: '@request.auth.id != "" && user_id = @request.auth.id',
      viewRule: '@request.auth.id != "" && user_id = @request.auth.id',
      createRule: '@request.auth.id != "" && user_id = @request.body.user_id',
      updateRule: '@request.auth.id != "" && user_id = @request.auth.id',
      deleteRule: '@request.auth.id != "" && user_id = @request.auth.id',
      fields: [
        {
          name: 'user_id',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'texto_original', type: 'text', required: true },
        { name: 'texto_corrigido', type: 'text', required: true },
        { name: 'ordem', type: 'number' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_ia_exemplos_user_ordem ON ia_exemplos (user_id, ordem)'],
    })
    app.save(exemplos)
  },
  (app) => {
    try {
      const c1 = app.findCollectionByNameOrId('ia_regras')
      app.delete(c1)
    } catch (_) {}
    try {
      const c2 = app.findCollectionByNameOrId('ia_exemplos')
      app.delete(c2)
    } catch (_) {}
  },
)
