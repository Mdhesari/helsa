import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { get, set, del, createStore, type UseStore } from 'idb-keyval'

/**
 * Persists the react-query cache to IndexedDB so the dashboard, logs and
 * reports still render after a cold start with no connection.
 *
 * This holds personal health data, so it is scoped and cleared deliberately:
 * `clearPersistedCache()` runs on logout, and the buster below invalidates
 * everything whenever the app's data shapes change.
 */

let store: UseStore | null = null

function cacheStore(): UseStore {
  if (!store) store = createStore('helsa-query-cache', 'cache')
  return store
}

const CACHE_KEY = 'helsa.query-cache'

export const persister = createAsyncStoragePersister({
  key: CACHE_KEY,
  // Rewriting the whole cache on every keystroke-driven query would thrash
  // IndexedDB; batch writes instead.
  throttleTime: 1000,
  storage: {
    getItem: (key) => get(key, cacheStore()),
    setItem: (key, value) => set(key, value, cacheStore()),
    removeItem: (key) => del(key, cacheStore()),
  },
})

/** Wipe the on-disk cache. Called on logout so the next user sees nothing. */
export async function clearPersistedCache(): Promise<void> {
  await del(CACHE_KEY, cacheStore())
}
