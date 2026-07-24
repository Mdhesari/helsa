import type { ReactNode } from 'react'

interface EmptyStateProps {
  /** A claymorphic illustration from src/assets/illustrations. */
  illustration?: ReactNode
  title: string
  body?: string
  action?: ReactNode
}

export function EmptyState({ illustration, title, body, action }: EmptyStateProps) {
  return (
    <div className="animate-pop-in flex flex-col items-center gap-3 px-6 py-10 text-center">
      {illustration && <div aria-hidden="true">{illustration}</div>}
      <h2 className="mt-1 text-lg font-semibold tracking-tight">{title}</h2>
      {body && <p className="max-w-xs text-sm text-muted-foreground">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
