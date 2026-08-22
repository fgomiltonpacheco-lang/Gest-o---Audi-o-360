/// <reference path="../pb_data/pocketbase.d.ts" />
//
// 0066_onboarding.js — Fase 4: wizard de onboarding para novas clínicas.
//
// Adiciona o campo `onboarding_completed` (bool) na coleção `clinicas`.
// Quando false (padrão para novas clínicas), o admin da clínica é
// redirecionado para o wizard de onboarding (/onboarding) no primeiro login.
//
// Para a clínica pré-existente (Audição360 do Dr. Milton, slug `audicao360`),
// marcamos `onboarding_completed = true` para que o wizard NÃO apareça.
//
migrate(
  (app) => {
    // ============================================================
    // 1. Adiciona o campo `onboarding_completed` (bool) em `clinicas`.
    //    Bool NÃO required: ausente / null / false => ainda em onboarding.
    // ============================================================
    const clinicasCol = app.findCollectionByNameOrId('clinicas')
    if (!clinicasCol.fields.getByName('onboarding_completed')) {
      clinicasCol.fields.add(new BoolField({ name: 'onboarding_completed' }))
    }
    app.save(clinicasCol)

    // ============================================================
    // 2. Marca a clínica padrão (Audição360) como onboarding concluído.
    //    Assim o wizard NÃO aparece para o Dr. Milton no próximo login.
    // ============================================================
    try {
      const clinica = app.findFirstRecordByData('clinicas', 'slug', 'audicao360')
      clinica.set('onboarding_completed', true)
      app.save(clinica)
    } catch (_) {
      // clínica não encontrada — ignora
    }

    // ============================================================
    // 3. Garante que toda clínica existente sem valor explícito fique
    //    marcada como concluída (preserva o estado atual do SaaS em produção
    //    para clínicas migradas). Novas clínicas criadas pelo cadastro
    //    self-service virão sem o campo (=> false => wizard aparece).
    // ============================================================
    try {
      const todas = app.findRecordsByFilter('clinicas', 'onboarding_completed = false', '', 1000, 0)
      for (let i = 0; i < (todas || []).length; i++) {
        // Exceto a padrão (já tratada acima), marca as demais também —
        // clínicas já em operação não devem ver o wizard.
        const rec = todas[i]
        rec.set('onboarding_completed', true)
        app.save(rec)
      }
    } catch (_) {
      // filtro pode falhar se o campo ainda não estiver indexado — ignora
    }
  },
  (app) => {
    // ---- Reverte: remove o campo `onboarding_completed` de `clinicas` ----
    try {
      const clinicasCol = app.findCollectionByNameOrId('clinicas')
      const f = clinicasCol.fields.getByName('onboarding_completed')
      if (f) clinicasCol.fields.remove(f)
      app.save(clinicasCol)
    } catch (_) {}
  },
)
