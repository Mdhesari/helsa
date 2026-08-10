import { Link, useNavigate } from 'react-router-dom'

import { RegisterForm } from '../components/auth/RegisterForm'
import * as api from '../api/client'
import {
  ONBOARDED_KEY,
  clearWizardState,
  loadWizardState,
  wizardProfilePayload,
} from '../components/onboarding/wizardState'

/**
 * "Save your progress" — creates the account, then pushes any onboarding
 * wizard answers to PUT /me/profile so the plan is live on first load.
 */
export function Register() {
  const navigate = useNavigate()

  async function handleRegistered() {
    const wizard = loadWizardState()
    // Only push a profile when the wizard was actually filled in; a direct
    // /register visit has nothing to save (all-null payload would be a no-op
    // anyway, but skip the request entirely).
    if (wizard.sex || wizard.birth_date || wizard.goal) {
      try {
        await api.updateProfile(wizardProfilePayload(wizard))
      } catch {
        // The account exists; profile can be completed later from Profile.
      }
    }
    clearWizardState()
    localStorage.setItem(ONBOARDED_KEY, '1')
    navigate('/app', { replace: true })
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 bg-background px-6 py-10 sm:border-x">
      <div className="space-y-2">
        <h1 className="text-screen-title">Save your progress</h1>
        <p className="text-[17px] text-muted-foreground">
          Create a free account to keep your plan and start tracking.
        </p>
      </div>

      <RegisterForm onRegistered={handleRegistered} ctaLabel="Create account" />

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link
          to="/login"
          className="font-semibold text-foreground underline underline-offset-4"
        >
          Sign in
        </Link>
      </p>
    </div>
  )
}
