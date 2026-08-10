import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Cigarette, Coffee, Droplets, Plus, Wine } from 'lucide-react'
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
import { SegmentedControl } from '@/components/ui/segmented'
import { cn } from '@/lib/utils'
import * as api from '../../api/client'
import { errorMessage } from '../../api/client'
import type { Habit, HabitDirection, HabitKind } from '../../api/types'
import { invalidateHabitData } from '../../lib/queries'
import { useToast } from '../Toast'

export const HABIT_ICONS: Record<HabitKind, LucideIcon> = {
  cigarette: Cigarette,
  water: Droplets,
  coffee: Coffee,
  alcohol: Wine,
  custom: Plus,
}

const PRESETS: readonly { kind: HabitKind; label: string; hint: string }[] = [
  { kind: 'cigarette', label: 'Cigarettes', hint: 'Cut down, day by day' },
  { kind: 'water', label: 'Water', hint: '8 glasses a day' },
  { kind: 'coffee', label: 'Coffee', hint: 'Keep an eye on cups' },
  { kind: 'alcohol', label: 'Alcohol', hint: 'Track drinks' },
  { kind: 'custom', label: 'Custom', hint: 'Anything countable' },
]

interface AddHabitDialogProps {
  open: boolean
  onClose: () => void
  /** Kinds that already exist (non-archived) — presets get disabled. */
  existingKinds: readonly HabitKind[]
}

/** Preset picker + custom form for starting a new tracked habit. */
export function AddHabitDialog({ open, onClose, existingKinds }: AddHabitDialogProps) {
  const qc = useQueryClient()
  const toast = useToast()

  const [customizing, setCustomizing] = useState(false)
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('times')
  const [direction, setDirection] = useState<HabitDirection>('build')
  const [target, setTarget] = useState('')

  const create = useMutation({
    mutationFn: (input: Parameters<typeof api.createHabit>[0]) =>
      api.createHabit(input),
    onSuccess: (habit: Habit) => {
      invalidateHabitData(qc)
      toast.show(`Now tracking ${habit.name}`)
      handleClose()
    },
    onError: (e) => toast.show(errorMessage(e), { tone: 'error' }),
  })

  function handleClose() {
    setCustomizing(false)
    setName('')
    setUnit('times')
    setDirection('build')
    setTarget('')
    onClose()
  }

  function submitCustom() {
    const t = target.trim() === '' ? undefined : Number(target)
    create.mutate({
      kind: 'custom',
      name: name.trim(),
      unit: unit.trim() || 'times',
      direction,
      ...(t !== undefined && Number.isFinite(t) && t > 0 ? { daily_target: t } : {}),
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{customizing ? 'Custom habit' : 'Track a habit'}</DialogTitle>
        </DialogHeader>

        {!customizing ? (
          <div className="space-y-2.5">
            {PRESETS.map((p) => {
              const Icon = HABIT_ICONS[p.kind]
              const taken = p.kind !== 'custom' && existingKinds.includes(p.kind)
              return (
                <button
                  key={p.kind}
                  type="button"
                  disabled={taken || create.isPending}
                  className={cn(
                    'flex w-full items-center gap-4 rounded-3xl border bg-card px-4 py-3.5 text-left transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring/40 active:scale-[0.99]',
                    taken ? 'opacity-45' : 'hover:border-input',
                  )}
                  onClick={() =>
                    p.kind === 'custom'
                      ? setCustomizing(true)
                      : create.mutate({ kind: p.kind })
                  }
                >
                  <span
                    aria-hidden="true"
                    className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary"
                  >
                    <Icon className="size-5" strokeWidth={1.6} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{p.label}</span>
                    <span className="block text-xs text-muted-foreground">
                      {taken ? 'Already tracking' : p.hint}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="habit_name">Name</Label>
              <Input
                id="habit_name"
                placeholder="e.g. Stretching"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="habit_unit">Unit</Label>
                <Input
                  id="habit_unit"
                  placeholder="times"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="habit_target">Daily target (optional)</Label>
                <Input
                  id="habit_target"
                  type="text"
                  inputMode="numeric"
                  placeholder="e.g. 3"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <span className="text-sm font-medium">Direction</span>
              <SegmentedControl<HabitDirection>
                label="Direction"
                value={direction}
                onChange={setDirection}
                options={[
                  { value: 'build', label: 'Build up' },
                  { value: 'reduce', label: 'Cut down' },
                ]}
              />
            </div>
            <Button
              size="xl"
              className="w-full"
              disabled={name.trim() === '' || create.isPending}
              onClick={submitCustom}
            >
              {create.isPending ? 'Saving…' : 'Start tracking'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
