import { NavLink } from 'react-router-dom'
import { ChartColumn, House, Plus, User } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

function Item({
  to,
  end,
  label,
  icon: Icon,
}: {
  to: string
  end?: boolean
  label: string
  icon: LucideIcon
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-semibold transition-colors',
          isActive ? 'text-foreground' : 'text-muted-foreground/70 hover:text-foreground',
        )
      }
    >
      <Icon aria-hidden="true" className="size-6" strokeWidth={1.8} />
      {label}
    </NavLink>
  )
}

export function BottomNav() {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-md items-stretch px-3">
        <Item to="/app" end label="Home" icon={House} />
        <Item to="/app/log" label="Log" icon={Plus} />
        <Item to="/app/reports" label="Reports" icon={ChartColumn} />
        <Item to="/app/profile" label="Profile" icon={User} />
      </div>
    </nav>
  )
}
