import { CloudOff, RefreshCw } from 'lucide-react'

import { usePendingCount, useOnline } from '../lib/useOutbox'

/**
 * Thin status strip under the safe area: shown only when offline, or when
 * writes are still waiting to sync. Silent when everything is up to date.
 */
export function OfflineBar() {
  const online = useOnline()
  const queued = usePendingCount()

  if (online && queued === 0) return null

  const label = !online
    ? queued > 0
      ? `Offline — ${queued} ${queued === 1 ? 'entry' : 'entries'} will sync later`
      : 'Offline — you can still log food'
    : `Syncing ${queued} ${queued === 1 ? 'entry' : 'entries'}…`

  return (
    <div
      role="status"
      aria-live="polite"
      className={`sticky top-0 z-40 flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-semibold ${
        online ? 'bg-muted text-muted-foreground' : 'bg-foreground text-background'
      }`}
    >
      {online ? (
        <RefreshCw aria-hidden="true" className="size-3.5 animate-spin" strokeWidth={2} />
      ) : (
        <CloudOff aria-hidden="true" className="size-3.5" strokeWidth={2} />
      )}
      {label}
    </div>
  )
}
