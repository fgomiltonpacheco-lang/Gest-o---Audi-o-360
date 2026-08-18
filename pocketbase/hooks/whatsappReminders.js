/// <reference path="../pb_data/pocketbase.d.ts" />
//
// whatsappReminders.js — Lembretes de consulta por WhatsApp.
//
// Responsabilidades:
//  1. onRecordAfterCreateSuccess(appointments): cria um registro em
//     lembretes_whatsapp com status_envio 'pendente' para agendamentos
//     elegíveis (status 'Agendado' ou 'Confirmado' e com telefone).
//  2. cronAdd: processa lembretes pendentes cujo data_envio <= agora,
//     respeitando a janela 08:00–20:00 e o máximo de 3 tentativas (2h
//     entre elas). Envia a mensagem via API do provedor configurado e
//     atualiza status_envio.
//  3. routerAdd (webhook): recebe respostas do paciente vindas do
//     provedor de WhatsApp, classifica SIM/NÃO e atualiza
//     status_confirmacao (e cancela o agendamento se NÃO).
//
// NOTA sobre o JSVM: cada handler roda em um VM isolado. Toda a lógica
// (incluindo helpers) está DENTRO do callback — nada de funções/variáveis
// compartilhadas no top-level. Tudo é best-effort: falhas de envio/log
// nunca bloqueiam a operação original.

// ============================================================
// 1) Hook afterCreate em appointments
// ============================================================
onRecordAfterCreateSuccess(function (e) {
  try {
    var rec = e.record
    if (!rec) return

    function normalizePhone(raw) {
      if (!raw) return ''
      var s = String(raw).replace(/[^0-9]/g, '')
      if (!s) return ''
      if (s.length >= 12 && s.substring(0, 2) === '55') return s
      if (s.length === 11 || s.length === 10) return '55' + s
      return s
    }
    function loadConfig(app) {
      try {
        var rows = app.findRecordsByFilter('whatsapp_config', "id != ''", '', 1)
        if (rows && rows.length > 0) return rows[0]
      } catch (_) {}
      return null
    }
    function renderTemplate(tpl, vars) {
      var out = String(tpl || '')
      out = out.replace(/\{nome_paciente\}/g, vars.nome || '')
      out = out.replace(/\{data_consulta\}/g, vars.data || '')
      out = out.replace(/\{horario\}/g, vars.horario || '')
      out = out.replace(/\{procedimento\}/g, vars.procedimento || '')
      return out
    }
    function parseLocal(dateStr, timeStr) {
      var parts = String(dateStr || '').split('-')
      if (parts.length < 3) return new Date()
      var t = String(timeStr || '00:00').split(':')
      var h = Number(t[0]) || 0
      var m = Number(t[1]) || 0
      return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), h, m, 0, 0)
    }

    var status = rec.getString('status') || ''
    if (status !== 'Agendado' && status !== 'Confirmado') return

    var cfg = loadConfig($app)
    if (cfg && cfg.get('ativo') === false) return

    var diasAntes = (cfg && Number(cfg.get('dias_antes'))) || 1
    var horarioEnvio = (cfg && cfg.getString('horario_envio')) || '09:00'

    var dateStr = rec.getString('date') || ''
    var timeStr = rec.getString('time') || '09:00'
    if (!dateStr) return

    var consulta = parseLocal(dateStr, timeStr)
    var envio = new Date(consulta.getTime())
    envio.setDate(envio.getDate() - diasAntes)
    var hm = String(horarioEnvio).split(':')
    envio.setHours(Number(hm[0]) || 9, Number(hm[1]) || 0, 0, 0)

    var pacienteId = ''
    try {
      var pid = rec.get('patientId')
      if (pid && typeof pid === 'object' && pid.length) pacienteId = pid[0] || ''
      else if (pid) pacienteId = String(pid)
    } catch (_) {}

    var telefone = rec.getString('patientPhone') || ''
    var pacienteNome = rec.getString('patientName') || ''
    if (!telefone && pacienteId) {
      try {
        var p = $app.findRecordById('patients', pacienteId)
        if (p) {
          telefone = p.getString('mobile') || p.getString('phone') || ''
          if (!pacienteNome) pacienteNome = p.getString('name') || ''
        }
      } catch (_) {}
    }
    if (!telefone) {
      console.log('[whatsappReminder] sem telefone para agendamento ' + rec.getId())
      return
    }
    telefone = normalizePhone(telefone)

    var tpl = (cfg && cfg.getString('template_mensagem')) || ''
    var mensagem = renderTemplate(tpl, {
      nome: pacienteNome,
      data: dateStr,
      horario: timeStr,
      procedimento: rec.getString('type') || '',
    })

    var lembCol = $app.findCollectionByNameOrId('lembretes_whatsapp')
    var lemb = new Record(lembCol)
    lemb.set('agendamento_id', rec.getId())
    if (pacienteId) lemb.set('paciente_id', pacienteId)
    lemb.set('telefone', telefone)
    lemb.set('mensagem', mensagem)
    lemb.set('data_envio', envio.toISOString())
    lemb.set('status_envio', 'pendente')
    lemb.set('status_confirmacao', 'aguardando')
    lemb.set('tentativas', 0)
    $app.save(lemb)
  } catch (err) {
    console.log('[whatsappReminder] erro afterCreate: ' + err)
  }
}, 'appointments')

