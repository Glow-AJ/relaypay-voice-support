'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { RelayPayLogo } from '@/components/RelayPayLogo'
import { Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react'

export default function AcceptInvitePage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [isReady, setIsReady] = useState(false)
  const [agentEmail, setAgentEmail] = useState('')
  const [invalidInvite, setInvalidInvite] = useState(false)

  useEffect(() => {
    // Supabase automatically processes the magic-link token from the URL hash.
    // We just need to wait for the auth state to resolve.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setAgentEmail(session.user.email ?? '')
        setIsReady(true)
      } else if (event === 'INITIAL_SESSION' && !session) {
        // No session — the link is invalid or expired
        setInvalidInvite(true)
        setIsReady(true)
      }
    })

    // Fallback: if the auth event never fires (already resolved), check directly
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setAgentEmail(session.user.email ?? '')
        setIsReady(true)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

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

    const { data: { user } } = await supabase.auth.getUser()
    if (user?.email) {
      await supabase
        .from('agents')
        .update({ user_id: user.id, invite_status: 'accepted' })
        .eq('email', user.email)
    }

    router.push('/agent')
  }

  // Show spinner while auth resolves (usually <1 second)
  if (!isReady) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4" style={{ backgroundColor: '#F7F8FA' }}>
        <div className="w-full max-w-sm">
          <div className="mb-8 flex justify-center">
            <RelayPayLogo size="lg" />
          </div>
          <div className="rounded-2xl border bg-white px-8 py-10 shadow-sm text-center" style={{ borderColor: '#E5E7EB' }}>
            <Loader2 size={24} className="animate-spin mx-auto mb-4" style={{ color: '#9CA3AF' }} />
            <p className="text-sm" style={{ color: '#6B7280' }}>Setting up your account…</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4" style={{ backgroundColor: '#F7F8FA' }}>
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <RelayPayLogo size="lg" />
        </div>
        <div className="rounded-2xl border bg-white px-8 py-8 shadow-sm" style={{ borderColor: '#E5E7EB' }}>
          {invalidInvite ? (
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 mb-4">
                <AlertCircle size={24} className="text-red-600" />
              </div>
              <h1 className="text-base font-semibold text-gray-900">Invite link expired</h1>
              <p className="mt-2 text-sm text-gray-600">
                This invite link is no longer valid. Please ask your administrator to resend the invite.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h1 className="text-base font-semibold" style={{ color: '#111827' }}>Set Your Password</h1>
                <p className="mt-0.5 text-xs" style={{ color: '#6B7280' }}>
                  Welcome{agentEmail ? `, ${agentEmail}` : ''}! Set a password to activate your agent account.
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
                  {isLoading ? 'Activating...' : 'Activate Account'}
                </button>
              </form>
            </>
          )}
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
