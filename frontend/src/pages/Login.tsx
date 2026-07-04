import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { errorMessage, isApiError } from '../api/client'
import { Mascot } from '../components/Mascot'

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
        setError("That email and password don't match. Give it another try!")
      } else {
        setError(errorMessage(err))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 bg-sand-50 p-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <Mascot pose="happy" size={100} className="animate-pop-in" />
        <h1 className="text-2xl font-extrabold text-sand-900">Welcome back!</h1>
        <p className="text-sm font-medium text-sand-500">
          Your streak missed you. Log in to keep it going.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            className="input"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            className="input"
            type="password"
            autoComplete="current-password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? 'Logging in…' : 'Log in'}
        </button>
      </form>

      <p className="text-center text-sm font-semibold text-sand-500">
        New to Helsa?{' '}
        <Link to="/register" className="font-extrabold text-primary-600">
          Create an account
        </Link>
      </p>
    </div>
  )
}
