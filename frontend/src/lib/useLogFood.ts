import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import * as api from '../api/client'
import type { FoodLog, FoodLogInput, LogsResponse } from '../api/types'
import { todayStr } from './date'
import * as outbox from './outbox'
import { invalidateFoodData, invalidateFoodRefData, qk } from './queries'
import { useOfflineWrite } from './useOfflineWrite'

/**
 * Writing a food log, online or off.
 *
 * Online it posts directly. Offline — or when the request fails for a reason a
 * retry could fix — the entry is queued in IndexedDB and shown immediately, so
 * logging a meal never depends on having a connection.
 */

/** A log that exists only in the queue; negative id keeps it distinct. */
export function isPendingLog(log: FoodLog): boolean {
  return log.id < 0
}

/** A queued entry that will become a food log. */
type FoodOutboxEntry = outbox.OutboxEntry & { kind: 'log' | 'custom-food' }

function isFoodEntry(entry: outbox.OutboxEntry): entry is FoodOutboxEntry {
  return entry.kind === 'log' || entry.kind === 'custom-food'
}

/** Optimistic FoodLog for a queued entry, rendered until it syncs. */
function toOptimisticLog(entry: FoodOutboxEntry): FoodLog {
  const now = new Date(entry.createdAt).toISOString()
  return {
    // Negative, derived from createdAt: stable across re-renders and never
    // collides with a server id.
    id: -entry.createdAt,
    food_name: entry.input.food_name,
    serving: entry.input.serving,
    calories: entry.input.calories,
    protein_g: entry.input.protein_g,
    carbs_g: entry.input.carbs_g,
    fat_g: entry.input.fat_g,
    logged_at: entry.input.logged_at ?? now,
    created_at: now,
    food_ref_id: entry.input.food_ref_id ?? null,
  }
}

export interface LogFoodResult {
  queued: boolean
}

export function useLogFood() {
  const qc = useQueryClient()
  const write = useOfflineWrite()

  return useCallback(
    (
      input: FoodLogInput,
      kind: 'log' | 'custom-food' = 'log',
    ): Promise<LogFoodResult> =>
      write({
        payload: { kind, input },
        send: async () => {
          if (kind === 'custom-food') {
            const food = await api.createFood({
              name: input.food_name,
              serving_label: input.serving || undefined,
              calories: input.calories,
              protein_g: input.protein_g,
              carbs_g: input.carbs_g,
              fat_g: input.fat_g,
            })
            await api.createLog({
              ...input,
              serving: input.serving || food.servings[0]?.label || '1 serving',
              food_ref_id: food.id,
            })
            invalidateFoodRefData(qc)
            return
          }
          await api.createLog(input)
        },
        onSent: () => invalidateFoodData(qc),
        onQueued: (entry) => {
          if (!isFoodEntry(entry)) return // unreachable: payload is a food kind
          // Show it in today's list right away. Dashboard totals stay
          // server-owned and catch up on sync — inventing them here would drift
          // from the server's timezone-aware day boundaries.
          qc.setQueryData<LogsResponse>(qk.logs(todayStr()), (prev) => ({
            logs: [...(prev?.logs ?? []), toOptimisticLog(entry)],
          }))
        },
      }),
    [qc, write],
  )
}

/**
 * Merges queued entries into a day's logs so they survive a refetch (which
 * would otherwise replace the optimistic cache write with server-only data).
 */
export function useMergedPendingLogs(logs: FoodLog[], entries: outbox.OutboxEntry[]) {
  const known = new Set(logs.map((l) => l.id))
  const extra = entries
    .filter(isFoodEntry)
    .map(toOptimisticLog)
    .filter((l) => !known.has(l.id))
  return [...logs, ...extra].sort(
    (a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime(),
  )
}
