import type { Food, FoodServing, Totals } from '../api/types'

/**
 * Computes the nutrient snapshot for a serving × quantity selection.
 * Single source of truth for the live summary and the POST /logs payload.
 * Values are exact; round for display only.
 */
export function computeTotals(food: Food, serving: FoodServing, qty: number): Totals {
  const factor =
    food.nutrient_basis === '100g' ? ((serving.grams ?? 100) * qty) / 100 : qty
  return {
    calories: food.calories * factor,
    protein_g: food.protein_g * factor,
    carbs_g: food.carbs_g * factor,
    fat_g: food.fat_g * factor,
  }
}

/** Free-text serving for the log entry, e.g. "1.5 × 1 cup (245 g)". */
export function composeServingText(serving: FoodServing, qty: number): string {
  return qty === 1 ? serving.label : `${qty} × ${serving.label}`
}

/** Calories for a food's default serving (list rows). */
export function defaultServingCalories(food: Food): number {
  const serving = food.servings[0]
  if (!serving) return food.calories
  return computeTotals(food, serving, 1).calories
}
