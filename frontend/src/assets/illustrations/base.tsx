import type { ReactNode, SVGProps } from 'react'

export interface IllustrationProps {
  /** Rendered width/height in px. */
  size?: number
  className?: string
  /** Decorative by default; pass a title to expose it to AT. */
  title?: string
}

/**
 * Shared wrapper for the claymorphic "3D sticker" illustrations: a 100×100
 * viewBox with a soft shadow ellipse under the subject. All gradients are
 * defined per-component with unique ids (via useId) — no external fetches.
 */
export function IllustrationSvg({
  size = 96,
  className,
  title,
  children,
  ...rest
}: IllustrationProps & { children: ReactNode } & Omit<
    SVGProps<SVGSVGElement>,
    'width' | 'height'
  >) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={className}
      {...rest}
    >
      {children}
    </svg>
  )
}

/** Soft elliptical drop shadow shared by every sticker. */
export function GroundShadow({ opacity = 0.1 }: { opacity?: number }) {
  return <ellipse cx="50" cy="90" rx="26" ry="5" fill="#16161A" opacity={opacity} />
}
