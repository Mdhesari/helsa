import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '../auth/AuthContext'
import { errorMessage, isApiError } from '../api/client'

export function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
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
      navigate('/app', { replace: true })
    } catch (err) {
      if (isApiError(err) && err.code === 'email_taken') {
        setError('That email is already registered — try logging in instead.')
      } else {
        setError(errorMessage(err))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 bg-background px-6 py-10 sm:border-x">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">Create your account</h1>
        <p className="text-muted-foreground">
          A calm, simple food diary. Free to start.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="full_name">Full name</Label>
          <Input
            id="full_name"
            autoComplete="name"
            placeholder="e.g. Sara K"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
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
          {busy ? 'Creating…' : 'Sign up'}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-foreground underline underline-offset-4">
          Log in
        </Link>
      </p>
    </div>
  )
}
