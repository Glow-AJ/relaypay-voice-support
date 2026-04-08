'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Search, Edit2, Trash2, ToggleLeft, ToggleRight, Loader2, Upload, FileText, X } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'
import type { Database } from '@/lib/database.types'

type KBEntry = Database['public']['Tables']['knowledge_base']['Row']

const CATEGORIES = ['fees', 'onboarding', 'payouts', 'invoicing', 'compliance', 'general', 'troubleshooting']

type InputMode = 'type' | 'upload'

export default function KnowledgeBasePage() {
  const [entries, setEntries] = useState<KBEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editEntry, setEditEntry] = useState<KBEntry | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [inputMode, setInputMode] = useState<InputMode>('type')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [isExtracting, setIsExtracting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    setInputMode('type')
    setUploadedFile(null)
    setShowForm(true)
  }

  function openEdit(entry: KBEntry) {
    setEditEntry(entry)
    setForm({ title: entry.title, content: entry.content, category: entry.category, source: entry.source || '' })
    setInputMode('type')
    setUploadedFile(null)
    setShowForm(true)
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadedFile(file)
    setIsExtracting(true)

    const titleFromFile = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')

    try {
      // Primary: n8n server-side extraction (better quality, feeds embedding pipeline)
      const n8nBase = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL
      if (n8nBase) {
        try {
          const fd = new FormData()
          fd.append('file', file)
          fd.append('filename', file.name)
          const res = await fetch(`${n8nBase}/relaypay-kb-extract`, { method: 'POST', body: fd })
          if (res.ok) {
            const { text } = await res.json()
            setForm((prev) => ({
              ...prev,
              title: prev.title || titleFromFile,
              content: text.trim(),
            }))
            return
          }
        } catch {
          // n8n endpoint not yet live — fall through to client-side extraction
        }
      }

      // Fallback: client-side extraction (pdfjs-dist / mammoth)
      let text = ''
      if (file.type === 'application/pdf') {
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
        const arrayBuffer = await file.arrayBuffer()
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
        const pages: string[] = []
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i)
          const textContent = await page.getTextContent()
          pages.push(textContent.items.map((item: any) => ('str' in item ? item.str : '')).join(' '))
        }
        text = pages.join('\n\n')
      } else if (
        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.name.endsWith('.docx')
      ) {
        const mammoth = await import('mammoth')
        const arrayBuffer = await file.arrayBuffer()
        const result = await mammoth.extractRawText({ arrayBuffer })
        text = result.value
      } else {
        text = await file.text()
      }

      setForm((prev) => ({
        ...prev,
        title: prev.title || titleFromFile,
        content: text.trim(),
      }))
    } catch (err) {
      console.error('File extraction failed:', err)
      toast.error('Could not extract text from this file. Please paste the content manually.')
      setInputMode('type')
    } finally {
      setIsExtracting(false)
    }
  }

  function clearFile() {
    setUploadedFile(null)
    setForm((prev) => ({ ...prev, content: '' }))
    if (fileInputRef.current) fileInputRef.current.value = ''
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

    // Trigger embedding sync in n8n (non-blocking)
    try {
      await fetch(`${process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL}/relaypay-kb-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: editEntry ? 'update' : 'create', title: form.title }),
      })
    } catch { /* n8n may not be live yet — non-blocking */ }

    setShowForm(false)
    setUploadedFile(null)
    setIsSaving(false)
    fetchEntries()
  }

  async function handleToggle(entry: KBEntry) {
    await supabase.from('knowledge_base').update({ is_active: !entry.is_active }).eq('id', entry.id)
    fetchEntries()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this article? This cannot be undone.')) return
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
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl max-h-[90vh] flex flex-col">
            <div className="border-b px-6 py-5 shrink-0" style={{ borderColor: '#E5E7EB' }}>
              <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>
                {editEntry ? 'Edit Article' : 'New Article'}
              </h2>
            </div>

            <div className="flex flex-col gap-4 px-6 py-5 overflow-y-auto">
              {/* Title */}
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

              {/* Category */}
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

              {/* Content — toggle between type and upload */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-xs font-medium" style={{ color: '#374151' }}>Content</label>
                  {/* Mode toggle */}
                  <div className="flex rounded-lg border overflow-hidden text-[11px]" style={{ borderColor: '#E5E7EB' }}>
                    <button
                      type="button"
                      onClick={() => setInputMode('type')}
                      className="px-3 py-1 transition-colors font-medium"
                      style={{
                        backgroundColor: inputMode === 'type' ? '#1B3A7A' : '#F9FAFB',
                        color: inputMode === 'type' ? '#FFFFFF' : '#6B7280',
                      }}
                    >
                      Type
                    </button>
                    <button
                      type="button"
                      onClick={() => setInputMode('upload')}
                      className="px-3 py-1 transition-colors font-medium"
                      style={{
                        backgroundColor: inputMode === 'upload' ? '#1B3A7A' : '#F9FAFB',
                        color: inputMode === 'upload' ? '#FFFFFF' : '#6B7280',
                      }}
                    >
                      Upload File
                    </button>
                  </div>
                </div>

                {inputMode === 'type' ? (
                  <textarea
                    value={form.content}
                    onChange={(e) => setForm({ ...form, content: e.target.value })}
                    rows={8}
                    className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[#29ABE2] resize-none"
                    style={{ borderColor: '#E5E7EB', color: '#111827' }}
                    placeholder="Paste or type the article content — this is what the AI uses to answer questions..."
                  />
                ) : (
                  <div>
                    {/* Drop zone */}
                    {!uploadedFile ? (
                      <label
                        className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 cursor-pointer transition-colors hover:border-[#29ABE2] hover:bg-[#F0F9FF]"
                        style={{ borderColor: '#E5E7EB' }}
                      >
                        <Upload size={20} style={{ color: '#9CA3AF' }} />
                        <div className="text-center">
                          <p className="text-xs font-medium" style={{ color: '#374151' }}>
                            Click to upload a document
                          </p>
                          <p className="text-[11px] mt-0.5" style={{ color: '#9CA3AF' }}>
                            PDF, Word (.docx), or plain text
                          </p>
                        </div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                      </label>
                    ) : (
                      <div>
                        {/* File chip */}
                        <div className="mb-3 flex items-center gap-2 rounded-lg border px-3 py-2" style={{ borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' }}>
                          <FileText size={14} style={{ color: '#29ABE2' }} />
                          <span className="flex-1 text-xs truncate" style={{ color: '#374151' }}>{uploadedFile.name}</span>
                          {isExtracting
                            ? <Loader2 size={13} className="animate-spin shrink-0" style={{ color: '#9CA3AF' }} />
                            : (
                              <button type="button" onClick={clearFile} className="shrink-0">
                                <X size={13} style={{ color: '#9CA3AF' }} />
                              </button>
                            )
                          }
                        </div>

                        {/* Extracted text — editable */}
                        {!isExtracting && (
                          <textarea
                            value={form.content}
                            onChange={(e) => setForm({ ...form, content: e.target.value })}
                            rows={7}
                            className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[#29ABE2] resize-none"
                            style={{ borderColor: '#E5E7EB', color: '#111827' }}
                            placeholder="Extracted text will appear here — you can edit it before saving..."
                          />
                        )}

                        {isExtracting && (
                          <div className="flex items-center gap-2 py-4 justify-center">
                            <Loader2 size={14} className="animate-spin" style={{ color: '#29ABE2' }} />
                            <span className="text-xs" style={{ color: '#6B7280' }}>Extracting text from document...</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Source URL */}
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: '#374151' }}>Source URL <span style={{ color: '#9CA3AF' }}>(optional)</span></label>
                <input
                  value={form.source}
                  onChange={(e) => setForm({ ...form, source: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[#29ABE2]"
                  style={{ borderColor: '#E5E7EB', color: '#111827' }}
                  placeholder="https://relaypay.io/docs/..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t px-6 py-4 shrink-0" style={{ borderColor: '#E5E7EB' }}>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg border px-4 py-2 text-xs font-medium transition-colors hover:bg-[#F9FAFB]"
                style={{ borderColor: '#E5E7EB', color: '#6B7280' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || isExtracting || !form.title.trim() || !form.content.trim()}
                className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#162F63] disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#1B3A7A' }}
              >
                {isSaving && <Loader2 size={12} className="animate-spin" />}
                {editEntry ? 'Update Article' : 'Save & Embed'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
