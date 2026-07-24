import { useId } from 'react'

import type { Goal } from '../../api/types'

interface ProgressCurveProps {
  goal: Goal
  /** X-axis labels, e.g. ["Now", "October 10"]. */
  startLabel: string
  endLabel: string
  /** Bubble text at the endpoint, e.g. "Target 85 kg". */
  targetLabel?: string
}

/**
 * Hand-drawn estimated-progress curve in the CalAI style: thin near-black
 * S-curve, soft gray gradient fill, dashed guide lines, white endpoint dots.
 */
export function ProgressCurve({ goal, startLabel, endLabel, targetLabel }: ProgressCurveProps) {
  const id = useId()
  const down = goal !== 'gain'
  // S-curve from (16,y0) to (264,y1) in a 280×120 box.
  const y0 = down ? 26 : 92
  const y1 = down ? 92 : 26
  const path = `M16 ${y0} C 90 ${y0}, 130 ${(y0 + y1) / 2}, 170 ${(y0 + y1) / 2} C 210 ${(y0 + y1) / 2}, 230 ${y1}, 264 ${y1}`
  const fill = `${path} L 264 112 L 16 112 Z`

  return (
    <div>
      <svg
        viewBox="0 0 280 132"
        className="w-full"
        role="img"
        aria-label={`Estimated progress curve from ${startLabel} to ${endLabel}`}
      >
        <defs>
          <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#16161A" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#16161A" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {/* dashed guides */}
        <line x1="16" y1={y0} x2="264" y2={y0} stroke="#D9D9DE" strokeWidth="1" strokeDasharray="3 4" />
        <line x1="16" y1={y1} x2="264" y2={y1} stroke="#D9D9DE" strokeWidth="1" strokeDasharray="3 4" />
        <line x1="16" y1="112" x2="264" y2="112" stroke="#ECECF0" strokeWidth="1" />
        <path d={fill} fill={`url(#${id}-fill)`} />
        <path d={path} fill="none" stroke="#16161A" strokeWidth="2.5" strokeLinecap="round" />
        {/* endpoint dots */}
        <circle cx="16" cy={y0} r="6" fill="#FFFFFF" stroke="#16161A" strokeWidth="2.5" />
        <circle cx="264" cy={y1} r="6" fill="#FFFFFF" stroke="#16161A" strokeWidth="2.5" />
        {targetLabel && (
          <g>
            <rect
              x="176"
              y={y1 - 38}
              rx="12"
              width="88"
              height="26"
              fill="#FFFFFF"
              stroke="#16161A"
              strokeWidth="1.5"
            />
            <text
              x="220"
              y={y1 - 21}
              textAnchor="middle"
              fontSize="12"
              fontWeight="600"
              fill="#16161A"
            >
              {targetLabel}
            </text>
          </g>
        )}
      </svg>
      <div className="mt-1 flex justify-between px-1 text-sm font-medium text-muted-foreground">
        <span>{startLabel}</span>
        <span>{endLabel}</span>
      </div>
    </div>
  )
}
