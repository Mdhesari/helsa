import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ChevronRight, Flame, NotebookPen, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import * as api from '../api/client'
import { errorMessage } from '../api/client'
import type { DashboardHabit, Workout } from '../api/types'
import { invalidateHabitData, qk } from '../lib/queries'
import { formatTime } from '../lib/date'
import { Ring } from '../components/Ring'
import { EmptyState } from '../components/EmptyState'
import { LogList } from '../components/LogList'
import { DashboardSkeleton } from '../components/Skeletons'
import { AddHabitDialog, HABIT_ICONS } from '../components/habits/AddHabitDialog'
import { ACTIVITY_META } from '../components/sheets/WorkoutSheet'
import { AppleIllustration, FlameIllustration, MoodFace } from '../assets/illustrations'

function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'Up late'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

const MACROS = [
  { key: 'protein_g', label: 'Protein', color: 'var(--protein)' },
  { key: 'carbs_g', label: 'Carbs', color: 'var(--carbs)' },
  { key: 'fat_g', label: 'Fat', color: 'var(--fat)' },
] as const

function HabitChip({ item }: { item: DashboardHabit }) {
  const qc = useQueryClient()
  const Icon = HABIT_ICONS[item.habit.kind]
  const target = item.habit.daily_target

  // Over a "reduce" target reads as a warning; hitting a "build" target reads
  // as success.
  const overReduce =
    item.habit.direction === 'reduce' && target !== null && item.count > target
  const builtUp =
    item.habit.direction === 'build' && target !== null && item.count >= target

  const log = useMutation({
    mutationFn: () => api.createHabitLog(item.habit.id),
    onSuccess: () => invalidateHabitData(qc),
  })

  return (
    <button
      type="button"
      disabled={log.isPending}
      aria-label={`${item.habit.name}: ${item.count} ${item.habit.unit} today. Add one.`}
      className={cn(
        'flex min-w-[92px] shrink-0 flex-col items-start gap-1.5 rounded-3xl border bg-card px-3.5 py-3 text-left transition-all outline-none hover:border-input focus-visible:ring-2 focus-visible:ring-ring/40 active:scale-[0.97]',
        overReduce && 'border-destructive/40',
        builtUp && 'border-foreground/50',
      )}
      onClick={() => log.mutate()}
    >
      <span className="flex w-full items-center justify-between">
        <Icon
          aria-hidden="true"
          className={cn('size-4.5', overReduce && 'text-destructive')}
          strokeWidth={1.6}
        />
        <Plus aria-hidden="true" className="size-3.5 text-muted-foreground" />
      </span>
      <span className="text-lg font-bold leading-none tabular-nums">
        {item.count}
        {target !== null && (
          <span className="text-xs font-semibold text-muted-foreground">/{target}</span>
        )}
      </span>
      <span className="max-w-full truncate text-[11px] font-medium text-muted-foreground">
        {item.habit.name}
      </span>
    </button>
  )
}

function WorkoutRow({ workout }: { workout: Workout }) {
  const meta = ACTIVITY_META[workout.activity]
  return (
    <li className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3">
      <span
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary"
      >
        <meta.icon className="size-5" strokeWidth={1.6} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{meta.label}</p>
        <p className="truncate text-xs text-muted-foreground">
          {formatTime(workout.logged_at)} · {workout.duration_min} min
        </p>
      </div>
      <span className="font-semibold tabular-nums">
        {workout.calories}
        <span className="ml-0.5 text-[10px] font-medium text-muted-foreground">kcal</span>
      </span>
    </li>
  )
}

