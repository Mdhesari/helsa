import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Carrot,
  CircleDot,
  Equal,
  Fish,
  Grip,
  Leaf,
  Mars,
  NonBinary,
  Rabbit,
  Salad,
  Snail,
  Sprout,
  Sun,
  TrendingDown,
  TrendingUp,
  UtensilsCrossed,
  Venus,
  Zap,
} from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/select'
import { OptionCardGroup } from '@/components/ui/option-card'
import { SegmentedControl } from '@/components/ui/segmented'
import type { ActivityLevel, Diet, Goal, Sex } from '../../api/types'
import {
  PACE_MAX,
  PACE_MIN,
  RECOMMENDED_PACE,
  cmToFtIn,
  ftInToCm,
  kgToLbs,
  lbsToKg,
  round1,
} from '../../lib/plan'
import { parseDateStr, todayStr } from '../../lib/date'
import type { UnitSystem } from '../onboarding/wizardState'
import { cn } from '@/lib/utils'

/*
 * Reusable, fully controlled plan pickers. Used both by the onboarding wizard
 * and by the Profile page's edit-plan sheets.
 */

// ---------- Sex ----------

export function SexPicker({
  value,
  onChange,
}: {
  value: Sex | null
  onChange: (v: Sex) => void
}) {
  return (
    <OptionCardGroup<Sex>
      label="Sex"
      value={value}
      onChange={onChange}
      options={[
        { value: 'female', label: 'Female', icon: <Venus className="size-5" strokeWidth={1.5} /> },
        { value: 'male', label: 'Male', icon: <Mars className="size-5" strokeWidth={1.5} /> },
        { value: 'other', label: 'Other', icon: <NonBinary className="size-5" strokeWidth={1.5} /> },
      ]}
    />
  )
}

// ---------- Workouts / week → activity level ----------

export function WorkoutsPicker({
  value,
  onChange,
}: {
  value: ActivityLevel | null
  onChange: (v: ActivityLevel) => void
}) {
  return (
    <OptionCardGroup<ActivityLevel>
      label="Workouts per week"
      value={value}
      onChange={onChange}
      options={[
        {
          value: 'light',
          label: '0–2',
          description: 'Workouts now and then',
          icon: <CircleDot className="size-5" strokeWidth={1.5} />,
        },
        {
          value: 'moderate',
          label: '3–5',
          description: 'A few workouts per week',
          icon: <Grip className="size-5" strokeWidth={1.5} />,
        },
        {
          value: 'active',
          label: '6+',
          description: 'Dedicated athlete',
          icon: <Zap className="size-5" strokeWidth={1.5} />,
        },
      ]}
    />
  )
}

// ---------- Birth date ----------

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

type DateParts = { day: string; month: string; year: string }

function splitDate(value: string | null): DateParts {
  if (!value) return { day: '', month: '', year: '' }
  const d = parseDateStr(value)
  return {
    day: String(d.getDate()),
    month: String(d.getMonth() + 1),
    year: String(d.getFullYear()),
  }
}

/** Simple day/month/year selects; emits YYYY-MM-DD or null while incomplete. */
export function BirthDatePicker({
  value,
  onChange,
}: {
  value: string | null
  onChange: (v: string | null) => void
}) {
  // The three selects are held locally rather than derived from `value`: a
  // partial date has no representation in `value` (it is null until all three
  // are chosen), so deriving them would discard each pick as it was made and
  // the picker could never be filled in.
  const [parts, setParts] = useState(() => splitDate(value))

  // Adopt a complete date supplied from outside (Back button, editing an
  // existing profile). Incoming null is ignored so a partial in-progress
  // selection is not wiped by the null this component itself emits.
  useEffect(() => {
    if (value) setParts(splitDate(value))
  }, [value])

  const currentYear = parseDateStr(todayStr()).getFullYear()
  // Contract: age 10–120.
  const years = useMemo(() => {
    const list: number[] = []
    for (let y = currentYear - 10; y >= currentYear - 120; y--) list.push(y)
    return list
  }, [currentYear])

  function emit(day: string, month: string, year: string) {
    setParts({ day, month, year })
    onChange(
      day && month && year
        ? `${year}-${pad2(Number(month))}-${pad2(Number(day))}`
        : null,
    )
  }

  return (
    <div className="grid grid-cols-[1fr_1.4fr_1.1fr] gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="birth_day">Day</Label>
        <NativeSelect
          id="birth_day"
          value={parts.day}
          onChange={(e) => emit(e.target.value, parts.month, parts.year)}
        >
          <option value="">—</option>
          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="birth_month">Month</Label>
        <NativeSelect
          id="birth_month"
          value={parts.month}
          onChange={(e) => emit(parts.day, e.target.value, parts.year)}
        >
          <option value="">—</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="birth_year">Year</Label>
        <NativeSelect
          id="birth_year"
          value={parts.year}
          onChange={(e) => emit(parts.day, parts.month, e.target.value)}
        >
          <option value="">—</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </NativeSelect>
      </div>
    </div>
  )
}

