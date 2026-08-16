migrate(
  (app) => {
    const usersColId = '_pb_users_auth_'

    // ============================================================
    // audit_trail — trilha de auditoria completa e imutável de
    // TODAS as ações críticas do sistema (não só LGPD).
    //
    // Regras:
    //  - Somente inserção via hooks server-side ($app.save ignora
    //    as regras de API). Nenhum usuário — nem admin — pode
    //    editar ou deletar registros de auditoria.
    //  - list/view restrito a admin.
    //  - create/update/delete = null (superusuário apenas).
    //  - Retenção mínima de 5 anos (ver constante no hook
    //    audit-trail.pb.js / config AUDIT_RETENTION_DAYS).
    // ============================================================
    const col = new Collection({
      name: 'audit_trail',
      type: 'base',
      listRule: '@request.auth.role = "admin"',
      viewRule: '@request.auth.role = "admin"',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        // Momento da ação (default now via autodate).
        { name: 'timestamp', type: 'autodate', onCreate: true, onUpdate: false },
        // Autor da ação (denormalizado para sobreviver à exclusão do usuário).
        {
          name: 'usuario_id',
          type: 'relation',
          required: false,
          maxSelect: 1,
          collectionId: usersColId,
          cascadeDelete: false,
        },
        { name: 'usuario_nome', type: 'text' },
        {
          name: 'usuario_perfil',
          type: 'select',
          required: false,
          maxSelect: 1,
          values: ['admin', 'profissional', 'secretaria'],
        },
        // Classificação da ação.
        {
          name: 'modulo',
          type: 'select',
          required: false,
          maxSelect: 1,
          values: [
            'pacientes',
            'agenda',
            'prontuario',
            'audiometria',
            'vendas_pdv',
            'vendas_b2b',
            'caixa',
            'estoque',
            'configuracoes',
            'parceiros',
            'relatorios',
          ],
        },
        {
          name: 'acao',
          type: 'select',
          required: false,
          maxSelect: 1,
          values: [
            'criar',
            'editar',
            'deletar',
            'cancelar',
            'estornar',
            'emitir_nf',
            'abrir_caixa',
            'fechar_caixa',
            'acessar',
            'exportar',
            'imprimir',
          ],
        },
        // Entidade afetada.
        { name: 'entidade_tipo', type: 'text' },
        { name: 'entidade_id', type: 'text' },
        { name: 'entidade_descricao', type: 'text' },
        // { campo: { before: x, after: y } } — apenas campos alterados.
        { name: 'alteracoes', type: 'json', maxSize: 5242880 },
        // Contexto da requisição.
        { name: 'ip', type: 'text' },
        { name: 'user_agent', type: 'text' },
        // Dados adicionais (motivo de cancelamento, saldos de caixa, etc.).
        { name: 'contexto', type: 'json', maxSize: 2097152 },
        // Campos obrigatórios de controle (convenção base collection).
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_audit_trail_usuario ON audit_trail (usuario_id)',
        'CREATE INDEX idx_audit_trail_modulo ON audit_trail (modulo)',
        'CREATE INDEX idx_audit_trail_acao ON audit_trail (acao)',
        'CREATE INDEX idx_audit_trail_entidade ON audit_trail (entidade_tipo, entidade_id)',
        'CREATE INDEX idx_audit_trail_created ON audit_trail (created)',
      ],
    })
    app.save(col)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('audit_trail'))
    } catch (_) {}
  },
)
