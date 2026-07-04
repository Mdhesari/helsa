import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import { RedirectIfAuthed, RequireAuth } from './auth/guards'
import { AppShell } from './layouts/AppShell'
import { Onboarding, ONBOARDED_KEY } from './pages/Onboarding'
import { Register } from './pages/Register'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { LogFood } from './pages/LogFood'
import { Profile } from './pages/Profile'
import { ReportsSkeleton } from './components/Skeletons'

// Code-split the charts bundle (recharts) out of the initial load.
const Reports = lazy(() =>
  import('./pages/Reports').then((m) => ({ default: m.Reports })),
)

/** "/" → onboarding (first visit), else /app or /login. */
function RootRedirect() {
  const { isAuthed } = useAuth()
  if (isAuthed) return <Navigate to="/app" replace />
  if (!localStorage.getItem(ONBOARDED_KEY)) return <Navigate to="/welcome" replace />
  return <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/welcome" element={<Onboarding />} />
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
          path="reports"
          element={
            <Suspense
              fallback={
                <div className="p-4">
                  <ReportsSkeleton />
                </div>
              }
            >
              <Reports />
            </Suspense>
          }
        />
        <Route path="profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
