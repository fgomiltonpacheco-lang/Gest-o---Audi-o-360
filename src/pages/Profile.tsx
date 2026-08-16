import React, { useRef, useState } from 'react'
import { useApp } from '@/context/AppContext'
import { getInitials, getAvatarColor, getAvatarUrl } from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import {
  User,
  Mail,
  IdCard,
  Lock,
  Eye,
  EyeOff,
  Save,
  ShieldCheck,
  Camera,
  Loader2,
} from 'lucide-react'

const MAX_AVATAR_SIZE = 2 * 1024 * 1024 // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export default function Profile() {
  const { currentUser, updateProfile, uploadAvatar } = useApp()
  const { toast } = useToast()

  const [name, setName] = useState(currentUser?.name || '')
  const [crfa, setCrfa] = useState(currentUser?.crmCrfa || '')
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [saving, setSaving] = useState(false)

  // Avatar: preview local instantâneo + flag de upload em andamento
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // URL atual do avatar (preferindo o preview local recém-selecionado)
  const liveAvatarUrl = avatarPreview ?? getAvatarUrl(currentUser)

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // limpa o input para permitir re-selecionar o mesmo arquivo
    e.target.value = ''
    if (!file) return

    // Validação de tipo
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast({
        title: 'Formato inválido',
        description: 'Selecione uma imagem JPG, PNG ou WebP.',
        variant: 'destructive',
      })
      return
    }
    // Validação de tamanho
    if (file.size > MAX_AVATAR_SIZE) {
      toast({
        title: 'Arquivo muito grande',
        description: 'A imagem deve ter no máximo 2MB.',
        variant: 'destructive',
      })
      return
    }

    // Preview instantâneo (antes de salvar)
    const previewUrl = URL.createObjectURL(file)
    setAvatarPreview(previewUrl)

    // Faz o upload imediatamente
    setUploadingAvatar(true)
    const result = await uploadAvatar(file)
    setUploadingAvatar(false)

    if (result.success) {
      toast({
        title: 'Foto atualizada',
        description: 'Sua foto de perfil foi salva com sucesso.',
      })
      // descarta o preview local — o currentUser atualizado agora fornece a URL real
      setAvatarPreview(null)
    } else {
      toast({
        title: 'Erro ao enviar foto',
        description: result.message || 'Não foi possível salvar a foto de perfil.',
        variant: 'destructive',
      })
      // reverte o preview em caso de falha
      setAvatarPreview(null)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast({
        title: 'Campo obrigatório',
        description: 'O nome completo não pode estar vazio.',
        variant: 'destructive',
      })
      return
    }

    // Se preencheu nova senha, a senha atual é obrigatória
    if (newPassword && !oldPassword) {
      toast({
        title: 'Senha atual obrigatória',
        description: 'Para alterar a senha, informe sua senha atual.',
        variant: 'destructive',
      })
      return
    }

    if (newPassword && newPassword !== confirmPassword) {
      toast({
        title: 'Senhas não conferem',
        description: 'A nova senha e a confirmação devem ser iguais.',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    // O avatar NÃO é enviado aqui — somente nome/CRFa/senha.
    // Isso garante que trocar a senha sem selecionar nova imagem não apague a foto.
    const result = await updateProfile({
      name,
      crmCrfa: crfa,
      oldPassword: oldPassword || undefined,
      newPassword: newPassword || undefined,
      passwordConfirm: confirmPassword || undefined,
    })
    setSaving(false)

    if (result.success) {
      toast({
        title: 'Perfil atualizado com sucesso',
        description: 'Suas informações foram salvas no servidor.',
      })
      // Limpa campos de senha após sucesso
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } else {
      toast({
        title: 'Erro ao atualizar perfil',
        description: result.message || 'Não foi possível salvar as alterações.',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Editar Perfil
        </h1>
        <p className="text-sm text-slate-500">
          Gerencie suas informações profissionais e credenciais de acesso
        </p>
      </div>

      <div className="flex justify-center">
        <Card className="w-full max-w-2xl rounded-2xl border-slate-200 shadow-sm">
          {/* Avatar com upload */}
          <CardHeader className="flex flex-col items-center gap-3 pb-2">
            <div className="relative group/avatar">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                title="Alterar foto de perfil"
                aria-label="Alterar foto de perfil"
                className="relative w-24 h-24 rounded-full overflow-hidden shadow-md ring-4 ring-teal-500/15 transition-all duration-150 hover:opacity-90 focus:outline-none focus:ring-4 focus:ring-teal-500/30 disabled:cursor-wait"
              >
                {liveAvatarUrl ? (
                  <img
                    src={liveAvatarUrl}
                    alt={currentUser?.name || 'Avatar'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className={`w-full h-full ${getAvatarColor(
                      currentUser?.name || 'Admin',
                    )} text-white flex items-center justify-center font-bold text-3xl`}
                  >
                    {getInitials(currentUser?.name || 'Audição360')}
                  </div>
                )}
                {/* Overlay sutil no hover */}
                <span className="absolute inset-0 bg-black/0 group-hover/avatar:bg-black/10 transition-colors" />
              </button>

              {/* Botão de câmera sobreposto no canto inferior direito */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                title="Alterar foto de perfil"
                aria-label="Alterar foto de perfil"
                className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-[#00A6A6] hover:bg-[#008c8c] text-white flex items-center justify-center shadow-lg ring-2 ring-white transition-colors disabled:opacity-60 disabled:cursor-wait"
              >
                {uploadingAvatar ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
              </button>

              {/* Input de arquivo invisível */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>
            <div className="text-center">
              <CardTitle className="text-lg font-bold text-slate-900">
                {currentUser?.name || 'Administrador'}
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                {currentUser?.email || 'admin@audicao360.com.br'}
              </CardDescription>
              <p className="text-[11px] text-slate-400 mt-1">
                Clique na foto para enviar uma imagem (JPG, PNG ou WebP — máx. 2MB)
              </p>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSave} className="space-y-5">
              {/* Nome completo */}
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-semibold text-slate-700">
                  Nome completo <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome completo"
                    required
                    className="h-11 pl-10 rounded-xl border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 text-sm"
                  />
                </div>
              </div>

              {/* E-mail (somente leitura) */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold text-slate-700">
                  E-mail <span className="font-normal text-slate-400">(somente leitura)</span>
                </Label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <Input
                    id="email"
                    type="email"
                    value={currentUser?.email || ''}
                    readOnly
                    disabled
                    className="h-11 pl-10 rounded-xl border-slate-200 bg-slate-50 text-slate-500 text-sm cursor-not-allowed"
                  />
                </div>
              </div>

              {/* CRFa */}
              <div className="space-y-1.5">
                <Label htmlFor="crfa" className="text-xs font-semibold text-slate-700">
                  CRFa{' '}
                  <span className="font-normal text-slate-400">
                    (opcional — registro no conselho)
                  </span>
                </Label>
                <div className="relative">
                  <IdCard className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <Input
                    id="crfa"
                    type="text"
                    value={crfa}
                    onChange={(e) => setCrfa(e.target.value)}
                    placeholder="Ex.: 2-12345"
                    className="h-11 pl-10 rounded-xl border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 text-sm"
                  />
                </div>
              </div>

              {/* Separador: Alteração de senha */}
              <div className="pt-2">
                <div className="flex items-center gap-2 mb-1">
                  <ShieldCheck className="w-4 h-4 text-teal-600" />
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Segurança
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Preencha os campos abaixo apenas se desejar alterar sua senha de acesso.
                </p>
              </div>

              {/* Senha atual */}
              <div className="space-y-1.5">
                <Label htmlFor="oldPassword" className="text-xs font-semibold text-slate-700">
                  Senha atual{' '}
                  <span className="font-normal text-slate-400">
                    (obrigatória para alterar a senha)
                  </span>
                </Label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <Input
                    id="oldPassword"
                    type={showOld ? 'text' : 'password'}
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-11 pl-10 pr-10 rounded-xl border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOld(!showOld)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    aria-label="Alternar visualização da senha"
                  >
                    {showOld ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Nova senha & Confirmar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="newPassword" className="text-xs font-semibold text-slate-700">
                    Nova senha <span className="font-normal text-slate-400">(opcional)</span>
                  </Label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <Input
                      id="newPassword"
                      type={showNew ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="h-11 pl-10 pr-10 rounded-xl border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew(!showNew)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                      aria-label="Alternar visualização da senha"
                    >
                      {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword" className="text-xs font-semibold text-slate-700">
                    Confirmar nova senha{' '}
                    <span className="font-normal text-slate-400">(opcional)</span>
                  </Label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <Input
                      id="confirmPassword"
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="h-11 pl-10 pr-10 rounded-xl border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                      aria-label="Alternar visualização da senha"
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Botão Salvar */}
              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={saving}
                  className="w-full h-11 bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-150 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Salvar Alterações</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
