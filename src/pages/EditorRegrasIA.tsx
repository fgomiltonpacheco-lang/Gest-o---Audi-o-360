import React, { useEffect, useState, useCallback } from 'react'
import { useApp } from '@/context/AppContext'
import { useToast } from '@/hooks/use-toast'
import pb from '@/lib/pocketbase/client'
import { ClientResponseError } from 'pocketbase'
import { extractFieldErrors } from '@/lib/pocketbase/errors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Brain,
  Save,
  Plus,
  Trash2,
  Sparkles,
  Loader2,
  Wand2,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react'

// ============================================================
// Tipos
// ============================================================

interface IaRegrasRecord {
  id: string
  prompt_sistema: string
  regras_correcao: string
  termos_proibidos: string
  termos_obrigatorios: string
}

interface IaExemploRecord {
  id: string
  texto_original: string
  texto_corrigido: string
  ordem: number
}

const DEFAULT_PROMPT_SISTEMA =
  'Você é um fonoaudiólogo revisor de evoluções clínicas. Sua função é corrigir gramática, ortografia, pontuação e clareza do texto, mantendo o significado clínico e o tom profissional.'

const DEFAULT_REGRAS_CORRECAO =
  'Use terminologia técnica de audiologia. Mantenha siglas: OD, OE, LRF, LDV, MT, IPRF. Formato: parágrafo único, tom profissional.'

const MAX_EXEMPLOS = 10

function describeError(error: unknown): string {
  if (error instanceof ClientResponseError) {
    const fieldErrors = extractFieldErrors(error)
    const parts = Object.entries(fieldErrors).map(([field, msg]) => `${field}: ${msg}`)
    if (parts.length > 0) return parts.join(' • ')
    if (error.response?.message) return String(error.response.message)
  }
  return error instanceof Error ? error.message : 'Erro desconhecido.'
}

