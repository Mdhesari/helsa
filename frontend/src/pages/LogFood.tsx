import { useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
import { invalidateFoodData, invalidateFoodRefData, qk } from '../lib/queries'
import { todayStr } from '../lib/date'
import { useDebouncedValue } from '../lib/useDebouncedValue'
import { FoodLogForm } from '../components/FoodLogForm'
import { LogList } from '../components/LogList'
import { EmptyState } from '../components/EmptyState'
import { useToast } from '../components/Toast'
import { FoodSearchInput } from '../components/foods/FoodSearchInput'
import { FoodSuggestions } from '../components/foods/FoodSuggestions'
import { FoodResultList } from '../components/foods/FoodResultList'
import { FoodDetailSheet } from '../components/foods/FoodDetailSheet'

const CHEERS = [
  'Logged! Nice one.',
  'Yum — added to your day.',
  'Great, that counts!',
  'Logged. Keep it up!',
]

export function LogFood() {
  const qc = useQueryClient()
  const toast = useToast()
  const today = todayStr()

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

  function celebrate() {
    invalidateFoodData(qc)
    toast.show(CHEERS[Math.floor(Math.random() * CHEERS.length)], { pose: 'cheer' })
  }

  const logFood = useMutation({
    mutationFn: (input: FoodLogInput) => api.createLog(input),
    onSuccess: () => {
      setSelected(null)
      celebrate()
    },
  })

  // "Create custom food": create the reference food, then log it once (qty 1).
  const createCustom = useMutation({
    mutationFn: async (input: FoodLogInput) => {
      const food = await api.createFood({
        name: input.food_name,
        serving_label: input.serving || undefined,
        calories: input.calories,
        protein_g: input.protein_g,
        carbs_g: input.carbs_g,
        fat_g: input.fat_g,
      })
      return api.createLog({
        ...input,
        serving: input.serving || food.servings[0]?.label || '1 serving',
        food_ref_id: food.id,
      })
    },
    onSuccess: () => {
      setCreatingCustom(false)
      setQuery('')
      invalidateFoodRefData(qc)
      celebrate()
    },
  })

  const results = searchQuery.data?.foods ?? []
  const logs = logsQuery.data?.logs ?? []

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
            <p className="px-1 text-sm font-medium text-destructive">
              {errorMessage(searchQuery.error)}
            </p>
          ) : results.length > 0 ? (
            <FoodResultList foods={results} onSelect={setSelected} />
          ) : (
            <Card>
              <EmptyState
                pose="sleep"
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
        ) : logsQuery.isError ? (
          <p className="px-1 text-sm font-medium text-destructive">
            {errorMessage(logsQuery.error)}
          </p>
        ) : logs.length > 0 ? (
          <LogList logs={logs} />
        ) : (
          <Card>
            <EmptyState
              pose="sleep"
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
