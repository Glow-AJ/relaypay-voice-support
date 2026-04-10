'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { RelayPayLogo } from '@/components/RelayPayLogo'
import {
  LayoutDashboard,
  BookOpen,
  AlertTriangle,
  MessageSquare,
  Users,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/knowledge-base', label: 'Knowledge Base', icon: BookOpen },
  { href: '/admin/escalations', label: 'Escalations', icon: AlertTriangle },
  { href: '/admin/conversations', label: 'Conversations', icon: MessageSquare },
  { href: '/admin/agents', label: 'Agents', icon: Users },
]

// Auth pages — render without sidebar (they have their own centered layout)
const AUTH_PATHS = ['/admin/login', '/admin/forgot-password', '/admin/reset-password']

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [openEscalationCount, setOpenEscalationCount] = useState<number>(0)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Close mobile sidebar on route change
  useEffect(() => { setSidebarOpen(false) }, [pathname])

  useEffect(() => {
    async function fetchCount() {
      const { count } = await supabase
        .from('escalations')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'open')
      setOpenEscalationCount(count ?? 0)
    }
    fetchCount()

    const ch = supabase
      .channel('escalation-count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'escalations' }, fetchCount)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/admin/login')
    router.refresh()
  }

  // Auth pages render without sidebar
  if (AUTH_PATHS.some(p => pathname.startsWith(p))) {
    return <>{children}</>
  }

  const NavLinks = ({ onItemClick }: { onItemClick?: () => void }) => (
    <>
      <nav className="flex flex-1 flex-col gap-0.5 px-3 py-4">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href)
          const isEscalations = href === '/admin/escalations'
          return (
            <Link
              key={href}
              href={href}
              onClick={onItemClick}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs font-medium transition-colors',
                active
                  ? 'bg-[#EEF2FF] text-[#1B3A7A]'
                  : 'text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#111827]',
              )}
            >
              <Icon size={15} strokeWidth={active ? 2 : 1.5} />
              {label}
              {isEscalations && openEscalationCount > 0 && (
                <span
                  className="ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none min-w-[16px] text-center"
                  style={{ backgroundColor: '#F59E0B', color: '#FFFFFF' }}
                >
                  {openEscalationCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      <div className="border-t px-3 py-4" style={{ borderColor: '#E5E7EB' }}>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs font-medium text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#DC2626] transition-colors"
        >
          <LogOut size={15} strokeWidth={1.5} />
          Sign Out
        </button>
      </div>
    </>
  )

  return (
    <div className="flex h-screen" style={{ backgroundColor: '#F7F8FA' }}>

      {/* ── Desktop sidebar (md+) ── */}
      <aside className="hidden md:flex w-56 shrink-0 flex-col border-r bg-white" style={{ borderColor: '#E5E7EB' }}>
        <div className="border-b px-5 py-4" style={{ borderColor: '#E5E7EB' }}>
          <RelayPayLogo size="sm" />
          <p className="mt-1 text-[10px] font-medium uppercase tracking-widest" style={{ color: '#9CA3AF' }}>
            Admin Portal
          </p>
        </div>
        <NavLinks />
      </aside>

      {/* ── Mobile sidebar overlay (< md) ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setSidebarOpen(false)}
          />
          {/* Drawer */}
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: '#E5E7EB' }}>
              <div>
                <RelayPayLogo size="sm" />
                <p className="mt-1 text-[10px] font-medium uppercase tracking-widest" style={{ color: '#9CA3AF' }}>
                  Admin Portal
                </p>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="rounded p-1 hover:bg-[#F3F4F6] transition-colors"
              >
                <X size={18} style={{ color: '#6B7280' }} />
              </button>
            </div>
            <NavLinks onItemClick={() => setSidebarOpen(false)} />
          </aside>
        </div>
      )}

      {/* ── Main content ── */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">

        {/* Mobile top bar */}
        <header className="flex md:hidden shrink-0 items-center justify-between border-b bg-white px-4 py-3" style={{ borderColor: '#E5E7EB' }}>
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded p-1 hover:bg-[#F3F4F6] transition-colors"
            aria-label="Open menu"
          >
            <Menu size={20} style={{ color: '#1B3A7A' }} />
          </button>
          <RelayPayLogo size="sm" />
          {/* Escalation badge visible on mobile too */}
          {openEscalationCount > 0 ? (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ backgroundColor: '#F59E0B', color: '#FFFFFF' }}
            >
              {openEscalationCount}
            </span>
          ) : (
            <div className="w-6" />
          )}
        </header>

        {children}
      </div>
    </div>
  )
}
