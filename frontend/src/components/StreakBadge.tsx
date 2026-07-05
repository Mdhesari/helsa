import { Flame } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { Streak } from '../api/types'

interface StreakBadgeProps {
  streak: Streak
  className?: string
}

/** Flame + current streak days. Dimmed when the streak is 0. */
export function StreakBadge({ streak, className }: StreakBadgeProps) {
  const active = streak.current_days > 0
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-semibold tabular-nums',
        active
          ? 'border-transparent bg-secondary text-foreground'
          : 'border-border bg-background text-muted-foreground',
        className,
      )}
      title={`Current streak: ${streak.current_days} days. Longest: ${streak.longest_days} days.`}
    >
      <Flame
        aria-hidden="true"
        className={cn('size-4', active && 'fill-foreground stroke-foreground')}
        strokeWidth={1.8}
      />
      <span>{streak.current_days}</span>
      <span className="sr-only">day streak</span>
    </div>
  )
}
