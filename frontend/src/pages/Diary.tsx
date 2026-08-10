import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import * as api from '../api/client'
import { errorMessage } from '../api/client'
import type { DiaryEntry, DiaryUpsertRequest } from '../api/types'
import { invalidateDiaryData, qk } from '../lib/queries'
import { addDays, formatDay, todayStr } from '../lib/date'
import { MoodFace, MoonIllustration } from '../assets/illustrations'
import { EmptyState } from '../components/EmptyState'
import { useToast } from '../components/Toast'

const LEVELS = [1, 2, 3, 4, 5] as const
type Level = (typeof LEVELS)[number]

const MOOD_LABELS: Record<Level, string> = {
  1: 'Awful',
  2: 'Low',
  3: 'Okay',
  4: 'Good',
  5: 'Great',
}

function FaceRow({
  label,
  value,
  onPick,
}: {
  label: string
  value: number | null
  onPick: (level: Level) => void
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <div role="radiogroup" aria-label={label} className="flex justify-between">
        {LEVELS.map((level) => {
          const selected = value === level
          return (
            <button
              key={level}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${MOOD_LABELS[level]} (${level} of 5)`}
              className={cn(
                'flex flex-col items-center gap-1 rounded-2xl p-1.5 transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
                selected ? 'scale-110' : 'opacity-45 hover:opacity-80',
              )}
              onClick={() => onPick(level)}
            >
              <MoodFace level={level} size={44} />
              <span
                className={cn(
                  'text-[10px] font-semibold',
                  selected ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {MOOD_LABELS[level]}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Diary: one entry per day — mood, energy, and an autosaved note. */
export function Diary() {
  const qc = useQueryClient()
  const toast = useToast()
  const today = todayStr()
  const [date, setDate] = useState(today)

  const dayQuery = useQuery({
    queryKey: qk.diaryDay(date),
    queryFn: () => api.getDiaryDay(date),
  })
  const entry: DiaryEntry | null = dayQuery.data?.entry ?? null

  // Local draft of the note, autosaved with a debounce.
  const [note, setNote] = useState('')
  const [noteDirty, setNoteDirty] = useState(false)
  const loadedFor = useRef<string | null>(null)
  useEffect(() => {
    if (dayQuery.isSuccess && loadedFor.current !== date) {
      loadedFor.current = date
      setNote(entry?.text ?? '')
      setNoteDirty(false)
    }
  }, [dayQuery.isSuccess, date, entry])

  const save = useMutation({
    mutationFn: (req: DiaryUpsertRequest) => api.upsertDiary(date, req),
    onSuccess: () => invalidateDiaryData(qc),
    onError: (e) => toast.show(errorMessage(e), { tone: 'error' }),
  })
  // Keep a stable reference for the debounce effect below.
  const saveRef = useRef(save)
  saveRef.current = save

  useEffect(() => {
    if (!noteDirty) return
    const handle = window.setTimeout(() => {
      saveRef.current.mutate({ text: note.trim() === '' ? null : note })
      setNoteDirty(false)
    }, 800)
    return () => window.clearTimeout(handle)
  }, [note, noteDirty])

  const recentQuery = useQuery({
    queryKey: qk.diaryRange(addDays(today, -13), today),
    queryFn: () => api.getDiaryRange(addDays(today, -13), today),
  })
  const pastEntries = (recentQuery.data?.entries ?? [])
    .filter((e) => e.date !== date)
    .slice()
    .reverse()

  const isToday = date === today

  return (
    <div className="space-y-5 p-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between px-1">
        <h1 className="text-2xl font-bold tracking-tight">Diary</h1>
        <div className="flex items-center gap-1">
          <Button
            variant="secondary"
            size="icon-sm"
            aria-label="Previous day"
            onClick={() => setDate((d) => addDays(d, -1))}
          >
            <ChevronLeft strokeWidth={2} />
          </Button>
          <span className="min-w-24 text-center text-sm font-semibold">
            {isToday ? 'Today' : formatDay(date)}
          </span>
          <Button
            variant="secondary"
            size="icon-sm"
            aria-label="Next day"
            disabled={isToday}
            onClick={() => setDate((d) => addDays(d, 1))}
          >
            <ChevronRight strokeWidth={2} />
          </Button>
        </div>
      </header>

      {dayQuery.isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-40 w-full rounded-3xl" />
          <Skeleton className="h-32 w-full rounded-3xl" />
        </div>
      ) : dayQuery.isError ? (
        <EmptyState
          illustration={<MoonIllustration size={80} />}
          title="Couldn't load this day"
          body={errorMessage(dayQuery.error)}
          action={<Button onClick={() => dayQuery.refetch()}>Try again</Button>}
        />
      ) : (
        <>
          <Card>
            <CardContent className="space-y-6">
              <FaceRow
                label="How's your mood?"
                value={entry?.mood ?? null}
                onPick={(mood) => save.mutate({ mood })}
              />
              <FaceRow
                label="Energy level"
                value={entry?.energy ?? null}
                onPick={(energy) => save.mutate({ energy })}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Notes</p>
                <p className="text-xs text-muted-foreground" aria-live="polite">
                  {save.isPending ? 'Saving…' : noteDirty ? 'Typing…' : entry?.text ? 'Saved' : ''}
                </p>
              </div>
              <Textarea
                aria-label="Diary note"
                rows={5}
                maxLength={2000}
                placeholder="Slept well? Cravings? Anything worth remembering…"
                value={note}
                onChange={(e) => {
                  setNote(e.target.value)
                  setNoteDirty(true)
                }}
              />
            </CardContent>
          </Card>
        </>
      )}

      <section aria-label="Recent entries" className="space-y-2">
        <h2 className="px-1 font-semibold tracking-tight">Last two weeks</h2>
        {recentQuery.isPending ? (
          <Skeleton className="h-16 w-full rounded-3xl" />
        ) : pastEntries.length > 0 ? (
          <ul className="space-y-2">
            {pastEntries.map((e) => (
              <li key={e.date}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-3xl border bg-card px-4 py-3 text-left transition-colors hover:border-input"
                  onClick={() => setDate(e.date)}
                >
                  {e.mood ? (
                    <MoodFace level={e.mood as Level} size={34} />
                  ) : (
                    <span aria-hidden="true" className="size-[34px] rounded-full bg-secondary" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{formatDay(e.date)}</span>
                    {e.text && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {e.text}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <Card>
            <EmptyState
              illustration={<MoonIllustration size={72} />}
              title="No entries yet"
              body="Check in once a day — patterns show up faster than you'd think."
            />
          </Card>
        )}
      </section>
    </div>
  )
}
