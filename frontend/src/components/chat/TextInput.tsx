'use client'

import { useState, useRef, KeyboardEvent } from 'react'
import { Send } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TextInputProps {
  onSend: (message: string) => void
  disabled?: boolean
  placeholder?: string
}

export function TextInput({
  onSend,
  disabled = false,
  placeholder = 'Type your question here...',
}: TextInputProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function handleSend() {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleInput() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }

  return (
    <div className="flex items-end gap-2 rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 shadow-sm focus-within:border-[#29ABE2] transition-colors">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        disabled={disabled}
        placeholder={placeholder}
        rows={1}
        className={cn(
          'flex-1 resize-none bg-transparent text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none',
          disabled && 'cursor-not-allowed opacity-50',
        )}
        style={{ minHeight: '24px', maxHeight: '120px' }}
      />
      <button
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        aria-label="Send message"
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
          value.trim() && !disabled
            ? 'bg-[#1B3A7A] text-white hover:bg-[#162F63]'
            : 'bg-[#F3F4F6] text-[#9CA3AF] cursor-not-allowed',
        )}
      >
        <Send size={14} />
      </button>
    </div>
  )
}
