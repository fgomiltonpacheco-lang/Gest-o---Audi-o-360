/// <reference path="../pb_data/pocketbase.d.ts" />
//
// publicSignup.js — Cadastro self-service de clínicas (Fase 3 do SaaS).
//
// Expõe 3 rotas PÚBLICAS (sem auth):
//
//   GET  /api/public/planos
//     Retorna os planos ativos ordenados por preço (para a landing page).
//
//   GET  /api/public/stats
//     Conta clínicas ativas + trial (para o selo de confiança da landing).
//
//   POST /api/public/cadastro
//     Cria clínica (status "trial", trial_ends = hoje + 14 dias), usuário
//     admin vinculado (clinica_id) e o primeiro registro de
//     `pagamentos_saas` com status "trial". Valida nome, CNPJ, e-mail e
//     senha (mín. 8 caracteres, força mínima). Não autentica — o usuário
//     é redirecionado para /login no front.
//
// Segurança: o endpoint valida e-mail/senha server-side e usa
// `setPassword()` (helper do auth record) para gravar o hash. A senha é
// validada com `validatePassword` no cliente (policy), mas o servidor
// impõe o mínimo de 8 caracteres + tipos distintos.
//
// NOTA sobre o JSVM: cada handler roda em um VM isolado. Toda a lógica
// (incluindo helpers) está DENTRO do callback — nada de funções/variáveis
// compartilhadas no top-level.
// ============================================================

// ============================================================
// Helper: valida uma senha mínima (8+ caracteres, 1 maiúscula, 1 minúscula,
// 1 número, 1 especial). Mesma política do front (passwordPolicy.ts).
// ============================================================
function passwordOk(pass) {
  if (!pass || String(pass).length < 8) return false
  var s = String(pass)
  if (!/[A-Z]/.test(s)) return false
  if (!/[a-z]/.test(s)) return false
  if (!/[0-9]/.test(s)) return false
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(s)) return false
  return true
}

// ============================================================
// Helper: valida e-mail básico.
// ============================================================
function emailOk(email) {
  if (!email) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))
}

// ============================================================
// Helper: normaliza CNPJ (só dígitos).
// ============================================================
function onlyDigits(v) {
  return String(v || '').replace(/\D/g, '')
}

// ============================================================
// Helper: data "YYYY-MM-DD" para hoje + N dias.
// ============================================================
function dateOffset(days) {
  var d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

// ============================================================
// 1) GET /api/public/planos
// ============================================================
routerAdd('GET', '/api/public/planos', function (c) {
  try {
    var rows = $app.findRecordsByFilter('planos', 'ativo = true', 'preco_mensal', 100, 0)
    var out = []
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i]
      out.push({
        id: r.get('id'),
        nome: r.getString('nome') || '',
        preco_mensal: Number(r.get('preco_mensal')) || 0,
        funcionalidades: r.get('funcionalidades') || [],
        max_profissionais: Number(r.get('max_profissionais')) || 0,
        max_pacientes: Number(r.get('max_pacientes')) || 0,
      })
    }
    return c.json(200, { planos: out })
  } catch (err) {
    console.log('[publicSignup] planos: ' + err)
    return c.json(200, { planos: [] })
  }
})

// ============================================================
// 2) GET /api/public/stats
// ============================================================
routerAdd('GET', '/api/public/stats', function (c) {
  try {
    var total = 0
    try {
      total = $app.countRecords('clinicas', "status = 'ativo' || status = 'trial'")
    } catch (_) {}
    return c.json(200, { total_clinicas: total })
  } catch (err) {
    console.log('[publicSignup] stats: ' + err)
    return c.json(200, { total_clinicas: 0 })
  }
})

