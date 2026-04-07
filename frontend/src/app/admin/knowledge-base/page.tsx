'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Search, Edit2, Trash2, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { Database } from '@/lib/database.types'

type KBEntry = Database['public']['Tables']['knowledge_base']['Row']

const CATEGORIES = ['fees', 'onboarding', 'payouts', 'invoicing', 'compliance', 'general', 'troubleshooting']

export default function KnowledgeBasePage() {
  const [entries, setEntries] = useState<KBEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editEntry, setEditEntry] = useState<KBEntry | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const [form, setForm] = useState({
    title: '',
    content: '',
    category: 'general',
    source: '',
  })

  useEffect(() => {
    fetchEntries()
  }, [])

  async function fetchEntries() {
    setLoading(true)
    const { data } = await supabase
      .from('knowledge_base')
      .select('*')
      .order('updated_at', { ascending: false })
    if (data) setEntries(data)
    setLoading(false)
  }

  function openNew() {
    setEditEntry(null)
    setForm({ title: '', content: '', category: 'general', source: '' })
    setShowForm(true)
  }

  function openEdit(entry: KBEntry) {
    setEditEntry(entry)
    setForm({ title: entry.title, content: entry.content, category: entry.category, source: entry.source || '' })
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.title.trim() || !form.content.trim()) return
    setIsSaving(true)

    if (editEntry) {
      await supabase
        .from('knowledge_base')
        .update({ ...form, updated_at: new Date().toISOString() })
        .eq('id', editEntry.id)
    } else {
      await supabase.from('knowledge_base').insert({ ...form, is_active: true })
    }

    // Trigger embedding sync in n8n
    if (!editEntry) {
      try {
        await fetch(`${process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL}/relaypay-kb-sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: editEntry ? 'update' : 'create', title: form.title }),
        })
      } catch { /* non-blocking */ }
    }

    setShowForm(false)
    setIsSaving(false)
    fetchEntries()
  }

  async function handleToggle(entry: KBEntry) {
    await supabase.from('knowledge_base').update({ is_active: !entry.is_active }).eq('id', entry.id)
    fetchEntries()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this article?')) return
    await supabase.from('knowledge_base').delete().eq('id', id)
    fetchEntries()
  }

  const filtered = entries.filter((e) => {
    const matchesSearch = search === '' || e.title.toLowerCase().includes(search.toLowerCase()) || e.content.toLowerCase().includes(search.toLowerCase())
    const matchesCat = categoryFilter === 'all' || e.category === categoryFilter
    return matchesSearch && matchesCat
  })

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-white px-8 py-5" style={{ borderColor: '#E5E7EB' }}>
        <div>
          <h1 className="text-base font-semibold" style={{ color: '#111827' }}>Knowledge Base</h1>
          <p className="text-xs" style={{ color: '#6B7280' }}>{entries.filter(e => e.is_active).length} active articles</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#162F63]"
          style={{ backgroundColor: '#1B3A7A' }}
        >
          <Plus size={14} />
          Add Article
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 border-b bg-white px-8 py-3" style={{ borderColor: '#E5E7EB' }}>
        <div className="flex items-center gap-2 rounded-lg border px-3 py-1.5 flex-1 max-w-xs" style={{ borderColor: '#E5E7EB' }}>
          <Search size={13} style={{ color: '#9CA3AF' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search articles..."
            className="flex-1 bg-transparent text-xs outline-none"
            style={{ color: '#111827' }}
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border px-3 py-1.5 text-xs outline-none"
          style={{ borderColor: '#E5E7EB', color: '#111827' }}
        >
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={20} className="animate-spin" style={{ color: '#9CA3AF' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <p className="text-sm font-medium" style={{ color: '#374151' }}>No articles found</p>
            <p className="text-xs" style={{ color: '#9CA3AF' }}>Add your first knowledge base article</p>
          </div>
        ) : (
          <div className="rounded-xl border bg-white overflow-hidden" style={{ borderColor: '#E5E7EB' }}>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b" style={{ borderColor: '#F3F4F6', backgroundColor: '#F9FAFB' }}>
                  <th className="px-4 py-3 text-left font-medium" style={{ color: '#6B7280' }}>Title</th>
                  <th className="px-4 py-3 text-left font-medium" style={{ color: '#6B7280' }}>Category</th>
                  <th className="px-4 py-3 text-left font-medium" style={{ color: '#6B7280' }}>Updated</th>
                  <th className="px-4 py-3 text-left font-medium" style={{ color: '#6B7280' }}>Status</th>
                  <th className="px-4 py-3 text-right font-medium" style={{ color: '#6B7280' }}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: '#F3F4F6' }}>
                {filtered.map((entry) => (
                  <tr key={entry.id} className="hover:bg-[#FAFAFA]">
                    <td className="px-4 py-3">
                      <p className="font-medium truncate max-w-xs" style={{ color: '#111827' }}>{entry.title}</p>
                      <p className="truncate max-w-xs mt-0.5" style={{ color: '#9CA3AF' }}>
                        {entry.content.slice(0, 80)}...
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="capitalize rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: '#EEF2FF', color: '#1B3A7A' }}>
                        {entry.category}
                      </span>
                    </td>
                    <td className="px-4 py-3" style={{ color: '#6B7280' }}>{formatDate(entry.updated_at)}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleToggle(entry)} title={entry.is_active ? 'Deactivate' : 'Activate'}>
                        {entry.is_active
                          ? <ToggleRight size={18} style={{ color: '#16A34A' }} />
                          : <ToggleLeft size={18} style={{ color: '#9CA3AF' }} />
                        }
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEdit(entry)} className="rounded p-1 hover:bg-[#F3F4F6] transition-colors">
                          <Edit2 size={13} style={{ color: '#6B7280' }} />
                        </button>
                        <button onClick={() => handleDelete(entry.id)} className="rounded p-1 hover:bg-[#FEF2F2] transition-colors">
                          <Trash2 size={13} style={{ color: '#DC2626' }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={(e) => e.target === e.currentTarget && setShowForm(false)}>
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl">
            <div className="border-b px-6 py-5" style={{ borderColor: '#E5E7EB' }}>
              <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>
                {editEntry ? 'Edit Article' : 'New Article'}
              </h2>
            </div>
            <div className="flex flex-col gap-4 px-6 py-5">
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: '#374151' }}>Title</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[#29ABE2]"
                  style={{ borderColor: '#E5E7EB', color: '#111827' }}
                  placeholder="Article title"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: '#374151' }}>Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: '#E5E7EB', color: '#111827' }}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: '#374151' }}>Content</label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  rows={8}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[#29ABE2] resize-none"
                  style={{ borderColor: '#E5E7EB', color: '#111827' }}
                  placeholder="Article content — this is what the AI uses to answer questions..."
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: '#374151' }}>Source URL (optional)</label>
                <input
                  value={form.source}
                  onChange={(e) => setForm({ ...form, source: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[#29ABE2]"
                  style={{ borderColor: '#E5E7EB', color: '#111827' }}
                  placeholder="https://relaypay.io/docs/..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t px-6 py-4" style={{ borderColor: '#E5E7EB' }}>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg border px-4 py-2 text-xs font-medium transition-colors hover:bg-[#F9FAFB]"
                style={{ borderColor: '#E5E7EB', color: '#6B7280' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#162F63] disabled:opacity-60"
                style={{ backgroundColor: '#1B3A7A' }}
              >
                {isSaving && <Loader2 size={12} className="animate-spin" />}
                {editEntry ? 'Update' : 'Save & Embed'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
