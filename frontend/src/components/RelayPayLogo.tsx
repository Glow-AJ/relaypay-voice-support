import Image from 'next/image'

interface RelayPayLogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

const heights = { sm: 22, md: 30, lg: 40 }

export function RelayPayLogo({ className = '', size = 'md' }: RelayPayLogoProps) {
  const h = heights[size]
  return (
    <Image
      src="/logo.png"
      alt="RelayPay"
      width={0}
      height={0}
      sizes="100vw"
      style={{ height: h, width: 'auto', maxHeight: h }}
      className={className}
      priority
    />
  )
}
