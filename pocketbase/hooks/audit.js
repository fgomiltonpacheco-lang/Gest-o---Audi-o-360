/// <reference path="../pb_data/pocketbase.d.ts" />
//
// audit.js — Hooks de auditoria LGPD.
//
// Registra, de forma imutável, toda criação e edição de registros das
// coleções sensíveis (prontuário, exames, evoluções, aparelhos, vendas,
// etc.) na coleção `audit_logs`. Os logs são criados server-side via
// `$app.save`, ignorando as regras de API (que proíbem create/update/delete
// via REST). Ações sensíveis sempre geram log — não há opção de desativar.
//
// NOTA: o JSVM do PocketBase executa cada handler em um contexto isolado,
// então toda a lógica precisa estar DENTRO do callback (sem funções/vars
// de top-level compartilhadas).

// ============================================================
// Hook de CRIAÇÃO (afterCreate)
// ============================================================
onRecordCreateRequest(
  (e) => {
    var collectionName = e.collection.name

    // Mapa coleção -> configuração (construído dentro do handler).
    var CONFIG = {
      patients: {
        pacienteSelf: true,
        pacienteField: '',
        recurso: 'patients',
        acaoCreate: 'editou_prontuario',
      },
      clinical_records: {
        pacienteSelf: false,
        pacienteField: 'patientId',
        recurso: 'clinical_records',
        acaoCreate: 'editou_anamnese',
      },
      evolutions: {
        pacienteSelf: false,
        pacienteField: 'patientId',
        recurso: 'evolutions',
        acaoCreate: 'editou_evolucao',
      },
      audiometries: {
        pacienteSelf: false,
        pacienteField: 'patientId',
        recurso: 'audiometries',
        acaoCreate: 'editou_exame',
      },
      hearing_aid_tests: {
        pacienteSelf: false,
        pacienteField: 'patient_id',
        recurso: 'hearing_aid_tests',
        acaoCreate: 'editou_exame',
      },
      hearing_aids: {
        pacienteSelf: false,
        pacienteField: 'patientId',
        recurso: 'hearing_aids',
        acaoCreate: 'editou_aparelhos',
      },
      sales: {
        pacienteSelf: false,
        pacienteField: 'patientId',
        recurso: 'sales',
        acaoCreate: 'editou_financeiro',
      },
      vendas_b2b: {
        pacienteSelf: false,
        pacienteField: '',
        recurso: 'vendas_b2b',
        acaoCreate: 'editou_financeiro',
      },
    }

    var cfg = CONFIG[collectionName]
    if (!cfg) {
      e.next()
      return
    }

    // Captura IP e User-Agent antes de prosseguir.
    var ip = 'registrado via sistema'
    var userAgent = ''
    var authId = ''
    var authNome = 'Sistema'
    try {
      var headers = (e.requestInfo && e.requestInfo.headers) || {}
      var xff = headers['X-Forwarded-For'] || headers['x-forwarded-for']
      if (xff) {
        ip = String(xff).split(',')[0].trim()
      } else if (e.requestInfo && e.requestInfo.clientIP) {
        ip = e.requestInfo.clientIP
      }
      userAgent = headers['User-Agent'] || headers['user-agent'] || ''
      var auth = e.requestInfo && e.requestInfo.auth
      if (auth) {
        authId = auth.id || ''
        authNome = auth.getString('name') || auth.email() || 'Sistema'
      }
    } catch (_) {}

    e.next()

    // Exporta o estado final do registro.
    var after = null
    try {
      after = e.record.publicExport()
    } catch (_) {}

    // Determina o paciente.
    var pid = ''
    if (cfg.pacienteSelf) {
      pid = e.record.id
    } else if (cfg.pacienteField) {
      try {
        var v = e.record.get(cfg.pacienteField)
        if (v) {
          pid = Array.isArray(v) ? (v.length ? String(v[0]) : '') : String(v)
        }
      } catch (_) {}
    }

    // Nome do paciente.
    var pnome = ''
    if (cfg.pacienteSelf) {
      try {
        pnome = e.record.getString('name') || ''
      } catch (_) {}
    } else if (pid) {
      try {
        var p = $app.findRecordById('patients', pid)
        if (p) pnome = p.getString('name') || ''
      } catch (_) {}
    }

    // Detalhes (JSON com after).
    var detalhes = ''
    try {
      if (after) {
        detalhes = JSON.stringify({ after: after })
      }
    } catch (_) {}

    // Grava o log.
    try {
      var col = $app.findCollectionByNameOrId('audit_logs')
      var rec = new Record(col)
      if (authId) rec.set('usuario_id', authId)
      rec.set('usuario_nome', authNome)
      rec.set('acao', cfg.acaoCreate)
      if (pid) rec.set('paciente_id', pid)
      rec.set('paciente_nome', pnome)
      rec.set('recurso', cfg.recurso)
      rec.set('recurso_id', e.record.id)
      rec.set('detalhes', detalhes)
      rec.set('ip', ip)
      rec.set('user_agent', userAgent)
      $app.save(rec)
    } catch (err) {
      console.log('[audit] erro ao gravar log (create): ' + err)
    }
  },
  'patients',
  'clinical_records',
  'evolutions',
  'audiometries',
  'hearing_aid_tests',
  'hearing_aids',
  'sales',
  'vendas_b2b',
)

