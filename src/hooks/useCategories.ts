import { useQuery } from '@tanstack/react-query'
import { fetchCategories } from '@/services/categories.service'
import type { Category, CategoryGroup } from '@/types/finance.types'

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
    staleTime: Infinity, // categories never change
  })
}

export function useCategoriesByGroup() {
  const { data: categories = [], ...rest } = useCategories()

  const byGroup = categories.reduce<Record<CategoryGroup, Category[]>>(
    (acc, cat) => {
      if (!acc[cat.group_name]) acc[cat.group_name] = []
      acc[cat.group_name].push(cat)
      return acc
    },
    {} as Record<CategoryGroup, Category[]>
  )

  return { byGroup, categories, ...rest }
}
