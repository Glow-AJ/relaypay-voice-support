'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { MessageSquare, AlertTriangle, BookOpen, CheckCircle } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { Database } from '@/lib/database.types'

type Escalation = Database['public']['Tables']['escalations']['Row']

interface Stats {
  totalConversations: number
  openEscalations: number
  knowledgeBaseArticles: number
  resolvedToday: number
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalConversations: 0,
    openEscalations: 0,
    knowledgeBaseArticles: 0,
    resolvedToday: 0,
  })
  const [recentEscalations, setRecentEscalations] = useState<Escalation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const [convResult, openEscResult, kbResult, resolvedResult, escalResult] = await Promise.all([
        supabase.from('conversations').select('id', { count: 'exact', head: true }),
        supabase.from('escalations').select('id', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('knowledge_base').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('escalations').select('id', { count: 'exact', head: true }).eq('status', 'closed').gte('updated_at', today.toISOString()),
        supabase.from('escalations').select('*').order('created_at', { ascending: false }).limit(5),
      ])

      setStats({
        totalConversations: convResult.count || 0,
        openEscalations: openEscResult.count || 0,
        knowledgeBaseArticles: kbResult.count || 0,
        resolvedToday: resolvedResult.count || 0,
      })
      if (escalResult.data) setRecentEscalations(escalResult.data)
      setLoading(false)
    }

    fetchData()

    // Real-time escalation updates
    const channel = supabase
      .channel('admin-escalations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'escalations' }, () => {
        fetchData()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const statCards = [
    {
      label: 'Total Conversations',
      value: stats.totalConversations,
      icon: MessageSquare,
      color: '#1B3A7A',
      bg: '#EEF2FF',
    },
    {
      label: 'Open Escalations',
      value: stats.openEscalations,
      icon: AlertTriangle,
      color: '#D97706',
      bg: '#FFFBEB',
    },
    {
      label: 'KB Articles',
      value: stats.knowledgeBaseArticles,
      icon: BookOpen,
      color: '#29ABE2',
      bg: '#F0F9FF',
    },
    {
      label: 'Resolved Today',
      value: stats.resolvedToday,
      icon: CheckCircle,
      color: '#16A34A',
      bg: '#F0FDF4',
    },
  ]

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {/* Page header */}
      <div className="border-b bg-white px-4 py-4 md:px-8 md:py-5" style={{ borderColor: '#E5E7EB' }}>
        <h1 className="text-base font-semibold" style={{ color: '#111827' }}>Dashboard</h1>
        <p className="text-xs" style={{ color: '#6B7280' }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div className="flex-1 px-4 py-4 md:px-8 md:py-6">
        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-4 mb-6 lg:grid-cols-4">
          {statCards.map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="rounded-xl border bg-white p-5" style={{ borderColor: '#E5E7EB' }}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium" style={{ color: '#6B7280' }}>{label}</p>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: bg }}>
                  <Icon size={15} style={{ color }} />
                </div>
              </div>
              <p className="text-2xl font-semibold" style={{ color: '#111827' }}>
                {loading ? '—' : value}
              </p>
            </div>
          ))}
        </div>

        {/* Recent escalations */}
        <div className="rounded-xl border bg-white" style={{ borderColor: '#E5E7EB' }}>
          <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: '#E5E7EB' }}>
            <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>Recent Escalations</h2>
            <a href="/admin/escalations" className="text-xs font-medium" style={{ color: '#29ABE2' }}>
              View all
            </a>
          </div>

          {recentEscalations.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <p className="text-sm" style={{ color: '#9CA3AF' }}>No escalations yet</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: '#F3F4F6' }}>
              {recentEscalations.map((esc) => (
                <div key={esc.id} className="flex items-center gap-4 px-6 py-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: '#111827' }}>{esc.user_name}</p>
                    <p className="text-xs truncate" style={{ color: '#6B7280' }}>{esc.reason}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <CategoryBadge category={esc.category} />
                    <StatusBadge status={esc.status} />
                    <span className="text-[11px]" style={{ color: '#9CA3AF' }}>
                      {formatDate(esc.created_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CategoryBadge({ category }: { category: string }) {
  const colors: Record<string, string> = {
    compliance: '#7C3AED',
    account: '#1B3A7A',
    dispute: '#DC2626',
    transaction: '#D97706',
    identity: '#0891B2',
    other: '#6B7280',
  }
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white capitalize"
      style={{ backgroundColor: colors[category] || '#6B7280' }}
    >
      {category}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    open: { bg: '#FEF3C7', text: '#92400E', label: 'Open' },
    in_progress: { bg: '#DBEAFE', text: '#1E40AF', label: 'In Progress' },
    closed: { bg: '#D1FAE5', text: '#065F46', label: 'Closed' },
  }
  const c = config[status] || config.open
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{ backgroundColor: c.bg, color: c.text }}
    >
      {c.label}
    </span>
  )
}
