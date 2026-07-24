import { useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '../../auth/AuthContext'
import { errorMessage, isApiError } from '../../api/client'

interface RegisterFormProps {
  /** Runs while still on this screen, right after the account is created. */
  onRegistered: () => Promise<void> | void
  ctaLabel?: string
}

/** Shared register form (standalone /register page + wizard final step). */
export function RegisterForm({ onRegistered, ctaLabel = 'Create account' }: RegisterFormProps) {
  const { register } = useAuth()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!fullName.trim()) return setError('Please tell us your name.')
    if (!email.trim()) return setError('Please enter your email.')
    if (password.length < 8) return setError('Password must be at least 8 characters.')

    setBusy(true)
    try {
      await register({
        full_name: fullName.trim(),
        email: email.trim(),
        password,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })
      await onRegistered()
    } catch (err) {
      if (isApiError(err) && err.code === 'email_taken') {
        setError('That email is already registered — try signing in instead.')
      } else {
        setError(errorMessage(err))
      }
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="reg_full_name">Full name</Label>
        <Input
          id="reg_full_name"
          autoComplete="name"
          placeholder="e.g. Sara K"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="reg_email">Email</Label>
        <Input
          id="reg_email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="reg_password">Password</Label>
        <Input
          id="reg_password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {error && (
        <p className="text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" size="xl" className="w-full" disabled={busy}>
        {busy ? 'Saving…' : ctaLabel}
      </Button>
    </form>
  )
}
