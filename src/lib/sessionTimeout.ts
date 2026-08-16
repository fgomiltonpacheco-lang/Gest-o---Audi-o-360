// src/lib/sessionTimeout.ts
// Hook de timeout de sessão por inatividade.
import { useEffect, useRef, useCallback } from 'react'

interface UseSessionTimeoutOptions {
  /** Minutos de inatividade até a expiração. */
  timeoutMinutes: number
  /** Segundos antes de expirar para disparar o aviso (warning). */
  warningSeconds: number
  /** Callback disparado quando o aviso começa (contagem regressiva). */
  onWarning?: () => void
  /** Callback disparado quando a sessão expira. */
  onExpire: () => void
  /** Desabilita o monitoramento (ex: formulário sujo, impressão, download). */
  isDisabled?: boolean
}

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'click',
  'scroll',
  'keydown',
  'mousemove',
  'touchstart',
]

/**
 * Monitora a inatividade do usuário. Quando o tempo de inatividade atinge
 * `timeoutMinutes - warningSeconds/60`, dispara `onWarning`. Quando atinge
 * `timeoutMinutes`, dispara `onExpire`.
 *
 * Respeita `isDisabled`: quando true, todo o monitoramento é pausado
 * (ex: durante formulário sujo, impressão de PDF ou download).
 */
export function useSessionTimeout({
  timeoutMinutes,
  warningSeconds,
  onWarning,
  onExpire,
  isDisabled = false,
}: UseSessionTimeoutOptions): void {
  // Refs para manter os timers e estados sem recriar listeners.
  const expireTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warnedRef = useRef(false)
  const onWarningRef = useRef(onWarning)
  const onExpireRef = useRef(onExpire)
  const isDisabledRef = useRef(isDisabled)

  // Mantém refs atualizadas com os últimos callbacks sem reiniciar timers.
  useEffect(() => {
    onWarningRef.current = onWarning
    onExpireRef.current = onExpire
  }, [onWarning, onExpire])

  useEffect(() => {
    isDisabledRef.current = isDisabled
  }, [isDisabled])

  const clearTimers = useCallback(() => {
    if (expireTimerRef.current) {
      clearTimeout(expireTimerRef.current)
      expireTimerRef.current = null
    }
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current)
      warningTimerRef.current = null
    }
  }, [])

  const schedule = useCallback(() => {
    clearTimers()
    warnedRef.current = false

    const totalMs = Math.max(1, timeoutMinutes) * 60 * 1000
    const warnMs = Math.max(0, totalMs - Math.max(0, warningSeconds) * 1000)

    // Timer de aviso (dispara antes da expiração).
    if (warnMs > 0) {
      warningTimerRef.current = setTimeout(() => {
        if (isDisabledRef.current) return
        warnedRef.current = true
        onWarningRef.current?.()
      }, warnMs)
    }

    // Timer de expiração.
    expireTimerRef.current = setTimeout(() => {
      if (isDisabledRef.current) return
      onExpireRef.current?.()
    }, totalMs)
  }, [timeoutMinutes, warningSeconds, clearTimers])

  // Reinicia os timers a qualquer atividade do usuário.
  const resetOnActivity = useCallback(() => {
    if (isDisabledRef.current) return
    // Se já estamos em aviso, a atividade do usuário cancela o aviso e reinicia.
    schedule()
  }, [schedule])

  useEffect(() => {
    if (timeoutMinutes <= 0) {
      clearTimers()
      return
    }

    // Registra listeners de atividade.
    ACTIVITY_EVENTS.forEach((evt) => {
      window.addEventListener(evt, resetOnActivity, { passive: true })
    })

    // Agenda inicial.
    schedule()

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => {
        window.removeEventListener(evt, resetOnActivity)
      })
      clearTimers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeoutMinutes, warningSeconds, isDisabled, schedule, clearTimers])
}
