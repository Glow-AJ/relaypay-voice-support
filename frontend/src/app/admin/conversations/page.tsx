'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Search, Mic, MessageSquare, Loader2 } from 'lucide-react'
import { formatDate, formatTime } from '@/lib/utils'
import type { Database } from '@/lib/database.types'

type Conversation = Database['public']['Tables']['conversations']['Row']
type Message = Database['public']['Tables']['messages']['Row']

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selected, setSelected] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from('conversations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)
      if (data) setConversations(data)
      setLoading(false)
    }
    fetch()
  }, [])

  useEffect(() => {
    if (!selected) return
    async function fetchMessages() {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', selected!.id)
        .order('created_at', { ascending: true })
      if (data) setMessages(data)
    }
    fetchMessages()
  }, [selected])

  const filtered = conversations.filter((c) =>
    search === '' || c.session_id.includes(search)
  )

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* List — hidden on mobile when a conversation is selected */}
      <div
        className={`flex flex-col border-r overflow-hidden md:w-1/3 ${selected ? 'hidden md:flex' : 'flex w-full'}`}
        style={{ borderColor: '#E5E7EB' }}
      >
        <div className="border-b bg-white px-4 py-4 md:px-6 md:py-5" style={{ borderColor: '#E5E7EB' }}>
          <h1 className="text-base font-semibold" style={{ color: '#111827' }}>Conversations</h1>
          <div className="mt-3 flex items-center gap-2 rounded-lg border px-3 py-1.5" style={{ borderColor: '#E5E7EB' }}>
            <Search size={13} style={{ color: '#9CA3AF' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search sessions..."
              className="flex-1 bg-transparent text-xs outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-[#F3F4F6]">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={18} className="animate-spin" style={{ color: '#9CA3AF' }} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex justify-center py-12">
              <p className="text-xs" style={{ color: '#9CA3AF' }}>No conversations yet</p>
            </div>
          ) : filtered.map((conv) => (
            <button
              key={conv.id}
              onClick={() => setSelected(conv)}
              className="w-full text-left px-4 py-4 md:px-6 transition-colors hover:bg-[#FAFAFA]"
              style={{ backgroundColor: selected?.id === conv.id ? '#F5F8FF' : undefined }}
            >
              <div className="flex items-center gap-2 mb-1">
                {conv.channel === 'voice'
                  ? <Mic size={12} style={{ color: '#29ABE2' }} />
                  : <MessageSquare size={12} style={{ color: '#6B7280' }} />
                }
                <span className="text-[11px] font-mono truncate" style={{ color: '#9CA3AF' }}>
                  {conv.session_id.slice(0, 24)}...
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-medium capitalize"
                  style={{
                    backgroundColor: conv.status === 'escalated' ? '#FEF3C7' : conv.status === 'active' ? '#D1FAE5' : '#F3F4F6',
                    color: conv.status === 'escalated' ? '#92400E' : conv.status === 'active' ? '#065F46' : '#6B7280',
                  }}
                >
                  {conv.status}
                </span>
                <span className="text-[10px]" style={{ color: '#9CA3AF' }}>{formatDate(conv.created_at)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Messages — hidden on mobile when no conversation selected */}
      <div className={`flex-1 flex-col overflow-hidden ${selected ? 'flex' : 'hidden md:flex'}`}>
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
            <div className="border-b bg-white px-4 py-4 md:px-6 shrink-0" style={{ borderColor: '#E5E7EB' }}>
              <div className="flex items-center gap-2">
                {selected.channel === 'voice' ? <Mic size={14} style={{ color: '#29ABE2' }} /> : <MessageSquare size={14} style={{ color: '#6B7280' }} />}
                <span className="text-xs font-medium capitalize" style={{ color: '#374151' }}>{selected.channel} conversation</span>
              </div>
              <p className="text-[11px] font-mono mt-0.5" style={{ color: '#9CA3AF' }}>{selected.session_id}</p>
            </div>
            <div className="flex-1 overflow-y-auto flex flex-col gap-3 px-4 py-4 md:px-6">
              {messages.filter(m => m.role === 'user' || m.role === 'assistant').map((msg) => (
                <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold ${msg.role === 'user' ? 'bg-[#E5E7EB] text-[#6B7280]' : 'bg-[#1B3A7A] text-white'}`}>
                    {msg.role === 'user' ? 'U' : 'RP'}
                  </div>
                  <div className={`max-w-[75%] rounded-xl px-3 py-2.5 text-xs ${msg.role === 'user' ? 'bg-[#F3F4F6]' : 'bg-white border'}`} style={{ borderColor: '#E5E7EB' }}>
                    <p style={{ color: '#111827' }}>{msg.content}</p>
                    <div className="mt-1 flex gap-2">
                      <time className="text-[10px]" style={{ color: '#9CA3AF' }}>{formatTime(msg.created_at)}</time>
                      {msg.action_taken && (
                        <span className="text-[10px]" style={{ color: '#9CA3AF' }}>· {msg.action_taken}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-xs" style={{ color: '#9CA3AF' }}>Select a conversation to view messages</p>
          </div>
        )}
      </div>
    </div>
  )
}
