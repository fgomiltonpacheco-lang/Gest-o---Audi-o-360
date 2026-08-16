import React, { useEffect, useState, useCallback } from 'react'
import { useApp } from '@/context/AppContext'
import { useToast } from '@/hooks/use-toast'
import pb from '@/lib/pocketbase/client'
import { ClientResponseError } from 'pocketbase'
import { extractFieldErrors } from '@/lib/pocketbase/errors'
import { formatDate } from '@/lib/formatters'
import { getYearHolidays } from '@/lib/holidays'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Settings,
  Clock,
  CalendarOff,
  Plus,
  Trash2,
  Save,
  Lock,
  Download,
  Building2,
  Stethoscope,
  Pencil,
  AlertTriangle,
  FileText,
  ShieldCheck,
} from 'lucide-react'
import type { Equipment, NfseB2BProvedor, NfseB2BAmbiente, PolicyTexts } from '@/types'
import { getEquipmentStatus } from '@/types'
import { ConfirmDialog } from '@/components/ConfirmDialog'

// ============================================================
// Tipos e constantes
// ============================================================

interface DayHours {
  open: boolean
  start: string
  end: string
}

interface OperatingHours {
  monday: DayHours
  tuesday: DayHours
  wednesday: DayHours
  thursday: DayHours
  friday: DayHours
  saturday: DayHours
  sunday: DayHours
}

interface ClinicConfigRecord {
  id: string
  operating_hours: OperatingHours
  slot_minutes: number
}

interface BlockedDayRecord {
  id: string
  date: string
  reason: string
  created_by: string
}

const DAY_KEYS: { key: keyof OperatingHours; label: string }[] = [
  { key: 'monday', label: 'Seg' },
  { key: 'tuesday', label: 'Ter' },
  { key: 'wednesday', label: 'Qua' },
  { key: 'thursday', label: 'Qui' },
  { key: 'friday', label: 'Sex' },
  { key: 'saturday', label: 'Sáb' },
  { key: 'sunday', label: 'Dom' },
]

const DEFAULT_HOURS: OperatingHours = {
  monday: { open: true, start: '07:00', end: '19:00' },
  tuesday: { open: true, start: '07:00', end: '19:00' },
  wednesday: { open: true, start: '07:00', end: '19:00' },
  thursday: { open: true, start: '07:00', end: '19:00' },
  friday: { open: true, start: '07:00', end: '19:00' },
  saturday: { open: true, start: '08:00', end: '12:00' },
  sunday: { open: false, start: '', end: '' },
}

// Lista de horários (00:00 a 23:30) para os selects.
const TIME_OPTIONS: string[] = (() => {
  const out: string[] = []
  for (let h = 0; h < 24; h++) {
    out.push(`${String(h).padStart(2, '0')}:00`)
    out.push(`${String(h).padStart(2, '0')}:30`)
  }
  return out
})()

function describeError(error: unknown): string {
  if (error instanceof ClientResponseError) {
    const fieldErrors = extractFieldErrors(error)
    const parts = Object.entries(fieldErrors).map(([field, msg]) => `${field}: ${msg}`)
    if (parts.length > 0) return parts.join(' • ')
    if (error.response?.message) return String(error.response.message)
  }
  return error instanceof Error ? error.message : 'Erro desconhecido.'
}

