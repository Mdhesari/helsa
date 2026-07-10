/**
 * TypeScript mirror of docs/api-contract.md (Helsa API v1).
 * Do not deviate from the contract without updating that file first.
 */

// ---------- Error shape ----------

export type ApiErrorCode =
  | 'invalid_request' // 400
  | 'invalid_credentials' // 401
  | 'unauthorized' // 401 — missing/invalid/expired/revoked token
  | 'email_taken' // 409
  | 'not_found' // 404
  | 'internal' // 500

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode
    message: string
  }
}

// ---------- Shared object shapes ----------

export interface User {
  id: number
  full_name: string
  email: string
  timezone: string
  created_at: string // RFC3339 UTC
}

export type Sex = 'male' | 'female'

export type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'active'
  | 'very_active'

/** Every biometric field is nullable; PUT is an upsert. */
export interface Profile {
  age: number | null
  sex: Sex | null
  weight_kg: number | null
  height_cm: number | null
  activity_level: ActivityLevel | null
  /** Null when the profile has never been set. */
  updated_at: string | null
}

export interface FoodLog {
  id: number
  food_name: string
  serving: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  logged_at: string // RFC3339 UTC
  created_at: string // RFC3339 UTC
  /** Reference food that pre-filled the snapshot; null for manual entries. */
  food_ref_id: number | null
}

export interface FoodServing {
  id: number
  label: string
  /** Null only for per-serving custom foods. */
  grams: number | null
  is_default: boolean
}

/** Nutrients are per nutrient_basis: "100g" (seeded) or "serving" (custom). */
export interface Food {
  id: number
  name: string
  category: string
  is_custom: boolean
  nutrient_basis: '100g' | 'serving'
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  is_favorite: boolean
  /** Default serving first; never empty. */
  servings: FoodServing[]
}

export interface FoodsResponse {
  foods: Food[]
}

export interface FoodSuggestionsResponse {
  recent: Food[]
  favorites: Food[]
  popular: Food[]
}

/** Nutrients are per the named serving. */
export interface CustomFoodInput {
  name: string
  serving_label?: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

/** Also used for Targets and Averages. */
export interface Totals {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

export interface Streak {
  current_days: number
  longest_days: number
}

// ---------- Auth ----------

export interface RegisterRequest {
  full_name: string
  email: string
  password: string
  /** Optional; server defaults to "UTC". */
  timezone?: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface AuthResponse {
  token: string
  user: User
}

// ---------- Me ----------

export interface UpdateMeRequest {
  full_name?: string
  timezone?: string
}

export interface ChangePasswordRequest {
  current_password: string
  new_password: string
}

export interface ChangePasswordResponse {
  /** Fresh token; all previously issued tokens are revoked. */
  token: string
}

/** Any subset; explicit null clears a field. */
export interface UpdateProfileRequest {
  age?: number | null
  sex?: Sex | null
  weight_kg?: number | null
  height_cm?: number | null
  activity_level?: ActivityLevel | null
}

// ---------- Logs ----------

export interface FoodLogInput {
  food_name: string
  serving: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  /** Optional; server defaults to now. */
  logged_at?: string
  /** Optional provenance link; explicit null clears it on PUT. */
  food_ref_id?: number | null
}

export interface LogsResponse {
  /** Ordered by logged_at ascending. */
  logs: FoodLog[]
}

// ---------- Dashboard ----------

export interface DashboardToday {
  date: string // YYYY-MM-DD (user's timezone)
  totals: Totals
  log_count: number
  logs: FoodLog[]
}

export interface DashboardResponse {
  user: User
  /** True when all 5 biometrics are set. */
  profile_complete: boolean
  targets: Totals | null
  today: DashboardToday
  streak: Streak
}

// ---------- Reports ----------

export type ReportPeriod = 'daily' | 'weekly' | 'monthly'

export interface ReportBucket {
  date: string // YYYY-MM-DD
  totals: Totals
  log_count: number
}

/** (average − target) / target × 100; negative = deficiency, positive = excess. */
export interface ReportDeltas {
  calories_pct: number
  protein_pct: number
  carbs_pct: number
  fat_pct: number
}

export interface ReportResponse {
  period: ReportPeriod
  start_date: string
  end_date: string
  timezone: string
  profile_complete: boolean
  targets: Totals | null
  /** One per day in range, zeros for empty days. */
  buckets: ReportBucket[]
  /** Mean over days with ≥1 log; null if no logs in range. */
  averages: Totals | null
  /** Null when targets or averages are null. */
  deltas: ReportDeltas | null
  streak: Streak
}

export interface InsightResponse {
  text: string
  generated_by: string // "stub" | "openrouter" (provider id string)
  period: ReportPeriod
  start_date: string
  end_date: string
  disclaimer: string
}

// ---------- Health ----------

export interface HealthResponse {
  status: 'ok'
}
