import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ChevronRight, Flame, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import * as api from '../api/client'
import { errorMessage } from '../api/client'
import type { Totals } from '../api/types'
import { qk } from '../lib/queries'
import { Ring } from '../components/Ring'
import { StreakBadge } from '../components/StreakBadge'
import { EmptyState } from '../components/EmptyState'
import { LogList } from '../components/LogList'
import { DashboardSkeleton } from '../components/Skeletons'

function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'Up late'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function CompleteProfileCard() {
  return (
    <Link
      to="/app/profile"
      className="flex items-center gap-3 rounded-2xl border border-dashed bg-secondary/50 p-4 transition-colors hover:bg-secondary"
    >
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Get personal targets</p>
        <p className="text-sm text-muted-foreground">
          Complete your profile and Helsa computes calorie and macro targets for you.
        </p>
      </div>
      <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
    </Link>
  )
}

/** Hero calories card: big remaining number + progress ring. */
function CaloriesCard({ totals, targets }: { totals: Totals; targets: Totals | null }) {
  const eaten = Math.round(totals.calories)

  if (!targets) {
    return (
      <Card>
        <CardContent className="flex items-center justify-between">
          <div>
            <p className="text-5xl font-bold tracking-tight tabular-nums">{eaten}</p>
            <p className="mt-1 text-sm text-muted-foreground">Calories eaten</p>
          </div>
          <Ring value={0} size={112} strokeWidth={9} aria-label="Calories">
            <Flame aria-hidden="true" className="size-7 text-muted-foreground" strokeWidth={1.6} />
          </Ring>
        </CardContent>
      </Card>
    )
  }

  const target = Math.round(targets.calories)
  const left = target - eaten
  const over = left < 0

  return (
    <Card>
      <CardContent className="flex items-center justify-between">
        <div>
          <p className="text-5xl font-bold tracking-tight tabular-nums">
            {Math.abs(left)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {over ? 'Calories over' : 'Calories left'}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground tabular-nums">{eaten}</span> of{' '}
            <span className="tabular-nums">{target}</span> kcal
          </p>
        </div>
        <Ring
          value={target > 0 ? eaten / target : 0}
          size={112}
          strokeWidth={9}
          aria-label={`Calories: ${eaten} of ${target}`}
        >
          <Flame
            aria-hidden="true"
            className={over ? 'size-7 fill-foreground' : 'size-7'}
            strokeWidth={1.6}
          />
        </Ring>
      </CardContent>
    </Card>
  )
}

const MACROS = [
  { key: 'protein_g', name: 'Protein', color: 'var(--protein)' },
  { key: 'carbs_g', name: 'Carbs', color: 'var(--carbs)' },
  { key: 'fat_g', name: 'Fat', color: 'var(--fat)' },
] as const

/** Three small macro cards with colored progress rings. */
function MacroCards({ totals, targets }: { totals: Totals; targets: Totals | null }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {MACROS.map((m) => {
        const eaten = Math.round(totals[m.key])
        const target = targets ? Math.round(targets[m.key]) : null
        const left = target !== null ? target - eaten : null
        const over = left !== null && left < 0

        return (
          <Card key={m.key} className="gap-0 py-4">
            <CardContent className="flex flex-col items-center gap-2 px-3 text-center">
              <p className="text-xl font-bold tabular-nums">
                {left !== null ? Math.abs(left) : eaten}
                <span className="text-xs font-medium text-muted-foreground">g</span>
              </p>
              <p className="text-[11px] font-medium leading-tight text-muted-foreground">
                {m.name} {left !== null ? (over ? 'over' : 'left') : 'eaten'}
              </p>
              <Ring
                value={target !== null && target > 0 ? eaten / target : 0}
                size={48}
                strokeWidth={5}
                color={m.color}
                aria-label={
                  target !== null
                    ? `${m.name}: ${eaten} of ${target} grams`
                    : `${m.name}: ${eaten} grams`
                }
              >
                <span
                  className="text-[10px] font-semibold tabular-nums"
                  style={{ color: m.color }}
                >
                  {target !== null && target > 0
                    ? `${Math.min(999, Math.round((eaten / target) * 100))}%`
                    : `${eaten}`}
                </span>
              </Ring>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

export function Dashboard() {
  const query = useQuery({ queryKey: qk.dashboard, queryFn: api.getDashboard })

  if (query.isPending) return <DashboardSkeleton />

  if (query.isError) {
    return (
      <EmptyState
        pose="think"
        title="Hmm, that didn't load"
        body={errorMessage(query.error)}
        action={
          <Button variant="outline" onClick={() => query.refetch()}>
            Try again
          </Button>
        }
      />
    )
  }

  const { user, targets, today, streak } = query.data
  const firstName = user.full_name.trim().split(/\s+/)[0] || user.full_name
  const hasLogs = today.log_count > 0

  return (
    <div className="space-y-4 p-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
      {/* Greeting */}
      <header className="flex items-center justify-between gap-3 px-1">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{greeting()},</p>
          <h1 className="truncate text-2xl font-bold tracking-tight">{firstName}</h1>
        </div>
        <StreakBadge streak={streak} />
      </header>

      <CaloriesCard totals={today.totals} targets={targets} />
      <MacroCards totals={today.totals} targets={targets} />

      {!targets && <CompleteProfileCard />}

      {/* Today's logs */}
      <section className="space-y-2 pt-2">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="font-semibold tracking-tight">Recently logged</h2>
          {hasLogs && (
            <p className="text-xs text-muted-foreground">
              {today.log_count} {today.log_count === 1 ? 'meal' : 'meals'} today
            </p>
          )}
        </div>
        {hasLogs ? (
          <LogList logs={today.logs} />
        ) : (
          <Card>
            <EmptyState
              pose="cheer"
              title="Nothing logged yet"
              body="Log your first meal of the day and keep your streak warm."
              action={
                <Button asChild size="lg">
                  <Link to="/app/log">Log your first meal</Link>
                </Button>
              }
            />
          </Card>
        )}
      </section>

      {/* Floating log button */}
      {hasLogs && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-30">
          <div className="mx-auto flex max-w-md justify-end px-4">
            <Button
              asChild
              size="icon"
              className="pointer-events-auto size-14 shadow-lg [&_svg:not([class*='size-'])]:size-6"
            >
              <Link to="/app/log" aria-label="Log food">
                <Plus />
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
