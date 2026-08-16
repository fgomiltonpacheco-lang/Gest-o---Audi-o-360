// src/components/TwoFactorSetup.tsx
// Wizard de configuração de 2FA (TOTP): QR code, verificação e backup codes.
import React, { useEffect, useRef, useState, useCallback } from 'react'
import QRCode from 'qrcode'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ShieldCheck, QrCode, KeyRound, Copy, Check, AlertTriangle, ArrowRight } from 'lucide-react'
import {
  generateSecret,
  generateQrCodeUrl,
  verifyToken,
  generateBackupCodes,
  hashBackupCode,
} from '@/lib/twoFactor'
import { useToast } from '@/hooks/use-toast'

interface TwoFactorSetupProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** E-mail do usuário (para o QR code). */
  email: string
  /** Callback ao concluir: recebe { secret, backupCodes (hashes) }. */
  onComplete: (data: { secret: string; backupCodesHashed: string[] }) => Promise<void> | void
}

type Step = 'qr' | 'verify' | 'backup'

export const TwoFactorSetup: React.FC<TwoFactorSetupProps> = ({
  open,
  onOpenChange,
  email,
  onComplete,
}) => {
  const { toast } = useToast()
  const [step, setStep] = useState<Step>('qr')
  const [secret, setSecret] = useState('')
  const [token, setToken] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Gera um novo segredo toda vez que o modal abre.
  useEffect(() => {
    if (open) {
      const s = generateSecret()
      setSecret(s)
      setStep('qr')
      setToken('')
      setError('')
      setBackupCodes([])
      setCopied(false)
    }
  }, [open])

  // Renderiza o QR code no canvas.
  useEffect(() => {
    if (!open || step !== 'qr' || !secret || !canvasRef.current) return
    const uri = generateQrCodeUrl(secret, email)
    QRCode.toCanvas(canvasRef.current, uri, { width: 220, margin: 1 }, (err) => {
      if (err) {
        console.error('Erro ao gerar QR code:', err)
      }
    })
  }, [open, step, secret, email])

  const handleVerify = useCallback(async () => {
    setError('')
    if (!/^\d{6}$/.test(token.trim())) {
      setError('Digite o código de 6 dígitos.')
      return
    }
    setVerifying(true)
    // Pequeno delay para feedback visual.
    await new Promise((r) => setTimeout(r, 200))
    const ok = verifyToken(secret, token.trim())
    setVerifying(false)
    if (!ok) {
      setError('Código inválido. Verifique o app autenticador e tente novamente.')
      return
    }
    // Gera os backup codes e avança.
    const codes = generateBackupCodes(10)
    setBackupCodes(codes)
    setStep('backup')
  }, [secret, token])

  const handleCopyAll = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(backupCodes.join('\n'))
      setCopied(true)
      toast({ title: 'Códigos copiados', description: 'Cole em um local seguro.' })
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast({ title: 'Não foi possível copiar', variant: 'destructive' })
    }
  }, [backupCodes, toast])

  const handleFinish = useCallback(async () => {
    setFinishing(true)
    try {
      const hashed = await Promise.all(backupCodes.map((c) => hashBackupCode(c)))
      await onComplete({ secret, backupCodesHashed: hashed })
      onOpenChange(false)
    } catch (e) {
      console.error('Erro ao finalizar 2FA:', e)
      setError('Não foi possível ativar o 2FA. Tente novamente.')
    } finally {
      setFinishing(false)
    }
  }, [backupCodes, secret, onComplete, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
        <DialogHeader className="border-b border-slate-100 pb-3">
          <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-teal-600" />
            Configurar autenticação de dois fatores
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 mt-1">
            {step === 'qr' && 'Etapa 1 de 3 — Leia o QR code com seu app autenticador.'}
            {step === 'verify' && 'Etapa 2 de 3 — Digite o código gerado pelo app.'}
            {step === 'backup' && 'Etapa 3 de 3 — Guarde seus códigos de backup.'}
          </DialogDescription>
        </DialogHeader>

        {/* STEP 1: QR CODE */}
        {step === 'qr' && (
          <div className="py-4 space-y-4">
            <div className="flex flex-col items-center">
              <div className="rounded-xl border border-slate-200 p-2 bg-white">
                <canvas ref={canvasRef} />
              </div>
              <p className="text-[11px] text-slate-500 mt-2 text-center max-w-[280px]">
                Use o Google Authenticator, Authy ou 1Password. Se não conseguir ler o QR code,
                digite a chave abaixo manualmente.
              </p>
            </div>
            <div>
              <Label className="text-[11px] font-semibold text-slate-600">Chave manual</Label>
              <div className="mt-1 flex items-center gap-2">
                <Input
                  readOnly
                  value={secret}
                  className="h-9 rounded-lg font-mono text-xs border-slate-300 bg-slate-50"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-lg"
                  onClick={() => {
                    navigator.clipboard?.writeText(secret)
                    toast({ title: 'Chave copiada' })
                  }}
                >
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: VERIFY */}
        {step === 'verify' && (
          <div className="py-4 space-y-4">
            <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 rounded-lg p-3">
              <KeyRound className="w-4 h-4 text-slate-400 shrink-0" />
              <span>Digite o código de 6 dígitos exibido no seu app autenticador.</span>
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700">Código de verificação</Label>
              <Input
                value={token}
                onChange={(e) => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                inputMode="numeric"
                autoFocus
                className="h-11 rounded-xl mt-1 text-center text-lg tracking-[0.4em] font-mono border-slate-300"
              />
            </div>
            {error && (
              <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: BACKUP CODES */}
        {step === 'backup' && (
          <div className="py-4 space-y-4">
            <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Guarde estes códigos em local seguro. Cada um pode ser usado uma única vez para
                entrar se você perder o acesso ao app autenticador.
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              {backupCodes.map((c) => (
                <code
                  key={c}
                  className="text-center font-mono text-sm font-bold text-slate-800 py-1 bg-white rounded-md border border-slate-200"
                >
                  {c}
                </code>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-xl h-9 text-xs"
              onClick={handleCopyAll}
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 mr-1.5" />
              ) : (
                <Copy className="w-3.5 h-3.5 mr-1.5" />
              )}
              {copied ? 'Copiado!' : 'Copiar todos'}
            </Button>
          </div>
        )}

        <DialogFooter className="pt-3 border-t border-slate-100">
          {step === 'qr' && (
            <Button
              onClick={() => setStep('verify')}
              className="w-full bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-xl h-10 flex items-center gap-2"
            >
              Já escaneiei o código
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}
          {step === 'verify' && (
            <div className="flex gap-2 w-full">
              <Button
                variant="outline"
                onClick={() => setStep('qr')}
                className="rounded-xl border-slate-300 text-xs h-10"
              >
                Voltar
              </Button>
              <Button
                onClick={handleVerify}
                disabled={verifying || token.length !== 6}
                className="flex-1 bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-xl h-10"
              >
                {verifying ? 'Verificando...' : 'Verificar código'}
              </Button>
            </div>
          )}
          {step === 'backup' && (
            <Button
              onClick={handleFinish}
              disabled={finishing}
              className="w-full bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-xl h-10"
            >
              {finishing ? 'Ativando...' : 'Ativar 2FA e concluir'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default TwoFactorSetup
