import { Outlet } from 'react-router-dom'
import { BottomNav } from '../components/BottomNav'

/** Authed shell: mobile-first column, centered on desktop, fixed tab bar. */
export function AppShell() {
  return (
    <div className="mx-auto min-h-dvh max-w-md bg-sand-50 pb-24 shadow-sm">
      <Outlet />
      <BottomNav />
    </div>
  )
}
