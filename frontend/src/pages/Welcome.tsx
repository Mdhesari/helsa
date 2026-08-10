import { Link, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import {
  AppleIllustration,
  DumbbellIllustration,
  FlameIllustration,
} from '../assets/illustrations'

/** Pre-auth hero: illustration trio, headline, Get Started. */
export function Welcome() {
  const navigate = useNavigate()

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-background px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))] sm:border-x">
      <div className="flex flex-1 flex-col items-center justify-center gap-10 text-center">
        <div className="flex items-end justify-center gap-2">
          <AppleIllustration size={84} className="animate-pop-in [animation-delay:80ms]" />
          <FlameIllustration size={132} className="animate-pop-in" />
          <DumbbellIllustration size={84} className="animate-pop-in [animation-delay:160ms]" />
        </div>

        <div className="space-y-3">
          <h1 className="text-balance text-4xl font-bold leading-tight tracking-tight">
            Health tracking made&nbsp;easy
          </h1>
          <p className="mx-auto max-w-xs text-[17px] leading-snug text-muted-foreground">
            Calories, workouts, weight, habits and how you feel — one calm place,
            one daily plan.
          </p>
        </div>
      </div>

      <div className="space-y-4 pt-6">
        <Button size="xl" className="w-full" onClick={() => navigate('/onboarding')}>
          Get started
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-semibold text-foreground underline underline-offset-4"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
