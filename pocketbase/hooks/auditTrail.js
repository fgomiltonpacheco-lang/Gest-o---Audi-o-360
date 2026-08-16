/// <reference path="../pb_data/pocketbase.d.ts" />
//
// auditTrail.js — Trilha de auditoria completa do Audição360.
//
// Registra, de forma imutável, TODAS as ações críticas realizadas por
// todos os usuários em todos os módulos (pacientes, agenda, prontuário,
// audiometria, vendas PDV/B2B, caixa, estoque, configurações, exames,
// aparelhos, parceiros, NF, contas a receber/recebimentos) na coleção
// `audit_trail`.
//
// Princípios:
//  1. BEST-EFFORT: se o log falhar, a operação original NÃO é bloqueada
//     (tudo envolto em try/catch, nunca rethrow).
//  2. Campos sensíveis (senha, token, tokenKey, etc.) NUNCA são logados.
//  3. IP e User-Agent são capturados da requisição quando disponíveis.
//  4. A coleção audit_trail é somente-inserção via hooks server-side
//     (regras de API: create/update/delete = null).
//
// Retenção mínima: 5 anos (1825 dias). A purga efetiva fica a cargo de
// rotina externa; este valor é referência.
//
// Hooks usados (PocketBase v0.23):
//  - onRecordCreateRequest  (HTTP context, pre-commit)  + e.next()
//  - onRecordUpdateRequest  (HTTP context, pre-commit)  + e.next()
//  - onRecordDeleteRequest  (HTTP context, pre-commit)  + e.next()
//
// NOTA sobre o JSVM: cada handler roda em um VM isolado. Toda a lógica
// está DENTRO do callback — nada de funções/variáveis compartilhadas no
// top-level. Os três handlers (create / update / delete) são
// independentes e duplicam o que for necessário inline.

