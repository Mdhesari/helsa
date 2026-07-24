/**
 * TypeScript mirror of docs/api-contract.md (Helsa API v2).
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

export type Sex = 'male' | 'female' | 'other'

export type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'active'
  | 'very_active'

export type Goal = 'lose' | 'maintain' | 'gain'

export type Diet =
  | 'balanced'
  | 'whole_food'
  | 'mediterranean'
  | 'flexitarian'
  | 'pescatarian'
  | 'vegetarian'
  | 'vegan'

/** Every field nullable; PUT is a partial upsert (explicit null clears). */
export interface Profile {
  birth_date: string | null // YYYY-MM-DD
  sex: Sex | null
  height_cm: number | null
  weight_kg: number | null
  activity_level: ActivityLevel | null
  goal: Goal | null
  target_weight_kg: number | null
  pace_kg_per_week: number | null
  diet: Diet | null
  updated_at: string | null
}

/** Calories + macros; also used for Targets, Averages, Remaining. */
export interface Totals {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

/** Derived, never stored. Null targets until plan complete. */
export interface Plan {
  complete: boolean
  goal: Goal | null
  pace_kg_per_week: number | null
  current_weight_kg: number | null
  target_weight_kg: number | null
  bmr: number | null
  tdee: number | null
  targets: Totals | null
  /** Null for "maintain" or when target/pace missing. */
  projected_end_date: string | null
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

export type WorkoutActivity =
  | 'walking'
  | 'running'
  | 'cycling'
  | 'swimming'
  | 'strength'
  | 'yoga'
  | 'hiit'
  | 'sports'
  | 'other'

export type WorkoutIntensity = 'low' | 'moderate' | 'high'

/** calories is always set in responses (client value or server estimate). */
export interface Workout {
  id: number
  activity: WorkoutActivity
  duration_min: number
  intensity: WorkoutIntensity
  calories: number
  calories_estimated: boolean
  notes: string | null
  logged_at: string
  created_at: string
}

export interface WeightEntry {
  id: number
  weight_kg: number
  measured_at: string
  created_at: string
}

export type HabitKind = 'cigarette' | 'water' | 'coffee' | 'alcohol' | 'custom'

/** "reduce" = stay UNDER daily_target; "build" = reach AT LEAST daily_target. */
export type HabitDirection = 'reduce' | 'build'

export interface Habit {
  id: number
  kind: HabitKind
  name: string
  unit: string
  direction: HabitDirection
  daily_target: number | null
  archived: boolean
  created_at: string
}

export interface HabitLog {
  id: number
  habit_id: number
  count: number
  logged_at: string
  created_at: string
}

/** Exactly one per user per local day; all content fields nullable. */
export interface DiaryEntry {
  date: string // YYYY-MM-DD
  mood: number | null // 1–5
  energy: number | null // 1–5
  text: string | null
  updated_at: string
}

/**
 * current_days counts consecutive local days with ≥1 tracked item of ANY kind
 * (food log, workout, habit log, or diary entry), ending today or yesterday.
 */
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
  birth_date?: string | null
  sex?: Sex | null
  height_cm?: number | null
  weight_kg?: number | null
  activity_level?: ActivityLevel | null
  goal?: Goal | null
  target_weight_kg?: number | null
  pace_kg_per_week?: number | null
  diet?: Diet | null
}

// ---------- Foods ----------

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
  calories?: number
  protein_g?: number
  carbs_g?: number
  fat_g?: number
}

// ---------- Food logs ----------

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

// ---------- Workouts ----------

export interface WorkoutInput {
  activity: WorkoutActivity
  /** 1–1440. */
  duration_min: number
  /** Optional; default "moderate". */
  intensity?: WorkoutIntensity
  /** Optional ≥ 0; omitted/null → server estimates. */
  calories?: number | null
  /** Optional ≤ 500 chars. */
  notes?: string
  /** Optional; default now. */
  logged_at?: string
}

export interface WorkoutsResponse {
  workouts: Workout[]
}

// ---------- Weights ----------

export interface WeightInput {
  /** 20–400. */
  weight_kg: number
  /** Optional; default now. */
  measured_at?: string
}

export interface WeightsResponse {
  /** Ordered by measured_at ascending. */
  entries: WeightEntry[]
}

// ---------- Habits ----------

export interface HabitInput {
  kind: HabitKind
  /** Required when kind is "custom". */
  name?: string
  unit?: string
  direction?: HabitDirection
  daily_target?: number | null
}

export interface UpdateHabitRequest {
  name?: string
  unit?: string
  direction?: HabitDirection
  daily_target?: number | null
  archived?: boolean
}

export interface HabitsResponse {
  habits: Habit[]
}

export interface HabitLogInput {
  /** Default 1; range 1–100. */
  count?: number
  logged_at?: string
}

export interface HabitLogsResponse {
  logs: HabitLog[]
}

// ---------- Diary ----------

/** At least one key required; explicit null clears a field. */
export interface DiaryUpsertRequest {
  mood?: number | null
  energy?: number | null
  text?: string | null
}

export interface DiaryDayResponse {
  entry: DiaryEntry | null
}

export interface DiaryRangeResponse {
  /** Ordered by date ascending. */
  entries: DiaryEntry[]
}

// ---------- Dashboard ----------

export interface DashboardHabit {
  habit: Habit
  /** Today's summed count. */
  count: number
}

export interface DashboardToday {
  date: string // YYYY-MM-DD (user's timezone)
  food: {
    totals: Totals
    log_count: number
    logs: FoodLog[]
  }
  /** Sum of today's workout calories. */
  burned_calories: number
  workouts: Workout[]
  /** targets − food totals; null when plan incomplete. */
  remaining: Totals | null
  habits: DashboardHabit[]
  diary: DiaryEntry | null
}

export interface DashboardWeight {
  /** Latest WeightEntry, else profile.weight_kg. */
  current_kg: number | null
  /** Earliest WeightEntry, else profile.weight_kg. */
  start_kg: number | null
  target_kg: number | null
}

export interface DashboardResponse {
  user: User
  plan: Plan
  today: DashboardToday
  weight: DashboardWeight
  streak: Streak
}

// ---------- Reports ----------

export type ReportPeriod = 'daily' | 'weekly' | 'monthly'

export interface ReportBucket {
  date: string // YYYY-MM-DD
  totals: Totals
  log_count: number
  burned_calories: number
  workout_count: number
}

export interface ReportWeightPoint {
  date: string
  weight_kg: number
}

export interface ReportHabitSeries {
  habit: Habit
  /** Full day series (zeros for empty days). */
  series: { date: string; count: number }[]
}

/** (average − target) / target × 100; negative = deficit, positive = excess. */
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
  plan: Plan
  /** One per day in range, zeros for empty days. */
  buckets: ReportBucket[]
  /** Days with entries only (last of the day). */
  weights: ReportWeightPoint[]
  /** Every non-archived habit, full day series. */
  habits: ReportHabitSeries[]
  /** Mean over days with ≥1 food log; null if none. */
  averages: Totals | null
  /** Null when targets or averages null. */
  deltas: ReportDeltas | null
  streak: Streak
}

export interface InsightResponse {
  text: string
  generated_by: string // "stub" | provider id
  period: ReportPeriod
  start_date: string
  end_date: string
  disclaimer: string
}

// ---------- Health ----------

export interface HealthResponse {
  status: 'ok'
}
