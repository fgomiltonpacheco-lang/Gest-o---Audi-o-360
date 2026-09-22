// pocketbase/migrations/0076_limpar_dados_demo_audicao360.js
// Exclui todos os registros de dados operacionais da clínica Audição360 (tekgpi6lyeoz4or)
// conforme solicitação estrita do usuário Dr. Milton Pacheco.
//
// NÃO toca em: users, clinicas, clinic_settings, procedimentos, estoque (inventory),
// movimentacoes de estoque (inventory_movements), planos, pagamentos_saas, clinic_config,
// blocked_days, equipments, whatsapp_config, policy_texts, settings, ia_regras, ia_exemplos,
// exam_report_templates.
//
// NÃO toca em registros de NENHUMA outra clínica (zkp57a7o6qe6w5k, fpqkqtxi2hds8gd, bquicfn3t9agwbn, etc).

migrate(
  (app) => {
    const CLINICA_ID = 'tekgpi6lyeoz4or'

    // Ordem estrita de exclusão respeitando integridade referencial:
    // 1. Filhos mais profundos / subcoleções de exames e financeiro
    // 2. Registros vinculados a vendas (recebimentos, contas a receber, parcelas, comissoes, movimentacoes de caixa, notas fiscais, nfse)
    // 3. Vendas e orçamentos
    // 4. Exames e registros clínicos vinculados a pacientes
    // 5. Aparelhos auditivos de pacientes e suas manutenções/ajustes/ordens de serviço
    // 6. Agendamentos e lembretes de whatsapp
    // 7. Pacientes
    // 8. Fluxo de caixa e despesas operacionais da clínica

    const executeDelete = (tableName, query) => {
      try {
        if (!app.hasTable(tableName)) return
        app.db().newQuery(query).bind({ clinica_id: CLINICA_ID }).execute()
      } catch (err) {
        console.warn(`[0076_limpar_dados_demo] Erro ao limpar ${tableName}:`, err)
      }
    }

    // 1. Subcoleções de imitanciometrias (reflexo_acustico_dados, timpanometria_dados)
    // Deleta onde clinica_id = CLINICA_ID ou apontando para imitanciometria da clinica
    executeDelete(
      'reflexo_acustico_dados',
      `DELETE FROM reflexo_acustico_dados 
       WHERE clinica_id = {:clinica_id} 
          OR imitanciometria_id IN (SELECT id FROM imitanciometrias WHERE clinica_id = {:clinica_id})`,
    )

    executeDelete(
      'timpanometria_dados',
      `DELETE FROM timpanometria_dados 
       WHERE clinica_id = {:clinica_id} 
          OR imitanciometria_id IN (SELECT id FROM imitanciometrias WHERE clinica_id = {:clinica_id})`,
    )

    // 2. Recebimentos vinculados a contas a receber
    executeDelete(
      'recebimentos',
      `DELETE FROM recebimentos 
       WHERE clinica_id = {:clinica_id} 
          OR conta_receber_id IN (SELECT id FROM contas_receber WHERE clinica_id = {:clinica_id})`,
    )

    // 3. Contas a receber da clínica
    executeDelete('contas_receber', `DELETE FROM contas_receber WHERE clinica_id = {:clinica_id}`)

    // 4. Comissões e parcelas vinculadas a vendas
    executeDelete(
      'commissions',
      `DELETE FROM commissions 
       WHERE clinica_id = {:clinica_id} 
          OR saleId IN (SELECT id FROM sales WHERE clinica_id = {:clinica_id})`,
    )

    executeDelete(
      'installments',
      `DELETE FROM installments 
       WHERE clinica_id = {:clinica_id} 
          OR saleId IN (SELECT id FROM sales WHERE clinica_id = {:clinica_id})`,
    )

    // 5. Notas fiscais e NFSe de vendas da clínica
    executeDelete(
      'notas_fiscais',
      `DELETE FROM notas_fiscais 
       WHERE clinica_id = {:clinica_id} 
          OR venda IN (SELECT id FROM sales WHERE clinica_id = {:clinica_id})`,
    )

    executeDelete(
      'nfse_emitidas',
      `DELETE FROM nfse_emitidas 
       WHERE clinica_id = {:clinica_id} 
          OR sale IN (SELECT id FROM sales WHERE clinica_id = {:clinica_id})`,
    )

    executeDelete(
      'nf_servico_comissao',
      `DELETE FROM nf_servico_comissao 
       WHERE clinica_id = {:clinica_id} 
          OR venda_b2b_id IN (SELECT id FROM vendas_b2b WHERE clinica_id = {:clinica_id})`,
    )

    executeDelete(
      'itens_venda_b2b',
      `DELETE FROM itens_venda_b2b 
       WHERE clinica_id = {:clinica_id} 
          OR venda_b2b_id IN (SELECT id FROM vendas_b2b WHERE clinica_id = {:clinica_id})`,
    )

    executeDelete('vendas_b2b', `DELETE FROM vendas_b2b WHERE clinica_id = {:clinica_id}`)

    // 6. Movimentações de caixa e fechamentos de caixa
    executeDelete(
      'movimentacoes_caixa',
      `DELETE FROM movimentacoes_caixa 
       WHERE clinica_id = {:clinica_id} 
          OR sale IN (SELECT id FROM sales WHERE clinica_id = {:clinica_id})
          OR fechamento IN (SELECT id FROM fechamentos_caixa WHERE clinica_id = {:clinica_id})`,
    )

    executeDelete(
      'fechamentos_caixa',
      `DELETE FROM fechamentos_caixa WHERE clinica_id = {:clinica_id}`,
    )

    // 7. Cash flow (fluxo de caixa) e despesas da clínica
    executeDelete('cash_flow', `DELETE FROM cash_flow WHERE clinica_id = {:clinica_id}`)

    executeDelete('despesas', `DELETE FROM despesas WHERE clinica_id = {:clinica_id}`)

    // 8. Vendas diretas / PDV e orçamentos (budgets)
    executeDelete('sales', `DELETE FROM sales WHERE clinica_id = {:clinica_id}`)

    executeDelete('budgets', `DELETE FROM budgets WHERE clinica_id = {:clinica_id}`)

    // 9. Manutenções, ajustes e ordens de serviço de aparelhos auditivos
    executeDelete(
      'maintenances',
      `DELETE FROM maintenances 
       WHERE clinica_id = {:clinica_id} 
          OR hearingAidId IN (SELECT id FROM hearing_aids WHERE clinica_id = {:clinica_id})`,
    )

    executeDelete(
      'adjustments',
      `DELETE FROM adjustments 
       WHERE clinica_id = {:clinica_id} 
          OR hearingAidId IN (SELECT id FROM hearing_aids WHERE clinica_id = {:clinica_id})`,
    )

    executeDelete(
      'ordens_servico',
      `DELETE FROM ordens_servico 
       WHERE clinica_id = {:clinica_id} 
          OR aparelho IN (SELECT id FROM hearing_aids WHERE clinica_id = {:clinica_id})
          OR paciente IN (SELECT id FROM patients WHERE clinica_id = {:clinica_id})`,
    )

    // Testes de aparelho auditivo
    executeDelete(
      'hearing_aid_tests',
      `DELETE FROM hearing_aid_tests 
       WHERE clinica_id = {:clinica_id} 
          OR patient_id IN (SELECT id FROM patients WHERE clinica_id = {:clinica_id})`,
    )

    executeDelete(
      'testes_aparelho',
      `DELETE FROM testes_aparelho 
       WHERE clinica_id = {:clinica_id} 
          OR paciente_id IN (SELECT id FROM patients WHERE clinica_id = {:clinica_id})`,
    )

    // Aparelhos auditivos vinculados a pacientes da clínica
    executeDelete(
      'hearing_aids',
      `DELETE FROM hearing_aids 
       WHERE clinica_id = {:clinica_id} 
          OR patientId IN (SELECT id FROM patients WHERE clinica_id = {:clinica_id})`,
    )

    // 10. Exames audiológicos
    executeDelete(
      'audiometry_exams',
      `DELETE FROM audiometry_exams 
       WHERE clinica_id = {:clinica_id} 
          OR patient IN (SELECT id FROM patients WHERE clinica_id = {:clinica_id})`,
    )

    executeDelete(
      'audiometries',
      `DELETE FROM audiometries 
       WHERE clinica_id = {:clinica_id} 
          OR patientId IN (SELECT id FROM patients WHERE clinica_id = {:clinica_id})`,
    )

    executeDelete(
      'imitanciometrias',
      `DELETE FROM imitanciometrias 
       WHERE clinica_id = {:clinica_id} 
          OR paciente_id IN (SELECT id FROM patients WHERE clinica_id = {:clinica_id})`,
    )

    executeDelete(
      'tympanometries',
      `DELETE FROM tympanometries 
       WHERE clinica_id = {:clinica_id} 
          OR patientId IN (SELECT id FROM patients WHERE clinica_id = {:clinica_id})`,
    )

    executeDelete(
      'beras',
      `DELETE FROM beras 
       WHERE clinica_id = {:clinica_id} 
          OR patientId IN (SELECT id FROM patients WHERE clinica_id = {:clinica_id})`,
    )

    // 11. Prontuários clínicos, evoluções e consentimentos
    executeDelete(
      'clinical_records',
      `DELETE FROM clinical_records 
       WHERE clinica_id = {:clinica_id} 
          OR patientId IN (SELECT id FROM patients WHERE clinica_id = {:clinica_id})`,
    )

    executeDelete(
      'evolutions',
      `DELETE FROM evolutions 
       WHERE clinica_id = {:clinica_id} 
          OR patientId IN (SELECT id FROM patients WHERE clinica_id = {:clinica_id})`,
    )

    executeDelete(
      'consentimentos',
      `DELETE FROM consentimentos 
       WHERE clinica_id = {:clinica_id} 
          OR paciente_id IN (SELECT id FROM patients WHERE clinica_id = {:clinica_id})`,
    )

    // 12. Lembretes WhatsApp e Agendamentos
    executeDelete(
      'lembretes_whatsapp',
      `DELETE FROM lembretes_whatsapp 
       WHERE clinica_id = {:clinica_id} 
          OR agendamento_id IN (SELECT id FROM appointments WHERE clinica_id = {:clinica_id})
          OR paciente_id IN (SELECT id FROM patients WHERE clinica_id = {:clinica_id})`,
    )

    executeDelete(
      'appointments',
      `DELETE FROM appointments 
       WHERE clinica_id = {:clinica_id} 
          OR patientId IN (SELECT id FROM patients WHERE clinica_id = {:clinica_id})`,
    )

    // 13. Audit logs de pacientes da clínica
    executeDelete(
      'audit_logs',
      `DELETE FROM audit_logs 
       WHERE clinica_id = {:clinica_id} 
          OR paciente_id IN (SELECT id FROM patients WHERE clinica_id = {:clinica_id})`,
    )

    // 14. Pacientes da clínica Audição360
    executeDelete('patients', `DELETE FROM patients WHERE clinica_id = {:clinica_id}`)
  },
  (app) => {
    // Revert vazio — a deleção de registros de teste/demonstração não pode ser desfeita automaticamente
  },
)
