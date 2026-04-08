'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { RelayPayLogo } from '@/components/RelayPayLogo'
import {
  LayoutDashboard,
  BookOpen,
  AlertTriangle,
  MessageSquare,
  Users,
  LogOut,
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

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/admin/login')
    router.refresh()
  }

  // Login page renders without sidebar — it has its own centered layout
  if (pathname === '/admin/login') {
    return <>{children}</>
  }

  return (
    <div className="flex h-screen" style={{ backgroundColor: '#F7F8FA' }}>
      {/* Sidebar */}
      <aside className="flex w-56 shrink-0 flex-col border-r bg-white" style={{ borderColor: '#E5E7EB' }}>
        {/* Logo */}
        <div className="border-b px-5 py-4" style={{ borderColor: '#E5E7EB' }}>
          <RelayPayLogo size="sm" />
          <p className="mt-1 text-[10px] font-medium uppercase tracking-widest" style={{ color: '#9CA3AF' }}>
            Admin Portal
          </p>
        </div>

        {/* Nav */}
        <nav className="flex flex-1 flex-col gap-0.5 px-3 py-4">
          {navItems.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                  active
                    ? 'bg-[#EEF2FF] text-[#1B3A7A]'
                    : 'text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#111827]',
                )}
              >
                <Icon size={15} strokeWidth={active ? 2 : 1.5} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Sign out */}
        <div className="border-t px-3 py-4" style={{ borderColor: '#E5E7EB' }}>
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#DC2626] transition-colors"
          >
            <LogOut size={15} strokeWidth={1.5} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  )
}
