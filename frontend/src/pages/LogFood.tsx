import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../api/client'
import { errorMessage } from '../api/client'
import type { FoodLogInput } from '../api/types'
import { invalidateFoodData, qk } from '../lib/queries'
import { todayStr } from '../lib/date'
import { FoodLogForm } from '../components/FoodLogForm'
import { LogList } from '../components/LogList'
import { EmptyState } from '../components/EmptyState'
import { useToast } from '../components/Toast'

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
  // Remount the form after each save to clear it for the next entry.
  const [formKey, setFormKey] = useState(0)

  const logsQuery = useQuery({
    queryKey: qk.logs(today),
    queryFn: () => api.getLogs({ date: today }),
  })

  const create = useMutation({
    mutationFn: (input: FoodLogInput) => api.createLog(input),
    onSuccess: () => {
      invalidateFoodData(qc)
      setFormKey((k) => k + 1)
      toast.show(CHEERS[Math.floor(Math.random() * CHEERS.length)], { pose: 'cheer' })
    },
  })

  const logs = logsQuery.data?.logs ?? []

  return (
    <div className="space-y-4 p-4">
      <header className="px-1">
        <h1 className="text-xl font-extrabold text-sand-900">Log food</h1>
        <p className="text-sm font-semibold text-sand-400">
          What did you eat? Every entry keeps your streak alive.
        </p>
      </header>

      <section className="card">
        {/*
          FoodLogForm is reusable: a future food-reference picker can pre-fill
          it via `initialValues` (nutrient snapshot is denormalized per the
          API contract, so the POST shape stays the same).
        */}
        <FoodLogForm
          key={formKey}
          submitLabel="Log it"
          busy={create.isPending}
          serverError={create.isError ? errorMessage(create.error) : null}
          onSubmit={(input) => create.mutate(input)}
        />
      </section>

      <section className="space-y-2">
        <h2 className="px-1 font-extrabold text-sand-800">Today's logs</h2>
        {logsQuery.isPending ? (
          <div className="space-y-2">
            <div className="skeleton h-16 w-full" />
            <div className="skeleton h-16 w-full" />
          </div>
        ) : logsQuery.isError ? (
          <p className="field-error px-1">{errorMessage(logsQuery.error)}</p>
        ) : logs.length > 0 ? (
          <LogList logs={logs} />
        ) : (
          <div className="card">
            <EmptyState
              pose="sleep"
              title="Nothing yet today"
              body="Your first log of the day will appear right here."
            />
          </div>
        )}
      </section>
    </div>
  )
}
