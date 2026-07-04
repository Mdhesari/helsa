import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
    title: 'Log your meals',
    body: 'Jot down what you eat in seconds — food, serving, calories and macros.',
  },
  {
    pose: 'think',
    title: 'See your trends',
    body: 'Daily, weekly and monthly charts show how your eating really looks.',
  },
  {
    pose: 'cheer',
    title: 'Keep your streak',
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
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-sand-50">
      <div className="flex justify-end p-4">
        <button type="button" className="btn-ghost text-sm" onClick={finish}>
          Skip
        </button>
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
            className="flex w-full shrink-0 snap-center flex-col items-center justify-center gap-5 px-8 text-center"
          >
            <Mascot pose={slide.pose} size={180} className="animate-pop-in" />
            <h1 className="text-2xl font-extrabold text-sand-900">{slide.title}</h1>
            <p className="max-w-xs font-medium text-sand-500">{slide.body}</p>
          </section>
        ))}
      </div>

      {/* Dots */}
      <div className="flex justify-center gap-2 py-4" aria-hidden="true">
        {SLIDES.map((s, i) => (
          <button
            key={s.title}
            type="button"
            tabIndex={-1}
            onClick={() => goTo(i)}
            className={`h-2.5 rounded-full transition-all ${
              i === index ? 'w-6 bg-primary-500' : 'w-2.5 bg-sand-300'
            }`}
          />
        ))}
      </div>

      <div className="p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          className="btn-primary w-full"
          onClick={() => (last ? finish() : goTo(index + 1))}
        >
          {last ? 'Get started' : 'Next'}
        </button>
      </div>
    </div>
  )
}
