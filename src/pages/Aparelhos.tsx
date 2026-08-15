import React, { useState, useMemo } from 'react'
import { useApp } from '@/context/AppContext'
import { useNavigate } from 'react-router-dom'
import {
  Ear,
  Plus,
  Search,
  Filter,
  ShieldAlert,
  Calendar,
  Wrench,
  Sliders,
  Trash2,
  Pencil,
  ChevronRight,
  ShieldCheck,
  CheckCircle,
  FileText,
} from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/formatters'
import { HearingAid, HearingAidType } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { HearingAidModal } from '@/components/HearingAidModal'
import { ConfirmDialog } from '@/components/ConfirmDialog'

export default function Aparelhos() {
  const {
    hearingAids,
    addHearingAid,
    updateHearingAid,
    deleteHearingAid,
    addAidMaintenance,
    addAidAdjustment,
  } = useApp()
  const navigate = useNavigate()

  // Filtros
  const [search, setSearch] = useState('')
  const [brandFilter, setBrandFilter] = useState('todos')
  const [typeFilter, setTypeFilter] = useState('todos')
  const [statusFilter, setStatusFilter] = useState('todos')

  // Modais de Criação/Edição de Aparelho
  const [aidModalOpen, setAidModalOpen] = useState(false)
  const [aidToEdit, setAidToEdit] = useState<HearingAid | null>(null)

  // Modal de Detalhes do Aparelho (com abas de Manutenção e Ajustes)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [selectedAid, setSelectedAid] = useState<HearingAid | null>(null)

  // Submodais de Manutenção / Ajuste
  const [maintModalOpen, setMaintModalOpen] = useState(false)
  const [maintDesc, setMaintDesc] = useState('')
  const [maintResp, setMaintResp] = useState('Dr. Lucas Ferreira Santos')
  const [maintDate, setMaintDate] = useState(new Date().toISOString().split('T')[0])

  const [adjModalOpen, setAdjModalOpen] = useState(false)
  const [adjDesc, setAdjDesc] = useState('')
  const [adjProf, setAdjProf] = useState('Milton Soares Pacheco')
  const [adjDate, setAdjDate] = useState(new Date().toISOString().split('T')[0])

  // Confirmação de Exclusão
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [aidToDelete, setAidToDelete] = useState<HearingAid | null>(null)

  // Marcas únicas para filtro
  const uniqueBrands = useMemo(() => {
    const s = new Set<string>()
    hearingAids.forEach((a) => s.add(a.brand))
    return Array.from(s)
  }, [hearingAids])

  // Filtragem
  const filteredAids = useMemo(() => {
    const today = new Date()
    return hearingAids.filter((aid) => {
      const q = search.toLowerCase().trim()
      const matchesSearch =
        !q ||
        aid.brand.toLowerCase().includes(q) ||
        aid.model.toLowerCase().includes(q) ||
        aid.serialNumber.toLowerCase().includes(q) ||
        (aid.patientName || '').toLowerCase().includes(q)

      const matchesBrand = brandFilter === 'todos' || aid.brand === brandFilter
      const matchesType = typeFilter === 'todos' || aid.type === typeFilter
      const matchesStatus = statusFilter === 'todos' || aid.status === statusFilter

      return matchesSearch && matchesBrand && matchesType && matchesStatus
    })
  }, [hearingAids, search, brandFilter, typeFilter, statusFilter])

  // Alertas de garantia (vencendo em <= 30 dias)
  const isWarrantyExpiringSoon = (endDateStr?: string) => {
    if (!endDateStr) return false
    const end = new Date(endDateStr)
    const today = new Date()
    const diff = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return diff >= 0 && diff <= 30
  }

  const handleSaveAid = (data: any) => {
    if (aidToEdit) {
      updateHearingAid(aidToEdit.id, data)
    } else {
      addHearingAid(data)
    }
  }

  const handleSaveMaintenance = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAid || !maintDesc.trim()) return
    addAidMaintenance(selectedAid.id, maintDesc.trim(), maintResp, maintDate)
    setMaintDesc('')
    setMaintModalOpen(false)
    // Atualizar visualização do item selecionado
    const updated = hearingAids.find((a) => a.id === selectedAid.id)
    if (updated) setSelectedAid(updated)
  }

  const handleSaveAdjustment = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAid || !adjDesc.trim()) return
    addAidAdjustment(selectedAid.id, adjDesc.trim(), adjProf, adjDate)
    setAdjDesc('')
    setAdjModalOpen(false)
    const updated = hearingAids.find((a) => a.id === selectedAid.id)
    if (updated) setSelectedAid(updated)
  }

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Aparelhos Auditivos
            </h1>
            <Badge variant="secondary" className="bg-teal-50 text-navy-700 font-bold text-xs">
              {hearingAids.length} dispositivos
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Gestão de próteses auditivas, controle de garantias, histórico de manutenções e ajustes
            finos
          </p>
        </div>

        <Button
          onClick={() => {
            setAidToEdit(null)
            setAidModalOpen(true)
          }}
          className="rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-xs font-semibold h-10 shadow-sm flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Novo Aparelho
        </Button>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative lg:col-span-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por marca, modelo, série, paciente..."
            className="h-10 pl-9 rounded-xl border-slate-300 text-xs sm:text-sm"
          />
        </div>

        <div>
          <Select value={brandFilter} onValueChange={setBrandFilter}>
            <SelectTrigger className="h-10 rounded-xl border-slate-300 text-xs font-medium">
              <SelectValue placeholder="Marca" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as Marcas</SelectItem>
              {uniqueBrands.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-10 rounded-xl border-slate-300 text-xs font-medium">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Tipos</SelectItem>
              <SelectItem value="BTE">BTE (Retroauricular)</SelectItem>
              <SelectItem value="RIC">RIC (Receptor no canal)</SelectItem>
              <SelectItem value="ITE">ITE (Intra-auricular)</SelectItem>
              <SelectItem value="CIC">CIC (Microcanal)</SelectItem>
              <SelectItem value="IIC">IIC (Invisível no canal)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-10 rounded-xl border-slate-300 text-xs font-medium">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Status</SelectItem>
              <SelectItem value="Em uso">Em uso</SelectItem>
              <SelectItem value="Estoque">Em Estoque</SelectItem>
              <SelectItem value="Vendido">Vendido</SelectItem>
              <SelectItem value="Em manutenção">Em manutenção</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabela de Aparelhos */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider text-[11px] font-bold">
              <tr>
                <th className="py-3.5 px-4">Marca & Modelo</th>
                <th className="py-3.5 px-4">Tipo / Lado</th>
                <th className="py-3.5 px-4">Nº de Série</th>
                <th className="py-3.5 px-4">Paciente Vinculado</th>
                <th className="py-3.5 px-4">Data Venda</th>
                <th className="py-3.5 px-4">Garantia Até</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAids.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                    Nenhum aparelho localizado com os critérios selecionados.
                  </td>
                </tr>
              ) : (
                filteredAids.map((aid) => {
                  const expiring = isWarrantyExpiringSoon(aid.warrantyEndDate)
                  return (
                    <tr
                      key={aid.id}
                      className="hover:bg-teal-50/40 transition-colors cursor-pointer group"
                      onClick={() => {
                        setSelectedAid(aid)
                        setDetailModalOpen(true)
                      }}
                    >
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-900 block group-hover:text-teal-600">
                          {aid.brand} {aid.model}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {aid.powerSource} {aid.earMold ? '• Molde' : '• Oliva'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 font-bold text-slate-700 text-xs">
                            {aid.type}
                          </span>
                          <span className="text-xs text-slate-500 font-medium">{aid.side}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-xs text-slate-700 font-semibold">
                        {aid.serialNumber}
                      </td>

                      <td className="py-3.5 px-4">
                        {aid.patientName ? (
                          <span
                            onClick={(e) => {
                              e.stopPropagation()
                              if (aid.patientId) navigate(`/pacientes/${aid.patientId}/prontuario`)
                            }}
                            className="font-bold text-slate-800 hover:text-teal-600 block truncate max-w-[170px]"
                          >
                            {aid.patientName}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">
                            Disponível em Estoque
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-600">
                        {formatDate(aid.saleDate)}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-xs font-semibold ${
                              expiring ? 'text-red-600 font-bold' : 'text-slate-700'
                            }`}
                          >
                            {formatDate(aid.warrantyEndDate)}
                          </span>
                          {expiring && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">
                              Vencendo!
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <Badge
                          variant="outline"
                          className={
                            aid.status === 'Em uso'
                              ? 'bg-teal-50 text-navy-700 border-teal-200'
                              : aid.status === 'Estoque'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : aid.status === 'Em manutenção'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-slate-100 text-slate-600'
                          }
                        >
                          {aid.status}
                        </Badge>
                      </td>

                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedAid(aid)
                              setDetailModalOpen(true)
                            }}
                            className="h-8 w-8 p-0 text-teal-600 hover:bg-teal-50 rounded-lg"
                            title="Ver Histórico de Ajustes e Manutenções"
                          >
                            <Sliders className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setAidToEdit(aid)
                              setAidModalOpen(true)
                            }}
                            className="h-8 w-8 p-0 text-slate-600 hover:bg-slate-100 rounded-lg"
                            title="Editar Dados"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setAidToDelete(aid)
                              setDeleteConfirmOpen(true)
                            }}
                            className="h-8 w-8 p-0 text-red-500 hover:bg-red-50 rounded-lg"
                            title="Excluir Registro"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Cadastro / Edição */}
      <HearingAidModal
        open={aidModalOpen}
        onOpenChange={setAidModalOpen}
        aidToEdit={aidToEdit}
        onSave={handleSaveAid}
      />

      {/* Modal de Detalhes com Abas de Manutenções e Ajustes */}
      {selectedAid && (
        <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
          <DialogContent className="max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <DialogHeader className="border-b border-slate-100 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <Ear className="w-5 h-5 text-teal-600" />
                    <span>
                      {selectedAid.brand} {selectedAid.model}
                    </span>
                  </DialogTitle>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Série: {selectedAid.serialNumber} • Paciente:{' '}
                    <strong>{selectedAid.patientName || 'Estoque'}</strong>
                  </p>
                </div>
                <Badge className="bg-teal-50 text-navy-700 border-teal-200">
                  {selectedAid.status}
                </Badge>
              </div>
            </DialogHeader>

            <Tabs defaultValue="manutencoes" className="w-full pt-2">
              <TabsList className="grid grid-cols-2 bg-slate-100 p-1 rounded-xl">
                <TabsTrigger value="manutencoes" className="text-xs font-semibold py-2">
                  Manutenções ({selectedAid.maintenances?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="ajustes" className="text-xs font-semibold py-2">
                  Ajustes Finos ({selectedAid.adjustments?.length || 0})
                </TabsTrigger>
              </TabsList>

              {/* ABA MANUTENÇÕES */}
              <TabsContent value="manutencoes" className="space-y-4 pt-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Histórico de Manutenções e Reparos
                  </h4>
                  <Button
                    size="sm"
                    onClick={() => setMaintModalOpen(true)}
                    className="bg-teal-500 hover:bg-teal-600 text-white text-xs rounded-xl h-8 font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Nova Manutenção
                  </Button>
                </div>

                {!selectedAid.maintenances || selectedAid.maintenances.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center bg-slate-50 rounded-xl">
                    Nenhuma manutenção registrada para este aparelho.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {selectedAid.maintenances.map((m) => (
                      <div
                        key={m.id}
                        className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">{formatDate(m.date)}</span>
                          <span className="text-slate-500 font-medium">Resp: {m.responsible}</span>
                        </div>
                        <p className="text-slate-700 leading-relaxed">{m.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* ABA AJUSTES */}
              <TabsContent value="ajustes" className="space-y-4 pt-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Histórico de Programações e Ajustes
                  </h4>
                  <Button
                    size="sm"
                    onClick={() => setAdjModalOpen(true)}
                    className="bg-teal-500 hover:bg-teal-600 text-white text-xs rounded-xl h-8 font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Novo Ajuste
                  </Button>
                </div>

                {!selectedAid.adjustments || selectedAid.adjustments.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center bg-slate-50 rounded-xl">
                    Nenhum ajuste registrado para este aparelho.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {selectedAid.adjustments.map((a) => (
                      <div
                        key={a.id}
                        className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">{formatDate(a.date)}</span>
                          <span className="text-slate-500 font-medium">
                            Profissional: {a.professionalName}
                          </span>
                        </div>
                        <p className="text-slate-700 leading-relaxed">{a.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <DialogFooter className="pt-4 border-t border-slate-100">
              <Button
                variant="outline"
                onClick={() => setDetailModalOpen(false)}
                className="rounded-xl text-xs font-semibold"
              >
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Submodal Nova Manutenção */}
      <Dialog open={maintModalOpen} onOpenChange={setMaintModalOpen}>
        <DialogContent className="max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Registrar Manutenção
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveMaintenance} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-700">Data</Label>
                <Input
                  type="date"
                  value={maintDate}
                  onChange={(e) => setMaintDate(e.target.value)}
                  className="h-10 rounded-xl mt-1 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-700">Responsável</Label>
                <Input
                  value={maintResp}
                  onChange={(e) => setMaintResp(e.target.value)}
                  className="h-10 rounded-xl mt-1 text-xs"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700">
                Descrição dos Serviços Realizados
              </Label>
              <Textarea
                value={maintDesc}
                onChange={(e) => setMaintDesc(e.target.value)}
                placeholder="Troca de receptor, desumidificação, limpeza ultrassônica..."
                required
                rows={3}
                className="rounded-xl mt-1 text-xs"
              />
            </div>
            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setMaintModalOpen(false)}
                className="rounded-xl text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-xs font-semibold"
              >
                Salvar Manutenção
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Submodal Novo Ajuste */}
      <Dialog open={adjModalOpen} onOpenChange={setAdjModalOpen}>
        <DialogContent className="max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Registrar Ajuste / Programação
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveAdjustment} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-700">Data</Label>
                <Input
                  type="date"
                  value={adjDate}
                  onChange={(e) => setAdjDate(e.target.value)}
                  className="h-10 rounded-xl mt-1 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-700">Profissional</Label>
                <Input
                  value={adjProf}
                  onChange={(e) => setAdjProf(e.target.value)}
                  className="h-10 rounded-xl mt-1 text-xs"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700">
                Alterações e Configurações Eletroacústicas
              </Label>
              <Textarea
                value={adjDesc}
                onChange={(e) => setAdjDesc(e.target.value)}
                placeholder="Aumento de ganho em agudos (+2dB em 4kHz), calibração anti-feedback..."
                required
                rows={3}
                className="rounded-xl mt-1 text-xs"
              />
            </div>
            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAdjModalOpen(false)}
                className="rounded-xl text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-xs font-semibold"
              >
                Salvar Ajuste
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmação de Exclusão */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Excluir aparelho auditivo?"
        description={`Deseja realmente remover o aparelho ${aidToDelete?.brand} ${aidToDelete?.model} (Série: ${aidToDelete?.serialNumber})?`}
        confirmText="Excluir"
        cancelText="Cancelar"
        variant="danger"
        onConfirm={() => {
          if (aidToDelete) {
            deleteHearingAid(aidToDelete.id)
            setAidToDelete(null)
          }
        }}
      />
    </div>
  )
}
