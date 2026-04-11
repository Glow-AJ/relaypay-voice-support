import Image from 'next/image'

interface RelayPayLogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

// sm = admin sidebar header, md = public page / agent portal header, lg = login / invite pages
const heights = { sm: 32, md: 44, lg: 64 }

export function RelayPayLogo({ className = '', size = 'md' }: RelayPayLogoProps) {
  const h = heights[size]
  return (
    <Image
      src="/logo.png"
      alt="RelayPay"
      width={0}
      height={0}
      sizes="(max-width: 768px) 200px, 320px"
      style={{ height: h, width: 'auto', maxWidth: size === 'lg' ? 220 : size === 'md' ? 160 : 130 }}
      className={className}
      priority
    />
  )
}