export default function EditorRegrasIA() {
  const { currentUser } = useApp()
  const { toast } = useToast()

  // ---------- Regras ----------
  const [regrasId, setRegrasId] = useState<string>('')
  const [promptSistema, setPromptSistema] = useState(DEFAULT_PROMPT_SISTEMA)
  const [regrasCorrecao, setRegrasCorrecao] = useState(DEFAULT_REGRAS_CORRECAO)
  const [termosProibidos, setTermosProibidos] = useState('')
  const [termosObrigatorios, setTermosObrigatorios] = useState('')
  const [regrasLoading, setRegrasLoading] = useState(true)
  const [regrasSaving, setRegrasSaving] = useState(false)

  // ---------- Exemplos ----------
  const [exemplos, setExemplos] = useState<IaExemploRecord[]>([])
  const [exemplosLoading, setExemplosLoading] = useState(true)
  const [exemploEditing, setExemploEditing] = useState<IaExemploRecord | null>(null)
  const [exemploOpen, setExemploOpen] = useState(false)
  const [exemploOriginal, setExemploOriginal] = useState('')
  const [exemploCorrigido, setExemploCorrigido] = useState('')
  const [exemploSaving, setExemploSaving] = useState(false)
  const [exemploDelete, setExemploDelete] = useState<IaExemploRecord | null>(null)
  const [exemploDeleting, setExemploDeleting] = useState(false)

  // ---------- Pré-visualização ----------
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewText, setPreviewText] = useState('')
  const [previewResult, setPreviewResult] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)

  // ---------- Carregamento ----------
  const loadRegras = useCallback(async () => {
    if (!currentUser?.id) return
    setRegrasLoading(true)
    try {
      const records = await pb.collection('ia_regras').getFullList({
        filter: `user_id = "${currentUser.id}"`,
        sort: '-created',
      })
      if (records.length > 0) {
        const r = records[0] as any
        setRegrasId(r.id)
        setPromptSistema(r.prompt_sistema || DEFAULT_PROMPT_SISTEMA)
        setRegrasCorrecao(r.regras_correcao || DEFAULT_REGRAS_CORRECAO)
        setTermosProibidos(r.termos_proibidos || '')
        setTermosObrigatorios(r.termos_obrigatorios || '')
      }
    } catch (err) {
      console.error('Erro ao carregar regras da IA:', err)
      toast({
        title: 'Erro ao carregar',
        description: 'Não foi possível carregar as regras da IA.',
        variant: 'destructive',
      })
    } finally {
      setRegrasLoading(false)
    }
  }, [currentUser?.id, toast])

  const loadExemplos = useCallback(async () => {
    if (!currentUser?.id) return
    setExemplosLoading(true)
    try {
      const records = await pb.collection('ia_exemplos').getFullList({
        filter: `user_id = "${currentUser.id}"`,
        sort: 'ordem',
      })
      const rows: IaExemploRecord[] = records.map((r: any) => ({
        id: r.id,
        texto_original: r.texto_original || '',
        texto_corrigido: r.texto_corrigido || '',
        ordem: Number(r.ordem) || 0,
      }))
      setExemplos(rows)
    } catch (err) {
      console.error('Erro ao carregar exemplos da IA:', err)
      toast({
        title: 'Erro ao carregar',
        description: 'Não foi possível carregar os exemplos.',
        variant: 'destructive',
      })
    } finally {
      setExemplosLoading(false)
    }
  }, [currentUser?.id, toast])

  useEffect(() => {
    loadRegras()
    loadExemplos()
  }, [loadRegras, loadExemplos])

  // ---------- Salvar regras ----------
  const handleSaveRegras = async () => {
    if (!currentUser?.id) return
    setRegrasSaving(true)
    try {
      const payload = {
        user_id: currentUser.id,
        prompt_sistema: promptSistema.trim(),
        regras_correcao: regrasCorrecao.trim(),
        termos_proibidos: termosProibidos.trim(),
        termos_obrigatorios: termosObrigatorios.trim(),
      }
      if (regrasId) {
        await pb.collection('ia_regras').update(regrasId, payload)
      } else {
        const rec: any = await pb.collection('ia_regras').create(payload)
        setRegrasId(rec.id)
      }
      toast({
        title: 'Regras salvas',
        description: 'As regras de comportamento da IA foram atualizadas.',
      })
    } catch (err) {
      toast({
        title: 'Erro ao salvar',
        description: describeError(err),
        variant: 'destructive',
      })
    } finally {
      setRegrasSaving(false)
    }
  }

  // ---------- Exemplos ----------
  const openNewExemplo = () => {
    setExemploEditing(null)
    setExemploOriginal('')
    setExemploCorrigido('')
    setExemploOpen(true)
  }

  const openEditExemplo = (ex: IaExemploRecord) => {
    setExemploEditing(ex)
    setExemploOriginal(ex.texto_original)
    setExemploCorrigido(ex.texto_corrigido)
    setExemploOpen(true)
  }

  const handleSaveExemplo = async () => {
    if (!currentUser?.id) return
    if (!exemploOriginal.trim() || !exemploCorrigido.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha o texto original e o texto corrigido.',
        variant: 'destructive',
      })
      return
    }
    if (!exemploEditing && exemplos.length >= MAX_EXEMPLOS) {
      toast({
        title: 'Limite atingido',
        description: `Máximo de ${MAX_EXEMPLOS} exemplos.`,
        variant: 'destructive',
      })
      return
    }
    setExemploSaving(true)
    try {
      if (exemploEditing) {
        await pb.collection('ia_exemplos').update(exemploEditing.id, {
          texto_original: exemploOriginal.trim(),
          texto_corrigido: exemploCorrigido.trim(),
        })
        setExemplos((prev) =>
          prev.map((e) =>
            e.id === exemploEditing.id
              ? {
                  ...e,
                  texto_original: exemploOriginal.trim(),
                  texto_corrigido: exemploCorrigido.trim(),
                }
              : e,
          ),
        )
      } else {
        const nextOrdem = exemplos.length > 0 ? Math.max(...exemplos.map((e) => e.ordem)) + 1 : 0
        const rec: any = await pb.collection('ia_exemplos').create({
          user_id: currentUser.id,
          texto_original: exemploOriginal.trim(),
          texto_corrigido: exemploCorrigido.trim(),
          ordem: nextOrdem,
        })
        setExemplos((prev) => [
          ...prev,
          {
            id: rec.id,
            texto_original: exemploOriginal.trim(),
            texto_corrigido: exemploCorrigido.trim(),
            ordem: nextOrdem,
          },
        ])
      }
      setExemploOpen(false)
      toast({ title: 'Exemplo salvo', description: 'O exemplo foi adicionado à biblioteca.' })
    } catch (err) {
      toast({
        title: 'Erro ao salvar',
        description: describeError(err),
        variant: 'destructive',
      })
    } finally {
      setExemploSaving(false)
    }
  }

  const handleDeleteExemplo = async () => {
    if (!exemploDelete) return
    setExemploDeleting(true)
    try {
      await pb.collection('ia_exemplos').delete(exemploDelete.id)
      setExemplos((prev) => prev.filter((e) => e.id !== exemploDelete.id))
      toast({ title: 'Exemplo excluído' })
    } catch (err) {
      toast({
        title: 'Erro ao excluir',
        description: describeError(err),
        variant: 'destructive',
      })
    } finally {
      setExemploDeleting(false)
      setExemploDelete(null)
    }
  }

  // ---------- Pré-visualização (Testar Regras) ----------
  const handleTestarRegras = async () => {
    if (!previewText.trim()) {
      toast({
        title: 'Texto vazio',
        description: 'Digite um texto de teste para corrigir.',
        variant: 'destructive',
      })
      return
    }
    setPreviewLoading(true)
    setPreviewResult('')
    try {
      // Envia as regras/exemplos atuais (não salvos) no modo preview.
      const data = await pb.send('/backend/v1/ai/correct-text', {
        method: 'POST',
        body: {
          text: previewText.trim(),
          preview: true,
          prompt_sistema: promptSistema,
          regras_correcao: regrasCorrecao,
          termos_proibidos: termosProibidos,
          termos_obrigatorios: termosObrigatorios,
          exemplos: exemplos.map((e) => ({
            texto_original: e.texto_original,
            texto_corrigido: e.texto_corrigido,
          })),
        },
      })
      const corrected: string | undefined = data?.corrected?.trim()
      if (!corrected) throw new Error('Resposta vazia da IA.')
      setPreviewResult(corrected)
    } catch (err) {
      console.error('Erro ao testar regras:', err)
      toast({
        title: 'Erro na IA',
        description: 'Não foi possível corrigir o texto. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setPreviewLoading(false)
    }
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
            <Brain className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Editor de Regras da IA
            </h1>
            <p className="text-sm text-slate-500">
              Configure o comportamento da IA que corrige textos no prontuário
            </p>
          </div>
        </div>
        <Button
          onClick={() => {
            setPreviewResult('')
            setPreviewText('')
            setPreviewOpen(true)
          }}
          className="bg-navy-700 hover:bg-navy-800 text-white font-semibold rounded-xl shadow-sm flex items-center gap-2 h-10 px-5"
        >
          <Wand2 className="w-4 h-4" />
          Testar Regras
        </Button>
      </div>

      {/* Seção A: Regras de Comportamento */}
      <Card className="rounded-2xl border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-teal-600" />
            Regras de Comportamento
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Defina o papel, o tom e as instruções específicas que a IA seguirá ao corrigir os textos
            do prontuário.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {regrasLoading ? (
            <p className="text-xs text-slate-400 py-4 text-center">Carregando regras...</p>
          ) : (
            <>
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-700">Prompt do Sistema</Label>
                <Textarea
                  value={promptSistema}
                  onChange={(e) => setPromptSistema(e.target.value)}
                  placeholder="Ex.: Você é um fonoaudiólogo revisor de evoluções clínicas..."
                  rows={3}
                  className="rounded-xl text-sm border-slate-300 resize-y leading-relaxed"
                />
                <p className="text-[11px] text-slate-400">
                  Define o papel da IA — quem ela é e como deve se comportar.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-700">Regras de Correção</Label>
                <Textarea
                  value={regrasCorrecao}
                  onChange={(e) => setRegrasCorrecao(e.target.value)}
                  placeholder="Ex.: Use terminologia técnica de audiologia. Mantenha siglas: OD, OE, LRF, LDV, MT, IPRF..."
                  rows={4}
                  className="rounded-xl text-sm border-slate-300 resize-y leading-relaxed"
                />
                <p className="text-[11px] text-slate-400">
                  Instruções específicas de estilo, terminologia e formato.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-700">Termos Proibidos</Label>
                  <Input
                    value={termosProibidos}
                    onChange={(e) => setTermosProibidos(e.target.value)}
                    placeholder="gaguejar, problema, doente..."
                    className="h-10 rounded-xl text-sm border-slate-300"
                  />
                  <p className="text-[11px] text-slate-400">
                    Palavras/expressões que a IA NUNCA deve usar (separadas por vírgula).
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-700">
                    Termos Obrigatórios
                  </Label>
                  <Input
                    value={termosObrigatorios}
                    onChange={(e) => setTermosObrigatorios(e.target.value)}
                    placeholder="paciente, evolução, conduta..."
                    className="h-10 rounded-xl text-sm border-slate-300"
                  />
                  <p className="text-[11px] text-slate-400">
                    Palavras que a IA deve SEMPRE preferir (separadas por vírgula).
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-100">
                <Button
                  onClick={handleSaveRegras}
                  disabled={regrasSaving}
                  className="bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-xl shadow-sm flex items-center gap-2 h-10 px-5"
                >
                  <Save className="w-4 h-4" />
                  {regrasSaving ? 'Salvando...' : 'Salvar Regras'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Seção B: Biblioteca de Exemplos (Few-Shot) */}
      <Card className="rounded-2xl border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Brain className="w-5 h-5 text-teal-600" />
                Biblioteca de Exemplos (Few-Shot)
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Pares “Texto Original → Texto Corrigido” injetados no prompt para guiar a IA. Máximo
                de {MAX_EXEMPLOS} exemplos.
              </CardDescription>
            </div>
            <Button
              onClick={openNewExemplo}
              disabled={exemplos.length >= MAX_EXEMPLOS}
              className="bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-xl shadow-sm flex items-center gap-1.5 h-9"
            >
              <Plus className="w-4 h-4" />
              Adicionar Exemplo
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {exemplosLoading ? (
            <p className="text-xs text-slate-400 py-4 text-center">Carregando exemplos...</p>
          ) : exemplos.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center">
              <Brain className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500">
                Nenhum exemplo cadastrado. Adicione pares de correção para melhorar a qualidade da
                IA.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Badge className="text-[11px] font-semibold bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-50">
                  {exemplos.length} / {MAX_EXEMPLOS} exemplos
                </Badge>
              </div>
              <div className="space-y-3">
                {exemplos.map((ex, idx) => (
                  <div
                    key={ex.id}
                    className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Exemplo {idx + 1}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEditExemplo(ex)}
                          className="h-7 px-2 text-[11px] font-semibold text-slate-500 hover:bg-slate-100 rounded-lg"
                        >
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setExemploDelete(ex)}
                          className="h-7 w-7 p-0 text-red-500 hover:bg-red-50 rounded-lg"
                          title="Excluir exemplo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                          Texto Original
                        </p>
                        <p className="text-xs text-slate-700 bg-slate-50 rounded-lg p-2.5 whitespace-pre-wrap leading-relaxed border border-slate-100">
                          {ex.texto_original}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-teal-600 mb-1">
                          Texto Corrigido
                        </p>
                        <p className="text-xs text-slate-700 bg-teal-50/40 rounded-lg p-2.5 whitespace-pre-wrap leading-relaxed border border-teal-100">
                          {ex.texto_corrigido}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal: Adicionar/Editar Exemplo */}
      <Dialog open={exemploOpen} onOpenChange={setExemploOpen}>
        <DialogContent className="max-w-3xl w-full max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
          <DialogHeader className="border-b border-slate-100 pb-3">
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Brain className="w-5 h-5 text-teal-600" />
              <span>{exemploEditing ? 'Editar Exemplo' : 'Adicionar Exemplo'}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-700">
                Texto Original <span className="text-red-500">*</span>
              </Label>
              <Textarea
                value={exemploOriginal}
                onChange={(e) => setExemploOriginal(e.target.value)}
                placeholder="Digite o texto original (antes da correção)..."
                rows={4}
                className="rounded-xl text-sm border-slate-300 resize-y leading-relaxed"
              />
            </div>
            <div className="flex justify-center">
              <ArrowRight className="w-5 h-5 text-slate-300" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-700">
                Texto Corrigido <span className="text-red-500">*</span>
              </Label>
              <Textarea
                value={exemploCorrigido}
                onChange={(e) => setExemploCorrigido(e.target.value)}
                placeholder="Digite o texto corrigido (resultado esperado)..."
                rows={4}
                className="rounded-xl text-sm border-slate-300 resize-y leading-relaxed"
              />
            </div>
          </div>
          <DialogFooter className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setExemploOpen(false)}
              className="rounded-xl border-slate-300 text-xs font-semibold h-10"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSaveExemplo}
              disabled={exemploSaving}
              className="bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-xl h-10 flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              {exemploSaving ? 'Salvando...' : 'Salvar Exemplo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão de exemplo */}
      <Dialog open={!!exemploDelete} onOpenChange={(o) => !o && setExemploDelete(null)}>
        <DialogContent className="max-w-md w-full rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
          <DialogHeader className="border-b border-slate-100 pb-3">
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <span>Excluir exemplo?</span>
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-slate-600 pt-2">
            Deseja realmente remover este exemplo da biblioteca? Esta ação não pode ser desfeita.
          </p>
          <DialogFooter className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setExemploDelete(null)}
              className="rounded-xl border-slate-300 text-xs font-semibold h-10"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleDeleteExemplo}
              disabled={exemploDeleting}
              className="bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl h-10 flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              {exemploDeleting ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Pré-visualização (Testar Regras) */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl w-full max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
          <DialogHeader className="border-b border-slate-100 pb-3">
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-teal-600" />
              <span>Testar Regras</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="rounded-lg bg-blue-50/60 border border-blue-100 px-3 py-2">
              <p className="text-[11px] text-blue-700 leading-relaxed">
                A correção usará as regras e exemplos <strong>atuais</strong> (mesmo os não salvos).
                Ajuste os campos acima e teste novamente para refinar o resultado.
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-700">Texto de teste</Label>
              <Textarea
                value={previewText}
                onChange={(e) => setPreviewText(e.target.value)}
                placeholder="Digite ou cole um texto de evolução clínica para testar a correção..."
                rows={5}
                className="rounded-xl text-sm border-slate-300 resize-y leading-relaxed"
              />
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                onClick={handleTestarRegras}
                disabled={previewLoading || !previewText.trim()}
                className="bg-navy-700 hover:bg-navy-800 text-white font-semibold rounded-xl h-10 flex items-center gap-1.5"
              >
                {previewLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Corrigindo...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Corrigir
                  </>
                )}
              </Button>
            </div>
            {previewResult && (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <Label className="text-xs font-semibold text-teal-700">Texto corrigido</Label>
                <div className="rounded-xl border border-teal-100 bg-teal-50/40 p-3">
                  <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                    {previewResult}
                  </p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
