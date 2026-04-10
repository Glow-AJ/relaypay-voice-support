'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { RelayPayLogo } from '@/components/RelayPayLogo'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

export default function AdminLoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const wasReset = searchParams.get('reset') === '1'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (authError) {
      if (authError.message.toLowerCase().includes('invalid')) {
        setError('Invalid email or password. Check your credentials and try again.')
      } else {
        setError(authError.message)
      }
      setIsLoading(false)
      return
    }

    // Route agents to their portal, admins to the admin dashboard
    if (data.user) {
      const { data: agent } = await supabase
        .from('agents')
        .select('id')
        .eq('user_id', data.user.id)
        .maybeSingle()
      if (agent) {
        router.push('/agent')
        return
      }
    }

    router.push('/admin')
    router.refresh()
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4" style={{ backgroundColor: '#F7F8FA' }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <RelayPayLogo size="lg" />
        </div>

        {/* Card */}
        <div className="rounded-2xl border bg-white px-8 py-8 shadow-sm" style={{ borderColor: '#E5E7EB' }}>
          <div className="mb-6">
            <h1 className="text-base font-semibold" style={{ color: '#111827' }}>Admin Sign In</h1>
            <p className="mt-0.5 text-xs" style={{ color: '#6B7280' }}>
              RelayPay Support Portal
            </p>
          </div>

          {wasReset && (
            <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs" style={{ color: '#065F46' }}>
              Password updated successfully. Sign in with your new password.
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium" style={{ color: '#374151' }}>
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@relaypay.io"
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors focus:border-[#29ABE2]"
                style={{ borderColor: '#E5E7EB', color: '#111827' }}
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs font-medium" style={{ color: '#374151' }}>
                  Password
                </label>
                <Link
                  href="/admin/forgot-password"
                  className="text-[11px] underline"
                  style={{ color: '#6B7280' }}
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full rounded-lg border px-3 py-2.5 pr-10 text-sm outline-none transition-colors focus:border-[#29ABE2]"
                  style={{ borderColor: '#E5E7EB', color: '#111827' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  {showPassword
                    ? <EyeOff size={14} style={{ color: '#9CA3AF' }} />
                    : <Eye size={14} style={{ color: '#9CA3AF' }} />
                  }
                </button>
              </div>
            </div>

            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs" style={{ color: '#DC2626' }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#162F63] disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#1B3A7A' }}
            >
              {isLoading && <Loader2 size={14} className="animate-spin" />}
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-[11px]" style={{ color: '#9CA3AF' }}>
          RelayPay Support Portal · Admin Access Only
        </p>
      </div>
    </div>
  )
}