// ============================================================
// Hook de CRIAÇÃO
// ============================================================
onRecordCreateRequest(
  function (e) {
    try {
      var collectionName = e.collection.name
      var TRAIL_COLLECTION = 'audit_trail'

      function isSensitive(name) {
        var n = String(name || '').toLowerCase()
        var sens = [
          'password',
          'passwordconfirm',
          'token',
          'tokenkey',
          'secret',
          'verifykey',
          'resetkey',
          'authid',
        ]
        for (var i = 0; i < sens.length; i++) {
          if (n === sens[i] || n.indexOf(sens[i]) >= 0) return true
        }
        return false
      }
      function normalize(v) {
        if (v === undefined) return null
        if (v === null) return null
        if (Array.isArray(v)) {
          var arr = []
          for (var i = 0; i < v.length; i++) arr.push(normalize(v[i]))
          return arr
        }
        if (typeof v === 'object') {
          var keys = Object.keys(v)
          var out = {}
          for (var j = 0; j < keys.length; j++) {
            var k = keys[j]
            if (isSensitive(k)) continue
            out[k] = normalize(v[k])
          }
          return out
        }
        return v
      }

      var META = {
        patients: {
          modulo: 'pacientes',
          entidade_tipo: 'patients',
          descricao: function (r) {
            return 'Paciente: ' + (r.getString('name') || '(sem nome)')
          },
        },
        appointments: {
          modulo: 'agenda',
          entidade_tipo: 'appointments',
          descricao: function (r) {
            return (
              'Agendamento: ' +
              (r.getString('patientName') || '') +
              (r.getString('date') ? ' em ' + r.getString('date') : '')
            )
          },
        },
        clinical_records: {
          modulo: 'prontuario',
          entidade_tipo: 'clinical_records',
          descricao: function (r) {
            return 'Prontuário: ' + (r.getString('patientName') || r.getId())
          },
        },
        evolutions: {
          modulo: 'prontuario',
          entidade_tipo: 'evolutions',
          descricao: function (r) {
            return (
              'Evolução: ' +
              (r.getString('patientName') || '') +
              (r.getString('date') ? ' — ' + r.getString('date') : '')
            )
          },
        },
        audiometries: {
          modulo: 'audiometria',
          entidade_tipo: 'audiometries',
          descricao: function (r) {
            return 'Audiometria: ' + (r.getString('patientName') || r.getId())
          },
        },
        audiometry_exams: {
          modulo: 'audiometria',
          entidade_tipo: 'audiometry_exams',
          descricao: function (r) {
            return 'Exame audiológico: ' + (r.getString('patientName') || r.getId())
          },
        },
        imitanciometrias: {
          modulo: 'audiometria',
          entidade_tipo: 'imitanciometrias',
          descricao: function (r) {
            return (
              'Imitanciometria: ' +
              (r.getString('paciente_nome') || r.getId()) +
              (r.getString('data_exame') ? ' — ' + r.getString('data_exame') : '')
            )
          },
        },
        hearing_aid_tests: {
          modulo: 'audiometria',
          entidade_tipo: 'hearing_aid_tests',
          descricao: function (r) {
            return (
              'Teste de aparelho: ' +
              (r.getString('patient_name') || r.getId()) +
              (r.getString('product_name') ? ' — ' + r.getString('product_name') : '')
            )
          },
        },
        hearing_aids: {
          modulo: 'audiometria',
          entidade_tipo: 'hearing_aids',
          descricao: function (r) {
            return (
              'Aparelho auditivo: ' +
              (r.getString('brand') || '') +
              (r.getString('model') ? ' ' + r.getString('model') : '')
            )
          },
        },
        sales: {
          modulo: 'vendas_pdv',
          entidade_tipo: 'sales',
          descricao: function (r) {
            var n = r.get('number') || ''
            return (
              'Venda #' + n + (r.getString('patientName') ? ' — ' + r.getString('patientName') : '')
            )
          },
        },
        vendas_b2b: {
          modulo: 'vendas_b2b',
          entidade_tipo: 'vendas_b2b',
          descricao: function (r) {
            return 'Venda B2B ' + (r.getString('numero_venda') || '#' + r.getId())
          },
        },
        itens_venda_b2b: {
          modulo: 'vendas_b2b',
          entidade_tipo: 'itens_venda_b2b',
          descricao: function (r) {
            return 'Item Venda B2B: ' + (r.getString('produto_nome') || r.getId())
          },
        },
        fechamentos_caixa: {
          modulo: 'caixa',
          entidade_tipo: 'fechamentos_caixa',
          descricao: function (r) {
            return (
              'Caixa ' + (r.getString('data') || '') + ' (' + (r.getString('status') || '') + ')'
            )
          },
        },
        movimentacoes_caixa: {
          modulo: 'caixa',
          entidade_tipo: 'movimentacoes_caixa',
          descricao: function (r) {
            return (
              'Movimentação de caixa: ' +
              (r.getString('tipo') || '') +
              ' R$ ' +
              (r.get('valor') || 0)
            )
          },
        },
        inventory: {
          modulo: 'estoque',
          entidade_tipo: 'inventory',
          descricao: function (r) {
            return 'Item de estoque: ' + (r.getString('name') || r.getId())
          },
        },
        inventory_movements: {
          modulo: 'estoque',
          entidade_tipo: 'inventory_movements',
          descricao: function (r) {
            return (
              'Movimentação de estoque: ' +
              (r.getString('item_name') || '') +
              ' (' +
              (r.getString('type') || '') +
              ')'
            )
          },
        },
        empresas_parceiras: {
          modulo: 'parceiros',
          entidade_tipo: 'empresas_parceiras',
          descricao: function (r) {
            return (
              'Empresa parceira: ' +
              (r.getString('nome_fantasia') || r.getString('razao_social') || r.getId())
            )
          },
        },
        equipments: {
          modulo: 'configuracoes',
          entidade_tipo: 'equipments',
          descricao: function (r) {
            return 'Equipamento: ' + (r.getString('nome') || r.getId())
          },
        },
        clinic_settings: {
          modulo: 'configuracoes',
          entidade_tipo: 'clinic_settings',
          descricao: function (r) {
            return 'Configurações da clínica: ' + (r.getString('nome') || r.getId())
          },
        },
        nf_servico_comissao: {
          modulo: 'vendas_b2b',
          entidade_tipo: 'nf_servico_comissao',
          descricao: function (r) {
            return 'NF de serviço: ' + (r.getString('numero_nfse') || r.getId())
          },
        },
        contas_receber: {
          modulo: 'caixa',
          entidade_tipo: 'contas_receber',
          descricao: function (r) {
            return (
              'Conta a receber: ' +
              (r.getString('cliente_nome') || '') +
              ' — R$ ' +
              (r.get('valor_original') || 0)
            )
          },
        },
        recebimentos: {
          modulo: 'caixa',
          entidade_tipo: 'recebimentos',
          descricao: function (r) {
            return (
              'Recebimento: R$ ' +
              (r.get('valor') || 0) +
              ' (conta ' +
              (r.getString('conta_receber_id') || '') +
              ')'
            )
          },
        },
      }

      var meta = META[collectionName]
      if (!meta) {
        e.next()
        return
      }

      // ---- Captura contexto da requisição (IP / User-Agent / auth) ----
      var ip = ''
      var userAgent = ''
      var authId = ''
      var authNome = 'Sistema'
      var authPerfil = ''
      try {
        var ri = e.requestInfo
        if (ri) {
          var headers = ri.headers || {}
          var xff = headers['X-Forwarded-For'] || headers['x-forwarded-for']
          if (xff) {
            ip = String(xff).split(',')[0].trim()
          } else if (ri.clientIP) {
            ip = ri.clientIP
          }
          userAgent = headers['User-Agent'] || headers['user-agent'] || ''
          var auth = ri.auth
          if (auth) {
            authId = auth.id || ''
            authNome = auth.getString('name') || auth.email() || 'Sistema'
            authPerfil = auth.getString('role') || ''
          }
        }
      } catch (_) {}

      // Snapshot do registro (campos já setados, antes de persistir).
      var after = {}
      try {
        after = e.record.publicExport()
      } catch (_) {}

      // Prossegue com a operação original (best-effort: o log nunca bloqueia).
      e.next()

      var alteracoes = {}
      var keys = []
      try {
        keys = Object.keys(after)
      } catch (_) {}
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i]
        if (isSensitive(k)) continue
        alteracoes[k] = { before: null, after: normalize(after[k]) }
      }

      var descricao = ''
      try {
        descricao = meta.descricao(e.record)
      } catch (_) {
        descricao = meta.entidade_tipo + ':' + e.record.getId()
      }

      try {
        var col = $app.findCollectionByNameOrId(TRAIL_COLLECTION)
        var rec = new Record(col)
        if (authId) rec.set('usuario_id', authId)
        rec.set('usuario_nome', authNome)
        if (authPerfil) rec.set('usuario_perfil', authPerfil)
        rec.set('modulo', meta.modulo)
        rec.set('acao', 'criar')
        rec.set('entidade_tipo', meta.entidade_tipo)
        rec.set('entidade_id', e.record.getId())
        rec.set('entidade_descricao', descricao)
        rec.set('alteracoes', alteracoes)
        rec.set('ip', ip)
        rec.set('user_agent', userAgent)
        $app.save(rec)
      } catch (err) {
        console.log('[auditTrail] erro create: ' + err)
      }
    } catch (errTop) {
      console.log('[auditTrail] erro create (top): ' + errTop)
      try {
        e.next()
      } catch (_) {}
    }
  },
  'patients',
  'appointments',
  'clinical_records',
  'evolutions',
  'audiometries',
  'audiometry_exams',
  'imitanciometrias',
  'hearing_aid_tests',
  'hearing_aids',
  'sales',
  'vendas_b2b',
  'itens_venda_b2b',
  'fechamentos_caixa',
  'movimentacoes_caixa',
  'inventory',
  'inventory_movements',
  'empresas_parceiras',
  'equipments',
  'clinic_settings',
  'nf_servico_comissao',
  'contas_receber',
  'recebimentos',
)

