migrate(
  (app) => {
    // ============================================================
    // 1. Adicionar is_super_admin na coleção users (auth)
    //    Permite identificar o dono do SaaS (Dr. Milton).
    // ============================================================
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    if (!usersCol.fields.getByName('is_super_admin')) {
      // Bool flag — NÃO marcar como required (bool required rejeita false).
      usersCol.fields.add(new BoolField({ name: 'is_super_admin' }))
    }
    app.save(usersCol)

    // ============================================================
    // 2. Adicionar max_pacientes em planos + relaxar regras
    //    Super admins podem criar/editar/excluir planos.
    // ============================================================
    const planosCol = app.findCollectionByNameOrId('planos')
    if (!planosCol.fields.getByName('max_pacientes')) {
      planosCol.fields.add(new NumberField({ name: 'max_pacientes' }))
    }
    planosCol.listRule = "@request.auth.id != ''"
    planosCol.viewRule = "@request.auth.id != ''"
    planosCol.createRule = '@request.auth.is_super_admin = true'
    planosCol.updateRule = '@request.auth.is_super_admin = true'
    planosCol.deleteRule = '@request.auth.is_super_admin = true'
    app.save(planosCol)

    // Popular max_pacientes nos planos existentes
    app
      .db()
      .newQuery(
        'UPDATE planos SET max_pacientes = CASE ' +
          "WHEN lower(nome) LIKE '%bás%' OR lower(nome) LIKE '%basico%' THEN 100 " +
          "WHEN lower(nome) LIKE '%profis%' THEN 500 " +
          "WHEN lower(nome) LIKE '%prem%' THEN 2000 " +
          'ELSE 100 END ' +
          'WHERE max_pacientes IS NULL OR max_pacientes = 0',
      )
      .execute()

    // ============================================================
    // 3. Relaxar regras de clinicas
    //    Super admins listam/vêem todas; podem criar/atualizar/excluir.
    // ============================================================
    const clinicasCol = app.findCollectionByNameOrId('clinicas')
    clinicasCol.listRule =
      "@request.auth.id != '' && (@request.auth.is_super_admin = true || id = @request.auth.clinica_id)"
    clinicasCol.viewRule =
      "@request.auth.id != '' && (@request.auth.is_super_admin = true || id = @request.auth.clinica_id)"
    clinicasCol.createRule = '@request.auth.is_super_admin = true'
    clinicasCol.updateRule =
      "@request.auth.id != '' && (@request.auth.is_super_admin = true || id = @request.auth.clinica_id)"
    clinicasCol.deleteRule = '@request.auth.is_super_admin = true'
    app.save(clinicasCol)

    // ============================================================
    // 4. Criar coleção pagamentos_saas
    //    Controle de mensalidades por clínica (somente super admin).
    // ============================================================
    const pagamentosCol = new Collection({
      name: 'pagamentos_saas',
      type: 'base',
      listRule: "@request.auth.id != '' && @request.auth.is_super_admin = true",
      viewRule: "@request.auth.id != '' && @request.auth.is_super_admin = true",
      createRule: '@request.auth.is_super_admin = true',
      updateRule: '@request.auth.is_super_admin = true',
      deleteRule: '@request.auth.is_super_admin = true',
      fields: [
        {
          name: 'clinica_id',
          type: 'relation',
          collectionId: clinicasCol.id,
          maxSelect: 1,
          required: true,
        },
        { name: 'plano_id', type: 'relation', collectionId: planosCol.id, maxSelect: 1 },
        { name: 'valor', type: 'number', required: true },
        { name: 'data_vencimento', type: 'date', required: true },
        { name: 'data_pagamento', type: 'date' },
        {
          name: 'forma_pagamento',
          type: 'select',
          values: ['pix', 'boleto', 'cartao', 'transferencia', 'dinheiro'],
          maxSelect: 1,
        },
        {
          name: 'status',
          type: 'select',
          values: ['pago', 'pendente', 'atrasado'],
          maxSelect: 1,
          required: true,
        },
        { name: 'referencia', type: 'text' },
        { name: 'observacoes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_pagamentos_saas_clinica ON pagamentos_saas (clinica_id)',
        'CREATE INDEX idx_pagamentos_saas_status ON pagamentos_saas (status)',
        'CREATE INDEX idx_pagamentos_saas_vencimento ON pagamentos_saas (data_vencimento)',
      ],
    })
    app.save(pagamentosCol)

    // ============================================================
    // 5. Marcar o Dr. Milton como super admin
    // ============================================================
    try {
      const adminRec = app.findAuthRecordByEmail('_pb_users_auth_', 'admin@audicao360.com.br')
      adminRec.set('is_super_admin', true)
      app.save(adminRec)
    } catch (e) {
      console.warn('Não foi possível marcar admin como super_admin:', e)
    }

    // ============================================================
    // 6. Seed: clínicas demo + pagamentos para popular o painel
    // ============================================================
    function dateOffset(days) {
      var d = new Date()
      d.setDate(d.getDate() + days)
      return d.toISOString().split('T')[0]
    }
    function monthRef(offset) {
      var d = new Date()
      d.setMonth(d.getMonth() + offset)
      var y = d.getFullYear()
      var m = String(d.getMonth() + 1).padStart(2, '0')
      return y + '-' + m
    }
    function nowDateStr() {
      return new Date().toISOString().split('T')[0]
    }

    // Resolver IDs dos planos por nome
    var planoBasicoId = ''
    var planoProfId = ''
    var planoPremId = ''
    var planosList = app.findRecordsByFilter('planos', '', 'nome', 100, 0)
    for (var i = 0; i < planosList.length; i++) {
      var nm = (planosList[i].getString('nome') || '').toLowerCase()
      if (nm.indexOf('bás') >= 0 || nm.indexOf('basico') >= 0) planoBasicoId = planosList[i].id
      else if (nm.indexOf('profis') >= 0) planoProfId = planosList[i].id
      else if (nm.indexOf('prem') >= 0) planoPremId = planosList[i].id
    }

    // Clínica padrão (Audição360) — já existe; capturar o id
    var clinicaPadraoId = ''
    try {
      clinicaPadraoId = app.findFirstRecordByData('clinicas', 'slug', 'audicao360').id
    } catch (_) {}

    // Clínicas demo (idempotentes por slug)
    var demos = [
      {
        nome: 'Clínica Auditiva Sul',
        slug: 'clinica-auditiva-sul',
        email: 'contato@clinicaauditivasul.com.br',
        cnpj: '12.345.678/0001-90',
        telefone: '(48) 3333-1234',
        endereco: 'Av. Paulista, 1000 - São Paulo/SP',
        status: 'trial',
        plano: planoBasicoId,
        trial_ends: dateOffset(12),
      },
      {
        nome: 'Centro Auditivo Norte',
        slug: 'centro-auditivo-norte',
        email: 'financeiro@centroauditivonorte.com.br',
        cnpj: '98.765.432/0001-21',
        telefone: '(91) 3222-4321',
        endereco: 'Av. Presidente Vargas, 500 - Belém/PA',
        status: 'inadimplente',
        plano: planoProfId,
        trial_ends: '',
      },
      {
        nome: 'OuviBem Clínicas',
        slug: 'ovibem-clinicas',
        email: 'admin@ovibem.com.br',
        cnpj: '55.111.222/0001-33',
        telefone: '(62) 3214-9876',
        endereco: 'Rua 74, 250 - Goiânia/GO',
        status: 'cancelado',
        plano: planoPremId,
        trial_ends: '',
      },
    ]

    var demoClinicaIds = {}
    for (var d = 0; d < demos.length; d++) {
      var demo = demos[d]
      var existing = null
      try {
        existing = app.findFirstRecordByData('clinicas', 'slug', demo.slug)
      } catch (_) {}
      if (existing) {
        demoClinicaIds[demo.slug] = existing.id
      } else {
        var rec = new Record(clinicasCol)
        rec.set('nome', demo.nome)
        rec.set('slug', demo.slug)
        rec.set('email', demo.email)
        rec.set('cnpj', demo.cnpj)
        rec.set('telefone', demo.telefone)
        rec.set('endereco', demo.endereco)
        rec.set('status', demo.status)
        rec.set('trial_ends', demo.trial_ends)
        if (demo.plano) rec.set('plano_id', demo.plano)
        app.save(rec)
        demoClinicaIds[demo.slug] = rec.id
      }
    }

    // Pagamentos seed (idempotentes por clinica+referencia)
    var pagamentosSeed = [
      {
        clinica: clinicaPadraoId,
        plano: planoPremId,
        valor: 297,
        venc: dateOffset(5),
        status: 'pago',
        data_pagamento: nowDateStr(),
        forma: 'pix',
        ref: monthRef(0),
      },
      {
        clinica: clinicaPadraoId,
        plano: planoPremId,
        valor: 297,
        venc: dateOffset(25),
        status: 'pendente',
        ref: monthRef(1),
      },
      {
        clinica: demoClinicaIds['clinica-auditiva-sul'],
        plano: planoBasicoId,
        valor: 97,
        venc: dateOffset(8),
        status: 'pendente',
        ref: monthRef(0),
      },
      {
        clinica: demoClinicaIds['centro-auditivo-norte'],
        plano: planoProfId,
        valor: 197,
        venc: dateOffset(-20),
        status: 'atrasado',
        ref: monthRef(0),
      },
      {
        clinica: demoClinicaIds['ovibem-clinicas'],
        plano: planoPremId,
        valor: 297,
        venc: dateOffset(-10),
        status: 'atrasado',
        ref: monthRef(0),
      },
    ]

    for (var p = 0; p < pagamentosSeed.length; p++) {
      var ps = pagamentosSeed[p]
      if (!ps.clinica) continue

      // Idempotente: pula se já existe pagamento para a clínica+referencia
      var jaExiste = false
      var todos = []
      try {
        todos = app.findRecordsByFilter(
          'pagamentos_saas',
          'referencia = "' + ps.ref + '"',
          '',
          100,
          0,
        )
      } catch (_) {}
      for (var t = 0; t < todos.length; t++) {
        if (todos[t].getString('clinica_id') === ps.clinica) {
          jaExiste = true
          break
        }
      }
      if (jaExiste) continue

      var pRec = new Record(pagamentosCol)
      pRec.set('clinica_id', ps.clinica)
      if (ps.plano) pRec.set('plano_id', ps.plano)
      pRec.set('valor', ps.valor)
      pRec.set('data_vencimento', ps.venc)
      pRec.set('status', ps.status)
      pRec.set('referencia', ps.ref)
      if (ps.data_pagamento) pRec.set('data_pagamento', ps.data_pagamento)
      if (ps.forma) pRec.set('forma_pagamento', ps.forma)
      app.save(pRec)
    }
  },
  (app) => {
    // Revert
    try {
      const pagamentos = app.findCollectionByNameOrId('pagamentos_saas')
      app.delete(pagamentos)
    } catch (_) {}

    var demoSlugs = ['clinica-auditiva-sul', 'centro-auditivo-norte', 'ovibem-clinicas']
    for (var i = 0; i < demoSlugs.length; i++) {
      try {
        var rec = app.findFirstRecordByData('clinicas', 'slug', demoSlugs[i])
        app.delete(rec)
      } catch (_) {}
    }

    try {
      const planos = app.findCollectionByNameOrId('planos')
      planos.createRule = null
      planos.updateRule = null
      planos.deleteRule = null
      app.save(planos)
    } catch (_) {}

    try {
      const clinicas = app.findCollectionByNameOrId('clinicas')
      clinicas.listRule =
        "@request.auth.id != '' && (id = @request.auth.clinica_id || @request.auth.role = 'admin')"
      clinicas.viewRule =
        "@request.auth.id != '' && (id = @request.auth.clinica_id || @request.auth.role = 'admin')"
      clinicas.createRule = "@request.auth.id != ''"
      clinicas.updateRule = "@request.auth.id != '' && id = @request.auth.clinica_id"
      clinicas.deleteRule = null
      app.save(clinicas)
    } catch (_) {}

    try {
      const adminRec = app.findAuthRecordByEmail('_pb_users_auth_', 'admin@audicao360.com.br')
      adminRec.set('is_super_admin', false)
      app.save(adminRec)
    } catch (_) {}
  },
)
