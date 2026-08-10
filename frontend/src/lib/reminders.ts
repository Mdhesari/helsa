import { LocalNotifications } from '@capacitor/local-notifications'

import { isNative } from './native'

/**
 * Daily meal reminders — a native capability with no web equivalent on iOS
 * (Safari has no reliable background scheduling), and the main reason the
 * wrapper is more than a browser window.
 *
 * Notifications are scheduled locally on the device: no push server, no data
 * leaving the phone.
 */

export interface Reminder {
  id: number
  hour: number
  minute: number
  title: string
  body: string
}

/** Breakfast / lunch / dinner nudges. Ids are stable so re-scheduling replaces. */
export const DEFAULT_REMINDERS: Reminder[] = [
  { id: 1, hour: 9, minute: 0, title: 'Breakfast logged?', body: 'Takes 10 seconds — keep your streak alive.' },
  { id: 2, hour: 14, minute: 0, title: 'Lunch check-in', body: 'Log what you ate while it is fresh.' },
  { id: 3, hour: 20, minute: 30, title: 'Round off your day', body: 'Add dinner to close today out.' },
]

/** True when the user has granted notification permission. */
export async function hasPermission(): Promise<boolean> {
  if (!isNative) return false
  const { display } = await LocalNotifications.checkPermissions()
  return display === 'granted'
}

/**
 * Asks for permission. iOS only ever shows this dialog once, so it is called
 * from an explicit opt-in in Profile rather than on launch.
 */
export async function requestPermission(): Promise<boolean> {
  if (!isNative) return false
  const { display } = await LocalNotifications.requestPermissions()
  return display === 'granted'
}

/** (Re)schedules the daily reminders. Safe to call repeatedly. */
export async function enableReminders(
  reminders: Reminder[] = DEFAULT_REMINDERS,
): Promise<boolean> {
  if (!isNative) return false
  if (!(await hasPermission()) && !(await requestPermission())) return false

  await disableReminders()
  await LocalNotifications.schedule({
    notifications: reminders.map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      schedule: {
        on: { hour: r.hour, minute: r.minute },
        repeats: true,
        // Fire on the device's wall clock, matching the user's local meals.
        allowWhileIdle: true,
      },
    })),
  })
  return true
}

export async function disableReminders(): Promise<void> {
  if (!isNative) return
  const { notifications } = await LocalNotifications.getPending()
  if (notifications.length > 0) {
    await LocalNotifications.cancel({ notifications })
  }
}
