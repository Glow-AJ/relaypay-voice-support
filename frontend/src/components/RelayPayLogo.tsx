interface RelayPayLogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

// Height at each size — width is auto via viewBox aspect ratio
// The live logo region in the SVG sits roughly at x:300-1170, y:390-600
// Cropped viewBox: x=300, y=388, w=870, h=220  → aspect ~3.95:1
const heights = { sm: 28, md: 38, lg: 56 }

export function RelayPayLogo({ className = '', size = 'md' }: RelayPayLogoProps) {
  const h = heights[size]
  // Width derived from the aspect ratio of the cropped region (~3.95:1)
  const w = Math.round(h * 3.95)

  return (
    // Use the SVG file as an <img> but override the viewBox via a wrapper SVG
    // that references the original file and applies a clipPath to crop whitespace.
    // Simplest cross-browser approach: render the file directly and clip via width/height.
    // eslint-disable-next-line @next/next/no-img-element
    <svg
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      viewBox="300 388 870 220"
      width={w}
      height={h}
      aria-label="RelayPay"
      className={className}
      style={{ display: 'block', flexShrink: 0 }}
    >
      <image
        href="/relaypay logo.svg"
        x="0"
        y="0"
        width="1536"
        height="1024"
      />
    </svg>
  )
}
