import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { FileText, Clock } from 'lucide-react'

export const NotasFiscaisPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <FileText className="w-7 h-7 text-teal-600" />
            Notas Fiscais
          </h1>
          <p className="text-sm text-slate-500">
            Gerenciamento e emissão de notas fiscais eletrônicas
          </p>
        </div>
      </div>

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-full bg-teal-50 flex items-center justify-center mb-4 text-teal-600">
            <Clock className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Em breve</h2>
          <p className="text-sm text-slate-500 max-w-md">
            O módulo de gestão e consulta de Notas Fiscais está sendo preparado e estará disponível
            em breve.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default NotasFiscaisPage
