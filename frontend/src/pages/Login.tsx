import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '../auth/AuthContext'
import { errorMessage, isApiError } from '../api/client'

export function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email.trim() || !password) {
      return setError('Please enter your email and password.')
    }

    setBusy(true)
    try {
      await login(email.trim(), password)
      navigate('/app', { replace: true })
    } catch (err) {
      if (isApiError(err) && err.code === 'invalid_credentials') {
        setError("That email and password don't match. Give it another try.")
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
        <h1 className="text-4xl font-bold tracking-tight">Welcome back</h1>
        <p className="text-muted-foreground">
          Log in to keep your streak going.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
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
            autoComplete="current-password"
            placeholder="Your password"
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
          {busy ? 'Logging in…' : 'Log in'}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        New to Helsa?{' '}
        <Link to="/register" className="font-semibold text-foreground underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </div>
  )
}
