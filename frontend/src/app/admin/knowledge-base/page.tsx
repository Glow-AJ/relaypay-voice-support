'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Plus, Search, Trash2, ToggleLeft, ToggleRight, Loader2,
  Upload, Link2, FileText, Globe, Eye, X, RefreshCw, AlertCircle,
  CheckCircle, Clock,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'
import type { Database } from '@/lib/database.types'

type KBEntry = Database['public']['Tables']['knowledge_base']['Row']
type SourceTab = 'file' | 'url'
type EmbeddingStatus = 'pending' | 'processing' | 'complete' | 'failed'

const CATEGORIES = ['fees', 'onboarding', 'payouts', 'invoicing', 'compliance', 'general', 'troubleshooting']
const N8N_BASE = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL ?? ''

export default function KnowledgeBasePage() {
  const [entries, setEntries] = useState<KBEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')

  // Add modal state
  const [showForm, setShowForm] = useState(false)
  const [sourceTab, setSourceTab] = useState<SourceTab>('file')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [urlInput, setUrlInput] = useState('')
  const [titleInput, setTitleInput] = useState('')
  const [category, setCategory] = useState('general')
  const [isIngesting, setIsIngesting] = useState(false)
  const [ingestingId, setIngestingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Preview panel state
  const [previewEntry, setPreviewEntry] = useState<KBEntry | null>(null)

  // ─── Load entries ────────────────────────────────────────────────────────
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

  // ─── Real-time subscription for embedding status changes ─────────────────
  useEffect(() => {
    const channel = supabase
      .channel('kb_status_updates')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'knowledge_base' },
        (payload) => {
          const updated = payload.new as KBEntry
          setEntries((prev) =>
            prev.map((e) => (e.id === updated.id ? { ...e, ...updated } : e))
          )
          // Update preview if open
          setPreviewEntry((prev) => (prev?.id === updated.id ? { ...prev, ...updated } : prev))

          if (updated.embedding_status === 'complete' && updated.id === ingestingId) {
            toast.success(`"${updated.title}" embedded — ${updated.chunk_count} chunks`)
            setIsIngesting(false)
            setIngestingId(null)
            setShowForm(false)
            resetForm()
          }
          if (updated.embedding_status === 'failed' && updated.id === ingestingId) {
            toast.error(`Embedding failed for "${updated.title}"`)
            setIsIngesting(false)
            setIngestingId(null)
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [ingestingId])

  // ─── Real-time subscription for new inserts ──────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('kb_inserts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'knowledge_base' },
        (payload) => {
          setEntries((prev) => [payload.new as KBEntry, ...prev])
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  function resetForm() {
    setUploadFile(null)
    setUrlInput('')
    setTitleInput('')
    setCategory('general')
    setSourceTab('file')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ─── File ingestion → n8n ────────────────────────────────────────────────
  async function handleIngestFile() {
    if (!uploadFile) return
    setIsIngesting(true)
    try {
      const fd = new FormData()
      fd.append('file', uploadFile)
      fd.append('title', titleInput.trim() || uploadFile.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '))
      fd.append('category', category)

      const res = await fetch(`${N8N_BASE}/relaypay-kb-ingest-file`, {
        method: 'POST',
        body: fd,
      })

      if (!res.ok) throw new Error(`n8n returned ${res.status}`)
      const data = await res.json()

      if (data.status === 'unchanged') {
        toast.info(`"${data.title}" is already up to date — no changes detected`)
        setIsIngesting(false)
        setShowForm(false)
        resetForm()
        return
      }

      // n8n has accepted the file; wait for real-time status update
      if (data.entry_id) setIngestingId(data.entry_id)
    } catch (err) {
      console.error('Ingest file error:', err)
      toast.error('Could not send file to n8n. Is the workflow live?')
      setIsIngesting(false)
    }
  }

  // ─── URL ingestion → n8n ─────────────────────────────────────────────────
  async function handleIngestUrl() {
    if (!urlInput.trim()) return
    setIsIngesting(true)
    try {
      const res = await fetch(`${N8N_BASE}/relaypay-kb-ingest-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: urlInput.trim(),
          title: titleInput.trim() || '',
          category,
        }),
      })

      if (!res.ok) throw new Error(`n8n returned ${res.status}`)
      const data = await res.json()

      if (data.status === 'unchanged') {
        toast.info('This URL has not changed since last import')
        setIsIngesting(false)
        setShowForm(false)
        resetForm()
        return
      }

      if (data.entry_id) setIngestingId(data.entry_id)
    } catch (err) {
      console.error('Ingest URL error:', err)
      toast.error('Could not send URL to n8n. Is the workflow live?')
      setIsIngesting(false)
    }
  }

  // ─── Re-sync URL entry ───────────────────────────────────────────────────
  async function handleResync(entry: KBEntry) {
    if (!entry.source) return
    toast.info(`Re-syncing "${entry.title}"...`)
    try {
      const res = await fetch(`${N8N_BASE}/relaypay-kb-ingest-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: entry.source, title: entry.title, category: entry.category }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      if (data.status === 'unchanged') toast.info('No changes detected at this URL')
      else if (data.entry_id) setIngestingId(data.entry_id)
    } catch {
      toast.error('Re-sync failed. Check n8n workflow.')
    }
  }

  // ─── Toggle active ───────────────────────────────────────────────────────
  async function handleToggle(entry: KBEntry) {
    await supabase.from('knowledge_base').update({ is_active: !entry.is_active }).eq('id', entry.id)
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, is_active: !e.is_active } : e)))
  }

  // ─── Delete ──────────────────────────────────────────────────────────────
  async function handleDelete(entry: KBEntry) {
    const chunkLabel = entry.chunk_count > 0 ? ` and ${entry.chunk_count} embedded chunks` : ''
    if (!confirm(`Delete "${entry.title}"?${chunkLabel} This cannot be undone.`)) return
    await supabase.from('knowledge_base').delete().eq('id', entry.id)
    setEntries((prev) => prev.filter((e) => e.id !== entry.id))
    if (previewEntry?.id === entry.id) setPreviewEntry(null)
    toast.success('Article deleted')
  }

  // ─── Filtered list ───────────────────────────────────────────────────────
  const filtered = entries.filter((e) => {
    const matchSearch =
      search === '' ||
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      (e.file_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (e.source ?? '').toLowerCase().includes(search.toLowerCase())
    const matchCat = categoryFilter === 'all' || e.category === categoryFilter
    return matchSearch && matchCat
  })

  // ─── Status badge ────────────────────────────────────────────────────────
  function StatusBadge({ status }: { status: EmbeddingStatus }) {
    if (status === 'complete')
      return (
        <span className="flex items-center gap-1 text-[10px] font-medium" style={{ color: '#16A34A' }}>
          <CheckCircle size={11} /> ready
        </span>
      )
    if (status === 'processing')
      return (
        <span className="flex items-center gap-1 text-[10px] font-medium" style={{ color: '#2563EB' }}>
          <Loader2 size={11} className="animate-spin" /> embedding
        </span>
      )
    if (status === 'failed')
      return (
        <span className="flex items-center gap-1 text-[10px] font-medium" style={{ color: '#DC2626' }}>
          <AlertCircle size={11} /> failed
        </span>
      )
    return (
      <span className="flex items-center gap-1 text-[10px] font-medium" style={{ color: '#9CA3AF' }}>
        <Clock size={11} /> pending
      </span>
    )
  }

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Main panel */}
      <div className={`flex flex-col overflow-hidden transition-all ${previewEntry ? 'flex-1' : 'w-full'}`}>
        {/* Header */}
        <div className="flex items-center justify-between border-b bg-white px-8 py-5" style={{ borderColor: '#E5E7EB' }}>
          <div>
            <h1 className="text-base font-semibold" style={{ color: '#111827' }}>Knowledge Base</h1>
            <p className="text-xs" style={{ color: '#6B7280' }}>
              {entries.filter((e) => e.is_active && e.embedding_status === 'complete').length} active · ready for AI
            </p>
          </div>
          <button
            onClick={() => { resetForm(); setShowForm(true) }}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium text-white hover:bg-[#162F63] transition-colors"
            style={{ backgroundColor: '#1B3A7A' }}
          >
            <Plus size={14} /> Add Article
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 border-b bg-white px-8 py-3" style={{ borderColor: '#E5E7EB' }}>
          <div className="flex flex-1 max-w-xs items-center gap-2 rounded-lg border px-3 py-1.5" style={{ borderColor: '#E5E7EB' }}>
            <Search size={13} style={{ color: '#9CA3AF' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search articles, files, URLs..."
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
              <p className="text-sm font-medium" style={{ color: '#374151' }}>No articles yet</p>
              <p className="text-xs" style={{ color: '#9CA3AF' }}>Upload a file or import from a URL to get started</p>
            </div>
          ) : (
            <div className="rounded-xl border bg-white overflow-hidden" style={{ borderColor: '#E5E7EB' }}>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b" style={{ borderColor: '#F3F4F6', backgroundColor: '#F9FAFB' }}>
                    <th className="px-4 py-3 text-left font-medium" style={{ color: '#6B7280' }}>Title</th>
                    <th className="px-4 py-3 text-left font-medium" style={{ color: '#6B7280' }}>Source</th>
                    <th className="px-4 py-3 text-left font-medium" style={{ color: '#6B7280' }}>Category</th>
                    <th className="px-4 py-3 text-left font-medium" style={{ color: '#6B7280' }}>Status</th>
                    <th className="px-4 py-3 text-left font-medium" style={{ color: '#6B7280' }}>Updated</th>
                    <th className="px-4 py-3 text-right font-medium" style={{ color: '#6B7280' }}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: '#F3F4F6' }}>
                  {filtered.map((entry) => (
                    <tr key={entry.id} className="hover:bg-[#FAFAFA]">
                      <td className="px-4 py-3">
                        <p className="font-medium truncate max-w-[200px]" style={{ color: '#111827' }}>{entry.title}</p>
                        {entry.chunk_count > 0 && (
                          <p className="text-[10px] mt-0.5" style={{ color: '#9CA3AF' }}>
                            {entry.chunk_count} chunks
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {entry.source_type === 'url' ? (
                            <Globe size={12} style={{ color: '#29ABE2', flexShrink: 0 }} />
                          ) : (
                            <FileText size={12} style={{ color: '#6B7280', flexShrink: 0 }} />
                          )}
                          <span className="truncate max-w-[140px]" style={{ color: '#6B7280' }}>
                            {entry.source_type === 'url'
                              ? (entry.source ? new URL(entry.source).hostname : '—')
                              : (entry.file_name ?? '—')}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="capitalize rounded-full px-2 py-0.5 text-[10px] font-medium"
                          style={{ backgroundColor: '#EEF2FF', color: '#1B3A7A' }}>
                          {entry.category}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          <StatusBadge status={entry.embedding_status as EmbeddingStatus} />
                          <button onClick={() => handleToggle(entry)} title={entry.is_active ? 'Deactivate' : 'Activate'} className="mt-0.5">
                            {entry.is_active
                              ? <ToggleRight size={16} style={{ color: '#16A34A' }} />
                              : <ToggleLeft size={16} style={{ color: '#9CA3AF' }} />}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3" style={{ color: '#6B7280' }}>{formatDate(entry.updated_at)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {entry.source_type === 'url' && (
                            <button
                              onClick={() => handleResync(entry)}
                              title="Re-sync from URL"
                              className="rounded p-1 hover:bg-[#F0F9FF] transition-colors"
                            >
                              <RefreshCw size={12} style={{ color: '#29ABE2' }} />
                            </button>
                          )}
                          <button
                            onClick={() => setPreviewEntry(previewEntry?.id === entry.id ? null : entry)}
                            title="Preview content"
                            className="rounded p-1 hover:bg-[#F3F4F6] transition-colors"
                          >
                            <Eye size={12} style={{ color: previewEntry?.id === entry.id ? '#1B3A7A' : '#6B7280' }} />
                          </button>
                          <button
                            onClick={() => handleDelete(entry)}
                            className="rounded p-1 hover:bg-[#FEF2F2] transition-colors"
                          >
                            <Trash2 size={12} style={{ color: '#DC2626' }} />
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
      </div>

      {/* Preview panel */}
      {previewEntry && (
        <div className="w-[420px] shrink-0 border-l bg-white flex flex-col" style={{ borderColor: '#E5E7EB' }}>
          <div className="flex items-start justify-between border-b px-5 py-4" style={{ borderColor: '#E5E7EB' }}>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-semibold truncate" style={{ color: '#111827' }}>{previewEntry.title}</h2>
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                <span className="capitalize rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{ backgroundColor: '#EEF2FF', color: '#1B3A7A' }}>
                  {previewEntry.category}
                </span>
                <span className="flex items-center gap-1 text-[10px]" style={{ color: '#9CA3AF' }}>
                  {previewEntry.source_type === 'url'
                    ? <><Globe size={10} /> URL</>
                    : <><FileText size={10} /> {previewEntry.file_name ?? 'File'}</>}
                </span>
                {previewEntry.chunk_count > 0 && (
                  <span className="text-[10px]" style={{ color: '#9CA3AF' }}>
                    {previewEntry.chunk_count} chunks
                  </span>
                )}
                <StatusBadge status={previewEntry.embedding_status as EmbeddingStatus} />
              </div>
              {previewEntry.source && previewEntry.source_type === 'url' && (
                <p className="mt-1 text-[10px] truncate" style={{ color: '#29ABE2' }}>{previewEntry.source}</p>
              )}
            </div>
            <button
              onClick={() => setPreviewEntry(null)}
              className="ml-3 shrink-0 rounded p-1 hover:bg-[#F3F4F6] transition-colors"
            >
              <X size={14} style={{ color: '#9CA3AF' }} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {previewEntry.content ? (
              <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: '#374151' }}>
                {previewEntry.content}
              </p>
            ) : (
              <p className="text-xs italic" style={{ color: '#9CA3AF' }}>No content preview available.</p>
            )}
          </div>
          <div className="border-t px-5 py-3 flex justify-between items-center" style={{ borderColor: '#E5E7EB' }}>
            <span className="text-[10px]" style={{ color: '#9CA3AF' }}>
              Updated {formatDate(previewEntry.updated_at)}
            </span>
            {previewEntry.source_type === 'url' && (
              <button
                onClick={() => handleResync(previewEntry)}
                className="flex items-center gap-1 text-[11px] font-medium hover:underline"
                style={{ color: '#29ABE2' }}
              >
                <RefreshCw size={11} /> Re-sync
              </button>
            )}
          </div>
        </div>
      )}

      {/* Add Article modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => { if (e.target === e.currentTarget && !isIngesting) { setShowForm(false); resetForm() } }}
        >
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b px-6 py-5" style={{ borderColor: '#E5E7EB' }}>
              <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>Add Knowledge Article</h2>
              {!isIngesting && (
                <button onClick={() => { setShowForm(false); resetForm() }} className="rounded-lg p-1 hover:bg-[#F3F4F6]">
                  <X size={14} style={{ color: '#9CA3AF' }} />
                </button>
              )}
            </div>

            {isIngesting ? (
              /* Processing state */
              <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
                <Loader2 size={32} className="animate-spin" style={{ color: '#29ABE2' }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#111827' }}>Extracting and embedding...</p>
                  <p className="mt-1 text-xs" style={{ color: '#6B7280' }}>
                    n8n is processing your {sourceTab === 'file' ? 'file' : 'URL'}. This usually takes 10–30 seconds.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-5 px-6 py-5">
                {/* Source tab */}
                <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: '#E5E7EB' }}>
                  {(['file', 'url'] as SourceTab[]).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => { setSourceTab(tab); setUploadFile(null); setUrlInput('') }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors"
                      style={{
                        backgroundColor: sourceTab === tab ? '#1B3A7A' : '#F9FAFB',
                        color: sourceTab === tab ? '#FFFFFF' : '#6B7280',
                      }}
                    >
                      {tab === 'file' ? <Upload size={12} /> : <Link2 size={12} />}
                      {tab === 'file' ? 'Upload File' : 'Import URL'}
                    </button>
                  ))}
                </div>

                {/* File upload zone */}
                {sourceTab === 'file' && (
                  <div>
                    {!uploadFile ? (
                      <label
                        className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 cursor-pointer transition-colors hover:border-[#29ABE2] hover:bg-[#F0F9FF]"
                        style={{ borderColor: '#E5E7EB' }}
                      >
                        <Upload size={20} style={{ color: '#9CA3AF' }} />
                        <div className="text-center">
                          <p className="text-xs font-medium" style={{ color: '#374151' }}>Click to upload a document</p>
                          <p className="text-[11px] mt-0.5" style={{ color: '#9CA3AF' }}>PDF, Word (.docx), or plain text</p>
                        </div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0]
                            if (!f) return
                            setUploadFile(f)
                            if (!titleInput) {
                              setTitleInput(f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '))
                            }
                          }}
                        />
                      </label>
                    ) : (
                      <div className="flex items-center gap-2 rounded-lg border px-3 py-2.5" style={{ borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' }}>
                        <FileText size={14} style={{ color: '#29ABE2' }} />
                        <span className="flex-1 text-xs truncate" style={{ color: '#374151' }}>{uploadFile.name}</span>
                        <button type="button" onClick={() => { setUploadFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}>
                          <X size={13} style={{ color: '#9CA3AF' }} />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* URL input */}
                {sourceTab === 'url' && (
                  <div>
                    <label className="mb-1 block text-xs font-medium" style={{ color: '#374151' }}>URL</label>
                    <div className="flex items-center gap-2 rounded-lg border px-3 py-2" style={{ borderColor: '#E5E7EB' }}>
                      <Globe size={13} style={{ color: '#9CA3AF' }} />
                      <input
                        type="url"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        placeholder="https://relaypay.io/docs/fees"
                        className="flex-1 bg-transparent text-sm outline-none"
                        style={{ color: '#111827' }}
                      />
                    </div>
                  </div>
                )}

                {/* Title */}
                <div>
                  <label className="mb-1 block text-xs font-medium" style={{ color: '#374151' }}>
                    Title <span style={{ color: '#9CA3AF' }}>(auto-filled from file/page)</span>
                  </label>
                  <input
                    value={titleInput}
                    onChange={(e) => setTitleInput(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[#29ABE2]"
                    style={{ borderColor: '#E5E7EB', color: '#111827' }}
                    placeholder="Article title"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="mb-1 block text-xs font-medium" style={{ color: '#374151' }}>Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                    style={{ borderColor: '#E5E7EB', color: '#111827' }}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                    ))}
                  </select>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 border-t pt-4" style={{ borderColor: '#E5E7EB' }}>
                  <button
                    onClick={() => { setShowForm(false); resetForm() }}
                    className="rounded-lg border px-4 py-2 text-xs font-medium hover:bg-[#F9FAFB] transition-colors"
                    style={{ borderColor: '#E5E7EB', color: '#6B7280' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={sourceTab === 'file' ? handleIngestFile : handleIngestUrl}
                    disabled={sourceTab === 'file' ? !uploadFile : !urlInput.trim()}
                    className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium text-white hover:bg-[#162F63] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    style={{ backgroundColor: '#1B3A7A' }}
                  >
                    {sourceTab === 'file' ? <Upload size={12} /> : <Link2 size={12} />}
                    {sourceTab === 'file' ? 'Upload & Embed' : 'Import & Embed'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
