import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
    <section className="card space-y-4">
      <h2 className="font-extrabold text-sand-800">Account</h2>
      <div>
        <label className="label" htmlFor="acc_name">
          Full name
        </label>
        <input
          id="acc_name"
          className="input"
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
      </div>
      <div>
        <label className="label" htmlFor="acc_tz">
          Timezone
        </label>
        <select
          id="acc_tz"
          className="input"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
        >
          {zones.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs font-medium text-sand-400">
          Your days, streaks and reports follow this timezone.
        </p>
      </div>
      {save.isError && (
        <p className="field-error" role="alert">
          {errorMessage(save.error)}
        </p>
      )}
      <button
        type="button"
        className="btn-primary w-full"
        disabled={save.isPending || !fullName.trim()}
        onClick={() => save.mutate()}
      >
        {save.isPending ? 'Saving…' : 'Save account'}
      </button>
    </section>
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
      <p className="text-sm font-medium text-sand-500">
        All optional — fill in all five and Helsa computes personal calorie and macro
        targets for you.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="bio_age">
            Age
          </label>
          <input
            id="bio_age"
            className="input"
            type="text"
            inputMode="numeric"
            placeholder="—"
            value={age}
            onChange={(e) => setAge(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="bio_sex">
            Sex
          </label>
          <select
            id="bio_sex"
            className="input"
            value={sex}
            onChange={(e) => setSex(e.target.value as '' | Sex)}
          >
            <option value="">—</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="bio_weight">
            Weight (kg)
          </label>
          <input
            id="bio_weight"
            className="input"
            type="text"
            inputMode="decimal"
            placeholder="—"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="bio_height">
            Height (cm)
          </label>
          <input
            id="bio_height"
            className="input"
            type="text"
            inputMode="decimal"
            placeholder="—"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
          />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="bio_activity">
          Activity level
        </label>
        <select
          id="bio_activity"
          className="input"
          value={activity}
          onChange={(e) => setActivity(e.target.value as '' | ActivityLevel)}
        >
          <option value="">—</option>
          {ACTIVITY_LEVELS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
      </div>
      {(validationError || save.isError) && (
        <p className="field-error" role="alert">
          {validationError ?? errorMessage(save.error)}
        </p>
      )}
      <button type="submit" className="btn-primary w-full" disabled={save.isPending}>
        {save.isPending ? 'Saving…' : 'Save biometrics'}
      </button>
    </form>
  )
}

function BiometricsCard() {
  const query = useQuery({ queryKey: qk.profile, queryFn: api.getProfile })
  return (
    <section className="card space-y-4">
      <h2 className="font-extrabold text-sand-800">Biometrics</h2>
      {query.isPending ? (
        <div className="space-y-3">
          <div className="skeleton h-11 w-full" />
          <div className="skeleton h-11 w-full" />
          <div className="skeleton h-11 w-full" />
        </div>
      ) : query.isError ? (
        <p className="field-error">{errorMessage(query.error)}</p>
      ) : (
        <BiometricsForm profile={query.data} />
      )}
    </section>
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
    <section className="card space-y-4">
      <h2 className="font-extrabold text-sand-800">Change password</h2>
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <div>
          <label className="label" htmlFor="pw_current">
            Current password
          </label>
          <input
            id="pw_current"
            className="input"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="pw_new">
            New password
          </label>
          <input
            id="pw_new"
            className="input"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="pw_confirm">
            Confirm new password
          </label>
          <input
            id="pw_confirm"
            className="input"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          className="btn-primary w-full"
          disabled={change.isPending || !current || !next}
        >
          {change.isPending ? 'Changing…' : 'Change password'}
        </button>
      </form>
    </section>
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
    <section className="card space-y-3">
      <h2 className="font-extrabold text-sand-800">Your data</h2>
      <button
        type="button"
        className="btn-neutral w-full"
        disabled={exporting}
        onClick={() => void handleExport()}
      >
        {exporting ? 'Preparing…' : 'Export my data (.xlsx)'}
      </button>
      <button type="button" className="btn-danger-ghost w-full" onClick={logout}>
        Log out
      </button>
    </section>
  )
}

export function Profile() {
  return (
    <div className="space-y-4 p-4">
      <header className="px-1">
        <h1 className="text-xl font-extrabold text-sand-900">Profile</h1>
      </header>
      <AccountCard />
      <BiometricsCard />
      <PasswordCard />
      <DataCard />
    </div>
  )
}
