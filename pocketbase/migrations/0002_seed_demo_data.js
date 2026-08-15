migrate(
  (app) => {
    // ============================================================
    // Helper: create record if not already present (idempotent)
    // ============================================================
    const findPatientByName = (name) => {
      try {
        return app.findFirstRecordByData('patients', 'name', name)
      } catch (_) {
        return null
      }
    }

    const findStockByName = (name) => {
      try {
        return app.findFirstRecordByData('inventory', 'name', name)
      } catch (_) {
        return null
      }
    }

    // ============================================================
    // 0. Demo auth users
    // ============================================================
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    const demoUsers = [
      {
        email: 'admin@audicao360.com.br',
        password: 'Admin@123',
        name: 'Dra. Mariana Silva Costa',
        role: 'admin',
        crmCrfa: 'CRFa 2-18492',
      },
      {
        email: 'profissional@audicao360.com.br',
        password: 'Profissional@123',
        name: 'Dr. Lucas Ferreira Santos',
        role: 'profissional',
        crmCrfa: 'CRFa 2-20381',
      },
    ]

    demoUsers.forEach((u) => {
      try {
        app.findAuthRecordByEmail('_pb_users_auth_', u.email)
      } catch (_) {
        const rec = new Record(usersCol)
        rec.setEmail(u.email)
        rec.setPassword(u.password)
        rec.setVerified(true)
        rec.set('name', u.name)
        rec.set('role', u.role)
        rec.set('crmCrfa', u.crmCrfa)
        app.save(rec)
      }
    })

    // ============================================================
    // Helper: relative date YYYY-MM-DD
    // ============================================================
    const relDate = (offsetDays) => {
      const d = new Date()
      d.setDate(d.getDate() + offsetDays)
      const y = d.getUTCFullYear()
      const m = String(d.getUTCMonth() + 1).padStart(2, '0')
      const day = String(d.getUTCDate()).padStart(2, '0')
      return y + '-' + m + '-' + day
    }

    // ============================================================
    // 1. Patients (15)
    // ============================================================
    const patientsCol = app.findCollectionByNameOrId('patients')

    const patientSeed = [
      {
        name: 'Antônio Carlos de Albuquerque',
        cpf: '123.456.789-00',
        birthDate: '1952-04-15',
        gender: 'Masculino',
        phone: '(11) 3284-5510',
        mobile: '(11) 98765-4321',
        email: 'antonio.carlos@email.com.br',
        cep: '01310-100',
        street: 'Avenida Paulista',
        number: '1200',
        complement: 'Apto 42',
        neighborhood: 'Bela Vista',
        city: 'São Paulo',
        state: 'SP',
        planType: 'Convênio',
        planName: 'Bradesco Saúde',
        cardNumber: '9842018492019',
        hasResponsible: true,
        responsible: {
          name: 'Carla Albuquerque (Filha)',
          relationship: 'Filha',
          cpf: '321.654.987-11',
          phone: '(11) 97654-3210',
          email: 'carla.albuquerque@email.com.br',
        },
        hearingLossType: 'Neurossensorial',
        previousHearingAid: true,
        previousAidBrand: 'Phonak',
        previousAidModel: 'Audeo M50',
        generalNotes:
          'Relata zumbido bilateral de alta frequência há mais de 3 anos. Boa aceitação à amplificação sonora.',
        status: 'Em tratamento',
        lastVisit: relDate(-5),
      },
      {
        name: 'Maria Helena Ribeiro Ramos',
        cpf: '234.567.890-11',
        birthDate: '1960-08-22',
        gender: 'Feminino',
        phone: '(11) 2950-8812',
        mobile: '(11) 99123-8844',
        email: 'helena.ramos@email.com.br',
        cep: '04538-132',
        street: 'Rua Joaquim Floriano',
        number: '466',
        complement: 'Sala 31',
        neighborhood: 'Itaim Bibi',
        city: 'São Paulo',
        state: 'SP',
        planType: 'Particular',
        hearingLossType: 'Mista',
        previousHearingAid: false,
        generalNotes:
          'Queixa de dificuldade de compreensão em ambientes ruidosos e reuniões de família.',
        status: 'Ativo',
        lastVisit: relDate(-3),
      },
      {
        name: 'José Roberto de Oliveira',
        cpf: '345.678.901-22',
        birthDate: '1948-11-03',
        gender: 'Masculino',
        phone: '(11) 3662-1100',
        mobile: '(11) 98234-5678',
        email: 'jroberto.oliveira@email.com.br',
        cep: '01228-200',
        street: 'Rua Higienópolis',
        number: '750',
        neighborhood: 'Higienópolis',
        city: 'São Paulo',
        state: 'SP',
        planType: 'Convênio',
        planName: 'SulAmérica',
        cardNumber: '5543219870001',
        hearingLossType: 'Neurossensorial',
        previousHearingAid: true,
        previousAidBrand: 'Oticon',
        previousAidModel: 'Opn 1',
        generalNotes:
          'Adaptação bilateral realizada com sucesso em 2024. Retorno para revisão preventiva e limpeza de filtros.',
        status: 'Ativo',
        lastVisit: relDate(-8),
      },
      {
        name: 'Beatriz Vasconcelos Prado',
        cpf: '456.789.012-33',
        birthDate: '1975-02-18',
        gender: 'Feminino',
        phone: '(11) 3812-4400',
        mobile: '(11) 97345-6789',
        email: 'beatriz.prado@email.com.br',
        cep: '05407-002',
        street: 'Rua dos Pinheiros',
        number: '820',
        complement: 'Conj 102',
        neighborhood: 'Pinheiros',
        city: 'São Paulo',
        state: 'SP',
        planType: 'Particular',
        hearingLossType: 'Condutiva',
        previousHearingAid: false,
        generalNotes:
          'Histórico de otite média crônica na infância. Acompanhamento pós-cirúrgico de timpanoplastia.',
        status: 'Em tratamento',
        lastVisit: relDate(-2),
      },
      {
        name: 'Francisco Assis Menezes',
        cpf: '567.890.123-44',
        birthDate: '1941-09-30',
        gender: 'Masculino',
        phone: '(11) 5051-2290',
        mobile: '(11) 98456-7890',
        email: 'francisco.menezes@email.com.br',
        cep: '04083-000',
        street: 'Alameda dos Maracatins',
        number: '1435',
        neighborhood: 'Moema',
        city: 'São Paulo',
        state: 'SP',
        planType: 'Convênio',
        planName: 'Unimed Seguros',
        cardNumber: '0032918239012',
        hasResponsible: true,
        responsible: {
          name: 'Paulo Menezes',
          relationship: 'Filho',
          cpf: '445.556.667-88',
          phone: '(11) 98111-2233',
          email: 'paulo.menezes@email.com.br',
        },
        hearingLossType: 'Neurossensorial',
        previousHearingAid: true,
        previousAidBrand: 'Widex',
        previousAidModel: 'Evoke 440',
        generalNotes:
          'Perda auditiva severa em frequências agudas bilateralmente. Dificuldade de manuseio de pilhas pequenas.',
        status: 'Ativo',
        lastVisit: relDate(-12),
      },
      {
        name: 'Clara Regina Meirelles',
        cpf: '678.901.234-55',
        birthDate: '1968-12-11',
        gender: 'Feminino',
        phone: '(11) 2295-3344',
        mobile: '(11) 99567-8901',
        email: 'clara.meirelles@email.com.br',
        cep: '03308-000',
        street: 'Rua Tuiuti',
        number: '2100',
        neighborhood: 'Tatuapé',
        city: 'São Paulo',
        state: 'SP',
        planType: 'Particular',
        hearingLossType: 'Neurossensorial',
        previousHearingAid: false,
        generalNotes:
          'Primeira consulta de avaliação auditiva indicada por médico otorrinolaringologista.',
        status: 'Ativo',
        lastVisit: relDate(-9),
      },
      {
        name: 'Waldemar Ferreira de Souza',
        cpf: '789.012.345-66',
        birthDate: '1945-03-05',
        gender: 'Masculino',
        phone: '(11) 3208-9900',
        mobile: '(11) 98678-9012',
        email: 'waldemar.souza@email.com.br',
        cep: '01538-000',
        street: 'Avenida Lins de Vasconcelos',
        number: '1600',
        neighborhood: 'Cambuci',
        city: 'São Paulo',
        state: 'SP',
        planType: 'Convênio',
        planName: 'NotreDame Intermédica',
        cardNumber: '7765123490002',
        hearingLossType: 'Neurossensorial',
        previousHearingAid: true,
        previousAidBrand: 'Signia',
        previousAidModel: 'Pure Charge&Go 7X',
        generalNotes: 'Uso de aparelho recarregável. Realizada troca de oliva e filtro de cera.',
        status: 'Ativo',
        lastVisit: relDate(-15),
      },
      {
        name: 'Lúcia de Fátima Barreto',
        cpf: '890.123.456-77',
        birthDate: '1982-07-19',
        gender: 'Feminino',
        phone: '(11) 3845-6677',
        mobile: '(11) 97789-0123',
        email: 'lucia.barreto@email.com.br',
        cep: '04551-000',
        street: 'Rua Funchal',
        number: '300',
        neighborhood: 'Vila Olímpia',
        city: 'São Paulo',
        state: 'SP',
        planType: 'Particular',
        hearingLossType: 'Normal',
        previousHearingAid: false,
        generalNotes:
          'Exame ocupacional periódico de audiometria. Limiares dentro dos padrões de normalidade.',
        status: 'Inativo',
        lastVisit: relDate(-30),
      },
      {
        name: 'Geraldo Magela Barbosa',
        cpf: '901.234.567-88',
        birthDate: '1955-06-25',
        gender: 'Masculino',
        phone: '(11) 5531-4455',
        mobile: '(11) 98890-1234',
        email: 'geraldo.barbosa@email.com.br',
        cep: '04601-000',
        street: 'Avenida Washington Luís',
        number: '3500',
        neighborhood: 'Santo Amaro',
        city: 'São Paulo',
        state: 'SP',
        planType: 'Convênio',
        planName: 'Amil Saúde',
        cardNumber: '4432198755001',
        hearingLossType: 'Neurossensorial',
        previousHearingAid: true,
        previousAidBrand: 'Starkey',
        previousAidModel: 'Livio AI 2400',
        generalNotes:
          'Aparelho com sensor de queda integrado. Paciente muito satisfeito com conectividade Bluetooth.',
        status: 'Ativo',
        lastVisit: relDate(-6),
      },
      {
        name: 'Tereza Cristina Neves',
        cpf: '012.345.678-99',
        birthDate: '1963-10-14',
        gender: 'Feminino',
        phone: '(11) 3032-8877',
        mobile: '(11) 99901-2345',
        email: 'tereza.neves@email.com.br',
        cep: '05425-070',
        street: 'Avenida Brigadeiro Faria Lima',
        number: '1800',
        neighborhood: 'Jardim Paulistano',
        city: 'São Paulo',
        state: 'SP',
        planType: 'Particular',
        hearingLossType: 'Neurossensorial',
        previousHearingAid: false,
        generalNotes:
          'Em fase de teste domiciliar de adaptação de aparelho auditivo Signia Styletto AX.',
        status: 'Em tratamento',
        lastVisit: relDate(-1),
      },
      {
        name: 'Arnaldo Cezar de Toledo',
        cpf: '112.233.445-56',
        birthDate: '1950-01-20',
        gender: 'Masculino',
        phone: '(11) 2977-1122',
        mobile: '(11) 97012-3456',
        email: 'arnaldo.toledo@email.com.br',
        cep: '02013-000',
        street: 'Rua Voluntários da Pátria',
        number: '2800',
        neighborhood: 'Santana',
        city: 'São Paulo',
        state: 'SP',
        planType: 'Convênio',
        planName: 'Porto Seguro Saúde',
        cardNumber: '1122334455667',
        hearingLossType: 'Mista',
        previousHearingAid: true,
        previousAidBrand: 'Phonak',
        previousAidModel: 'Naída Paradise',
        generalNotes:
          'Perda auditiva severa à profunda. Utiliza molde anatômico com ventilação de alívio.',
        status: 'Ativo',
        lastVisit: relDate(-7),
      },
      {
        name: 'Sônia Maria dos Anjos',
        cpf: '223.344.556-67',
        birthDate: '1958-05-12',
        gender: 'Feminino',
        phone: '(11) 3672-9900',
        mobile: '(11) 98123-4567',
        email: 'sonia.anjos@email.com.br',
        cep: '05014-000',
        street: 'Rua Palestra Itália',
        number: '500',
        neighborhood: 'Perdizes',
        city: 'São Paulo',
        state: 'SP',
        planType: 'Particular',
        hearingLossType: 'Neurossensorial',
        previousHearingAid: false,
        generalNotes:
          'Indicação para adaptação binaural de aparelhos com foco em cancelamento de ruído.',
        status: 'Em tratamento',
        lastVisit: relDate(-4),
      },
      {
        name: 'Benedito Ruy Moreira',
        cpf: '334.455.667-78',
        birthDate: '1939-12-08',
        gender: 'Masculino',
        phone: '(11) 3141-5566',
        mobile: '(11) 99234-5678',
        email: 'benedito.moreira@email.com.br',
        cep: '01407-100',
        street: 'Alameda Campinas',
        number: '890',
        neighborhood: 'Jardim Paulista',
        city: 'São Paulo',
        state: 'SP',
        planType: 'Convênio',
        planName: 'Bradesco Saúde',
        cardNumber: '8877665544332',
        hasResponsible: true,
        responsible: {
          name: 'Eduardo Moreira',
          relationship: 'Filho',
          cpf: '556.667.778-99',
          phone: '(11) 98877-6655',
          email: 'eduardo.moreira@email.com.br',
        },
        hearingLossType: 'Neurossensorial',
        previousHearingAid: true,
        previousAidBrand: 'Widex',
        previousAidModel: 'Moment 330',
        generalNotes: 'Uso constante, boa destreza manual para limpeza.',
        status: 'Ativo',
        lastVisit: relDate(-18),
      },
      {
        name: 'Camila Duarte Silveira',
        cpf: '445.566.778-89',
        birthDate: '1995-03-27',
        gender: 'Feminino',
        phone: '(11) 3088-2211',
        mobile: '(11) 97345-1122',
        email: 'camila.silveira@email.com.br',
        cep: '01419-001',
        street: 'Rua Oscar Freire',
        number: '1400',
        neighborhood: 'Cerqueira César',
        city: 'São Paulo',
        state: 'SP',
        planType: 'Particular',
        hearingLossType: 'Normal',
        previousHearingAid: false,
        generalNotes:
          'Músico profissional, busca protetores auditivos personalizados para ensaios e shows.',
        status: 'Ativo',
        lastVisit: relDate(-11),
      },
      {
        name: 'Osvaldo Cruz Fagundes',
        cpf: '556.677.889-90',
        birthDate: '1957-09-15',
        gender: 'Masculino',
        phone: '(11) 2091-8899',
        mobile: '(11) 98456-3344',
        email: 'osvaldo.fagundes@email.com.br',
        cep: '03080-000',
        street: 'Rua Cantagalo',
        number: '920',
        neighborhood: 'Vila Gomes Cardim',
        city: 'São Paulo',
        state: 'SP',
        planType: 'Convênio',
        planName: 'Care Plus',
        cardNumber: '9988776655441',
        hearingLossType: 'Condutiva',
        previousHearingAid: false,
        generalNotes: 'Audiometria pós-estapedectomia para reavaliação de ganho auditivo.',
        status: 'Em tratamento',
        lastVisit: relDate(-2),
      },
    ]

    patientSeed.forEach((p) => {
      if (findPatientByName(p.name)) return
      const rec = new Record(patientsCol)
      rec.set('name', p.name)
      rec.set('cpf', p.cpf)
      rec.set('birthDate', p.birthDate)
      rec.set('gender', p.gender)
      rec.set('phone', p.phone)
      rec.set('mobile', p.mobile)
      rec.set('email', p.email)
      rec.set('cep', p.cep)
      rec.set('street', p.street)
      rec.set('number', p.number)
      rec.set('complement', p.complement || '')
      rec.set('neighborhood', p.neighborhood)
      rec.set('city', p.city)
      rec.set('state', p.state)
      rec.set('planType', p.planType)
      rec.set('planName', p.planName || '')
      rec.set('cardNumber', p.cardNumber || '')
      rec.set('hasResponsible', !!p.hasResponsible)
      rec.set('responsible', p.responsible || {})
      rec.set('hearingLossType', p.hearingLossType)
      rec.set('previousHearingAid', !!p.previousHearingAid)
      rec.set('previousAidBrand', p.previousAidBrand || '')
      rec.set('previousAidModel', p.previousAidModel || '')
      rec.set('generalNotes', p.generalNotes || '')
      rec.set('status', p.status)
      rec.set('lastVisit', p.lastVisit || '')
      app.save(rec)
    })

    const patientId = (name) => {
      const p = findPatientByName(name)
      return p ? p.id : ''
    }

    // ============================================================
    // 2. Appointments (~20 between today and +30 days)
    // ============================================================
    const apptsCol = app.findCollectionByNameOrId('appointments')
    if (app.countRecords('appointments') === 0) {
      const apptSeed = [
        {
          p: 'Antônio Carlos de Albuquerque',
          phone: '(11) 98765-4321',
          type: 'Avaliação auditiva',
          date: relDate(0),
          time: '08:30',
          duration: 60,
          prof: 'Dra. Mariana Silva Costa',
          status: 'Confirmado',
          notes: 'Reavaliação anual dos limiares auditivos.',
        },
        {
          p: 'Maria Helena Ribeiro Ramos',
          phone: '(11) 99123-8844',
          type: 'Adaptação de aparelho',
          date: relDate(0),
          time: '10:00',
          duration: 60,
          prof: 'Dr. Lucas Ferreira Santos',
          status: 'Agendado',
          notes: 'Primeira sessão de adaptação e programação do Widex Moment 440.',
        },
        {
          p: 'Beatriz Vasconcelos Prado',
          phone: '(11) 97345-6789',
          type: 'Audiometria',
          date: relDate(0),
          time: '11:30',
          duration: 45,
          prof: 'Dra. Mariana Silva Costa',
          status: 'Confirmado',
          notes: 'Audiometria tonal e vocal + imitanciometria.',
        },
        {
          p: 'Waldemar Ferreira de Souza',
          phone: '(11) 98678-9012',
          type: 'Manutenção',
          date: relDate(0),
          time: '14:00',
          duration: 30,
          prof: 'Dr. Lucas Ferreira Santos',
          status: 'Confirmado',
          notes: 'Limpeza ultrassônica e troca de filtros de cera.',
        },
        {
          p: 'Tereza Cristina Neves',
          phone: '(11) 99901-2345',
          type: 'Retorno/ajuste',
          date: relDate(0),
          time: '15:30',
          duration: 45,
          prof: 'Dra. Mariana Silva Costa',
          status: 'Agendado',
          notes: 'Ajuste de ganho para frequências agudas e teste de compreensão.',
        },
        {
          p: 'José Roberto de Oliveira',
          phone: '(11) 98234-5678',
          type: 'Entrega de aparelho',
          date: relDate(1),
          time: '09:00',
          duration: 60,
          prof: 'Dr. Lucas Ferreira Santos',
          status: 'Confirmado',
          notes: 'Entrega do par de Phonak Lumity L90 com molde customizado.',
        },
        {
          p: 'Francisco Assis Menezes',
          phone: '(11) 98456-7890',
          type: 'Imitanciometria',
          date: relDate(1),
          time: '10:30',
          duration: 30,
          prof: 'Dra. Mariana Silva Costa',
          status: 'Agendado',
          notes: 'Curva timpanométrica e pesquisa de reflexos estapedianos.',
        },
        {
          p: 'Clara Regina Meirelles',
          phone: '(11) 99567-8901',
          type: 'Logoaudiometria',
          date: relDate(1),
          time: '14:00',
          duration: 45,
          prof: 'Dr. Lucas Ferreira Santos',
          status: 'Agendado',
          notes: 'Pesquisa de LRF e IPRF bilateral.',
        },
        {
          p: 'Sônia Maria dos Anjos',
          phone: '(11) 98123-4567',
          type: 'BERA',
          date: relDate(1),
          time: '15:30',
          duration: 90,
          prof: 'Dra. Mariana Silva Costa',
          status: 'Confirmado',
          notes: 'Investigação de integridade de vias auditivas do tronco encefálico.',
        },
        {
          p: 'Camila Duarte Silveira',
          phone: '(11) 97345-1122',
          type: 'Orientação',
          date: relDate(2),
          time: '11:00',
          duration: 30,
          prof: 'Dr. Lucas Ferreira Santos',
          status: 'Agendado',
          notes: 'Orientações de conservação vocal e proteção acústica.',
        },
        {
          p: 'Arnaldo Cezar de Toledo',
          phone: '(11) 97012-3456',
          type: 'Manutenção',
          date: relDate(3),
          time: '09:30',
          duration: 30,
          prof: 'Dr. Lucas Ferreira Santos',
          status: 'Agendado',
          notes: 'Revisão técnica e troca de tubo fino.',
        },
        {
          p: 'Geraldo Magela Barbosa',
          phone: '(11) 98890-1234',
          type: 'Retorno/ajuste',
          date: relDate(4),
          time: '10:00',
          duration: 45,
          prof: 'Dra. Mariana Silva Costa',
          status: 'Agendado',
          notes: 'Avaliação de conectividade Bluetooth e ajuste de programa musical.',
        },
        {
          p: 'Maria Helena Ribeiro Ramos',
          phone: '(11) 99123-8844',
          type: 'Retorno/ajuste',
          date: relDate(5),
          time: '08:00',
          duration: 45,
          prof: 'Dr. Lucas Ferreira Santos',
          status: 'Agendado',
          notes: 'Primeiro retorno pós-adaptação para checagem de conforto.',
        },
        {
          p: 'Osvaldo Cruz Fagundes',
          phone: '(11) 98456-3344',
          type: 'Avaliação auditiva',
          date: relDate(6),
          time: '13:30',
          duration: 60,
          prof: 'Dra. Mariana Silva Costa',
          status: 'Agendado',
          notes: 'Reavaliação pós-cirúrgica estapedectomia.',
        },
        {
          p: 'Benedito Ruy Moreira',
          phone: '(11) 99234-5678',
          type: 'Manutenção',
          date: relDate(7),
          time: '09:00',
          duration: 30,
          prof: 'Dr. Lucas Ferreira Santos',
          status: 'Agendado',
          notes: 'Troca de pilhas e checagem eletroacústica.',
        },
        {
          p: 'Lúcia de Fátima Barreto',
          phone: '(11) 97789-0123',
          type: 'Audiometria',
          date: relDate(10),
          time: '11:00',
          duration: 45,
          prof: 'Dra. Mariana Silva Costa',
          status: 'Agendado',
          notes: 'Audiometria ocupacional anual.',
        },
        {
          p: 'Antônio Carlos de Albuquerque',
          phone: '(11) 98765-4321',
          type: 'Retorno/ajuste',
          date: relDate(14),
          time: '10:00',
          duration: 45,
          prof: 'Dra. Mariana Silva Costa',
          status: 'Agendado',
          notes: 'Avaliação do zumbido com máscara acústica.',
        },
        {
          p: 'Beatriz Vasconcelos Prado',
          phone: '(11) 97345-6789',
          type: 'Retorno/ajuste',
          date: relDate(18),
          time: '15:00',
          duration: 30,
          prof: 'Dr. Lucas Ferreira Santos',
          status: 'Agendado',
          notes: 'Checagem pós-timpanoplastia.',
        },
        {
          p: 'José Roberto de Oliveira',
          phone: '(11) 98234-5678',
          type: 'Manutenção',
          date: relDate(22),
          time: '09:00',
          duration: 30,
          prof: 'Dr. Lucas Ferreira Santos',
          status: 'Agendado',
          notes: 'Troca de receptores e limpeza.',
        },
        {
          p: 'Francisco Assis Menezes',
          phone: '(11) 98456-7890',
          type: 'Retorno/ajuste',
          date: relDate(28),
          time: '14:00',
          duration: 45,
          prof: 'Dra. Mariana Silva Costa',
          status: 'Agendado',
          notes: 'Avaliação de satisfação e ajuste fino.',
        },
      ]
      apptSeed.forEach((a) => {
        const rec = new Record(apptsCol)
        rec.set('patientId', patientId(a.p))
        rec.set('patientName', a.p)
        rec.set('patientPhone', a.phone)
        rec.set('type', a.type)
        rec.set('date', a.date)
        rec.set('time', a.time)
        rec.set('duration', a.duration)
        rec.set('professionalName', a.prof)
        rec.set('status', a.status)
        rec.set('notes', a.notes || '')
        app.save(rec)
      })
    }

    // ============================================================
    // 3. Clinical records (~5)
    // ============================================================
    const clinCol = app.findCollectionByNameOrId('clinical_records')
    const clinSeed = [
      {
        name: 'Antônio Carlos de Albuquerque',
        mainComplaint:
          'Dificuldade para ouvir televisão e conversas em grupo. Presença de zumbido agudo contínuo no ouvido direito.',
        anamnesis:
          'Paciente relata início gradual da perda auditiva há cerca de 5 anos. Sem histórico de vertigem ou otorreia.',
        hearingHistory:
          'Trabalhou em indústria metalúrgica durante 20 anos na juventude, com exposição a ruído sem EPI adequado.',
        currentMedications: 'Losartana 50mg/dia para hipertensão arterial.',
        familyHistory: 'Pai apresentava perda auditiva importante a partir dos 65 anos.',
        diagnosis: 'Perda auditiva neurossensorial bilateral de grau moderado a severo, simétrica.',
        conduct:
          'Indicada protetização auditiva bilateral com tecnologia de redução de zumbido. Retorno em 30 dias para revisão.',
        nextReturn: relDate(30),
        updatedAt: relDate(-5),
      },
      {
        name: 'Maria Helena Ribeiro Ramos',
        mainComplaint:
          'Sensação de ouvido tampado e perda de inteligibilidade em ambientes com eco ou música alta.',
        anamnesis: 'Sintomas iniciados há 2 anos, piora perceptível nos últimos 6 meses.',
        hearingHistory: 'Não relata exposição ocupacional a ruído. Crises eventuais de sinusite.',
        currentMedications: 'Nenhuma medicação contínua.',
        familyHistory: 'Mãe utilizava aparelho auditivo.',
        diagnosis: 'Perda auditiva mista bilateral leve a moderada.',
        conduct:
          'Adaptação de aparelho auditivo Widex Moment 440. Fonoaudiologia para reabilitação do reconhecimento de fala.',
        nextReturn: relDate(15),
        updatedAt: relDate(-3),
      },
      {
        name: 'Beatriz Vasconcelos Prado',
        mainComplaint:
          'Sensação de plenitude auricular e queda da audição após cirurgia de timpanoplastia.',
        anamnesis: 'Histórico de otite média crônica na infância com múltiplos episódios.',
        hearingHistory: 'Cirurgia otológica há 6 meses, em acompanhamento pós-operatório.',
        currentMedications: 'Antibiótico tópico por 7 dias.',
        familyHistory: 'Sem histórico familiar relevante.',
        diagnosis: 'Perda auditiva condutiva pós-cirúrgica em melhora.',
        conduct: 'Acompanhamento mensal e nova audiometria em 30 dias.',
        nextReturn: relDate(30),
        updatedAt: relDate(-2),
      },
      {
        name: 'José Roberto de Oliveira',
        mainComplaint: 'Dificuldade de audição progressiva bilateral há 8 anos.',
        anamnesis: 'Paciente adaptado com aparelhos bilateralmente, em uso há 1 ano.',
        hearingHistory: 'Exposição a ruído industrial por 15 anos.',
        currentMedications: 'AAS 100mg, sinvastatina 20mg.',
        familyHistory: 'Irmão com aparelho auditivo.',
        diagnosis: 'Perda neurossensorial bilateral moderada a severa.',
        conduct: 'Manter adaptação atual, retorno semestral para revisão.',
        nextReturn: relDate(60),
        updatedAt: relDate(-8),
      },
      {
        name: 'Francisco Assis Menezes',
        mainComplaint: 'Dificuldade importante de audição, principalmente em ambientes ruidosos.',
        anamnesis: 'Paciente idoso com comorbidades cardiovasculares.',
        hearingHistory:
          'Uso de aparelho há 4 anos, com dificuldade de manuseio das pilhas pequenas.',
        currentMedications: 'Metformina 850mg, losartana 50mg.',
        familyHistory: 'Sem histórico familiar relevante.',
        diagnosis: 'Perda auditiva neurossensorial severa bilateral.',
        conduct: 'Troca por aparelho recarregável e molde mais fácil de manusear.',
        nextReturn: relDate(20),
        updatedAt: relDate(-12),
      },
    ]
    clinSeed.forEach((c) => {
      try {
        app.findFirstRecordByData('clinical_records', 'patientName', c.name)
      } catch (_) {
        const rec = new Record(clinCol)
        rec.set('patientId', patientId(c.name))
        rec.set('patientName', c.name)
        rec.set('mainComplaint', c.mainComplaint)
        rec.set('anamnesis', c.anamnesis)
        rec.set('hearingHistory', c.hearingHistory)
        rec.set('currentMedications', c.currentMedications)
        rec.set('familyHistory', c.familyHistory)
        rec.set('diagnosis', c.diagnosis)
        rec.set('conduct', c.conduct)
        rec.set('nextReturn', c.nextReturn || '')
        rec.set('updatedAt', c.updatedAt || '')
        app.save(rec)
      }
    })

    // ============================================================
    // 4. Evolutions (~10)
    // ============================================================
    const evoCol = app.findCollectionByNameOrId('evolutions')
    if (app.countRecords('evolutions') === 0) {
      const evoSeed = [
        {
          name: 'Antônio Carlos de Albuquerque',
          date: relDate(-5),
          prof: 'Dra. Mariana Silva Costa',
          desc: 'Realizada limpeza e checagem eletroacústica do aparelho Oticon. Paciente relata ganho substancial na compreensão de voz feminina. Queixa de zumbido controlada com máscara acústica.',
        },
        {
          name: 'Antônio Carlos de Albuquerque',
          date: relDate(-30),
          prof: 'Dr. Lucas Ferreira Santos',
          desc: 'Primeira regulagem do novo molde acrílico com ventilação de 1.5mm. Ajuste fino de ganho em 3000Hz para diminuir feedback acústico.',
        },
        {
          name: 'Maria Helena Ribeiro Ramos',
          date: relDate(-3),
          prof: 'Dr. Lucas Ferreira Santos',
          desc: 'Sessão inicial de aconselhamento e treino de colocação do aparelho. Paciente demonstrou boa coordenação motora.',
        },
        {
          name: 'Beatriz Vasconcelos Prado',
          date: relDate(-2),
          prof: 'Dra. Mariana Silva Costa',
          desc: 'Paciente relata melhora do zumbido pós-cirúrgico. Audiometria de controle mostra redução do gap aéreo-ósseo.',
        },
        {
          name: 'José Roberto de Oliveira',
          date: relDate(-8),
          prof: 'Dr. Lucas Ferreira Santos',
          desc: 'Manutenção preventiva dos aparelhos Phonak Lumity. Troca de receptores e limpeza por ultrassom.',
        },
        {
          name: 'Francisco Assis Menezes',
          date: relDate(-12),
          prof: 'Dra. Mariana Silva Costa',
          desc: 'Avaliação de satisfação com aparelho atual. Paciente relata dificuldade de troca de pilhas, indicada transição para recarregável.',
        },
        {
          name: 'Waldemar Ferreira de Souza',
          date: relDate(-15),
          prof: 'Dr. Lucas Ferreira Santos',
          desc: 'Realizada troca de oliva e filtro de cera. Aparelho Signia recarregável com carga e funcionamento normais.',
        },
        {
          name: 'Tereza Cristina Neves',
          date: relDate(-1),
          prof: 'Dra. Mariana Silva Costa',
          desc: 'Início de teste domiciliar com Signia Styletto AX. Paciente orientada sobre uso progressivo de horas diárias.',
        },
        {
          name: 'Geraldo Magela Barbosa',
          date: relDate(-6),
          prof: 'Dra. Mariana Silva Costa',
          desc: 'Configuração do programa musical via app. Paciente satisfeito com conectividade Bluetooth e detecção de queda.',
        },
        {
          name: 'Sônia Maria dos Anjos',
          date: relDate(-4),
          prof: 'Dr. Lucas Ferreira Santos',
          desc: 'Sessão de aconselhamento sobre expectativas de adaptação binaural. Demonstração do programa de cancelamento de ruído.',
        },
      ]
      evoSeed.forEach((e) => {
        const rec = new Record(evoCol)
        rec.set('patientId', patientId(e.name))
        rec.set('patientName', e.name)
        rec.set('date', e.date)
        rec.set('professionalName', e.prof)
        rec.set('description', e.desc)
        app.save(rec)
      })
    }

    // ============================================================
    // 5. Audiometries (~6)
    // ============================================================
    const audCol = app.findCollectionByNameOrId('audiometries')
    if (app.countRecords('audiometries') === 0) {
      const audSeed = [
        {
          name: 'Antônio Carlos de Albuquerque',
          date: relDate(-5),
          prof: 'Dra. Mariana Silva Costa',
          airOD: { 250: 35, 500: 40, 1000: 50, 2000: 60, 3000: 65, 4000: 75, 6000: 80, 8000: 85 },
          airOE: { 250: 30, 500: 40, 1000: 45, 2000: 55, 3000: 60, 4000: 70, 6000: 75, 8000: 80 },
          boneOD: { 500: 40, 1000: 50, 2000: 60, 4000: 75 },
          boneOE: { 500: 40, 1000: 45, 2000: 55, 4000: 70 },
          srtOD: 55,
          srtOE: 50,
          iprfOD: 84,
          iprfOE: 88,
          lossDegree: 'Moderada',
          lossType: 'Neurossensorial',
          notes:
            'Configuração descendente bilateral simétrica, compatível com presbiacusia associada a histórico de ruído.',
        },
        {
          name: 'Maria Helena Ribeiro Ramos',
          date: relDate(-3),
          prof: 'Dr. Lucas Ferreira Santos',
          airOD: { 250: 40, 500: 45, 1000: 45, 2000: 50, 3000: 50, 4000: 55, 6000: 60, 8000: 65 },
          airOE: { 250: 35, 500: 40, 1000: 40, 2000: 45, 3000: 50, 4000: 55, 6000: 60, 8000: 60 },
          boneOD: { 500: 25, 1000: 30, 2000: 35, 4000: 40 },
          boneOE: { 500: 20, 1000: 25, 2000: 30, 4000: 35 },
          srtOD: 45,
          srtOE: 40,
          iprfOD: 92,
          iprfOE: 96,
          lossDegree: 'Moderada',
          lossType: 'Mista',
          notes: 'Gap aéreo-ósseo presente bilateralmente em graves e médios.',
        },
        {
          name: 'José Roberto de Oliveira',
          date: relDate(-8),
          prof: 'Dra. Mariana Silva Costa',
          airOD: { 250: 45, 500: 50, 1000: 60, 2000: 70, 3000: 75, 4000: 80, 6000: 85, 8000: 90 },
          airOE: { 250: 40, 500: 50, 1000: 55, 2000: 65, 3000: 70, 4000: 75, 6000: 80, 8000: 85 },
          boneOD: { 500: 45, 1000: 55, 2000: 65, 4000: 75 },
          boneOE: { 500: 45, 1000: 50, 2000: 60, 4000: 70 },
          srtOD: 65,
          srtOE: 60,
          iprfOD: 76,
          iprfOE: 80,
          lossDegree: 'Severa',
          lossType: 'Neurossensorial',
          notes: 'Perda neurossensorial descendente acentuada bilateral.',
        },
        {
          name: 'Francisco Assis Menezes',
          date: relDate(-12),
          prof: 'Dra. Mariana Silva Costa',
          airOD: { 250: 55, 500: 60, 1000: 70, 2000: 80, 3000: 85, 4000: 90, 6000: 95, 8000: 100 },
          airOE: { 250: 50, 500: 60, 1000: 70, 2000: 75, 3000: 85, 4000: 90, 6000: 95, 8000: 100 },
          boneOD: { 500: 55, 1000: 65, 2000: 75, 4000: 85 },
          boneOE: { 500: 55, 1000: 65, 2000: 70, 4000: 85 },
          srtOD: 75,
          srtOE: 70,
          iprfOD: 64,
          iprfOE: 68,
          lossDegree: 'Profunda',
          lossType: 'Neurossensorial',
          notes: 'Perda neurossensorial severa a profunda bilateral.',
        },
        {
          name: 'Lúcia de Fátima Barreto',
          date: relDate(-30),
          prof: 'Dra. Mariana Silva Costa',
          airOD: { 250: 10, 500: 10, 1000: 15, 2000: 15, 3000: 20, 4000: 20, 6000: 25, 8000: 25 },
          airOE: { 250: 10, 500: 10, 1000: 10, 2000: 15, 3000: 15, 4000: 20, 6000: 20, 8000: 25 },
          boneOD: { 500: 5, 1000: 10, 2000: 10, 4000: 15 },
          boneOE: { 500: 5, 1000: 5, 2000: 10, 4000: 10 },
          srtOD: 10,
          srtOE: 10,
          iprfOD: 100,
          iprfOE: 100,
          lossDegree: 'Normal',
          lossType: 'Neurossensorial',
          notes: 'Audiometria ocupacional dentro dos padrões de normalidade.',
        },
        {
          name: 'Beatriz Vasconcelos Prado',
          date: relDate(-2),
          prof: 'Dra. Mariana Silva Costa',
          airOD: { 250: 30, 500: 35, 1000: 40, 2000: 45, 3000: 45, 4000: 50, 6000: 50, 8000: 55 },
          airOE: { 250: 25, 500: 30, 1000: 35, 2000: 40, 3000: 40, 4000: 45, 6000: 50, 8000: 50 },
          boneOD: { 500: 15, 1000: 20, 2000: 25, 4000: 30 },
          boneOE: { 500: 10, 1000: 15, 2000: 20, 4000: 25 },
          srtOD: 40,
          srtOE: 35,
          iprfOD: 88,
          iprfOE: 92,
          lossDegree: 'Leve',
          lossType: 'Condutiva',
          notes:
            'Gap aéreo-ósseo presente bilateralmente, compatível com condutiva pós-cirúrgica em melhora.',
        },
      ]
      audSeed.forEach((a) => {
        const rec = new Record(audCol)
        rec.set('patientId', patientId(a.name))
        rec.set('patientName', a.name)
        rec.set('date', a.date)
        rec.set('professionalName', a.prof)
        rec.set('airOD', a.airOD)
        rec.set('airOE', a.airOE)
        rec.set('boneOD', a.boneOD)
        rec.set('boneOE', a.boneOE)
        rec.set('srtOD', a.srtOD)
        rec.set('srtOE', a.srtOE)
        rec.set('iprfOD', a.iprfOD)
        rec.set('iprfOE', a.iprfOE)
        rec.set('lossDegree', a.lossDegree)
        rec.set('lossType', a.lossType)
        rec.set('notes', a.notes || '')
        app.save(rec)
      })
    }

    // ============================================================
    // 6. Tympanometries (~2)
    // ============================================================
    const tympCol = app.findCollectionByNameOrId('tympanometries')
    if (app.countRecords('tympanometries') === 0) {
      const tympSeed = [
        {
          name: 'Antônio Carlos de Albuquerque',
          date: relDate(-5),
          prof: 'Dra. Mariana Silva Costa',
          tympanometryOD: { curve: 'A', compliance: 0.68, pressure: -15, volume: 1.15 },
          tympanometryOE: { curve: 'A', compliance: 0.72, pressure: -10, volume: 1.2 },
          reflexesOD: { 500: 'Presente', 1000: 'Presente', 2000: 'Presente', 4000: 'Ausente' },
          reflexesOE: { 500: 'Presente', 1000: 'Presente', 2000: 'Presente', 4000: 'Ausente' },
          conclusion:
            'Curvas timpanométricas tipo A bilateralmente, indicando mobilidade tímpano-ossicular normal. Reflexos ausentes em 4000Hz compatíveis com o grau da perda.',
          notes: 'Meato acústico livre de cerúmen no momento da testagem.',
        },
        {
          name: 'Beatriz Vasconcelos Prado',
          date: relDate(-2),
          prof: 'Dra. Mariana Silva Costa',
          tympanometryOD: { curve: 'C', compliance: 0.45, pressure: -180, volume: 1.3 },
          tympanometryOE: { curve: 'As', compliance: 0.3, pressure: -120, volume: 1.25 },
          reflexesOD: { 500: 'Ausente', 1000: 'Ausente', 2000: 'Ausente', 4000: 'Ausente' },
          reflexesOE: { 500: 'Ausente', 1000: 'Ausente', 2000: 'Ausente', 4000: 'Ausente' },
          conclusion:
            'Curva tipo C à direita sugerindo disfunção tubária; tipo As à esquerda compatível com sequela de otite. Reflexos ausentes bilateralmente.',
          notes: 'Paciente em pós-operatório de timpanoplastia.',
        },
      ]
      tympSeed.forEach((t) => {
        const rec = new Record(tympCol)
        rec.set('patientId', patientId(t.name))
        rec.set('patientName', t.name)
        rec.set('date', t.date)
        rec.set('professionalName', t.prof)
        rec.set('tympanometryOD', t.tympanometryOD)
        rec.set('tympanometryOE', t.tympanometryOE)
        rec.set('reflexesOD', t.reflexesOD)
        rec.set('reflexesOE', t.reflexesOE)
        rec.set('conclusion', t.conclusion)
        rec.set('notes', t.notes || '')
        app.save(rec)
      })
    }

    // ============================================================
    // 7. BERA (~1)
    // ============================================================
    const beraCol = app.findCollectionByNameOrId('beras')
    if (app.countRecords('beras') === 0) {
      const beraSeed = [
        {
          name: 'Sônia Maria dos Anjos',
          date: relDate(-4),
          prof: 'Dra. Mariana Silva Costa',
          od: {
            waveI: 1.62,
            waveIII: 3.75,
            waveV: 5.68,
            interI_III: 2.13,
            interIII_V: 1.93,
            interI_V: 4.06,
            threshold: 30,
          },
          oe: {
            waveI: 1.65,
            waveIII: 3.8,
            waveV: 5.72,
            interI_III: 2.15,
            interIII_V: 1.92,
            interI_V: 4.07,
            threshold: 30,
          },
          classification: 'Normal',
          notes:
            'Presença de ondas I, III e V bem definidas e reprodutíveis com latências absolutas e interpicos dentro da faixa de normalidade.',
        },
      ]
      beraSeed.forEach((b) => {
        const rec = new Record(beraCol)
        rec.set('patientId', patientId(b.name))
        rec.set('patientName', b.name)
        rec.set('date', b.date)
        rec.set('professionalName', b.prof)
        rec.set('od', b.od)
        rec.set('oe', b.oe)
        rec.set('classification', b.classification)
        rec.set('notes', b.notes || '')
        app.save(rec)
      })
    }

    // ============================================================
    // 8. Hearing aids (3 - Phonak, Signia, Oticon)
    // ============================================================
    const aidsCol = app.findCollectionByNameOrId('hearing_aids')
    if (app.countRecords('hearing_aids') === 0) {
      const aidSeed = [
        {
          brand: 'Phonak',
          model: 'Audéo Lumity L90-R',
          type: 'RIC',
          side: 'Bilateral',
          serialNumber: 'PH-2024-88491A/B',
          patient: 'José Roberto de Oliveira',
          saleDate: '2024-03-15',
          saleValue: 16500,
          paymentMethod: 'Parcelado',
          warrantyMonths: 24,
          warrantyEndDate: '2026-03-15',
          powerSource: 'Recarregável',
          earMold: true,
          earMoldType: 'Molde Silicone CShell',
          notes: 'Garantia total de 24 meses do fabricante + 1 ano de acompanhamento gratuito.',
          status: 'Em uso',
        },
        {
          brand: 'Signia',
          model: 'Pure Charge&Go 7AX',
          type: 'RIC',
          side: 'Direito',
          serialNumber: 'SG-2023-11942D',
          patient: 'Waldemar Ferreira de Souza',
          saleDate: '2023-03-01',
          saleValue: 8200,
          paymentMethod: 'Cartão',
          warrantyMonths: 24,
          warrantyEndDate: relDate(14),
          powerSource: 'Recarregável',
          earMold: false,
          notes: 'Aparelho próximo ao vencimento da garantia contratual.',
          status: 'Em uso',
        },
        {
          brand: 'Oticon',
          model: 'Real 1 miniRITE R',
          type: 'RIC',
          side: 'Esquerdo',
          serialNumber: 'OT-2024-44129E',
          patient: 'Antônio Carlos de Albuquerque',
          saleDate: '2024-02-10',
          saleValue: 7900,
          paymentMethod: 'Boleto',
          warrantyMonths: 24,
          warrantyEndDate: '2026-02-10',
          powerSource: 'Recarregável',
          earMold: true,
          earMoldType: 'MicroMold Acrílico',
          notes: 'Tecnologia BrainHearing com estabilizador de som súbito.',
          status: 'Em uso',
        },
      ]
      aidSeed.forEach((a) => {
        const rec = new Record(aidsCol)
        rec.set('patientId', a.patient ? patientId(a.patient) : '')
        rec.set('patientName', a.patient || '')
        rec.set('brand', a.brand)
        rec.set('model', a.model)
        rec.set('type', a.type)
        rec.set('side', a.side)
        rec.set('serialNumber', a.serialNumber)
        rec.set('saleDate', a.saleDate || '')
        rec.set('saleValue', a.saleValue || 0)
        rec.set('paymentMethod', a.paymentMethod || '')
        rec.set('warrantyMonths', a.warrantyMonths || 0)
        rec.set('warrantyEndDate', a.warrantyEndDate || '')
        rec.set('powerSource', a.powerSource || 'Pilha')
        rec.set('earMold', !!a.earMold)
        rec.set('earMoldType', a.earMoldType || '')
        rec.set('notes', a.notes || '')
        rec.set('status', a.status || 'Em uso')
        app.save(rec)
      })
    }

    // Helper to find a hearing aid by serial
    const findAidBySerial = (serial) => {
      try {
        return app.findFirstRecordByData('hearing_aids', 'serialNumber', serial)
      } catch (_) {
        return null
      }
    }

    // Maintenance + adjustment for aid 1
    const maintCol = app.findCollectionByNameOrId('maintenances')
    const adjCol = app.findCollectionByNameOrId('adjustments')
    if (app.countRecords('maintenances') === 0) {
      const aid1 = findAidBySerial('PH-2024-88491A/B')
      if (aid1) {
        const m = new Record(maintCol)
        m.set('hearingAidId', aid1.id)
        m.set('hearingAidLabel', 'Phonak Audéo Lumity L90-R')
        m.set('date', '2024-09-20')
        m.set('description', 'Troca de receptores e limpeza por ultrassom.')
        m.set('responsible', 'Dr. Lucas Ferreira Santos')
        app.save(m)

        const a = new Record(adjCol)
        a.set('hearingAidId', aid1.id)
        a.set('hearingAidLabel', 'Phonak Audéo Lumity L90-R')
        a.set('date', '2024-04-10')
        a.set(
          'description',
          'Aumento de 2dB em agudos no canal direito após período de aclimatação.',
        )
        a.set('professionalName', 'Dra. Mariana Silva Costa')
        app.save(a)
      }
    }

    // ============================================================
    // 9. Sales + installments (~4 vendas com parcelas)
    // ============================================================
    const salesCol = app.findCollectionByNameOrId('sales')
    const instCol = app.findCollectionByNameOrId('installments')
    if (app.countRecords('sales') === 0) {
      const saleSeed = [
        {
          number: 501,
          patient: 'José Roberto de Oliveira',
          date: '2024-03-15',
          itemsDescription: 'Par de Phonak Lumity L90 + Moldes Acrílicos',
          totalValue: 16500,
          paymentMethod: 'Parcelado',
          installmentsCount: 10,
          interestPercent: 0,
          firstDueDate: '2024-04-15',
          status: 'Concluída',
          paidCount: 3,
        },
        {
          number: 502,
          patient: 'Antônio Carlos de Albuquerque',
          date: '2024-11-20',
          itemsDescription: 'Aparelho Oticon Real 1 + MicroMold',
          totalValue: 7900,
          paymentMethod: 'Parcelado',
          installmentsCount: 5,
          interestPercent: 0,
          firstDueDate: '2024-12-20',
          status: 'Concluída',
          paidCount: 1,
        },
        {
          number: 503,
          patient: 'Geraldo Magela Barbosa',
          date: relDate(-25),
          itemsDescription: 'Aparelho Starkey Evolv AI 2400',
          totalValue: 9500,
          paymentMethod: 'À vista',
          installmentsCount: 1,
          interestPercent: 0,
          firstDueDate: relDate(-25),
          status: 'Concluída',
          paidCount: 1,
        },
        {
          number: 504,
          patient: 'Waldemar Ferreira de Souza',
          date: relDate(-10),
          itemsDescription: 'Signia Pure Charge&Go 7AX (unilateral)',
          totalValue: 8200,
          paymentMethod: 'Cartão',
          installmentsCount: 4,
          interestPercent: 0,
          firstDueDate: relDate(-10),
          status: 'Concluída',
          paidCount: 0,
        },
      ]

      saleSeed.forEach((s) => {
        const rec = new Record(salesCol)
        rec.set('patientId', patientId(s.patient))
        rec.set('patientName', s.patient)
        rec.set('number', s.number)
        rec.set('date', s.date)
        rec.set('itemsDescription', s.itemsDescription)
        rec.set('totalValue', s.totalValue)
        rec.set('paymentMethod', s.paymentMethod)
        rec.set('installmentsCount', s.installmentsCount)
        rec.set('interestPercent', s.interestPercent)
        rec.set('firstDueDate', s.firstDueDate || '')
        rec.set('status', s.status)
        app.save(rec)
        const saleId = rec.id
        const installmentValue = s.totalValue / s.installmentsCount
        const baseDue = new Date(s.firstDueDate || s.date)
        for (let i = 1; i <= s.installmentsCount; i++) {
          const d = new Date(baseDue)
          d.setMonth(d.getMonth() + (i - 1))
          const dueStr = d.toISOString().split('T')[0]
          const isPaid = i <= s.paidCount
          const inst = new Record(instCol)
          inst.set('saleId', saleId)
          inst.set('patientId', patientId(s.patient))
          inst.set('patientName', s.patient)
          inst.set('saleNumber', s.number)
          inst.set('installmentNumber', i)
          inst.set('totalInstallments', s.installmentsCount)
          inst.set('dueDate', dueStr)
          inst.set('value', installmentValue)
          inst.set('status', isPaid ? 'Pago' : dueStr < relDate(0) ? 'Atrasado' : 'Pendente')
          inst.set('paidDate', isPaid ? dueStr : '')
          app.save(inst)
        }
      })
    }

    // ============================================================
    // 10. Commissions
    // ============================================================
    const comCol = app.findCollectionByNameOrId('commissions')
    if (app.countRecords('commissions') === 0) {
      const comSeed = [
        {
          professionalName: 'Dra. Mariana Silva Costa',
          period: '01/2025',
          salesCount: 4,
          totalSalesValue: 34500,
          commissionPercent: 8,
          commissionValue: 2760,
        },
        {
          professionalName: 'Dr. Lucas Ferreira Santos',
          period: '01/2025',
          salesCount: 3,
          totalSalesValue: 26000,
          commissionPercent: 8,
          commissionValue: 2080,
        },
        {
          professionalName: 'Dra. Mariana Silva Costa',
          period: '02/2025',
          salesCount: 2,
          totalSalesValue: 18240,
          commissionPercent: 8,
          commissionValue: 1459.2,
        },
      ]
      comSeed.forEach((c) => {
        const rec = new Record(comCol)
        rec.set('professionalName', c.professionalName)
        rec.set('period', c.period)
        rec.set('salesCount', c.salesCount)
        rec.set('totalSalesValue', c.totalSalesValue)
        rec.set('commissionPercent', c.commissionPercent)
        rec.set('commissionValue', c.commissionValue)
        app.save(rec)
      })
    }

    // ============================================================
    // 11. Cash flow movements
    // ============================================================
    const cashCol = app.findCollectionByNameOrId('cash_flow')
    if (app.countRecords('cash_flow') === 0) {
      const cashSeed = [
        {
          date: relDate(0),
          description: 'Recebimento de Consulta Avaliação Auditiva - Particular',
          type: 'Entrada',
          category: 'Consulta',
          value: 250,
          responsible: 'Dra. Mariana Silva Costa',
        },
        {
          date: relDate(0),
          description: 'Venda de 3 cartelas de pilha Rayovac 312',
          type: 'Entrada',
          category: 'Venda de aparelho',
          value: 96,
          responsible: 'Recepção / Ana',
        },
        {
          date: relDate(0),
          description: 'Compra de material de escritório e descartáveis para clínica',
          type: 'Saída',
          category: 'Despesa operacional',
          value: 145.8,
          responsible: 'Recepção / Ana',
        },
        {
          date: relDate(-1),
          description: 'Recebimento de Parcela Venda #501 via PIX',
          type: 'Entrada',
          category: 'Pagamento de parcela',
          value: 1650,
          responsible: 'Dra. Mariana Silva Costa',
        },
        {
          date: relDate(-1),
          description: 'Pagamento de fornecedor de pilhas e olivas (Rayovac)',
          type: 'Saída',
          category: 'Fornecedores',
          value: 720,
          responsible: 'Dra. Mariana Silva Costa',
        },
      ]
      cashSeed.forEach((c) => {
        const rec = new Record(cashCol)
        rec.set('date', c.date)
        rec.set('description', c.description)
        rec.set('type', c.type)
        rec.set('category', c.category)
        rec.set('value', c.value)
        rec.set('responsible', c.responsible)
        app.save(rec)
      })
    }

    // ============================================================
    // 12. Inventory (~10 items) + movements (~8)
    // ============================================================
    const invCol = app.findCollectionByNameOrId('inventory')
    const movCol = app.findCollectionByNameOrId('inventory_movements')

    const invSeed = [
      {
        name: 'Pilha Auditiva Rayovac Extra Tamanho 312',
        brand: 'Rayovac',
        category: 'Pilhas',
        batterySize: '312',
        minQuantity: 40,
        currentQuantity: 18,
        supplier: 'Rayovac Brasil Distribuidora',
        costPrice: 14.5,
        salePrice: 32.0,
        notes: 'Cartela com 6 unidades seladas. Alta rotação no balcão.',
      },
      {
        name: 'Pilha Auditiva Rayovac Extra Tamanho 13',
        brand: 'Rayovac',
        category: 'Pilhas',
        batterySize: '13',
        minQuantity: 30,
        currentQuantity: 45,
        supplier: 'Rayovac Brasil Distribuidora',
        costPrice: 14.5,
        salePrice: 32.0,
      },
      {
        name: 'Pilha Auditiva Rayovac Extra Tamanho 10',
        brand: 'Rayovac',
        category: 'Pilhas',
        batterySize: '10',
        minQuantity: 25,
        currentQuantity: 12,
        supplier: 'Rayovac Brasil Distribuidora',
        costPrice: 15.0,
        salePrice: 34.0,
      },
      {
        name: 'Pilha Auditiva Rayovac Extra Tamanho 675',
        brand: 'Rayovac',
        category: 'Pilhas',
        batterySize: '675',
        minQuantity: 20,
        currentQuantity: 28,
        supplier: 'Rayovac Brasil Distribuidora',
        costPrice: 16.0,
        salePrice: 36.0,
      },
      {
        name: 'Filtro CerumenStop Phonak (CeruShield Disk)',
        brand: 'Phonak',
        category: 'Acessórios',
        accessorySubcategory: 'Cerúmen',
        minQuantity: 15,
        currentQuantity: 8,
        supplier: 'Sonova do Brasil',
        costPrice: 42.0,
        salePrice: 85.0,
        notes: 'Disco com 8 filtros de cera para receptores SDS 4.0.',
      },
      {
        name: 'Carregador Phonak Charger Ease',
        brand: 'Phonak',
        category: 'Acessórios',
        accessorySubcategory: 'Carregadores',
        minQuantity: 3,
        currentQuantity: 4,
        supplier: 'Sonova do Brasil',
        costPrice: 480.0,
        salePrice: 950.0,
      },
      {
        name: 'Oliva Dome Aberta Phonak 4.0 Média',
        brand: 'Phonak',
        category: 'Moldes',
        minQuantity: 20,
        currentQuantity: 35,
        supplier: 'Sonova do Brasil',
        costPrice: 8.0,
        salePrice: 25.0,
      },
      {
        name: 'Aparelho Phonak Audéo Lumity L70-R',
        brand: 'Phonak',
        model: 'Lumity L70-R',
        color: 'Prata Champanhe',
        category: 'Aparelhos auditivos',
        minQuantity: 2,
        currentQuantity: 3,
        supplier: 'Sonova do Brasil',
        costPrice: 4500.0,
        salePrice: 8900.0,
      },
      {
        name: 'Aparelho Signia Styletto 5AX',
        brand: 'Signia',
        model: 'Styletto 5AX',
        color: 'Preto & Grafite',
        category: 'Aparelhos auditivos',
        minQuantity: 2,
        currentQuantity: 1,
        supplier: 'WS Audiology Brasil',
        costPrice: 4800.0,
        salePrice: 9200.0,
      },
      {
        name: 'Molde Silicona Personalizado Duplo',
        brand: 'Genérico',
        category: 'Moldes',
        minQuantity: 10,
        currentQuantity: 15,
        supplier: 'Moldex Brasil',
        costPrice: 45.0,
        salePrice: 120.0,
      },
    ]

    invSeed.forEach((it) => {
      if (findStockByName(it.name)) return
      const rec = new Record(invCol)
      rec.set('name', it.name)
      rec.set('brand', it.brand || '')
      rec.set('model', it.model || '')
      rec.set('color', it.color || '')
      rec.set('category', it.category || '')
      rec.set('batterySize', it.batterySize || '')
      rec.set('accessorySubcategory', it.accessorySubcategory || '')
      rec.set('minQuantity', it.minQuantity || 0)
      rec.set('currentQuantity', it.currentQuantity || 0)
      rec.set('supplier', it.supplier || '')
      rec.set('costPrice', it.costPrice || 0)
      rec.set('salePrice', it.salePrice || 0)
      rec.set('notes', it.notes || '')
      app.save(rec)
    })

    if (app.countRecords('inventory_movements') === 0) {
      const findStockId = (name) => {
        const r = findStockByName(name)
        return r ? r.id : ''
      }
      const movSeed = [
        {
          item: 'Pilha Auditiva Rayovac Extra Tamanho 312',
          date: relDate(-30),
          type: 'Entrada',
          quantity: 50,
          responsible: 'Dra. Mariana Silva Costa',
          reason: 'Compra de reposição',
          supplier: 'Rayovac Brasil',
        },
        {
          item: 'Pilha Auditiva Rayovac Extra Tamanho 312',
          date: relDate(-9),
          type: 'Saída',
          quantity: 32,
          responsible: 'Dr. Lucas Ferreira Santos',
          reason: 'Vendas em balcão para pacientes',
        },
        {
          item: 'Pilha Auditiva Rayovac Extra Tamanho 10',
          date: relDate(-25),
          type: 'Entrada',
          quantity: 30,
          responsible: 'Dra. Mariana Silva Costa',
          reason: 'Reposição de estoque',
          supplier: 'Rayovac Brasil',
        },
        {
          item: 'Pilha Auditiva Rayovac Extra Tamanho 10',
          date: relDate(-5),
          type: 'Saída',
          quantity: 18,
          responsible: 'Dr. Lucas Ferreira Santos',
          reason: 'Entrega a pacientes',
        },
        {
          item: 'Filtro CerumenStop Phonak (CeruShield Disk)',
          date: relDate(-20),
          type: 'Entrada',
          quantity: 20,
          responsible: 'Dra. Mariana Silva Costa',
          reason: 'Reposição',
          supplier: 'Sonova do Brasil',
        },
        {
          item: 'Filtro CerumenStop Phonak (CeruShield Disk)',
          date: relDate(-3),
          type: 'Saída',
          quantity: 12,
          responsible: 'Dr. Lucas Ferreira Santos',
          reason: 'Troca em manutenções',
        },
        {
          item: 'Aparelho Signia Styletto 5AX',
          date: relDate(-12),
          type: 'Entrada',
          quantity: 3,
          responsible: 'Dra. Mariana Silva Costa',
          reason: 'Compra de aparelhos',
          supplier: 'WS Audiology Brasil',
        },
        {
          item: 'Aparelho Signia Styletto 5AX',
          date: relDate(-7),
          type: 'Saída',
          quantity: 2,
          responsible: 'Dr. Lucas Ferreira Santos',
          reason: 'Venda bilateral para paciente',
          patientName: 'Tereza Cristina Neves',
        },
      ]
      movSeed.forEach((m) => {
        const rec = new Record(movCol)
        rec.set('itemId', findStockId(m.item))
        rec.set('item_name', m.item)
        rec.set('date', m.date)
        rec.set('type', m.type)
        rec.set('quantity', m.quantity)
        rec.set('responsible', m.responsible)
        rec.set('reason', m.reason || '')
        rec.set('supplier', m.supplier || '')
        rec.set('patientName', m.patientName || '')
        app.save(rec)
      })
    }
  },
  (app) => {
    // Best-effort downgrade: truncate seeded collections.
    const cols = [
      'inventory_movements',
      'inventory',
      'cash_flow',
      'commissions',
      'installments',
      'sales',
      'adjustments',
      'maintenances',
      'hearing_aids',
      'beras',
      'tympanometries',
      'audiometries',
      'evolutions',
      'clinical_records',
      'appointments',
      'patients',
    ]
    cols.forEach((n) => {
      try {
        const c = app.findCollectionByNameOrId(n)
        app.truncateCollection(c)
      } catch (_) {}
    })
  },
)
