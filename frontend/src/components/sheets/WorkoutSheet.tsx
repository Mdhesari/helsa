import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Bike,
  Dumbbell,
  Flower2,
  Footprints,
  MoreHorizontal,
  PersonStanding,
  Timer,
  Trophy,
  Waves,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SegmentedControl } from '@/components/ui/segmented'
import { cn } from '@/lib/utils'
import * as api from '../../api/client'
import { errorMessage } from '../../api/client'
import type { WorkoutActivity, WorkoutIntensity } from '../../api/types'
import { invalidateWorkoutData } from '../../lib/queries'
import { useToast } from '../Toast'

export const ACTIVITY_META: Record<
  WorkoutActivity,
  { label: string; icon: LucideIcon }
> = {
  walking: { label: 'Walking', icon: Footprints },
  running: { label: 'Running', icon: PersonStanding },
  cycling: { label: 'Cycling', icon: Bike },
  swimming: { label: 'Swimming', icon: Waves },
  strength: { label: 'Strength', icon: Dumbbell },
  yoga: { label: 'Yoga', icon: Flower2 },
  hiit: { label: 'HIIT', icon: Timer },
  sports: { label: 'Sports', icon: Trophy },
  other: { label: 'Other', icon: MoreHorizontal },
}

const ACTIVITIES = Object.keys(ACTIVITY_META) as WorkoutActivity[]

interface WorkoutSheetProps {
  open: boolean
  onClose: () => void
}

/** Bottom sheet for logging a workout; calories are estimated when left blank. */
export function WorkoutSheet({ open, onClose }: WorkoutSheetProps) {
  const qc = useQueryClient()
  const toast = useToast()

  const [activity, setActivity] = useState<WorkoutActivity | null>(null)
  const [duration, setDuration] = useState('30')
  const [intensity, setIntensity] = useState<WorkoutIntensity>('moderate')
  const [calories, setCalories] = useState('')
  const [notes, setNotes] = useState('')

  const create = useMutation({
    mutationFn: () => {
      if (!activity) throw new Error('activity required')
      const cals = calories.trim() === '' ? undefined : Number(calories)
      return api.createWorkout({
        activity,
        duration_min: Number(duration),
        intensity,
        ...(cals !== undefined ? { calories: cals } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      })
    },
    onSuccess: (w) => {
      invalidateWorkoutData(qc)
      toast.show(
        w.calories_estimated
          ? `Logged — about ${w.calories} kcal burned`
          : `Logged — ${w.calories} kcal burned`,
      )
      handleClose()
    },
    onError: (e) => toast.show(errorMessage(e), { tone: 'error' }),
  })

  function handleClose() {
    setActivity(null)
    setDuration('30')
    setIntensity('moderate')
    setCalories('')
    setNotes('')
    onClose()
  }

  const durationN = Number(duration)
  const caloriesValid =
    calories.trim() === '' ||
    (Number.isFinite(Number(calories)) && Number(calories) >= 0)
  const valid =
    activity !== null &&
    Number.isFinite(durationN) &&
    durationN >= 1 &&
    durationN <= 1440 &&
    caloriesValid

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent aria-describedby={undefined} className="max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log a workout</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div
            role="radiogroup"
            aria-label="Activity"
            className="grid grid-cols-3 gap-2"
          >
            {ACTIVITIES.map((a) => {
              const meta = ACTIVITY_META[a]
              const selected = a === activity
              return (
                <button
                  key={a}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-2xl border bg-card px-2 py-3 text-xs font-semibold transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring/40 active:scale-[0.98]',
                    selected ? 'border-2 border-foreground' : 'hover:border-input',
                  )}
                  onClick={() => setActivity(a)}
                >
                  <meta.icon
                    aria-hidden="true"
                    className="size-5"
                    strokeWidth={1.6}
                  />
                  {meta.label}
                </button>
              )
            })}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="workout_duration">Duration (min)</Label>
              <Input
                id="workout_duration"
                type="text"
                inputMode="numeric"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="workout_calories">Calories (optional)</Label>
              <Input
                id="workout_calories"
                type="text"
                inputMode="numeric"
                placeholder="We'll estimate"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-sm font-medium">Intensity</span>
            <SegmentedControl<WorkoutIntensity>
              label="Intensity"
              value={intensity}
              onChange={setIntensity}
              options={[
                { value: 'low', label: 'Low' },
                { value: 'moderate', label: 'Moderate' },
                { value: 'high', label: 'High' },
              ]}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="workout_notes">Notes (optional)</Label>
            <Textarea
              id="workout_notes"
              rows={2}
              maxLength={500}
              placeholder="evening 5k, felt great"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <Button
            size="xl"
            className="w-full"
            disabled={!valid || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? 'Saving…' : 'Log workout'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
