// 0035 — Security fields for the `users` collection (2FA, password policy,
// account lockout) plus a new `settings` collection for session-timeout and
// password-expiration configuration (admin-managed singleton).
migrate(
  (app) => {
    // ============================================================
    // 1) Add security fields to the built-in `users` auth collection.
    // ============================================================
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    if (!users.fields.getByName('two_factor_enabled')) {
      users.fields.add(new BoolField({ name: 'two_factor_enabled' }))
    }
    if (!users.fields.getByName('two_factor_secret')) {
      // TOTP shared secret (base32). Stored as text — the secret alone is
      // useless without the authenticator app and the user's password.
      users.fields.add(new TextField({ name: 'two_factor_secret' }))
    }
    if (!users.fields.getByName('two_factor_backup_codes')) {
      // JSON array of hashed (sha256) backup codes.
      users.fields.add(new JSONField({ name: 'two_factor_backup_codes' }))
    }
    if (!users.fields.getByName('two_factor_method')) {
      users.fields.add(
        new SelectField({ name: 'two_factor_method', values: ['totp', 'email'], maxSelect: 1 }),
      )
    }
    if (!users.fields.getByName('two_factor_setup_at')) {
      users.fields.add(new DateField({ name: 'two_factor_setup_at' }))
    }
    if (!users.fields.getByName('password_history')) {
      // JSON array of the last 3 password hashes (bcrypt).
      users.fields.add(new JSONField({ name: 'password_history' }))
    }
    if (!users.fields.getByName('password_changed_at')) {
      users.fields.add(new DateField({ name: 'password_changed_at' }))
    }
    if (!users.fields.getByName('force_password_change')) {
      users.fields.add(new BoolField({ name: 'force_password_change' }))
    }
    // Account lockout tracking (client-enforced; see AppContext login flow).
    if (!users.fields.getByName('failed_login_attempts')) {
      users.fields.add(new NumberField({ name: 'failed_login_attempts' }))
    }
    if (!users.fields.getByName('locked_until')) {
      // ISO datetime string of when the lockout expires.
      users.fields.add(new TextField({ name: 'locked_until' }))
    }

    app.save(users)

    // ============================================================
    // 2) Create the `settings` collection (admin-managed singleton).
    // ============================================================
    if (!app.hasTable('settings')) {
      const settings = new Collection({
        name: 'settings',
        type: 'base',
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        createRule: '@request.auth.role = "admin"',
        updateRule: '@request.auth.role = "admin"',
        deleteRule: '@request.auth.role = "admin"',
        fields: [
          // ---- Session timeout ----
          { name: 'session_timeout_enabled', type: 'bool' },
          { name: 'session_timeout_minutes', type: 'number' },
          { name: 'session_timeout_warning_seconds', type: 'number' },
          // ---- Password expiration ----
          { name: 'password_expiration_enabled', type: 'bool' },
          { name: 'password_expiration_days', type: 'number' },
          // ---- Account lockout ----
          { name: 'lockout_max_attempts', type: 'number' },
          { name: 'lockout_duration_minutes', type: 'number' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
      })
      app.save(settings)
    }

    // Seed the singleton settings row with sensible defaults if none exists.
    try {
      const existing = app.findRecordsByFilter('settings', '1=1', 'created', 1, 0)
      if (!existing || existing.length === 0) {
        const col = app.findCollectionByNameOrId('settings')
        const rec = new Record(col)
        rec.set('session_timeout_enabled', true)
        rec.set('session_timeout_minutes', 15)
        rec.set('session_timeout_warning_seconds', 60)
        rec.set('password_expiration_enabled', false)
        rec.set('password_expiration_days', 90)
        rec.set('lockout_max_attempts', 5)
        rec.set('lockout_duration_minutes', 15)
        app.save(rec)
      }
    } catch (_) {
      // ignore seed errors — the row can be created later from the UI
    }
  },
  (app) => {
    // Revert: remove the added fields from `users`.
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const toRemove = [
      'two_factor_enabled',
      'two_factor_secret',
      'two_factor_backup_codes',
      'two_factor_method',
      'two_factor_setup_at',
      'password_history',
      'password_changed_at',
      'force_password_change',
      'failed_login_attempts',
      'locked_until',
    ]
    toRemove.forEach((name) => {
      const f = users.fields.getByName(name)
      if (f) users.fields.remove(f)
    })
    app.save(users)

    // Drop the `settings` collection.
    if (app.hasTable('settings')) {
      const col = app.findCollectionByNameOrId('settings')
      app.delete(col)
    }
  },
)
