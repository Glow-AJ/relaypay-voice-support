'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { RelayPayLogo } from '@/components/RelayPayLogo'
import { Loader2 } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/admin/reset-password`,
    })

    setIsLoading(false)
    if (resetError) {
      setError(resetError.message)
      return
    }
    setSent(true)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4" style={{ backgroundColor: '#F7F8FA' }}>
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <RelayPayLogo size="lg" />
        </div>
        <div className="rounded-2xl border bg-white px-8 py-8 shadow-sm" style={{ borderColor: '#E5E7EB' }}>
          {sent ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <p className="text-sm font-semibold" style={{ color: '#111827' }}>Check your email</p>
              <p className="text-xs leading-relaxed" style={{ color: '#6B7280' }}>
                If an account exists for <strong>{email}</strong>, a reset link has been sent.
                Check your inbox and follow the link to set a new password.
              </p>
              <Link
                href="/admin/login"
                className="text-xs underline"
                style={{ color: '#1B3A7A' }}
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h1 className="text-base font-semibold" style={{ color: '#111827' }}>Reset Password</h1>
                <p className="mt-0.5 text-xs" style={{ color: '#6B7280' }}>
                  Enter your email and we will send you a reset link.
                </p>
              </div>
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
                  {isLoading ? 'Sending...' : 'Send Reset Link'}
                </button>
                <Link
                  href="/admin/login"
                  className="text-center text-xs underline"
                  style={{ color: '#6B7280' }}
                >
                  Back to sign in
                </Link>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
