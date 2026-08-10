import { registerSW } from 'virtual:pwa-register'

/**
 * Service-worker registration.
 *
 * `registerType: 'prompt'` means a new build waits in the `waiting` state until
 * we call `updateSW()`. That is deliberate: silently swapping the shell out from
 * under someone mid-log would drop whatever they had typed.
 */

type UpdateHandler = () => void

let applyUpdate: ((reload?: boolean) => Promise<void>) | null = null
let onUpdateAvailable: UpdateHandler | null = null
let updatePending = false

/** Subscribe to "a new version is ready". Fires immediately if already pending. */
export function onUpdate(handler: UpdateHandler): () => void {
  onUpdateAvailable = handler
  if (updatePending) handler()
  return () => {
    onUpdateAvailable = null
  }
}

/** Activate the waiting worker and reload into the new build. */
export function applyPendingUpdate(): void {
  void applyUpdate?.(true)
}

export function registerServiceWorker(): void {
  if (import.meta.env.SSR) return

  applyUpdate = registerSW({
    immediate: true,
    onNeedRefresh() {
      updatePending = true
      onUpdateAvailable?.()
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return
      // iOS keeps PWAs suspended for days; a resumed app can sit on a months-old
      // shell. Re-check for updates whenever it comes back to the foreground.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          void registration.update()
        }
      })
    },
  })
}
