import type { QueryClient } from '@tanstack/react-query'

/** Query keys used across the app. */
export const qk = {
  dashboard: ['dashboard'] as const,
  logs: (date: string) => ['logs', date] as const,
  profile: ['profile'] as const,
  plan: ['plan'] as const,
  report: (period: string, date: string) => ['reports', period, date] as const,
  insight: (period: string, date: string) => ['insight', period, date] as const,
  foodSearch: (q: string) => ['foodSearch', q] as const,
  foodSuggestions: ['foodSuggestions'] as const,
  food: (id: number) => ['food', id] as const,
  workouts: (date: string) => ['workouts', date] as const,
  weights: ['weights'] as const,
  habits: ['habits'] as const,
  habitsAll: ['habits', 'all'] as const,
  diaryDay: (date: string) => ['diary', 'day', date] as const,
  diaryRange: (from: string, to: string) => ['diary', 'range', from, to] as const,
}

/** Anything logged/edited feeds the dashboard, reports and insights. */
function invalidateTrackingViews(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: ['dashboard'] })
  void qc.invalidateQueries({ queryKey: ['reports'] })
  void qc.invalidateQueries({ queryKey: ['insight'] })
}

/** Everything derived from food logs — call after any log mutation. */
export function invalidateFoodData(qc: QueryClient): void {
  invalidateTrackingViews(qc)
  void qc.invalidateQueries({ queryKey: ['logs'] })
  // Recents and popular ranking change with every log.
  void qc.invalidateQueries({ queryKey: ['foodSuggestions'] })
}

/** Favorites and custom foods appear in search results and suggestions. */
export function invalidateFoodRefData(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: ['foodSearch'] })
  void qc.invalidateQueries({ queryKey: ['foodSuggestions'] })
  void qc.invalidateQueries({ queryKey: ['food'] })
}

/** Call after workout mutations. */
export function invalidateWorkoutData(qc: QueryClient): void {
  invalidateTrackingViews(qc)
  void qc.invalidateQueries({ queryKey: ['workouts'] })
}

/**
 * Call after weight mutations — a new weight entry updates profile.weight_kg
 * and therefore the derived plan too.
 */
export function invalidateWeightData(qc: QueryClient): void {
  invalidateTrackingViews(qc)
  void qc.invalidateQueries({ queryKey: ['weights'] })
  void qc.invalidateQueries({ queryKey: ['profile'] })
  void qc.invalidateQueries({ queryKey: ['plan'] })
}

/** Call after habit or habit-log mutations. */
export function invalidateHabitData(qc: QueryClient): void {
  invalidateTrackingViews(qc)
  void qc.invalidateQueries({ queryKey: ['habits'] })
}

/** Call after diary mutations. */
export function invalidateDiaryData(qc: QueryClient): void {
  invalidateTrackingViews(qc)
  void qc.invalidateQueries({ queryKey: ['diary'] })
}

/** Plan targets depend on the profile — call after profile mutations. */
export function invalidateProfileData(qc: QueryClient): void {
  invalidateTrackingViews(qc)
  void qc.invalidateQueries({ queryKey: ['profile'] })
  void qc.invalidateQueries({ queryKey: ['plan'] })
}
