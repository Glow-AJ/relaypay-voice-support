'use client'

interface RelayPayLogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

const sizes = {
  sm: { iconH: 22, textH: 18, gap: 6 },
  md: { iconH: 30, textH: 24, gap: 8 },
  lg: { iconH: 40, textH: 32, gap: 10 },
}

export function RelayPayLogo({ className = '', size = 'md' }: RelayPayLogoProps) {
  const { iconH, textH, gap } = sizes[size]
  const iconW = iconH * (40 / 36) // maintain aspect ratio of icon viewBox

  return (
    <div
      className={`flex items-center ${className}`}
      style={{ gap }}
      aria-label="RelayPay"
    >
      {/* Icon: double-R arrow mark — teal R front, green arrow/R behind */}
      <svg
        width={iconW}
        height={iconH}
        viewBox="0 0 40 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Green back-R (left, slightly behind) */}
        <path
          d="M4 4 L4 32 L10 32 L10 22 L18 22 L24 32 L31 32 L24 20.5 C27.5 19 30 16 30 12 C30 7.5 26.5 4 21 4 Z M10 10 L20.5 10 C22.8 10 24.5 11.5 24.5 13.5 C24.5 15.5 22.8 17 20.5 17 L10 17 Z"
          fill="#3DBB61"
          transform="translate(-1, 2) scale(0.88)"
        />
        {/* Teal front-R (right, on top) */}
        <path
          d="M8 2 L8 30 L14 30 L14 20 L22 20 L28 30 L35 30 L28 18.5 C31.5 17 34 14 34 10 C34 5.5 30.5 2 25 2 Z M14 8 L24.5 8 C26.8 8 28.5 9.5 28.5 11.5 C28.5 13.5 26.8 15 24.5 15 L14 15 Z"
          fill="#29ABE2"
        />
      </svg>

      {/* Wordmark: "RelayPay" in deep navy, bold rounded weight */}
      <svg
        height={textH}
        viewBox="0 0 130 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        style={{ overflow: 'visible' }}
      >
        <text
          x="0"
          y="26"
          fontFamily="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
          fontWeight="800"
          fontSize="28"
          fill="#1B3A7A"
          letterSpacing="-0.8"
        >
          RelayPay
        </text>
      </svg>
    </div>
  )
}