// ============================================================
// 2) Cron: processa lembretes pendentes a cada 15 minutos
// ============================================================
cronAdd('whatsapp_reminders_send', '*/15 * * * *', function () {
  try {
    var app = $app

    function loadConfig(a) {
      try {
        var rows = a.findRecordsByFilter('whatsapp_config', "id != ''", '', 1)
        if (rows && rows.length > 0) return rows[0]
      } catch (_) {}
      return null
    }
    function sendWhatsAppMessage(apiUrl, apiToken, instancia, telefone, mensagem) {
      var url = String(apiUrl || '').replace(/\/+$/, '')
      var body = { number: telefone, text: mensagem }
      var headers = { 'Content-Type': 'application/json' }
      if (apiToken) headers['apikey'] = apiToken
      var fullUrl = url
      if (url.indexOf('/message/') === -1) {
        fullUrl = url + (instancia ? '/' + instancia : '') + '/message/text'
      }
      var res = $http.send({
        url: fullUrl,
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body),
        timeout: 30,
      })
      if (res && res.statusCode >= 200 && res.statusCode < 300) return true
      throw new Error('HTTP ' + (res ? res.statusCode : '???'))
    }

    var cfg = loadConfig(app)
    if (!cfg) return
    if (cfg.get('ativo') === false) return

    var apiToken = cfg.getString('api_token') || ''
    var apiUrl = cfg.getString('api_url') || ''
    var instancia = cfg.getString('instancia') || ''
    if (!apiToken) {
      try {
        apiToken = $os.getenv('WHATSAPP_API_TOKEN') || ''
      } catch (_) {}
    }
    if (!apiToken || !apiUrl) return

    // Respeita a janela 08:00–20:00 (regra 4).
    var h = new Date().getHours()
    if (h < 8 || h >= 20) return

    var agora = new Date().toISOString()
    var pendentes = app.findRecordsByFilter(
      'lembretes_whatsapp',
      "status_envio = 'pendente' && data_envio <= '" + agora + "'",
      'data_envio',
      50,
    )
    if (!pendentes || pendentes.length === 0) return

    for (var i = 0; i < pendentes.length; i++) {
      var lemb = pendentes[i]
      var tentativas = Number(lemb.get('tentativas')) || 0
      if (tentativas >= 3) {
        lemb.set('status_envio', 'falhou')
        lemb.set('error_message', 'Número máximo de tentativas atingido')
        app.save(lemb)
        continue
      }
      // Intervalo de 2h entre tentativas (regra 5).
      var updated = lemb.getUpdated ? lemb.getUpdated() : null
      if (updated && tentativas > 0) {
        var last = new Date(typeof updated === 'string' ? updated : updated.toString())
        var diffMs = new Date().getTime() - last.getTime()
        if (diffMs < 2 * 60 * 60 * 1000) continue
      }

      var telefone = lemb.getString('telefone') || ''
      var mensagem = lemb.getString('mensagem') || ''
      var ok = false
      var errMsg = ''
      try {
        ok = sendWhatsAppMessage(apiUrl, apiToken, instancia, telefone, mensagem)
      } catch (err) {
        errMsg = String(err)
      }

      var novaTent = tentativas + 1
      lemb.set('tentativas', novaTent)
      if (ok) {
        lemb.set('status_envio', 'enviado')
        lemb.set('error_message', '')
      } else {
        if (novaTent >= 3) lemb.set('status_envio', 'falhou')
        lemb.set('error_message', errMsg || 'Falha no envio')
      }
      app.save(lemb)
    }
  } catch (err) {
    console.log('[whatsappReminder] erro cron: ' + err)
  }
})

