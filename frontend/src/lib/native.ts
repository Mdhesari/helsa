import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { StatusBar, Style } from '@capacitor/status-bar'

/**
 * Native-only behaviour. Every call is a no-op on the web, so callers never
 * need to branch — `isNative` is exported for the rare case where the UI
 * itself must differ.
 */

export const isNative = Capacitor.isNativePlatform()

/** Physical feedback when a meal is logged. */
export async function tapSuccess(): Promise<void> {
  if (!isNative) return
  try {
    await Haptics.notification({ type: NotificationType.Success })
  } catch {
    // Haptics are unavailable on some devices and in the simulator; never let
    // that break a write.
  }
}

/** Lighter tap for ordinary confirmations. */
export async function tapLight(): Promise<void> {
  if (!isNative) return
  try {
    await Haptics.impact({ style: ImpactStyle.Light })
  } catch {
    // ignored — see tapSuccess
  }
}

/**
 * Keeps the status bar legible. The app's shell is light, so dark content;
 * `setOverlaysWebView` lets the web view draw under the bar, which the
 * safe-area padding in the layout already accounts for.
 */
export async function initNativeChrome(): Promise<void> {
  if (!isNative) return
  try {
    await StatusBar.setStyle({ style: Style.Light })
    await StatusBar.setOverlaysWebView({ overlay: false })
  } catch {
    // Non-fatal: a wrong status-bar tint should not stop the app booting.
  }
}
