'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Loader2, Calendar } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { Database } from '@/lib/database.types'

type Escalation = Database['public']['Tables']['escalations']['Row']
type Agent = Database['public']['Tables']['agents']['Row']

const STATUS_OPTIONS = ['open', 'in_progress', 'closed'] as const

export default function AgentPage() {
  const [agent, setAgent] = useState<Agent | null>(null)
  const [escalations, setEscalations] = useState<Escalation[]>([])
  const [selected, setSelected] = useState<Escalation | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: agentRow } = await supabase
        .from('agents')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!agentRow) { setLoading(false); return }
      setAgent(agentRow)

      const { data: escs } = await supabase
        .from('escalations')
        .select('*')
        .eq('assigned_agent_id', agentRow.id)
        .order('created_at', { ascending: false })

      if (escs) setEscalations(escs)
      setLoading(false)
    }
    init()
  }, [])

  // Real-time: update list when escalations assigned to this agent change
  useEffect(() => {
    if (!agent) return
    const channel = supabase
      .channel('agent-escalations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'escalations' }, async () => {
        const { data } = await supabase
          .from('escalations')
          .select('*')
          .eq('assigned_agent_id', agent.id)
          .order('created_at', { ascending: false })
        if (data) setEscalations(data)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [agent])

  async function updateStatus(id: string, status: typeof STATUS_OPTIONS[number]) {
    setUpdating(true)
    await supabase
      .from('escalations')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
    setUpdating(false)
    setEscalations((prev) => prev.map((e) => e.id === id ? { ...e, status } : e))
    if (selected?.id === id) setSelected((prev) => prev ? { ...prev, status } : null)
  }

  const open = escalations.filter((e) => e.status === 'open').length
  const inProgress = escalations.filter((e) => e.status === 'in_progress').length

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 size={20} className="animate-spin" style={{ color: '#9CA3AF' }} />
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-center" style={{ color: '#6B7280' }}>
          No agent profile found for this account. Contact your administrator.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* List panel — full width on mobile when nothing selected */}
      <div
        className={`flex flex-col border-r overflow-hidden md:w-1/2 ${selected ? 'hidden md:flex' : 'flex w-full'}`}
        style={{ borderColor: '#E5E7EB' }}
      >
        <div className="border-b bg-white px-4 py-4 md:px-6 md:py-5" style={{ borderColor: '#E5E7EB' }}>
          <h1 className="text-base font-semibold" style={{ color: '#111827' }}>My Escalations</h1>
          <p className="mt-0.5 text-xs" style={{ color: '#6B7280' }}>
            {open} open · {inProgress} in progress · {escalations.length} total
          </p>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-[#F3F4F6]">
          {escalations.length === 0 ? (
            <div className="flex justify-center py-12">
              <p className="text-xs" style={{ color: '#9CA3AF' }}>No escalations assigned to you yet.</p>
            </div>
          ) : escalations.map((esc) => (
            <button
              key={esc.id}
              onClick={() => setSelected(esc)}
              className="w-full text-left px-4 py-4 md:px-6 transition-colors hover:bg-[#FAFAFA]"
              style={{ backgroundColor: selected?.id === esc.id ? '#F5F8FF' : undefined }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: '#111827' }}>{esc.user_name}</p>
                  <p className="text-[11px] truncate" style={{ color: '#6B7280' }}>{esc.user_email}</p>
                  <p className="mt-1 text-[11px] truncate" style={{ color: '#9CA3AF' }}>{esc.reason}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <StatusBadge status={esc.status} />
                  <span className="text-[10px]" style={{ color: '#9CA3AF' }}>{formatDate(esc.created_at)}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Detail panel — hidden on mobile when nothing selected */}
      <div className={`flex-1 flex-col overflow-y-auto ${selected ? 'flex' : 'hidden md:flex'}`}>
        {selected ? (
          <>
            {/* Mobile back button */}
            <button
              onClick={() => setSelected(null)}
              className="flex md:hidden items-center gap-1.5 border-b bg-white px-4 py-3 text-xs font-medium shrink-0"
              style={{ borderColor: '#E5E7EB', color: '#1B3A7A' }}
            >
              ← Back to list
            </button>
            <div className="flex flex-col gap-0">
              <div className="border-b bg-white px-4 py-4 md:px-6 md:py-5" style={{ borderColor: '#E5E7EB' }}>
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>{selected.user_name}</h2>
                    <p className="text-xs" style={{ color: '#6B7280' }}>{selected.user_email}</p>
                  </div>
                  <StatusBadge status={selected.status} />
                </div>
              </div>

              <div className="flex flex-col gap-4 px-4 py-4 md:px-6 md:py-5">
                <InfoRow label="Category">
                  <span className="capitalize rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: '#EEF2FF', color: '#1B3A7A' }}>
                    {selected.category}
                  </span>
                </InfoRow>
                <InfoRow label="Reason">
                  <p className="text-xs" style={{ color: '#374151' }}>{selected.reason}</p>
                </InfoRow>
                <InfoRow label="Submitted">
                  <p className="text-xs" style={{ color: '#374151' }}>{formatDate(selected.timestamp)}</p>
                </InfoRow>
                {selected.call_booked && (
                  <InfoRow label="Call Scheduled">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={12} style={{ color: '#16A34A' }} />
                      <p className="text-xs" style={{ color: '#374151' }}>
                        {selected.appointment_time ? formatDate(selected.appointment_time) : 'Booked'}
                        {selected.appointment_timezone && ` (${selected.appointment_timezone})`}
                      </p>
                    </div>
                  </InfoRow>
                )}

                {/* Status update */}
                <div className="rounded-xl border p-4" style={{ borderColor: '#E5E7EB' }}>
                  <p className="mb-3 text-xs font-medium" style={{ color: '#374151' }}>Update Status</p>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_OPTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => updateStatus(selected.id, s)}
                        disabled={updating || selected.status === s}
                        className="rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-50"
                        style={{
                          backgroundColor: selected.status === s ? '#1B3A7A' : 'white',
                          color: selected.status === s ? 'white' : '#6B7280',
                          borderColor: selected.status === s ? '#1B3A7A' : '#E5E7EB',
                        }}
                      >
                        {s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-xs" style={{ color: '#9CA3AF' }}>Select an escalation to view details</p>
          </div>
        )}
      </div>
    </div>
  )
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-medium uppercase tracking-wide" style={{ color: '#9CA3AF' }}>{label}</p>
      {children}
    </div>
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
    <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: c.bg, color: c.text }}>
      {c.label}
    </span>
  )
}
