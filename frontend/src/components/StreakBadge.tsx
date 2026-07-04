import type { Streak } from '../api/types'

interface StreakBadgeProps {
  streak: Streak
  className?: string
}

/** Flame + current streak days. Dimmed when the streak is 0. */
export function StreakBadge({ streak, className = '' }: StreakBadgeProps) {
  const active = streak.current_days > 0
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-extrabold ${
        active ? 'bg-orange-50 text-flame' : 'bg-sand-200 text-sand-500'
      } ${className}`}
      title={`Current streak: ${streak.current_days} days. Longest: ${streak.longest_days} days.`}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path
          d="M12 22c-4.4 0-7.5-2.9-7.5-7.2 0-3.1 1.9-5.4 3.4-7.2.5-.6 1.4-.3 1.5.4.1.9.4 1.8 1 2.4C11 8 12.6 4.6 12.2 2.5c-.1-.7.6-1.2 1.2-.8 3.3 2.2 6.1 6.4 6.1 11.1 0 5.4-3.1 9.2-7.5 9.2z"
          fill="currentColor"
        />
        <path
          d="M12 22c-2.2 0-3.7-1.6-3.7-3.7 0-1.8 1.2-3 2.1-4 .4-.5 1.1-.3 1.3.3.4 1.3 1.6 1.7 2.1 3 .8 1.9-.1 4.4-1.8 4.4z"
          fill={active ? '#ffc800' : '#f7f2e9'}
        />
      </svg>
      <span>{streak.current_days}</span>
      <span className="sr-only">day streak</span>
    </div>
  )
}
