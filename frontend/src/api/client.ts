import type {
  ApiErrorBody,
  ApiErrorCode,
  AuthResponse,
  ChangePasswordRequest,
  ChangePasswordResponse,
  DashboardResponse,
  FoodLog,
  FoodLogInput,
  InsightResponse,
  LoginRequest,
  LogsResponse,
  Profile,
  RegisterRequest,
  ReportPeriod,
  ReportResponse,
  UpdateMeRequest,
  UpdateProfileRequest,
  User,
} from './types'

const BASE = '/api/v1'

// ---------- Token storage ----------

export const TOKEN_KEY = 'helsa.token'
export const USER_KEY = 'helsa.user'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

// ---------- Errors ----------

export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly status: number

  constructor(code: ApiErrorCode, message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError
}

/** Friendly message extraction for any thrown value. */
export function errorMessage(e: unknown): string {
  if (isApiError(e)) return e.message
  if (e instanceof Error) return 'Could not reach the server. Please try again.'
  return 'Something went wrong. Please try again.'
}

async function toApiError(res: Response): Promise<ApiError> {
  let code: ApiErrorCode = 'internal'
  let message = `Request failed (${res.status})`
  try {
    const body = (await res.json()) as ApiErrorBody
    if (body?.error?.code) {
      code = body.error.code
      message = body.error.message || message
    }
  } catch {
    // non-JSON error body — keep fallback
  }
  return new ApiError(code, message, res.status)
}

function handleUnauthorized(err: ApiError): void {
  // Covers expired tokens and the password-change revocation flow
  // (pwd_at mismatch → 401 "unauthorized" on any authed endpoint).
  if (err.status === 401 && err.code === 'unauthorized') {
    clearSession()
    if (window.location.pathname !== '/login') {
      window.location.assign('/login')
    }
  }
}

// ---------- Core fetch wrapper ----------

interface RequestOptions {
  method?: string
  body?: unknown
  auth?: boolean
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true } = opts
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth) {
    const token = getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const err = await toApiError(res)
    handleUnauthorized(err)
    throw err
  }

  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

// ---------- Auth ----------

export function register(req: RegisterRequest): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/register', {
    method: 'POST',
    body: req,
    auth: false,
  })
}

export function login(req: LoginRequest): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: req,
    auth: false,
  })
}

// ---------- Me ----------

export function getMe(): Promise<User> {
  return request<User>('/me')
}

export function updateMe(req: UpdateMeRequest): Promise<User> {
  return request<User>('/me', { method: 'PUT', body: req })
}

export function changePassword(
  req: ChangePasswordRequest,
): Promise<ChangePasswordResponse> {
  return request<ChangePasswordResponse>('/me/password', {
    method: 'PUT',
    body: req,
  })
}

export function getProfile(): Promise<Profile> {
  return request<Profile>('/me/profile')
}

export function updateProfile(req: UpdateProfileRequest): Promise<Profile> {
  return request<Profile>('/me/profile', { method: 'PUT', body: req })
}

// ---------- Logs ----------

export function createLog(input: FoodLogInput): Promise<FoodLog> {
  return request<FoodLog>('/logs', { method: 'POST', body: input })
}

export type LogsQuery = { date: string } | { from: string; to: string } | undefined

export function getLogs(query?: LogsQuery): Promise<LogsResponse> {
  const params = new URLSearchParams()
  if (query) {
    if ('date' in query) params.set('date', query.date)
    else {
      params.set('from', query.from)
      params.set('to', query.to)
    }
  }
  const qs = params.toString()
  return request<LogsResponse>(`/logs${qs ? `?${qs}` : ''}`)
}

export function updateLog(
  id: number,
  input: Partial<FoodLogInput>,
): Promise<FoodLog> {
  return request<FoodLog>(`/logs/${id}`, { method: 'PUT', body: input })
}

export function deleteLog(id: number): Promise<void> {
  return request<void>(`/logs/${id}`, { method: 'DELETE' })
}

// ---------- Dashboard / Reports ----------

export function getDashboard(): Promise<DashboardResponse> {
  return request<DashboardResponse>('/dashboard')
}

export function getReport(
  period: ReportPeriod,
  date?: string,
): Promise<ReportResponse> {
  const params = new URLSearchParams({ period })
  if (date) params.set('date', date)
  return request<ReportResponse>(`/reports?${params.toString()}`)
}

export function getInsight(
  period: ReportPeriod,
  date?: string,
): Promise<InsightResponse> {
  const params = new URLSearchParams({ period })
  if (date) params.set('date', date)
  return request<InsightResponse>(`/reports/insight?${params.toString()}`)
}

// ---------- Export ----------

/** Fetches the xlsx with the Bearer header and triggers a blob download. */
export async function exportXlsx(): Promise<void> {
  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}/export.xlsx`, { headers })
  if (!res.ok) {
    const err = await toApiError(res)
    handleUnauthorized(err)
    throw err
  }

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'helsa-food-logs.xlsx'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
