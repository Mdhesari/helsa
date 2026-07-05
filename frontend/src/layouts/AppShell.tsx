import { Outlet } from 'react-router-dom'
import { BottomNav } from '../components/BottomNav'

/** Authed shell: mobile-first column, centered on desktop, fixed tab bar. */
export function AppShell() {
  return (
    <div className="mx-auto min-h-dvh max-w-md bg-background pb-28 sm:border-x">
      <Outlet />
      <BottomNav />
    </div>
  )
}
