import React, { createContext, useContext, useState, useEffect, useMemo } from 'react'
import {
  User,
  Patient,
  Appointment,
  HearingAid,
  StockItem,
  Budget,
  Sale,
  Installment,
  Commission,
  CashFlowMovement,
  AudiometryExam,
  TympanometryExam,
  BeraExam,
  ClinicalRecord,
  ClinicalEvolution,
  SystemAlert,
} from '@/types'
import {
  SEED_USERS,
  SEED_PATIENTS,
  SEED_APPOINTMENTS,
  SEED_HEARING_AIDS,
  SEED_STOCK_ITEMS,
  SEED_BUDGETS,
  SEED_SALES,
  SEED_INSTALLMENTS,
  SEED_COMMISSIONS,
  SEED_CASH_MOVEMENTS,
  SEED_CLINICAL_RECORDS,
  SEED_EVOLUTIONS,
  SEED_AUDIOMETRIES,
  SEED_TYMPANOMETRIES,
  SEED_BERAS,
} from '@/data/seed'
import { useToast } from '@/hooks/use-toast'

interface AppContextType {
  // Auth
  currentUser: User | null
  login: (email: string, password: string, rememberMe?: boolean) => boolean
  logout: () => void
  recoverPassword: (email: string) => boolean

  // Pacientes
  patients: Patient[]
  addPatient: (patient: Omit<Patient, 'id' | 'createdAt'>) => Patient
  updatePatient: (id: string, patient: Partial<Patient>) => void
  deletePatient: (id: string) => void
  getPatient: (id: string) => Patient | undefined

  // Agenda
  appointments: Appointment[]
  addAppointment: (app: Omit<Appointment, 'id' | 'createdAt'>) => {
    success: boolean
    message?: string
    appointment?: Appointment
  }
  updateAppointment: (
    id: string,
    app: Partial<Appointment>,
  ) => { success: boolean; message?: string }
  deleteAppointment: (id: string) => void

  // Prontuário & Evoluções
  clinicalRecords: Record<string, ClinicalRecord>
  updateClinicalRecord: (patientId: string, record: Partial<ClinicalRecord>) => void
  evolutions: ClinicalEvolution[]
  addEvolution: (evo: Omit<ClinicalEvolution, 'id' | 'createdAt'>) => ClinicalEvolution
  deleteEvolution: (id: string) => void

  // Exames
  audiometries: AudiometryExam[]
  addAudiometry: (exam: Omit<AudiometryExam, 'id'>) => AudiometryExam
  deleteAudiometry: (id: string) => void

  tympanometries: TympanometryExam[]
  addTympanometry: (exam: Omit<TympanometryExam, 'id'>) => TympanometryExam
  deleteTympanometry: (id: string) => void

  beras: BeraExam[]
  addBera: (exam: Omit<BeraExam, 'id'>) => BeraExam
  deleteBera: (id: string) => void

  // Aparelhos
  hearingAids: HearingAid[]
  addHearingAid: (aid: Omit<HearingAid, 'id' | 'createdAt'>) => HearingAid
  updateHearingAid: (id: string, aid: Partial<HearingAid>) => void
  deleteHearingAid: (id: string) => void
  addAidMaintenance: (aidId: string, description: string, responsible: string, date: string) => void
  addAidAdjustment: (
    aidId: string,
    description: string,
    professionalName: string,
    date: string,
  ) => void

  // Financeiro
  budgets: Budget[]
  addBudget: (budget: Omit<Budget, 'id' | 'createdAt' | 'number'>) => Budget
  updateBudget: (id: string, budget: Partial<Budget>) => void
  deleteBudget: (id: string) => void
  convertBudgetToSale: (
    budgetId: string,
    paymentMethod: any,
    installmentsCount?: number,
    firstDueDate?: string,
  ) => Sale

  sales: Sale[]
  addSale: (sale: Omit<Sale, 'id' | 'createdAt' | 'number'>) => Sale
  installments: Installment[]
  payInstallment: (installmentId: string, paidDate?: string) => void
  commissions: Commission[]
  addCommission: (comm: Omit<Commission, 'id'>) => void

  cashMovements: CashFlowMovement[]
  addCashMovement: (mov: Omit<CashFlowMovement, 'id' | 'createdAt'>) => CashFlowMovement

  // Estoque
  stockItems: StockItem[]
  addStockItem: (item: Omit<StockItem, 'id' | 'createdAt'>) => StockItem
  updateStockItem: (id: string, item: Partial<StockItem>) => void
  deleteStockItem: (id: string) => void
  addStockEntry: (
    itemId: string,
    quantity: number,
    supplier?: string,
    responsible?: string,
    date?: string,
  ) => void
  addStockExit: (
    itemId: string,
    quantity: number,
    reason: string,
    responsible?: string,
    patientName?: string,
    date?: string,
  ) => boolean

