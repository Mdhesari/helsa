import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import * as api from '../api/client'
import { errorMessage } from '../api/client'
import type { ReportPeriod, ReportResponse } from '../api/types'
import { qk } from '../lib/queries'
import {
  formatDay,
  formatMonth,
  formatRange,
  parseDateStr,
  stepDate,
  todayStr,
} from '../lib/date'
import { InsightSkeleton, ReportsSkeleton } from '../components/Skeletons'
import { EmptyState } from '../components/EmptyState'

const PERIODS: { value: ReportPeriod; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]

const TICK = { fontSize: 11, fill: 'var(--muted-foreground)', fontWeight: 500 } as const

function periodLabel(
  period: ReportPeriod,
  date: string,
  report?: ReportResponse,
): string {
  if (report) {
    if (period === 'daily') return formatDay(report.start_date)
    if (period === 'weekly') return formatRange(report.start_date, report.end_date)
    return formatMonth(report.start_date)
  }
  if (period === 'daily') return formatDay(date)
  if (period === 'monthly') return formatMonth(date)
  return formatDay(date)
}

function DeltaChip({ label, pct }: { label: string; pct: number }) {
  const rounded = Math.round(pct)
  const within = Math.abs(pct) <= 10
  const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : '±'
  return (
    <Badge variant={within ? 'secondary' : 'outline'} className="tabular-nums">
      {label} {sign}
      {Math.abs(rounded)}%
    </Badge>
  )
}

