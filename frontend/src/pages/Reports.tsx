import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Download, Sparkles } from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import * as api from '../api/client'
import { errorMessage } from '../api/client'
import type { ReportPeriod, ReportResponse } from '../api/types'
import { qk } from '../lib/queries'
import {
  formatDay,
  formatMonth,
  formatRange,
  formatShortDate,
  stepDate,
  todayStr,
} from '../lib/date'
import { InsightSkeleton, ReportsSkeleton } from '../components/Skeletons'
import { EmptyState } from '../components/EmptyState'
import { useToast } from '../components/Toast'
import { HABIT_ICONS } from '../components/habits/AddHabitDialog'
import { TrophyIllustration } from '../assets/illustrations'

const PERIODS: { value: ReportPeriod; label: string }[] = [
  { value: 'daily', label: 'D' },
  { value: 'weekly', label: 'W' },
  { value: 'monthly', label: 'M' },
]

const TICK = { fontSize: 11, fill: 'var(--muted-foreground)', fontWeight: 500 } as const

function periodLabel(period: ReportPeriod, report: ReportResponse): string {
  if (period === 'daily') return formatDay(report.start_date)
  if (period === 'weekly') return formatRange(report.start_date, report.end_date)
  return formatMonth(report.start_date)
}

function DeltaChip({ label, pct }: { label: string; pct: number }) {
  const rounded = Math.round(pct)
  const within = Math.abs(pct) <= 10
  return (
    <div className="flex items-center justify-between rounded-2xl border bg-card px-3.5 py-2.5">
      <span className="text-sm font-medium">{label}</span>
      <span
        className={cn(
          'rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums',
          within
            ? 'bg-secondary text-foreground'
            : pct > 0
              ? 'bg-[color-mix(in_srgb,var(--carbs)_15%,white)] text-[var(--carbs)]'
              : 'bg-[color-mix(in_srgb,var(--info)_12%,white)] text-info',
        )}
      >
        {rounded > 0 ? '+' : ''}
        {rounded}%
      </span>
    </div>
  )
}

