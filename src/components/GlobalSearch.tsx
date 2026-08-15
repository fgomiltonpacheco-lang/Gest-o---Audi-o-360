import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Users, Calendar, FileText, ChevronRight } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { getInitials, getAvatarColor, maskCPF, maskPhone, formatDate } from '@/lib/formatters'
import type { Patient, Appointment, ClinicalRecord } from '@/types'

type ResultCategory = 'patient' | 'appointment' | 'record'

interface SearchResult {
  category: ResultCategory
  patientId: string
  patientName: string
  primary: string
  secondary: string
}

/**
 * Destaca visualmente o termo buscado dentro de um texto, envolvendo as
 * correspondências em um <mark>.
 */
function Highlight({ text, query }: { text: string; query: string }): React.ReactNode {
  if (!query.trim()) return <>{text}</>
  const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.trim().toLowerCase() ? (
          <mark key={i} className="bg-yellow-200 text-slate-900 rounded px-0.5">
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </>
  )
}

export const GlobalSearch: React.FC = () => {
  const navigate = useNavigate()
  const { patients, appointments, clinicalRecords } = useApp()

  const [inputValue, setInputValue] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Debounce de ~300ms para a busca em tempo real
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(inputValue), 300)
    return () => clearTimeout(t)
  }, [inputValue])

  // Fecha o dropdown ao clicar fora ou pressionar ESC
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        inputRef.current?.blur()
      }
      // Atalho "/" foca a busca
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  // Mapa de paciente por id para nome (usado em agendamentos e prontuários)
  const patientById = useMemo(() => {
    const m = new Map<string, Patient>()
    patients.forEach((p) => m.set(p.id, p))
    return m
  }, [patients])

  // Filtragem multi-categoria
  const { flatResults, grouped } = useMemo(() => {
    const q = debouncedQuery.toLowerCase().trim()
    const cleanQ = debouncedQuery.replace(/\D/g, '')
    if (!q)
      return {
        flatResults: [] as SearchResult[],
        grouped: [] as { category: ResultCategory; label: string; items: SearchResult[] }[],
      }

    const matchText = (value: string) => value.toLowerCase().includes(q)
    const matchDigits = (value: string) =>
      cleanQ.length > 2 && value.replace(/\D/g, '').includes(cleanQ)

    // Pacientes
    const patientResults: SearchResult[] = patients
      .filter((p) => {
        const name = matchText(p.name)
        const cpf = matchDigits(p.cpf) || p.cpf.includes(q)
        const phone = matchDigits(p.mobile) || matchDigits(p.phone)
        return name || cpf || phone
      })
      .slice(0, 5)
      .map((p) => ({
        category: 'patient' as const,
        patientId: p.id,
        patientName: p.name,
        primary: p.name,
        secondary: `CPF: ${maskCPF(p.cpf)} • ${maskPhone(p.mobile || p.phone)}`,
      }))

    // Agendamentos
    const appointmentResults: SearchResult[] = appointments
      .filter((a) => {
        const name = matchText(a.patientName)
        const type = matchText(a.type)
        const date = matchText(formatDate(a.date)) || matchText(a.date)
        const phone = a.patientPhone ? matchDigits(a.patientPhone) : false
        return name || type || date || phone
      })
      .slice(0, 4)
      .map((a) => ({
        category: 'appointment' as const,
        patientId: a.patientId,
        patientName: a.patientName,
        primary: `${a.patientName} — ${a.type}`,
        secondary: `${formatDate(a.date)} às ${a.time} • ${a.professionalName}`,
      }))

    // Prontuários (registros clínicos)
    const recordResults: SearchResult[] = Object.values(clinicalRecords)
      .filter((r: ClinicalRecord) => {
        const pat = patientById.get(r.patientId)
        const name = pat ? matchText(pat.name) : false
        const complaint = r.mainComplaint ? matchText(r.mainComplaint) : false
        const diagnosis = r.diagnosis ? matchText(r.diagnosis) : false
        return name || complaint || diagnosis
      })
      .slice(0, 4)
      .map((r) => {
        const pat = patientById.get(r.patientId)
        const excerpt =
          r.mainComplaint && r.mainComplaint.length > 0
            ? r.mainComplaint.slice(0, 70) + (r.mainComplaint.length > 70 ? '…' : '')
            : r.diagnosis
              ? r.diagnosis.slice(0, 70) + (r.diagnosis.length > 70 ? '…' : '')
              : 'Sem queixa principal registrada'
        return {
          category: 'record' as const,
          patientId: r.patientId,
          patientName: pat?.name || 'Paciente',
          primary: pat?.name || 'Paciente',
          secondary: excerpt,
        }
      })

    const grouped = [
      { category: 'patient' as ResultCategory, label: 'Pacientes', items: patientResults },
      {
        category: 'appointment' as ResultCategory,
        label: 'Agendamentos',
        items: appointmentResults,
      },
      { category: 'record' as ResultCategory, label: 'Prontuários', items: recordResults },
    ].filter((g) => g.items.length > 0)

    const flatResults = grouped.flatMap((g) => g.items)

    return { flatResults, grouped }
  }, [debouncedQuery, patients, appointments, clinicalRecords, patientById])

  // Reseta o índice ativo quando os resultados mudam
  useEffect(() => {
    setActiveIndex(flatResults.length > 0 ? 0 : -1)
  }, [flatResults])

  // Mantém o item ativo visível durante a navegação por teclado
  useEffect(() => {
    if (activeIndex < 0) return
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${activeIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const handleSelect = useCallback(
    (patientId: string) => {
      setOpen(false)
      setInputValue('')
      setDebouncedQuery('')
      setActiveIndex(-1)
      navigate(`/pacientes/${patientId}/prontuario`)
    },
    [navigate],
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || flatResults.length === 0) {
      if (e.key === 'ArrowDown' && inputValue.trim()) {
        setOpen(true)
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % flatResults.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (i - 1 + flatResults.length) % flatResults.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = flatResults[activeIndex]
      if (item) handleSelect(item.patientId)
    }
  }

  const totalResults = flatResults.length
  const showDropdown = open && debouncedQuery.trim().length > 0

  const categoryMeta: Record<ResultCategory, { icon: React.ElementType; color: string }> = {
    patient: { icon: Users, color: 'text-teal-600' },
    appointment: { icon: Calendar, color: 'text-emerald-600' },
    record: { icon: FileText, color: 'text-purple-600' },
  }

  // Índice corrente por categoria (para data-idx global)
  let runningIndex = -1

  return (
    <div ref={containerRef} className="relative flex-1 max-w-md mx-auto">
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value)
            setOpen(true)
          }}
          onFocus={() => inputValue.trim() && setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Buscar paciente, agendamento ou prontuário..."
          aria-label="Busca global"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="global-search-listbox"
          aria-activedescendant={activeIndex >= 0 ? `search-item-${activeIndex}` : undefined}
          className="w-full h-10 pl-9 pr-4 rounded-full bg-slate-100 border border-transparent focus:border-teal-400 focus:bg-white focus:ring-2 focus:ring-teal-500/20 text-xs sm:text-sm text-slate-800 placeholder-slate-400 transition-all outline-none"
        />
        {inputValue && (
          <button
            type="button"
            onClick={() => {
              setInputValue('')
              setDebouncedQuery('')
              setOpen(false)
              inputRef.current?.focus()
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-semibold"
            aria-label="Limpar busca"
          >
            ✕
          </button>
        )}
      </div>

      {showDropdown && (
        <div
          id="global-search-listbox"
          role="listbox"
          className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-in fade-in-50 duration-150"
        >
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              {totalResults > 0
                ? `${totalResults} resultado${totalResults > 1 ? 's' : ''} para "${debouncedQuery.trim()}"`
                : 'Buscando...'}
            </span>
            <span className="text-[10px] text-slate-400">ESC fecha • ↑↓ navega • Enter abre</span>
          </div>

          <div ref={listRef} className="max-h-80 overflow-y-auto">
            {totalResults === 0 ? (
              <div className="p-6 text-center">
                <Search className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-500">
                  Nenhum resultado encontrado para "{debouncedQuery.trim()}".
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Tente buscar por nome, CPF, telefone, tipo de atendimento ou queixa.
                </p>
              </div>
            ) : (
              grouped.map((group) => {
                const meta = categoryMeta[group.category]
                const Icon = meta.icon
                return (
                  <div key={group.category} className="border-b border-slate-100 last:border-b-0">
                    <div className="sticky top-0 px-3 py-1.5 bg-slate-50/95 backdrop-blur flex items-center gap-1.5">
                      <Icon className={`w-3 h-3 ${meta.color}`} />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        {group.label} ({group.items.length})
                      </span>
                    </div>
                    {group.items.map((item) => {
                      runningIndex += 1
                      const idx = runningIndex
                      const isActive = idx === activeIndex
                      return (
                        <div
                          key={`${item.category}-${item.patientId}-${idx}`}
                          id={`search-item-${idx}`}
                          data-idx={idx}
                          role="option"
                          aria-selected={isActive}
                          onMouseEnter={() => setActiveIndex(idx)}
                          onClick={() => handleSelect(item.patientId)}
                          className={`flex items-center justify-between gap-3 px-3 py-2.5 cursor-pointer transition-colors group ${
                            isActive ? 'bg-teal-50' : 'hover:bg-teal-50/60'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-8 h-8 rounded-full ${getAvatarColor(
                                item.patientName,
                              )} text-white flex items-center justify-center font-bold text-xs shrink-0`}
                            >
                              {getInitials(item.patientName)}
                            </div>
                            <div className="min-w-0">
                              <p
                                className={`text-sm font-semibold truncate ${
                                  isActive
                                    ? 'text-navy-700'
                                    : 'text-slate-800 group-hover:text-teal-600'
                                }`}
                              >
                                <Highlight text={item.primary} query={debouncedQuery} />
                              </p>
                              <p className="text-xs text-slate-500 truncate">
                                <Highlight text={item.secondary} query={debouncedQuery} />
                              </p>
                            </div>
                          </div>
                          <ChevronRight
                            className={`w-4 h-4 shrink-0 transition-all ${
                              isActive ? 'text-teal-600 translate-x-0.5' : 'text-slate-300'
                            }`}
                          />
                        </div>
                      )
                    })}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default GlobalSearch
