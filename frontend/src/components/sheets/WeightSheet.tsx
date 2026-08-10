import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import * as api from '../../api/client'
import { errorMessage } from '../../api/client'
import { invalidateWeightData } from '../../lib/queries'
import { UnitToggle, WeightField } from '../plan/pickers'
import type { UnitSystem } from '../onboarding/wizardState'
import { useToast } from '../Toast'
import { ScaleIllustration } from '../../assets/illustrations'

interface WeightSheetProps {
  open: boolean
  onClose: () => void
  /** Pre-fill with the last known weight so one tap logs "unchanged". */
  initialKg?: number | null
}

/** Bottom sheet for a weigh-in; the newest entry also updates the plan. */
export function WeightSheet({ open, onClose, initialKg = null }: WeightSheetProps) {
  const qc = useQueryClient()
  const toast = useToast()

  const [unit, setUnit] = useState<UnitSystem>('metric')
  const [weightKg, setWeightKg] = useState<number | null>(initialKg)
  // Re-seed the field whenever the sheet re-opens with a fresh initial value.
  const [seenOpen, setSeenOpen] = useState(open)
  if (open !== seenOpen) {
    setSeenOpen(open)
    if (open) setWeightKg(initialKg)
  }

  const create = useMutation({
    mutationFn: () => {
      if (weightKg === null) throw new Error('weight required')
      return api.createWeight({ weight_kg: weightKg })
    },
    onSuccess: () => {
      invalidateWeightData(qc)
      toast.show('Weight logged')
      onClose()
    },
    onError: (e) => toast.show(errorMessage(e), { tone: 'error' }),
  })

  const valid = weightKg !== null && weightKg >= 20 && weightKg <= 400

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Log your weight</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex justify-center">
            <ScaleIllustration size={80} />
          </div>
          <UnitToggle unit={unit} onChange={setUnit} />
          <WeightField
            id="weigh_in"
            label="Today's weight"
            weightKg={weightKg}
            unit={unit}
            big
            onChange={setWeightKg}
          />
          <Button
            size="xl"
            className="w-full"
            disabled={!valid || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? 'Saving…' : 'Save weigh-in'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
