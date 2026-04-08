import Image from 'next/image'

interface RelayPayLogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

const heights = { sm: 22, md: 30, lg: 40 }

export function RelayPayLogo({ className = '', size = 'md' }: RelayPayLogoProps) {
  return (
    <Image
      src="/logo.png"
      alt="RelayPay"
      height={heights[size]}
      width={600}
      style={{ height: heights[size], width: 'auto' }}
      className={className}
      priority
    />
  )
}
