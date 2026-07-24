import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, Flame, LogOut, Pencil, Plus, Target } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import * as api from '../api/client'
import { errorMessage } from '../api/client'
import type { Profile as ProfileT, UpdateProfileRequest } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { invalidateHabitData, invalidateProfileData, qk } from '../lib/queries'
import { formatLongDate } from '../lib/date'
import {
  BirthDatePicker,
  DietPicker,
  GOAL_LABELS,
  GoalPicker,
  HeightPicker,
  PacePicker,
  SexPicker,
  UnitToggle,
  WeightField,
  WorkoutsPicker,
} from '../components/plan/pickers'
import { RECOMMENDED_PACE } from '../lib/plan'
import type { UnitSystem } from '../components/onboarding/wizardState'
import { AddHabitDialog, HABIT_ICONS } from '../components/habits/AddHabitDialog'
import { useToast } from '../components/Toast'

/** Editable copy of the profile inside the edit-plan sheet. */
interface PlanDraft {
  sex: ProfileT['sex']
  activity_level: ProfileT['activity_level']
  birth_date: ProfileT['birth_date']
  height_cm: ProfileT['height_cm']
  weight_kg: ProfileT['weight_kg']
  goal: ProfileT['goal']
  target_weight_kg: ProfileT['target_weight_kg']
  pace_kg_per_week: number
  diet: ProfileT['diet']
}

function draftFromProfile(p: ProfileT): PlanDraft {
  return {
    sex: p.sex,
    activity_level: p.activity_level,
    birth_date: p.birth_date,
    height_cm: p.height_cm,
    weight_kg: p.weight_kg,
    goal: p.goal,
    target_weight_kg: p.target_weight_kg,
    pace_kg_per_week: p.pace_kg_per_week ?? RECOMMENDED_PACE,
    diet: p.diet,
  }
}

