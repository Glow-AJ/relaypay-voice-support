'use client'

import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { RelayPayLogo } from '@/components/RelayPayLogo'
import { LogOut } from 'lucide-react'

// Pages that should render without the agent portal header
const AUTH_PATHS = ['/agent/accept-invite']

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  // Accept-invite has its own standalone layout
  if (AUTH_PATHS.some(p => pathname.startsWith(p))) {
    return <>{children}</>
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  return (
    <div className="flex h-screen flex-col" style={{ backgroundColor: '#F7F8FA' }}>
      <header
        className="flex shrink-0 items-center justify-between border-b bg-white px-6 py-4"
        style={{ borderColor: '#E5E7EB' }}
      >
        <div className="flex items-center gap-3">
          <RelayPayLogo size="sm" />
          <span
            className="text-[10px] font-medium uppercase tracking-widest"
            style={{ color: '#9CA3AF' }}
          >
            Agent Portal
          </span>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-1.5 text-xs"
          style={{ color: '#6B7280' }}
        >
          <LogOut size={14} /> Sign Out
        </button>
      </header>
      <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
    </div>
  )
}