export default function Configuracoes() {
  const {
    currentUser,
    clinicSettings,
    saveClinicSettings,
    equipments,
    addEquipment,
    updateEquipment,
    deleteEquipment,
    nfseB2BConfig,
    fetchNfseB2BConfig,
    saveNfseB2BConfig,
    fetchLgpdPolicyTexts,
    saveLgpdPolicyTexts,
  } = useApp()
  const { toast } = useToast()

  // Horários de funcionamento
  const [configId, setConfigId] = useState<string>('')
  const [hours, setHours] = useState<OperatingHours>(DEFAULT_HOURS)
  const [slotMinutes, setSlotMinutes] = useState<number>(30)
  const [hoursLoading, setHoursLoading] = useState(true)
  const [hoursSaving, setHoursSaving] = useState(false)

  // Bloqueios
  const [blockedDays, setBlockedDays] = useState<BlockedDayRecord[]>([])
  const [blockedLoading, setBlockedLoading] = useState(true)
  const [blockOpen, setBlockOpen] = useState(false)
  const [blockDate, setBlockDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [blockReason, setBlockReason] = useState<string>('')

  // ---- Dados da clínica ----
  const [clinicNome, setClinicNome] = useState('')
  const [clinicEndereco, setClinicEndereco] = useState('')
  const [clinicTelefone, setClinicTelefone] = useState('')
  const [clinicEmail, setClinicEmail] = useState('')
  const [clinicSaving, setClinicSaving] = useState(false)

  // Sincroniza formulário de dados da clínica quando o singleton é carregado.
  useEffect(() => {
    if (clinicSettings) {
      setClinicNome(clinicSettings.nome || '')
      setClinicEndereco(clinicSettings.endereco || '')
      setClinicTelefone(clinicSettings.telefone || '')
      setClinicEmail(clinicSettings.email || '')
    }
  }, [clinicSettings])

  const handleSaveClinic = async () => {
    setClinicSaving(true)
    const res = await saveClinicSettings({
      nome: clinicNome,
      endereco: clinicEndereco,
      telefone: clinicTelefone,
      email: clinicEmail,
    })
    setClinicSaving(false)
    if (!res.success) {
      toast({
        title: 'Erro ao salvar',
        description: res.message || 'Não foi possível salvar os dados da clínica.',
        variant: 'destructive',
      })
    }
  }

  // ---- Equipamentos ----
  const [eqOpen, setEqOpen] = useState(false)
  const [eqEditing, setEqEditing] = useState<Equipment | null>(null)
  const [eqNome, setEqNome] = useState('')
  const [eqDataCalib, setEqDataCalib] = useState('')
  const [eqSaving, setEqSaving] = useState(false)
  const [eqDelete, setEqDelete] = useState<Equipment | null>(null)
  const [eqDeleting, setEqDeleting] = useState(false)

  const openNewEquipment = () => {
    setEqEditing(null)
    setEqNome('')
    setEqDataCalib(new Date().toISOString().split('T')[0])
    setEqOpen(true)
  }

  const openEditEquipment = (eq: Equipment) => {
    setEqEditing(eq)
    setEqNome(eq.nome)
    setEqDataCalib(eq.data_calibracao)
    setEqOpen(true)
  }

  const handleSaveEquipment = async () => {
    if (!eqNome.trim()) {
      toast({ title: 'Informe o nome do equipamento.', variant: 'destructive' })
      return
    }
    if (!eqDataCalib) {
      toast({ title: 'Informe a data da última calibração.', variant: 'destructive' })
      return
    }
    setEqSaving(true)
    const res = eqEditing
      ? await updateEquipment(eqEditing.id, { nome: eqNome, data_calibracao: eqDataCalib })
      : await addEquipment({ nome: eqNome, data_calibracao: eqDataCalib })
    setEqSaving(false)
    if (res.success) {
      setEqOpen(false)
    } else {
      toast({ title: 'Erro ao salvar', description: res.message, variant: 'destructive' })
    }
  }

  const handleDeleteEquipment = async () => {
    if (!eqDelete) return
    setEqDeleting(true)
    const res = await deleteEquipment(eqDelete.id)
    setEqDeleting(false)
    if (!res.success) {
      toast({ title: 'Erro ao excluir', description: res.message, variant: 'destructive' })
    }
  }

  // Computa próxima calibração (última + 1 ano) para preview no modal.
  const previewProxima = (() => {
    if (!eqDataCalib) return ''
    const d = new Date(eqDataCalib + 'T00:00:00')
    if (isNaN(d.getTime())) return ''
    d.setFullYear(d.getFullYear() + 1)
    return d.toISOString().split('T')[0]
  })()

  // ---- NFS-e de Comissão B2B ----
  const [nfseAliquota, setNfseAliquota] = useState<string>('3.00')
  const [nfseItemServico, setNfseItemServico] = useState<string>('10.01')
  const [nfseDiscriminacao, setNfseDiscriminacao] = useState<string>(
    'Intermediação comercial - Comissão sobre venda de aparelhos auditivos',
  )
  const [nfseInscMunicipal, setNfseInscMunicipal] = useState<string>('')
  const [nfseMunicipio, setNfseMunicipio] = useState<string>('Caçador')
  const [nfseUf, setNfseUf] = useState<string>('SC')
  const [nfseCodigoMunicipio, setNfseCodigoMunicipio] = useState<string>('4203006')
  const [nfseProvedor, setNfseProvedor] = useState<NfseB2BProvedor>('BETHA')
  const [nfseAmbiente, setNfseAmbiente] = useState<NfseB2BAmbiente>('homologacao')
  const [nfseUrlApi, setNfseUrlApi] = useState<string>('')
  const [nfseLogin, setNfseLogin] = useState<string>('')
  const [nfseToken, setNfseToken] = useState<string>('')
  const [nfseSaving, setNfseSaving] = useState(false)

  useEffect(() => {
    if (currentUser?.role === 'admin' && !nfseB2BConfig) {
      fetchNfseB2BConfig()
    }
  }, [currentUser?.role, nfseB2BConfig, fetchNfseB2BConfig])

  useEffect(() => {
    if (nfseB2BConfig) {
      setNfseAliquota(String(nfseB2BConfig.aliquota_iss_padrao ?? 3))
      setNfseItemServico(nfseB2BConfig.item_lista_servico || '10.01')
      setNfseDiscriminacao(
        nfseB2BConfig.discriminacao_padrao ||
          'Intermediação comercial - Comissão sobre venda de aparelhos auditivos',
      )
      setNfseInscMunicipal(nfseB2BConfig.inscricao_municipal || '')
      setNfseMunicipio(nfseB2BConfig.municipio || 'Caçador')
      setNfseUf(nfseB2BConfig.uf || 'SC')
      setNfseCodigoMunicipio(nfseB2BConfig.codigo_municipio || '4203006')
      setNfseProvedor(nfseB2BConfig.provedor || 'BETHA')
      setNfseAmbiente(nfseB2BConfig.ambiente || 'homologacao')
      setNfseUrlApi(nfseB2BConfig.url_api || '')
      setNfseLogin(nfseB2BConfig.login_api || '')
      setNfseToken(nfseB2BConfig.token_api || '')
    }
  }, [nfseB2BConfig])

  const handleSaveNfse = async () => {
    setNfseSaving(true)
    const aliquota = Number(String(nfseAliquota).replace(',', '.')) || 0
    const res = await saveNfseB2BConfig({
      aliquota_iss_padrao: aliquota,
      item_lista_servico: nfseItemServico.trim(),
      discriminacao_padrao: nfseDiscriminacao.trim(),
      inscricao_municipal: nfseInscMunicipal.trim(),
      municipio: nfseMunicipio.trim(),
      uf: nfseUf.trim().toUpperCase(),
      codigo_municipio: nfseCodigoMunicipio.trim(),
      provedor: nfseProvedor,
      ambiente: nfseAmbiente,
      url_api: nfseUrlApi.trim(),
      login_api: nfseLogin.trim(),
      token_api: nfseToken,
      ativo: true,
    })
    setNfseSaving(false)
    toast(
      res.success
        ? {
            title: 'Configuração NFS-e salva',
            description: 'Os parâmetros da NFS-e de comissão foram atualizados.',
          }
        : {
            title: 'Erro ao salvar',
            description: res.message || 'Não foi possível salvar a configuração NFS-e.',
            variant: 'destructive',
          },
    )
  }

  const loadConfig = useCallback(async () => {
    setHoursLoading(true)
    try {
      const records = await pb.collection('clinic_config').getFullList({ sort: '-created' })
      if (records.length > 0) {
        const r = records[0] as any
        setConfigId(r.id)
        const oh = r.operating_hours
        if (oh && typeof oh === 'object') {
          // Garante que todas as chaves existam com defaults.
          const merged: OperatingHours = { ...DEFAULT_HOURS }
          for (const dk of DAY_KEYS) {
            const v = (oh as any)[dk.key]
            if (v && typeof v === 'object') {
              merged[dk.key] = {
                open: !!v.open,
                start: v.start || '',
                end: v.end || '',
              }
            }
          }
          setHours(merged)
        }
        setSlotMinutes(Number(r.slot_minutes) || 30)
      }
    } catch (err) {
      console.error('Erro ao carregar configuração:', err)
      toast({
        title: 'Erro ao carregar',
        description: 'Não foi possível carregar a configuração da clínica.',
        variant: 'destructive',
      })
    } finally {
      setHoursLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadBlocked = useCallback(async () => {
    setBlockedLoading(true)
    try {
      const records = await pb.collection('blocked_days').getFullList({ sort: 'date' })
      const rows: BlockedDayRecord[] = records.map((r: any) => ({
        id: r.id,
        date: r.date || '',
        reason: r.reason || '',
        created_by: r.created_by || '',
      }))
      setBlockedDays(rows)
    } catch (err) {
      console.error('Erro ao carregar bloqueios:', err)
      toast({
        title: 'Erro ao carregar',
        description: 'Não foi possível carregar os dias bloqueados.',
        variant: 'destructive',
      })
    } finally {
      setBlockedLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (currentUser?.role === 'admin') {
      loadConfig()
      loadBlocked()
    }
  }, [currentUser?.id, currentUser?.role, loadConfig, loadBlocked])

  // ---------- LGPD: textos de política e termos ----------
  const [lgpdTexts, setLgpdTexts] = useState<PolicyTexts | null>(null)
  const [lgpdLoading, setLgpdLoading] = useState(false)
  const [lgpdSaving, setLgpdSaving] = useState(false)

  useEffect(() => {
    if (currentUser?.role !== 'admin') return
    setLgpdLoading(true)
    fetchLgpdPolicyTexts()
      .then((texts) => setLgpdTexts(texts))
      .catch((err) => {
        console.error('Erro ao carregar textos da LGPD:', err)
        toast({
          title: 'Erro ao carregar',
          description: 'Não foi possível carregar os textos da LGPD.',
          variant: 'destructive',
        })
      })
      .finally(() => setLgpdLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.role])

  const handleSaveLgpd = async () => {
    if (!lgpdTexts) return
    setLgpdSaving(true)
    const res = await saveLgpdPolicyTexts(lgpdTexts)
    setLgpdSaving(false)
    toast(
      res.success
        ? {
            title: 'Textos da LGPD salvos',
            description: 'A política de privacidade e os termos foram atualizados.',
          }
        : {
            title: 'Erro ao salvar',
            description: res.message || 'Não foi possível salvar os textos da LGPD.',
            variant: 'destructive',
          },
    )
  }

  // ---------- Salvar horários ----------
  const handleSaveHours = async () => {
    setHoursSaving(true)
    try {
      const payload = { operating_hours: hours, slot_minutes: slotMinutes }
      if (configId) {
        await pb.collection('clinic_config').update(configId, payload)
      } else {
        const rec: any = await pb.collection('clinic_config').create(payload)
        setConfigId(rec.id)
      }
      toast({
        title: 'Configuração salva',
        description: 'Os horários de funcionamento foram atualizados.',
      })
    } catch (err) {
      toast({
        title: 'Erro ao salvar',
        description: describeError(err),
        variant: 'destructive',
      })
    } finally {
      setHoursSaving(false)
    }
  }

  // ---------- Adicionar bloqueio ----------
  const handleAddBlock = async () => {
    if (!blockDate) {
      toast({ title: 'Informe a data', variant: 'destructive' })
      return
    }
    if (blockedDays.some((b) => b.date === blockDate)) {
      toast({
        title: 'Dia já bloqueado',
        description: 'Já existe um bloqueio para esta data.',
        variant: 'destructive',
      })
      return
    }
    try {
      const rec: any = await pb.collection('blocked_days').create({
        date: blockDate,
        reason: blockReason.trim(),
        created_by: currentUser?.name || '',
      })
      setBlockedDays((prev) =>
        [
          ...prev,
          {
            id: rec.id,
            date: blockDate,
            reason: blockReason.trim(),
            created_by: currentUser?.name || '',
          },
        ].sort((a, b) => (a.date < b.date ? -1 : 1)),
      )
      setBlockOpen(false)
      setBlockReason('')
      toast({ title: 'Dia bloqueado', description: `${formatDate(blockDate)} foi bloqueado.` })
    } catch (err) {
      toast({ title: 'Erro ao bloquear', description: describeError(err), variant: 'destructive' })
    }
  }

  // ---------- Remover bloqueio ----------
  const handleRemoveBlock = async (id: string) => {
    try {
      await pb.collection('blocked_days').delete(id)
      setBlockedDays((prev) => prev.filter((b) => b.id !== id))
      toast({ title: 'Bloqueio removido', description: 'O dia foi desbloqueado.' })
    } catch (err) {
      toast({ title: 'Erro ao remover', description: describeError(err), variant: 'destructive' })
    }
  }

  // ---------- Importar feriados nacionais do ano corrente ----------
  const handleImportHolidays = async () => {
    const year = new Date().getFullYear()
    const holidays = getYearHolidays(year)
    const existing = new Set(blockedDays.map((b) => b.date))
    const toCreate = holidays.filter((h) => !existing.has(h.date))
    if (toCreate.length === 0) {
      toast({
        title: 'Nada a importar',
        description: 'Todos os feriados nacionais do ano já estão bloqueados.',
      })
      return
    }
    let created = 0
    const newRows: BlockedDayRecord[] = []
    for (const h of toCreate) {
      try {
        const rec: any = await pb.collection('blocked_days').create({
          date: h.date,
          reason: `Feriado: ${h.name}`,
          created_by: currentUser?.name || '',
        })
        newRows.push({
          id: rec.id,
          date: h.date,
          reason: `Feriado: ${h.name}`,
          created_by: currentUser?.name || '',
        })
        created++
      } catch (err) {
        // ignora duplicatas de corrida
      }
    }
    setBlockedDays((prev) => [...prev, ...newRows].sort((a, b) => (a.date < b.date ? -1 : 1)))
    toast({
      title: 'Feriados importados',
      description: `${created} feriado(s) nacional(is) adicionado(s) como bloqueio.`,
    })
  }

  if (currentUser?.role !== 'admin') {
    return null
  }

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-navy-700 text-white flex items-center justify-center shadow-sm">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Configurações
            </h1>
            <p className="text-sm text-slate-500">
              Dados da clínica, equipamentos, horários e bloqueios da agenda
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="clinic" className="w-full">
        <TabsList className="bg-slate-100 rounded-xl p-1 h-auto flex flex-wrap">
          <TabsTrigger
            value="clinic"
            className="rounded-lg text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-teal-600 data-[state=active]:shadow-sm px-4 py-2"
          >
            <Building2 className="w-3.5 h-3.5 mr-1.5" />
            Dados da Clínica
          </TabsTrigger>
          <TabsTrigger
            value="equipments"
            className="rounded-lg text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-teal-600 data-[state=active]:shadow-sm px-4 py-2"
          >
            <Stethoscope className="w-3.5 h-3.5 mr-1.5" />
            Equipamentos
          </TabsTrigger>
          <TabsTrigger
            value="hours"
            className="rounded-lg text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-teal-600 data-[state=active]:shadow-sm px-4 py-2"
          >
            <Clock className="w-3.5 h-3.5 mr-1.5" />
            Horários de Funcionamento
          </TabsTrigger>
          <TabsTrigger
            value="blocks"
            className="rounded-lg text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-teal-600 data-[state=active]:shadow-sm px-4 py-2"
          >
            <CalendarOff className="w-3.5 h-3.5 mr-1.5" />
            Feriados e Bloqueios
          </TabsTrigger>
          <TabsTrigger
            value="nfse"
            className="rounded-lg text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-teal-600 data-[state=active]:shadow-sm px-4 py-2"
          >
            <FileText className="w-3.5 h-3.5 mr-1.5" />
            NFS-e
          </TabsTrigger>
          <TabsTrigger
            value="lgpd"
            className="rounded-lg text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-teal-600 data-[state=active]:shadow-sm px-4 py-2"
          >
            <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
            LGPD
          </TabsTrigger>
        </TabsList>

        {/* ============ ABA: DADOS DA CLÍNICA ============ */}
        <TabsContent value="clinic" className="mt-4">
          <Card className="rounded-2xl border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold text-slate-900">Dados da Clínica</CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Informações cadastrais usadas no cabeçalho dos laudos impressos (audiometria e
                futuros exames).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label className="text-xs font-semibold text-slate-700">
                    Nome da Clínica <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={clinicNome}
                    onChange={(e) => setClinicNome(e.target.value)}
                    placeholder="Ex.: Audição360"
                    className="h-10 rounded-xl mt-1 text-sm border-slate-300"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs font-semibold text-slate-700">Endereço completo</Label>
                  <Input
                    value={clinicEndereco}
                    onChange={(e) => setClinicEndereco(e.target.value)}
                    placeholder="Rua, número, bairro, cidade - UF, CEP"
                    className="h-10 rounded-xl mt-1 text-sm border-slate-300"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Telefone</Label>
                  <Input
                    value={clinicTelefone}
                    onChange={(e) => setClinicTelefone(e.target.value)}
                    placeholder="(00) 0000-0000"
                    className="h-10 rounded-xl mt-1 text-sm border-slate-300"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700">E-mail</Label>
                  <Input
                    type="email"
                    value={clinicEmail}
                    onChange={(e) => setClinicEmail(e.target.value)}
                    placeholder="contato@clinica.com.br"
                    className="h-10 rounded-xl mt-1 text-sm border-slate-300"
                  />
                </div>
              </div>
              <div className="flex justify-end pt-2 border-t border-slate-100">
                <Button
                  onClick={handleSaveClinic}
                  disabled={clinicSaving}
                  className="bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-xl shadow-sm flex items-center gap-2 h-10 px-5"
                >
                  <Save className="w-4 h-4" />
                  {clinicSaving ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ ABA: EQUIPAMENTOS ============ */}
        <TabsContent value="equipments" className="mt-4">
          <Card className="rounded-2xl border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-lg font-bold text-slate-900">Equipamentos</CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Cadastro de audiômetros e demais equipamentos com controle de calibração. A
                    próxima calibração é calculada automaticamente (última + 1 ano).
                  </CardDescription>
                </div>
                <Button
                  onClick={openNewEquipment}
                  className="bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-xl shadow-sm flex items-center gap-1.5 h-9"
                >
                  <Plus className="w-4 h-4" />
                  Novo Equipamento
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 hover:bg-slate-50">
                      <TableHead className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                        Nome
                      </TableHead>
                      <TableHead className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                        Data de Calibração
                      </TableHead>
                      <TableHead className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                        Status
                      </TableHead>
                      <TableHead className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                        Próxima Calibração
                      </TableHead>
                      <TableHead className="text-xs font-bold text-slate-600 uppercase tracking-wider text-right">
                        Ações
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {equipments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-sm text-slate-400 py-10">
                          Nenhum equipamento cadastrado. Clique em "Novo Equipamento".
                        </TableCell>
                      </TableRow>
                    ) : (
                      equipments.map((eq) => {
                        const status = getEquipmentStatus(eq.proxima_calibracao)
                        return (
                          <TableRow key={eq.id} className="group">
                            <TableCell className="text-sm font-semibold text-slate-800">
                              {eq.nome}
                            </TableCell>
                            <TableCell className="text-sm text-slate-600 font-mono">
                              {eq.data_calibracao ? formatDate(eq.data_calibracao) : '—'}
                            </TableCell>
                            <TableCell>
                              {status === 'expired' ? (
                                <Badge className="text-[11px] font-semibold bg-red-100 text-red-700 border-red-200 hover:bg-red-100">
                                  Vencido
                                </Badge>
                              ) : status === 'expiring' ? (
                                <Badge className="text-[11px] font-semibold bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">
                                  Vencendo
                                </Badge>
                              ) : (
                                <Badge className="text-[11px] font-semibold bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
                                  Válido
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-slate-600 font-mono">
                              {eq.proxima_calibracao ? formatDate(eq.proxima_calibracao) : '—'}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openEditEquipment(eq)}
                                  className="h-8 w-8 p-0 text-slate-500 hover:bg-slate-100 rounded-lg"
                                  title="Editar"
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEqDelete(eq)}
                                  className="h-8 w-8 p-0 text-red-500 hover:bg-red-50 rounded-lg"
                                  title="Excluir"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ ABA: HORÁRIOS ============ */}
        <TabsContent value="hours" className="mt-4">
          <Card className="rounded-2xl border-slate-200 shadow-sm">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-base font-bold text-slate-900">
                Horários de Funcionamento
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Defina os dias e horários em que a clínica atende. A agenda usa estes horários para
                gerar a grade de atendimentos.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-4">
              {hoursLoading ? (
                <p className="text-xs text-slate-400 py-4 text-center">Carregando...</p>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2">
                    {DAY_KEYS.map(({ key, label }) => {
                      const day = hours[key]
                      return (
                        <div
                          key={key}
                          className={`rounded-xl border p-2 space-y-1.5 transition-colors ${
                            day.open
                              ? 'border-teal-200 bg-teal-50/30'
                              : 'border-slate-200 bg-slate-50/60'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-bold text-slate-800">{label}</Label>
                            <div className="flex items-center gap-1.5">
                              <Checkbox
                                id={`day-check-${key}`}
                                checked={day.open}
                                onCheckedChange={(v) =>
                                  setHours((prev) => ({
                                    ...prev,
                                    [key]: { ...prev[key], open: !!v },
                                  }))
                                }
                                className="h-4 w-4"
                              />
                              <Label
                                htmlFor={`day-check-${key}`}
                                className="text-[11px] font-medium text-slate-600 cursor-pointer select-none"
                              >
                                {day.open ? 'Abre' : 'Fechado'}
                              </Label>
                            </div>
                          </div>
                          {day.open && (
                            <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                              <div>
                                <Label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                                  Início
                                </Label>
                                <Select
                                  value={day.start}
                                  onValueChange={(v) =>
                                    setHours((prev) => ({
                                      ...prev,
                                      [key]: { ...prev[key], start: v },
                                    }))
                                  }
                                >
                                  <SelectTrigger className="h-7 px-2 text-[11px] rounded-md border-slate-300 font-mono">
                                    <SelectValue placeholder="Início" />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-60">
                                    {TIME_OPTIONS.map((t) => (
                                      <SelectItem key={t} value={t} className="text-xs font-mono">
                                        {t}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                                  Fim
                                </Label>
                                <Select
                                  value={day.end}
                                  onValueChange={(v) =>
                                    setHours((prev) => ({
                                      ...prev,
                                      [key]: { ...prev[key], end: v },
                                    }))
                                  }
                                >
                                  <SelectTrigger className="h-7 px-2 text-[11px] rounded-md border-slate-300 font-mono">
                                    <SelectValue placeholder="Fim" />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-60">
                                    {TIME_OPTIONS.map((t) => (
                                      <SelectItem key={t} value={t} className="text-xs font-mono">
                                        {t}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                        Intervalo da grade:
                      </Label>
                      <Select
                        value={String(slotMinutes)}
                        onValueChange={(v) => setSlotMinutes(Number(v))}
                      >
                        <SelectTrigger className="h-8 w-28 rounded-lg border-slate-300 text-xs font-semibold">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="15" className="text-xs">
                            15 min
                          </SelectItem>
                          <SelectItem value="30" className="text-xs">
                            30 min
                          </SelectItem>
                          <SelectItem value="60" className="text-xs">
                            60 min
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      onClick={handleSaveHours}
                      disabled={hoursSaving}
                      className="bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-xl shadow-sm flex items-center gap-2 h-9 px-4 text-xs"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {hoursSaving ? 'Salvando...' : 'Salvar Configuração'}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ ABA: BLOQUEIOS ============ */}
        <TabsContent value="blocks" className="mt-4">
          <Card className="rounded-2xl border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-lg font-bold text-slate-900">
                    Feriados e Bloqueios
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Dias em que a agenda não aceita atendimentos.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleImportHolidays}
                    variant="outline"
                    className="rounded-xl border-slate-300 text-xs font-semibold h-9 flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Importar feriados nacionais
                  </Button>
                  <Button
                    onClick={() => {
                      setBlockDate(new Date().toISOString().split('T')[0])
                      setBlockReason('')
                      setBlockOpen(true)
                    }}
                    className="bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-xl shadow-sm flex items-center gap-1.5 h-9"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar bloqueio
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 hover:bg-slate-50">
                      <TableHead className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                        Data
                      </TableHead>
                      <TableHead className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                        Motivo
                      </TableHead>
                      <TableHead className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                        Cadastrado por
                      </TableHead>
                      <TableHead className="text-xs font-bold text-slate-600 uppercase tracking-wider text-right">
                        Ações
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {blockedLoading ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-sm text-slate-400 py-10">
                          Carregando bloqueios...
                        </TableCell>
                      </TableRow>
                    ) : blockedDays.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-sm text-slate-400 py-10">
                          Nenhum dia bloqueado.
                        </TableCell>
                      </TableRow>
                    ) : (
                      blockedDays.map((b) => (
                        <TableRow key={b.id} className="group">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Lock className="w-3.5 h-3.5 text-slate-400" />
                              <span className="text-sm font-semibold text-slate-800 font-mono">
                                {formatDate(b.date)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {b.reason ? (
                              <Badge
                                variant="outline"
                                className="text-[11px] font-semibold bg-slate-100 text-slate-700 border-slate-200"
                              >
                                {b.reason}
                              </Badge>
                            ) : (
                              <span className="text-sm text-slate-400">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-slate-600">
                            {b.created_by || '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemoveBlock(b.id)}
                              className="h-8 w-8 p-0 text-red-500 hover:bg-red-50 rounded-lg"
                              title="Desbloquear dia"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ ABA: NFS-e ============ */}
        <TabsContent value="nfse" className="mt-4">
          <Card className="rounded-2xl border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-navy-700" />
                NFS-e de Comissão B2B
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Parâmetros para emissão de Nota Fiscal de Serviço Eletrônica sobre a comissão de
                vendas B2B. O ISS é calculado sempre sobre o valor da comissão.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Parâmetros fiscais */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Parâmetros Fiscais
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold text-slate-700">
                      Alíquota padrão de ISS (%) <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      value={nfseAliquota}
                      onChange={(e) => setNfseAliquota(e.target.value)}
                      placeholder="3.00"
                      inputMode="decimal"
                      className="h-10 rounded-xl mt-1 text-sm border-slate-300"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Padrão Caçador/SC: 3.00%. Usado quando o tipo não tem alíquota própria.
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-slate-700">
                      Código do item de serviço municipal
                    </Label>
                    <Input
                      value={nfseItemServico}
                      onChange={(e) => setNfseItemServico(e.target.value)}
                      placeholder="10.01"
                      className="h-10 rounded-xl mt-1 text-sm border-slate-300"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Item da lista de serviços da prefeitura (ex.: 10.01).
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-xs font-semibold text-slate-700">
                      Texto padrão de discriminação
                    </Label>
                    <Textarea
                      value={nfseDiscriminacao}
                      onChange={(e) => setNfseDiscriminacao(e.target.value)}
                      placeholder="Intermediação comercial - Comissão sobre venda de aparelhos auditivos"
                      rows={2}
                      className="rounded-xl mt-1 text-sm border-slate-300 resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Dados do prestador */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Dados do Prestador (Audição360)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs font-semibold text-slate-700">
                      Inscrição Municipal
                    </Label>
                    <Input
                      value={nfseInscMunicipal}
                      onChange={(e) => setNfseInscMunicipal(e.target.value)}
                      placeholder="Inscrição municipal da empresa emissora"
                      className="h-10 rounded-xl mt-1 text-sm border-slate-300"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-slate-700">Município</Label>
                    <Input
                      value={nfseMunicipio}
                      onChange={(e) => setNfseMunicipio(e.target.value)}
                      placeholder="Caçador"
                      className="h-10 rounded-xl mt-1 text-sm border-slate-300"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-slate-700">UF</Label>
                    <Input
                      value={nfseUf}
                      onChange={(e) => setNfseUf(e.target.value.toUpperCase().slice(0, 2))}
                      placeholder="SC"
                      className="h-10 rounded-xl mt-1 text-sm border-slate-300"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-slate-700">
                      Código IBGE do município
                    </Label>
                    <Input
                      value={nfseCodigoMunicipio}
                      onChange={(e) => setNfseCodigoMunicipio(e.target.value)}
                      placeholder="4203006"
                      className="h-10 rounded-xl mt-1 text-sm border-slate-300"
                    />
                  </div>
                </div>
              </div>

              {/* Configurações da API da prefeitura */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Configurações da API da Prefeitura
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold text-slate-700">Provedor</Label>
                    <Select
                      value={nfseProvedor}
                      onValueChange={(v) => setNfseProvedor(v as NfseB2BProvedor)}
                    >
                      <SelectTrigger className="h-10 rounded-xl mt-1 text-sm border-slate-300">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BETHA" className="text-xs">
                          Betha
                        </SelectItem>
                        <SelectItem value="NOTABLU" className="text-xs">
                          Nota Blu
                        </SelectItem>
                        <SelectItem value="SIMPLISS" className="text-xs">
                          SimplISS
                        </SelectItem>
                        <SelectItem value="GINFES" className="text-xs">
                          Ginfes
                        </SelectItem>
                        <SelectItem value="ABRASF" className="text-xs">
                          ABRASF (genérico)
                        </SelectItem>
                        <SelectItem value="OUTRO" className="text-xs">
                          Outro
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-slate-700">Ambiente</Label>
                    <Select
                      value={nfseAmbiente}
                      onValueChange={(v) => setNfseAmbiente(v as NfseB2BAmbiente)}
                    >
                      <SelectTrigger className="h-10 rounded-xl mt-1 text-sm border-slate-300">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="homologacao" className="text-xs">
                          Homologação
                        </SelectItem>
                        <SelectItem value="producao" className="text-xs">
                          Produção
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-xs font-semibold text-slate-700">URL base da API</Label>
                    <Input
                      value={nfseUrlApi}
                      onChange={(e) => setNfseUrlApi(e.target.value)}
                      placeholder="https://api.prefeitura.gov.br/nfse"
                      className="h-10 rounded-xl mt-1 text-sm border-slate-300"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-slate-700">Usuário / Login</Label>
                    <Input
                      value={nfseLogin}
                      onChange={(e) => setNfseLogin(e.target.value)}
                      placeholder="usuário da API"
                      className="h-10 rounded-xl mt-1 text-sm border-slate-300"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-slate-700">Senha / Token</Label>
                    <Input
                      type="password"
                      value={nfseToken}
                      onChange={(e) => setNfseToken(e.target.value)}
                      placeholder="token de acesso"
                      className="h-10 rounded-xl mt-1 text-sm border-slate-300"
                    />
                  </div>
                </div>
                {!nfseUrlApi.trim() && (
                  <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-[11px] text-amber-700">
                      A URL base da API não está configurada. A emissão de NFS-e ficará indisponível
                      até que este campo seja preenchido.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-100">
                <Button
                  onClick={handleSaveNfse}
                  disabled={nfseSaving}
                  className="bg-navy-700 hover:bg-navy-800 text-white font-semibold rounded-xl shadow-sm flex items-center gap-2 h-10 px-5"
                >
                  <Save className="w-4 h-4" />
                  {nfseSaving ? 'Salvando...' : 'Salvar Configuração NFS-e'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ ABA: LGPD ============ */}
        <TabsContent value="lgpd" className="mt-4">
          <Card className="rounded-2xl border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-teal-600" />
                LGPD & Termos
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Política de Privacidade e termos de consentimento exibidos no cadastro de pacientes
                e na tela de login. Os textos são armazenados em um único registro na collection
                <span className="font-mono"> policy_texts</span>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {lgpdLoading || !lgpdTexts ? (
                <p className="text-xs text-slate-400 py-4 text-center">Carregando textos...</p>
              ) : (
                <>
                  {/* Política de Privacidade */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Política de Privacidade
                    </h4>
                    <Textarea
                      value={lgpdTexts.politica_privacidade}
                      onChange={(e) =>
                        setLgpdTexts({
                          ...lgpdTexts,
                          politica_privacidade: e.target.value,
                        })
                      }
                      rows={8}
                      className="rounded-xl text-xs border-slate-300 resize-y font-mono leading-relaxed"
                    />
                  </div>

                  {/* Termo - Dados Cadastrais */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Termo de Consentimento — Dados Cadastrais
                    </h4>
                    <Textarea
                      value={lgpdTexts.dados_cadastrais.texto}
                      onChange={(e) =>
                        setLgpdTexts({
                          ...lgpdTexts,
                          dados_cadastrais: {
                            ...lgpdTexts.dados_cadastrais,
                            texto: e.target.value,
                          },
                        })
                      }
                      rows={6}
                      className="rounded-xl text-xs border-slate-300 resize-y font-mono leading-relaxed"
                    />
                  </div>

                  {/* Termo - Dados de Saúde */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Termo de Consentimento — Dados de Saúde
                    </h4>
                    <Textarea
                      value={lgpdTexts.dados_saude.texto}
                      onChange={(e) =>
                        setLgpdTexts({
                          ...lgpdTexts,
                          dados_saude: {
                            ...lgpdTexts.dados_saude,
                            texto: e.target.value,
                          },
                        })
                      }
                      rows={6}
                      className="rounded-xl text-xs border-slate-300 resize-y font-mono leading-relaxed"
                    />
                  </div>

                  {/* Termo - Marketing */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Termo de Consentimento — Marketing
                    </h4>
                    <Textarea
                      value={lgpdTexts.marketing.texto}
                      onChange={(e) =>
                        setLgpdTexts({
                          ...lgpdTexts,
                          marketing: {
                            ...lgpdTexts.marketing,
                            texto: e.target.value,
                          },
                        })
                      }
                      rows={6}
                      className="rounded-xl text-xs border-slate-300 resize-y font-mono leading-relaxed"
                    />
                  </div>

                  <div className="flex justify-end pt-2 border-t border-slate-100">
                    <Button
                      onClick={handleSaveLgpd}
                      disabled={lgpdSaving}
                      className="bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-xl shadow-sm flex items-center gap-2 h-10 px-5"
                    >
                      <Save className="w-4 h-4" />
                      {lgpdSaving ? 'Salvando...' : 'Salvar Textos LGPD'}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal: Adicionar bloqueio */}
      <Dialog open={blockOpen} onOpenChange={setBlockOpen}>
        <DialogContent className="max-w-md w-full rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
          <DialogHeader className="border-b border-slate-100 pb-3">
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Lock className="w-5 h-5 text-slate-500" />
              <span>Bloquear dia</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-semibold text-slate-700">
                Data <span className="text-red-500">*</span>
              </Label>
              <Input
                type="date"
                value={blockDate}
                onChange={(e) => setBlockDate(e.target.value)}
                className="h-10 rounded-xl mt-1 text-sm border-slate-300"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700">Motivo</Label>
              <Input
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="Ex.: Feriado, Recesso, Manutenção..."
                className="h-10 rounded-xl mt-1 text-sm border-slate-300"
              />
            </div>
          </div>
          <DialogFooter className="pt-4">
            <Button
              variant="outline"
              onClick={() => setBlockOpen(false)}
              className="rounded-xl border-slate-300 text-xs font-semibold h-10"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAddBlock}
              className="bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-xl h-10"
            >
              Bloquear dia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Novo/Editar equipamento */}
      <Dialog open={eqOpen} onOpenChange={setEqOpen}>
        <DialogContent className="max-w-md w-full rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
          <DialogHeader className="border-b border-slate-100 pb-3">
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-teal-500" />
              <span>{eqEditing ? 'Editar Equipamento' : 'Novo Equipamento'}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-semibold text-slate-700">
                Nome do equipamento <span className="text-red-500">*</span>
              </Label>
              <Input
                value={eqNome}
                onChange={(e) => setEqNome(e.target.value)}
                placeholder="Ex.: AD229b, AT235..."
                className="h-10 rounded-xl mt-1 text-sm border-slate-300"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700">
                Data da última calibração <span className="text-red-500">*</span>
              </Label>
              <Input
                type="date"
                value={eqDataCalib}
                onChange={(e) => setEqDataCalib(e.target.value)}
                className="h-10 rounded-xl mt-1 text-sm border-slate-300"
              />
            </div>
            {previewProxima && (
              <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                  Próxima calibração (calculada)
                </p>
                <p className="text-sm font-bold text-slate-800 font-mono mt-0.5">
                  {formatDate(previewProxima)}
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="pt-4">
            <Button
              variant="outline"
              onClick={() => setEqOpen(false)}
              className="rounded-xl border-slate-300 text-xs font-semibold h-10"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveEquipment}
              disabled={eqSaving}
              className="bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-xl h-10"
            >
              {eqSaving ? 'Salvando...' : eqEditing ? 'Salvar alterações' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão de equipamento */}
      <ConfirmDialog
        open={!!eqDelete}
        onOpenChange={(o) => !o && setEqDelete(null)}
        title="Excluir equipamento"
        description={
          eqDelete
            ? `Tem certeza que deseja excluir o equipamento "${eqDelete.nome}"? Esta ação não pode ser desfeita.`
            : ''
        }
        confirmText="Excluir"
        cancelText="Cancelar"
        onConfirm={handleDeleteEquipment}
      />
    </div>
  )
}
