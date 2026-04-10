'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Search, Calendar, Loader2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { Database } from '@/lib/database.types'

type Escalation = Database['public']['Tables']['escalations']['Row']
type Agent = Database['public']['Tables']['agents']['Row']

const STATUS_OPTIONS = ['open', 'in_progress', 'closed'] as const

export default function EscalationsPage() {
  const [escalations, setEscalations] = useState<Escalation[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'in_progress' | 'closed'>('all')
  const [selected, setSelected] = useState<Escalation | null>(null)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    fetchEscalations()
    fetchAgents()

    const channel = supabase
      .channel('escalations-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'escalations' }, fetchEscalations)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  async function fetchEscalations() {
    const { data } = await supabase
      .from('escalations')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setEscalations(data)
    setLoading(false)
  }

  async function fetchAgents() {
    const { data } = await supabase
      .from('agents')
      .select('*')
      .order('name', { ascending: true })
    if (data) setAgents(data)
  }

  async function updateStatus(id: string, status: typeof STATUS_OPTIONS[number]) {
    setUpdating(true)
    await supabase.from('escalations').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    setUpdating(false)
    fetchEscalations()
    if (selected?.id === id) setSelected((prev) => prev ? { ...prev, status } : null)
  }

  async function updateAgent(id: string, agentId: string | null) {
    await supabase
      .from('escalations')
      .update({ assigned_agent_id: agentId, updated_at: new Date().toISOString() })
      .eq('id', id)
    setEscalations((prev) => prev.map((e) => e.id === id ? { ...e, assigned_agent_id: agentId } : e))
    if (selected?.id === id) setSelected((prev) => prev ? { ...prev, assigned_agent_id: agentId } : null)
  }

  const filtered = escalations.filter((e) => {
    const matchesSearch = search === '' || e.user_name.toLowerCase().includes(search.toLowerCase()) || e.user_email.toLowerCase().includes(search.toLowerCase()) || e.reason.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || e.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const statusCount = {
    open: escalations.filter(e => e.status === 'open').length,
    in_progress: escalations.filter(e => e.status === 'in_progress').length,
    closed: escalations.filter(e => e.status === 'closed').length,
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* List panel — full width on mobile when nothing selected; half on desktop */}
      <div
        className={`flex flex-col border-r overflow-hidden md:w-1/2 ${selected ? 'hidden md:flex' : 'flex w-full'}`}
        style={{ borderColor: '#E5E7EB' }}
      >
        {/* Header */}
        <div className="border-b bg-white px-6 py-5" style={{ borderColor: '#E5E7EB' }}>
          <h1 className="text-base font-semibold" style={{ color: '#111827' }}>Escalations</h1>
          <div className="mt-3 flex gap-2">
            {(['all', 'open', 'in_progress', 'closed'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className="rounded-full px-3 py-1 text-[11px] font-medium transition-colors"
                style={{
                  backgroundColor: statusFilter === s ? '#1B3A7A' : '#F3F4F6',
                  color: statusFilter === s ? '#FFFFFF' : '#6B7280',
                }}
              >
                {s === 'all' ? 'All' : s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)}
                {s !== 'all' && ` (${statusCount[s]})`}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="border-b bg-white px-6 py-3" style={{ borderColor: '#E5E7EB' }}>
          <div className="flex items-center gap-2 rounded-lg border px-3 py-1.5" style={{ borderColor: '#E5E7EB' }}>
            <Search size={13} style={{ color: '#9CA3AF' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, or reason..."
              className="flex-1 bg-transparent text-xs outline-none"
              style={{ color: '#111827' }}
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#F3F4F6]">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={18} className="animate-spin" style={{ color: '#9CA3AF' }} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex justify-center py-12">
              <p className="text-xs" style={{ color: '#9CA3AF' }}>No escalations found</p>
            </div>
          ) : filtered.map((esc) => (
            <button
              key={esc.id}
              onClick={() => setSelected(esc)}
              className="w-full text-left px-6 py-4 transition-colors hover:bg-[#FAFAFA]"
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
              className="flex md:hidden items-center gap-1.5 border-b bg-white px-4 py-3 text-xs font-medium"
              style={{ borderColor: '#E5E7EB', color: '#1B3A7A' }}
            >
              ← Back to list
            </button>
          </>
        ) : null}
        {selected ? (
          <EscalationDetail
            escalation={selected}
            agents={agents}
            onUpdateStatus={updateStatus}
            onUpdateAgent={updateAgent}
            isUpdating={updating}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-xs" style={{ color: '#9CA3AF' }}>Select an escalation to view details</p>
          </div>
        )}
      </div>
    </div>
  )
}

function EscalationDetail({
  escalation,
  agents,
  onUpdateStatus,
  onUpdateAgent,
  isUpdating,
}: {
  escalation: Escalation
  agents: Agent[]
  onUpdateStatus: (id: string, status: 'open' | 'in_progress' | 'closed') => void
  onUpdateAgent: (id: string, agentId: string | null) => void
  isUpdating: boolean
}) {
  const assignedAgent = agents.find((a) => a.id === escalation.assigned_agent_id)

  return (
    <div className="flex flex-col gap-0">
      <div className="border-b bg-white px-6 py-5" style={{ borderColor: '#E5E7EB' }}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>{escalation.user_name}</h2>
            <p className="text-xs" style={{ color: '#6B7280' }}>{escalation.user_email}</p>
          </div>
          <StatusBadge status={escalation.status} />
        </div>
      </div>

      <div className="flex flex-col gap-4 px-6 py-5">
        <InfoRow label="Category">
          <span className="capitalize rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: '#EEF2FF', color: '#1B3A7A' }}>
            {escalation.category}
          </span>
        </InfoRow>
        <InfoRow label="Reason">
          <p className="text-xs" style={{ color: '#374151' }}>{escalation.reason}</p>
        </InfoRow>
        <InfoRow label="Submitted">
          <p className="text-xs" style={{ color: '#374151' }}>{formatDate(escalation.timestamp)}</p>
        </InfoRow>
        {escalation.call_booked && (
          <InfoRow label="Call Scheduled">
            <div className="flex items-center gap-1.5">
              <Calendar size={12} style={{ color: '#16A34A' }} />
              <p className="text-xs" style={{ color: '#374151' }}>
                {escalation.appointment_time ? formatDate(escalation.appointment_time) : 'Booked'}
                {escalation.appointment_timezone && ` (${escalation.appointment_timezone})`}
              </p>
            </div>
          </InfoRow>
        )}

        {/* Assigned agent */}
        <InfoRow label="Assigned Agent">
          <div className="flex items-center gap-2 mt-1">
            <select
              value={escalation.assigned_agent_id ?? ''}
              onChange={(e) => onUpdateAgent(escalation.id, e.target.value || null)}
              className="flex-1 rounded-lg border px-2.5 py-1.5 text-xs outline-none focus:border-[#29ABE2] transition-colors"
              style={{ borderColor: '#E5E7EB', color: escalation.assigned_agent_id ? '#111827' : '#9CA3AF', backgroundColor: '#F9FAFB' }}
            >
              <option value="">Unassigned</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            {assignedAgent && (
              <p className="text-[11px] shrink-0" style={{ color: '#6B7280' }}>{assignedAgent.email}</p>
            )}
          </div>
        </InfoRow>

        {/* Status update */}
        <div className="rounded-xl border p-4" style={{ borderColor: '#E5E7EB' }}>
          <p className="mb-3 text-xs font-medium" style={{ color: '#374151' }}>Update Status</p>
          <div className="flex gap-2">
            {(['open', 'in_progress', 'closed'] as const).map((s) => (
              <button
                key={s}
                onClick={() => onUpdateStatus(escalation.id, s)}
                disabled={isUpdating || escalation.status === s}
                className="rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-50"
                style={{
                  backgroundColor: escalation.status === s ? '#1B3A7A' : 'white',
                  color: escalation.status === s ? 'white' : '#6B7280',
                  borderColor: escalation.status === s ? '#1B3A7A' : '#E5E7EB',
                }}
              >
                {s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
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
