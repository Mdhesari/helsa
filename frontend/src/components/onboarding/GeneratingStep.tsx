import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

const CHECKLIST = [
  { at: 15, label: 'Calories' },
  { at: 35, label: 'Carbs' },
  { at: 55, label: 'Protein' },
  { at: 75, label: 'Fats' },
  { at: 92, label: 'Weekly pace' },
] as const

const PHASES = [
  { at: 0, label: 'Reading your answers…' },
  { at: 30, label: 'Calibrating your daily targets…' },
  { at: 65, label: 'Balancing your macros…' },
  { at: 88, label: 'Finalizing results…' },
] as const

const DURATION_MS = 3200

/** Animated "we're setting everything up" percent screen. */
export function GeneratingStep({ onDone }: { onDone: () => void }) {
  const [pct, setPct] = useState(0)
  const doneRef = useRef(false)

  useEffect(() => {
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION_MS)
      // ease-out so the last percent points crawl in
      const eased = 1 - Math.pow(1 - t, 2.2)
      setPct(Math.round(eased * 100))
      if (t < 1) {
        raf = requestAnimationFrame(tick)
      } else if (!doneRef.current) {
        doneRef.current = true
        window.setTimeout(onDone, 450)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [onDone])

  const phase = [...PHASES].reverse().find((p) => pct >= p.at) ?? PHASES[0]

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 bg-background px-5 py-10 sm:border-x">
      <div className="text-center" aria-live="polite">
        <p className="text-6xl font-bold tabular-nums tracking-tight">{pct}%</p>
        <h1 className="text-screen-title mt-4 text-balance">
          We're setting everything up for you
        </h1>
      </div>

      <Progress value={pct} className="h-2" aria-label="Generating your plan" />

      <p className="text-center text-[17px] text-muted-foreground">{phase.label}</p>

      <Card>
        <CardContent className="space-y-3">
          <p className="font-semibold">Daily recommendation for</p>
          <ul className="space-y-2.5">
            {CHECKLIST.map((item) => {
              const done = pct >= item.at
              return (
                <li key={item.label} className="flex items-center justify-between text-[15px]">
                  <span className="flex items-center gap-2">
                    <span aria-hidden="true" className="text-muted-foreground">
                      •
                    </span>
                    {item.label}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`flex size-6 items-center justify-center rounded-full transition-all duration-300 ${
                      done ? 'scale-100 bg-foreground text-background' : 'scale-75 bg-secondary'
                    }`}
                  >
                    {done && <Check className="size-3.5" strokeWidth={3} />}
                  </span>
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
