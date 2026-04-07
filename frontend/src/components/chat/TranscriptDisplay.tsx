'use client'

interface TranscriptDisplayProps {
  partial: string
  final: string
  agentSpeaking: string
}

export function TranscriptDisplay({ partial, final, agentSpeaking }: TranscriptDisplayProps) {
  const hasContent = partial || final || agentSpeaking

  if (!hasContent) return null

  return (
    <div className="w-full rounded-lg border border-[#E5E7EB] bg-white px-4 py-3 text-sm">
      {/* Live user transcript */}
      {(partial || final) && (
        <div className="flex items-start gap-2">
          <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#E5E7EB] text-[9px] font-semibold text-[#6B7280]">
            YOU
          </span>
          <p className="text-[#111827]">
            {final && <span>{final} </span>}
            {partial && (
              <span className="text-[#9CA3AF] italic">{partial}</span>
            )}
          </p>
        </div>
      )}

      {/* Agent speaking subtitle */}
      {agentSpeaking && (
        <div className="mt-2 flex items-start gap-2 border-t border-[#F3F4F6] pt-2">
          <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#1B3A7A] text-[9px] font-semibold text-white">
            AI
          </span>
          <p className="text-[#111827] leading-relaxed">{agentSpeaking}</p>
        </div>
      )}
    </div>
  )
}
