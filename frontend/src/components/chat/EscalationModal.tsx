'use client'

import { useState } from 'react'
import { X, Calendar, User, Mail, Clock, CheckCircle } from 'lucide-react'
import { validateEmail } from '@/lib/utils'

export interface EscalationFormData {
  name: string
  email: string
  preferredDate: string
  preferredTime: string
  timezone: string
}

export interface BookingResult {
  available: boolean
  display_time?: string
  alternatives?: string[]
  calendar_link?: string
}

interface EscalationModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: EscalationFormData) => Promise<BookingResult>
  aiMessage?: string
}

export function EscalationModal({ isOpen, onClose, onSubmit, aiMessage }: EscalationModalProps) {
  const [form, setForm] = useState<EscalationFormData>({
    name: '',
    email: '',
    preferredDate: '',
    preferredTime: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [bookingResult, setBookingResult] = useState<BookingResult | null>(null)
  const [error, setError] = useState('')

  if (!isOpen) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.name || !form.email || !form.preferredDate || !form.preferredTime) {
      setError('Please fill in all fields.')
      return
    }
    if (!validateEmail(form.email)) {
      setError('Please enter a valid email address.')
      return
    }
    setIsSubmitting(true)
    try {
      const result = await onSubmit(form)
      setBookingResult(result)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Booked successfully
  if (bookingResult?.available) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
        <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
          <div className="flex flex-col items-center gap-4 px-6 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-50 border border-green-200">
              <CheckCircle size={20} className="text-green-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#111827]">Call Scheduled</p>
              <p className="mt-1 text-xs text-[#6B7280]">
                {bookingResult.display_time
                  ? `Your call is confirmed for ${bookingResult.display_time}.`
                  : 'Your call has been confirmed.'}
              </p>
              <p className="mt-2 text-xs text-[#6B7280]">
                Check your email for the calendar invite.
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg bg-[#1B3A7A] px-5 py-2 text-sm font-medium text-white hover:bg-[#162F63] transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Slot not available — show alternatives
  if (bookingResult && !bookingResult.available) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
        <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
          <div className="flex items-start justify-between border-b border-[#E5E7EB] px-6 py-5">
            <div>
              <h2 className="text-base font-semibold text-[#111827]">That slot is not available</h2>
              <p className="mt-0.5 text-xs text-[#6B7280]">Please choose one of the open times below.</p>
            </div>
            <button onClick={onClose} className="ml-4 rounded-lg p-1 text-[#9CA3AF] hover:bg-[#F3F4F6] transition-colors">
              <X size={16} />
            </button>
          </div>
          <div className="px-6 py-5 flex flex-col gap-3">
            <p className="text-sm text-[#6B7280] text-center py-2">
              Use the button below to pick any available time from our live calendar.
            </p>
            {bookingResult.calendar_link && (
              <a
                href={bookingResult.calendar_link}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full rounded-lg bg-[#1B3A7A] py-2.5 text-center text-sm font-medium text-white hover:bg-[#162F63] transition-colors block"
              >
                View Available Times
              </a>
            )}
            <button
              onClick={onClose}
              className="w-full rounded-lg border border-[#E5E7EB] py-2.5 text-sm text-[#6B7280] hover:bg-[#F9FAFB] transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Default: booking form
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#E5E7EB] px-6 py-5">
          <div>
            <h2 className="text-base font-semibold text-[#111827]">Schedule a Support Call</h2>
            <p className="mt-0.5 text-xs text-[#6B7280]">
              {aiMessage || 'A RelayPay specialist will follow up with you directly.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 rounded-lg p-1 text-[#9CA3AF] hover:bg-[#F3F4F6] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
          <Field label="Full Name" icon={User}>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ada Okonkwo"
              className="field-input"
              required
            />
          </Field>

          <Field label="Email Address" icon={Mail}>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="ada@startup.com"
              className="field-input"
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Preferred Date" icon={Calendar}>
              <input
                type="date"
                value={form.preferredDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setForm({ ...form, preferredDate: e.target.value })}
                className="field-input"
                required
              />
            </Field>
            <Field label="Preferred Time" icon={Clock}>
              <input
                type="time"
                value={form.preferredTime}
                onChange={(e) => setForm({ ...form, preferredTime: e.target.value })}
                className="field-input"
                required
              />
            </Field>
          </div>

          <Field label="Timezone">
            <input
              type="text"
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              className="field-input"
            />
          </Field>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-[#1B3A7A] py-2.5 text-sm font-medium text-white hover:bg-[#162F63] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Checking availability...' : 'Schedule Call'}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg border border-[#E5E7EB] py-2.5 text-sm text-[#6B7280] hover:bg-[#F9FAFB] transition-colors"
          >
            No thanks
          </button>
        </form>
      </div>

      <style jsx>{`
        .field-input {
          width: 100%;
          background: transparent;
          font-size: 13px;
          color: #111827;
          outline: none;
        }
        .field-input::placeholder { color: #9CA3AF; }
      `}</style>
    </div>
  )
}

function Field({
  label,
  icon: Icon,
  children,
}: {
  label: string
  icon?: React.ComponentType<{ size?: number; className?: string }>
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-[#374151]">{label}</label>
      <div className="flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2 focus-within:border-[#29ABE2] transition-colors">
        {Icon && <Icon size={14} className="shrink-0 text-[#9CA3AF]" />}
        {children}
      </div>
    </div>
  )
}
