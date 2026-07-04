import { NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'

function Item({
  to,
  end,
  label,
  icon,
}: {
  to: string
  end?: boolean
  label: string
  icon: ReactNode
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-[11px] font-extrabold transition-colors ${
          isActive ? 'text-primary-600' : 'text-sand-400 hover:text-sand-600'
        }`
      }
    >
      {icon}
      {label}
    </NavLink>
  )
}

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

export function BottomNav() {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-sand-200 bg-white pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto flex max-w-md items-stretch px-2">
        <Item
          to="/app"
          end
          label="Home"
          icon={
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" {...stroke}>
              <path d="M3 10.5 12 3l9 7.5" />
              <path d="M5 9.5V21h5v-6h4v6h5V9.5" />
            </svg>
          }
        />
        <Item
          to="/app/log"
          label="Log"
          icon={
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" {...stroke}>
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v8M8 12h8" />
            </svg>
          }
        />
        <Item
          to="/app/reports"
          label="Reports"
          icon={
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" {...stroke}>
              <path d="M4 20V10M10 20V4M16 20v-8M21 20H3" />
            </svg>
          }
        />
        <Item
          to="/app/profile"
          label="Profile"
          icon={
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" {...stroke}>
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
            </svg>
          }
        />
      </div>
    </nav>
  )
}