// ============================================================
// Hook de ATUALIZAÇÃO
// Compara oldRecord vs newRecord e captura apenas o que mudou.
// Detecta ações específicas: cancelar/estornar venda, emitir NF,
// abrir/fechar caixa.
// ============================================================
onRecordUpdateRequest(
  function (e) {
    try {
      var collectionName = e.collection.name
      var TRAIL_COLLECTION = 'audit_trail'

      function isSensitive(name) {
        var n = String(name || '').toLowerCase()
        var sens = [
          'password',
          'passwordconfirm',
          'token',
          'tokenkey',
          'secret',
          'verifykey',
          'resetkey',
          'authid',
        ]
        for (var i = 0; i < sens.length; i++) {
          if (n === sens[i] || n.indexOf(sens[i]) >= 0) return true
        }
        return false
      }
      function normalize(v) {
        if (v === undefined) return null
        if (v === null) return null
        if (Array.isArray(v)) {
          var arr = []
          for (var i = 0; i < v.length; i++) arr.push(normalize(v[i]))
          return arr
        }
        if (typeof v === 'object') {
          var keys = Object.keys(v)
          var out = {}
          for (var j = 0; j < keys.length; j++) {
            var k = keys[j]
            if (isSensitive(k)) continue
            out[k] = normalize(v[k])
          }
          return out
        }
        return v
      }

      var META = {
        patients: {
          modulo: 'pacientes',
          entidade_tipo: 'patients',
          statusField: '',
          cancelValue: '',
          estornoValue: '',
          acaoEspecial: '',
          descricao: function (r) {
            return 'Paciente: ' + (r.getString('name') || '(sem nome)')
          },
        },
        appointments: {
          modulo: 'agenda',
          entidade_tipo: 'appointments',
          statusField: 'status',
          cancelValue: 'Cancelado',
          estornoValue: '',
          acaoEspecial: 'cancelar',
          descricao: function (r) {
            return (
              'Agendamento: ' +
              (r.getString('patientName') || '') +
              (r.getString('date') ? ' em ' + r.getString('date') : '')
            )
          },
        },
        clinical_records: {
          modulo: 'prontuario',
          entidade_tipo: 'clinical_records',
          statusField: '',
          cancelValue: '',
          estornoValue: '',
          acaoEspecial: '',
          descricao: function (r) {
            return 'Prontuário: ' + (r.getString('patientName') || r.getId())
          },
        },
        evolutions: {
          modulo: 'prontuario',
          entidade_tipo: 'evolutions',
          statusField: '',
          cancelValue: '',
          estornoValue: '',
          acaoEspecial: '',
          descricao: function (r) {
            return (
              'Evolução: ' +
              (r.getString('patientName') || '') +
              (r.getString('date') ? ' — ' + r.getString('date') : '')
            )
          },
        },
        audiometries: {
          modulo: 'audiometria',
          entidade_tipo: 'audiometries',
          statusField: '',
          cancelValue: '',
          estornoValue: '',
          acaoEspecial: '',
          descricao: function (r) {
            return 'Audiometria: ' + (r.getString('patientName') || r.getId())
          },
        },
        audiometry_exams: {
          modulo: 'audiometria',
          entidade_tipo: 'audiometry_exams',
          statusField: '',
          cancelValue: '',
          estornoValue: '',
          acaoEspecial: '',
          descricao: function (r) {
            return 'Exame audiológico: ' + (r.getString('patientName') || r.getId())
          },
        },
        imitanciometrias: {
          modulo: 'audiometria',
          entidade_tipo: 'imitanciometrias',
          statusField: '',
          cancelValue: '',
          estornoValue: '',
          acaoEspecial: '',
          descricao: function (r) {
            return (
              'Imitanciometria: ' +
              (r.getString('paciente_nome') || r.getId()) +
              (r.getString('data_exame') ? ' — ' + r.getString('data_exame') : '')
            )
          },
        },
        hearing_aid_tests: {
          modulo: 'audiometria',
          entidade_tipo: 'hearing_aid_tests',
          statusField: 'status',
          cancelValue: 'Cancelado',
          estornoValue: '',
          acaoEspecial: 'cancelar',
          descricao: function (r) {
            return (
              'Teste de aparelho: ' +
              (r.getString('patient_name') || r.getId()) +
              (r.getString('product_name') ? ' — ' + r.getString('product_name') : '')
            )
          },
        },
        hearing_aids: {
          modulo: 'audiometria',
          entidade_tipo: 'hearing_aids',
          statusField: '',
          cancelValue: '',
          estornoValue: '',
          acaoEspecial: '',
          descricao: function (r) {
            return (
              'Aparelho auditivo: ' +
              (r.getString('brand') || '') +
              (r.getString('model') ? ' ' + r.getString('model') : '')
            )
          },
        },
        sales: {
          modulo: 'vendas_pdv',
          entidade_tipo: 'sales',
          statusField: 'status',
          cancelValue: 'Cancelado',
          estornoValue: 'Estornado',
          acaoEspecial: '',
          descricao: function (r) {
            var n = r.get('number') || ''
            return (
              'Venda #' + n + (r.getString('patientName') ? ' — ' + r.getString('patientName') : '')
            )
          },
        },
        vendas_b2b: {
          modulo: 'vendas_b2b',
          entidade_tipo: 'vendas_b2b',
          statusField: 'status',
          cancelValue: 'cancelada',
          estornoValue: '',
          acaoEspecial: '',
          descricao: function (r) {
            return 'Venda B2B ' + (r.getString('numero_venda') || '#' + r.getId())
          },
        },
        itens_venda_b2b: {
          modulo: 'vendas_b2b',
          entidade_tipo: 'itens_venda_b2b',
          statusField: '',
          cancelValue: '',
          estornoValue: '',
          acaoEspecial: '',
          descricao: function (r) {
            return 'Item Venda B2B: ' + (r.getString('produto_nome') || r.getId())
          },
        },
        fechamentos_caixa: {
          modulo: 'caixa',
          entidade_tipo: 'fechamentos_caixa',
          statusField: 'status',
          cancelValue: '',
          estornoValue: '',
          acaoEspecial: 'caixa',
          descricao: function (r) {
            return (
              'Caixa ' + (r.getString('data') || '') + ' (' + (r.getString('status') || '') + ')'
            )
          },
        },
        movimentacoes_caixa: {
          modulo: 'caixa',
          entidade_tipo: 'movimentacoes_caixa',
          statusField: '',
          cancelValue: '',
          estornoValue: '',
          acaoEspecial: '',
          descricao: function (r) {
            return (
              'Movimentação de caixa: ' +
              (r.getString('tipo') || '') +
              ' R$ ' +
              (r.get('valor') || 0)
            )
          },
        },
        inventory: {
          modulo: 'estoque',
          entidade_tipo: 'inventory',
          statusField: '',
          cancelValue: '',
          estornoValue: '',
          acaoEspecial: '',
          descricao: function (r) {
            return 'Item de estoque: ' + (r.getString('name') || r.getId())
          },
        },
        inventory_movements: {
          modulo: 'estoque',
          entidade_tipo: 'inventory_movements',
          statusField: '',
          cancelValue: '',
          estornoValue: '',
          acaoEspecial: '',
          descricao: function (r) {
            return (
              'Movimentação de estoque: ' +
              (r.getString('item_name') || '') +
              ' (' +
              (r.getString('type') || '') +
              ')'
            )
          },
        },
        empresas_parceiras: {
          modulo: 'parceiros',
          entidade_tipo: 'empresas_parceiras',
          statusField: '',
          cancelValue: '',
          estornoValue: '',
          acaoEspecial: '',
          descricao: function (r) {
            return (
              'Empresa parceira: ' +
              (r.getString('nome_fantasia') || r.getString('razao_social') || r.getId())
            )
          },
        },
        equipments: {
          modulo: 'configuracoes',
          entidade_tipo: 'equipments',
          statusField: '',
          cancelValue: '',
          estornoValue: '',
          acaoEspecial: '',
          descricao: function (r) {
            return 'Equipamento: ' + (r.getString('nome') || r.getId())
          },
        },
        clinic_settings: {
          modulo: 'configuracoes',
          entidade_tipo: 'clinic_settings',
          statusField: '',
          cancelValue: '',
          estornoValue: '',
          acaoEspecial: '',
          descricao: function (r) {
            return 'Configurações da clínica: ' + (r.getString('nome') || r.getId())
          },
        },
        nf_servico_comissao: {
          modulo: 'vendas_b2b',
          entidade_tipo: 'nf_servico_comissao',
          statusField: 'status',
          cancelValue: 'cancelada',
          estornoValue: '',
          acaoEspecial: 'nf',
          descricao: function (r) {
            return 'NF de serviço: ' + (r.getString('numero_nfse') || r.getId())
          },
        },
        contas_receber: {
          modulo: 'caixa',
          entidade_tipo: 'contas_receber',
          statusField: 'status',
          cancelValue: 'cancelado',
          estornoValue: '',
          acaoEspecial: '',
          descricao: function (r) {
            return (
              'Conta a receber: ' +
              (r.getString('cliente_nome') || '') +
              ' — R$ ' +
              (r.get('valor_original') || 0)
            )
          },
        },
        recebimentos: {
          modulo: 'caixa',
          entidade_tipo: 'recebimentos',
          statusField: '',
          cancelValue: '',
          estornoValue: '',
          acaoEspecial: '',
          descricao: function (r) {
            return (
              'Recebimento: R$ ' +
              (r.get('valor') || 0) +
              ' (conta ' +
              (r.getString('conta_receber_id') || '') +
              ')'
            )
          },
        },
      }

      var meta = META[collectionName]
      if (!meta) {
        e.next()
        return
      }

      // ---- Captura contexto da requisição ----
      var ip = ''
      var userAgent = ''
      var authId = ''
      var authNome = 'Sistema'
      var authPerfil = ''
      try {
        var ri = e.requestInfo
        if (ri) {
          var headers = ri.headers || {}
          var xff = headers['X-Forwarded-For'] || headers['x-forwarded-for']
          if (xff) {
            ip = String(xff).split(',')[0].trim()
          } else if (ri.clientIP) {
            ip = ri.clientIP
          }
          userAgent = headers['User-Agent'] || headers['user-agent'] || ''
          var auth = ri.auth
          if (auth) {
            authId = auth.id || ''
            authNome = auth.getString('name') || auth.email() || 'Sistema'
            authPerfil = auth.getString('role') || ''
          }
        }
      } catch (_) {}

      // Estado anterior (antes da persistência).
      var before = {}
      try {
        if (e.record.original) {
          before = e.record.original().publicExport()
        }
      } catch (_) {}

      // Estado "novo" desejado antes de prosseguir.
      var after = {}
      try {
        after = e.record.publicExport()
      } catch (_) {}

      // Prossegue com a operação original (best-effort: o log nunca bloqueia).
      e.next()

      // ---- Compara apenas o que mudou ----
      var alteracoes = {}
      var allKeys = {}
      var bk = []
      var ak = []
      try {
        bk = Object.keys(before)
      } catch (_) {}
      try {
        ak = Object.keys(after)
      } catch (_) {}
      for (var i = 0; i < bk.length; i++) allKeys[bk[i]] = true
      for (var j = 0; j < ak.length; j++) allKeys[ak[j]] = true
      var changedKeys = Object.keys(allKeys)
      var hasChanges = false
      for (var c = 0; c < changedKeys.length; c++) {
        var key = changedKeys[c]
        if (isSensitive(key)) continue
        var b = normalize(before[key])
        var a = normalize(after[key])
        if (JSON.stringify(b) !== JSON.stringify(a)) {
          alteracoes[key] = { before: b, after: a }
          hasChanges = true
        }
      }
      // Atualizações sem alterações relevantes não geram log.
      if (!hasChanges) return

      // ---- Determina a ação ----
      var acao = 'editar'
      var contexto = null

      if (meta.statusField) {
        var newStatus = ''
        var oldStatus = ''
        try {
          newStatus = e.record.get(meta.statusField) || ''
        } catch (_) {}
        try {
          if (e.record.original) {
            oldStatus = e.record.original().get(meta.statusField) || ''
          }
        } catch (_) {}

        if (meta.acaoEspecial === 'caixa') {
          if (newStatus === 'aberto' && oldStatus !== 'aberto') {
            acao = 'abrir_caixa'
          } else if (newStatus === 'fechado' && oldStatus !== 'fechado') {
            acao = 'fechar_caixa'
            try {
              contexto = {
                saldo_inicial: e.record.get('saldo_inicial'),
                saldo_final: e.record.get('saldo_final'),
                diferenca: e.record.get('diferenca'),
                total_vendas: e.record.get('total_vendas'),
              }
            } catch (_) {}
          }
        } else if (meta.acaoEspecial === 'nf') {
          if (newStatus === 'emitida' && oldStatus !== 'emitida') {
            acao = 'emitir_nf'
            try {
              contexto = {
                numero_nfse: e.record.getString('numero_nfse'),
                valor_liquido: e.record.get('valor_liquido'),
                data_emissao: e.record.getString('data_emissao'),
              }
            } catch (_) {}
          } else if (
            (newStatus === 'cancelada' || newStatus === 'cancelada_prefeitura') &&
            oldStatus !== newStatus
          ) {
            acao = 'cancelar'
            try {
              var motivo = e.record.getString('motivo_cancelamento') || ''
              if (motivo) contexto = { motivo: motivo }
            } catch (_) {}
          }
        } else {
          if (
            meta.cancelValue &&
            newStatus === meta.cancelValue &&
            oldStatus !== meta.cancelValue
          ) {
            acao = 'cancelar'
            try {
              var mv =
                e.record.getString('motivo_cancelamento') ||
                e.record.getString('cancelReason') ||
                e.record.getString('observacoes') ||
                ''
              if (mv) contexto = { motivo: mv }
            } catch (_) {}
          } else if (
            meta.estornoValue &&
            newStatus === meta.estornoValue &&
            oldStatus !== meta.estornoValue
          ) {
            acao = 'estornar'
          }
        }
      }

      var descricao = ''
      try {
        descricao = meta.descricao(e.record)
      } catch (_) {
        descricao = meta.entidade_tipo + ':' + e.record.getId()
      }

      try {
        var col = $app.findCollectionByNameOrId(TRAIL_COLLECTION)
        var rec = new Record(col)
        if (authId) rec.set('usuario_id', authId)
        rec.set('usuario_nome', authNome)
        if (authPerfil) rec.set('usuario_perfil', authPerfil)
        rec.set('modulo', meta.modulo)
        rec.set('acao', acao)
        rec.set('entidade_tipo', meta.entidade_tipo)
        rec.set('entidade_id', e.record.getId())
        rec.set('entidade_descricao', descricao)
        rec.set('alteracoes', alteracoes)
        rec.set('ip', ip)
        rec.set('user_agent', userAgent)
        if (contexto) rec.set('contexto', contexto)
        $app.save(rec)
      } catch (err) {
        console.log('[auditTrail] erro update: ' + err)
      }
    } catch (errTop) {
      console.log('[auditTrail] erro update (top): ' + errTop)
      try {
        e.next()
      } catch (_) {}
    }
  },
  'patients',
  'appointments',
  'clinical_records',
  'evolutions',
  'audiometries',
  'audiometry_exams',
  'imitanciometrias',
  'hearing_aid_tests',
  'hearing_aids',
  'sales',
  'vendas_b2b',
  'itens_venda_b2b',
  'fechamentos_caixa',
  'movimentacoes_caixa',
  'inventory',
  'inventory_movements',
  'empresas_parceiras',
  'equipments',
  'clinic_settings',
  'nf_servico_comissao',
  'contas_receber',
  'recebimentos',
)

