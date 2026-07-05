import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, LogOut } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import * as api from '../api/client'
import { errorMessage, isApiError } from '../api/client'
import type { ActivityLevel, Profile as ProfileShape, Sex } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { invalidateProfileData, qk } from '../lib/queries'
import { useToast } from '../components/Toast'

const ACTIVITY_LEVELS: { value: ActivityLevel; label: string }[] = [
  { value: 'sedentary', label: 'Sedentary (little exercise)' },
  { value: 'light', label: 'Light (1-3 days/week)' },
  { value: 'moderate', label: 'Moderate (3-5 days/week)' },
  { value: 'active', label: 'Active (6-7 days/week)' },
  { value: 'very_active', label: 'Very active (physical job)' },
]

function timezoneOptions(current: string): string[] {
  const zones =
    typeof Intl.supportedValuesOf === 'function'
      ? Intl.supportedValuesOf('timeZone')
      : ['UTC']
  return zones.includes(current) ? zones : [current, ...zones]
}

// ---------- Account ----------

function AccountCard() {
  const { user, setUser } = useAuth()
  const toast = useToast()
  const [fullName, setFullName] = useState(user?.full_name ?? '')
  const [timezone, setTimezone] = useState(user?.timezone ?? 'UTC')
  const zones = useMemo(() => timezoneOptions(timezone), []) // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation({
    mutationFn: () => api.updateMe({ full_name: fullName.trim(), timezone }),
    onSuccess: (next) => {
      setUser(next)
      toast.show('Account updated!', { pose: 'happy' })
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="acc_name">Full name</Label>
          <Input
            id="acc_name"
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="acc_tz">Timezone</Label>
          <NativeSelect
            id="acc_tz"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
          >
            {zones.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </NativeSelect>
          <p className="text-xs text-muted-foreground">
            Your days, streaks and reports follow this timezone.
          </p>
        </div>
        {save.isError && (
          <p className="text-sm font-medium text-destructive" role="alert">
            {errorMessage(save.error)}
          </p>
        )}
        <Button
          size="lg"
          className="w-full"
          disabled={save.isPending || !fullName.trim()}
          onClick={() => save.mutate()}
        >
          {save.isPending ? 'Saving…' : 'Save account'}
        </Button>
      </CardContent>
    </Card>
  )
}

// ---------- Biometrics ----------

function BiometricsForm({ profile }: { profile: ProfileShape }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [age, setAge] = useState(profile.age === null ? '' : String(profile.age))
  const [sex, setSex] = useState<'' | Sex>(profile.sex ?? '')
  const [weight, setWeight] = useState(
    profile.weight_kg === null ? '' : String(profile.weight_kg),
  )
  const [height, setHeight] = useState(
    profile.height_cm === null ? '' : String(profile.height_cm),
  )
  const [activity, setActivity] = useState<'' | ActivityLevel>(
    profile.activity_level ?? '',
  )
  const [validationError, setValidationError] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: api.updateProfile,
    onSuccess: () => {
      invalidateProfileData(qc)
      toast.show('Profile saved — targets updated!', { pose: 'cheer' })
    },
  })

  function numOrNull(s: string, int = false): number | null | undefined {
    if (s.trim() === '') return null
    const n = Number(s)
    if (!Number.isFinite(n)) return undefined // invalid
    return int ? Math.round(n) : n
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setValidationError(null)
    const ageN = numOrNull(age, true)
    const weightN = numOrNull(weight)
    const heightN = numOrNull(height)
    if (ageN === undefined || weightN === undefined || heightN === undefined) {
      setValidationError('Age, weight and height must be numbers (or left empty).')
      return
    }
    // Any subset allowed; explicit null clears a field (per contract).
    save.mutate({
      age: ageN,
      sex: sex === '' ? null : sex,
      weight_kg: weightN,
      height_cm: heightN,
      activity_level: activity === '' ? null : activity,
    })
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit} noValidate>
      <p className="text-sm text-muted-foreground">
        All optional — fill in all five and Helsa computes personal calorie and macro
        targets for you.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="bio_age">Age</Label>
          <Input
            id="bio_age"
            type="text"
            inputMode="numeric"
            placeholder="—"
            value={age}
            onChange={(e) => setAge(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bio_sex">Sex</Label>
          <NativeSelect
            id="bio_sex"
            value={sex}
            onChange={(e) => setSex(e.target.value as '' | Sex)}
          >
            <option value="">—</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bio_weight">Weight (kg)</Label>
          <Input
            id="bio_weight"
            type="text"
            inputMode="decimal"
            placeholder="—"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bio_height">Height (cm)</Label>
          <Input
            id="bio_height"
            type="text"
            inputMode="decimal"
            placeholder="—"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="bio_activity">Activity level</Label>
        <NativeSelect
          id="bio_activity"
          value={activity}
          onChange={(e) => setActivity(e.target.value as '' | ActivityLevel)}
        >
          <option value="">—</option>
          {ACTIVITY_LEVELS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </NativeSelect>
      </div>
      {(validationError || save.isError) && (
        <p className="text-sm font-medium text-destructive" role="alert">
          {validationError ?? errorMessage(save.error)}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={save.isPending}>
        {save.isPending ? 'Saving…' : 'Save biometrics'}
      </Button>
    </form>
  )
}

function BiometricsCard() {
  const query = useQuery({ queryKey: qk.profile, queryFn: api.getProfile })
  return (
    <Card>
      <CardHeader>
        <CardTitle>Biometrics</CardTitle>
      </CardHeader>
      <CardContent>
        {query.isPending ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : query.isError ? (
          <p className="text-sm font-medium text-destructive">
            {errorMessage(query.error)}
          </p>
        ) : (
          <BiometricsForm profile={query.data} />
        )}
      </CardContent>
    </Card>
  )
}

// ---------- Password ----------

function PasswordCard() {
  const { applyToken } = useAuth()
  const toast = useToast()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)

  const change = useMutation({
    mutationFn: () => api.changePassword({ current_password: current, new_password: next }),
    onSuccess: (res) => {
      // Fresh token — old ones are revoked server-side (pwd_at mismatch).
      applyToken(res.token)
      setCurrent('')
      setNext('')
      setConfirm('')
      toast.show('Password changed!', { pose: 'happy' })
    },
    onError: (e) => {
      if (isApiError(e) && e.code === 'invalid_credentials') {
        setError("Your current password doesn't match.")
      } else {
        setError(errorMessage(e))
      }
    },
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (next.length < 8) return setError('New password must be at least 8 characters.')
    if (next !== confirm) return setError("New passwords don't match.")
    change.mutate()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change password</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
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
            <Label htmlFor="pw_new">New password</Label>
            <Input
              id="pw_new"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw_confirm">Confirm new password</Label>
            <Input
              id="pw_confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          {error && (
            <p className="text-sm font-medium text-destructive" role="alert">
              {error}
            </p>
          )}
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={change.isPending || !current || !next}
          >
            {change.isPending ? 'Changing…' : 'Change password'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

// ---------- Data & session ----------

function DataCard() {
  const toast = useToast()
  const { logout } = useAuth()
  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    setExporting(true)
    try {
      await api.exportXlsx()
      toast.show('Export downloaded!', { pose: 'cheer' })
    } catch (e) {
      toast.show(errorMessage(e), { tone: 'error' })
    } finally {
      setExporting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your data</CardTitle>
        <CardDescription>Everything you log belongs to you.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Button
          variant="outline"
          size="lg"
          className="w-full"
          disabled={exporting}
          onClick={() => void handleExport()}
        >
          <Download strokeWidth={1.8} />
          {exporting ? 'Preparing…' : 'Export my data (.xlsx)'}
        </Button>
        <Button
          variant="ghost"
          size="lg"
          className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={logout}
        >
          <LogOut strokeWidth={1.8} />
          Log out
        </Button>
      </CardContent>
    </Card>
  )
}

export function Profile() {
  return (
    <div className="space-y-4 p-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="px-1">
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
      </header>
      <AccountCard />
      <BiometricsCard />
      <PasswordCard />
      <DataCard />
    </div>
  )
}
