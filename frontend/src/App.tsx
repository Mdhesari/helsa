import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import { RedirectIfAuthed, RequireAuth } from './auth/guards'
import { AppShell } from './layouts/AppShell'
import { Welcome } from './pages/Welcome'
import { Onboarding } from './pages/Onboarding'
import { Register } from './pages/Register'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { LogFood } from './pages/LogFood'
import { Diary } from './pages/Diary'
import { Profile } from './pages/Profile'
import { ReportsSkeleton } from './components/Skeletons'

// Code-split the charts bundle (recharts) out of the initial load.
const Progress = lazy(() =>
  import('./pages/Reports').then((m) => ({ default: m.Reports })),
)

/**
 * "/" → the app when signed in, otherwise the welcome screen.
 *
 * Welcome is the fork offering both "Get started" and "Sign in", so a signed-out
 * visitor always gets the choice. Sending returning users straight to /login
 * would strand them: nothing clears the onboarded flag on logout, so the intro
 * would be unreachable for the life of the browser profile.
 */
function RootRedirect() {
  const { isAuthed } = useAuth()
  return <Navigate to={isAuthed ? '/app' : '/welcome'} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/welcome" element={<Welcome />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route
        path="/register"
        element={
          <RedirectIfAuthed>
            <Register />
          </RedirectIfAuthed>
        }
      />
      <Route
        path="/login"
        element={
          <RedirectIfAuthed>
            <Login />
          </RedirectIfAuthed>
        }
      />
      <Route
        path="/app"
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="log" element={<LogFood />} />
        <Route
          path="progress"
          element={
            <Suspense
              fallback={
                <div className="p-4">
                  <ReportsSkeleton />
                </div>
              }
            >
              <Progress />
            </Suspense>
          }
        />
        <Route path="diary" element={<Diary />} />
        <Route path="profile" element={<Profile />} />
        {/* Old bookmark compatibility. */}
        <Route path="reports" element={<Navigate to="/app/progress" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
