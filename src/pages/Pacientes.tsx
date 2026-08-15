import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '@/context/AppContext'
import {
  Users,
  Plus,
  Download,
  Search,
  Filter,
  ArrowUpDown,
  FileText,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Phone,
  Calendar,
} from 'lucide-react'
import { formatDate, maskCPF, getInitials, getAvatarColor, exportToCSV } from '@/lib/formatters'
import { Patient, PatientStatus } from '@/types'
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
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { PatientModal } from '@/components/PatientModal'

export default function Pacientes() {
  const { patients, addPatient, updatePatient, deletePatient } = useApp()
  const navigate = useNavigate()

  // Filtros
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('todos')
  const [planFilter, setPlanFilter] = useState<string>('todos')

  // Ordenação
  const [sortField, setSortField] = useState<'name' | 'cpf'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  // Paginação (10 por página)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  // Modais
  const [patientModalOpen, setPatientModalOpen] = useState(false)
  const [patientToEdit, setPatientToEdit] = useState<Patient | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [patientToDelete, setPatientToDelete] = useState<Patient | null>(null)

  // Extrair convênios únicos para o filtro
  const uniquePlans = useMemo(() => {
    const set = new Set<string>()
    patients.forEach((p) => {
      if (p.planName) set.add(p.planName)
    })
    return Array.from(set)
  }, [patients])

  // Filtragem e Ordenação
  const filteredPatients = useMemo(() => {
    let result = patients.filter((p) => {
      const q = search.toLowerCase().trim()
      const cleanQ = q.replace(/\D/g, '')

      const nameMatch = p.name.toLowerCase().includes(q)
      const cpfMatch = p.cpf.replace(/\D/g, '').includes(cleanQ) || p.cpf.includes(q)
      const phoneMatch = (p.mobile || p.phone || '').replace(/\D/g, '').includes(cleanQ)

      const matchesSearch = !q || nameMatch || cpfMatch || phoneMatch

      const matchesStatus =
        statusFilter === 'todos' || p.status.toLowerCase() === statusFilter.toLowerCase()

      const matchesPlan =
        planFilter === 'todos'
          ? true
          : planFilter === 'Particular'
            ? p.planType === 'Particular'
            : p.planName === planFilter

      return matchesSearch && matchesStatus && matchesPlan
    })

    result.sort((a, b) => {
      let valA = a[sortField].toLowerCase()
      let valB = b[sortField].toLowerCase()
      if (sortOrder === 'asc') return valA.localeCompare(valB)
      return valB.localeCompare(valA)
    })

    return result
  }, [patients, search, statusFilter, planFilter, sortField, sortOrder])

  // Paginação
  const totalPages = Math.ceil(filteredPatients.length / pageSize) || 1
  const paginatedPatients = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredPatients.slice(start, start + pageSize)
  }, [filteredPatients, currentPage])

  const toggleSort = (field: 'name' | 'cpf') => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  const handleExport = () => {
    const dataToExport = filteredPatients.map((p) => ({
      Nome: p.name,
      CPF: p.cpf,
      DataNascimento: formatDate(p.birthDate),
      Sexo: p.gender,
      Celular: p.mobile,
      Telefone: p.phone,
      Email: p.email,
      Convenio: p.planType === 'Convênio' ? p.planName : 'Particular',
      Status: p.status,
      UltimaConsulta: formatDate(p.lastVisit),
      Cidade: `${p.city}/${p.state}`,
    }))
    exportToCSV('pacientes_audicao360', dataToExport)
  }

  const handleSavePatient = (data: any) => {
    if (patientToEdit) {
      updatePatient(patientToEdit.id, data)
    } else {
      addPatient(data)
    }
  }

  const clearFilters = () => {
    setSearch('')
    setStatusFilter('todos')
    setPlanFilter('todos')
    setCurrentPage(1)
  }

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Pacientes</h1>
            <Badge variant="secondary" className="bg-teal-50 text-navy-700 font-bold text-xs">
              {patients.length} cadastrados
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Gestão completa da base de pacientes, prontuários e históricos audiológicos
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            onClick={handleExport}
            variant="outline"
            className="rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold h-10"
          >
            <Download className="w-4 h-4 mr-1.5 text-slate-600" />
            Exportar CSV
          </Button>
          <Button
            onClick={() => {
              setPatientToEdit(null)
              setPatientModalOpen(true)
            }}
            className="rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-xs font-semibold h-10 shadow-sm flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Novo Paciente
          </Button>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Campo de Busca por Nome ou CPF */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setCurrentPage(1)
              }}
              placeholder="Buscar por nome, CPF ou celular..."
              className="h-10 pl-9 rounded-xl border-slate-300 text-xs sm:text-sm"
            />
          </div>

          {/* Select de Status */}
          <div>
            <Select
              value={statusFilter}
              onValueChange={(val) => {
                setStatusFilter(val)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="h-10 rounded-xl border-slate-300 text-xs font-medium">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Status</SelectItem>
                <SelectItem value="Ativo">Ativo</SelectItem>
                <SelectItem value="Em tratamento">Em tratamento</SelectItem>
                <SelectItem value="Inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Select de Convênio */}
          <div>
            <Select
              value={planFilter}
              onValueChange={(val) => {
                setPlanFilter(val)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="h-10 rounded-xl border-slate-300 text-xs font-medium">
                <SelectValue placeholder="Convênio" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Convênios</SelectItem>
                <SelectItem value="Particular">Particular</SelectItem>
                <SelectItem value="SUS">SUS</SelectItem>
                {uniquePlans.map((pl) => (
                  <SelectItem key={pl} value={pl}>
                    {pl}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {(search || statusFilter !== 'todos' || planFilter !== 'todos') && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
            <span className="text-slate-500">
              Encontrados <strong className="text-slate-900">{filteredPatients.length}</strong>{' '}
              paciente(s) com os filtros aplicados
            </span>
            <Button
              variant="ghost"
              onClick={clearFilters}
              className="text-xs text-teal-600 hover:text-teal-700 p-0 h-auto font-semibold"
            >
              Limpar filtros
            </Button>
          </div>
        )}
      </div>

      {/* Tabela de Pacientes */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider text-[11px] font-bold">
              <tr>
                <th
                  onClick={() => toggleSort('name')}
                  className="py-3.5 px-4 cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Paciente</span>
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('cpf')}
                  className="py-3.5 px-4 cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>CPF</span>
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </th>
                <th className="py-3.5 px-4">Telefone / WhatsApp</th>
                <th className="py-3.5 px-4">Convênio</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Última Consulta</th>
                <th className="py-3.5 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedPatients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                    Nenhum paciente localizado com os critérios selecionados.
                  </td>
                </tr>
              ) : (
                paginatedPatients.map((patient, index) => {
                  return (
                    <tr
                      key={patient.id}
                      className={`hover:bg-teal-50/50 transition-colors ${
                        index % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                      }`}
                    >
                      {/* Nome + Avatar */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-full ${getAvatarColor(
                              patient.name,
                            )} text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm`}
                          >
                            {getInitials(patient.name)}
                          </div>
                          <div>
                            <span
                              onClick={() => navigate(`/pacientes/${patient.id}/prontuario`)}
                              className="font-bold text-slate-900 hover:text-teal-600 transition-colors cursor-pointer block"
                            >
                              {patient.name}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {patient.city}/{patient.state} • {patient.gender}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* CPF */}
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-600">
                        {maskCPF(patient.cpf)}
                      </td>

                      {/* Telefone */}
                      <td className="py-3.5 px-4 text-slate-700">
                        <div>{patient.mobile || patient.phone}</div>
                        {patient.email && (
                          <div className="text-[11px] text-slate-400 truncate max-w-[150px]">
                            {patient.email}
                          </div>
                        )}
                      </td>

                      {/* Convênio */}
                      <td className="py-3.5 px-4">
                        <span className="text-xs font-semibold text-slate-700 block">
                          {patient.planType === 'Convênio'
                            ? patient.planName || 'Convênio'
                            : patient.planType === 'SUS'
                              ? 'SUS'
                              : 'Particular'}
                        </span>
                        {patient.planType === 'Convênio' && patient.cardNumber && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            Cart: {patient.cardNumber}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <Badge
                          variant="outline"
                          className={
                            patient.status === 'Ativo'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : patient.status === 'Em tratamento'
                                ? 'bg-teal-50 text-navy-700 border-teal-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                          }
                        >
                          {patient.status}
                        </Badge>
                      </td>

                      {/* Última Consulta */}
                      <td className="py-3.5 px-4 text-xs text-slate-600">
                        {formatDate(patient.lastVisit)}
                      </td>

                      {/* Ações */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Ver Prontuário */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate(`/pacientes/${patient.id}/prontuario`)}
                            className="h-8 w-8 p-0 text-teal-600 hover:bg-teal-50 rounded-lg"
                            title="Abrir Prontuário"
                          >
                            <FileText className="w-4 h-4" />
                          </Button>

                          {/* Editar */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setPatientToEdit(patient)
                              setPatientModalOpen(true)
                            }}
                            className="h-8 w-8 p-0 text-slate-600 hover:bg-slate-100 rounded-lg"
                            title="Editar Dados"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>

                          {/* Excluir */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setPatientToDelete(patient)
                              setDeleteConfirmOpen(true)
                            }}
                            className="h-8 w-8 p-0 text-red-500 hover:bg-red-50 hover:text-red-700 rounded-lg"
                            title="Excluir Paciente"
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

        {/* Paginação */}
        <div className="p-4 border-t border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            Mostrando{' '}
            <strong className="text-slate-800">
              {filteredPatients.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}
            </strong>{' '}
            a{' '}
            <strong className="text-slate-800">
              {Math.min(currentPage * pageSize, filteredPatients.length)}
            </strong>{' '}
            de <strong className="text-slate-800">{filteredPatients.length}</strong> pacientes
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="h-8 px-3 rounded-lg border-slate-300 text-xs"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Anterior
            </Button>
            <span className="font-semibold text-slate-700 px-2">
              Página {currentPage} de {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="h-8 px-3 rounded-lg border-slate-300 text-xs"
            >
              Próxima
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>

      {/* Modal de Cadastro / Edição */}
      <PatientModal
        open={patientModalOpen}
        onOpenChange={setPatientModalOpen}
        patientToEdit={patientToEdit}
        onSave={handleSavePatient}
      />

      {/* Confirmação de Exclusão */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Excluir paciente?"
        description={`Esta ação não pode ser desfeita. Deseja realmente excluir o paciente ${
          patientToDelete?.name || ''
        }? Todos os registros vinculados serão removidos.`}
        confirmText="Excluir Paciente"
        cancelText="Cancelar"
        variant="danger"
        onConfirm={() => {
          if (patientToDelete) {
            deletePatient(patientToDelete.id)
            setPatientToDelete(null)
          }
        }}
      />
    </div>
  )
}
