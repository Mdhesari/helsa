import type { QueryClient } from '@tanstack/react-query'

/** Query keys used across the app. */
export const qk = {
  dashboard: ['dashboard'] as const,
  logs: (date: string) => ['logs', date] as const,
  profile: ['profile'] as const,
  report: (period: string, date: string) => ['reports', period, date] as const,
  insight: (period: string, date: string) => ['insight', period, date] as const,
}

/** Everything derived from food logs — call after any log mutation. */
export function invalidateFoodData(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: ['dashboard'] })
  void qc.invalidateQueries({ queryKey: ['logs'] })
  void qc.invalidateQueries({ queryKey: ['reports'] })
  void qc.invalidateQueries({ queryKey: ['insight'] })
}

/** Targets depend on the biometric profile — call after profile mutations. */
export function invalidateProfileData(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: ['profile'] })
  void qc.invalidateQueries({ queryKey: ['dashboard'] })
  void qc.invalidateQueries({ queryKey: ['reports'] })
  void qc.invalidateQueries({ queryKey: ['insight'] })
}
