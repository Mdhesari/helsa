import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

import * as api from '../api/client'
import { isApiError } from '../api/client'
import type {
  CustomFoodInput,
  FoodLogInput,
  HabitLogInput,
  WeightInput,
  WorkoutInput,
} from '../api/types'

/**
 * Offline write queue.
 *
 * Food logs written without a connection are durably queued in IndexedDB and
 * replayed when the network returns. IndexedDB (not memory) because iOS evicts
 * suspended PWA tabs aggressively — a queue held in memory would lose the
 * user's meals when they switch apps.
 *
 * Every queued log carries a `client_key`; the server treats (user, client_key)
 * as unique, so replaying a request whose response was lost returns the
 * original log rather than creating a duplicate. See docs/api-contract.md.
 */

/**
 * Queueable writes. Each variant carries the payload its endpoint expects; the
 * entry id doubles as the server-side `client_key`, so every one of these
 * endpoints dedups replays. Structural writes (creating a habit, editing the
 * plan) are deliberately absent — they are rare, and need a connection anyway.
 */
export type OutboxPayload =
  | { kind: 'log'; input: FoodLogInput }
  | { kind: 'custom-food'; input: FoodLogInput }
  | { kind: 'workout'; input: WorkoutInput }
  | { kind: 'weight'; input: WeightInput }
  | { kind: 'habit-log'; habitId: number; input: HabitLogInput }

export type OutboxKind = OutboxPayload['kind']

export type OutboxEntry = OutboxPayload & {
  /** Also the server-side idempotency key. */
  id: string
  /** Owner of the queued write; entries are never replayed for another user. */
  userId: number
  createdAt: number
  attempts: number
  /** Last failure, kept for display; entries are not dropped on error. */
  lastError?: string
}

interface HelsaDB extends DBSchema {
  outbox: {
    key: string
    value: OutboxEntry
    indexes: { byUser: number }
  }
}

const DB_NAME = 'helsa-offline'
const DB_VERSION = 1
const STORE = 'outbox'

let dbPromise: Promise<IDBPDatabase<HelsaDB>> | null = null

function db(): Promise<IDBPDatabase<HelsaDB>> {
  if (!dbPromise) {
    dbPromise = openDB<HelsaDB>(DB_NAME, DB_VERSION, {
      upgrade(database) {
        const store = database.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('byUser', 'userId')
      },
    })
  }
  return dbPromise
}

function newKey(): string {
  // randomUUID needs a secure context; the app is HTTPS-only in production,
  // but keep a fallback so plain-http LAN testing still works.
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random()
    .toString(16)
    .slice(2)}`
}

// ---------- Subscriptions ----------

type Listener = () => void
const listeners = new Set<Listener>()

/** Subscribe to queue changes (React `useSyncExternalStore`-friendly). */
export function subscribe(fn: Listener): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

function emit(): void {
  listeners.forEach((fn) => fn())
}

// ---------- Queue operations ----------

export async function enqueue(
  payload: OutboxPayload,
  userId: number,
): Promise<OutboxEntry> {
  const entry: OutboxEntry = {
    ...payload,
    id: newKey(),
    userId,
    createdAt: Date.now(),
    attempts: 0,
  }
  await (await db()).put(STORE, entry)
  emit()
  return entry
}

export async function pending(userId: number): Promise<OutboxEntry[]> {
  const all = await (await db()).getAllFromIndex(STORE, 'byUser', userId)
  return all.sort((a, b) => a.createdAt - b.createdAt)
}

export async function remove(id: string): Promise<void> {
  await (await db()).delete(STORE, id)
  emit()
}

/** Drops every queued write for a user — called on logout. */
export async function clearUser(userId: number): Promise<void> {
  const database = await db()
  const tx = database.transaction(STORE, 'readwrite')
  const keys = await tx.store.index('byUser').getAllKeys(userId)
  await Promise.all(keys.map((key) => tx.store.delete(key)))
  await tx.done
  emit()
}

// ---------- Flush ----------

export interface FlushResult {
  synced: number
  failed: number
}

let flushing: Promise<FlushResult> | null = null

/**
 * Replays queued writes oldest-first. Concurrent calls share one run, so the
 * online/visibility/interval triggers can all fire without racing each other.
 */
export function flush(userId: number): Promise<FlushResult> {
  if (flushing) return flushing
  flushing = runFlush(userId).finally(() => {
    flushing = null
  })
  return flushing
}

async function runFlush(userId: number): Promise<FlushResult> {
  const result: FlushResult = { synced: 0, failed: 0 }
  if (!navigator.onLine) return result

  const entries = await pending(userId)
  for (const entry of entries) {
    try {
      await send(entry)
      await remove(entry.id)
      result.synced++
    } catch (err) {
      if (isPermanent(err)) {
        // A 400/404 will fail identically forever — retrying it would block
        // everything queued behind it. Drop it and let the UI report the loss.
        await remove(entry.id)
        result.failed++
        continue
      }
      // Offline again, or a server error: stop and keep the rest queued in
      // order, so entries sync in the order they happened.
      await bumpAttempt(entry, err)
      break
    }
  }
  if (result.synced > 0 || result.failed > 0) emit()
  return result
}

/** Replays one queued write. `entry.id` is the server-side idempotency key. */
async function send(entry: OutboxEntry): Promise<unknown> {
  switch (entry.kind) {
    case 'log':
      return api.createLog({ ...entry.input, client_key: entry.id })

    case 'custom-food': {
      // Recreate the reference food, then log it. createFood is not idempotent,
      // so a replay can leave a duplicate custom food; the log itself is still
      // deduplicated by client_key, which is what the totals depend on.
      const input: CustomFoodInput = {
        name: entry.input.food_name,
        serving_label: entry.input.serving || undefined,
        calories: entry.input.calories,
        protein_g: entry.input.protein_g,
        carbs_g: entry.input.carbs_g,
        fat_g: entry.input.fat_g,
      }
      const food = await api.createFood(input)
      return api.createLog({
        ...entry.input,
        serving: entry.input.serving || food.servings[0]?.label || '1 serving',
        food_ref_id: food.id,
        client_key: entry.id,
      })
    }

    case 'workout':
      return api.createWorkout({ ...entry.input, client_key: entry.id })

    case 'weight':
      return api.createWeight({ ...entry.input, client_key: entry.id })

    case 'habit-log':
      return api.createHabitLog(entry.habitId, {
        ...entry.input,
        client_key: entry.id,
      })
  }
}

/** 4xx other than 401/408/429 will never succeed on retry. */
function isPermanent(err: unknown): boolean {
  if (!isApiError(err)) return false
  if (err.status === 401 || err.status === 408 || err.status === 429) return false
  return err.status >= 400 && err.status < 500
}

async function bumpAttempt(entry: OutboxEntry, err: unknown): Promise<void> {
  const next: OutboxEntry = {
    ...entry,
    attempts: entry.attempts + 1,
    lastError: err instanceof Error ? err.message : String(err),
  }
  await (await db()).put(STORE, next)
}
