'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { RelayPayLogo } from '@/components/RelayPayLogo'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setIsLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.message)
      setIsLoading(false)
      return
    }

    router.push('/admin/login?reset=1')
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4" style={{ backgroundColor: '#F7F8FA' }}>
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <RelayPayLogo size="lg" />
        </div>
        <div className="rounded-2xl border bg-white px-8 py-8 shadow-sm" style={{ borderColor: '#E5E7EB' }}>
          <div className="mb-6">
            <h1 className="text-base font-semibold" style={{ color: '#111827' }}>Set New Password</h1>
            <p className="mt-0.5 text-xs" style={{ color: '#6B7280' }}>
              Choose a new password for your account.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <PasswordField
              label="New Password"
              value={password}
              onChange={setPassword}
              show={showPw}
              onToggle={() => setShowPw((p) => !p)}
            />
            <PasswordField
              label="Confirm Password"
              value={confirm}
              onChange={setConfirm}
              show={showPw}
              onToggle={() => setShowPw((p) => !p)}
            />
            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs" style={{ color: '#DC2626' }}>
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium text-white hover:bg-[#162F63] transition-colors disabled:opacity-60"
              style={{ backgroundColor: '#1B3A7A' }}
            >
              {isLoading && <Loader2 size={14} className="animate-spin" />}
              {isLoading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

function PasswordField({
  label,
  value,
  onChange,
  show,
  onToggle,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  show: boolean
  onToggle: () => void
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium" style={{ color: '#374151' }}>{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          placeholder="••••••••"
          className="w-full rounded-lg border px-3 py-2.5 pr-10 text-sm outline-none focus:border-[#29ABE2]"
          style={{ borderColor: '#E5E7EB' }}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2"
        >
          {show
            ? <EyeOff size={14} style={{ color: '#9CA3AF' }} />
            : <Eye size={14} style={{ color: '#9CA3AF' }} />
          }
        </button>
      </div>
    </div>
  )
}
