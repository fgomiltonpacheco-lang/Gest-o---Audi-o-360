migrate(
  (app) => {
    const pacientesColId = app.findCollectionByNameOrId('patients').id
    const aparelhosColId = app.findCollectionByNameOrId('hearing_aids').id
    const usersColId = '_pb_users_auth_'

    const col = new Collection({
      name: 'ordens_servico',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        // Número sequencial por ano (ex: 2025/001). Armazenamos apenas o
        // sequencial numérico; o ano é derivado de data_entrada. O campo
        // `numero` guarda o inteiro sequencial do ano.
        { name: 'numero', type: 'number' },
        // Ano da OS (extraído de data_entrada) para compor ANO/XXX.
        { name: 'ano', type: 'number' },
        {
          name: 'paciente',
          type: 'relation',
          collectionId: pacientesColId,
          maxSelect: 1,
          required: true,
          cascadeDelete: false,
        },
        {
          name: 'aparelho',
          type: 'relation',
          collectionId: aparelhosColId,
          maxSelect: 1,
          required: false,
          cascadeDelete: false,
        },
        {
          name: 'tipo_servico',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: [
            'conserto',
            'manutencao',
            'revisao',
            'ajuste',
            'teste_aparelho',
            'limpeza',
            'molde',
            'outro',
          ],
        },
        { name: 'descricao_problema', type: 'text' },
        { name: 'descricao_servico', type: 'text' },
        {
          name: 'status',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: [
            'aberta',
            'em_andamento',
            'aguardando_aprovacao',
            'aguardando_pecas',
            'concluida',
            'entregue',
            'cancelada',
          ],
        },
        { name: 'data_entrada', type: 'date' },
        { name: 'data_prevista', type: 'date' },
        { name: 'data_saida', type: 'date' },
        { name: 'valor', type: 'number' },
        {
          name: 'forma_pagamento',
          type: 'select',
          required: false,
          maxSelect: 1,
          values: [
            'dinheiro',
            'pix',
            'cartao_credito',
            'cartao_debito',
            'boleto',
            'convenio',
            'gratuito',
            'nao_definido',
          ],
        },
        {
          name: 'tecnico',
          type: 'relation',
          collectionId: usersColId,
          maxSelect: 1,
          required: false,
          cascadeDelete: false,
        },
        { name: 'observacoes', type: 'text' },
        { name: 'garantia', type: 'bool' },
        { name: 'dias_garantia', type: 'number' },
        { name: 'motivo_cancelamento', type: 'text' },
        // Timeline de histórico de mudanças de status (de → para, data/hora, usuário).
        { name: 'historico_status', type: 'json', maxSize: 5242880 },
        {
          name: 'criado_por',
          type: 'relation',
          collectionId: usersColId,
          maxSelect: 1,
          required: false,
          cascadeDelete: false,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_ordens_servico_paciente ON ordens_servico (paciente)',
        'CREATE INDEX idx_ordens_servico_status ON ordens_servico (status)',
        'CREATE INDEX idx_ordens_servico_data_entrada ON ordens_servico (data_entrada)',
        'CREATE INDEX idx_ordens_servico_numero ON ordens_servico (ano, numero)',
        'CREATE UNIQUE INDEX idx_ordens_servico_ano_numero ON ordens_servico (ano, numero)',
      ],
    })
    app.save(col)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('ordens_servico'))
    } catch (_) {}
  },
)
