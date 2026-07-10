import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Star } from 'lucide-react'

import { Button } from '@/components/ui/button'
import * as api from '../../api/client'
import type { Food } from '../../api/types'
import { invalidateFoodRefData } from '../../lib/queries'
import { defaultServingCalories } from '../../lib/nutrition'
import { cn } from '@/lib/utils'

/** Shared row for search results and suggestion sections. */
export function FoodRow({ food, onSelect }: { food: Food; onSelect: (food: Food) => void }) {
  const qc = useQueryClient()

  const toggleFavorite = useMutation({
    mutationFn: () =>
      food.is_favorite ? api.unfavoriteFood(food.id) : api.favoriteFood(food.id),
    onSettled: () => invalidateFoodRefData(qc),
  })

  const serving = food.servings[0]

  return (
    <li className="flex items-center gap-1 rounded-2xl border bg-card pr-1 shadow-[0_1px_2px_rgb(0_0_0/0.03)]">
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left"
        onClick={() => onSelect(food)}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{food.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {food.is_custom ? 'My food' : food.category}
            {serving && ` · ${serving.label}`}
          </p>
        </div>
        <span className="shrink-0 font-semibold tabular-nums">
          {Math.round(defaultServingCalories(food))}
          <span className="ml-0.5 text-[10px] font-medium text-muted-foreground">kcal</span>
        </span>
      </button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={food.is_favorite ? `Remove ${food.name} from favorites` : `Add ${food.name} to favorites`}
        aria-pressed={food.is_favorite}
        className={cn('shrink-0', food.is_favorite ? 'text-amber-500' : 'text-muted-foreground')}
        disabled={toggleFavorite.isPending}
        onClick={() => toggleFavorite.mutate()}
      >
        <Star strokeWidth={1.8} fill={food.is_favorite ? 'currentColor' : 'none'} />
      </Button>
    </li>
  )
}

export function FoodResultList({ foods, onSelect }: { foods: Food[]; onSelect: (food: Food) => void }) {
  return (
    <ul className="space-y-2">
      {foods.map((food) => (
        <FoodRow key={food.id} food={food} onSelect={onSelect} />
      ))}
    </ul>
  )
}