function InsightCard({ period, date }: { period: ReportPeriod; date: string }) {
  const query = useQuery({
    queryKey: qk.insight(period, date),
    queryFn: () => api.getInsight(period, date),
    staleTime: 5 * 60 * 1000, // insights are expensive; don't refetch eagerly
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles aria-hidden="true" className="size-4" strokeWidth={1.8} />
          Insight
        </CardTitle>
      </CardHeader>
      <CardContent>
        {query.isPending ? (
          <InsightSkeleton />
        ) : query.isError ? (
          <p className="text-sm text-muted-foreground">{errorMessage(query.error)}</p>
        ) : (
          <div className="space-y-3">
            <p className="whitespace-pre-line text-sm leading-relaxed">
              {query.data.text}
            </p>
            <p className="text-xs leading-snug text-muted-foreground">
              {query.data.disclaimer}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ReportContent({
  report,
  period,
  date,
}: {
  report: ReportResponse
  period: ReportPeriod
  date: string
}) {
  const chartData = report.buckets.map((b) => ({
    date: b.date,
    day: parseDateStr(b.date).getDate(),
    calories: Math.round(b.totals.calories),
    protein: Math.round(b.totals.protein_g),
    carbs: Math.round(b.totals.carbs_g),
    fat: Math.round(b.totals.fat_g),
  }))

  const hasAnyLogs = report.buckets.some((b) => b.log_count > 0)

  return (
    <>
      {/* Calories per day */}
      <Card>
        <CardHeader>
          <CardTitle>Calories</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={TICK}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis tick={TICK} axisLine={false} tickLine={false} width={48} />
                <Tooltip
                  cursor={{ fill: 'var(--secondary)' }}
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid var(--border)',
                    fontSize: 12,
                  }}
                  formatter={(value) => [`${value ?? 0} kcal`, 'Calories']}
                  labelFormatter={(_, payload) => {
                    const d = payload?.[0]?.payload?.date as string | undefined
                    return d ? formatDay(d) : ''
                  }}
                />
                <Bar dataKey="calories" fill="var(--foreground)" radius={[5, 5, 0, 0]} />
                {report.targets && (
                  <ReferenceLine
                    y={report.targets.calories}
                    stroke="var(--muted-foreground)"
                    strokeDasharray="6 4"
                    strokeWidth={1.5}
                    label={{
                      value: 'target',
                      position: 'insideTopRight',
                      fill: 'var(--muted-foreground)',
                      fontSize: 11,
                      fontWeight: 500,
                    }}
                  />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Macro trend (stacked grams per day) */}
      <Card>
        <CardHeader>
          <CardTitle>Macros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <XAxis
                  dataKey="day"
                  tick={TICK}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis tick={TICK} axisLine={false} tickLine={false} width={40} />
                <Tooltip
                  cursor={{ fill: 'var(--secondary)' }}
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid var(--border)',
                    fontSize: 12,
                  }}
                  formatter={(value, name) => [`${value ?? 0} g`, String(name)]}
                  labelFormatter={(_, payload) => {
                    const d = payload?.[0]?.payload?.date as string | undefined
                    return d ? formatDay(d) : ''
                  }}
                />
                <Bar dataKey="protein" name="Protein" stackId="m" fill="var(--protein)" />
                <Bar dataKey="carbs" name="Carbs" stackId="m" fill="var(--carbs)" />
                <Bar
                  dataKey="fat"
                  name="Fat"
                  stackId="m"
                  fill="var(--fat)"
                  radius={[5, 5, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 text-xs font-medium text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-protein" /> Protein
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-carbs" /> Carbs
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-fat" /> Fat
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Averages + deltas vs target */}
      {report.averages && (
        <Card>
          <CardHeader>
            <CardTitle>
              Daily average{' '}
              <span className="text-sm font-normal text-muted-foreground">
                (logged days)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { label: 'kcal', value: report.averages.calories },
                { label: 'protein', value: report.averages.protein_g },
                { label: 'carbs', value: report.averages.carbs_g },
                { label: 'fat', value: report.averages.fat_g },
              ].map((it) => (
                <div key={it.label} className="rounded-xl bg-secondary px-1 py-2.5">
                  <p className="text-lg font-bold tabular-nums">{Math.round(it.value)}</p>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {it.label}
                  </p>
                </div>
              ))}
            </div>
            {report.deltas && (
              <div className="flex flex-wrap gap-2">
                <DeltaChip label="Calories" pct={report.deltas.calories_pct} />
                <DeltaChip label="Protein" pct={report.deltas.protein_pct} />
                <DeltaChip label="Carbs" pct={report.deltas.carbs_pct} />
                <DeltaChip label="Fat" pct={report.deltas.fat_pct} />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Complete-profile prompt (raw totals shown above regardless) */}
      {!report.profile_complete && (
        <Link
          to="/app/profile"
          className="flex items-center gap-3 rounded-2xl border border-dashed bg-secondary/50 p-4 transition-colors hover:bg-secondary"
        >
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Want targets on these charts?</p>
            <p className="text-sm text-muted-foreground">
              Complete your profile to compare your days against personal targets.
            </p>
          </div>
          <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
        </Link>
      )}

      {hasAnyLogs ? (
        <InsightCard period={period} date={date} />
      ) : (
        <Card>
          <EmptyState
            pose="sleep"
            title="No logs in this period"
            body="Once you log some meals, trends and insights will show up here."
            action={
              <Button asChild size="lg">
                <Link to="/app/log">Log a meal</Link>
              </Button>
            }
          />
        </Card>
      )}
    </>
  )
}

export function Reports() {
  const [period, setPeriod] = useState<ReportPeriod>('weekly')
  const [date, setDate] = useState(todayStr)

  const query = useQuery({
    queryKey: qk.report(period, date),
    queryFn: () => api.getReport(period, date),
  })

  const atToday = parseDateStr(date) >= parseDateStr(todayStr())

  return (
    <div className="space-y-4 p-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="px-1">
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
      </header>

      {/* Period segmented toggle */}
      <Tabs value={period} onValueChange={(v) => setPeriod(v as ReportPeriod)}>
        <TabsList className="w-full" aria-label="Report period">
          {PERIODS.map((p) => (
            <TabsTrigger key={p.value} value={p.value}>
              {p.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Date navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Previous period"
          onClick={() => setDate((d) => stepDate(d, period, -1))}
        >
          <ChevronLeft strokeWidth={2} />
        </Button>
        <span className="text-sm font-semibold">
          {periodLabel(period, date, query.data)}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Next period"
          disabled={atToday}
          onClick={() => setDate((d) => stepDate(d, period, 1))}
        >
          <ChevronRight strokeWidth={2} />
        </Button>
      </div>

      {query.isPending ? (
        <ReportsSkeleton />
      ) : query.isError ? (
        <EmptyState
          pose="think"
          title="Couldn't load this report"
          body={errorMessage(query.error)}
          action={
            <Button variant="outline" onClick={() => query.refetch()}>
              Try again
            </Button>
          }
        />
      ) : (
        <ReportContent report={query.data} period={period} date={date} />
      )}
    </div>
  )
}
