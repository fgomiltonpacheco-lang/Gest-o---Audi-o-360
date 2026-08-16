// src/pages/AlterarSenha.tsx
// Página de troca de senha com validação de política em tempo real.
import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '@/context/AppContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordChecklist } from '@/components/PasswordChecklist'
import { Lock, Eye, EyeOff, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react'
import { validatePassword } from '@/lib/passwordPolicy'

export default function AlterarSenha() {
  const { changePassword, securitySettings } = useApp()
  const navigate = useNavigate()

  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const minLen = securitySettings?.password_min_length || 8
  const validation = useMemo(() => validatePassword(newPassword, minLen), [newPassword, minLen])
  const passwordsMatch = newPassword !== '' && newPassword === confirmPassword
  const canSubmit = validation.valid && passwordsMatch && oldPassword.length > 0 && !loading

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!oldPassword) {
      setError('Informe sua senha atual.')
      return
    }
    if (!validation.valid) {
      setError(validation.errors.join(' '))
      return
    }
    if (!passwordsMatch) {
      setError('A nova senha e a confirmação não conferem.')
      return
    }
    setLoading(true)
    const res = await changePassword(oldPassword, newPassword)
    setLoading(false)
    if (res.success) {
      setSuccess(true)
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => navigate('/'), 2000)
    } else {
      setError(res.message || 'Não foi possível alterar a senha.')
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-teal-600 mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Voltar
      </button>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center">
            <Lock className="w-5 h-5 text-teal-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Alterar senha</h1>
            <p className="text-xs text-slate-500">
              Defina uma senha forte seguindo a política de segurança.
            </p>
          </div>
        </div>

        {success ? (
          <div className="flex flex-col items-center py-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-3" />
            <p className="text-sm font-semibold text-slate-900">Senha alterada com sucesso!</p>
            <p className="text-xs text-slate-500 mt-1">Redirecionando...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Senha atual */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Senha atual <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <Input
                  type={showOld ? 'text' : 'password'}
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="h-11 pl-10 pr-10 rounded-xl border-slate-300 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowOld((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  {showOld ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Nova senha */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Nova senha <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <Input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="h-11 pl-10 pr-10 rounded-xl border-slate-300 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Checklist em tempo real */}
            <PasswordChecklist password={newPassword} minLength={minLen} />

            {/* Confirmar nova senha */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Confirmar nova senha <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <Input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className={`h-11 pl-10 pr-10 rounded-xl border-slate-300 text-sm ${
                    confirmPassword
                      ? passwordsMatch
                        ? 'border-emerald-300 focus:border-emerald-500'
                        : 'border-red-300 focus:border-red-500'
                      : ''
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmPassword && !passwordsMatch && (
                <p className="text-[11px] text-red-500 mt-1">As senhas não conferem.</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={!canSubmit}
              className="w-full h-11 bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-xl shadow-md"
            >
              {loading ? 'Alterando...' : 'Alterar senha'}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
