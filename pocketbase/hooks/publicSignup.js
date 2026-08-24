/// <reference path="../pb_data/pocketbase.d.ts" />
//
// publicSignup.js — Cadastro self-service de clínicas (Fase 3 do SaaS).
//
// Expõe rotas PÚBLICAS (sem auth):
//   GET  /api/public/planos
//   GET  /api/public/stats
//   POST /api/public/cadastro
//
// NOTA CRÍTICA DO JSVM (PocketBase v0.23+ / Skip Cloud):
// - Nenhum helper ou variável deve ficar no escopo de arquivo (top-level),
//   pois o callback executa em uma VM isolada da pool.
// - Leitura de body JSON deve ser feita via e.requestInfo().body ou $apis.requestInfo(e).body.
// - Respostas usam e.json(status, data).

// ============================================================
// 1) GET /api/public/planos
// ============================================================
routerAdd('GET', '/api/public/planos', (e) => {
  try {
    const rows = $app.findRecordsByFilter('planos', 'ativo = true', 'preco_mensal', 100, 0)
    const out = []
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      const funcs = r.get('funcionalidades') || []
      out.push({
        id: r.get('id'),
        nome: r.getString('nome') || '',
        preco_mensal: Number(r.get('preco_mensal')) || 0,
        funcionalidades: funcs,
        recursos: funcs,
        max_profissionais: Number(r.get('max_profissionais')) || 0,
        max_usuarios: Number(r.get('max_profissionais')) || 0,
        max_pacientes: Number(r.get('max_pacientes')) || 0,
        ativo: r.get('ativo') !== false,
      })
    }
    return e.json(200, { planos: out })
  } catch (err) {
    console.log('[publicSignup] erro planos: ' + err)
    return e.json(200, { planos: [] })
  }
})

// ============================================================
// 2) GET /api/public/stats
// ============================================================
routerAdd('GET', '/api/public/stats', (e) => {
  try {
    let total = 0
    try {
      total = $app.countRecords('clinicas', "status = 'ativo' || status = 'trial'")
    } catch (_) {}
    return e.json(200, { total_clinicas: total })
  } catch (err) {
    console.log('[publicSignup] erro stats: ' + err)
    return e.json(200, { total_clinicas: 0 })
  }
})

