import * as React from 'react'
import { ChevronDownIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Styled *native* select — deliberate choice over the Radix popover select:
 * the OS picker is the best UX on mobile (Helsa's timezone list alone has
 * ~400 entries), and it keeps the bundle lean. Visuals match the Input.
 */
function NativeSelect({
  className,
  children,
  ...props
}: React.ComponentProps<'select'>) {
  return (
    <div className="relative">
      <select
        data-slot="select"
        className={cn(
          'border-input flex h-12 w-full appearance-none rounded-xl border bg-background px-4 pr-10 text-base transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
          'focus-visible:border-ring focus-visible:ring-ring/20 focus-visible:ring-[3px]',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDownIcon
        aria-hidden="true"
        className="text-muted-foreground pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2"
      />
    </div>
  )
}

export { NativeSelect }