// ============================================================
// Hook de ATUALIZAÇÃO (afterUpdate) — captura before/after
// ============================================================
onRecordUpdateRequest(
  (e) => {
    var collectionName = e.collection.name

    var CONFIG = {
      patients: {
        pacienteSelf: true,
        pacienteField: '',
        recurso: 'patients',
        acaoUpdate: 'editou_prontuario',
        statusField: '',
        cancelValue: '',
        estornoValue: '',
      },
      clinical_records: {
        pacienteSelf: false,
        pacienteField: 'patientId',
        recurso: 'clinical_records',
        acaoUpdate: 'editou_anamnese',
        statusField: '',
        cancelValue: '',
        estornoValue: '',
      },
      evolutions: {
        pacienteSelf: false,
        pacienteField: 'patientId',
        recurso: 'evolutions',
        acaoUpdate: 'editou_evolucao',
        statusField: '',
        cancelValue: '',
        estornoValue: '',
      },
      audiometries: {
        pacienteSelf: false,
        pacienteField: 'patientId',
        recurso: 'audiometries',
        acaoUpdate: 'editou_exame',
        statusField: '',
        cancelValue: '',
        estornoValue: '',
      },
      hearing_aid_tests: {
        pacienteSelf: false,
        pacienteField: 'patient_id',
        recurso: 'hearing_aid_tests',
        acaoUpdate: 'editou_exame',
        statusField: '',
        cancelValue: '',
        estornoValue: '',
      },
      hearing_aids: {
        pacienteSelf: false,
        pacienteField: 'patientId',
        recurso: 'hearing_aids',
        acaoUpdate: 'editou_aparelhos',
        statusField: '',
        cancelValue: '',
        estornoValue: '',
      },
      sales: {
        pacienteSelf: false,
        pacienteField: 'patientId',
        recurso: 'sales',
        acaoUpdate: 'editou_financeiro',
        statusField: 'status',
        cancelValue: 'Cancelado',
        estornoValue: 'Estornado',
      },
      vendas_b2b: {
        pacienteSelf: false,
        pacienteField: '',
        recurso: 'vendas_b2b',
        acaoUpdate: 'editou_financeiro',
        statusField: 'status',
        cancelValue: 'cancelada',
        estornoValue: '',
      },
    }

    var cfg = CONFIG[collectionName]
    if (!cfg) {
      e.next()
      return
    }

    // Captura IP e User-Agent antes de prosseguir.
    var ip = 'registrado via sistema'
    var userAgent = ''
    var authId = ''
    var authNome = 'Sistema'
    try {
      var headers = (e.requestInfo && e.requestInfo.headers) || {}
      var xff = headers['X-Forwarded-For'] || headers['x-forwarded-for']
      if (xff) {
        ip = String(xff).split(',')[0].trim()
      } else if (e.requestInfo && e.requestInfo.clientIP) {
        ip = e.requestInfo.clientIP
      }
      userAgent = headers['User-Agent'] || headers['user-agent'] || ''
      var auth = e.requestInfo && e.requestInfo.auth
      if (auth) {
        authId = auth.id || ''
        authNome = auth.getString('name') || auth.email() || 'Sistema'
      }
    } catch (_) {}

    // Estado anterior (antes da persistência).
    var before = null
    try {
      if (e.record.original) {
        before = e.record.original().publicExport()
      }
    } catch (_) {}

    e.next()

    // Estado final.
    var after = null
    try {
      after = e.record.publicExport()
    } catch (_) {}

    // Determina a ação: por padrão a acaoUpdate, mas detecta
    // cancelamento/estorno de vendas quando o status mudar.
    var acao = cfg.acaoUpdate
    if (cfg.statusField) {
      var newStatus = ''
      try {
        newStatus = e.record.get(cfg.statusField)
      } catch (_) {}
      if (cfg.cancelValue && newStatus === cfg.cancelValue) {
        acao = 'cancelou_venda'
      } else if (cfg.estornoValue && newStatus === cfg.estornoValue) {
        acao = 'estornou_venda'
      }
    }

    // Determina o paciente.
    var pid = ''
    if (cfg.pacienteSelf) {
      pid = e.record.id
    } else if (cfg.pacienteField) {
      try {
        var v = e.record.get(cfg.pacienteField)
        if (v) {
          pid = Array.isArray(v) ? (v.length ? String(v[0]) : '') : String(v)
        }
      } catch (_) {}
    }

    // Nome do paciente.
    var pnome = ''
    if (cfg.pacienteSelf) {
      try {
        pnome = e.record.getString('name') || ''
      } catch (_) {}
    } else if (pid) {
      try {
        var p = $app.findRecordById('patients', pid)
        if (p) pnome = p.getString('name') || ''
      } catch (_) {}
    }

    // Detalhes (JSON com before/after).
    var detalhes = ''
    try {
      if (before && after) {
        detalhes = JSON.stringify({ before: before, after: after })
      } else if (after) {
        detalhes = JSON.stringify({ after: after })
      }
    } catch (_) {}

    // Grava o log.
    try {
      var col = $app.findCollectionByNameOrId('audit_logs')
      var rec = new Record(col)
      if (authId) rec.set('usuario_id', authId)
      rec.set('usuario_nome', authNome)
      rec.set('acao', acao)
      if (pid) rec.set('paciente_id', pid)
      rec.set('paciente_nome', pnome)
      rec.set('recurso', cfg.recurso)
      rec.set('recurso_id', e.record.id)
      rec.set('detalhes', detalhes)
      rec.set('ip', ip)
      rec.set('user_agent', userAgent)
      $app.save(rec)
    } catch (err) {
      console.log('[audit] erro ao gravar log (update): ' + err)
    }
  },
  'patients',
  'clinical_records',
  'evolutions',
  'audiometries',
  'hearing_aid_tests',
  'hearing_aids',
  'sales',
  'vendas_b2b',
)
