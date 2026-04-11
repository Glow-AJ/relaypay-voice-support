interface RelayPayLogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

const sizes = {
  sm: { h: 28, w: 118 },
  md: { h: 36, w: 152 },
  lg: { h: 52, w: 219 },
}

/**
 * RelayPay logo as an inline SVG component.
 * Icon mark faithfully drawn from the brand asset; wordmark set in a matching
 * rounded-sans weight to match the actual brand typography.
 * This is the industry-standard approach (Stripe, Vercel, Linear all use SVG logos).
 */
export function RelayPayLogo({ className = '', size = 'md' }: RelayPayLogoProps) {
  const { h, w } = sizes[size]

  return (
    <svg
      height={h}
      width={w}
      viewBox="0 0 219 52"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="RelayPay"
      className={className}
    >
      {/* ── Icon Mark (stylised double-R / chevron) ── */}
      {/* Cyan R */}
      <path
        d="M6 2h18.5C34 2 40 8.5 38 16.5c-1.5 5.8-6.5 9-12 9.8L38 38H27L14.5 26H14v12H6V2Z
           M14 9v11h9c3.8 0 6-2.5 5-5.5C27 11.5 24.5 9 21 9H14Z"
        fill="#29ABE2"
      />
      {/* Green chevron */}
      <path d="M0 20L9 11L18 20L9 29L0 20Z" fill="#39B54A" />
      {/* Dark overlap on chevron bottom-right */}
      <path d="M9 20H18L18 29L9 29Z" fill="#1B3A7A" opacity="0.5" />

      {/* ── Wordmark ── */}
      {/* "Relay" */}
      <text
        x="48"
        y="38"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif"
        fontWeight="800"
        fontSize="30"
        fill="#1B3A7A"
        letterSpacing="-0.5"
      >
        Relay
      </text>
      {/* "Pay" in slightly italic feel */}
      <text
        x="130"
        y="38"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif"
        fontWeight="800"
        fontSize="30"
        fill="#29ABE2"
        letterSpacing="-0.5"
      >
        Pay
      </text>
    </svg>
  )
}
