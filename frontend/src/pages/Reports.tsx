import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
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
import { Mascot } from '../components/Mascot'
import { InsightSkeleton, ReportsSkeleton } from '../components/Skeletons'
import { EmptyState } from '../components/EmptyState'

const PERIODS: { value: ReportPeriod; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]

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
  const cls = within ? 'bg-primary-100 text-primary-700' : 'bg-amber-100 text-amber-700'
  return (
    <span className={`chip ${cls}`}>
      {label} {sign}
      {Math.abs(rounded)}%
    </span>
  )
}

function InsightCard({ period, date }: { period: ReportPeriod; date: string }) {
  const query = useQuery({
    queryKey: qk.insight(period, date),
    queryFn: () => api.getInsight(period, date),
    staleTime: 5 * 60 * 1000, // insights are expensive; don't refetch eagerly
  })

  return (
    <section className="card space-y-3">
      <div className="flex items-center gap-2">
        <Mascot pose="think" size={40} />
        <h2 className="font-extrabold text-sand-800">Insight</h2>
      </div>
      {query.isPending ? (
        <InsightSkeleton />
      ) : query.isError ? (
        <p className="text-sm font-semibold text-sand-500">{errorMessage(query.error)}</p>
      ) : (
        <>
          <p className="text-sm leading-relaxed font-medium whitespace-pre-line text-sand-700">
            {query.data.text}
          </p>
          <p className="text-xs leading-snug text-sand-400">{query.data.disclaimer}</p>
        </>
      )}
    </section>
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
      <section className="card space-y-2">
        <h2 className="font-extrabold text-sand-800">Calories</h2>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-sand-200)"
                vertical={false}
              />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11, fill: 'var(--color-sand-400)', fontWeight: 700 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--color-sand-400)', fontWeight: 700 }}
                axisLine={false}
                tickLine={false}
                width={48}
              />
              <Tooltip
                cursor={{ fill: 'var(--color-sand-100)' }}
                formatter={(value) => [`${value ?? 0} kcal`, 'Calories']}
                labelFormatter={(_, payload) => {
                  const d = payload?.[0]?.payload?.date as string | undefined
                  return d ? formatDay(d) : ''
                }}
              />
              <Bar dataKey="calories" fill="var(--color-primary-500)" radius={[6, 6, 0, 0]} />
              {report.targets && (
                <ReferenceLine
                  y={report.targets.calories}
                  stroke="var(--color-flame)"
                  strokeDasharray="6 4"
                  strokeWidth={2}
                  label={{
                    value: 'target',
                    position: 'insideTopRight',
                    fill: 'var(--color-flame)',
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Macro trend (stacked grams per day) */}
      <section className="card space-y-2">
        <h2 className="font-extrabold text-sand-800">Macros</h2>
        <div className="h-36">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11, fill: 'var(--color-sand-400)', fontWeight: 700 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--color-sand-400)', fontWeight: 700 }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip
                cursor={{ fill: 'var(--color-sand-100)' }}
                formatter={(value, name) => [`${value ?? 0} g`, String(name)]}
                labelFormatter={(_, payload) => {
                  const d = payload?.[0]?.payload?.date as string | undefined
                  return d ? formatDay(d) : ''
                }}
              />
              <Bar dataKey="protein" name="Protein" stackId="m" fill="var(--color-sky)" />
              <Bar dataKey="carbs" name="Carbs" stackId="m" fill="var(--color-sun)" />
              <Bar
                dataKey="fat"
                name="Fat"
                stackId="m"
                fill="var(--color-berry)"
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-4 text-xs font-bold text-sand-500">
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-sky" /> Protein
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-sun" /> Carbs
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-berry" /> Fat
          </span>
        </div>
      </section>

      {/* Averages + deltas vs target */}
      {report.averages && (
        <section className="card space-y-3">
          <h2 className="font-extrabold text-sand-800">
            Daily average{' '}
            <span className="text-sm font-semibold text-sand-400">(logged days)</span>
          </h2>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              { label: 'kcal', value: report.averages.calories },
              { label: 'protein', value: report.averages.protein_g },
              { label: 'carbs', value: report.averages.carbs_g },
              { label: 'fat', value: report.averages.fat_g },
            ].map((it) => (
              <div key={it.label} className="rounded-xl bg-sand-100 px-1 py-2">
                <p className="text-lg font-extrabold text-sand-800 tabular-nums">
                  {Math.round(it.value)}
                </p>
                <p className="text-[10px] font-bold text-sand-400 uppercase">{it.label}</p>
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
        </section>
      )}

      {/* Complete-profile prompt (raw totals shown above regardless) */}
      {!report.profile_complete && (
        <Link
          to="/app/profile"
          className="card flex items-center gap-3 border-2 border-dashed border-primary-300 bg-primary-50"
        >
          <Mascot pose="think" size={48} />
          <div className="flex-1">
            <p className="font-extrabold text-sand-800">Want targets on these charts?</p>
            <p className="text-sm font-medium text-sand-500">
              Complete your profile to compare your days against personal targets.
            </p>
          </div>
          <span className="text-xl font-extrabold text-primary-600" aria-hidden="true">
            ›
          </span>
        </Link>
      )}

      {hasAnyLogs ? (
        <InsightCard period={period} date={date} />
      ) : (
        <div className="card">
          <EmptyState
            pose="sleep"
            title="No logs in this period"
            body="Once you log some meals, trends and insights will show up here."
            action={
              <Link to="/app/log" className="btn-primary">
                Log a meal
              </Link>
            }
          />
        </div>
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
    <div className="space-y-4 p-4">
      <header className="px-1">
        <h1 className="text-xl font-extrabold text-sand-900">Reports</h1>
      </header>

      {/* Period segmented toggle */}
      <div
        role="tablist"
        aria-label="Report period"
        className="flex rounded-2xl border-2 border-sand-200 bg-white p-1"
      >
        {PERIODS.map((p) => (
          <button
            key={p.value}
            role="tab"
            aria-selected={period === p.value}
            type="button"
            onClick={() => setPeriod(p.value)}
            className={`flex-1 rounded-xl py-2 text-sm font-extrabold transition-colors ${
              period === p.value
                ? 'bg-primary-500 text-white'
                : 'text-sand-500 hover:text-sand-700'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Date navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous period"
          className="btn-neutral px-4 py-2"
          onClick={() => setDate((d) => stepDate(d, period, -1))}
        >
          ‹
        </button>
        <span className="font-extrabold text-sand-800">
          {periodLabel(period, date, query.data)}
        </span>
        <button
          type="button"
          aria-label="Next period"
          className="btn-neutral px-4 py-2"
          disabled={atToday}
          onClick={() => setDate((d) => stepDate(d, period, 1))}
        >
          ›
        </button>
      </div>

      {query.isPending ? (
        <ReportsSkeleton />
      ) : query.isError ? (
        <EmptyState
          pose="think"
          title="Couldn't load this report"
          body={errorMessage(query.error)}
          action={
            <button type="button" className="btn-neutral" onClick={() => query.refetch()}>
              Try again
            </button>
          }
        />
      ) : (
        <ReportContent report={query.data} period={period} date={date} />
      )}
    </div>
  )
}
