migrate(
  (app) => {
    const apptsColId = app.findCollectionByNameOrId('appointments').id
    const patientsColId = app.findCollectionByNameOrId('patients').id

    // ============================================================
    // Collection: lembretes_whatsapp
    // Lembretes de consulta enviados por WhatsApp aos pacientes,
    // com controle de envio (status_envio) e de confirmação de
    // presença (status_confirmacao) pelo paciente.
    // ============================================================
    const lembCol = new Collection({
      name: 'lembretes_whatsapp',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.role = 'admin'",
      fields: [
        {
          name: 'agendamento_id',
          type: 'relation',
          required: false,
          collectionId: apptsColId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'paciente_id',
          type: 'relation',
          required: false,
          collectionId: patientsColId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'telefone', type: 'text' },
        { name: 'mensagem', type: 'text' },
        // data_envio: horário agendado para o envio (datetime ISO).
        { name: 'data_envio', type: 'date' },
        {
          name: 'status_envio',
          type: 'select',
          required: false,
          maxSelect: 1,
          values: ['pendente', 'enviado', 'falhou', 'entregue', 'lido'],
        },
        {
          name: 'status_confirmacao',
          type: 'select',
          required: false,
          maxSelect: 1,
          values: ['aguardando', 'confirmado', 'cancelado', 'sem_resposta'],
        },
        // data_confirmacao: quando o paciente respondeu (datetime ISO).
        { name: 'data_confirmacao', type: 'date' },
        { name: 'resposta_paciente', type: 'text' },
        { name: 'tentativas', type: 'number' },
        { name: 'error_message', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_lembretes_status_envio ON lembretes_whatsapp (status_envio)',
        'CREATE INDEX idx_lembretes_status_conf ON lembretes_whatsapp (status_confirmacao)',
        'CREATE INDEX idx_lembretes_data_envio ON lembretes_whatsapp (data_envio)',
        'CREATE INDEX idx_lembretes_agendamento ON lembretes_whatsapp (agendamento_id)',
        'CREATE INDEX idx_lembretes_paciente ON lembretes_whatsapp (paciente_id)',
      ],
    })
    app.save(lembCol)

    // ============================================================
    // Collection: whatsapp_config
    // Singleton com as configurações de envio de lembretes por
    // WhatsApp (token da API, instância remetente, template de
    // mensagem, dias antes do envio, horário padrão e toggle de
    // envio automático).
    // ============================================================
    const cfgCol = new Collection({
      name: 'whatsapp_config',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.role = 'admin'",
      updateRule: "@request.auth.role = 'admin'",
      deleteRule: '@request.auth.role = "admin"',
      fields: [
        // Token/chave da API do provedor (Z-API, Evolution, etc.).
        { name: 'api_token', type: 'text' },
        // URL base da API do provedor.
        { name: 'api_url', type: 'text' },
        // Instância/telefone remetente (ex.: 5549999999999).
        { name: 'instancia', type: 'text' },
        // Provedor da API (zapi | evolution | whatsapp_business | outro).
        { name: 'provedor', type: 'text' },
        // Template de mensagem com variáveis {nome_paciente}, etc.
        { name: 'template_mensagem', type: 'text' },
        // Quantos dias antes enviar (1, 2 ou 7).
        { name: 'dias_antes', type: 'number' },
        // Horário padrão de envio no dia (HH:MM).
        { name: 'horario_envio', type: 'text' },
        // Ativar/desativar envio automático.
        { name: 'ativo', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(cfgCol)

    // ------------------------------------------------------------
    // Seed do singleton de configuração com os valores padrão
    // definidos na especificação do módulo.
    // ------------------------------------------------------------
    try {
      var existing = app.findRecordsByFilter('whatsapp_config', "id != ''", '', 1)
      if (!existing || existing.length === 0) {
        var cfgCol2 = app.findCollectionByNameOrId('whatsapp_config')
        var rec = new Record(cfgCol2)
        rec.set('api_token', '')
        rec.set('api_url', '')
        rec.set('instancia', '')
        rec.set('provedor', 'evolution')
        rec.set(
          'template_mensagem',
          'Olá {nome_paciente}! Este é um lembrete da sua consulta na Audição 360.\n' +
            '📅 Data: {data_consulta}\n' +
            '🕐 Horário: {horario}\n' +
            '📋 Procedimento: {procedimento}\n' +
            'Confirme sua presença respondendo SIM ou cancele respondendo NÃO.\n' +
            'Endereço: Rua Herculano Coelho de Souza, 1047 — Caçador/SC',
        )
        rec.set('dias_antes', 1)
        rec.set('horario_envio', '09:00')
        rec.set('ativo', false)
        app.save(rec)
      }
    } catch (_) {}
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('lembretes_whatsapp'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('whatsapp_config'))
    } catch (_) {}
  },
)
