// 0036 — Complementa a migration 0035:
//  - adiciona `password_min_length` à collection `settings`
//  - garante índices úteis em `users` (lockout / force_password_change)
//  - backfill de defaults nos registros existentes de `settings`
migrate(
  (app) => {
    // ============================================================
    // 1) settings: adiciona password_min_length (default 8)
    // ============================================================
    if (app.hasTable('settings')) {
      const settings = app.findCollectionByNameOrId('settings')

      if (!settings.fields.getByName('password_min_length')) {
        settings.fields.add(new NumberField({ name: 'password_min_length', onlyInt: true, min: 4 }))
      }
      app.save(settings)

      // Backfill defaults em registros existentes.
      app
        .db()
        .newQuery('UPDATE settings SET password_min_length = 8 WHERE password_min_length IS NULL')
        .execute()
      app
        .db()
        .newQuery(
          'UPDATE settings SET session_timeout_minutes = 15 WHERE session_timeout_minutes IS NULL',
        )
        .execute()
      app
        .db()
        .newQuery(
          'UPDATE settings SET session_timeout_warning_seconds = 60 WHERE session_timeout_warning_seconds IS NULL',
        )
        .execute()
      app
        .db()
        .newQuery('UPDATE settings SET lockout_max_attempts = 5 WHERE lockout_max_attempts IS NULL')
        .execute()
      app
        .db()
        .newQuery(
          'UPDATE settings SET lockout_duration_minutes = 15 WHERE lockout_duration_minutes IS NULL',
        )
        .execute()
    }

    // ============================================================
    // 2) users: índices para lockout e troca forçada de senha
    // ============================================================
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    // Defaults para campos numéricos (evita NULL na lógica de bloqueio).
    app
      .db()
      .newQuery('UPDATE users SET failed_login_attempts = 0 WHERE failed_login_attempts IS NULL')
      .execute()
    app
      .db()
      .newQuery('UPDATE users SET two_factor_enabled = false WHERE two_factor_enabled IS NULL')
      .execute()
    app
      .db()
      .newQuery(
        'UPDATE users SET force_password_change = false WHERE force_password_change IS NULL',
      )
      .execute()

    try {
      users.addIndex('idx_users_locked_until', false, 'locked_until', '')
    } catch (_) {}
    try {
      users.addIndex('idx_users_force_password_change', false, 'force_password_change', '')
    } catch (_) {}
    app.save(users)
  },
  (app) => {
    // Revert: remove o campo extra e os índices adicionados.
    if (app.hasTable('settings')) {
      const settings = app.findCollectionByNameOrId('settings')
      try {
        const f = settings.fields.getByName('password_min_length')
        if (f) settings.fields.remove(f)
      } catch (_) {}
      app.save(settings)
    }
    try {
      const users = app.findCollectionByNameOrId('_pb_users_auth_')
      try {
        users.removeIndex('idx_users_locked_until')
      } catch (_) {}
      try {
        users.removeIndex('idx_users_force_password_change')
      } catch (_) {}
      app.save(users)
    } catch (_) {}
  },
)
