import type { ActivityLevel, Goal, Sex, Totals } from '../api/types'
import { addDays, todayStr, yearsBetween } from './date'

/**
 * Client-side mirror of the contract's plan computation (Mifflin-St Jeor).
 * Used to preview the plan during pre-auth onboarding; the server recomputes
 * the authoritative version after PUT /me/profile.
 */

export interface PlanInputs {
  birth_date: string
  sex: Sex
  height_cm: number
  weight_kg: number
  activity_level: ActivityLevel
  goal: Goal
  target_weight_kg: number | null
  pace_kg_per_week: number | null
}

export interface PlanPreview {
  bmr: number
  tdee: number
  targets: Totals
  /** Null for "maintain" or when target weight is missing. */
  projected_end_date: string | null
  /** |current − target|, rounded to 1 decimal; null when target missing. */
  weight_delta_kg: number | null
}

const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
}

export const RECOMMENDED_PACE = 0.5
export const PACE_MIN = 0.1
export const PACE_MAX = 1.5

export function computeBmr(
  sex: Sex,
  weightKg: number,
  heightCm: number,
  ageYears: number,
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears
  if (sex === 'male') return base + 5
  if (sex === 'female') return base - 161
  return base - 78 // midpoint
}

export function computePlan(inputs: PlanInputs): PlanPreview {
  const age = yearsBetween(inputs.birth_date, todayStr())
  const bmr = computeBmr(inputs.sex, inputs.weight_kg, inputs.height_cm, age)
  const tdee = bmr * ACTIVITY_MULTIPLIER[inputs.activity_level]

  const pace = inputs.pace_kg_per_week ?? RECOMMENDED_PACE
  const dailyDelta = (pace * 7700) / 7
  let calories = tdee
  if (inputs.goal === 'lose') calories = Math.max(1200, tdee - dailyDelta)
  else if (inputs.goal === 'gain') calories = tdee + dailyDelta

  const targets: Totals = {
    calories: Math.round(calories),
    protein_g: Math.round((calories * 0.3) / 4),
    carbs_g: Math.round((calories * 0.4) / 4),
    fat_g: Math.round((calories * 0.3) / 9),
  }

  let projected: string | null = null
  let delta: number | null = null
  if (inputs.target_weight_kg !== null) {
    delta =
      Math.round(Math.abs(inputs.weight_kg - inputs.target_weight_kg) * 10) / 10
    if (inputs.goal !== 'maintain') {
      const weeks = Math.ceil(delta / pace)
      projected = addDays(todayStr(), weeks * 7)
    }
  }

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    targets,
    projected_end_date: projected,
    weight_delta_kg: delta,
  }
}

// ---------- Unit conversions (metric is stored; imperial is display-only) ----------

export const KG_PER_LB = 0.45359237
export const CM_PER_IN = 2.54

export function kgToLbs(kg: number): number {
  return kg / KG_PER_LB
}

export function lbsToKg(lbs: number): number {
  return lbs * KG_PER_LB
}

export function cmToFtIn(cm: number): { ft: number; inch: number } {
  const totalIn = Math.round(cm / CM_PER_IN)
  return { ft: Math.floor(totalIn / 12), inch: totalIn % 12 }
}

export function ftInToCm(ft: number, inch: number): number {
  return Math.round((ft * 12 + inch) * CM_PER_IN)
}

/** 1-decimal display rounding for weights. */
export function round1(n: number): number {
  return Math.round(n * 10) / 10
}
