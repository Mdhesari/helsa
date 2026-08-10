import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

interface WizardChromeProps {
  /** 0-based index of the current question step. */
  step: number
  totalSteps: number
  title: string
  subtitle?: string
  onBack: () => void
  /** Hide the back button on the very first screen. */
  canGoBack?: boolean
  children: ReactNode
  /** Pinned CTA area (usually a Continue button). */
  footer?: ReactNode
}

/**
 * CalAI wizard chrome: circular pale back button, thin progress bar,
 * huge title + gray subtitle, content, and a pinned bottom CTA.
 */
export function WizardChrome({
  step,
  totalSteps,
  title,
  subtitle,
  onBack,
  canGoBack = true,
  children,
  footer,
}: WizardChromeProps) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-background sm:border-x">
      <div className="flex items-center gap-4 px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <Button
          variant="secondary"
          size="icon"
          aria-label="Back"
          className={canGoBack ? 'rounded-full' : 'invisible'}
          onClick={onBack}
        >
          <ArrowLeft strokeWidth={2} />
        </Button>
        <Progress
          value={((step + 1) / totalSteps) * 100}
          className="h-1 flex-1"
          aria-label={`Step ${step + 1} of ${totalSteps}`}
        />
      </div>

      <div key={step} className="animate-step-in flex flex-1 flex-col px-5 pb-6">
        <header className="mb-8 mt-2">
          <h1 className="text-screen-title text-balance">{title}</h1>
          {subtitle && (
            <p className="mt-3 text-[17px] leading-snug text-muted-foreground">
              {subtitle}
            </p>
          )}
        </header>
        <div className="flex-1">{children}</div>
      </div>

      {footer && (
        <div className="sticky bottom-0 bg-gradient-to-t from-background via-background to-transparent px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
          {footer}
        </div>
      )}
    </div>
  )
}
