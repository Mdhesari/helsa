import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

/** Wrap authed routes: bounce to /login when there is no token. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthed } = useAuth()
  const location = useLocation()
  if (!isAuthed) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <>{children}</>
}

/** Wrap login/register: already-authed users go straight to the app. */
export function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { isAuthed } = useAuth()
  if (isAuthed) {
    return <Navigate to="/app" replace />
  }
  return <>{children}</>
}
