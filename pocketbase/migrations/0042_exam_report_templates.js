// 0042_exam_report_templates.js
// Cria as coleções `exam_report_templates` e `exam_report_template_versions`
// para o módulo de Configuração de Laudos e Layouts de Impressão.
migrate(
  (app) => {
    // ============================================================
    // exam_report_templates — modelos de laudo configuráveis
    // ============================================================
    const templates = new Collection({
      name: 'exam_report_templates',
      type: 'base',
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.role = "admin"',
      updateRule: '@request.auth.role = "admin"',
      deleteRule: '@request.auth.role = "admin"',
      fields: [
        { name: 'nome_modelo', type: 'text', required: true },
        {
          name: 'tipo_exame',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['audiometria', 'imitanciometria', 'teste_aparelho', 'personalizado'],
        },
        { name: 'descricao', type: 'text' },
        { name: 'versao', type: 'number', onlyInt: true },
        {
          name: 'status',
          type: 'select',
          required: false,
          maxSelect: 1,
          values: ['rascunho', 'publicado', 'arquivado'],
        },
        { name: 'largura_pagina', type: 'number' },
        { name: 'altura_pagina', type: 'number' },
        {
          name: 'orientacao',
          type: 'select',
          required: false,
          maxSelect: 1,
          values: ['retrato', 'paisagem'],
        },
        { name: 'margem_superior', type: 'number' },
        { name: 'margem_inferior', type: 'number' },
        { name: 'margem_esquerda', type: 'number' },
        { name: 'margem_direita', type: 'number' },
        { name: 'estrutura_layout', type: 'json', maxSize: 10485760 },
        { name: 'logo_url', type: 'text' },
        { name: 'cabecalho_configuracao', type: 'json', maxSize: 1048576 },
        { name: 'rodape_configuracao', type: 'json', maxSize: 1048576 },
        { name: 'fonte_padrao', type: 'text' },
        { name: 'tamanho_fonte_padrao', type: 'number' },
        { name: 'cor_primaria', type: 'text' },
        { name: 'cor_secundaria', type: 'text' },
        { name: 'observacoes', type: 'text' },
        { name: 'criado_por', type: 'text' },
        { name: 'atualizado_por', type: 'text' },
        { name: 'publicado_por', type: 'text' },
        { name: 'publicado_em', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_exam_report_templates_tipo ON exam_report_templates (tipo_exame)',
        'CREATE INDEX idx_exam_report_templates_status ON exam_report_templates (status)',
        'CREATE INDEX idx_exam_report_templates_created ON exam_report_templates (created)',
      ],
    })
    app.save(templates)

    // ============================================================
    // exam_report_template_versions — snapshots imutáveis de cada publicação
    // ============================================================
    const versions = new Collection({
      name: 'exam_report_template_versions',
      type: 'base',
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.role = "admin"',
      updateRule: '@request.auth.role = "admin"',
      deleteRule: '@request.auth.role = "admin"',
      fields: [
        { name: 'template_id', type: 'text', required: true },
        { name: 'numero_versao', type: 'number', onlyInt: true },
        { name: 'estrutura_layout', type: 'json', maxSize: 10485760 },
        { name: 'alterado_por', type: 'text' },
        { name: 'motivo_alteracao', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_exam_report_versions_template ON exam_report_template_versions (template_id)',
        'CREATE INDEX idx_exam_report_versions_created ON exam_report_template_versions (created)',
      ],
    })
    app.save(versions)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('exam_report_template_versions'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('exam_report_templates'))
    } catch (_) {}
  },
)
