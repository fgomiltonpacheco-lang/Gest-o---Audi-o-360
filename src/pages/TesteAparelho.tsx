import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Ear, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Página de "Teste com Aparelho Auditivo".
 *
 * Módulo em desenvolvimento. Esta página existe para que a rota
 * `/pacientes/:id/teste-aparelho/:examId?` (registrada em `App.tsx`) tenha um
 * alvo válido de importação, mantendo o build íntegro.
 */
export default function TesteAparelho() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center shadow-sm ring-4 ring-teal-50 shrink-0">
            <Ear className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-slate-900 tracking-tight leading-tight">
              Teste com Aparelho Auditivo
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">Módulo em desenvolvimento</p>
          </div>
        </div>

        {id && (
          <Button
            variant="ghost"
            onClick={() => navigate(`/pacientes/${id}/prontuario`)}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl self-start sm:self-auto"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Voltar ao Prontuário
          </Button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 text-center">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <Ear className="w-8 h-8 text-slate-400" />
        </div>
        <h2 className="text-lg font-bold text-slate-700">Módulo em desenvolvimento</h2>
        <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
          A tela de Teste com Aparelho Auditivo está em desenvolvimento e estará disponível em
          breve. Por enquanto, utilize a seção “Teste com Aparelho” dentro da aba{' '}
          <strong>Aparelhos</strong> do prontuário do paciente.
        </p>
      </div>
    </div>
  )
}
