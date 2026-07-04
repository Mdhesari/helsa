import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import * as api from '../api/client'
import { errorMessage } from '../api/client'
import type { Totals } from '../api/types'
import { qk } from '../lib/queries'
import { Mascot } from '../components/Mascot'
import { StreakBadge } from '../components/StreakBadge'
import { MacroBar } from '../components/MacroBar'
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
      className="card flex items-center gap-3 border-2 border-dashed border-primary-300 bg-primary-50"
    >
      <Mascot pose="think" size={56} />
      <div className="flex-1">
        <p className="font-extrabold text-sand-800">Get personal targets</p>
        <p className="text-sm font-medium text-sand-500">
          Complete your profile to get personal targets for calories and macros.
        </p>
      </div>
      <span className="text-xl font-extrabold text-primary-600" aria-hidden="true">
        ›
      </span>
    </Link>
  )
}

function RawTotals({ totals }: { totals: Totals }) {
  const items = [
    { label: 'Calories', value: totals.calories, unit: 'kcal' },
    { label: 'Protein', value: totals.protein_g, unit: 'g' },
    { label: 'Carbs', value: totals.carbs_g, unit: 'g' },
    { label: 'Fat', value: totals.fat_g, unit: 'g' },
  ]
  return (
    <div className="grid grid-cols-4 gap-2 text-center">
      {items.map((it) => (
        <div key={it.label} className="rounded-xl bg-sand-100 px-1 py-2">
          <p className="text-lg font-extrabold text-sand-800 tabular-nums">
            {Math.round(it.value)}
          </p>
          <p className="text-[10px] font-bold text-sand-400 uppercase">
            {it.label} ({it.unit})
          </p>
        </div>
      ))}
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
          <button type="button" className="btn-neutral" onClick={() => query.refetch()}>
            Try again
          </button>
        }
      />
    )
  }

  const { user, targets, today, streak } = query.data
  const firstName = user.full_name.trim().split(/\s+/)[0] || user.full_name
  const hasLogs = today.log_count > 0

  return (
    <div className="space-y-4 p-4">
      {/* Greeting */}
      <header className="flex items-center gap-3">
        <Mascot pose={hasLogs ? 'happy' : 'sleep'} size={64} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-extrabold text-sand-900">
            {greeting()}, {firstName}!
          </h1>
          <p className="text-sm font-semibold text-sand-400">
            {hasLogs
              ? `${today.log_count} ${today.log_count === 1 ? 'meal' : 'meals'} logged today`
              : 'Nothing logged yet today'}
          </p>
        </div>
        <StreakBadge streak={streak} />
      </header>

      {/* Today's numbers */}
      <section className="card space-y-3">
        <h2 className="font-extrabold text-sand-800">Today</h2>
        {targets ? (
          <>
            <MacroBar
              label="Calories"
              value={today.totals.calories}
              target={targets.calories}
              unit="kcal"
              color="var(--color-primary-500)"
            />
            <MacroBar
              label="Protein"
              value={today.totals.protein_g}
              target={targets.protein_g}
              color="var(--color-sky)"
            />
            <MacroBar
              label="Carbs"
              value={today.totals.carbs_g}
              target={targets.carbs_g}
              color="var(--color-sun)"
            />
            <MacroBar
              label="Fat"
              value={today.totals.fat_g}
              target={targets.fat_g}
              color="var(--color-berry)"
            />
          </>
        ) : (
          <RawTotals totals={today.totals} />
        )}
      </section>

      {!targets && <CompleteProfileCard />}

      {/* Today's logs */}
      <section className="space-y-2">
        <h2 className="px-1 font-extrabold text-sand-800">Today's logs</h2>
        {hasLogs ? (
          <LogList logs={today.logs} />
        ) : (
          <div className="card">
            <EmptyState
              pose="cheer"
              title="Let's get today started!"
              body="Log your first meal and your streak flame stays warm."
              action={
                <Link to="/app/log" className="btn-primary">
                  Log your first meal
                </Link>
              }
            />
          </div>
        )}
      </section>

      {/* Floating log button */}
      {hasLogs && (
        <div className="pointer-events-none fixed inset-x-0 bottom-20 z-30">
          <div className="mx-auto flex max-w-md justify-end px-4">
            <Link
              to="/app/log"
              className="btn-primary pointer-events-auto rounded-full px-5 shadow-lg"
            >
              <span aria-hidden="true" className="text-lg leading-none">
                +
              </span>{' '}
              Log food
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
