migrate(
  (app) => {
    const usersColId = '_pb_users_auth_'
    const patientsColId = app.findCollectionByNameOrId('patients').id

    // ============================================================
    // audit_logs — log imutável de auditoria LGPD.
    // Somente leitura via API: create/update/delete desabilitados
    // para qualquer usuário. Os registros são criados somente pelos
    // hooks server-side (audit-logs.pb.js), que executam com
    // privilégio de superusuário e ignoram as regras de API.
    // ============================================================
    const auditCol = new Collection({
      name: 'audit_logs',
      type: 'base',
      listRule: '@request.auth.role = "admin"',
      viewRule: '@request.auth.role = "admin"',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
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
          name: 'acao',
          type: 'select',
          required: false,
          maxSelect: 1,
          values: [
            'acessou_prontuario',
            'editou_prontuario',
            'editou_exame',
            'editou_evolucao',
            'editou_anamnese',
            'editou_aparelhos',
            'cancelou_venda',
            'estornou_venda',
            'editou_financeiro',
            'acessou_dados_sensiveis',
          ],
        },
        {
          name: 'paciente_id',
          type: 'relation',
          required: false,
          maxSelect: 1,
          collectionId: patientsColId,
          cascadeDelete: false,
        },
        { name: 'paciente_nome', type: 'text' },
        { name: 'recurso', type: 'text' },
        { name: 'recurso_id', type: 'text' },
        { name: 'detalhes', type: 'text' },
        { name: 'ip', type: 'text' },
        { name: 'user_agent', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_audit_logs_usuario ON audit_logs (usuario_id)',
        'CREATE INDEX idx_audit_logs_paciente ON audit_logs (paciente_id)',
        'CREATE INDEX idx_audit_logs_acao ON audit_logs (acao)',
        'CREATE INDEX idx_audit_logs_created ON audit_logs (created)',
      ],
    })
    app.save(auditCol)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('audit_logs'))
    } catch (_) {}
  },
)