  // Alertas e Notificações
  alerts: SystemAlert[]
  unreadAlertsCount: number

  // Utilitário para resetar dados aos padrões de seed
  resetToSeedData: () => void
}

const AppContext = createContext<AppContextType | undefined>(undefined)

const STORAGE_KEYS = {
  USER: 'audicao360_user',
  PATIENTS: 'audicao360_patients',
  APPOINTMENTS: 'audicao360_appointments',
  HEARING_AIDS: 'audicao360_hearing_aids',
  STOCK: 'audicao360_stock',
  BUDGETS: 'audicao360_budgets',
  SALES: 'audicao360_sales',
  INSTALLMENTS: 'audicao360_installments',
  COMMISSIONS: 'audicao360_commissions',
  CASH: 'audicao360_cash',
  CLINICAL: 'audicao360_clinical',
  EVOLUTIONS: 'audicao360_evolutions',
  AUDIOMETRIES: 'audicao360_audiometries',
  TYMPANOMETRIES: 'audicao360_tympanometries',
  BERAS: 'audicao360_beras',
}

function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const data = localStorage.getItem(key)
    return data ? JSON.parse(data) : defaultValue
  } catch (err) {
    console.error(`Erro ao carregar chave ${key}:`, err)
    return defaultValue
  }
}

