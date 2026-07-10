import { useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface FoodSearchInputProps {
  value: string
  onChange: (value: string) => void
}

/**
 * Autofocused search bar. Best effort on iOS Safari: programmatic focus
 * outside a user gesture may leave the field focused without the keyboard —
 * the degraded case is one extra tap, by design (no scroll/timeout hacks).
 */
export function FoodSearchInput({ value, onChange }: FoodSearchInputProps) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    ref.current?.focus()
  }, [])

  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        strokeWidth={2}
      />
      <Input
        ref={ref}
        autoFocus
        type="search"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder="Search foods…"
        aria-label="Search foods"
        className="h-11 pr-10 pl-9 text-base"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Clear search"
          className="absolute top-1/2 right-1.5 -translate-y-1/2 text-muted-foreground"
          onClick={() => {
            onChange('')
            ref.current?.focus()
          }}
        >
          <X strokeWidth={2} />
        </Button>
      )}
    </div>
  )
}