/** Progress: weight trend, calories vs target, macro deltas, habits, insight. */
export function Reports() {
  const toast = useToast()
  const [period, setPeriod] = useState<ReportPeriod>('weekly')
  const [date, setDate] = useState(todayStr())
  const [insightOpen, setInsightOpen] = useState(false)
  const [exporting, setExporting] = useState(false)

  const reportQuery = useQuery({
    queryKey: qk.report(period, date),
    queryFn: () => api.getReport(period, date),
  })

  const insightQuery = useQuery({
    queryKey: qk.insight(period, date),
    queryFn: () => api.getInsight(period, date),
    enabled: insightOpen,
    staleTime: 5 * 60_000,
  })

  async function handleExport() {
    setExporting(true)
    try {
      await api.exportXlsx()
    } catch (e) {
      toast.show(errorMessage(e), { tone: 'error' })
    } finally {
      setExporting(false)
    }
  }

  const report = reportQuery.data
  const targets = report?.plan.targets ?? null

  const calorieData =
    report?.buckets.map((b) => ({
      date: b.date,
      label: period === 'monthly' ? String(Number(b.date.slice(8))) : formatShortDate(b.date),
      calories: Math.round(b.totals.calories),
      burned: b.burned_calories,
    })) ?? []

  const weightData =
    report?.weights.map((w) => ({
      date: w.date,
      label: formatShortDate(w.date),
      kg: w.weight_kg,
    })) ?? []
  const targetKg = report?.plan.target_weight_kg ?? null

  return (
    <div className="space-y-5 p-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between gap-3 px-1">
        <h1 className="text-2xl font-bold tracking-tight">Progress</h1>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as ReportPeriod)}>
          <TabsList>
            {PERIODS.map((p) => (
              <TabsTrigger key={p.value} value={p.value} aria-label={`${p.value} report`}>
                {p.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </header>

      <div className="flex items-center justify-between px-1">
        <Button
          variant="secondary"
          size="icon-sm"
          aria-label="Previous period"
          onClick={() => setDate((d) => stepDate(d, period, -1))}
        >
          <ChevronLeft strokeWidth={2} />
        </Button>
        <span className="text-sm font-semibold" aria-live="polite">
          {report ? periodLabel(period, report) : '…'}
        </span>
        <Button
          variant="secondary"
          size="icon-sm"
          aria-label="Next period"
          disabled={date >= todayStr()}
          onClick={() => setDate((d) => stepDate(d, period, 1))}
        >
          <ChevronRight strokeWidth={2} />
        </Button>
      </div>

      {reportQuery.isPending ? (
        <ReportsSkeleton />
      ) : reportQuery.isError ? (
        <EmptyState
          illustration={<TrophyIllustration size={80} />}
          title="Couldn't load this report"
          body={errorMessage(reportQuery.error)}
          action={<Button onClick={() => reportQuery.refetch()}>Try again</Button>}
        />
      ) : report ? (
        <>
          {/* Weight trend */}
          <Card>
            <CardHeader>
              <CardTitle>Weight trend</CardTitle>
            </CardHeader>
            <CardContent>
              {weightData.length >= 2 ? (
                <div className="h-44">
                  <ResponsiveContainer>
                    <AreaChart data={weightData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="weight-fill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--foreground)" stopOpacity={0.14} />
                          <stop offset="100%" stopColor="var(--foreground)" stopOpacity={0.01} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="label" tick={TICK} tickLine={false} axisLine={false} minTickGap={24} />
                      <YAxis
                        tick={TICK}
                        tickLine={false}
                        axisLine={false}
                        width={44}
                        domain={['dataMin - 1', 'dataMax + 1']}
                        tickFormatter={(v: number) => v.toFixed(1)}
                      />
                      <Tooltip
                        formatter={(value) => [`${Number(value).toFixed(1)} kg`, 'Weight']}
                        labelFormatter={(label) => String(label)}
                        contentStyle={{ borderRadius: 12, border: '1px solid var(--border)' }}
                      />
                      {targetKg !== null && (
                        <ReferenceLine
                          y={targetKg}
                          stroke="var(--muted-foreground)"
                          strokeDasharray="4 4"
                          label={{ value: `Target ${targetKg}`, ...TICK, position: 'insideTopRight' }}
                        />
                      )}
                      <Area
                        type="monotone"
                        dataKey="kg"
                        stroke="var(--foreground)"
                        strokeWidth={2}
                        fill="url(#weight-fill)"
                        dot={{ r: 3, strokeWidth: 2, stroke: 'var(--foreground)', fill: 'var(--card)' }}
                        activeDot={{ r: 4 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Log your weight a couple of times to see the trend here.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Calories vs target */}
          <Card>
            <CardHeader>
              <CardTitle>Calories</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-44">
                <ResponsiveContainer>
                  <BarChart data={calorieData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <XAxis dataKey="label" tick={TICK} tickLine={false} axisLine={false} minTickGap={20} />
                    {/* 4-digit calorie ticks need the room, or they render clipped. */}
                    <YAxis tick={TICK} tickLine={false} axisLine={false} width={46} />
                    <Tooltip
                      formatter={(value, name) => [
                        `${value} kcal`,
                        name === 'calories' ? 'Eaten' : 'Burned',
                      ]}
                      contentStyle={{ borderRadius: 12, border: '1px solid var(--border)' }}
                    />
                    {targets !== null && (
                      <ReferenceLine
                        y={targets.calories}
                        stroke="var(--accent)"
                        strokeDasharray="4 4"
                        label={{ value: `${targets.calories}`, ...TICK, position: 'insideTopRight' }}
                      />
                    )}
                    <Bar dataKey="calories" fill="var(--foreground)" radius={[5, 5, 0, 0]} maxBarSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {report.averages !== null && (
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  Avg on logged days: {Math.round(report.averages.calories)} kcal
                  {targets !== null && ` · target ${targets.calories}`}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Macro deltas */}
          {report.deltas !== null && (
            <Card>
              <CardHeader>
                <CardTitle>vs your targets</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2">
                <DeltaChip label="Calories" pct={report.deltas.calories_pct} />
                <DeltaChip label="Protein" pct={report.deltas.protein_pct} />
                <DeltaChip label="Carbs" pct={report.deltas.carbs_pct} />
                <DeltaChip label="Fat" pct={report.deltas.fat_pct} />
              </CardContent>
            </Card>
          )}

          {/* Habits */}
          {report.habits.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Habits</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {report.habits.map(({ habit, series }) => {
                  const total = series.reduce((sum, p) => sum + p.count, 0)
                  const daysHit =
                    habit.daily_target === null
                      ? null
                      : series.filter((p) =>
                          habit.direction === 'reduce'
                            ? p.count <= habit.daily_target!
                            : p.count >= habit.daily_target!,
                        ).length
                  const Icon = HABIT_ICONS[habit.kind]
                  const max = Math.max(1, ...series.map((p) => p.count))
                  return (
                    <div key={habit.id} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-sm font-medium">
                          <Icon aria-hidden="true" className="size-4" strokeWidth={1.6} />
                          {habit.name}
                        </span>
                        <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                          {total} {habit.unit}
                          {daysHit !== null && ` · ${daysHit}/${series.length} days on target`}
                        </span>
                      </div>
                      <div
                        aria-hidden="true"
                        className="flex h-8 items-end gap-[3px]"
                        title={`${habit.name} per day`}
                      >
                        {series.map((p) => (
                          <div
                            key={p.date}
                            className={cn(
                              'flex-1 rounded-sm',
                              p.count === 0 ? 'bg-secondary' : 'bg-foreground/70',
                            )}
                            style={{ height: `${Math.max(12, (p.count / max) * 100)}%` }}
                          />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}

          {/* AI insight */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Sparkles aria-hidden="true" className="size-4 text-accent" strokeWidth={1.8} />
                Insight
              </CardTitle>
              {!insightOpen && (
                <Button size="sm" variant="secondary" onClick={() => setInsightOpen(true)}>
                  Generate
                </Button>
              )}
            </CardHeader>
            {insightOpen && (
              <CardContent>
                {insightQuery.isPending ? (
                  <InsightSkeleton />
                ) : insightQuery.isError ? (
                  <p className="text-sm font-medium text-destructive">
                    {errorMessage(insightQuery.error)}
                  </p>
                ) : insightQuery.data ? (
                  <div className="space-y-3">
                    <p className="whitespace-pre-line text-[15px] leading-relaxed">
                      {insightQuery.data.text}
                    </p>
                    <p className="text-xs leading-snug text-muted-foreground">
                      {insightQuery.data.disclaimer}
                    </p>
                  </div>
                ) : null}
              </CardContent>
            )}
          </Card>

          <Button
            variant="outline"
            className="w-full"
            disabled={exporting}
            onClick={handleExport}
          >
            <Download strokeWidth={1.8} />
            {exporting ? 'Preparing…' : 'Export everything (.xlsx)'}
          </Button>
        </>
      ) : null}
    </div>
  )
}
