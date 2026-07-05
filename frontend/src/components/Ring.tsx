import type { CSSProperties, ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface RingProps {
  /** Progress from 0 to 1 (values beyond 1 are capped visually). */
  value: number
  /** Rendered width/height in px. */
  size?: number
  strokeWidth?: number
  /** Stroke color of the progress arc (any CSS color). */
  color?: string
  className?: string
  /** Centered content (numbers, icons). */
  children?: ReactNode
  'aria-label'?: string
}

/** Minimal circular progress ring (SVG), used for calories and macros. */
export function Ring({
  value,
  size = 64,
  strokeWidth = 6,
  color = 'var(--foreground)',
  className,
  children,
  'aria-label': ariaLabel,
}: RingProps) {
  const clamped = Math.max(0, Math.min(1, value))
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - clamped)

  const arcStyle: CSSProperties = {
    strokeDasharray: circumference,
    strokeDashoffset: dashOffset,
    transition: 'stroke-dashoffset 600ms cubic-bezier(0.21, 1.02, 0.73, 1)',
  }

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--secondary)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={arcStyle}
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">
          {children}
        </div>
      )}
    </div>
  )
}
