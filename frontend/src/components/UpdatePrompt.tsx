import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { applyPendingUpdate, onUpdate } from '../lib/sw'

/**
 * Offers a reload when a new build is waiting. Deliberately a prompt rather
 * than an auto-reload: swapping the app out mid-entry would discard whatever
 * the user was typing.
 */
export function UpdatePrompt() {
  const [ready, setReady] = useState(false)

  useEffect(() => onUpdate(() => setReady(true)), [])

  if (!ready) return null

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-24 z-50 flex justify-center px-4"
    >
      <div className="flex items-center gap-3 rounded-full bg-foreground py-2 pl-4 pr-2 text-sm font-medium text-background shadow-lg">
        A new version is ready
        <Button
          size="sm"
          variant="secondary"
          className="rounded-full"
          onClick={applyPendingUpdate}
        >
          Refresh
        </Button>
      </div>
    </div>
  )
}