// ---------- Height ----------

export function HeightPicker({
  heightCm,
  unit,
  onChange,
}: {
  heightCm: number | null
  unit: UnitSystem
  onChange: (heightCm: number | null) => void
}) {
  if (unit === 'metric') {
    return (
      <div className="space-y-1.5">
        <Label htmlFor="height_cm">Height (cm)</Label>
        <Input
          id="height_cm"
          type="text"
          inputMode="numeric"
          placeholder="170"
          className="h-14 text-lg font-semibold"
          value={heightCm === null ? '' : String(heightCm)}
          onChange={(e) => {
            const raw = e.target.value.trim()
            if (raw === '') return onChange(null)
            const n = Number(raw)
            if (Number.isFinite(n)) onChange(Math.round(n))
          }}
        />
      </div>
    )
  }

  const ftIn = heightCm !== null ? cmToFtIn(heightCm) : null
  return (
    <div className="space-y-1.5">
      <span className="text-sm font-medium">Height</span>
      <div className="grid grid-cols-2 gap-3">
        <NativeSelect
          aria-label="Height (feet)"
          value={ftIn ? String(ftIn.ft) : ''}
          onChange={(e) => {
            if (!e.target.value) return onChange(null)
            onChange(ftInToCm(Number(e.target.value), ftIn?.inch ?? 0))
          }}
        >
          <option value="">— ft</option>
          {[3, 4, 5, 6, 7, 8].map((f) => (
            <option key={f} value={f}>
              {f} ft
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Height (inches)"
          value={ftIn ? String(ftIn.inch) : ''}
          onChange={(e) => {
            if (!e.target.value) return
            onChange(ftInToCm(ftIn?.ft ?? 5, Number(e.target.value)))
          }}
        >
          <option value="">— in</option>
          {Array.from({ length: 12 }, (_, i) => i).map((i) => (
            <option key={i} value={i}>
              {i} in
            </option>
          ))}
        </NativeSelect>
      </div>
    </div>
  )
}

// ---------- Weight ----------

export function WeightField({
  id,
  label,
  weightKg,
  unit,
  onChange,
  big = false,
}: {
  id: string
  label: string
  weightKg: number | null
  unit: UnitSystem
  onChange: (weightKg: number | null) => void
  big?: boolean
}) {
  const display =
    weightKg === null
      ? ''
      : unit === 'metric'
        ? String(round1(weightKg))
        : String(round1(kgToLbs(weightKg)))

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label} ({unit === 'metric' ? 'kg' : 'lbs'})
      </Label>
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        placeholder={unit === 'metric' ? '70' : '155'}
        className={cn(
          'h-14 text-lg font-semibold',
          big && 'h-16 text-center text-3xl font-bold tabular-nums',
        )}
        value={display}
        onChange={(e) => {
          const raw = e.target.value.trim()
          if (raw === '') return onChange(null)
          const n = Number(raw)
          if (!Number.isFinite(n)) return
          onChange(unit === 'metric' ? n : round1(lbsToKg(n)))
        }}
      />
    </div>
  )
}

export function UnitToggle({
  unit,
  onChange,
  className,
}: {
  unit: UnitSystem
  onChange: (u: UnitSystem) => void
  className?: string
}) {
  return (
    <SegmentedControl<UnitSystem>
      label="Units"
      value={unit}
      onChange={onChange}
      className={className}
      options={[
        { value: 'metric', label: 'Metric (kg · cm)' },
        { value: 'imperial', label: 'Imperial (lbs · ft)' },
      ]}
    />
  )
}

// ---------- Goal ----------

export function GoalPicker({
  value,
  onChange,
}: {
  value: Goal | null
  onChange: (v: Goal) => void
}) {
  return (
    <OptionCardGroup<Goal>
      label="Goal"
      value={value}
      onChange={onChange}
      options={[
        {
          value: 'lose',
          label: 'Lose weight',
          icon: <TrendingDown className="size-5" strokeWidth={1.5} />,
        },
        {
          value: 'maintain',
          label: 'Maintain',
          icon: <Equal className="size-5" strokeWidth={1.5} />,
        },
        {
          value: 'gain',
          label: 'Gain weight',
          icon: <TrendingUp className="size-5" strokeWidth={1.5} />,
        },
      ]}
    />
  )
}

// ---------- Pace ----------

const PACE_STEP = 0.1

export function PacePicker({
  value,
  onChange,
  unit,
}: {
  value: number
  onChange: (v: number) => void
  unit: UnitSystem
}) {
  const display =
    unit === 'metric'
      ? `${value.toFixed(1)} kg`
      : `${round1(kgToLbs(value)).toFixed(1)} lbs`
  const isRecommended = Math.abs(value - RECOMMENDED_PACE) < 0.001

  return (
    <div className="space-y-5">
      <div className="text-center">
        <p className="text-4xl font-bold tabular-nums tracking-tight">{display}</p>
        <p className="mt-1 text-sm text-muted-foreground">per week</p>
        <p
          className={cn(
            'mx-auto mt-2 w-fit rounded-full px-3 py-1 text-xs font-semibold transition-colors',
            isRecommended ? 'bg-accent/15 text-accent' : 'invisible',
          )}
        >
          Recommended
        </p>
      </div>

      <input
        type="range"
        className="helsa-range"
        min={PACE_MIN}
        max={PACE_MAX}
        step={PACE_STEP}
        value={value}
        aria-label="Weekly pace"
        aria-valuetext={`${display} per week`}
        onChange={(e) => onChange(round1(Number(e.target.value)))}
      />

      <div className="flex items-start justify-between text-center">
        <button
          type="button"
          className="flex w-16 flex-col items-center gap-1 rounded-xl py-1 text-xs font-medium text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          onClick={() => onChange(0.2)}
        >
          <Snail aria-hidden="true" className="size-6" strokeWidth={1.5} />
          Slow
        </button>
        <button
          type="button"
          className={cn(
            'flex w-24 flex-col items-center gap-1 rounded-xl py-1 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
            isRecommended ? 'text-accent' : 'text-muted-foreground',
          )}
          onClick={() => onChange(RECOMMENDED_PACE)}
        >
          <Rabbit aria-hidden="true" className="size-6" strokeWidth={1.5} />
          Recommended
        </button>
        <button
          type="button"
          className="flex w-16 flex-col items-center gap-1 rounded-xl py-1 text-xs font-medium text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          onClick={() => onChange(1.2)}
        >
          <Zap aria-hidden="true" className="size-6" strokeWidth={1.5} />
          Fast
        </button>
      </div>
    </div>
  )
}

// ---------- Diet ----------

const DIET_OPTIONS: readonly {
  value: Diet
  label: string
  description: string
}[] = [
  { value: 'balanced', label: 'Balanced', description: 'A bit of everything' },
  { value: 'whole_food', label: 'Whole food', description: 'Minimally processed' },
  { value: 'mediterranean', label: 'Mediterranean', description: 'Olive oil, fish, greens' },
  { value: 'flexitarian', label: 'Flexitarian', description: 'Mostly plants, some meat' },
  { value: 'pescatarian', label: 'Pescatarian', description: 'Fish, no meat' },
  { value: 'vegetarian', label: 'Vegetarian', description: 'No meat or fish' },
  { value: 'vegan', label: 'Vegan', description: 'Plants only' },
]

const DIET_ICONS: Record<Diet, ReactNode> = {
  balanced: <UtensilsCrossed className="size-5" strokeWidth={1.5} />,
  whole_food: <Carrot className="size-5" strokeWidth={1.5} />,
  mediterranean: <Sun className="size-5" strokeWidth={1.5} />,
  flexitarian: <Salad className="size-5" strokeWidth={1.5} />,
  pescatarian: <Fish className="size-5" strokeWidth={1.5} />,
  vegetarian: <Leaf className="size-5" strokeWidth={1.5} />,
  vegan: <Sprout className="size-5" strokeWidth={1.5} />,
}

export function DietPicker({
  value,
  onChange,
}: {
  value: Diet | null
  onChange: (v: Diet) => void
}) {
  return (
    <OptionCardGroup<Diet>
      label="Diet"
      value={value}
      onChange={onChange}
      options={DIET_OPTIONS.map((d) => ({
        value: d.value,
        label: d.label,
        description: d.description,
        icon: DIET_ICONS[d.value],
      }))}
    />
  )
}

export const DIET_LABELS: Record<Diet, string> = {
  balanced: 'Balanced',
  whole_food: 'Whole food',
  mediterranean: 'Mediterranean',
  flexitarian: 'Flexitarian',
  pescatarian: 'Pescatarian',
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
}

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary',
  light: 'Light (0–2 workouts/week)',
  moderate: 'Moderate (3–5 workouts/week)',
  active: 'Active (6+ workouts/week)',
  very_active: 'Very active',
}

export const GOAL_LABELS: Record<Goal, string> = {
  lose: 'Lose weight',
  maintain: 'Maintain weight',
  gain: 'Gain weight',
}

export const SEX_LABELS: Record<Sex, string> = {
  female: 'Female',
  male: 'Male',
  other: 'Other',
}
