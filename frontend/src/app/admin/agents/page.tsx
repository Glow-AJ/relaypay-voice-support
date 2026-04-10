'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Trash2, ToggleLeft, ToggleRight, UserCircle, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { validateEmail } from '@/lib/utils'
import type { Database } from '@/lib/database.types'

type Agent = Database['public']['Tables']['agents']['Row']

const ROLES = ['support', 'supervisor', 'admin'] as const

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', role: 'support' as typeof ROLES[number] })
  const [formError, setFormError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [resendingId, setResendingId] = useState<string | null>(null)

  useEffect(() => { fetchAgents() }, [])

  async function fetchAgents() {
    const { data } = await supabase.from('agents').select('*').order('created_at', { ascending: false })
    if (data) setAgents(data)
  }

  async function handleAdd() {
    setFormError('')
    if (!form.name.trim() || !form.email.trim()) {
      setFormError('Name and email are required.')
      return
    }
    if (!validateEmail(form.email)) {
      setFormError('Please enter a valid email address.')
      return
    }
    setIsSaving(true)
    const res = await fetch('/api/admin/invite-agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name.trim(), email: form.email.trim(), role: form.role }),
    })
    const data = await res.json()
    if (!res.ok) {
      setFormError(data.error || 'Failed to send invite.')
      setIsSaving(false)
      return
    }
    setForm({ name: '', email: '', role: 'support' })
    setShowForm(false)
    setIsSaving(false)
    fetchAgents()
  }

  async function handleToggle(agent: Agent) {
    await supabase.from('agents').update({ is_available: !agent.is_available }).eq('id', agent.id)
    fetchAgents()
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this agent?')) return
    await supabase.from('agents').delete().eq('id', id)
    fetchAgents()
  }

  async function handleResendInvite(agent: Agent) {
    setResendingId(agent.id)
    try {
      const res = await fetch('/api/admin/resend-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: agent.email }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Invite re-sent successfully!')
      } else {
        toast.error(data.error || 'Failed to resend invite.')
      }
    } catch (err) {
      toast.error('Network error. Failed to resend invite.')
    } finally {
      setResendingId(null)
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b bg-white px-4 py-4 md:px-8 md:py-5" style={{ borderColor: '#E5E7EB' }}>
        <div>
          <h1 className="text-base font-semibold" style={{ color: '#111827' }}>Human Agents</h1>
          <p className="text-xs" style={{ color: '#6B7280' }}>
            {agents.filter(a => a.is_available).length} available · {agents.length} total
          </p>
        </div>
        <button
          onClick={() => { setFormError(''); setShowForm(true) }}
          className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium text-white hover:bg-[#162F63] transition-colors"
          style={{ backgroundColor: '#1B3A7A' }}
        >
          <Plus size={14} /> Add Agent
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 md:px-8 md:py-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {agents.map((agent) => (
            <div key={agent.id} className="rounded-xl border bg-white p-5" style={{ borderColor: '#E5E7EB' }}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: '#EEF2FF' }}>
                  <UserCircle size={22} style={{ color: '#1B3A7A' }} />
                </div>
                <div className="flex gap-1 items-center">
                  <button onClick={() => handleToggle(agent)} title={agent.is_available ? 'Mark unavailable' : 'Mark available'}>
                    {agent.is_available
                      ? <ToggleRight size={20} style={{ color: '#16A34A' }} />
                      : <ToggleLeft size={20} style={{ color: '#9CA3AF' }} />
                    }
                  </button>
                  <button onClick={() => handleDelete(agent.id)} className="rounded p-1 hover:bg-[#FEF2F2] transition-colors">
                    <Trash2 size={13} style={{ color: '#DC2626' }} />
                  </button>
                </div>
              </div>
              <p className="text-sm font-semibold" style={{ color: '#111827' }}>{agent.name}</p>
              <p className="text-xs" style={{ color: '#6B7280' }}>{agent.email}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full px-2 py-0.5 text-[10px] font-medium capitalize" style={{ backgroundColor: '#F3F4F6', color: '#6B7280' }}>
                  {agent.role}
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{ backgroundColor: agent.is_available ? '#D1FAE5' : '#F3F4F6', color: agent.is_available ? '#065F46' : '#9CA3AF' }}
                >
                  {agent.is_available ? 'Available' : 'Unavailable'}
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{
                    backgroundColor: agent.invite_status === 'accepted' ? '#D1FAE5' : '#FEF3C7',
                    color: agent.invite_status === 'accepted' ? '#065F46' : '#92400E',
                  }}
                >
                  {agent.invite_status === 'accepted' ? 'Active' : 'Invite Pending'}
                </span>
              </div>
              {agent.invite_status === 'pending' && (
                <button
                  onClick={() => handleResendInvite(agent)}
                  disabled={resendingId === agent.id}
                  className="mt-3 flex items-center gap-1.5 text-[11px] font-medium transition-colors disabled:opacity-50"
                  style={{ color: '#1B3A7A' }}
                >
                  <RefreshCw size={11} className={resendingId === agent.id ? 'animate-spin' : ''} />
                  {resendingId === agent.id ? 'Sending...' : 'Resend Invite'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => e.target === e.currentTarget && setShowForm(false)}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
            <div className="border-b px-6 py-5" style={{ borderColor: '#E5E7EB' }}>
              <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>Invite Agent</h2>
              <p className="mt-0.5 text-xs" style={{ color: '#6B7280' }}>An invite email will be sent to set up their account.</p>
            </div>
            <div className="flex flex-col gap-4 px-6 py-5">
              {(['name', 'email'] as const).map((field) => (
                <div key={field}>
                  <label className="mb-1 block text-xs font-medium capitalize" style={{ color: '#374151' }}>{field}</label>
                  <input
                    type={field === 'email' ? 'email' : 'text'}
                    value={form[field]}
                    onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[#29ABE2]"
                    style={{ borderColor: '#E5E7EB', color: '#111827' }}
                  />
                </div>
              ))}
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: '#374151' }}>Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as typeof ROLES[number] })}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: '#E5E7EB', color: '#111827' }}
                >
                  {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </div>
              {formError && (
                <p className="text-xs" style={{ color: '#DC2626' }}>{formError}</p>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t px-6 py-4" style={{ borderColor: '#E5E7EB' }}>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg border px-4 py-2 text-xs font-medium"
                style={{ borderColor: '#E5E7EB', color: '#6B7280' }}
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={isSaving}
                className="rounded-lg px-4 py-2 text-xs font-medium text-white disabled:opacity-60"
                style={{ backgroundColor: '#1B3A7A' }}
              >
                {isSaving ? 'Sending Invite...' : 'Send Invite'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