function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (err) {
    console.error(`Erro ao salvar chave ${key}:`, err)
  }
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { toast } = useToast()

  // Usuário logado
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    return loadFromStorage<User | null>(STORAGE_KEYS.USER, SEED_USERS[0])
  })

  // Entidades principais
  const [patients, setPatients] = useState<Patient[]>(() =>
    loadFromStorage<Patient[]>(STORAGE_KEYS.PATIENTS, SEED_PATIENTS),
  )

  const [appointments, setAppointments] = useState<Appointment[]>(() =>
    loadFromStorage<Appointment[]>(STORAGE_KEYS.APPOINTMENTS, SEED_APPOINTMENTS),
  )

  const [hearingAids, setHearingAids] = useState<HearingAid[]>(() =>
    loadFromStorage<HearingAid[]>(STORAGE_KEYS.HEARING_AIDS, SEED_HEARING_AIDS),
  )

  const [stockItems, setStockItems] = useState<StockItem[]>(() =>
    loadFromStorage<StockItem[]>(STORAGE_KEYS.STOCK, SEED_STOCK_ITEMS),
  )

  const [budgets, setBudgets] = useState<Budget[]>(() =>
    loadFromStorage<Budget[]>(STORAGE_KEYS.BUDGETS, SEED_BUDGETS),
  )

  const [sales, setSales] = useState<Sale[]>(() =>
    loadFromStorage<Sale[]>(STORAGE_KEYS.SALES, SEED_SALES),
  )

  const [installments, setInstallments] = useState<Installment[]>(() =>
    loadFromStorage<Installment[]>(STORAGE_KEYS.INSTALLMENTS, SEED_INSTALLMENTS),
  )

  const [commissions, setCommissions] = useState<Commission[]>(() =>
    loadFromStorage<Commission[]>(STORAGE_KEYS.COMMISSIONS, SEED_COMMISSIONS),
  )

  const [cashMovements, setCashMovements] = useState<CashFlowMovement[]>(() =>
    loadFromStorage<CashFlowMovement[]>(STORAGE_KEYS.CASH, SEED_CASH_MOVEMENTS),
  )

  const [clinicalRecords, setClinicalRecords] = useState<Record<string, ClinicalRecord>>(() =>
    loadFromStorage<Record<string, ClinicalRecord>>(STORAGE_KEYS.CLINICAL, SEED_CLINICAL_RECORDS),
  )

  const [evolutions, setEvolutions] = useState<ClinicalEvolution[]>(() =>
    loadFromStorage<ClinicalEvolution[]>(STORAGE_KEYS.EVOLUTIONS, SEED_EVOLUTIONS),
  )

  const [audiometries, setAudiometries] = useState<AudiometryExam[]>(() =>
    loadFromStorage<AudiometryExam[]>(STORAGE_KEYS.AUDIOMETRIES, SEED_AUDIOMETRIES),
  )

  const [tympanometries, setTympanometries] = useState<TympanometryExam[]>(() =>
    loadFromStorage<TympanometryExam[]>(STORAGE_KEYS.TYMPANOMETRIES, SEED_TYMPANOMETRIES),
  )

  const [beras, setBeras] = useState<BeraExam[]>(() =>
    loadFromStorage<BeraExam[]>(STORAGE_KEYS.BERAS, SEED_BERAS),
  )

  // Persistir sempre que houver alterações
  useEffect(() => saveToStorage(STORAGE_KEYS.USER, currentUser), [currentUser])
  useEffect(() => saveToStorage(STORAGE_KEYS.PATIENTS, patients), [patients])
  useEffect(() => saveToStorage(STORAGE_KEYS.APPOINTMENTS, appointments), [appointments])
  useEffect(() => saveToStorage(STORAGE_KEYS.HEARING_AIDS, hearingAids), [hearingAids])
  useEffect(() => saveToStorage(STORAGE_KEYS.STOCK, stockItems), [stockItems])
  useEffect(() => saveToStorage(STORAGE_KEYS.BUDGETS, budgets), [budgets])
  useEffect(() => saveToStorage(STORAGE_KEYS.SALES, sales), [sales])
  useEffect(() => saveToStorage(STORAGE_KEYS.INSTALLMENTS, installments), [installments])
  useEffect(() => saveToStorage(STORAGE_KEYS.COMMISSIONS, commissions), [commissions])
  useEffect(() => saveToStorage(STORAGE_KEYS.CASH, cashMovements), [cashMovements])
  useEffect(() => saveToStorage(STORAGE_KEYS.CLINICAL, clinicalRecords), [clinicalRecords])
  useEffect(() => saveToStorage(STORAGE_KEYS.EVOLUTIONS, evolutions), [evolutions])
  useEffect(() => saveToStorage(STORAGE_KEYS.AUDIOMETRIES, audiometries), [audiometries])
  useEffect(() => saveToStorage(STORAGE_KEYS.TYMPANOMETRIES, tympanometries), [tympanometries])
  useEffect(() => saveToStorage(STORAGE_KEYS.BERAS, beras), [beras])

  // --- Auth Handlers ---
  const login = (email: string, pass: string, _rememberMe = false): boolean => {
    const found = SEED_USERS.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
    if (found) {
      // Aceita as senhas do seed ou qualquer senha >= 4 dígitos para flexibilidade
      if (
        (found.role === 'admin' && (pass === 'admin123' || pass.length >= 4)) ||
        (found.role === 'profissional' && (pass === 'prof123' || pass.length >= 4))
      ) {
        setCurrentUser(found)
        toast({
          title: 'Acesso autorizado',
          description: `Bem-vindo(a) ao Audição360, ${found.name}!`,
        })
        return true
      }
    }
    // Fallback: se for e-mail válido qualquer com senha válida para teste
    if (email.includes('@') && pass.length >= 4) {
      const genericUser: User = {
        id: `user-${Date.now()}`,
        name: email.split('@')[0].replace('.', ' '),
        email: email.trim(),
        role: 'admin',
        crmCrfa: 'CRFa 2-99999',
      }
      setCurrentUser(genericUser)
      toast({
        title: 'Acesso autorizado',
        description: `Bem-vindo(a), ${genericUser.name}!`,
      })
      return true
    }
    return false
  }

  const logout = () => {
    setCurrentUser(null)
    toast({
      title: 'Sessão encerrada',
      description: 'Você saiu do sistema com segurança.',
    })
  }

  const recoverPassword = (email: string): boolean => {
    if (!email || !email.includes('@')) return false
    toast({
      title: 'Link de recuperação enviado',
      description: `Enviamos as instruções de recuperação para ${email}.`,
    })
    return true
  }

  // --- Pacientes Handlers ---
  const addPatient = (patientData: Omit<Patient, 'id' | 'createdAt'>): Patient => {
    const newId = `pat-${Date.now()}`
    const newPatient: Patient = {
      ...patientData,
      id: newId,
      createdAt: new Date().toISOString().split('T')[0],
      lastVisit: new Date().toISOString().split('T')[0],
    }
    setPatients((prev) => [newPatient, ...prev])
    toast({
      title: 'Paciente cadastrado',
      description: `${newPatient.name} foi adicionado(a) com sucesso.`,
    })
    return newPatient
  }

  const updatePatient = (id: string, patientData: Partial<Patient>) => {
    setPatients((prev) => prev.map((p) => (p.id === id ? { ...p, ...patientData } : p)))
    toast({
      title: 'Cadastro atualizado',
      description: 'Os dados do paciente foram salvos com sucesso.',
    })
  }

  const deletePatient = (id: string) => {
    const target = patients.find((p) => p.id === id)
    setPatients((prev) => prev.filter((p) => p.id !== id))
    toast({
      title: 'Paciente excluído',
      description: target ? `${target.name} foi removido(a) do sistema.` : 'Paciente excluído.',
      variant: 'destructive',
    })
  }

  const getPatient = (id: string) => patients.find((p) => p.id === id)

  // --- Agenda Handlers (Com regra de conflito de profissional) ---
  const addAppointment = (
    appData: Omit<Appointment, 'id' | 'createdAt'>,
  ): { success: boolean; message?: string; appointment?: Appointment } => {
    // Validação de conflito: mesmo profissional no mesmo dia e com horários coincidentes
    const conflict = appointments.find((existing) => {
      if (existing.status === 'Cancelado') return false
      if (existing.professionalName !== appData.professionalName) return false
      if (existing.date !== appData.date) return false

      // Comparar minutos
      const [exHour, exMin] = existing.time.split(':').map(Number)
      const [newHour, newMin] = appData.time.split(':').map(Number)
      const existingStart = exHour * 60 + exMin
      const existingEnd = existingStart + existing.duration
      const newStart = newHour * 60 + newMin
      const newEnd = newStart + appData.duration

      // Verifica sobreposição
      return newStart < existingEnd && newEnd > existingStart
    })

    if (conflict) {
      const msg = `Conflito de horário: ${appData.professionalName} já possui atendimento (${conflict.patientName}) às ${conflict.time}.`
      toast({
        title: 'Horário indisponível',
        description: msg,
        variant: 'destructive',
      })
      return { success: false, message: msg }
    }

    const newAppointment: Appointment = {
      ...appData,
      id: `app-${Date.now()}`,
      createdAt: new Date().toISOString().split('T')[0],
    }

    setAppointments((prev) => [...prev, newAppointment])
    toast({
      title: 'Agendamento confirmado',
      description: `Atendimento agendado para ${newAppointment.patientName} em ${newAppointment.date} às ${newAppointment.time}.`,
    })
    return { success: true, appointment: newAppointment }
  }

  const updateAppointment = (
    id: string,
    appData: Partial<Appointment>,
  ): { success: boolean; message?: string } => {
    const current = appointments.find((a) => a.id === id)
    if (!current) return { success: false, message: 'Agendamento não encontrado' }

    const targetProf = appData.professionalName || current.professionalName
    const targetDate = appData.date || current.date
    const targetTime = appData.time || current.time
    const targetDur = appData.duration || current.duration

    if (appData.status !== 'Cancelado') {
      const conflict = appointments.find((existing) => {
        if (existing.id === id || existing.status === 'Cancelado') return false
        if (existing.professionalName !== targetProf) return false
        if (existing.date !== targetDate) return false

        const [exHour, exMin] = existing.time.split(':').map(Number)
        const [newHour, newMin] = targetTime.split(':').map(Number)
        const existingStart = exHour * 60 + exMin
        const existingEnd = existingStart + existing.duration
        const newStart = newHour * 60 + newMin
        const newEnd = newStart + targetDur

        return newStart < existingEnd && newEnd > existingStart
      })

      if (conflict) {
        const msg = `Conflito de horário: ${targetProf} já possui agendamento (${conflict.patientName}) às ${conflict.time}.`
        toast({
          title: 'Horário indisponível',
          description: msg,
          variant: 'destructive',
        })
        return { success: false, message: msg }
      }
    }

    setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, ...appData } : a)))
    toast({
      title: 'Agendamento atualizado',
      description: 'As alterações foram salvas com sucesso.',
    })
    return { success: true }
  }

  const deleteAppointment = (id: string) => {
    setAppointments((prev) => prev.filter((a) => a.id !== id))
    toast({
      title: 'Agendamento cancelado',
      description: 'O agendamento foi removido da grade.',
      variant: 'destructive',
    })
  }

  // --- Prontuário & Evoluções Handlers ---
  const updateClinicalRecord = (patientId: string, record: Partial<ClinicalRecord>) => {
    setClinicalRecords((prev) => {
      const current = prev[patientId] || {
        patientId,
        mainComplaint: '',
        anamnesis: '',
        hearingHistory: '',
        currentMedications: '',
        familyHistory: '',
        diagnosis: '',
        conduct: '',
        updatedAt: '',
      }
      return {
        ...prev,
        [patientId]: {
          ...current,
          ...record,
          updatedAt: new Date().toISOString().split('T')[0],
        },
      }
    })
    toast({
      title: 'Prontuário salvo',
      description: 'Dados clínicos atualizados com sucesso.',
    })
  }

  const addEvolution = (
    evoData: Omit<ClinicalEvolution, 'id' | 'createdAt'>,
  ): ClinicalEvolution => {
    const newEvo: ClinicalEvolution = {
      ...evoData,
      id: `evo-${Date.now()}`,
      createdAt: new Date().toISOString(),
    }
    setEvolutions((prev) => [newEvo, ...prev])
    toast({
      title: 'Evolução registrada',
      description: 'Nova entrada adicionada ao histórico clínico.',
    })
    return newEvo
  }

  const deleteEvolution = (id: string) => {
    setEvolutions((prev) => prev.filter((e) => e.id !== id))
    toast({
      title: 'Evolução removida',
      description: 'Registro excluído do prontuário.',
      variant: 'destructive',
    })
  }

  // --- Exames Handlers ---
  const addAudiometry = (exam: Omit<AudiometryExam, 'id'>): AudiometryExam => {
    const newExam: AudiometryExam = { ...exam, id: `audio-${Date.now()}` }
    setAudiometries((prev) => [newExam, ...prev])
    toast({
      title: 'Audiometria registrada',
      description: `Exame de audiometria de ${exam.patientName} salvo com sucesso.`,
    })
    return newExam
  }

  const deleteAudiometry = (id: string) => {
    setAudiometries((prev) => prev.filter((a) => a.id !== id))
    toast({
      title: 'Exame excluído',
      description: 'Audiometria removida com sucesso.',
      variant: 'destructive',
    })
  }

  const addTympanometry = (exam: Omit<TympanometryExam, 'id'>): TympanometryExam => {
    const newExam: TympanometryExam = { ...exam, id: `tymp-${Date.now()}` }
    setTympanometries((prev) => [newExam, ...prev])
    toast({
      title: 'Imitanciometria registrada',
      description: `Exame de imitanciometria de ${exam.patientName} salvo com sucesso.`,
    })
    return newExam
  }

  const deleteTympanometry = (id: string) => {
    setTympanometries((prev) => prev.filter((t) => t.id !== id))
    toast({
      title: 'Exame excluído',
      description: 'Imitanciometria removida com sucesso.',
      variant: 'destructive',
    })
  }

  const addBera = (exam: Omit<BeraExam, 'id'>): BeraExam => {
    const newExam: BeraExam = { ...exam, id: `bera-${Date.now()}` }
    setBeras((prev) => [newExam, ...prev])
    toast({
      title: 'BERA registrado',
      description: `Potencial evocado de ${exam.patientName} salvo com sucesso.`,
    })
    return newExam
  }

  const deleteBera = (id: string) => {
    setBeras((prev) => prev.filter((b) => b.id !== id))
    toast({
      title: 'Exame excluído',
      description: 'Registro de BERA removido.',
      variant: 'destructive',
    })
  }

  // --- Aparelhos Handlers ---
  const addHearingAid = (aidData: Omit<HearingAid, 'id' | 'createdAt'>): HearingAid => {
    const newAid: HearingAid = {
      ...aidData,
      id: `aid-${Date.now()}`,
      createdAt: new Date().toISOString().split('T')[0],
      maintenances: [],
      adjustments: [],
    }
    setHearingAids((prev) => [newAid, ...prev])
    toast({
      title: 'Aparelho cadastrado',
      description: `${newAid.brand} ${newAid.model} adicionado com sucesso.`,
    })
    return newAid
  }

  const updateHearingAid = (id: string, aidData: Partial<HearingAid>) => {
    setHearingAids((prev) => prev.map((a) => (a.id === id ? { ...a, ...aidData } : a)))
    toast({
      title: 'Aparelho atualizado',
      description: 'Informações do aparelho auditivo salvas.',
    })
  }

  const deleteHearingAid = (id: string) => {
    setHearingAids((prev) => prev.filter((a) => a.id !== id))
    toast({
      title: 'Aparelho excluído',
      description: 'Registro de aparelho auditivo removido.',
      variant: 'destructive',
    })
  }

  const addAidMaintenance = (
    aidId: string,
    description: string,
    responsible: string,
    date: string,
  ) => {
    setHearingAids((prev) =>
      prev.map((a) => {
        if (a.id !== aidId) return a
        const newMaint = {
          id: `maint-${Date.now()}`,
          hearingAidId: aidId,
          date,
          description,
          responsible,
          createdAt: new Date().toISOString(),
        }
        return {
          ...a,
          maintenances: [newMaint, ...(a.maintenances || [])],
        }
      }),
    )
    toast({
      title: 'Manutenção registrada',
      description: 'Histórico de manutenção atualizado.',
    })
  }

  const addAidAdjustment = (
    aidId: string,
    description: string,
    professionalName: string,
    date: string,
  ) => {
    setHearingAids((prev) =>
      prev.map((a) => {
        if (a.id !== aidId) return a
        const newAdj = {
          id: `adj-${Date.now()}`,
          hearingAidId: aidId,
          date,
          description,
          professionalName,
          createdAt: new Date().toISOString(),
        }
        return {
          ...a,
          adjustments: [newAdj, ...(a.adjustments || [])],
        }
      }),
    )
    toast({
      title: 'Ajuste registrado',
      description: 'Histórico de ajuste fino do aparelho atualizado.',
    })
  }

  // --- Financeiro Handlers ---
  const addBudget = (budgetData: Omit<Budget, 'id' | 'createdAt' | 'number'>): Budget => {
    const nextNum = budgets.length > 0 ? Math.max(...budgets.map((b) => b.number)) + 1 : 1001
    const newBudget: Budget = {
      ...budgetData,
      id: `bud-${Date.now()}`,
      number: nextNum,
      createdAt: new Date().toISOString().split('T')[0],
    }
    setBudgets((prev) => [newBudget, ...prev])
    toast({
      title: 'Orçamento gerado',
      description: `Orçamento #${newBudget.number} criado com sucesso.`,
    })
    return newBudget
  }

  const updateBudget = (id: string, budgetData: Partial<Budget>) => {
    setBudgets((prev) => prev.map((b) => (b.id === id ? { ...b, ...budgetData } : b)))
    toast({
      title: 'Orçamento atualizado',
      description: 'As alterações foram salvas.',
    })
  }

  const deleteBudget = (id: string) => {
    setBudgets((prev) => prev.filter((b) => b.id !== id))
    toast({
      title: 'Orçamento excluído',
      description: 'Orçamento removido com sucesso.',
      variant: 'destructive',
    })
  }

  const addSale = (saleData: Omit<Sale, 'id' | 'createdAt' | 'number'>): Sale => {
    const nextNum = sales.length > 0 ? Math.max(...sales.map((s) => Number(s.number))) + 1 : 501
    const newSale: Sale = {
      ...saleData,
      id: `sale-${Date.now()}`,
      number: nextNum,
      createdAt: new Date().toISOString().split('T')[0],
    }

    setSales((prev) => [newSale, ...prev])

    // Gerar parcelas automaticamente se for parcelado ou boleto/cartão com parcelas > 1
    const totalInstallments = newSale.installmentsCount || 1
    const totalWithInterest = newSale.totalValue * (1 + (newSale.interestPercent || 0) / 100)
    const installmentValue = totalWithInterest / totalInstallments

    const baseDueDate = newSale.firstDueDate ? new Date(newSale.firstDueDate) : new Date()

    const newInstallmentsList: Installment[] = []
    for (let i = 1; i <= totalInstallments; i++) {
      const d = new Date(baseDueDate)
      d.setMonth(d.getMonth() + (i - 1))
      const dueStr = d.toISOString().split('T')[0]

      const isFirstPaid = newSale.paymentMethod === 'À vista'

      newInstallmentsList.push({
        id: `inst-${Date.now()}-${i}`,
        saleId: newSale.id,
        saleNumber: newSale.number,
        installmentNumber: i,
        totalInstallments,
        patientId: newSale.patientId,
        patientName: newSale.patientName,
        dueDate: dueStr,
        value: installmentValue,
        status: isFirstPaid ? 'Pago' : 'Pendente',
        paidDate: isFirstPaid ? newSale.date : undefined,
      })
    }

    setInstallments((prev) => [...newInstallmentsList, ...prev])

    // Movimentação no Caixa Diário se foi à vista
    if (newSale.paymentMethod === 'À vista') {
      addCashMovement({
        date: newSale.date,
        description: `Venda #${newSale.number} à vista - ${newSale.patientName}`,
        type: 'Entrada',
        category: 'Venda de aparelho',
        value: newSale.totalValue,
        responsible: currentUser?.name || 'Recepção',
      })
    }

    toast({
      title: 'Venda registrada com sucesso!',
      description: `Venda #${newSale.number} gerou ${totalInstallments} parcela(s).`,
    })

    return newSale
  }

  const convertBudgetToSale = (
    budgetId: string,
    paymentMethod: any,
    installmentsCount = 1,
    firstDueDate?: string,
  ): Sale => {
    const b = budgets.find((item) => item.id === budgetId)
    if (!b) throw new Error('Orçamento não encontrado')

    const itemsSummary = b.items.map((it) => `${it.quantity}x ${it.description}`).join(', ')

    const newSale = addSale({
      patientId: b.patientId,
      patientName: b.patientName,
      date: new Date().toISOString().split('T')[0],
      itemsDescription: itemsSummary,
      totalValue: b.totalValue,
      paymentMethod,
      installmentsCount,
      interestPercent: 0,
      firstDueDate: firstDueDate || new Date().toISOString().split('T')[0],
      status: 'Concluída',
    })

    // Atualizar orçamento para 'Convertido'
    updateBudget(budgetId, { status: 'Convertido' })

    toast({
      title: 'Orçamento convertido em Venda!',
      description: `Orçamento #${b.number} transformado na Venda #${newSale.number}.`,
    })

    return newSale
  }

  const payInstallment = (installmentId: string, paidDate?: string) => {
    const paymentDateStr = paidDate || new Date().toISOString().split('T')[0]
    let paidVal = 0
    let patName = ''
    let sNum = 0
    let iNum = 0

    setInstallments((prev) =>
      prev.map((inst) => {
        if (inst.id !== installmentId) return inst
        paidVal = inst.value
        patName = inst.patientName
        sNum = inst.saleNumber
        iNum = inst.installmentNumber
        return {
          ...inst,
          status: 'Pago',
          paidDate: paymentDateStr,
        }
      }),
    )

    // Registra entrada no Caixa Diário
    if (paidVal > 0) {
      addCashMovement({
        date: paymentDateStr,
        description: `Pagamento Parcela ${iNum} Venda #${sNum} - ${patName}`,
        type: 'Entrada',
        category: 'Pagamento de parcela',
        value: paidVal,
        responsible: currentUser?.name || 'Recepção',
      })
    }

    toast({
      title: 'Pagamento registrado',
      description: `Parcela quitada com sucesso em ${paymentDateStr}.`,
    })
  }

  const addCommission = (commData: Omit<Commission, 'id'>) => {
    const newComm: Commission = { ...commData, id: `com-${Date.now()}` }
    setCommissions((prev) => [newComm, ...prev])
    toast({
      title: 'Comissão registrada',
      description: `Comissão de ${commData.professionalName} cadastrada para ${commData.period}.`,
    })
  }

  const addCashMovement = (
    movData: Omit<CashFlowMovement, 'id' | 'createdAt'>,
  ): CashFlowMovement => {
    const newMov: CashFlowMovement = {
      ...movData,
      id: `cash-${Date.now()}`,
      createdAt: new Date().toISOString(),
    }
    setCashMovements((prev) => [newMov, ...prev])
    return newMov
  }

  // --- Estoque Handlers ---
  const addStockItem = (itemData: Omit<StockItem, 'id' | 'createdAt'>): StockItem => {
    const newItem: StockItem = {
      ...itemData,
      id: `stk-${Date.now()}`,
      createdAt: new Date().toISOString().split('T')[0],
      movements: [
        {
          id: `mov-${Date.now()}`,
          stockItemId: `stk-${Date.now()}`,
          date: new Date().toISOString().split('T')[0],
          type: 'Entrada',
          quantity: itemData.currentQuantity,
          responsible: currentUser?.name || 'Administrador',
          reason: 'Estoque inicial cadastrado',
          supplier: itemData.supplier,
          createdAt: new Date().toISOString(),
        },
      ],
    }
    setStockItems((prev) => [newItem, ...prev])
    toast({
      title: 'Item cadastrado no estoque',
      description: `${newItem.name} adicionado com sucesso.`,
    })
    return newItem
  }

  const updateStockItem = (id: string, itemData: Partial<StockItem>) => {
    setStockItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...itemData } : it)))
    toast({
      title: 'Item atualizado',
      description: 'Dados do item de estoque foram salvos.',
    })
  }

  const deleteStockItem = (id: string) => {
    setStockItems((prev) => prev.filter((it) => it.id !== id))
    toast({
      title: 'Item excluído',
      description: 'Item removido do controle de estoque.',
      variant: 'destructive',
    })
  }

  const addStockEntry = (
    itemId: string,
    quantity: number,
    supplier?: string,
    responsible?: string,
    date?: string,
  ) => {
    const movDate = date || new Date().toISOString().split('T')[0]
    setStockItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it
        const newMov = {
          id: `mov-${Date.now()}`,
          stockItemId: itemId,
          date: movDate,
          type: 'Entrada' as const,
          quantity,
          responsible: responsible || currentUser?.name || 'Almoxarifado',
          supplier: supplier || it.supplier,
          createdAt: new Date().toISOString(),
        }
        return {
          ...it,
          currentQuantity: it.currentQuantity + quantity,
          movements: [newMov, ...(it.movements || [])],
        }
      }),
    )
    toast({
      title: 'Entrada de estoque realizada',
      description: `+${quantity} unidades adicionadas ao saldo.`,
    })
  }

  const addStockExit = (
    itemId: string,
    quantity: number,
    reason: string,
    responsible?: string,
    patientName?: string,
    date?: string,
  ): boolean => {
    const target = stockItems.find((it) => it.id === itemId)
    if (!target) return false

    if (target.currentQuantity < quantity) {
      toast({
        title: 'Saldo insuficiente',
        description: `O estoque possui apenas ${target.currentQuantity} unidades disponíveis.`,
        variant: 'destructive',
      })
      return false
    }

    const movDate = date || new Date().toISOString().split('T')[0]
    setStockItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it
        const newMov = {
          id: `mov-${Date.now()}`,
          stockItemId: itemId,
          date: movDate,
          type: 'Saída' as const,
          quantity,
          reason,
          patientName,
          responsible: responsible || currentUser?.name || 'Atendimento',
          createdAt: new Date().toISOString(),
        }
        return {
          ...it,
          currentQuantity: it.currentQuantity - quantity,
          movements: [newMov, ...(it.movements || [])],
        }
      }),
    )
    toast({
      title: 'Saída de estoque registrada',
      description: `-${quantity} unidades baixadas do estoque.`,
    })
    return true
  }

  // --- Alertas Inteligentes do Sistema ---
  const alerts = useMemo<SystemAlert[]>(() => {
    const list: SystemAlert[] = []
    const today = new Date()

    // 1. Garantias vencendo em até 30 dias
    hearingAids.forEach((aid) => {
      if (aid.warrantyEndDate && aid.status === 'Em uso') {
        const end = new Date(aid.warrantyEndDate)
        const diffDays = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        if (diffDays >= 0 && diffDays <= 30) {
          list.push({
            id: `alert-war-${aid.id}`,
            type: 'warranty',
            severity: diffDays <= 10 ? 'danger' : 'warning',
            title: `Garantia de ${aid.brand} ${aid.model} vencendo`,
            description: `${aid.patientName || 'Paciente'} — garantia expira em ${diffDays} dia(s) (${aid.warrantyEndDate}).`,
            linkUrl: `/aparelhos`,
            targetId: aid.id,
            date: aid.warrantyEndDate,
          })
        }
      }
    })

    // 2. Follow-ups de adaptação (aparelhos vendidos há ~30 dias)
    patients
      .filter((p) => p.status === 'Em tratamento')
      .slice(0, 3)
      .forEach((pat) => {
        list.push({
          id: `alert-fol-${pat.id}`,
          type: 'followup',
          severity: 'info',
          title: `Follow-up de adaptação pendente`,
          description: `Paciente ${pat.name} está em período de adaptação (30 dias). Agendar retorno de avaliação.`,
          linkUrl: `/pacientes/${pat.id}/prontuario`,
          targetId: pat.id,
        })
      })

    // 3. Parcelas em atraso
    const todayStr = today.toISOString().split('T')[0]
    installments.forEach((inst) => {
      if (inst.status === 'Atrasado' || (inst.status === 'Pendente' && inst.dueDate < todayStr)) {
        list.push({
          id: `alert-inst-${inst.id}`,
          type: 'installment',
          severity: 'danger',
          title: `Parcela em atraso: ${inst.patientName}`,
          description: `Parcela ${inst.installmentNumber}/${inst.totalInstallments} de R$ ${inst.value.toFixed(2)} venceu em ${inst.dueDate}.`,
          linkUrl: `/financeiro`,
          targetId: inst.id,
          date: inst.dueDate,
        })
      }
    })

    // 4. Estoque abaixo do mínimo
    stockItems.forEach((stk) => {
      if (stk.currentQuantity < stk.minQuantity) {
        list.push({
          id: `alert-stk-${stk.id}`,
          type: 'stock',
          severity: stk.currentQuantity === 0 ? 'danger' : 'warning',
          title: `Estoque crítico: ${stk.name}`,
          description: `Saldo atual (${stk.currentQuantity} un) está abaixo do mínimo configurado (${stk.minQuantity} un).`,
          linkUrl: `/estoque`,
          targetId: stk.id,
        })
      }
    })

    return list
  }, [hearingAids, patients, installments, stockItems])

  const unreadAlertsCount = alerts.length

  const resetToSeedData = () => {
    localStorage.clear()
    setPatients(SEED_PATIENTS)
    setAppointments(SEED_APPOINTMENTS)
    setHearingAids(SEED_HEARING_AIDS)
    setStockItems(SEED_STOCK_ITEMS)
    setBudgets(SEED_BUDGETS)
    setSales(SEED_SALES)
    setInstallments(SEED_INSTALLMENTS)
    setCommissions(SEED_COMMISSIONS)
    setCashMovements(SEED_CASH_MOVEMENTS)
    setClinicalRecords(SEED_CLINICAL_RECORDS)
    setEvolutions(SEED_EVOLUTIONS)
    setAudiometries(SEED_AUDIOMETRIES)
    setTympanometries(SEED_TYMPANOMETRIES)
    setBeras(SEED_BERAS)
    toast({
      title: 'Dados restaurados',
      description: 'Todos os registros foram reiniciados com os dados de demonstração.',
    })
  }

  return (
    <AppContext.Provider
      value={{
        currentUser,
        login,
        logout,
        recoverPassword,
        patients,
        addPatient,
        updatePatient,
        deletePatient,
        getPatient,
        appointments,
        addAppointment,
        updateAppointment,
        deleteAppointment,
        clinicalRecords,
        updateClinicalRecord,
        evolutions,
        addEvolution,
        deleteEvolution,
        audiometries,
        addAudiometry,
        deleteAudiometry,
        tympanometries,
        addTympanometry,
        deleteTympanometry,
        beras,
        addBera,
        deleteBera,
        hearingAids,
        addHearingAid,
        updateHearingAid,
        deleteHearingAid,
        addAidMaintenance,
        addAidAdjustment,
        budgets,
        addBudget,
        updateBudget,
        deleteBudget,
        convertBudgetToSale,
        sales,
        addSale,
        installments,
        payInstallment,
        commissions,
        addCommission,
        cashMovements,
        addCashMovement,
        stockItems,
        addStockItem,
        updateStockItem,
        deleteStockItem,
        addStockEntry,
        addStockExit,
        alerts,
        unreadAlertsCount,
        resetToSeedData,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp(): AppContextType {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useApp deve ser utilizado dentro de um AppProvider')
  }
  return context
}
