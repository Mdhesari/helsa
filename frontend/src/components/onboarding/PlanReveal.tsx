import { Beef, Check, Droplet, Flame, Wheat } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatLongDate, todayStr, yearsBetween } from '../../lib/date'
import { computePlan, kgToLbs, round1 } from '../../lib/plan'
import type { PlanInputs } from '../../lib/plan'
import { ACTIVITY_LABELS, DIET_LABELS, SEX_LABELS } from '../plan/pickers'
import type { Diet } from '../../api/types'
import type { UnitSystem } from './wizardState'
import { ProgressCurve } from './ProgressCurve'

interface PlanRevealProps {
  inputs: PlanInputs
  diet: Diet | null
  unit: UnitSystem
  ctaLabel: string
  onContinue: () => void
}

function weightLabel(kg: number, unit: UnitSystem): string {
  return unit === 'metric' ? `${round1(kg)} kg` : `${round1(kgToLbs(kg))} lbs`
}

/** Post-generation plan reveal: goal headline, curve, daily recommendation. */
export function PlanReveal({ inputs, diet, unit, ctaLabel, onContinue }: PlanRevealProps) {
  const plan = computePlan(inputs)
  const { targets } = plan

  let headline: string
  if (inputs.goal === 'maintain') {
    headline = `Goal: maintain ${weightLabel(inputs.weight_kg, unit)}`
  } else {
    const verb = inputs.goal === 'lose' ? 'lose' : 'gain'
    const amount =
      plan.weight_delta_kg !== null ? weightLabel(plan.weight_delta_kg, unit) : null
    headline = amount
      ? plan.projected_end_date
        ? `Goal: ${verb} ${amount} by ${formatLongDate(plan.projected_end_date)}`
        : `Goal: ${verb} ${amount}`
      : `Goal: ${verb} weight`
  }

  const age = yearsBetween(inputs.birth_date, todayStr())

  const macroCards = [
    {
      label: 'Protein',
      grams: targets.protein_g,
      icon: Beef,
      color: 'var(--protein)',
      bg: 'color-mix(in srgb, var(--protein) 12%, white)',
    },
    {
      label: 'Carbs',
      grams: targets.carbs_g,
      icon: Wheat,
      color: 'var(--carbs)',
      bg: 'color-mix(in srgb, var(--carbs) 14%, white)',
    },
    {
      label: 'Fats',
      grams: targets.fat_g,
      icon: Droplet,
      color: 'var(--fat)',
      bg: 'color-mix(in srgb, var(--fat) 12%, white)',
    },
  ] as const

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-background sm:border-x">
      <div className="animate-pop-in flex-1 space-y-5 px-5 pb-6 pt-[max(2rem,env(safe-area-inset-top))]">
        <div className="text-center">
          <span
            aria-hidden="true"
            className="mx-auto flex size-12 items-center justify-center rounded-full bg-foreground text-background"
          >
            <Check className="size-6" strokeWidth={3} />
          </span>
          <h1 className="text-screen-title mt-4 text-balance">{headline}</h1>
        </div>

        <Card className="bg-secondary/40">
          <CardContent className="space-y-3">
            <p className="font-semibold">Estimated progress</p>
            <ProgressCurve
              goal={inputs.goal}
              startLabel="Now"
              endLabel={
                plan.projected_end_date
                  ? formatLongDate(plan.projected_end_date)
                  : 'Ongoing'
              }
              targetLabel={
                inputs.target_weight_kg !== null && inputs.goal !== 'maintain'
                  ? weightLabel(inputs.target_weight_kg, unit)
                  : undefined
              }
            />
            <p className="text-center text-sm text-muted-foreground">
              Weight change takes time — consistency in the early weeks matters most.
            </p>
          </CardContent>
        </Card>

        <section aria-label="Your daily recommendation" className="space-y-3">
          <div>
            <h2 className="text-lg font-bold tracking-tight">Your daily recommendation</h2>
            <p className="text-sm text-muted-foreground">You can edit this anytime</p>
          </div>

          <Card>
            <CardContent className="flex items-center gap-4">
              <span
                aria-hidden="true"
                className="flex size-14 items-center justify-center rounded-2xl bg-secondary"
              >
                <Flame className="size-7" strokeWidth={1.5} />
              </span>
              <div>
                <p className="text-4xl font-bold tabular-nums tracking-tight">
                  {targets.calories}
                </p>
                <p className="text-sm text-muted-foreground">Calories</p>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-3 gap-3">
            {macroCards.map((m) => (
              <Card key={m.label} className="gap-0 py-4">
                <CardContent className="flex flex-col items-start gap-2 px-4">
                  <span
                    aria-hidden="true"
                    className="flex size-9 items-center justify-center rounded-full"
                    style={{ backgroundColor: m.bg, color: m.color }}
                  >
                    <m.icon className="size-4.5" strokeWidth={1.5} />
                  </span>
                  <p className="text-xl font-bold tabular-nums">
                    {m.grams}
                    <span className="text-sm font-semibold">g</span>
                  </p>
                  <p className="-mt-1.5 text-xs text-muted-foreground">{m.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <Card>
          <CardContent className="space-y-2.5">
            <p className="font-semibold">Your info</p>
            <dl className="space-y-2 text-[15px]">
              {[
                ['Sex', SEX_LABELS[inputs.sex]],
                ['Age', `${age} years`],
                [
                  'Height',
                  unit === 'metric'
                    ? `${inputs.height_cm} cm`
                    : `${Math.floor(inputs.height_cm / 30.48)} ft ${Math.round((inputs.height_cm % 30.48) / 2.54)} in`,
                ],
                ['Weight', weightLabel(inputs.weight_kg, unit)],
                ['Activity', ACTIVITY_LABELS[inputs.activity_level]],
                ...(diet ? [['Diet', DIET_LABELS[diet]] as const] : []),
                ...(inputs.goal !== 'maintain' && inputs.pace_kg_per_week !== null
                  ? [['Pace', `${weightLabel(inputs.pace_kg_per_week, unit)} / week`] as const]
                  : []),
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-4">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>

      <div className="sticky bottom-0 bg-gradient-to-t from-background via-background to-transparent px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
        <Button size="xl" className="w-full" onClick={onContinue}>
          {ctaLabel}
        </Button>
      </div>
    </div>
  )
}
