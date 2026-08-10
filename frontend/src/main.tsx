import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './auth/AuthContext'
import { ToastProvider } from './components/Toast'
import { isApiError } from './api/client'
import { persister } from './lib/persist'
import { registerServiceWorker } from './lib/sw'
import { initNativeChrome, isNative } from './lib/native'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Persisted data must outlive a cold start to be useful offline; the
      // default 5-minute gc would evict it before it could be restored.
      gcTime: 7 * 24 * 60 * 60 * 1000,
      // Don't retry client errors (4xx) — they won't get better.
      retry: (failureCount, error) => {
        if (isApiError(error) && error.status < 500) return false
        return failureCount < 2
      },
    },
    mutations: {
      // By default React Query *pauses* mutations while offline, so mutationFn
      // is never called. That would bypass the IndexedDB outbox — and its own
      // paused queue lives in memory only, which iOS discards when it evicts a
      // suspended tab. Always run the mutation and let useLogFood decide
      // between posting and durably queueing.
      networkMode: 'always',
    },
  },
})

if (isNative) {
  // The native build already ships its assets in the bundle; a service worker
  // would add a second, competing cache of the same files.
  void initNativeChrome()
} else {
  registerServiceWorker()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        // Bump when cached response shapes change, to drop stale entries.
        buster: 'v1',
        dehydrateOptions: {
          // Only persist successful reads. Errors and in-flight state would
          // restore as a broken screen on the next cold start.
          shouldDehydrateQuery: (query) => query.state.status === 'success',
        },
      }}
    >
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </PersistQueryClientProvider>
  </StrictMode>,
)
