import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export interface OptionCardItem<T extends string> {
  value: T
  label: string
  description?: string
  /** Rendered inside the pale circle chip on the left. */
  icon?: ReactNode
}

interface OptionCardGroupProps<T extends string> {
  value: T | null
  onChange: (value: T) => void
  options: readonly OptionCardItem<T>[]
  /** Accessible name for the radiogroup. */
  label: string
  className?: string
}

/**
 * CalAI-style option cards: white card, icon chip, label, radio circle.
 * Selected = 2px black border + filled black radio dot.
 */
export function OptionCardGroup<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: OptionCardGroupProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('space-y-3', className)}>
      {options.map((opt) => {
        const selected = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            className={cn(
              'flex min-h-[72px] w-full items-center gap-4 rounded-3xl border bg-card px-4 py-4 text-left transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 active:scale-[0.99]',
              selected
                ? 'border-2 border-foreground'
                : 'border hover:border-input',
            )}
            onClick={() => onChange(opt.value)}
          >
            {opt.icon !== undefined && (
              <span
                aria-hidden="true"
                className="flex size-12 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground"
              >
                {opt.icon}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-[17px] font-semibold leading-snug">
                {opt.label}
              </span>
              {opt.description && (
                <span className="mt-0.5 block text-sm text-muted-foreground">
                  {opt.description}
                </span>
              )}
            </span>
            <span
              aria-hidden="true"
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                selected ? 'border-foreground bg-foreground' : 'border-input bg-card',
              )}
            >
              {selected && <span className="size-2 rounded-full bg-white" />}
            </span>
          </button>
        )
      })}
    </div>
  )
}
