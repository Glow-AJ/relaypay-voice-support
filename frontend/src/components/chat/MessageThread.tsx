'use client'

import { useEffect, useRef } from 'react'
import { Mic, MessageSquare } from 'lucide-react'
import { formatTime } from '@/lib/utils'
import type { Database } from '@/lib/database.types'

type Message = Database['public']['Tables']['messages']['Row']

interface MessageThreadProps {
  messages: Message[]
  isLoading?: boolean
  channel?: 'voice' | 'text'
  partialTranscript?: string
  finalTranscript?: string
  agentSpeaking?: string
}

export function MessageThread({ 
  messages, 
  isLoading = false, 
  channel,
  partialTranscript,
  finalTranscript,
  agentSpeaking
}: MessageThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, partialTranscript, finalTranscript, agentSpeaking])

  const hasLiveTranscript = partialTranscript || finalTranscript || agentSpeaking

  if (messages.length === 0 && !isLoading && !hasLiveTranscript) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#E5E7EB] bg-white">
          <MessageSquare size={20} className="text-[#9CA3AF]" />
        </div>
        <div>
          <p className="text-sm font-medium text-[#374151]">How can we help you today?</p>
          <p className="mt-1 text-xs text-[#9CA3AF]">
            Speak or type your question below
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-1 py-4">
      {messages.map((msg) => (
        <MessageRow key={msg.id} message={msg} channel={channel} />
      ))}
      
      {/* Live Transcripts natively as chat bubbles */}
      {(partialTranscript || finalTranscript) && (
        <LiveMessageRow 
          content={(finalTranscript ? finalTranscript + ' ' : '') + partialTranscript} 
          role="user" 
          isPartial={!!partialTranscript} 
        />
      )}
      {agentSpeaking && (
        <LiveMessageRow content={agentSpeaking} role="assistant" />
      )}

      {isLoading && <ThinkingIndicator />}
      <div ref={bottomRef} />
    </div>
  )
}

function MessageRow({ message, channel }: { message: Message; channel?: 'voice' | 'text' }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
          isUser
            ? 'bg-[#E5E7EB] text-[#6B7280]'
            : 'bg-[#1B3A7A] text-white'
        }`}
      >
        {isUser ? 'YOU' : 'RP'}
      </div>

      {/* Message */}
      <div
        className={`max-w-[75%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-[#F3F4F6] text-[#111827]'
            : 'bg-white border border-[#E5E7EB] text-[#111827]'
        }`}
      >
        <p>{message.content}</p>
        <div className="mt-1.5 flex items-center gap-1.5">
          {(message.audio_url || channel === 'voice') && (
            <span title="Voice message">
              <Mic size={10} className="text-[#9CA3AF]" />
            </span>
          )}
          <time className="text-[10px] text-[#9CA3AF]">{formatTime(message.created_at)}</time>
          {message.action_taken === 'escalated' && (
            <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 border border-amber-200">
              escalated
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function ThinkingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1B3A7A] text-[10px] font-semibold text-white">
        RP
      </div>
      <div className="flex items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-4 py-3">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-[#9CA3AF]"
            style={{ animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite` }}
          />
        ))}
      </div>
    </div>
  )
}

function LiveMessageRow({
  content,
  role,
  isPartial = false,
}: {
  content: string
  role: 'user' | 'assistant'
  isPartial?: boolean
}) {
  const isUser = role === 'user'

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
          isUser
            ? 'bg-[#E5E7EB] text-[#6B7280]'
            : 'bg-[#1B3A7A] text-white'
        }`}
      >
        {isUser ? 'YOU' : 'RP'}
      </div>

      <div
        className={`max-w-[75%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-[#F3F4F6] text-[#111827]'
            : 'bg-white border border-[#E5E7EB] text-[#111827]'
        } ${isPartial ? 'italic opacity-70' : ''}`}
      >
        <p>{content}</p>
        <div className="mt-1.5 flex items-center gap-1.5">
          <span title="Live voice transcription">
            <Mic size={10} className="text-[#29ABE2] animate-pulse" />
          </span>
          <span className="text-[10px] text-[#29ABE2]">Live</span>
        </div>
      </div>
    </div>
  )
}
