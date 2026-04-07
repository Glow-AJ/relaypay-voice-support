'use client'

interface RelayPayLogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

const sizes = {
  sm: { width: 100, height: 28 },
  md: { width: 140, height: 38 },
  lg: { width: 180, height: 48 },
}

export function RelayPayLogo({ className = '', size = 'md' }: RelayPayLogoProps) {
  const { width, height } = sizes[size]
  const iconSize = height * 0.85

  return (
    <div className={`flex items-center gap-2 ${className}`} aria-label="RelayPay">
      {/* Icon: double-R arrow mark */}
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Teal arrow top */}
        <path
          d="M20 4 L36 14 L28 14 L28 22 L20 22 L20 14 L12 14 Z"
          fill="#29ABE2"
        />
        {/* Green arrow bottom */}
        <path
          d="M20 18 L28 18 L28 26 L36 26 L20 36 L4 26 L12 26 L12 18 Z"
          fill="#3DBB61"
        />
        {/* Dark blue overlay center */}
        <path
          d="M20 18 L28 18 L28 22 L20 22 Z"
          fill="#1B3A7A"
          opacity="0.5"
        />
      </svg>

      {/* Wordmark */}
      <svg
        width={width - iconSize - 8}
        height={height}
        viewBox="0 0 110 38"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <text
          x="0"
          y="28"
          fontFamily="Inter, -apple-system, sans-serif"
          fontWeight="700"
          fontSize="26"
          fill="#1B3A7A"
          letterSpacing="-0.5"
        >
          RelayPay
        </text>
      </svg>
    </div>
  )
}
