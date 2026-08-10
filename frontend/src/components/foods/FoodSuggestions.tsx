import { useQuery } from '@tanstack/react-query'

import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import * as api from '../../api/client'
import { errorMessage } from '../../api/client'
import type { Food } from '../../api/types'
import { qk } from '../../lib/queries'
import { EmptyState } from '../EmptyState'
import { AppleIllustration } from '../../assets/illustrations'
import { FoodResultList } from './FoodResultList'

interface FoodSuggestionsProps {
  onSelect: (food: Food) => void
}

/** Recent / Favorites / Popular sections shown before the user types. */
export function FoodSuggestions({ onSelect }: FoodSuggestionsProps) {
  const query = useQuery({
    queryKey: qk.foodSuggestions,
    queryFn: api.getFoodSuggestions,
    staleTime: 60_000,
  })

  if (query.isPending) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
      </div>
    )
  }
  if (query.isError) {
    return (
      <p className="px-1 text-sm font-medium text-destructive">
        {errorMessage(query.error)}
      </p>
    )
  }

  const { recent, favorites, popular } = query.data
  const sections = [
    { title: 'Recent', foods: recent },
    { title: 'Favorites', foods: favorites },
    { title: 'Popular', foods: popular },
  ].filter((s) => s.foods.length > 0)

  if (sections.length === 0) {
    return (
      <Card>
        <EmptyState
          illustration={<AppleIllustration size={72} />}
          title="Nothing here yet"
          body="Search for a food above, or create a custom one below."
        />
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <section key={section.title} className="space-y-2">
          <h2 className="px-1 text-sm font-semibold tracking-tight text-muted-foreground">
            {section.title}
          </h2>
          <FoodResultList foods={section.foods} onSelect={onSelect} />
        </section>
      ))}
    </div>
  )
}
