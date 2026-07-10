import * as React from 'react'

import { cn } from '@/lib/utils'

// forwardRef: this codebase is on React 18, where refs on plain function
// components do not pass through props.
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  function Input({ className, type, ...props }, ref) {
    return (
      <input
        ref={ref}
        type={type}
        data-slot="input"
        className={cn(
          'border-input file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground flex h-12 w-full min-w-0 rounded-xl border bg-background px-4 py-1 text-base transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
          'focus-visible:border-ring focus-visible:ring-ring/20 focus-visible:ring-[3px]',
          'aria-invalid:ring-destructive/20 aria-invalid:border-destructive',
          className,
        )}
        {...props}
      />
    )
  },
)

export { Input }
