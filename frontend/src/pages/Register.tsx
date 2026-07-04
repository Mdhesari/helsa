import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { errorMessage, isApiError } from '../api/client'
import { Mascot } from '../components/Mascot'

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
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 bg-sand-50 p-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <Mascot pose="happy" size={100} className="animate-pop-in" />
        <h1 className="text-2xl font-extrabold text-sand-900">Create your account</h1>
        <p className="text-sm font-medium text-sand-500">
          Helsa keeps your food diary cozy and simple.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label className="label" htmlFor="full_name">
            Full name
          </label>
          <input
            id="full_name"
            className="input"
            autoComplete="name"
            placeholder="e.g. Sara K"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>
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
            autoComplete="new-password"
            placeholder="At least 8 characters"
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
          {busy ? 'Creating…' : 'Sign up'}
        </button>
      </form>

      <p className="text-center text-sm font-semibold text-sand-500">
        Already have an account?{' '}
        <Link to="/login" className="font-extrabold text-primary-600">
          Log in
        </Link>
      </p>
    </div>
  )
}
