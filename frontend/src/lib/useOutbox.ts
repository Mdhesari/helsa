import { useCallback, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { useAuth } from '../auth/AuthContext'
import * as outbox from './outbox'
import { invalidateFoodData } from './queries'

/** Reactive `navigator.onLine`. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  return online
}

const NO_ENTRIES: outbox.OutboxEntry[] = []

/**
 * Writes still waiting to sync, kept in step with the IndexedDB queue.
 * Empty when signed out.
 */
export function usePendingEntries(): outbox.OutboxEntry[] {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [entries, setEntries] = useState<outbox.OutboxEntry[]>(NO_ENTRIES)

  useEffect(() => {
    if (userId === null) {
      setEntries(NO_ENTRIES)
      return
    }
    let active = true
    const refresh = () => {
      void outbox.pending(userId).then((next) => {
        if (active) setEntries(next)
      })
    }
    refresh()
    const unsubscribe = outbox.subscribe(refresh)
    return () => {
      active = false
      unsubscribe()
    }
  }, [userId])

  return entries
}

/** Convenience wrapper for the status bar. */
export function usePendingCount(): number {
  return usePendingEntries().length
}

/**
 * Drives replay of the offline queue: on reconnect, on return to the
 * foreground, and once at startup. iOS fires neither `online` nor
 * `visibilitychange` reliably when a suspended PWA resumes, so both are wired.
 */
export function useOutboxSync(): void {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const online = useOnline()
  const qc = useQueryClient()

  const sync = useCallback(async () => {
    if (userId === null || !navigator.onLine) return
    const { synced } = await outbox.flush(userId)
    // Totals, streak and reports all shift once queued meals land.
    if (synced > 0) invalidateFoodData(qc)
  }, [userId, qc])

  useEffect(() => {
    if (userId === null) return
    void sync()

    const onVisible = () => {
      if (document.visibilityState === 'visible') void sync()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [userId, sync])

  // Re-run the moment the browser reports the network is back.
  useEffect(() => {
    if (online) void sync()
  }, [online, sync])
}