// ============================================================
// Hook de EXCLUSÃO
// ============================================================
onRecordDeleteRequest(
  function (e) {
    try {
      var collectionName = e.collection.name
      var TRAIL_COLLECTION = 'audit_trail'

      function isSensitive(name) {
        var n = String(name || '').toLowerCase()
        var sens = [
          'password',
          'passwordconfirm',
          'token',
          'tokenkey',
          'secret',
          'verifykey',
          'resetkey',
          'authid',
        ]
        for (var i = 0; i < sens.length; i++) {
          if (n === sens[i] || n.indexOf(sens[i]) >= 0) return true
        }
        return false
      }
      function normalize(v) {
        if (v === undefined) return null
        if (v === null) return null
        if (Array.isArray(v)) {
          var arr = []
          for (var i = 0; i < v.length; i++) arr.push(normalize(v[i]))
          return arr
        }
        if (typeof v === 'object') {
          var keys = Object.keys(v)
          var out = {}
          for (var j = 0; j < keys.length; j++) {
            var k = keys[j]
            if (isSensitive(k)) continue
            out[k] = normalize(v[k])
          }
          return out
        }
        return v
      }

      var META = {
        patients: {
          modulo: 'pacientes',
          entidade_tipo: 'patients',
          descricao: function (r) {
            return 'Paciente: ' + (r.getString('name') || r.getId())
          },
        },
        appointments: {
          modulo: 'agenda',
          entidade_tipo: 'appointments',
          descricao: function (r) {
            return 'Agendamento: ' + (r.getString('patientName') || r.getId())
          },
        },
        clinical_records: {
          modulo: 'prontuario',
          entidade_tipo: 'clinical_records',
          descricao: function (r) {
            return 'Prontuário: ' + (r.getString('patientName') || r.getId())
          },
        },
        evolutions: {
          modulo: 'prontuario',
          entidade_tipo: 'evolutions',
          descricao: function (r) {
            return 'Evolução: ' + (r.getString('patientName') || r.getId())
          },
        },
        audiometries: {
          modulo: 'audiometria',
          entidade_tipo: 'audiometries',
          descricao: function (r) {
            return 'Audiometria: ' + (r.getString('patientName') || r.getId())
          },
        },
        audiometry_exams: {
          modulo: 'audiometria',
          entidade_tipo: 'audiometry_exams',
          descricao: function (r) {
            return 'Exame audiológico: ' + (r.getString('patientName') || r.getId())
          },
        },
        imitanciometrias: {
          modulo: 'audiometria',
          entidade_tipo: 'imitanciometrias',
          descricao: function (r) {
            return (
              'Imitanciometria: ' +
              (r.getString('paciente_nome') || r.getId()) +
              (r.getString('data_exame') ? ' — ' + r.getString('data_exame') : '')
            )
          },
        },
        hearing_aid_tests: {
          modulo: 'audiometria',
          entidade_tipo: 'hearing_aid_tests',
          descricao: function (r) {
            return 'Teste de aparelho: ' + (r.getString('patient_name') || r.getId())
          },
        },
        hearing_aids: {
          modulo: 'audiometria',
          entidade_tipo: 'hearing_aids',
          descricao: function (r) {
            return (
              'Aparelho auditivo: ' +
              (r.getString('brand') || '') +
              ' ' +
              (r.getString('model') || '')
            )
          },
        },
        sales: {
          modulo: 'vendas_pdv',
          entidade_tipo: 'sales',
          descricao: function (r) {
            var n = r.get('number') || ''
            return (
              'Venda #' + n + (r.getString('patientName') ? ' — ' + r.getString('patientName') : '')
            )
          },
        },
        vendas_b2b: {
          modulo: 'vendas_b2b',
          entidade_tipo: 'vendas_b2b',
          descricao: function (r) {
            return 'Venda B2B ' + (r.getString('numero_venda') || '#' + r.getId())
          },
        },
        itens_venda_b2b: {
          modulo: 'vendas_b2b',
          entidade_tipo: 'itens_venda_b2b',
          descricao: function (r) {
            return 'Item Venda B2B: ' + (r.getString('produto_nome') || r.getId())
          },
        },
        fechamentos_caixa: {
          modulo: 'caixa',
          entidade_tipo: 'fechamentos_caixa',
          descricao: function (r) {
            return (
              'Caixa ' + (r.getString('data') || '') + ' (' + (r.getString('status') || '') + ')'
            )
          },
        },
        movimentacoes_caixa: {
          modulo: 'caixa',
          entidade_tipo: 'movimentacoes_caixa',
          descricao: function (r) {
            return 'Movimentação de caixa: ' + (r.getString('descricao') || r.getId())
          },
        },
        inventory: {
          modulo: 'estoque',
          entidade_tipo: 'inventory',
          descricao: function (r) {
            return 'Item de estoque: ' + (r.getString('name') || r.getId())
          },
        },
        inventory_movements: {
          modulo: 'estoque',
          entidade_tipo: 'inventory_movements',
          descricao: function (r) {
            return 'Movimentação de estoque: ' + (r.getString('item_name') || r.getId())
          },
        },
        empresas_parceiras: {
          modulo: 'parceiros',
          entidade_tipo: 'empresas_parceiras',
          descricao: function (r) {
            return (
              'Empresa parceira: ' +
              (r.getString('nome_fantasia') || r.getString('razao_social') || r.getId())
            )
          },
        },
        equipments: {
          modulo: 'configuracoes',
          entidade_tipo: 'equipments',
          descricao: function (r) {
            return 'Equipamento: ' + (r.getString('nome') || r.getId())
          },
        },
        clinic_settings: {
          modulo: 'configuracoes',
          entidade_tipo: 'clinic_settings',
          descricao: function (r) {
            return 'Configurações da clínica: ' + (r.getString('nome') || r.getId())
          },
        },
        nf_servico_comissao: {
          modulo: 'vendas_b2b',
          entidade_tipo: 'nf_servico_comissao',
          descricao: function (r) {
            return 'NF de serviço: ' + (r.getString('numero_nfse') || r.getId())
          },
        },
        contas_receber: {
          modulo: 'caixa',
          entidade_tipo: 'contas_receber',
          descricao: function (r) {
            return (
              'Conta a receber: ' +
              (r.getString('cliente_nome') || '') +
              ' — R$ ' +
              (r.get('valor_original') || 0)
            )
          },
        },
        recebimentos: {
          modulo: 'caixa',
          entidade_tipo: 'recebimentos',
          descricao: function (r) {
            return (
              'Recebimento: R$ ' +
              (r.get('valor') || 0) +
              ' (conta ' +
              (r.getString('conta_receber_id') || '') +
              ')'
            )
          },
        },
      }

      var meta = META[collectionName]
      if (!meta) {
        e.next()
        return
      }

      var ip = ''
      var userAgent = ''
      var authId = ''
      var authNome = 'Sistema'
      var authPerfil = ''
      try {
        var ri = e.requestInfo
        if (ri) {
          var headers = ri.headers || {}
          var xff = headers['X-Forwarded-For'] || headers['x-forwarded-for']
          if (xff) {
            ip = String(xff).split(',')[0].trim()
          } else if (ri.clientIP) {
            ip = ri.clientIP
          }
          userAgent = headers['User-Agent'] || headers['user-agent'] || ''
          var auth = ri.auth
          if (auth) {
            authId = auth.id || ''
            authNome = auth.getString('name') || auth.email() || 'Sistema'
            authPerfil = auth.getString('role') || ''
          }
        }
      } catch (_) {}

      // Snapshot do registro antes da exclusão.
      var before = {}
      try {
        before = e.record.publicExport()
      } catch (_) {}

      var alteracoes = {}
      var bk = []
      try {
        bk = Object.keys(before)
      } catch (_) {}
      for (var i = 0; i < bk.length; i++) {
        var k = bk[i]
        if (isSensitive(k)) continue
        alteracoes[k] = { before: normalize(before[k]), after: null }
      }

      var descricao = ''
      try {
        descricao = meta.descricao(e.record)
      } catch (_) {
        descricao = meta.entidade_tipo + ':' + e.record.getId()
      }

      // Prossegue com a operação original (best-effort: o log nunca bloqueia).
      e.next()

      try {
        var col = $app.findCollectionByNameOrId(TRAIL_COLLECTION)
        var rec = new Record(col)
        if (authId) rec.set('usuario_id', authId)
        rec.set('usuario_nome', authNome)
        if (authPerfil) rec.set('usuario_perfil', authPerfil)
        rec.set('modulo', meta.modulo)
        rec.set('acao', 'deletar')
        rec.set('entidade_tipo', meta.entidade_tipo)
        rec.set('entidade_id', e.record.getId())
        rec.set('entidade_descricao', descricao)
        rec.set('alteracoes', alteracoes)
        rec.set('ip', ip)
        rec.set('user_agent', userAgent)
        $app.save(rec)
      } catch (err) {
        console.log('[auditTrail] erro delete: ' + err)
      }
    } catch (errTop) {
      console.log('[auditTrail] erro delete (top): ' + errTop)
      try {
        e.next()
      } catch (_) {}
    }
  },
  'patients',
  'appointments',
  'clinical_records',
  'evolutions',
  'audiometries',
  'audiometry_exams',
  'imitanciometrias',
  'hearing_aid_tests',
  'hearing_aids',
  'sales',
  'vendas_b2b',
  'itens_venda_b2b',
  'fechamentos_caixa',
  'movimentacoes_caixa',
  'inventory',
  'inventory_movements',
  'empresas_parceiras',
  'equipments',
  'clinic_settings',
  'nf_servico_comissao',
  'contas_receber',
  'recebimentos',
)