function EditPlanSheet({
  open,
  profile,
  onClose,
}: {
  open: boolean
  profile: ProfileT
  onClose: () => void
}) {
  const qc = useQueryClient()
  const toast = useToast()
  const [unit, setUnit] = useState<UnitSystem>('metric')
  const [draft, setDraft] = useState<PlanDraft>(() => draftFromProfile(profile))
  // Re-seed whenever the sheet re-opens.
  const [seenOpen, setSeenOpen] = useState(open)
  if (open !== seenOpen) {
    setSeenOpen(open)
    if (open) setDraft(draftFromProfile(profile))
  }

  const save = useMutation({
    mutationFn: (req: UpdateProfileRequest) => api.updateProfile(req),
    onSuccess: () => {
      invalidateProfileData(qc)
      toast.show('Plan updated')
      onClose()
    },
    onError: (e) => toast.show(errorMessage(e), { tone: 'error' }),
  })

  function patch(p: Partial<PlanDraft>) {
    setDraft((d) => ({ ...d, ...p }))
  }

  function submit() {
    const maintain = draft.goal === 'maintain'
    save.mutate({
      sex: draft.sex,
      activity_level: draft.activity_level,
      birth_date: draft.birth_date,
      height_cm: draft.height_cm,
      weight_kg: draft.weight_kg,
      goal: draft.goal,
      target_weight_kg: maintain ? null : draft.target_weight_kg,
      pace_kg_per_week: maintain ? null : draft.pace_kg_per_week,
      diet: draft.diet,
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="max-h-[92dvh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>Edit your plan</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <UnitToggle unit={unit} onChange={setUnit} />

          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">About you</h3>
            <SexPicker value={draft.sex} onChange={(sex) => patch({ sex })} />
          </section>

          <BirthDatePicker
            value={draft.birth_date}
            onChange={(birth_date) => patch({ birth_date })}
          />

          <HeightPicker
            heightCm={draft.height_cm}
            unit={unit}
            onChange={(height_cm) => patch({ height_cm })}
          />

          <WeightField
            id="profile_weight"
            label="Current weight"
            weightKg={draft.weight_kg}
            unit={unit}
            onChange={(weight_kg) => patch({ weight_kg })}
          />

          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">
              Workouts per week
            </h3>
            <WorkoutsPicker
              value={draft.activity_level}
              onChange={(activity_level) => patch({ activity_level })}
            />
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">Goal</h3>
            <GoalPicker value={draft.goal} onChange={(goal) => patch({ goal })} />
          </section>

          {draft.goal !== null && draft.goal !== 'maintain' && (
            <>
              <WeightField
                id="profile_target_weight"
                label={draft.goal === 'gain' ? 'Goal weight' : 'Desired weight'}
                weightKg={draft.target_weight_kg}
                unit={unit}
                onChange={(target_weight_kg) => patch({ target_weight_kg })}
              />
              <PacePicker
                value={draft.pace_kg_per_week}
                unit={unit}
                onChange={(pace_kg_per_week) => patch({ pace_kg_per_week })}
              />
            </>
          )}

          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">Diet</h3>
            <DietPicker value={draft.diet} onChange={(diet) => patch({ diet })} />
          </section>

          <Button size="xl" className="w-full" disabled={save.isPending} onClick={submit}>
            {save.isPending ? 'Saving…' : 'Save plan'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function PasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { applyToken } = useAuth()
  const toast = useToast()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [error, setError] = useState<string | null>(null)

  const change = useMutation({
    mutationFn: () =>
      api.changePassword({ current_password: current, new_password: next }),
    onSuccess: (res) => {
      applyToken(res.token)
      toast.show('Password changed')
      handleClose()
    },
    onError: (e) => setError(errorMessage(e)),
  })

  function handleClose() {
    setCurrent('')
    setNext('')
    setError(null)
    onClose()
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (next.length < 8) return setError('New password must be at least 8 characters.')
    change.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="pw_current">Current password</Label>
            <Input
              id="pw_current"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw_next">New password</Label>
            <Input
              id="pw_next"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </div>
          {error && (
            <p className="text-sm font-medium text-destructive" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" size="xl" className="w-full" disabled={change.isPending}>
            {change.isPending ? 'Saving…' : 'Update password'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Profile: plan summary + editing, habits, account, logout. */
export function Profile() {
  const { user, setUser, logout } = useAuth()
  const qc = useQueryClient()
  const toast = useToast()

  const [editingPlan, setEditingPlan] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [addingHabit, setAddingHabit] = useState(false)
  const [fullName, setFullName] = useState(user?.full_name ?? '')
  const [timezone, setTimezone] = useState(user?.timezone ?? 'UTC')

  const profileQuery = useQuery({ queryKey: qk.profile, queryFn: api.getProfile })
  const planQuery = useQuery({ queryKey: qk.plan, queryFn: api.getPlan })
  const habitsQuery = useQuery({ queryKey: qk.habits, queryFn: () => api.getHabits() })

  const saveAccount = useMutation({
    mutationFn: () =>
      api.updateMe({ full_name: fullName.trim(), timezone: timezone.trim() }),
    onSuccess: (u) => {
      setUser(u)
      invalidateProfileData(qc)
      toast.show('Account updated')
    },
    onError: (e) => toast.show(errorMessage(e), { tone: 'error' }),
  })

  const archive = useMutation({
    mutationFn: (id: number) => api.archiveHabit(id),
    onSuccess: () => {
      invalidateHabitData(qc)
      toast.show('Habit archived')
    },
    onError: (e) => toast.show(errorMessage(e), { tone: 'error' }),
  })

  const plan = planQuery.data
  const habits = habitsQuery.data?.habits ?? []

  const accountDirty =
    fullName.trim() !== (user?.full_name ?? '') ||
    timezone.trim() !== (user?.timezone ?? '')

  return (
    <div className="space-y-5 p-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="px-1">
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{user?.email}</p>
      </header>

      {/* Plan */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Target aria-hidden="true" className="size-4" strokeWidth={1.8} />
            Your plan
          </CardTitle>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setEditingPlan(true)}
            disabled={!profileQuery.isSuccess}
          >
            <Pencil strokeWidth={1.8} />
            Edit
          </Button>
        </CardHeader>
        <CardContent>
          {planQuery.isPending ? (
            <Skeleton className="h-24 w-full rounded-2xl" />
          ) : plan?.complete && plan.targets ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-11 items-center justify-center rounded-2xl bg-secondary"
                >
                  <Flame className="size-5" strokeWidth={1.6} />
                </span>
                <div>
                  <p className="text-2xl font-bold tabular-nums leading-none tracking-tight">
                    {plan.targets.calories}
                    <span className="ml-1 text-sm font-semibold text-muted-foreground">
                      kcal/day
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    P {plan.targets.protein_g}g · C {plan.targets.carbs_g}g · F{' '}
                    {plan.targets.fat_g}g
                  </p>
                </div>
              </div>
              <Separator />
              <p className="text-sm text-muted-foreground">
                {plan.goal ? GOAL_LABELS[plan.goal] : 'No goal set'}
                {plan.target_weight_kg !== null && ` → ${plan.target_weight_kg} kg`}
                {plan.projected_end_date &&
                  ` by ${formatLongDate(plan.projected_end_date)}`}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Your plan is incomplete — fill in the missing details to unlock daily
              targets.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Habits */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Habits</CardTitle>
          <Button size="sm" variant="secondary" onClick={() => setAddingHabit(true)}>
            <Plus strokeWidth={2} />
            Add
          </Button>
        </CardHeader>
        <CardContent>
          {habitsQuery.isPending ? (
            <Skeleton className="h-16 w-full rounded-2xl" />
          ) : habits.length > 0 ? (
            <ul className="space-y-2">
              {habits.map((h) => {
                const Icon = HABIT_ICONS[h.kind]
                return (
                  <li
                    key={h.id}
                    className="flex items-center gap-3 rounded-2xl border bg-card px-3.5 py-2.5"
                  >
                    <Icon
                      aria-hidden="true"
                      className="size-4.5 shrink-0"
                      strokeWidth={1.6}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{h.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {h.daily_target !== null
                          ? `${h.direction === 'reduce' ? 'Stay under' : 'Reach'} ${h.daily_target} ${h.unit}/day`
                          : `Counting ${h.unit}`}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Archive ${h.name}`}
                      className="text-muted-foreground"
                      disabled={archive.isPending}
                      onClick={() => archive.mutate(h.id)}
                    >
                      <Archive strokeWidth={1.8} />
                    </Button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nothing tracked yet — add cigarettes, water, coffee or anything countable.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Account */}
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="account_name">Full name</Label>
            <Input
              id="account_name"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="account_tz">Timezone</Label>
            <Input
              id="account_tz"
              placeholder="e.g. Asia/Tehran"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Days start and end in this timezone — it shapes streaks and reports.
            </p>
          </div>
          {accountDirty && (
            <Button
              className="w-full"
              disabled={saveAccount.isPending || fullName.trim() === ''}
              onClick={() => saveAccount.mutate()}
            >
              {saveAccount.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          )}
          <Separator />
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setChangingPassword(true)}
          >
            Change password
          </Button>
        </CardContent>
      </Card>

      <Button
        variant="ghost"
        className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={logout}
      >
        <LogOut strokeWidth={1.8} />
        Log out
      </Button>

      {profileQuery.data && (
        <EditPlanSheet
          open={editingPlan}
          profile={profileQuery.data}
          onClose={() => setEditingPlan(false)}
        />
      )}
      <PasswordDialog
        open={changingPassword}
        onClose={() => setChangingPassword(false)}
      />
      <AddHabitDialog
        open={addingHabit}
        onClose={() => setAddingHabit(false)}
        existingKinds={habits.map((h) => h.kind)}
      />
    </div>
  )
}
