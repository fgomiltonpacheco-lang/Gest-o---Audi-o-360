// src/components/SessionTimeoutModal.tsx
// Modal de aviso de expiração de sessão com contagem regressiva.
import React, { useEffect, useState, useCallback } from 'react'
import { Clock, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface SessionTimeoutModalProps {
  open: boolean
  /** Segundos restantes quando o modal abre. */
  initialSeconds: number
  onContinue: () => void
  onExpire: () => void
}

export const SessionTimeoutModal: React.FC<SessionTimeoutModalProps> = ({
  open,
  initialSeconds,
  onContinue,
  onExpire,
}) => {
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds)

  useEffect(() => {
    if (!open) return
    setSecondsLeft(initialSeconds)
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(id)
          onExpire()
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [open, initialSeconds, onExpire])

  const handleContinue = useCallback(() => {
    onContinue()
  }, [onContinue])

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-amber-200">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Sessão expirando
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 mt-1">
            Por segurança, sua sessão será encerrada por inatividade.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center py-4">
          <div className="relative flex items-center justify-center">
            <Clock
              className={`w-16 h-16 ${secondsLeft <= 10 ? 'text-red-500' : 'text-amber-500'}`}
            />
          </div>
          <p className="mt-3 text-center text-sm text-slate-700">
            Sua sessão está expirando em{' '}
            <span className="font-bold text-slate-900">{secondsLeft}</span> segundos.
          </p>
        </div>

        <DialogFooter>
          <Button
            onClick={handleContinue}
            className="w-full bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-xl h-10"
          >
            Continuar conectado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default SessionTimeoutModal
