import { useState } from 'react'
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { PlusCircle } from 'lucide-react'

import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import * as api from '../api/client'
import { errorMessage } from '../api/client'
import type { Food, FoodLogInput } from '../api/types'
import { qk } from '../lib/queries'
import { todayStr } from '../lib/date'
import { useDebouncedValue } from '../lib/useDebouncedValue'
import { useLogFood, useMergedPendingLogs } from '../lib/useLogFood'
import { useOnline, usePendingEntries } from '../lib/useOutbox'
import { FoodLogForm } from '../components/FoodLogForm'
import { LogList } from '../components/LogList'
import { EmptyState } from '../components/EmptyState'
import { useToast } from '../components/Toast'
import { FoodSearchInput } from '../components/foods/FoodSearchInput'
import { FoodSuggestions } from '../components/foods/FoodSuggestions'
import { FoodResultList } from '../components/foods/FoodResultList'
import { FoodDetailSheet } from '../components/foods/FoodDetailSheet'
import { AppleIllustration } from '../assets/illustrations'

const CHEERS = [
  'Logged! Nice one.',
  'Yum — added to your day.',
  'Great, that counts!',
  'Logged. Keep it up!',
]

export function LogFood() {
  const toast = useToast()
  const today = todayStr()
  const logFoodOffline = useLogFood()
  const pendingEntries = usePendingEntries()
  const online = useOnline()

  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Food | null>(null)
  const [creatingCustom, setCreatingCustom] = useState(false)

  const debouncedQuery = useDebouncedValue(query.trim())
  const searching = debouncedQuery.length >= 1

  const searchQuery = useQuery({
    queryKey: qk.foodSearch(debouncedQuery),
    queryFn: () => api.searchFoods(debouncedQuery),
    enabled: searching,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })

  const logsQuery = useQuery({
    queryKey: qk.logs(today),
    queryFn: () => api.getLogs({ date: today }),
  })

  function celebrate(queued: boolean) {
    // Cache invalidation lives in useLogFood, which knows whether the write
    // reached the server or is still sitting in the outbox.
    toast.show(
      queued
        ? "Saved offline — it'll sync when you're back."
        : CHEERS[Math.floor(Math.random() * CHEERS.length)],
    )
  }

  const logFood = useMutation({
    mutationFn: (input: FoodLogInput) => logFoodOffline(input),
    onSuccess: ({ queued }) => {
      setSelected(null)
      celebrate(queued)
    },
  })

  // "Create custom food": create the reference food, then log it once (qty 1).
  const createCustom = useMutation({
    mutationFn: (input: FoodLogInput) => logFoodOffline(input, 'custom-food'),
    onSuccess: ({ queued }) => {
      setCreatingCustom(false)
      setQuery('')
      celebrate(queued)
    },
  })

  const results = searchQuery.data?.foods ?? []
  // Queued entries are merged in so they survive a refetch of today's logs.
  const logs = useMergedPendingLogs(logsQuery.data?.logs ?? [], pendingEntries)

  return (
    <div className="space-y-4 p-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="px-1">
        <h1 className="text-2xl font-bold tracking-tight">Add food</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Search, pick a serving, done. Every entry keeps your streak alive.
        </p>
      </header>

      <FoodSearchInput value={query} onChange={setQuery} />

      {searching ? (
        <section className="space-y-2">
          {searchQuery.isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-2xl" />
            </div>
          ) : searchQuery.isError ? (
            <Card>
              <EmptyState
                illustration={<AppleIllustration size={72} />}
                title={online ? 'Search failed' : 'Search needs a connection'}
                body={
                  online
                    ? errorMessage(searchQuery.error)
                    : "You can still add it with “Create custom food” below — it'll sync later."
                }
              />
            </Card>
          ) : results.length > 0 ? (
            <FoodResultList foods={results} onSelect={setSelected} />
          ) : (
            <Card>
              <EmptyState
                illustration={<AppleIllustration size={72} />}
                title={`No match for “${debouncedQuery}”`}
                body="Can't find it? Create it once and it stays searchable."
              />
            </Card>
          )}
        </section>
      ) : (
        <FoodSuggestions onSelect={setSelected} />
      )}

      <Button
        variant="outline"
        className="w-full"
        onClick={() => setCreatingCustom(true)}
      >
        <PlusCircle strokeWidth={1.8} />
        Create custom food
      </Button>

      <section className="space-y-2 pt-2">
        <h2 className="px-1 font-semibold tracking-tight">Today's logs</h2>
        {logsQuery.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
          </div>
        ) : logs.length > 0 ? (
          <LogList logs={logs} />
        ) : logsQuery.isError ? (
          <Card>
            <EmptyState
              illustration={<AppleIllustration size={72} />}
              title={online ? "Couldn't load today's logs" : 'Not synced yet'}
              body={
                online
                  ? errorMessage(logsQuery.error)
                  : "Today's logs will appear once you're back online."
              }
            />
          </Card>
        ) : (
          <Card>
            <EmptyState
              illustration={<AppleIllustration size={72} />}
              title="Nothing yet today"
              body="Your first log of the day will appear right here."
            />
          </Card>
        )}
      </section>

      <FoodDetailSheet
        food={selected}
        busy={logFood.isPending}
        serverError={logFood.isError ? errorMessage(logFood.error) : null}
        onClose={() => setSelected(null)}
        onLog={(input) => logFood.mutate(input)}
      />

      <Dialog open={creatingCustom} onOpenChange={(open) => !open && setCreatingCustom(false)}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Create custom food</DialogTitle>
          </DialogHeader>
          {/* Nutrients entered here are per the serving named below. */}
          <FoodLogForm
            initialValues={{ food_name: query.trim() }}
            submitLabel="Create & log"
            busy={createCustom.isPending}
            serverError={createCustom.isError ? errorMessage(createCustom.error) : null}
            onCancel={() => setCreatingCustom(false)}
            onSubmit={(input) => createCustom.mutate(input)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