// ============================================================
// 3) POST /api/public/cadastro
//    Body: {
//      nome, cnpj, responsavel, email, telefone, senha, plano_id
//    }
// ============================================================
routerAdd('POST', '/api/public/cadastro', function (c) {
  try {
    // ---- Lê o corpo da requisição ----
    var data = new DynamicModel({
      nome: '',
      cnpj: '',
      responsavel: '',
      email: '',
      telefone: '',
      senha: '',
      plano_id: '',
    })
    c.bindBody(data)

    var nome = String(data.nome || '').trim()
    var cnpj = onlyDigits(data.cnpj)
    var responsavel = String(data.responsavel || '').trim()
    var email = String(data.email || '')
      .trim()
      .toLowerCase()
    var telefone = String(data.telefone || '').trim()
    var senha = String(data.senha || '')
    var planoId = String(data.plano_id || '').trim()

    // ---- Validações ----
    if (nome.length < 3) {
      return c.json(400, { error: 'Informe o nome da clínica (mín. 3 caracteres).' })
    }
    if (cnpj.length !== 14) {
      return c.json(400, { error: 'CNPJ inválido. Deve conter 14 dígitos.' })
    }
    if (responsavel.length < 3) {
      return c.json(400, { error: 'Informe o nome do responsável.' })
    }
    if (!emailOk(email)) {
      return c.json(400, { error: 'E-mail inválido.' })
    }
    if (!passwordOk(senha)) {
      return c.json(400, {
        error:
          'A senha deve ter no mínimo 8 caracteres, com maiúscula, minúscula, número e caractere especial.',
      })
    }

    // ---- Valida plano (se informado) ----
    var planoRec = null
    if (planoId) {
      try {
        planoRec = $app.findRecordById('planos', planoId)
      } catch (_) {
        return c.json(400, { error: 'Plano selecionado inválido.' })
      }
      if (planoRec.get('ativo') === false) {
        return c.json(400, { error: 'Plano selecionado não está disponível.' })
      }
    }

    // ---- Verifica e-mail duplicado ----
    var emailExists = false
    try {
      $app.findAuthRecordByEmail('users', email)
      emailExists = true
    } catch (_) {}
    if (emailExists) {
      return c.json(400, { error: 'Já existe uma conta com este e-mail.' })
    }

    // ---- Gera slug único a partir do nome ----
    function baseSlug(s) {
      return (s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '')
    }
    var slug = baseSlug(nome) || 'clinica'
    // Garante unicidade anexando sufixo curto se necessário.
    var slugBase = slug
    var suffix = 2
    var slugOk = false
    while (!slugOk) {
      var collision = false
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

    // ---- Cria a clínica (status trial) ----
    var clinicaId = ''
    $app.runInTransaction(function (txApp) {
      var clinicasCol = txApp.findCollectionByNameOrId('clinicas')
      var clinica = new Record(clinicasCol)
      clinica.set('nome', nome)
      clinica.set('slug', slug)
      clinica.set('email', email)
      clinica.set('cnpj', cnpj)
      clinica.set('telefone', telefone)
      clinica.set('status', 'trial')
      clinica.set('trial_ends', dateOffset(14))
      if (planoRec) clinica.set('plano_id', planoRec.get('id'))
      txApp.save(clinica)
      clinicaId = clinica.get('id')

      // ---- Cria o usuário admin vinculado à clínica ----
      var usersCol = txApp.findCollectionByNameOrId('_pb_users_auth_')
      var user = new Record(usersCol)
      user.set('name', responsavel)
      user.set('email', email)
      user.set('role', 'admin')
      user.set('clinica_id', clinicaId)
      user.set('is_super_admin', false)
      user.set('force_password_change', false)
      user.setPassword(senha) // helper do auth record (hash + tokenKey)
      txApp.save(user)

      // ---- Cria o primeiro registro de pagamento (status trial) ----
      var pagamentosCol = txApp.findCollectionByNameOrId('pagamentos_saas')
      var pag = new Record(pagamentosCol)
      pag.set('clinica_id', clinicaId)
      if (planoRec) pag.set('plano_id', planoRec.get('id'))
      pag.set('valor', planoRec ? Number(planoRec.get('preco_mensal')) || 0 : 0)
      pag.set('data_vencimento', dateOffset(14))
      pag.set('status', 'trial')
      pag.set('referencia', 'trial-14dias')
      pag.set('observacoes', 'Período de teste de 14 dias (cadastro self-service).')
      txApp.save(pag)
    })

    return c.json(200, {
      success: true,
      clinica_id: clinicaId,
      email: email,
    })
  } catch (err) {
    console.log('[publicSignup] cadastro: ' + err)
    return c.json(500, { error: 'Não foi possível concluir o cadastro. Tente novamente.' })
  }
})