// ============================================================
// 3) POST /api/public/cadastro
// ============================================================
routerAdd('POST', '/api/public/cadastro', (e) => {
  try {
    // Helpers internos do handler
    function isPasswordOk(pass) {
      if (!pass || String(pass).length < 8) return false
      const s = String(pass)
      if (!/[A-Z]/.test(s)) return false
      if (!/[a-z]/.test(s)) return false
      if (!/[0-9]/.test(s)) return false
      if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(s)) return false
      return true
    }

    function isEmailOk(emailStr) {
      if (!emailStr) return false
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(emailStr))
    }

    function cleanDigits(v) {
      return String(v || '').replace(/\D/g, '')
    }

    function getDateOffset(days) {
      const d = new Date()
      d.setDate(d.getDate() + days)
      return d.toISOString().split('T')[0]
    }

    // Leitura segura do body
    let body = {}
    try {
      if (e.requestInfo) {
        body = e.requestInfo().body || {}
      } else if (typeof $apis !== 'undefined' && $apis.requestInfo) {
        body = $apis.requestInfo(e).body || {}
      }
    } catch (_) {
      try {
        const raw =
          (e.requestInfo && e.requestInfo().rawBody) ||
          ($apis && $apis.requestInfo(e).rawBody) ||
          '{}'
        body = JSON.parse(raw)
      } catch (__) {
        body = {}
      }
    }

    const nome = String(body.nome || '').trim()
    const cnpj = cleanDigits(body.cnpj)
    const responsavel = String(body.responsavel || '').trim()
    const email = String(body.email || '')
      .trim()
      .toLowerCase()
    const telefone = String(body.telefone || '').trim()
    const senha = String(body.senha || '')
    const planoId = String(body.plano_id || '').trim()

    // Validações
    if (nome.length < 3) {
      return e.json(400, { error: 'Informe o nome da clínica (mín. 3 caracteres).' })
    }
    if (cnpj.length !== 14) {
      return e.json(400, { error: 'CNPJ inválido. Deve conter 14 dígitos.' })
    }
    if (responsavel.length < 3) {
      return e.json(400, { error: 'Informe o nome do responsável.' })
    }
    if (!isEmailOk(email)) {
      return e.json(400, { error: 'E-mail inválido.' })
    }
    if (!isPasswordOk(senha)) {
      return e.json(400, {
        error:
          'A senha deve ter no mínimo 8 caracteres, com maiúscula, minúscula, número e caractere especial.',
      })
    }

    // Valida plano se selecionado
    let planoRec = null
    if (planoId) {
      try {
        planoRec = $app.findRecordById('planos', planoId)
      } catch (_) {
        return e.json(400, { error: 'Plano selecionado inválido.' })
      }
      if (planoRec && planoRec.get('ativo') === false) {
        return e.json(400, { error: 'Plano selecionado não está disponível.' })
      }
    }

    // Valida se usuário com este e-mail já existe
    let emailExists = false
    try {
      $app.findAuthRecordByEmail('_pb_users_auth_', email)
      emailExists = true
    } catch (_) {
      try {
        $app.findAuthRecordByEmail('users', email)
        emailExists = true
      } catch (__) {}
    }

    if (emailExists) {
      return e.json(400, { error: 'Já existe uma conta com este e-mail.' })
    }

    // Gera slug único
    function generateSlug(s) {
      return (s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '')
    }

    let slug = generateSlug(nome) || 'clinica'
    const slugBase = slug
    let suffix = 2
    let slugOk = false
    while (!slugOk) {
      let collision = false
      try {
        $app.findFirstRecordByData('clinicas', 'slug', slug)
        collision = true
      } catch (_) {}
      if (collision) {
        slug = slugBase + '-' + suffix
        suffix++
        if (suffix > 999) break
      } else {
        slugOk = true
      }
    }

    let clinicaId = ''

    // Transação para criação dos registros atômicos
    $app.runInTransaction((txApp) => {
      // 1. Cria a clínica
      const clinicasCol = txApp.findCollectionByNameOrId('clinicas')
      const clinica = new Record(clinicasCol)
      clinica.set('nome', nome)
      clinica.set('slug', slug)
      clinica.set('email', email)
      clinica.set('cnpj', cnpj)
      clinica.set('telefone', telefone)
      clinica.set('status', 'trial')
      clinica.set('trial_ends', getDateOffset(14))
      if (planoRec) {
        clinica.set('plano_id', planoRec.get('id'))
      }
      txApp.save(clinica)
      clinicaId = clinica.get('id')

      // 2. Cria o usuário Admin
      const usersCol = txApp.findCollectionByNameOrId('_pb_users_auth_')
      const user = new Record(usersCol)
      user.set('name', responsavel)
      user.setEmail(email)
      user.set('role', 'admin')
      user.set('clinica_id', clinicaId)
      user.set('is_super_admin', false)
      user.set('force_password_change', false)
      user.setVerified(true)
      user.setPassword(senha)
      txApp.save(user)

      // 3. Cria o primeiro registro em pagamentos_saas (status trial)
      const pagamentosCol = txApp.findCollectionByNameOrId('pagamentos_saas')
      const pag = new Record(pagamentosCol)
      pag.set('clinica_id', clinicaId)
      if (planoRec) {
        pag.set('plano_id', planoRec.get('id'))
      }
      pag.set('valor', planoRec ? Number(planoRec.get('preco_mensal')) || 0 : 0)
      pag.set('data_vencimento', getDateOffset(14))
      pag.set('status', 'trial')
      pag.set('referencia', 'trial-14dias')
      pag.set('observacoes', 'Período de teste de 14 dias (cadastro self-service).')
      txApp.save(pag)
    })

    return e.json(200, {
      success: true,
      clinica_id: clinicaId,
      email: email,
    })
  } catch (err) {
    console.log('[publicSignup] erro no cadastro: ' + err)
    return e.json(500, { error: 'Não foi possível concluir o cadastro. Tente novamente.' })
  }
})
