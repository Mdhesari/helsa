import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2 } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
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
          <li
            key={log.id}
            className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 shadow-[0_1px_2px_rgb(0_0_0/0.03)]"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{log.food_name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {formatTime(log.logged_at)}
                {log.serving && ` · ${log.serving}`}
                {` · P ${Math.round(log.protein_g)} · C ${Math.round(log.carbs_g)} · F ${Math.round(log.fat_g)}`}
              </p>
            </div>
            <span className="font-semibold tabular-nums">
              {Math.round(log.calories)}
              <span className="ml-0.5 text-[10px] font-medium text-muted-foreground">
                kcal
              </span>
            </span>
            <div className="flex shrink-0 gap-0.5">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Edit ${log.food_name}`}
                className="text-muted-foreground"
                onClick={() => setEditing(log)}
              >
                <Pencil strokeWidth={1.8} />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Delete ${log.food_name}`}
                className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                onClick={() => handleDelete(log)}
                disabled={remove.isPending}
              >
                <Trash2 strokeWidth={1.8} />
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Edit log</DialogTitle>
          </DialogHeader>
          {editing && (
            <FoodLogForm
              key={editing.id}
              initialValues={editing}
              submitLabel="Save changes"
              busy={update.isPending}
              serverError={update.isError ? errorMessage(update.error) : null}
              onCancel={() => setEditing(null)}
              onSubmit={(input) => update.mutate({ id: editing.id, input })}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
