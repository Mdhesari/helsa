import { useState } from 'react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { Food, FoodLogInput, FoodServing } from '../../api/types'
import { composeServingText, computeTotals } from '../../lib/nutrition'
import { cn } from '@/lib/utils'
import { QuantityStepper } from './QuantityStepper'

interface FoodDetailSheetProps {
  food: Food | null
  busy?: boolean
  serverError?: string | null
  onClose: () => void
  onLog: (input: FoodLogInput) => void
}

/** Serving + quantity picker with a live macro summary; logs the snapshot. */
export function FoodDetailSheet({ food, busy, serverError, onClose, onLog }: FoodDetailSheetProps) {
  return (
    <Dialog open={food !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent aria-describedby={undefined}>
        {food && <SheetBody key={food.id} food={food} busy={busy} serverError={serverError} onLog={onLog} />}
      </DialogContent>
    </Dialog>
  )
}

function SheetBody({
  food,
  busy,
  serverError,
  onLog,
}: {
  food: Food
  busy?: boolean
  serverError?: string | null
  onLog: (input: FoodLogInput) => void
}) {
  const [serving, setServing] = useState<FoodServing>(food.servings[0])
  const [qty, setQty] = useState(1)

  const totals = computeTotals(food, serving, qty)

  function handleLog() {
    onLog({
      food_name: food.name,
      serving: composeServingText(serving, qty),
      calories: totals.calories,
      protein_g: totals.protein_g,
      carbs_g: totals.carbs_g,
      fat_g: totals.fat_g,
      food_ref_id: food.id,
    })
  }

  return (
    <div className="space-y-5">
      <DialogHeader>
        <DialogTitle className="pr-6 text-left">{food.name}</DialogTitle>
        <p className="text-left text-xs text-muted-foreground">
          {food.is_custom ? 'My food' : food.category}
        </p>
      </DialogHeader>

      {food.servings.length > 1 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Serving</p>
          <div className="flex flex-wrap gap-2">
            {food.servings.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={s.id === serving.id}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                  s.id === serving.id
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'bg-card text-muted-foreground hover:bg-secondary',
                )}
                onClick={() => setServing(s)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          Quantity
          {food.servings.length === 1 && (
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              × {serving.label}
            </span>
          )}
        </p>
        <QuantityStepper value={qty} onChange={setQty} />
      </div>

      {/* Live summary, style-matched to LogList rows. */}
      <div className="rounded-2xl bg-secondary px-4 py-3">
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-bold tabular-nums">
            {Math.round(totals.calories)}
            <span className="ml-1 text-xs font-medium text-muted-foreground">kcal</span>
          </span>
          <span className="text-xs text-muted-foreground">
            {`P ${Math.round(totals.protein_g)} · C ${Math.round(totals.carbs_g)} · F ${Math.round(totals.fat_g)}`}
          </span>
        </div>
      </div>

      {serverError && (
        <p className="text-sm font-medium text-destructive">{serverError}</p>
      )}

      <Button className="w-full" size="lg" disabled={busy} onClick={handleLog}>
        {busy ? 'Logging…' : 'Log it'}
      </Button>
    </div>
  )
}
