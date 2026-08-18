// Correção de texto clínico via AI Gateway do Skip ($ai.chat).
// Único lugar que pode chamar LLMs no projeto — ver skill skip-cloud/ai-llm.
// O frontend (Prontuario.tsx e EditorRegrasIA.tsx) consome este endpoint
// através de pb.send(...), mantendo as credenciais do gateway no servidor.
//
// Fluxo:
// 1. Recebe o texto a corrigir (e opcionalmente flags de preview).
// 2. Busca as regras (ia_regras) e exemplos (ia_exemplos) do usuário logado.
// 3. Monta o prompt final: prompt_sistema + regras_correcao + termos +
//    exemplos few-shot + texto a corrigir.
// 4. Envia para $ai.chat e retorna { corrected }.

routerAdd(
  'POST',
  '/backend/v1/ai/correct-text',
  (e) => {
    const body = e.requestInfo().body || {}
    const text = (body.text || '').trim()
    if (!text) return e.badRequestError('Texto não pode ser vazio.')

    // Preview mode: permite passar regras/exemplos temporários do editor
    // sem precisar salvar no banco. Usado pelo botão "Testar Regras".
    const preview = !!body.preview
    const authId = e.requestInfo().authId || ''

    let promptSistema = ''
    let regrasCorrecao = ''
    let termosProibidos = ''
    let termosObrigatorios = ''
    let exemplos = []

    if (preview) {
      // Exemplos e regras vêm do body para teste em tempo real.
      promptSistema = (body.prompt_sistema || '').trim()
      regrasCorrecao = (body.regras_correcao || '').trim()
      termosProibidos = (body.termos_proibidos || '').trim()
      termosObrigatorios = (body.termos_obrigatorios || '').trim()
      if (Array.isArray(body.exemplos)) {
        exemplos = body.exemplos.filter(function (x) {
          return x && x.texto_original && x.texto_corrigido
        })
      }
    } else if (authId) {
      // Modo produção: busca do banco as regras/exemplos do usuário.
      try {
        const recs = $app.findRecordsByFilter('ia_regras', 'user_id = {:uid}', '-created', 1, 0, {
          uid: authId,
        })
        if (recs.length > 0) {
          const r = recs[0]
          promptSistema = (r.getString('prompt_sistema') || '').trim()
          regrasCorrecao = (r.getString('regras_correcao') || '').trim()
          termosProibidos = (r.getString('termos_proibidos') || '').trim()
          termosObrigatorios = (r.getString('termos_obrigatorios') || '').trim()
        }
      } catch (err) {
        console.log(
          'iaCorrectText: falha ao buscar ia_regras:',
          err && err.message ? err.message : err,
        )
      }
      try {
        const exs = $app.findRecordsByFilter('ia_exemplos', 'user_id = {:uid}', 'ordem', 20, 0, {
          uid: authId,
        })
        for (let i = 0; i < exs.length; i++) {
          const x = exs[i]
          exemplos.push({
            texto_original: x.getString('texto_original') || '',
            texto_corrigido: x.getString('texto_corrigido') || '',
          })
        }
      } catch (err) {
        console.log(
          'iaCorrectText: falha ao buscar ia_exemplos:',
          err && err.message ? err.message : err,
        )
      }
    }

    // ---------- Montagem do prompt ----------
    const systemParts = []
    const defaultSystem = 'Você é um revisor de textos clínicos.'
    if (promptSistema) {
      systemParts.push(promptSistema)
    } else {
      systemParts.push(defaultSystem)
    }
    if (regrasCorrecao) {
      systemParts.push('Regras de correção:\n' + regrasCorrecao)
    }
    if (termosProibidos) {
      systemParts.push('Termos que NUNCA devem ser usados: ' + termosProibidos + '.')
    }
    if (termosObrigatorios) {
      systemParts.push('Termos que devem ser preferidos: ' + termosObrigatorios + '.')
    }
    systemParts.push(
      'Corrija gramática, ortografia e clareza, mantendo o significado clínico e o tom profissional. ' +
        'Retorne SOMENTE o texto corrigido, sem explicações, comentários ou aspas.',
    )
    const systemContent = systemParts.join('\n\n')

    const userParts = []
    // Few-shot: exemplos antes do texto a corrigir.
    if (exemplos.length > 0) {
      userParts.push('Exemplos de correção:')
      for (let i = 0; i < exemplos.length; i++) {
        userParts.push(
          'Texto original ' +
            (i + 1) +
            ':\n' +
            exemplos[i].texto_original +
            '\n\nTexto corrigido ' +
            (i + 1) +
            ':\n' +
            exemplos[i].texto_corrigido,
        )
      }
      userParts.push('Agora corrija o texto abaixo seguindo os mesmos critérios:')
    } else {
      userParts.push('Corrija e melhore o texto a seguir:')
    }
    userParts.push(text)
    const userContent = userParts.join('\n\n')

    let corrected = ''
    try {
      const reply = $ai.chat({
        model: 'fast',
        messages: [
          { role: 'system', content: systemContent },
          { role: 'user', content: userContent },
        ],
        temperature: 0.3,
      })
      corrected = (
        reply && reply.choices && reply.choices[0] && reply.choices[0].message
          ? reply.choices[0].message.content
          : ''
      ).trim()
    } catch (err) {
      console.log('aiCorrectText falhou:', err && err.message ? err.message : err)
      return e.json(503, { error: 'Serviço de IA indisponível.' })
    }

    if (!corrected) return e.json(502, { error: 'Resposta vazia da IA.' })
    return e.json(200, { corrected })
  },
  $apis.requireAuth(),
)