/** Home: plan ring, macros, habits quick-log, today's workouts and meals. */
export function Dashboard() {
  const [addingHabit, setAddingHabit] = useState(false)

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: qk.dashboard,
    queryFn: api.getDashboard,
  })

  if (isPending) return <DashboardSkeleton />

  if (isError) {
    return (
      <EmptyState
        illustration={<FlameIllustration size={80} />}
        title="Couldn't load your day"
        body={errorMessage(error)}
        action={<Button onClick={() => refetch()}>Try again</Button>}
      />
    )
  }

  const { user, plan, today, streak } = data
  const firstName = user.full_name.split(' ')[0]
  const targets = plan.targets
  const eaten = today.food.totals
  const remainingCals =
    targets !== null ? Math.round(targets.calories - eaten.calories) : null

  return (
    <div className="space-y-5 p-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between px-1">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{greeting()},</p>
          <h1 className="text-2xl font-bold tracking-tight">{firstName}</h1>
        </div>
        <div
          className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5"
          title={`Longest streak: ${streak.longest_days} days`}
        >
          <Flame
            aria-hidden="true"
            className={cn(
              'size-4.5',
              streak.current_days > 0 ? 'text-accent' : 'text-muted-foreground/50',
            )}
            strokeWidth={2}
          />
          <span className="text-sm font-bold tabular-nums">{streak.current_days}</span>
          <span className="sr-only">day streak</span>
        </div>
      </header>

      {/* Calories ring card */}
      <Card>
        <CardContent className="flex items-center justify-between gap-4">
          {targets !== null && remainingCals !== null ? (
            <>
              <div>
                <p className="text-4xl font-bold tabular-nums tracking-tight">
                  {Math.abs(remainingCals)}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {remainingCals >= 0 ? 'Calories left' : 'Calories over'}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {Math.round(eaten.calories)} eaten
                  {today.burned_calories > 0 && ` · ${today.burned_calories} burned`}
                </p>
              </div>
              <Ring
                value={eaten.calories / Math.max(1, targets.calories)}
                size={104}
                strokeWidth={9}
                aria-label="Calories eaten toward today's target"
              >
                <Flame
                  aria-hidden="true"
                  className={cn('size-7', remainingCals < 0 && 'text-destructive')}
                  strokeWidth={1.6}
                />
              </Ring>
            </>
          ) : (
            <div className="flex w-full items-center gap-4">
              <FlameIllustration size={64} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">Finish your plan</p>
                <p className="text-sm text-muted-foreground">
                  A few answers unlock daily calorie & macro targets.
                </p>
              </div>
              <Button asChild size="sm">
                <Link to="/app/profile">
                  Set up
                  <ChevronRight className="size-4" />
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Macro trio */}
      {targets !== null && (
        <div className="grid grid-cols-3 gap-3">
          {MACROS.map((m) => {
            const eatenG = eaten[m.key]
            const targetG = targets[m.key]
            return (
              <Card key={m.key} className="gap-0 py-4">
                <CardContent className="flex flex-col items-start gap-2 px-4">
                  <Ring
                    value={eatenG / Math.max(1, targetG)}
                    size={44}
                    strokeWidth={5}
                    color={m.color}
                    aria-label={`${m.label} progress`}
                  />
                  <p className="text-base font-bold tabular-nums leading-none">
                    {Math.round(eatenG)}
                    <span className="text-xs font-semibold text-muted-foreground">
                      /{Math.round(targetG)}g
                    </span>
                  </p>
                  <p className="-mt-0.5 text-xs text-muted-foreground">{m.label}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Habits quick-log */}
      <section aria-label="Habits" className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-semibold tracking-tight">Habits</h2>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => setAddingHabit(true)}
          >
            <Plus strokeWidth={2} />
            Add
          </Button>
        </div>
        {today.habits.length > 0 ? (
          <div className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1">
            {today.habits.map((h) => (
              <HabitChip key={h.habit.id} item={h} />
            ))}
          </div>
        ) : (
          <button
            type="button"
            className="w-full rounded-3xl border border-dashed bg-card/50 px-4 py-4 text-sm font-medium text-muted-foreground transition-colors hover:border-input"
            onClick={() => setAddingHabit(true)}
          >
            Track cigarettes, water, coffee — tap to add your first habit
          </button>
        )}
      </section>

      {/* Today's workouts */}
      {today.workouts.length > 0 && (
        <section aria-label="Workouts" className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="font-semibold tracking-tight">Workouts</h2>
            <span className="text-sm font-semibold tabular-nums text-muted-foreground">
              {today.burned_calories} kcal burned
            </span>
          </div>
          <ul className="space-y-2">
            {today.workouts.map((w) => (
              <WorkoutRow key={w.id} workout={w} />
            ))}
          </ul>
        </section>
      )}

      {/* Diary nudge / status */}
      <Link
        to="/app/diary"
        className="flex items-center gap-3 rounded-3xl border bg-card px-4 py-3.5 transition-colors hover:border-input"
      >
        {today.diary?.mood ? (
          <MoodFace level={today.diary.mood as 1 | 2 | 3 | 4 | 5} size={36} />
        ) : (
          <span
            aria-hidden="true"
            className="flex size-9 items-center justify-center rounded-full bg-secondary"
          >
            <NotebookPen className="size-4.5" strokeWidth={1.6} />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">
            {today.diary ? "Today's diary" : 'How was today?'}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {today.diary?.text ??
              (today.diary ? 'Tap to add a note' : 'A 10-second check-in keeps the streak alive')}
          </span>
        </span>
        <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      </Link>

      {/* Today's meals */}
      <section aria-label="Meals" className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-semibold tracking-tight">Meals</h2>
          <span className="text-sm font-semibold tabular-nums text-muted-foreground">
            {Math.round(eaten.calories)} kcal
          </span>
        </div>
        {today.food.logs.length > 0 ? (
          <LogList logs={today.food.logs} />
        ) : (
          <Card>
            <EmptyState
              illustration={<AppleIllustration size={72} />}
              title="Nothing logged yet"
              body="Log your first meal of the day — it takes seconds."
              action={
                <Button asChild>
                  <Link to="/app/log">
                    <Plus strokeWidth={2} />
                    Log food
                  </Link>
                </Button>
              }
            />
          </Card>
        )}
      </section>

      <AddHabitDialog
        open={addingHabit}
        onClose={() => setAddingHabit(false)}
        existingKinds={today.habits.map((h) => h.habit.kind)}
      />
    </div>
  )
}
