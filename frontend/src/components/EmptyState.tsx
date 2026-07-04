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
    <div className="animate-pop-in flex flex-col items-center gap-3 px-6 py-8 text-center">
      <Mascot pose={pose} size={120} />
      <h2 className="text-lg font-extrabold text-sand-800">{title}</h2>
      {body && <p className="max-w-xs text-sm font-medium text-sand-500">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
