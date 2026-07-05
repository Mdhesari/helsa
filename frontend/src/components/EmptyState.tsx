import type { ReactNode } from 'react'
import { Mascot } from './Mascot'
import type { MascotPose } from './mascot-poses'

interface EmptyStateProps {
  pose?: MascotPose
  title: string
  body?: string
  action?: ReactNode
}

export function EmptyState({ pose = 'sleep', title, body, action }: EmptyStateProps) {
  return (
    <div className="animate-pop-in flex flex-col items-center gap-3 px-6 py-10 text-center">
      <div className="flex size-24 items-center justify-center rounded-full bg-secondary">
        <Mascot pose={pose} size={64} />
      </div>
      <h2 className="mt-1 text-lg font-semibold tracking-tight">{title}</h2>
      {body && <p className="max-w-xs text-sm text-muted-foreground">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
