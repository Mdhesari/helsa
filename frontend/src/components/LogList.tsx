import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '../api/client'
import { errorMessage } from '../api/client'
import type { FoodLog, FoodLogInput } from '../api/types'
import { invalidateFoodData } from '../lib/queries'
import { formatTime } from '../lib/date'
import { FoodLogForm } from './FoodLogForm'
import { useToast } from './Toast'

/** A day's food logs with edit (bottom sheet) and delete. */
export function LogList({ logs }: { logs: FoodLog[] }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [editing, setEditing] = useState<FoodLog | null>(null)

  const update = useMutation({
    mutationFn: ({ id, input }: { id: number; input: FoodLogInput }) =>
      api.updateLog(id, input),
    onSuccess: () => {
      invalidateFoodData(qc)
      setEditing(null)
      toast.show('Updated!', { pose: 'happy' })
    },
  })

  const remove = useMutation({
    mutationFn: (id: number) => api.deleteLog(id),
    onSuccess: () => {
      invalidateFoodData(qc)
      toast.show('Log removed')
    },
    onError: (e) => toast.show(errorMessage(e), { tone: 'error' }),
  })

  function handleDelete(log: FoodLog) {
    if (window.confirm(`Delete "${log.food_name}"?`)) {
      remove.mutate(log.id)
    }
  }

  return (
    <>
      <ul className="space-y-2">
        {logs.map((log) => (
          <li key={log.id} className="card flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold text-sand-800">{log.food_name}</p>
              <p className="truncate text-xs font-semibold text-sand-400">
                {formatTime(log.logged_at)}
                {log.serving && ` · ${log.serving}`}
                {` · P ${Math.round(log.protein_g)} · C ${Math.round(log.carbs_g)} · F ${Math.round(log.fat_g)}`}
              </p>
            </div>
            <span className="font-extrabold text-sand-700 tabular-nums">
              {Math.round(log.calories)}
              <span className="ml-0.5 text-[10px] font-bold text-sand-400">kcal</span>
            </span>
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                aria-label={`Edit ${log.food_name}`}
                className="rounded-lg p-2 text-sand-400 hover:bg-sand-100 hover:text-sand-600"
                onClick={() => setEditing(log)}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 20h4L20 8l-4-4L4 16v4z" />
                </svg>
              </button>
              <button
                type="button"
                aria-label={`Delete ${log.food_name}`}
                className="rounded-lg p-2 text-sand-400 hover:bg-red-50 hover:text-danger"
                onClick={() => handleDelete(log)}
                disabled={remove.isPending}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
                </svg>
              </button>
            </div>
          </li>
        ))}
      </ul>

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-sand-900/40 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Edit food log"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditing(null)
          }}
        >
          <div className="animate-pop-in w-full max-w-md rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl">
            <h2 className="mb-4 text-lg font-extrabold text-sand-800">Edit log</h2>
            <FoodLogForm
              key={editing.id}
              initialValues={editing}
              submitLabel="Save changes"
              busy={update.isPending}
              serverError={update.isError ? errorMessage(update.error) : null}
              onCancel={() => setEditing(null)}
              onSubmit={(input) => update.mutate({ id: editing.id, input })}
            />
          </div>
        </div>
      )}
    </>
  )
}
