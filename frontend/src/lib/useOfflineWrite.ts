import { useCallback } from 'react'

import { isApiError } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { tapSuccess } from './native'
import * as outbox from './outbox'

/**
 * The shared "send it now, or queue it durably" decision behind every
 * offline-capable write.
 *
 * Callers supply how to perform the write online; anything that fails for a
 * reason a retry could fix — or that starts while offline — goes to the
 * IndexedDB outbox instead and is replayed later under the same idempotency key.
 */

export interface OfflineWriteResult {
  queued: boolean
}

/** Network-ish failures are worth queueing; a 400 is not. */
export function isRetryable(err: unknown): boolean {
  if (!isApiError(err)) return true // fetch rejected — offline, DNS or TLS
  return err.status >= 500 || err.status === 408 || err.status === 429
}

export interface OfflineWriteOptions {
  /** What to queue if the write cannot happen now. */
  payload: outbox.OutboxPayload
  /** Performs the write against the server. */
  send: () => Promise<unknown>
  /** Runs after a successful online write (cache invalidation, etc). */
  onSent?: () => void
  /** Runs after the write is queued, with the entry that was stored. */
  onQueued?: (entry: outbox.OutboxEntry) => void
  /** Skip the success haptic (e.g. for silent background writes). */
  silent?: boolean
}

export function useOfflineWrite() {
  const { user } = useAuth()

  return useCallback(
    async ({
      payload,
      send,
      onSent,
      onQueued,
      silent,
    }: OfflineWriteOptions): Promise<OfflineWriteResult> => {
      if (!user) throw new Error('must be signed in to write')

      // Confirms the tap landed even when the screen is not being watched.
      if (!silent) void tapSuccess()

      const queue = async (): Promise<OfflineWriteResult> => {
        const entry = await outbox.enqueue(payload, user.id)
        onQueued?.(entry)
        return { queued: true }
      }

      if (!navigator.onLine) return queue()

      try {
        await send()
        onSent?.()
        return { queued: false }
      } catch (err) {
        if (isRetryable(err)) return queue()
        throw err // 400s and the like are real errors — surface them.
      }
    },
    [user],
  )
}
