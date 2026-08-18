// Correção de texto clínico via AI Gateway do Skip ($ai.chat).
// Único lugar que pode chamar LLMs no projeto — ver skill skip-cloud/ai-llm.
// O frontend (Prontuario.tsx) consome este endpoint através de pb.send(...),
// mantendo as credenciais do gateway no servidor (nunca no bundle do browser).

routerAdd(
  'POST',
  '/backend/v1/ai/correct-text',
  (e) => {
    const body = e.requestInfo().body || {}
    const text = (body.text || '').trim()
    if (!text) return e.badRequestError('Texto não pode ser vazio.')

    const prompt =
      'Corrija e melhore o texto a seguir, mantendo o significado clínico e o tom profissional. ' +
      'Apenas corrija gramática, ortografia e melhore a clareza. ' +
      'Retorne SOMENTE o texto corrigido, sem explicações:\n\n' +
      text

    let corrected = ''
    try {
      const reply = $ai.chat({
        model: 'fast',
        messages: [
          { role: 'system', content: 'Você é um revisor de textos clínicos.' },
          { role: 'user', content: prompt },
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
