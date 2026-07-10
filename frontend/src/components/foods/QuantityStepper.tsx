import { Minus, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const MIN = 0.25
const STEP = 0.5

interface QuantityStepperProps {
  value: number
  onChange: (value: number) => void
}

/** −/+ in 0.5 steps plus direct decimal entry; minimum 0.25. */
export function QuantityStepper({ value, onChange }: QuantityStepperProps) {
  function setClamped(next: number) {
    if (!Number.isFinite(next)) return
    onChange(Math.max(MIN, Math.round(next * 100) / 100))
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Decrease quantity"
        disabled={value <= MIN}
        onClick={() => setClamped(value <= STEP ? MIN : value - STEP)}
      >
        <Minus strokeWidth={2} />
      </Button>
      <Input
        type="number"
        inputMode="decimal"
        min={MIN}
        step={STEP}
        aria-label="Quantity"
        className="h-9 w-20 text-center text-base font-semibold tabular-nums"
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (e.target.value !== '' && Number.isFinite(n) && n >= MIN) onChange(n)
        }}
        onBlur={(e) => setClamped(Number(e.target.value) || MIN)}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Increase quantity"
        onClick={() => setClamped(value + STEP)}
      >
        <Plus strokeWidth={2} />
      </Button>
    </div>
  )
}
