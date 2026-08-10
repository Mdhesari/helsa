import { Outlet } from 'react-router-dom'
import { BottomNav } from '../components/BottomNav'
import { OfflineBar } from '../components/OfflineBar'
import { UpdatePrompt } from '../components/UpdatePrompt'
import { useOutboxSync } from '../lib/useOutbox'

/** Authed shell: mobile-first column, centered on desktop, fixed tab bar. */
export function AppShell() {
  // Replays anything logged offline as soon as the network is back.
  useOutboxSync()

  return (
    <div className="mx-auto min-h-dvh max-w-md bg-background pb-28 sm:border-x">
      <OfflineBar />
      <Outlet />
      <BottomNav />
      <UpdatePrompt />
    </div>
  )
}
