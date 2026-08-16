/// Adiciona suporte a bloqueio parcial de horário na coleção
/// `blocked_days`: novos campos opcionais `start_time` e `end_time`
/// (strings "HH:MM"). Quando ambos preenchidos, o bloqueio é parcial;
/// quando vazios, é dia inteiro (comportamento legado).
///
/// Também remove o índice UNIQUE de `date`, pois agora podem existir
/// múltiplos bloqueios no mesmo dia (regiões diferentes).
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('blocked_days')

    // Remove o índice único legado para permitir vários bloqueios por dia.
    try {
      col.removeIndex('idx_blocked_days_date')
    } catch (_) {}

    // Adiciona coluna de horário inicial (parcial) — nullable.
    if (!col.fields.getByName('start_time')) {
      col.fields.add(new TextField({ name: 'start_time', required: false }))
    }
    // Adiciona coluna de horário final (parcial) — nullable.
    if (!col.fields.getByName('end_time')) {
      col.fields.add(new TextField({ name: 'end_time', required: false }))
    }

    // Índice não-único por data (mantém performance de busca por dia).
    col.addIndex('idx_blocked_days_date', false, 'date', '')

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('blocked_days')

    // Remove índice não-único e restaura o único legado.
    try {
      col.removeIndex('idx_blocked_days_date')
    } catch (_) {}

    // Remove os campos de bloqueio parcial.
    try {
      col.fields.remove(col.fields.getByName('start_time'))
    } catch (_) {}
    try {
      col.fields.remove(col.fields.getByName('end_time'))
    } catch (_) {}

    col.addIndex('idx_blocked_days_date', true, 'date', '')
    app.save(col)
  },
)
