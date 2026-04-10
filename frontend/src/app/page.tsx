'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Vapi from '@vapi-ai/web'
import { supabase } from '@/lib/supabase'
import { generateSessionId } from '@/lib/utils'
import { RelayPayLogo } from '@/components/RelayPayLogo'
import { VapiErrorBoundary } from '@/components/VapiErrorBoundary'
import { VoiceButton, VoiceStatus } from '@/components/chat/VoiceButton'
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
  const [conversationChannel, setConversationChannel] = useState<'voice' | 'text'>('text')
  const [partialTranscript, setPartialTranscript] = useState('')
  const [finalTranscript, setFinalTranscript] = useState('')
  const [agentSubtitle, setAgentSubtitle] = useState('')
  const [activeTab, setActiveTab] = useState<'voice' | 'text'>('text')

  const vapiRef = useRef<Vapi | null>(null)
  // Mirror voiceStatus in a ref so real-time subscription callbacks can read current value
  const voiceStatusRef = useRef<VoiceStatus>('idle')
  useEffect(() => { voiceStatusRef.current = voiceStatus }, [voiceStatus])

  // Init VAPI
  useEffect(() => {
    const webToken = process.env.NEXT_PUBLIC_VAPI_WEB_TOKEN
    if (!webToken || webToken === 'your_vapi_web_token_here') return

    const vapi = new Vapi(webToken)
    vapiRef.current = vapi

    const onCallStart = () => setVoiceStatus('listening')
    const onCallEnd = () => {
      setVoiceStatus('idle')
      setPartialTranscript('')
      setFinalTranscript('')
      setAgentSubtitle('')
    }
    const onSpeechStart = () => setVoiceStatus('speaking')
    const onSpeechEnd = () => setVoiceStatus('listening')
    const onError = (e: any) => {
      console.error('VAPI Error:', e)
      setVoiceStatus('error')
    }
    const onMessage = (msg: any) => {
      // Defensively strictly enforce strings so we don't crash the React tree with object rendering
      if (msg.type === 'transcript') {
        const text = typeof msg.transcript === 'string' ? msg.transcript 
                    : (msg.transcript?.text || msg.transcript?.content || '');
        
        // Correctly route to Agent or User based on the defined role
        if (msg.role === 'assistant') {
          setAgentSubtitle(text)
        } else {
          if (msg.transcriptType === 'partial') setPartialTranscript(text)
          else if (msg.transcriptType === 'final') {
            setFinalTranscript(text)
            setPartialTranscript('')
            setAgentSubtitle('') // clear agent text when user speaks
          }
        }
      }
      // model-output is an older vapi pattern, but supported just in case
      if (msg.type === 'model-output') {
        const text = typeof msg.output === 'string' ? msg.output 
                    : (msg.output?.content || msg.output?.text || '');
        setAgentSubtitle(text)
      }
    }

    vapi.on('call-start', onCallStart)
    vapi.on('call-end', onCallEnd)
    vapi.on('speech-start', onSpeechStart)
    vapi.on('speech-end', onSpeechEnd)
    vapi.on('error', onError)
    vapi.on('message', onMessage)

    return () => {
      vapi.off('call-start', onCallStart)
      vapi.off('call-end', onCallEnd)
      vapi.off('speech-start', onSpeechStart)
      vapi.off('speech-end', onSpeechEnd)
      vapi.off('error', onError)
      vapi.off('message', onMessage)
      
      try { vapi.stop() } catch (_) {}
    }
  }, [])

  // Load existing conversation
  useEffect(() => {
    async function loadConversation() {
      const { data: conv } = await supabase
        .from('conversations')
        .select('id, channel')
        .eq('session_id', sessionId)
        .eq('status', 'active')
        .maybeSingle()

      if (conv) {
        setConversationId(conv.id)
        setConversationChannel((conv.channel as 'voice' | 'text') ?? 'text')
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
        const newMsg = payload.new as Message
        setMessages((prev) => {
          const exists = prev.some((m) => m.id === newMsg.id)
          return exists ? prev : [...prev, newMsg]
        })
        // Voice escalation: show modal when escalated message arrives during active voice call
        if (
          newMsg.action_taken === 'escalated' &&
          (voiceStatusRef.current === 'listening' || voiceStatusRef.current === 'speaking' || voiceStatusRef.current === 'connecting')
        ) {
          setEscalationMessage(newMsg.content)
          setShowEscalation(true)
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [conversationId])

  // Ensure conversation exists non-blocking to prevent WebRTC mic permission timeouts
  const ensureConversation = useCallback((channel: 'voice' | 'text'): string => {
    if (conversationId) return conversationId

    // Generate reliable local UUID
    const newId = (typeof crypto !== 'undefined' && crypto.randomUUID) 
      ? crypto.randomUUID() 
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = Math.random() * 16 | 0
          return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
        })

    setConversationId(newId)
    setConversationChannel(channel)

    // Fire-and-forget DB insertion to preserve synchronous click context
    supabase
      .from('conversations')
      .insert({ id: newId, session_id: sessionId, channel, status: 'active' })
      .then(({ error }) => { if (error) console.error('Failed to save conv:', error) })

    return newId
  }, [conversationId, sessionId])

  // Send text message via n8n
  const handleSendText = useCallback(async (content: string) => {
    if (isSending) return
    setIsSending(true)
    try {
      const convId = ensureConversation('text')

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

  // Start a new conversation session
  const handleNewConversation = useCallback(() => {
    // Stop any active voice call
    if (vapiRef.current && (voiceStatus === 'listening' || voiceStatus === 'speaking')) {
      vapiRef.current.stop()
    }
    // Clear session from localStorage so a new one is generated on next load
    localStorage.removeItem('rp_session_id')
    // Reset all state and reload the page cleanly
    window.location.reload()
  }, [voiceStatus])

  // Toggle voice call — must stay synchronous to preserve browser user-gesture for WebRTC
  const handleVoiceToggle = useCallback(() => {
    if (!vapiRef.current) { setVoiceStatus('error'); return }

    if (voiceStatus === 'idle' || voiceStatus === 'error') {
      // Generate conversation ID instantly (synchronous, no await) so vapi.start()
      // fires in the same tick as the click — satisfying the browser's security rule
      const convId = ensureConversation('voice')
      setVoiceStatus('connecting')

      vapiRef.current.start(
        process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID as string,
        {
          metadata: { session_id: sessionId, conversation_id: convId },
          variableValues: {
            currentDateTime: new Date().toLocaleString(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        },
      ).catch((err: Error) => {
        console.error('VAPI start error:', err)
        setVoiceStatus('error')
      })
    } else {
      vapiRef.current.stop()
      setVoiceStatus('idle')
    }
  }, [voiceStatus, ensureConversation, sessionId])

  // Send a system message into the live VAPI call (no-op if no active call)
  const sendVapiSystemMessage = useCallback((content: string) => {
    if (!vapiRef.current) return
    const vs = voiceStatusRef.current
    if (vs === 'listening' || vs === 'speaking') {
      vapiRef.current.send({
        type: 'add-message',
        message: { role: 'system', content },
      })
    }
  }, [])

  // Close escalation modal — tell VAPI if voice call is active
  const handleEscalationClose = useCallback(() => {
    setShowEscalation(false)
    sendVapiSystemMessage('Customer closed the escalation form without submitting.')
  }, [sendVapiSystemMessage])

  // Escalation booking — returns availability result from n8n, then tells VAPI
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
    sendVapiSystemMessage('Customer submitted the escalation form.')
    return result as BookingResult
  }, [sessionId, conversationId, sendVapiSystemMessage])

  return (
    <div className="flex h-screen flex-col" style={{ backgroundColor: '#F7F8FA' }}>
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b bg-white px-4 py-3 md:px-6 md:py-4" style={{ borderColor: '#E5E7EB' }}>
        <RelayPayLogo size="md" />
        <div className="flex items-center gap-3">
          {messages.length > 0 && (
            <button
              onClick={handleNewConversation}
              className="text-xs font-medium underline underline-offset-2 transition-colors"
              style={{ color: '#6B7280' }}
            >
              New conversation
            </button>
          )}
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-xs" style={{ color: '#6B7280' }}>Support Online</span>
          </div>
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

        {/* Messages — filters out system/tool_calls roles, handles both DB history and Live Vapi transcription */}
        <div className="flex-1 overflow-y-auto">
          <MessageThread
            messages={messages.filter(m => m.role === 'user' || m.role === 'assistant')}
            isLoading={isSending}
            channel={conversationChannel}
            partialTranscript={partialTranscript}
            finalTranscript={finalTranscript}
            agentSpeaking={agentSubtitle}
          />
        </div>

        {/* Controls */}
        <VapiErrorBoundary>
          <div className="mt-3 flex flex-col items-center gap-3 w-full shrink-0">
            
            {/* Tab Switcher */}
            <div className="flex w-full max-w-[200px] rounded-full bg-[#F3F4F6] p-1 border border-[#E5E7EB]">
              <button
                onClick={() => setActiveTab('text')}
                className={`flex-1 rounded-full py-1.5 text-[11px] font-semibold transition-all ${
                  activeTab === 'text' ? 'bg-white text-[#111827] shadow-sm border border-[#E5E7EB]' : 'text-[#9CA3AF] hover:text-[#6B7280]'
                }`}
              >
                Keyboard
              </button>
              <button
                onClick={() => setActiveTab('voice')}
                className={`flex-1 rounded-full py-1.5 text-[11px] font-semibold transition-all ${
                  activeTab === 'voice' ? 'bg-white text-[#111827] shadow-sm border border-[#E5E7EB]' : 'text-[#9CA3AF] hover:text-[#6B7280]'
                }`}
              >
                Voice
              </button>
            </div>

            {/* Input Area */}
            <div className="w-full flex justify-center items-center min-h-[50px]">
              {activeTab === 'voice' ? (
                <div className="-mt-2">
                  <VoiceButton status={voiceStatus} onToggle={handleVoiceToggle} disabled={isSending} />
                </div>
              ) : (
                <div className="w-full px-1">
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
              )}
            </div>

            <p className="text-[10px] text-center" style={{ color: '#9CA3AF' }}>
              Powered by RelayPay Support
            </p>
          </div>
        </VapiErrorBoundary>
      </main>

      <EscalationModal
        isOpen={showEscalation}
        onClose={handleEscalationClose}
        onSubmit={handleEscalationSubmit}
        aiMessage={escalationMessage}
      />
    </div>
  )
}
