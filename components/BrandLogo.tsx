/** The Upaharo logo mark (gift box with the U). Transparent PNG, sized by `size` in px. */
export default function BrandLogo({ size = 36, className = '' }: { size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/icons/logo-160.png"
      alt="Upaharo"
      width={size}
      height={size}
      className={`shrink-0 object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  )
}
