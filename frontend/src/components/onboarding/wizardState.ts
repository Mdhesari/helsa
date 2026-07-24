import type { ActivityLevel, Diet, Goal, Sex, UpdateProfileRequest } from '../../api/types'
import type { PlanInputs } from '../../lib/plan'
import { RECOMMENDED_PACE } from '../../lib/plan'

/** Set once the user has passed through onboarding (register or skip). */
export const ONBOARDED_KEY = 'helsa.onboarded'

const WIZARD_KEY = 'helsa.wizard'

export type UnitSystem = 'metric' | 'imperial'

/** Client-side wizard answers; metric is stored, imperial is display-only. */
export interface WizardState {
  sex: Sex | null
  /** Derived from workouts/week: 0-2 → light, 3-5 → moderate, 6+ → active. */
  activity_level: ActivityLevel | null
  birth_date: string | null
  height_cm: number | null
  weight_kg: number | null
  goal: Goal | null
  target_weight_kg: number | null
  pace_kg_per_week: number
  diet: Diet | null
  unit: UnitSystem
}

export const EMPTY_WIZARD: WizardState = {
  sex: null,
  activity_level: null,
  birth_date: null,
  height_cm: null,
  weight_kg: null,
  goal: null,
  target_weight_kg: null,
  pace_kg_per_week: RECOMMENDED_PACE,
  diet: null,
  unit: 'metric',
}

/** Survives reloads within the tab; cleared after successful registration. */
export function loadWizardState(): WizardState {
  try {
    const raw = sessionStorage.getItem(WIZARD_KEY)
    if (!raw) return EMPTY_WIZARD
    return { ...EMPTY_WIZARD, ...(JSON.parse(raw) as Partial<WizardState>) }
  } catch {
    return EMPTY_WIZARD
  }
}

export function saveWizardState(state: WizardState): void {
  try {
    sessionStorage.setItem(WIZARD_KEY, JSON.stringify(state))
  } catch {
    // storage unavailable — wizard still works in memory
  }
}

export function clearWizardState(): void {
  try {
    sessionStorage.removeItem(WIZARD_KEY)
  } catch {
    // ignore
  }
}

/** True when every plan-relevant answer is present. */
export function wizardPlanInputs(s: WizardState): PlanInputs | null {
  if (!s.sex || !s.activity_level || !s.birth_date || !s.height_cm || !s.weight_kg || !s.goal) {
    return null
  }
  return {
    birth_date: s.birth_date,
    sex: s.sex,
    height_cm: s.height_cm,
    weight_kg: s.weight_kg,
    activity_level: s.activity_level,
    goal: s.goal,
    target_weight_kg: s.goal === 'maintain' ? null : s.target_weight_kg,
    pace_kg_per_week: s.goal === 'maintain' ? null : s.pace_kg_per_week,
  }
}

/** PUT /me/profile body from the finished wizard. */
export function wizardProfilePayload(s: WizardState): UpdateProfileRequest {
  return {
    sex: s.sex,
    activity_level: s.activity_level,
    birth_date: s.birth_date,
    height_cm: s.height_cm,
    weight_kg: s.weight_kg,
    goal: s.goal,
    target_weight_kg: s.goal === 'maintain' ? null : s.target_weight_kg,
    pace_kg_per_week: s.goal === 'maintain' ? null : s.pace_kg_per_week,
    diet: s.diet,
  }
}
