import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import * as api from '../api/client'
import { TOKEN_KEY, USER_KEY } from '../api/client'
import type { RegisterRequest, User } from '../api/types'
import { clearPersistedCache } from '../lib/persist'
import { clearUser as clearOutbox } from '../lib/outbox'

interface AuthContextValue {
  user: User | null
  token: string | null
  isAuthed: boolean
  login: (email: string, password: string) => Promise<void>
  register: (req: RegisterRequest) => Promise<void>
  logout: () => void
  /** Update the cached user after PUT /me. */
  setUser: (user: User) => void
  /** Store a fresh token (e.g. after PUT /me/password). */
  applyToken: (token: string) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function readStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_KEY),
  )
  const [user, setUserState] = useState<User | null>(readStoredUser)

  // An expired or revoked token clears the session from inside the API client;
  // make that path wipe offline data too, not just the token.
  useEffect(() => {
    api.setSessionClearedHandler(() => {
      void clearPersistedCache()
      if (user) void clearOutbox(user.id)
    })
  }, [user])

  const persistSession = useCallback((nextToken: string, nextUser: User) => {
    localStorage.setItem(TOKEN_KEY, nextToken)
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser))
    setTokenState(nextToken)
    setUserState(nextUser)
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api.login({ email, password })
      persistSession(res.token, res.user)
    },
    [persistSession],
  )

  const register = useCallback(
    async (req: RegisterRequest) => {
      const res = await api.register(req)
      persistSession(res.token, res.user)
    },
    [persistSession],
  )

  const logout = useCallback(() => {
    api.clearSession()
    // Offline data is personal health data: drop the cached reads and any
    // unsynced writes so the next person to open the app sees nothing.
    // Unsynced logs are lost by design — keeping them would replay one
    // account's meals into whoever signs in next.
    void clearPersistedCache()
    if (user) void clearOutbox(user.id)
    setTokenState(null)
    setUserState(null)
  }, [user])

  const setUser = useCallback((next: User) => {
    localStorage.setItem(USER_KEY, JSON.stringify(next))
    setUserState(next)
  }, [])

  const applyToken = useCallback((next: string) => {
    api.setToken(next)
    setTokenState(next)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthed: token !== null,
      login,
      register,
      logout,
      setUser,
      applyToken,
    }),
    [user, token, login, register, logout, setUser, applyToken],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
