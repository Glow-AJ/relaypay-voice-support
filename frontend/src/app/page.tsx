'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Vapi from '@vapi-ai/web'
import { supabase } from '@/lib/supabase'
import { generateSessionId } from '@/lib/utils'
import { RelayPayLogo } from '@/components/RelayPayLogo'
import { VoiceButton, VoiceStatus } from '@/components/chat/VoiceButton'
import { TranscriptDisplay } from '@/components/chat/TranscriptDisplay'
import { MessageThread } from '@/components/chat/MessageThread'
import { TextInput } from '@/components/chat/TextInput'
import { EscalationModal, EscalationFormData, BookingResult } from '@/components/chat/EscalationModal'
import type { Database } from '@/lib/database.types'

type Message = Database['public']['Tables']['messages']['Row']

function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return generateSessionId()
  const stored = localStorage.getItem('rp_session_id')
  if (stored) return stored
  const id = generateSessionId()
  localStorage.setItem('rp_session_id', id)
  return id
}

export default function SupportPage() {
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle')
  const [messages, setMessages] = useState<Message[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [sessionId] = useState(() => getOrCreateSessionId())
  const [isSending, setIsSending] = useState(false)
  const [showEscalation, setShowEscalation] = useState(false)
  const [escalationMessage, setEscalationMessage] = useState('')
  const [partialTranscript, setPartialTranscript] = useState('')
  const [finalTranscript, setFinalTranscript] = useState('')
  const [agentSubtitle, setAgentSubtitle] = useState('')

  const vapiRef = useRef<Vapi | null>(null)

  // Init VAPI
  useEffect(() => {
    const webToken = process.env.NEXT_PUBLIC_VAPI_WEB_TOKEN
    if (!webToken || webToken === 'your_vapi_web_token_here') return

    const vapi = new Vapi(webToken)
    vapiRef.current = vapi

    vapi.on('call-start', () => setVoiceStatus('listening'))
    vapi.on('call-end', () => {
      setVoiceStatus('idle')
      setPartialTranscript('')
      setFinalTranscript('')
      setAgentSubtitle('')
    })
    vapi.on('speech-start', () => setVoiceStatus('speaking'))
    vapi.on('speech-end', () => setVoiceStatus('listening'))
    vapi.on('error', () => setVoiceStatus('error'))

    vapi.on('message', (msg: any) => {
      if (msg.type === 'transcript') {
        if (msg.transcriptType === 'partial') setPartialTranscript(msg.transcript)
        else if (msg.transcriptType === 'final') {
          setFinalTranscript(msg.transcript)
          setPartialTranscript('')
        }
      }
      if (msg.type === 'model-output') setAgentSubtitle(msg.output || '')
    })

    return () => { vapi.stop() }
  }, [])

  // Load existing conversation
  useEffect(() => {
    async function loadConversation() {
      const { data: conv } = await supabase
        .from('conversations')
        .select('id')
        .eq('session_id', sessionId)
        .eq('status', 'active')
        .maybeSingle()

      if (conv) {
        setConversationId(conv.id)
        const { data: msgs } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: true })
        if (msgs) setMessages(msgs)
      }
    }
    loadConversation()
  }, [sessionId])

  // Real-time message subscription
  useEffect(() => {
    if (!conversationId) return

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        setMessages((prev) => {
          const exists = prev.some((m) => m.id === payload.new.id)
          return exists ? prev : [...prev, payload.new as Message]
        })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [conversationId])

  // Ensure conversation exists
  const ensureConversation = useCallback(async (channel: 'voice' | 'text'): Promise<string> => {
    if (conversationId) return conversationId
    const { data, error } = await supabase
      .from('conversations')
      .insert({ session_id: sessionId, channel, status: 'active' })
      .select('id')
      .single()
    if (error || !data) throw new Error('Failed to create conversation')
    setConversationId(data.id)
    return data.id
  }, [conversationId, sessionId])

  // Send text message via n8n
  const handleSendText = useCallback(async (content: string) => {
    if (isSending) return
    setIsSending(true)
    try {
      const convId = await ensureConversation('text')

      // Optimistic UI
      const tempMsg: Message = {
        id: `temp_${Date.now()}`,
        conversation_id: convId,
        role: 'user',
        content,
        audio_url: null,
        transcript_confidence: null,
        intent: null,
        action_taken: null,
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, tempMsg])

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL}/relaypay-text`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: content,
            session_id: sessionId,
            conversation_id: convId,
            channel: 'text',
          }),
        },
      )

      if (!response.ok) throw new Error('Response error')
      const data = await response.json()

      if (data.action === 'escalated') {
        setEscalationMessage(data.message || 'A specialist can help you with this. Would you like to schedule a call?')
        setShowEscalation(true)
      }
    } catch (err) {
      console.error('Failed to send:', err)
    } finally {
      setIsSending(false)
    }
  }, [isSending, ensureConversation, sessionId])

  // Toggle voice call
  const handleVoiceToggle = useCallback(async () => {
    if (!vapiRef.current) { setVoiceStatus('error'); return }

    if (voiceStatus === 'idle' || voiceStatus === 'error') {
      setVoiceStatus('connecting')
      try {
        const convId = await ensureConversation('voice')
        await vapiRef.current.start({
          assistantId: process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID,
          assistantOverrides: {
            metadata: { session_id: sessionId, conversation_id: convId },
          },
        } as any)
      } catch { setVoiceStatus('error') }
    } else {
      vapiRef.current.stop()
      setVoiceStatus('idle')
    }
  }, [voiceStatus, ensureConversation, sessionId])

  // Escalation booking — returns availability result from n8n
  const handleEscalationSubmit = useCallback(async (data: EscalationFormData): Promise<BookingResult> => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL}/relaypay-book-appointment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        session_id: sessionId,
        conversation_id: conversationId,
      }),
    })
    if (!response.ok) throw new Error('Booking request failed')
    const result = await response.json()
    return result as BookingResult
  }, [sessionId, conversationId])

  return (
    <div className="flex h-screen flex-col" style={{ backgroundColor: '#F7F8FA' }}>
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b bg-white px-6 py-4" style={{ borderColor: '#E5E7EB' }}>
        <RelayPayLogo size="md" />
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          <span className="text-xs" style={{ color: '#6B7280' }}>Support Online</span>
        </div>
      </header>

      {/* Body */}
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col overflow-hidden px-4 py-6">

        {/* Welcome card — only shown before any messages */}
        {messages.length === 0 && (
          <div className="mb-6 rounded-xl border bg-white px-6 py-5" style={{ borderColor: '#E5E7EB' }}>
            <p className="text-sm font-semibold" style={{ color: '#111827' }}>How can we help you today?</p>
            <p className="mt-1 text-xs leading-relaxed" style={{ color: '#6B7280' }}>
              Ask about payments, fees, invoicing, payouts, or compliance.
              Use the microphone to speak, or type your question below.
            </p>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <MessageThread messages={messages} isLoading={isSending} />
        </div>

        {/* Live transcript / subtitle */}
        {(partialTranscript || finalTranscript || agentSubtitle) && (
          <div className="mt-3">
            <TranscriptDisplay
              partial={partialTranscript}
              final={finalTranscript}
              agentSpeaking={agentSubtitle}
            />
          </div>
        )}

        {/* Controls */}
        <div className="mt-5 flex flex-col items-center gap-4">
          <VoiceButton status={voiceStatus} onToggle={handleVoiceToggle} disabled={isSending} />

          <div className="flex w-full items-center gap-3">
            <div className="h-px flex-1" style={{ backgroundColor: '#E5E7EB' }} />
            <span className="text-[11px] font-medium" style={{ color: '#9CA3AF' }}>or type</span>
            <div className="h-px flex-1" style={{ backgroundColor: '#E5E7EB' }} />
          </div>

          <div className="w-full">
            <TextInput
              onSend={handleSendText}
              disabled={isSending || voiceStatus === 'listening' || voiceStatus === 'speaking'}
              placeholder={
                voiceStatus !== 'idle' && voiceStatus !== 'error'
                  ? 'Voice session active...'
                  : 'Type your question here...'
              }
            />
          </div>

          <p className="text-[11px]" style={{ color: '#9CA3AF' }}>
            Powered by RelayPay Support · Responses grounded in official documentation
          </p>
        </div>
      </main>

      <EscalationModal
        isOpen={showEscalation}
        onClose={() => setShowEscalation(false)}
        onSubmit={handleEscalationSubmit}
        aiMessage={escalationMessage}
      />
    </div>
  )
}
