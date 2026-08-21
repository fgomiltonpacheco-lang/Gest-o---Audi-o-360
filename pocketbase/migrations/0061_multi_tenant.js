migrate(
  (app) => {
    // 1. Criar coleção 'planos'
    const planosCol = new Collection({
      name: 'planos',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'nome', type: 'text', required: true },
        { name: 'preco_mensal', type: 'number' },
        { name: 'funcionalidades', type: 'json' },
        { name: 'max_profissionais', type: 'number' },
        { name: 'ativo', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_planos_ativo ON planos (ativo)'],
    })
    app.save(planosCol)

    // 2. Seed de planos
    let planoBasicoId = ''
    let planoProfissionalId = ''
    let planoPremiumId = ''

    const rBasico = new Record(planosCol)
    rBasico.set('nome', 'Básico')
    rBasico.set('preco_mensal', 97)
    rBasico.set('funcionalidades', ['agenda', 'pacientes', 'prontuario', 'exames', 'financeiro'])
    rBasico.set('max_profissionais', 3)
    rBasico.set('ativo', true)
    app.save(rBasico)
    planoBasicoId = rBasico.id

    const rProf = new Record(planosCol)
    rProf.set('nome', 'Profissional')
    rProf.set('preco_mensal', 197)
    rProf.set('funcionalidades', [
      'agenda',
      'pacientes',
      'prontuario',
      'exames',
      'financeiro',
      'aparelhos',
      'estoque',
      'relatorios',
      'laudos_pdf',
    ])
    rProf.set('max_profissionais', 10)
    rProf.set('ativo', true)
    app.save(rProf)
    planoProfissionalId = rProf.id

    const rPrem = new Record(planosCol)
    rPrem.set('nome', 'Premium')
    rPrem.set('preco_mensal', 297)
    rPrem.set('funcionalidades', [
      'agenda',
      'pacientes',
      'prontuario',
      'exames',
      'financeiro',
      'aparelhos',
      'estoque',
      'relatorios',
      'laudos_pdf',
      'b2b',
      'auditoria',
      'ia',
      'chat',
      'nfse',
      'contas_receber',
      'despesas',
      'lembretes_whatsapp',
    ])
    rPrem.set('max_profissionais', 50)
    rPrem.set('ativo', true)
    app.save(rPrem)
    planoPremiumId = rPrem.id

    // 3. Criar coleção 'clinicas'
    const clinicasCol = new Collection({
      name: 'clinicas',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (id = @request.auth.clinica_id || @request.auth.role = 'admin')",
      viewRule:
        "@request.auth.id != '' && (id = @request.auth.clinica_id || @request.auth.role = 'admin')",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && id = @request.auth.clinica_id",
      deleteRule: null,
      fields: [
        { name: 'nome', type: 'text', required: true },
        { name: 'slug', type: 'text', required: true },
        {
          name: 'logo',
          type: 'file',
          maxSelect: 1,
          maxSize: 5242880,
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
        },
        { name: 'endereco', type: 'text' },
        { name: 'telefone', type: 'text' },
        { name: 'email', type: 'text' },
        { name: 'cnpj', type: 'text' },
        { name: 'inscricao_estadual', type: 'text' },
        { name: 'inscricao_municipal', type: 'text' },
        { name: 'certificado_digital', type: 'file', maxSelect: 1, maxSize: 10485760 },
        {
          name: 'status',
          type: 'select',
          values: ['trial', 'ativo', 'inadimplente', 'cancelado'],
          maxSelect: 1,
        },
        { name: 'trial_ends', type: 'date' },
        { name: 'plano_id', type: 'relation', collectionId: planosCol.id, maxSelect: 1 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_clinicas_slug ON clinicas (slug)'],
    })
    app.save(clinicasCol)

    // 4. Criar clínica padrão para a clínica existente
    const clinicaPadrao = new Record(clinicasCol)
    clinicaPadrao.set('nome', 'Audição360')
    clinicaPadrao.set('slug', 'audicao360')
    clinicaPadrao.set(
      'endereco',
      'Rua Herculano Coelho de Souza, 1047 - Reunidas, Caçador - SC, CEP: 89504-590',
    )
    clinicaPadrao.set('telefone', '(63) 3421-2611')
    clinicaPadrao.set('email', 'audicao360@gmail.com')
    clinicaPadrao.set('status', 'ativo')
    clinicaPadrao.set('plano_id', planoPremiumId)
    app.save(clinicaPadrao)
    const clinicaPadraoId = clinicaPadrao.id

    // 5. Adicionar clinica_id na coleção 'users'
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    if (!usersCol.fields.getByName('clinica_id')) {
      usersCol.fields.add(new TextField({ name: 'clinica_id' }))
      app.save(usersCol)
    }

    // Vincular todos os usuários existentes à clínica padrão
    app
      .db()
      .newQuery(
        "UPDATE users SET clinica_id = {:clinica_id} WHERE clinica_id IS NULL OR clinica_id = ''",
      )
      .bind({ clinica_id: clinicaPadraoId })
      .execute()

    // 6. Lista de coleções de dados clínicos e operacionais para isolamento multi-tenant
    const tenantCollections = [
      'patients',
      'appointments',
      'clinical_records',
      'evolutions',
      'audiometries',
      'tympanometries',
      'beras',
      'hearing_aids',
      'maintenances',
      'adjustments',
      'budgets',
      'sales',
      'installments',
      'commissions',
      'cash_flow',
      'inventory',
      'inventory_movements',
      'procedures',
      'blocked_days',
      'clinic_config',
      'audiometry_exams',
      'clinic_settings',
      'equipments',
      'fechamentos_caixa',
      'movimentacoes_caixa',
      'empresas_parceiras',
      'vendas_b2b',
      'itens_venda_b2b',
      'nf_servico_comissao',
      'hearing_aid_tests',
      'nfse_b2b_config',
      'consentimentos',
      'audit_logs',
      'audit_trail',
      'imitanciometrias',
      'timpanometria_dados',
      'reflexo_acustico_dados',
      'contas_receber',
      'recebimentos',
      'lembretes_whatsapp',
      'whatsapp_config',
      'despesas',
      'exam_report_templates',
      'exam_report_template_versions',
      'ordens_servico',
      'nfse_emitidas',
      'testes_aparelho',
      'mensagens',
      'ia_regras',
      'ia_exemplos',
      'notas_fiscais',
    ]

    for (const colName of tenantCollections) {
      try {
        const col = app.findCollectionByNameOrId(colName)
        if (!col.fields.getByName('clinica_id')) {
          col.fields.add(new TextField({ name: 'clinica_id' }))
        }

        // Definir regras RLS de isolamento por clinica_id
        col.listRule = "@request.auth.id != '' && clinica_id = @request.auth.clinica_id"
        col.viewRule = "@request.auth.id != '' && clinica_id = @request.auth.clinica_id"
        col.createRule = "@request.auth.id != '' && @request.auth.clinica_id != ''"
        col.updateRule = "@request.auth.id != '' && clinica_id = @request.auth.clinica_id"
        col.deleteRule = "@request.auth.id != '' && clinica_id = @request.auth.clinica_id"

        app.save(col)

        // Migrar registros existentes para a clínica padrão
        app
          .db()
          .newQuery(
            'UPDATE `' +
              colName +
              "` SET clinica_id = {:clinica_id} WHERE clinica_id IS NULL OR clinica_id = ''",
          )
          .bind({ clinica_id: clinicaPadraoId })
          .execute()

        // Adicionar índice para performance do filtro de clinica_id
        col.addIndex('idx_' + colName + '_clinica_id', false, 'clinica_id', '')
        app.save(col)
      } catch (e) {
        console.warn('Erro ao processar coleção ' + colName + ':', e)
      }
    }
  },
  (app) => {
    // Revert
    try {
      const clinicas = app.findCollectionByNameOrId('clinicas')
      app.delete(clinicas)
    } catch (_) {}

    try {
      const planos = app.findCollectionByNameOrId('planos')
      app.delete(planos)
    } catch (_) {}
  },
)
