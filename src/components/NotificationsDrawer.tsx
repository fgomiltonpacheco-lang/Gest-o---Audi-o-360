import React, { useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useApp } from '@/context/AppContext'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Clock, PackageX, CreditCard, ChevronRight, ShieldAlert } from 'lucide-react'

interface NotificationsDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({ open, onOpenChange }) => {
  const { alerts } = useApp()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<'all' | 'warranty' | 'installment' | 'stock' | 'followup'>(
    'all',
  )

  const filteredAlerts = alerts.filter((a) => {
    if (filter === 'all') return true
    return a.type === filter
  })

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'warranty':
        return <ShieldAlert className="w-5 h-5 text-amber-600" />
      case 'installment':
        return <CreditCard className="w-5 h-5 text-red-600" />
      case 'stock':
        return <PackageX className="w-5 h-5 text-orange-600" />
      case 'followup':
        return <Clock className="w-5 h-5 text-blue-600" />
      default:
        return <AlertTriangle className="w-5 h-5 text-slate-600" />
    }
  }

  const handleNavigate = (url: string) => {
    onOpenChange(false)
    navigate(url)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col bg-slate-50">
        <SheetHeader className="p-6 bg-white border-b border-slate-200">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span>Central de Alertas</span>
              <Badge variant="destructive" className="ml-1 px-2 py-0.5 text-xs font-semibold">
                {alerts.length}
              </Badge>
            </SheetTitle>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Notificações operacionais, vencimentos e pendências clínicas
          </p>

          {/* Filtros rápidos */}
          <div className="flex items-center gap-1.5 mt-4 overflow-x-auto pb-1">
            <button
              onClick={() => setFilter('all')}
              className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todos ({alerts.length})
            </button>
            <button
              onClick={() => setFilter('warranty')}
              className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                filter === 'warranty'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Garantias
            </button>
            <button
              onClick={() => setFilter('installment')}
              className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                filter === 'installment'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Parcelas
            </button>
            <button
              onClick={() => setFilter('stock')}
              className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                filter === 'stock'
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Estoque
            </button>
            <button
              onClick={() => setFilter('followup')}
              className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                filter === 'followup'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Follow-ups
            </button>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredAlerts.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-semibold text-slate-800">Tudo em dia!</h4>
              <p className="text-xs text-slate-500 mt-1">
                Nenhum alerta pendente nesta categoria no momento.
              </p>
            </div>
          ) : (
            filteredAlerts.map((alert) => (
              <div
                key={alert.id}
                onClick={() => handleNavigate(alert.linkUrl)}
                className="group relative bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      alert.severity === 'danger'
                        ? 'bg-red-50 border border-red-100'
                        : alert.severity === 'warning'
                          ? 'bg-amber-50 border border-amber-100'
                          : 'bg-blue-50 border border-blue-100'
                    }`}
                  >
                    {getAlertIcon(alert.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h5 className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                        {alert.title}
                      </h5>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </div>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed line-clamp-2">
                      {alert.description}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 bg-white border-t border-slate-200">
          <Button
            variant="outline"
            className="w-full text-xs font-semibold text-blue-600 border-blue-200 hover:bg-blue-50"
            onClick={() => handleNavigate('/relatorios')}
          >
            Ver Relatórios Completos
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
