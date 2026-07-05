import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Mascot } from '../components/Mascot'
import type { MascotPose } from '../components/mascot-poses'

export const ONBOARDED_KEY = 'helsa.onboarded'

interface Slide {
  pose: MascotPose
  title: string
  body: string
}

const SLIDES: Slide[] = [
  {
    pose: 'happy',
    title: 'Log meals in seconds',
    body: 'Jot down what you eat — food, serving, calories and macros. No friction, no fuss.',
  },
  {
    pose: 'think',
    title: 'See your real trends',
    body: 'Daily, weekly and monthly charts show how your eating actually looks over time.',
  },
  {
    pose: 'cheer',
    title: 'Keep your streak alive',
    body: 'Log at least one meal a day and watch your streak grow. No pressure — just a gentle nudge.',
  },
]

export function Onboarding() {
  const navigate = useNavigate()
  const trackRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const last = index === SLIDES.length - 1

  function finish() {
    localStorage.setItem(ONBOARDED_KEY, '1')
    navigate('/register', { replace: true })
  }

  function goTo(i: number) {
    const track = trackRef.current
    if (!track) return
    track.scrollTo({ left: i * track.clientWidth, behavior: 'smooth' })
  }

  function handleScroll() {
    const track = trackRef.current
    if (!track) return
    const i = Math.round(track.scrollLeft / track.clientWidth)
    if (i !== index && i >= 0 && i < SLIDES.length) setIndex(i)
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-background sm:border-x">
      {/* Top bar: back, progress, skip */}
      <div className="flex items-center gap-4 px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
        <Button
          variant="secondary"
          size="icon-sm"
          aria-label="Back"
          className={index === 0 ? 'invisible' : ''}
          onClick={() => goTo(index - 1)}
        >
          <ArrowLeft strokeWidth={2} />
        </Button>
        <Progress
          value={((index + 1) / SLIDES.length) * 100}
          className="h-1.5 flex-1"
          aria-label={`Step ${index + 1} of ${SLIDES.length}`}
        />
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={finish}>
          Skip
        </Button>
      </div>

      {/* Swipeable track (scroll-snap) */}
      <div
        ref={trackRef}
        onScroll={handleScroll}
        className="no-scrollbar flex flex-1 snap-x snap-mandatory overflow-x-auto"
      >
        {SLIDES.map((slide) => (
          <section
            key={slide.title}
            className="flex w-full shrink-0 snap-center flex-col items-center justify-center gap-8 px-8 text-center"
          >
            <div className="flex size-44 items-center justify-center rounded-full bg-secondary">
              <Mascot pose={slide.pose} size={120} className="animate-pop-in" />
            </div>
            <div className="space-y-3">
              <h1 className="text-balance text-4xl font-bold tracking-tight">
                {slide.title}
              </h1>
              <p className="mx-auto max-w-xs text-balance leading-relaxed text-muted-foreground">
                {slide.body}
              </p>
            </div>
          </section>
        ))}
      </div>

      {/* Dots */}
      <div className="flex justify-center gap-2 py-5" aria-hidden="true">
        {SLIDES.map((s, i) => (
          <button
            key={s.title}
            type="button"
            tabIndex={-1}
            onClick={() => goTo(i)}
            className={`h-2 rounded-full transition-all ${
              i === index ? 'w-6 bg-foreground' : 'w-2 bg-border'
            }`}
          />
        ))}
      </div>

      {/* Pinned CTA with a subtle top fade */}
      <div className="bg-gradient-to-t from-background via-background to-transparent px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2">
        <Button
          size="xl"
          className="w-full"
          onClick={() => (last ? finish() : goTo(index + 1))}
        >
          {last ? 'Get started' : 'Continue'}
        </Button>
      </div>
    </div>
  )
}