// ============================================================
// 3) Webhook: recebe respostas do paciente
//    POST /api/whatsapp/webhook
//    Body: { "phone": "5549...", "message": "SIM" }
//    (formato genérico — adaptável a qualquer provedor)
// ============================================================
routerAdd('POST', '/api/whatsapp/webhook', function (c) {
  try {
    function normalizePhone(raw) {
      if (!raw) return ''
      var s = String(raw).replace(/[^0-9]/g, '')
      if (!s) return ''
      if (s.length >= 12 && s.substring(0, 2) === '55') return s
      if (s.length === 11 || s.length === 10) return '55' + s
      return s
    }

    var data = {}
    try {
      data = $apis.requestInfo(c).body || {}
    } catch (_) {
      try {
        data = JSON.parse($apis.requestInfo(c).rawBody || '{}')
      } catch (__) {}
    }
    var phone = normalizePhone(data.phone || data.from || '')
    var text = String(data.message || data.text || data.body || '').trim()
    if (!phone || !text) {
      return c.json(200, { ok: false, reason: 'missing phone/message' })
    }

    var rows = $app.findRecordsByFilter(
      'lembretes_whatsapp',
      "telefone = '" + phone + "' && status_confirmacao = 'aguardando'",
      '-created',
      5,
    )
    if (!rows || rows.length === 0) {
      return c.json(200, { ok: false, reason: 'no pending reminder' })
    }
    var lemb = rows[0]
    lemb.set('resposta_paciente', text)
    lemb.set('data_confirmacao', new Date().toISOString())

    var lower = text.toLowerCase()
    var isSim = /(^\s*(sim|confirmo|vou|pode ser|podeser|confirmado|presente)\b)/.test(lower)
    var isNao = /(^\s*(nao|não|cancelo|cancelar|não vou|nao vou|desmarcar|desmarquei)\b)/.test(
      lower,
    )

    if (isSim) {
      lemb.set('status_confirmacao', 'confirmado')
      try {
        var aptId = lemb.getString('agendamento_id') || ''
        if (aptId) {
          var apt = $app.findRecordById('appointments', aptId)
          if (apt) {
            apt.set('status', 'Confirmado')
            $app.save(apt)
          }
        }
      } catch (_) {}
    } else if (isNao) {
      lemb.set('status_confirmacao', 'cancelado')
      try {
        var aptId2 = lemb.getString('agendamento_id') || ''
        if (aptId2) {
          var apt2 = $app.findRecordById('appointments', aptId2)
          if (apt2) {
            apt2.set('status', 'Cancelado')
            $app.save(apt2)
          }
        }
      } catch (_) {}
    } else {
      lemb.set('status_confirmacao', 'aguardando')
    }
    $app.save(lemb)
    return c.json(200, { ok: true })
  } catch (err) {
    console.log('[whatsappReminder] erro webhook: ' + err)
    return c.json(500, { ok: false, error: String(err) })
  }
})
