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
import { Settings, Clock, CalendarOff, Plus, Trash2, Save, Lock, Download } from 'lucide-react'

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
  const { currentUser } = useApp()
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
              Horários de funcionamento e bloqueios da agenda
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="hours" className="w-full">
        <TabsList className="bg-slate-100 rounded-xl p-1 h-auto">
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
        </TabsList>

        {/* ============ ABA: HORÁRIOS ============ */}
        <TabsContent value="hours" className="mt-4">
          <Card className="rounded-2xl border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold text-slate-900">
                Horários de Funcionamento
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Defina os dias e horários em que a clínica atende. A agenda usa estes horários para
                gerar a grade de atendimentos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {hoursLoading ? (
                <p className="text-xs text-slate-400 py-6 text-center">Carregando...</p>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {DAY_KEYS.map(({ key, label }) => {
                      const day = hours[key]
                      return (
                        <div
                          key={key}
                          className={`rounded-xl border p-3 space-y-3 ${
                            day.open
                              ? 'border-teal-200 bg-teal-50/30'
                              : 'border-slate-200 bg-slate-50/60'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-bold text-slate-800">{label}</Label>
                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={day.open}
                                onCheckedChange={(v) =>
                                  setHours((prev) => ({
                                    ...prev,
                                    [key]: { ...prev[key], open: !!v },
                                  }))
                                }
                              />
                              <span className="text-[11px] font-semibold text-slate-500">
                                {day.open ? 'Abre' : 'Fechado'}
                              </span>
                            </div>
                          </div>
                          {day.open && (
                            <div className="space-y-2">
                              <div>
                                <Label className="text-[10px] uppercase tracking-wide text-slate-400">
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
                                  <SelectTrigger className="h-9 rounded-lg border-slate-300 text-xs font-mono">
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
                                <Label className="text-[10px] uppercase tracking-wide text-slate-400">
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
                                  <SelectTrigger className="h-9 rounded-lg border-slate-300 text-xs font-mono">
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

                  <div className="flex flex-col sm:flex-row sm:items-end gap-4 pt-2 border-t border-slate-100">
                    <div>
                      <Label className="text-xs font-semibold text-slate-700">
                        Intervalo da grade (minutos)
                      </Label>
                      <Select
                        value={String(slotMinutes)}
                        onValueChange={(v) => setSlotMinutes(Number(v))}
                      >
                        <SelectTrigger className="h-9 w-40 rounded-lg border-slate-300 text-xs font-semibold mt-1">
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
                      className="bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-xl shadow-sm flex items-center gap-2 h-10 px-5"
                    >
                      <Save className="w-4 h-4" />
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
    </div>
  )
}
