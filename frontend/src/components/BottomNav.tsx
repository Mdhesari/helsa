import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  Apple,
  BookOpen,
  ChartColumn,
  Dumbbell,
  House,
  NotebookPen,
  Plus,
  Scale,
  User,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { WorkoutSheet } from './sheets/WorkoutSheet'
import { WeightSheet } from './sheets/WeightSheet'

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

type Sheet = 'menu' | 'workout' | 'weight' | null

const MENU_ITEMS: readonly {
  key: 'food' | 'workout' | 'weight' | 'diary'
  label: string
  hint: string
  icon: LucideIcon
}[] = [
  { key: 'food', label: 'Food', hint: 'Search & log a meal', icon: Apple },
  { key: 'workout', label: 'Workout', hint: 'Burned calories count too', icon: Dumbbell },
  { key: 'weight', label: 'Weight', hint: 'Quick weigh-in', icon: Scale },
  { key: 'diary', label: 'Diary', hint: 'Mood, energy & notes', icon: NotebookPen },
]

/** 5-slot tab bar with a raised center "+" that opens the quick-log sheet. */
export function BottomNav() {
  const navigate = useNavigate()
  const [sheet, setSheet] = useState<Sheet>(null)

  function pick(key: (typeof MENU_ITEMS)[number]['key']) {
    switch (key) {
      case 'food':
        setSheet(null)
        navigate('/app/log')
        break
      case 'diary':
        setSheet(null)
        navigate('/app/diary')
        break
      case 'workout':
        setSheet('workout')
        break
      case 'weight':
        setSheet('weight')
        break
    }
  }

  return (
    <>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
      >
        <div className="mx-auto flex max-w-md items-stretch px-3">
          <Item to="/app" end label="Home" icon={House} />
          <Item to="/app/progress" label="Progress" icon={ChartColumn} />
          <div className="flex flex-1 items-center justify-center">
            <button
              type="button"
              aria-label="Log something"
              className="-mt-5 flex size-14 items-center justify-center rounded-full bg-foreground text-background shadow-[0_6px_16px_rgb(0_0_0/0.22)] transition-transform outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 active:scale-95"
              onClick={() => setSheet('menu')}
            >
              <Plus className="size-7" strokeWidth={2.2} />
            </button>
          </div>
          <Item to="/app/diary" label="Diary" icon={BookOpen} />
          <Item to="/app/profile" label="Profile" icon={User} />
        </div>
      </nav>

      <Dialog open={sheet === 'menu'} onOpenChange={(o) => !o && setSheet(null)}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>What are you logging?</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {MENU_ITEMS.map((item) => (
              <button
                key={item.key}
                type="button"
                className="flex flex-col items-start gap-2.5 rounded-3xl border bg-card p-4 text-left transition-all outline-none hover:border-input focus-visible:ring-2 focus-visible:ring-ring/40 active:scale-[0.98]"
                onClick={() => pick(item.key)}
              >
                <span
                  aria-hidden="true"
                  className="flex size-11 items-center justify-center rounded-full bg-secondary"
                >
                  <item.icon className="size-5" strokeWidth={1.6} />
                </span>
                <span>
                  <span className="block font-semibold">{item.label}</span>
                  <span className="block text-xs text-muted-foreground">{item.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <WorkoutSheet open={sheet === 'workout'} onClose={() => setSheet(null)} />
      <WeightSheet open={sheet === 'weight'} onClose={() => setSheet(null)} />
    </>
  )
}
