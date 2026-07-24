import { useId } from 'react'

import { cn } from '@/lib/utils'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
}

interface SegmentedControlProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: readonly SegmentedOption<T>[]
  /** Accessible name for the group. */
  label: string
  className?: string
  disabled?: boolean
}

/**
 * Pill segmented control (`#F1F1F4` container, white raised active segment).
 * Implemented as a radiogroup of real buttons for a11y.
 */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
  disabled,
}: SegmentedControlProps<T>) {
  const id = useId()
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'inline-flex h-11 w-full items-center rounded-full bg-[#f1f1f4] p-1',
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            id={`${id}-${opt.value}`}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            className={cn(
              'inline-flex h-full flex-1 items-center justify-center whitespace-nowrap rounded-full px-3 text-sm font-semibold transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50',
              active
                ? 'bg-white text-foreground shadow-[0_1px_4px_rgb(0_0_0/0.08)]'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
