import { useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { FoodLogInput } from '../api/types'

interface FoodLogFormProps {
  /**
   * Pre-fill values (edit mode, or a future food-reference picker pre-filling
   * nutrients client-side). Pass a `key` prop when these can change identity.
   */
  initialValues?: Partial<FoodLogInput>
  onSubmit: (input: FoodLogInput) => void | Promise<void>
  submitLabel?: string
  busy?: boolean
  /** Server-side error (e.g. ApiError message) rendered above the button. */
  serverError?: string | null
  onCancel?: () => void
}

interface Draft {
  food_name: string
  serving: string
  calories: string
  protein_g: string
  carbs_g: string
  fat_g: string
}

function numToStr(n: number | undefined): string {
  return n === undefined ? '' : String(n)
}

/** '' → 0 (contract: values ≥ 0); invalid → null. */
function parseNum(s: string): number | null {
  if (s.trim() === '') return 0
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 ? n : null
}

const NUMERIC_FIELDS = [
  { name: 'calories', label: 'Calories', unit: 'kcal' },
  { name: 'protein_g', label: 'Protein', unit: 'g' },
  { name: 'carbs_g', label: 'Carbs', unit: 'g' },
  { name: 'fat_g', label: 'Fat', unit: 'g' },
] as const

type NumericField = (typeof NUMERIC_FIELDS)[number]['name']

export function FoodLogForm({
  initialValues,
  onSubmit,
  submitLabel = 'Save',
  busy = false,
  serverError,
  onCancel,
}: FoodLogFormProps) {
  const [draft, setDraft] = useState<Draft>({
    food_name: initialValues?.food_name ?? '',
    serving: initialValues?.serving ?? '',
    calories: numToStr(initialValues?.calories),
    protein_g: numToStr(initialValues?.protein_g),
    carbs_g: numToStr(initialValues?.carbs_g),
    fat_g: numToStr(initialValues?.fat_g),
  })
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({})

  function set(field: keyof Draft, value: string) {
    setDraft((d) => ({ ...d, [field]: value }))
    setErrors((e) => ({ ...e, [field]: undefined }))
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const nextErrors: Partial<Record<keyof Draft, string>> = {}

    const food_name = draft.food_name.trim()
    if (!food_name) nextErrors.food_name = 'What did you eat?'

    const parsed = {} as Record<NumericField, number>
    for (const f of NUMERIC_FIELDS) {
      const n = parseNum(draft[f.name])
      if (n === null) nextErrors[f.name] = 'Enter a number of 0 or more'
      else parsed[f.name] = n
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    void onSubmit({
      food_name,
      serving: draft.serving.trim(),
      calories: parsed.calories,
      protein_g: parsed.protein_g,
      carbs_g: parsed.carbs_g,
      fat_g: parsed.fat_g,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="food_name">Food</Label>
        <Input
          id="food_name"
          placeholder="e.g. Greek yogurt"
          value={draft.food_name}
          onChange={(e) => set('food_name', e.target.value)}
          aria-invalid={!!errors.food_name}
          autoComplete="off"
          maxLength={120}
        />
        {errors.food_name && (
          <p className="text-sm font-medium text-destructive">{errors.food_name}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="serving">
          Serving <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="serving"
          placeholder="e.g. 1 cup"
          value={draft.serving}
          onChange={(e) => set('serving', e.target.value)}
          autoComplete="off"
          maxLength={120}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {NUMERIC_FIELDS.map((f) => (
          <div key={f.name} className="space-y-1.5">
            <Label htmlFor={f.name}>
              {f.label}{' '}
              <span className="font-normal text-muted-foreground">({f.unit})</span>
            </Label>
            <Input
              id={f.name}
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={draft[f.name]}
              onChange={(e) => set(f.name, e.target.value)}
              aria-invalid={!!errors[f.name]}
              autoComplete="off"
            />
            {errors[f.name] && (
              <p className="text-sm font-medium text-destructive">{errors[f.name]}</p>
            )}
          </div>
        ))}
      </div>

      {serverError && (
        <p className="text-sm font-medium text-destructive" role="alert">
          {serverError}
        </p>
      )}

      <div className="flex gap-3 pt-1">
        {onCancel && (
          <Button type="button" variant="outline" size="lg" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" size="lg" className="flex-1" disabled={busy}>
          {busy ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}
