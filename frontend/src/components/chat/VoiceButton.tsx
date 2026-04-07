'use client'

import { Mic, MicOff, Phone, PhoneOff } from 'lucide-react'
import { cn } from '@/lib/utils'

export type VoiceStatus = 'idle' | 'connecting' | 'listening' | 'speaking' | 'error'

interface VoiceButtonProps {
  status: VoiceStatus
  onToggle: () => void
  disabled?: boolean
}

const statusConfig = {
  idle: {
    label: 'Start voice conversation',
    buttonClass: 'bg-[#1B3A7A] hover:bg-[#162F63] text-white',
    icon: Mic,
    showPulse: false,
  },
  connecting: {
    label: 'Connecting...',
    buttonClass: 'bg-[#29ABE2] text-white cursor-wait',
    icon: Phone,
    showPulse: false,
  },
  listening: {
    label: 'Listening — click to stop',
    buttonClass: 'bg-[#1B3A7A] text-white',
    icon: Mic,
    showPulse: true,
  },
  speaking: {
    label: 'Agent speaking',
    buttonClass: 'bg-[#29ABE2] text-white',
    icon: Phone,
    showPulse: false,
  },
  error: {
    label: 'Voice unavailable — try again',
    buttonClass: 'bg-red-600 hover:bg-red-700 text-white',
    icon: MicOff,
    showPulse: false,
  },
}

export function VoiceButton({ status, onToggle, disabled = false }: VoiceButtonProps) {
  const config = statusConfig[status]
  const Icon = config.icon
  const isActive = status === 'listening' || status === 'speaking'

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Pulse ring + button */}
      <div className="relative flex items-center justify-center">
        {config.showPulse && (
          <span
            className="pulse-ring absolute inline-flex h-20 w-20 rounded-full bg-[#1B3A7A] opacity-20"
            aria-hidden
          />
        )}
        <button
          onClick={onToggle}
          disabled={disabled || status === 'connecting' || status === 'speaking'}
          aria-label={config.label}
          className={cn(
            'relative flex h-16 w-16 items-center justify-center rounded-full transition-all duration-200 shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#29ABE2]',
            config.buttonClass,
            (disabled || status === 'connecting' || status === 'speaking') && 'opacity-60 cursor-not-allowed',
          )}
        >
          <Icon size={24} strokeWidth={1.75} />
        </button>
      </div>

      {/* Speaking bars (agent TTS) */}
      {status === 'speaking' && (
        <div className="flex items-end gap-[3px] h-5" aria-label="Agent speaking">
          {[1, 2, 3, 4, 5].map((i) => (
            <span
              key={i}
              className="speaking-bar w-[3px] rounded-full bg-[#29ABE2]"
              style={{ height: '100%' }}
            />
          ))}
        </div>
      )}

      {/* Status label */}
      <p className="text-xs text-[#6B7280] font-medium tracking-wide">
        {isActive ? (
          <button
            onClick={onToggle}
            className="text-[#1B3A7A] underline underline-offset-2 hover:text-[#29ABE2] transition-colors"
          >
            {status === 'speaking' ? 'Agent speaking...' : 'Stop'}
          </button>
        ) : (
          config.label
        )}
      </p>
    </div>
  )
}
