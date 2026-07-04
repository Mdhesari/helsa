import { useState, type FormEvent } from 'react'
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
      <div>
        <label className="label" htmlFor="food_name">
          Food
        </label>
        <input
          id="food_name"
          className="input"
          placeholder="e.g. Greek yogurt"
          value={draft.food_name}
          onChange={(e) => set('food_name', e.target.value)}
          autoComplete="off"
          maxLength={120}
        />
        {errors.food_name && <p className="field-error">{errors.food_name}</p>}
      </div>

      <div>
        <label className="label" htmlFor="serving">
          Serving <span className="font-medium text-sand-400">(optional)</span>
        </label>
        <input
          id="serving"
          className="input"
          placeholder="e.g. 1 cup"
          value={draft.serving}
          onChange={(e) => set('serving', e.target.value)}
          autoComplete="off"
          maxLength={120}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {NUMERIC_FIELDS.map((f) => (
          <div key={f.name}>
            <label className="label" htmlFor={f.name}>
              {f.label} <span className="font-medium text-sand-400">({f.unit})</span>
            </label>
            <input
              id={f.name}
              className="input"
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={draft[f.name]}
              onChange={(e) => set(f.name, e.target.value)}
              autoComplete="off"
            />
            {errors[f.name] && <p className="field-error">{errors[f.name]}</p>}
          </div>
        ))}
      </div>

      {serverError && (
        <p className="field-error" role="alert">
          {serverError}
        </p>
      )}

      <div className="flex gap-3">
        {onCancel && (
          <button type="button" className="btn-neutral flex-1" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn-primary flex-1" disabled={busy}>
          {busy ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
