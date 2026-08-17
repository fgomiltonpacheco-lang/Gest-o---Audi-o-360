// 0044_seed_templates_padrao.js
// Publica templates padrão para audiometria e imitanciometria.
// Layout profissional A4 retrato, espelhando AudiometriaFullPrint e
// ImitanciometriaPrint, usando os elementos do TemplateRenderer.
//
// Os templates são inseridos com status='publicado' e versao=1.
// Antes de inserir, arquiva (status='arquivado') qualquer template
// publicado existente do mesmo tipo, para evitar duplicidade.
migrate(
  (app) => {
    const templatesCol = app.findCollectionByNameOrId('exam_report_templates')

    // Helper: arquiva templates publicados do mesmo tipo.
    const archivePublished = (tipo) => {
      try {
        const existing = app.findRecordsByFilter(
          'exam_report_templates',
          `tipo_exame = "${tipo}" && status = "publicado"`,
        )
        for (const r of existing) {
          r.set('status', 'arquivado')
          app.save(r)
        }
      } catch (_) {}
    }

    const nowIso = new Date().toISOString().slice(0, 19).replace('T', ' ')

    // ============================================================
    // 1) TEMPLATE DE AUDIOMETRIA
    // ============================================================
    archivePublished('audiometria')

    const audiometriaLayout = [
      // 1. Logo Audição 360 centralizada
      {
        id: 'logo',
        type: 'image',
        label: 'Logo da clínica',
        x: 67,
        y: 0,
        width: 46,
        height: 18,
        zIndex: 2,
        props: { src: 'logo_clinica', fit: 'contain', opacity: 1 },
      },
      // 2. Cabeçalho de Identificação
      {
        id: 'identificacao',
        type: 'table',
        label: 'Identificação do paciente',
        x: 0,
        y: 20,
        width: 180,
        height: 24,
        zIndex: 2,
        props: { dynamicSource: 'identificacao', fontSize: 8 },
      },
      // Linha dupla / divisória
      {
        id: 'linha_cabecalho',
        type: 'line',
        label: 'Linha separadora',
        x: 0,
        y: 45,
        width: 180,
        height: 1,
        zIndex: 2,
        props: { direction: 'horizontal', thickness: 2, color: '#000000' },
      },
      // 3. Título AUDIOMETRIA
      {
        id: 'titulo',
        type: 'text',
        label: 'Título',
        x: 0,
        y: 48,
        width: 180,
        height: 6,
        zIndex: 2,
        style: { align: 'center', fontSize: 11, bold: true, color: '#000000' },
        props: { content: 'AUDIOMETRIA', contentType: 'static' },
      },
      // 4. Audiogramas gráficos lado a lado
      {
        id: 'audiograma',
        type: 'audiogram',
        label: 'Audiograma gráfico (OD/OE)',
        x: 0,
        y: 56,
        width: 180,
        height: 72,
        zIndex: 2,
        props: { mode: 'split', showAir: true, showBone: true },
      },
      // 6. Tabela IPRF
      {
        id: 'iprf',
        type: 'table',
        label: 'IPRF',
        x: 25,
        y: 132,
        width: 130,
        height: 22,
        zIndex: 2,
        props: { dynamicSource: 'iprf', fontSize: 8 },
      },
      // 7. Parecer audiológico
      {
        id: 'parecer_titulo',
        type: 'text',
        label: 'Parecer título',
        x: 0,
        y: 158,
        width: 180,
        height: 5,
        zIndex: 2,
        style: { fontSize: 9, bold: true, align: 'center', color: '#000000' },
        props: { content: 'Parecer Audiológico', contentType: 'static' },
      },
      {
        id: 'parecer_conteudo',
        type: 'field',
        label: 'Parecer',
        x: 0,
        y: 164,
        width: 180,
        height: 28,
        zIndex: 2,
        style: { fontSize: 8, align: 'justify' },
        props: { fieldPath: 'exame.report', showLabel: false, fallback: '' },
      },
      // Referências bibliográficas no rodapé da seção
      {
        id: 'referencias',
        type: 'text',
        label: 'Referências bibliográficas',
        x: 0,
        y: 194,
        width: 180,
        height: 6,
        zIndex: 2,
        style: { fontSize: 5.5, italic: true, color: '#000000', align: 'justify' },
        props: {
          content:
            'Lloyd e Kaplan (1978); Silman e Silverman (1997) adaptada de Carhart (1945) e Lloyd e Kaplan (1978); Jerger, Speaks, e Trammell (1968).',
          contentType: 'static',
        },
      },
      // 8. Assinaturas: Fonoaudiólogo e Cliente
      {
        id: 'assinatura_prof',
        type: 'signature',
        label: 'Assinatura Fonoaudiólogo',
        x: 10,
        y: 215,
        width: 70,
        height: 16,
        zIndex: 2,
        props: {
          who: 'profissional',
          showName: false,
          showCrfa: false,
          label: 'Fonoaudiólogo',
          lineWidth: 65,
        },
      },
      {
        id: 'assinatura_cliente',
        type: 'signature',
        label: 'Assinatura Cliente',
        x: 100,
        y: 215,
        width: 70,
        height: 16,
        zIndex: 2,
        props: {
          who: 'paciente',
          showName: false,
          showCrfa: false,
          label: 'Cliente',
          lineWidth: 65,
        },
      },
      // 9. Rodapé com endereço da clínica
      {
        id: 'rodape',
        type: 'text',
        label: 'Rodapé Endereço',
        x: 0,
        y: 260,
        width: 180,
        height: 6,
        zIndex: 2,
        style: { fontSize: 7.5, color: '#000000', align: 'center' },
        props: {
          content: '{{clinica.endereco}}',
          contentType: 'dynamic',
        },
      },
    ]

    const audTpl = new Record(templatesCol)
    audTpl.set('nome_modelo', 'Audiograma Padrão Audição360')
    audTpl.set('tipo_exame', 'audiometria')
    audTpl.set(
      'descricao',
      'Template padrão de audiometria tonal e vocal com audiograma gráfico, tabelas de médias, SRT/LDV, IPRF, meatoscopia e parecer. Layout profissional A4 retrato.',
    )
    audTpl.set('versao', 1)
    audTpl.set('status', 'publicado')
    audTpl.set('largura_pagina', 210)
    audTpl.set('altura_pagina', 297)
    audTpl.set('orientacao', 'retrato')
    audTpl.set('margem_superior', 12)
    audTpl.set('margem_inferior', 12)
    audTpl.set('margem_esquerda', 15)
    audTpl.set('margem_direita', 15)
    audTpl.set('estrutura_layout', audiometriaLayout)
    audTpl.set('logo_url', '')
    audTpl.set('fonte_padrao', 'Arial')
    audTpl.set('tamanho_fonte_padrao', 9)
    audTpl.set('cor_primaria', '#1E3A8A')
    audTpl.set('cor_secundaria', '#00897B')
    audTpl.set('criado_por', 'system')
    audTpl.set('atualizado_por', 'system')
    audTpl.set('publicado_por', 'system')
    audTpl.set('publicado_em', nowIso)
    app.save(audTpl)

    // ============================================================
    // 2) TEMPLATE DE IMITANCIOMETRIA
    // ============================================================
    archivePublished('imitanciometria')

    const imitLayout = [
      // Logo
      {
        id: 'logo',
        type: 'image',
        label: 'Logo da clínica',
        x: 0,
        y: 0,
        width: 45,
        height: 18,
        zIndex: 2,
        props: { src: 'logo_clinica', fit: 'contain', opacity: 1 },
      },
      // Cabeçalho clínica
      {
        id: 'cabecalho',
        type: 'text',
        label: 'Cabeçalho clínica',
        x: 50,
        y: 2,
        width: 130,
        height: 16,
        zIndex: 2,
        style: { align: 'right', fontSize: 9, bold: true, color: '#1E3A8A' },
        props: {
          content: '{{clinica.nome}}\n{{clinica.endereco}}\nTel.: {{clinica.telefone}}',
          contentType: 'dynamic',
        },
      },
      {
        id: 'linha_cabecalho',
        type: 'line',
        label: 'Linha cabeçalho',
        x: 0,
        y: 20,
        width: 180,
        height: 1,
        zIndex: 2,
        props: { direction: 'horizontal', thickness: 1, color: '#1E3A8A' },
      },
      // Título
      {
        id: 'titulo',
        type: 'text',
        label: 'Título',
        x: 0,
        y: 23,
        width: 180,
        height: 8,
        zIndex: 2,
        style: { align: 'center', fontSize: 13, bold: true, color: '#1E3A8A' },
        props: { content: 'AVALIAÇÃO IMITANCIOMÉTRICA', contentType: 'static' },
      },
      {
        id: 'subtitulo',
        type: 'text',
        label: 'Subtítulo',
        x: 0,
        y: 31,
        width: 180,
        height: 5,
        zIndex: 2,
        style: { align: 'center', fontSize: 9, italic: true, color: '#475569' },
        props: { content: 'Timpanometria e Reflexos Acústicos', contentType: 'static' },
      },
      // Identificação do paciente
      {
        id: 'identificacao',
        type: 'table',
        label: 'Identificação do paciente',
        x: 0,
        y: 38,
        width: 180,
        height: 28,
        zIndex: 2,
        props: { dynamicSource: 'identificacao', fontSize: 8 },
      },
      // Meatoscopia OD/OE
      {
        id: 'meatoscopia',
        type: 'table',
        label: 'Meatoscopia',
        x: 0,
        y: 68,
        width: 180,
        height: 16,
        zIndex: 2,
        props: { dynamicSource: 'meatoscopia', fontSize: 8 },
      },
      // Timpanometria (tabela de parâmetros)
      {
        id: 'timpanometria',
        type: 'table',
        label: 'Timpanometria',
        x: 0,
        y: 86,
        width: 180,
        height: 26,
        zIndex: 2,
        props: { dynamicSource: 'timpanometria', fontSize: 8 },
      },
      // Gráfico timpanométrico (curva OD/OE sobreposta)
      {
        id: 'timpanograma',
        type: 'timpanogram',
        label: 'Gráfico timpanométrico',
        x: 25,
        y: 114,
        width: 130,
        height: 42,
        zIndex: 2,
        props: { mode: 'combined', odColor: '#DC2626', oeColor: '#2563EB' },
      },
      // Reflexos acústicos
      {
        id: 'reflexos',
        type: 'table',
        label: 'Reflexos acústicos',
        x: 0,
        y: 158,
        width: 180,
        height: 22,
        zIndex: 2,
        props: { dynamicSource: 'reflexos', fontSize: 8 },
      },
      // Parecer imitanciométrico
      {
        id: 'parecer_titulo',
        type: 'text',
        label: 'Parecer título',
        x: 0,
        y: 182,
        width: 180,
        height: 5,
        zIndex: 2,
        style: { fontSize: 10, bold: true, color: '#1E3A8A' },
        props: { content: 'PARECER IMITANCIOMÉTRICO', contentType: 'static' },
      },
      {
        id: 'parecer_conteudo',
        type: 'field',
        label: 'Parecer',
        x: 0,
        y: 187,
        width: 180,
        height: 20,
        zIndex: 2,
        style: { fontSize: 8, align: 'justify' },
        props: { fieldPath: 'exame.laudo', showLabel: false, fallback: '—' },
      },
      // Observações
      {
        id: 'obs_titulo',
        type: 'text',
        label: 'Observações título',
        x: 0,
        y: 208,
        width: 180,
        height: 5,
        zIndex: 2,
        style: { fontSize: 10, bold: true, color: '#1E3A8A' },
        props: { content: 'OBSERVAÇÕES', contentType: 'static' },
      },
      {
        id: 'obs_conteudo',
        type: 'field',
        label: 'Observações',
        x: 0,
        y: 213,
        width: 180,
        height: 12,
        zIndex: 2,
        style: { fontSize: 8, align: 'justify' },
        props: { fieldPath: 'exame.observacoes', showLabel: false, fallback: '—' },
      },
      // Assinatura profissional
      {
        id: 'assinatura_prof',
        type: 'signature',
        label: 'Assinatura do profissional',
        x: 5,
        y: 228,
        width: 85,
        height: 16,
        zIndex: 2,
        props: { who: 'profissional', showName: true, showCrfa: true, lineWidth: 70 },
      },
      // Assinatura paciente
      {
        id: 'assinatura_pac',
        type: 'signature',
        label: 'Assinatura do paciente',
        x: 90,
        y: 228,
        width: 85,
        height: 16,
        zIndex: 2,
        props: {
          who: 'paciente',
          showName: false,
          showCrfa: false,
          label: 'Paciente / Responsável',
          lineWidth: 70,
        },
      },
      // Rodapé
      {
        id: 'rodape',
        type: 'text',
        label: 'Rodapé',
        x: 0,
        y: 272,
        width: 180,
        height: 6,
        zIndex: 2,
        style: { fontSize: 7, color: '#64748b', align: 'center' },
        props: {
          content: '{{clinica.nome}} — Emissão: {{exame.data}} • Página 1/1',
          contentType: 'dynamic',
        },
      },
    ]

    const imitTpl = new Record(templatesCol)
    imitTpl.set('nome_modelo', 'Imitanciograma Padrão Audição360')
    imitTpl.set('tipo_exame', 'imitanciometria')
    imitTpl.set(
      'descricao',
      'Template padrão de imitanciometria com meatoscopia, timpanometria, gráfico timpanométrico OD/OE, reflexos acústicos e parecer. Layout profissional A4 retrato.',
    )
    imitTpl.set('versao', 1)
    imitTpl.set('status', 'publicado')
    imitTpl.set('largura_pagina', 210)
    imitTpl.set('altura_pagina', 297)
    imitTpl.set('orientacao', 'retrato')
    imitTpl.set('margem_superior', 12)
    imitTpl.set('margem_inferior', 12)
    imitTpl.set('margem_esquerda', 15)
    imitTpl.set('margem_direita', 15)
    imitTpl.set('estrutura_layout', imitLayout)
    imitTpl.set('logo_url', '')
    imitTpl.set('fonte_padrao', 'Arial')
    imitTpl.set('tamanho_fonte_padrao', 9)
    imitTpl.set('cor_primaria', '#1E3A8A')
    imitTpl.set('cor_secundaria', '#00897B')
    imitTpl.set('criado_por', 'system')
    imitTpl.set('atualizado_por', 'system')
    imitTpl.set('publicado_por', 'system')
    imitTpl.set('publicado_em', nowIso)
    app.save(imitTpl)
  },
  (app) => {
    // Reversível: remove os templates seed (por nome).
    const names = ['Audiograma Padrão Audição360', 'Imitanciograma Padrão Audição360']
    for (const nome of names) {
      try {
        const recs = app.findRecordsByFilter('exam_report_templates', `nome_modelo = "${nome}"`)
        for (const r of recs) app.delete(r)
      } catch (_) {}
    }
  },
)
